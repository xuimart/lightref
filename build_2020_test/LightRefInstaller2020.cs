// LightRefInstaller.cs - Instalador WinForms do LightRef (padrao Xuimart).
// Compilado com csc.exe (.NET Framework 4.x). O ZIP do plugin e embutido como
// recurso. Sem generator: so instala o CEP. Auto-eleva para Administrador.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Security.Principal;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

class LightRefInstaller
{
    const string RESOURCE_NAME = "lightref.zip";
    const string CEP_FOLDER = "com.lightref.cep";
    const string VERSION = "0.5.0";

    [STAThread]
    static void Main()
    {
        if (!IsAdministrator())
        {
            try
            {
                var proc = new ProcessStartInfo {
                    UseShellExecute = true,
                    FileName = Application.ExecutablePath,
                    Verb = "runas"
                };
                Process.Start(proc);
            }
            catch { }
            return;
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
    }

    static bool IsAdministrator()
    {
        try {
            var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        } catch { return false; }
    }

    // ---------- UI ----------
    class InstallerForm : Form
    {
        Button installBtn;
        Label status;
        TextBox log;
        ProgressBar bar;

        public InstallerForm()
        {
            Text = "LightRef v" + VERSION + " - TESTE PS 2020";
            Width = 560; Height = 440;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(25, 27, 31);
            ForeColor = Color.FromArgb(211, 213, 218);
            Font = new Font("Segoe UI", 9f);
            MaximizeBox = false; FormBorderStyle = FormBorderStyle.FixedSingle;

            var title = new Label {
                Text = "LightRef - Referencia de iluminacao 3D para Photoshop",
                Left = 18, Top = 16, Width = 500, Height = 24,
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = Color.FromArgb(255, 23, 77)
            };
            var sub = new Label {
                Text = "Versao " + VERSION + " (build de teste para Photoshop 2020). Instala o painel CEP.",
                Left = 18, Top = 44, Width = 500, Height = 20,
                ForeColor = Color.FromArgb(163, 167, 174)
            };

            installBtn = new Button {
                Text = "Instalar", Left = 18, Top = 76, Width = 120, Height = 34,
                FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(255, 23, 77), ForeColor = Color.White
            };
            installBtn.FlatAppearance.BorderSize = 0;
            installBtn.Click += (s, e) => { installBtn.Enabled = false; new Thread(RunInstall) { IsBackground = true }.Start(); };

            bar = new ProgressBar { Left = 150, Top = 80, Width = 380, Height = 24, Style = ProgressBarStyle.Continuous };
            status = new Label { Left = 18, Top = 120, Width = 512, Height = 20, ForeColor = Color.FromArgb(143, 211, 154) };
            log = new TextBox {
                Left = 18, Top = 146, Width = 512, Height = 240, Multiline = true, ReadOnly = true,
                ScrollBars = ScrollBars.Vertical, BackColor = Color.FromArgb(20, 22, 26), ForeColor = Color.FromArgb(200, 205, 212), BorderStyle = BorderStyle.FixedSingle
            };

            Controls.Add(title); Controls.Add(sub); Controls.Add(installBtn);
            Controls.Add(bar); Controls.Add(status); Controls.Add(log);
        }

        void Log(string msg)
        {
            if (log.InvokeRequired) { log.Invoke(new Action<string>(Log), msg); return; }
            log.AppendText(msg + Environment.NewLine);
        }
        void SetStatus(string msg, int pct)
        {
            if (status.InvokeRequired) { status.Invoke(new Action<string, int>(SetStatus), msg, pct); return; }
            status.Text = msg; bar.Value = Math.Max(0, Math.Min(100, pct));
        }

        void RunInstall()
        {
            try
            {
                SetStatus("Extraindo pacote...", 10);
                string zipPath = ExtractEmbeddedZip();
                Log("ZIP: " + zipPath);

                SetStatus("Ativando PlayerDebugMode...", 25);
                EnablePlayerDebugMode();
                Log("PlayerDebugMode ativado (CSXS 6-15).");

                SetStatus("Detectando Photoshop...", 40);
                var psDirs = DetectPhotoshop();
                Log("Photoshop encontrado: " + psDirs.Count);

                SetStatus("Copiando arquivos...", 60);
                var targets = CepTargets(psDirs);
                InstallCep(zipPath, targets);

                SetStatus("Concluido!", 100);
                Log("");
                Log("Instalacao concluida. Abra o Photoshop e va em:");
                Log("  Janela > Extensoes > LightRef");
                MessageBox.Show("LightRef v" + VERSION + " instalado com sucesso!\n\nAbra o Photoshop: Janela > Extensoes > LightRef.",
                    "Concluido", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                Log("ERRO: " + ex.Message);
                SetStatus("Falha na instalacao.", 0);
                MessageBox.Show("Falha: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                if (installBtn.InvokeRequired) installBtn.Invoke(new Action(() => installBtn.Enabled = true));
                else installBtn.Enabled = true;
            }
        }

        string ExtractEmbeddedZip()
        {
            var asm = Assembly.GetExecutingAssembly();
            Stream stream = asm.GetManifestResourceStream(RESOURCE_NAME);
            if (stream == null)
            {
                foreach (var n in asm.GetManifestResourceNames())
                    if (n.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) { stream = asm.GetManifestResourceStream(n); break; }
            }
            if (stream == null)
            {
                // Fallback: .zip solto ao lado do exe (para testes).
                string local = Path.Combine(Path.GetDirectoryName(Application.ExecutablePath), RESOURCE_NAME);
                if (File.Exists(local)) return local;
                throw new Exception("Pacote do plugin nao encontrado no instalador.");
            }
            string tmp = Path.Combine(Path.GetTempPath(), "lightref_install.zip");
            using (var fs = File.Create(tmp)) stream.CopyTo(fs);
            return tmp;
        }

        void EnablePlayerDebugMode()
        {
            string[] vers = { "6","7","8","9","9.4","10","11","12","13","14","15" };
            foreach (var v in vers)
            {
                string key = @"Software\Adobe\CSXS." + v;
                try { Registry.CurrentUser.CreateSubKey(key).SetValue("PlayerDebugMode", "1", RegistryValueKind.String); } catch { }
                try { Registry.LocalMachine.CreateSubKey(key).SetValue("PlayerDebugMode", "1", RegistryValueKind.String); } catch { }
                try { Registry.LocalMachine.CreateSubKey(@"Software\WOW6432Node\Adobe\CSXS." + v).SetValue("PlayerDebugMode", "1", RegistryValueKind.String); } catch { }
            }
        }

        List<string> DetectPhotoshop()
        {
            var found = new List<string>();
            string[] progDirs = {
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)
            };
            foreach (var pd in progDirs)
            {
                try {
                    string adobe = Path.Combine(pd, "Adobe");
                    if (!Directory.Exists(adobe)) continue;
                    foreach (var dir in Directory.GetDirectories(adobe, "Adobe Photoshop*"))
                        found.Add(dir);
                } catch { }
            }
            ScanRegistry(found, RegistryView.Registry64);
            ScanRegistry(found, RegistryView.Registry32);
            return found.GroupBy(p => p.ToLowerInvariant()).Select(g => g.First()).ToList();
        }

        void ScanRegistry(List<string> found, RegistryView view)
        {
            try {
                using (var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view))
                using (var ps = baseKey.OpenSubKey(@"SOFTWARE\Adobe\Photoshop"))
                {
                    if (ps == null) return;
                    foreach (var sub in ps.GetSubKeyNames())
                    {
                        using (var k = ps.OpenSubKey(sub))
                        {
                            if (k == null) continue;
                            var path = (k.GetValue("ApplicationPath") ?? k.GetValue("Path") ?? k.GetValue("InstallPath")) as string;
                            if (!string.IsNullOrEmpty(path) && Directory.Exists(path)) found.Add(path.TrimEnd('\\'));
                        }
                    }
                }
            } catch { }
        }

        List<string> CepTargets(List<string> psDirs)
        {
            var targets = new List<string>();
            string appdata = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            targets.Add(Path.Combine(appdata, @"Adobe\CEP\extensions", CEP_FOLDER));
            targets.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFilesX86), @"Adobe\CEP\extensions", CEP_FOLDER));
            targets.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles), @"Adobe\CEP\extensions", CEP_FOLDER));
            foreach (var ps in psDirs)
                targets.Add(Path.Combine(ps, @"Required\CEP\extensions", CEP_FOLDER));
            return targets;
        }

        void InstallCep(string zipPath, List<string> targets)
        {
            using (var archive = ZipFile.OpenRead(zipPath))
            {
                foreach (var t in targets)
                {
                    try { if (Directory.Exists(t)) Directory.Delete(t, true); } catch { }
                    try { Directory.CreateDirectory(t); } catch { continue; }
                }
                foreach (var entry in archive.Entries)
                {
                    if (entry.FullName.EndsWith("/")) continue;
                    if (!entry.FullName.StartsWith("cep/")) continue;
                    string sub = entry.FullName.Substring("cep/".Length);
                    foreach (var t in targets)
                    {
                        try {
                            string dest = Path.Combine(t, sub.Replace('/', '\\'));
                            Directory.CreateDirectory(Path.GetDirectoryName(dest));
                            entry.ExtractToFile(dest, true);
                        } catch { }
                    }
                }
            }
            Log("CEP instalado em " + targets.Count + " local(is).");
        }
    }
}
