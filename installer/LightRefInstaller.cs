// LightRefInstaller.cs - instalador WinForms do plugin CEP LightRef.
// Padrao Xuimart: .exe unico com o plugin embutido como recurso (plugin.zip).
// Extrai as entradas com prefixo "cep/" para a pasta de extensoes CEP do usuario.
// Compila com csc.exe (sem Visual Studio). Ver installer/build.ps1.
using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace LightRefInstaller
{
    public class MainForm : Form
    {
        const string PRODUCT = "LightRef";
        const string VERSION = "0.4.0";
        const string EXT_ID = "com.lightref.cep";
        const string ZIP_RESOURCE = "plugin.zip";
        const string CEP_PREFIX = "cep/";

        Label status;
        ProgressBar bar;
        Button install, close;

        public MainForm()
        {
            Text = PRODUCT + " " + VERSION + " - Instalador";
            Width = 460; Height = 240;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(30, 31, 34);
            ForeColor = Color.White;

            var title = new Label();
            title.Text = PRODUCT + "  v" + VERSION;
            title.Font = new Font("Segoe UI", 15, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(222, 34, 70); // accent Xuimart
            title.SetBounds(20, 18, 420, 32);
            Controls.Add(title);

            var sub = new Label();
            sub.Text = "Referencia de iluminacao 3D para Photoshop.";
            sub.ForeColor = Color.FromArgb(190, 192, 200);
            sub.SetBounds(20, 52, 420, 20);
            Controls.Add(sub);

            status = new Label();
            status.Text = "Pronto para instalar.";
            status.ForeColor = Color.FromArgb(190, 192, 200);
            status.SetBounds(20, 92, 420, 20);
            Controls.Add(status);

            bar = new ProgressBar();
            bar.SetBounds(20, 116, 420, 16);
            bar.Style = ProgressBarStyle.Continuous;
            Controls.Add(bar);

            install = new Button();
            install.Text = "Instalar";
            install.SetBounds(240, 150, 90, 34);
            install.FlatStyle = FlatStyle.Flat;
            install.BackColor = Color.FromArgb(222, 34, 70);
            install.ForeColor = Color.White;
            install.Click += (s, e) => DoInstall();
            Controls.Add(install);

            close = new Button();
            close.Text = "Fechar";
            close.SetBounds(340, 150, 90, 34);
            close.FlatStyle = FlatStyle.Flat;
            close.BackColor = Color.FromArgb(60, 62, 68);
            close.ForeColor = Color.White;
            close.Click += (s, e) => Close();
            Controls.Add(close);
        }

        Stream OpenPayload()
        {
            var asm = Assembly.GetExecutingAssembly();
            foreach (var name in asm.GetManifestResourceNames())
            {
                if (name.EndsWith(ZIP_RESOURCE, StringComparison.OrdinalIgnoreCase))
                    return asm.GetManifestResourceStream(name);
            }
            // Fallback: procura o zip ao lado do .exe.
            var side = Path.Combine(Path.GetDirectoryName(Application.ExecutablePath), ZIP_RESOURCE);
            if (File.Exists(side)) return File.OpenRead(side);
            return null;
        }

        void DoInstall()
        {
            install.Enabled = false;
            try
            {
                string cepRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "Adobe", "CEP", "extensions");
                string dest = Path.Combine(cepRoot, EXT_ID);
                Directory.CreateDirectory(cepRoot);

                using (Stream zs = OpenPayload())
                {
                    if (zs == null) { MessageBox.Show("Payload nao encontrado."); install.Enabled = true; return; }
                    using (var zip = new ZipArchive(zs, ZipArchiveMode.Read))
                    {
                        int total = 0;
                        foreach (var en in zip.Entries)
                            if (en.FullName.StartsWith(CEP_PREFIX, StringComparison.OrdinalIgnoreCase) && en.Length >= 0 && !en.FullName.EndsWith("/")) total++;
                        bar.Maximum = total > 0 ? total : 1;
                        int done = 0;
                        foreach (var en in zip.Entries)
                        {
                            if (!en.FullName.StartsWith(CEP_PREFIX, StringComparison.OrdinalIgnoreCase)) continue;
                            string rel = en.FullName.Substring(CEP_PREFIX.Length);
                            if (string.IsNullOrEmpty(rel)) continue;
                            string outPath = Path.Combine(dest, rel.Replace('/', Path.DirectorySeparatorChar));
                            if (en.FullName.EndsWith("/")) { Directory.CreateDirectory(outPath); continue; }
                            Directory.CreateDirectory(Path.GetDirectoryName(outPath));
                            en.ExtractToFile(outPath, true);
                            done++; bar.Value = Math.Min(bar.Maximum, done);
                            status.Text = "Instalando: " + rel;
                            Application.DoEvents();
                        }
                    }
                }
                status.Text = "Instalacao concluida. Reinicie o Photoshop.";
                MessageBox.Show("LightRef instalado com sucesso!\n\nAbra o Photoshop e va em Janela > Extensoes > LightRef.",
                    "Concluido", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                status.Text = "Erro: " + ex.Message;
                MessageBox.Show("Falha na instalacao:\n" + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                install.Enabled = true;
            }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
