using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Xml;
using Microsoft.Win32;

[assembly: AssemblyTitle("LightRef — Instalador")]
[assembly: AssemblyProduct("LightRef")]
[assembly: AssemblyCompany("Xuimart")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace Xuimart.LightRefInstaller
{
    sealed class FileRecord { public string path { get; set; } public long bytes { get; set; } public string sha256 { get; set; } }
    sealed class InstallContext
    {
        public string CepRoot, BackupRoot, DataRoot;
        public List<string> CepRoots;
        public Action<string> Log;
        public Action<int> BeforeCommit;
        public Func<Action> ConfigureRegistry;
        public static InstallContext Production()
        {
            string app = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            return new InstallContext {
                CepRoot = Path.Combine(app, "Adobe", "CEP", "extensions"),
                BackupRoot = Path.Combine(app, "Adobe", "CEP", "extension-backups"),
                DataRoot = Path.Combine(app, "LightRef"), ConfigureRegistry = ConfigureDebug,
                CepRoots = Core.CepRoots(Core.DetectPhotoshop())
            };
        }
        static Action ConfigureDebug()
        {
            var undo = new List<Action>();
            try {
                foreach (string version in new [] { "6", "7", "8", "9", "9.4", "10", "11", "12", "13", "14", "15" }) {
                  foreach (var destination in new [] {
                    new KeyValuePair<RegistryKey,string>(Registry.CurrentUser,@"Software\Adobe\CSXS." + version),
                    new KeyValuePair<RegistryKey,string>(Registry.LocalMachine,@"Software\Adobe\CSXS." + version),
                    new KeyValuePair<RegistryKey,string>(Registry.LocalMachine,@"Software\WOW6432Node\Adobe\CSXS." + version)
                  }) {
                    string keyPath = destination.Value;
                    object previous; RegistryValueKind kind = RegistryValueKind.String;
                    using (var key = destination.Key.CreateSubKey(keyPath)) {
                        previous = key.GetValue("PlayerDebugMode", null);
                        if (previous != null) kind = key.GetValueKind("PlayerDebugMode");
                        key.SetValue("PlayerDebugMode", "1", RegistryValueKind.String);
                    }
                    string restorePath=keyPath;object restoreValue=previous;RegistryValueKind restoreKind=kind;RegistryKey restoreRoot=destination.Key;
                    undo.Add(delegate { using(var key=restoreRoot.CreateSubKey(restorePath)) { if(restoreValue==null)key.DeleteValue("PlayerDebugMode",false);else key.SetValue("PlayerDebugMode",restoreValue,restoreKind); } });
                  }
                }
            } catch { for(int i=undo.Count-1;i>=0;i--)undo[i]();throw; }
            return delegate { for(int i=undo.Count-1;i>=0;i--)undo[i](); };
        }
    }

    static class Core
    {
        public const string Bundle = "com.lightref";
        public const string Panel = Bundle + ".panel";
        public const string Folder = "com.lightref.cep";
        public const string Version = "1.0.0";
        const string Payload = "lightref.zip";
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

        public static string Child(string root, string relative)
        {
            string rel = relative.Replace('\\', '/');
            if (String.IsNullOrEmpty(rel) || rel.StartsWith("/") || rel.Contains(":") ||
                rel.Split('/').Any(p => p.Length == 0 || p == "." || p == ".." || p.EndsWith(".") || p.EndsWith(" ")))
                throw new InvalidDataException("Caminho inválido no pacote: " + relative);
            string basePath = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string path = Path.GetFullPath(Path.Combine(basePath, rel.Replace('/', Path.DirectorySeparatorChar)));
            if (!path.StartsWith(basePath, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Caminho fora do destino.");
            return path;
        }
        static string Hash(Stream input)
        {
            using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
        }
        static ZipArchive OpenPayload()
        {
            Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(Payload);
            if (stream == null) throw new InvalidDataException("Pacote interno não encontrado.");
            return new ZipArchive(stream, ZipArchiveMode.Read);
        }
        static FileRecord[] Records(ZipArchive zip)
        {
            var entry = zip.GetEntry("cep/runtime-manifest.json");
            if (entry == null) throw new InvalidDataException("Manifesto de integridade ausente.");
            using (var reader = new StreamReader(entry.Open(), Encoding.UTF8, true)) {
                var files = Json.Deserialize<FileRecord[]>(reader.ReadToEnd());
                if (files == null || files.Length == 0) throw new InvalidDataException("Pacote vazio.");
                return files;
            }
        }
        public static int VerifyPayload(string extractRoot, Action<int, string> progress)
        {
            using (var zip = OpenPayload()) {
                FileRecord[] records = Records(zip);
                var expected = new Dictionary<string, FileRecord>(StringComparer.OrdinalIgnoreCase);
                foreach (var record in records) {
                    Child(Path.GetTempPath(), record.path);
                    string name = record.path.Replace('\\', '/');
                    if (expected.ContainsKey(name)) throw new InvalidDataException("Arquivo repetido: " + name);
                    expected.Add(name, record);
                }
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                int done = 0;
                foreach (var entry in zip.Entries) {
                    string fullName = entry.FullName.Replace('\\', '/');
                    if (!fullName.StartsWith("cep/", StringComparison.Ordinal)) throw new InvalidDataException("Prefixo inesperado no pacote: " + fullName);
                    string name = fullName.Substring(4);
                    Child(Path.GetTempPath(), name);
                    if (!seen.Add(name)) throw new InvalidDataException("Entrada repetida: " + name);
                    if (name == "runtime-manifest.json") {
                        if (extractRoot != null) {
                            using (var source = entry.Open()) using (var output = File.Create(Child(extractRoot, name))) source.CopyTo(output);
                        }
                        continue;
                    }
                    FileRecord record;
                    if (!expected.TryGetValue(name, out record)) throw new InvalidDataException("Arquivo não previsto: " + name);
                    if (entry.Length != record.bytes) throw new InvalidDataException("Tamanho divergente: " + name);
                    string hash;
                    if (extractRoot == null) { using (var input = entry.Open()) hash = Hash(input); }
                    else {
                        string target = Child(extractRoot, name);
                        Directory.CreateDirectory(Path.GetDirectoryName(target));
                        using (var source = entry.Open()) using (var output = File.Create(target)) source.CopyTo(output);
                        using (var input = File.OpenRead(target)) hash = Hash(input);
                    }
                    if (!String.Equals(hash, record.sha256, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Integridade divergente: " + name);
                    done++;
                    if (progress != null) progress(5 + done * 75 / records.Length, "Conferindo arquivos: " + done + "/" + records.Length);
                }
                if (done != records.Length) throw new InvalidDataException("Há arquivos ausentes no pacote.");
                if (extractRoot != null) ValidateBundle(extractRoot);
                return done;
            }
        }
        static void ValidateBundle(string directory)
        {
            if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) throw new IOException("O destino é um link de pasta.");
            var xml = new XmlDocument { XmlResolver = null };
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
            using (var reader = XmlReader.Create(Child(directory, "CSXS/manifest.xml"), settings)) xml.Load(reader);
            if (xml.DocumentElement.GetAttribute("ExtensionBundleId") != Bundle) throw new InvalidDataException("A pasta de destino pertence a outro plugin.");
            var panel = xml.SelectSingleNode("/ExtensionManifest/ExtensionList/Extension") as XmlElement;
            if (panel == null || panel.GetAttribute("Id") != Panel) throw new InvalidDataException("ID do painel divergente.");
        }
        public static Dictionary<string, object> Install(InstallContext context, Action<int, string> progress)
        {
            using (var mutex = new Mutex(false, @"Local\XuimartLightRefInstaller")) {
                bool locked = false;
                try {
                    try { locked = mutex.WaitOne(0); } catch (AbandonedMutexException) { locked = true; }
                    if (!locked) throw new IOException("Já existe uma instalação do LightRef em andamento.");
                    return context.CepRoots == null ? InstallLocked(context, progress) : InstallManyLocked(context, progress);
                } finally { if (locked) mutex.ReleaseMutex(); }
            }
        }
        static Dictionary<string, object> InstallLocked(InstallContext context, Action<int, string> progress)
        {
            string target = Child(context.CepRoot, Folder);
            string stageRoot = Path.Combine(Directory.GetParent(Path.GetFullPath(context.CepRoot)).FullName, "installer-staging");
            string stage = Child(stageRoot, "lightref-" + Guid.NewGuid().ToString("N"));
            string backup = null;
            bool committed = false;
            Action undoRegistry = null;
            if (File.Exists(target)) throw new IOException("Há um arquivo no caminho de instalação.");
            if (Directory.Exists(target)) ValidateBundle(target);
            Directory.CreateDirectory(stage);
            try {
                int count = VerifyPayload(stage, progress);
                Directory.CreateDirectory(context.CepRoot);
                if (Directory.Exists(target)) {
                    Directory.CreateDirectory(context.BackupRoot);
                    backup = Child(context.BackupRoot, Bundle + "-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 8));
                    if (progress != null) progress(84, "Guardando a versão anterior...");
                    Directory.Move(target, backup);
                }
                Directory.Move(stage, target); committed = true;
                if (progress != null) progress(92, "Configurando o CEP do usuário...");
                undoRegistry = context.ConfigureRegistry();
                var result = new Dictionary<string, object> {
                    { "product", "LightRef" }, { "version", Version }, { "bundleId", Bundle },
                    { "target", target }, { "backup", backup }, { "verifiedFiles", count },
                    { "installedAtUtc", DateTime.UtcNow.ToString("o") }, { "photoshopRestartRequired", true }
                };
                try {
                    Directory.CreateDirectory(context.DataRoot);
                    File.WriteAllText(Child(context.DataRoot, "installer-receipt.json"), Json.Serialize(result), new UTF8Encoding(false));
                } catch (Exception e) { result.Add("receiptWarning", e.Message); }
                if (progress != null) progress(100, "Instalação concluída. Reinicie o Photoshop após salvar seus documentos.");
                return result;
            } catch {
                if (undoRegistry != null) undoRegistry();
                if (committed && Directory.Exists(target)) {
                    Directory.CreateDirectory(stageRoot);
                    Directory.Move(target, Child(stageRoot, "failed-lightref-" + Guid.NewGuid().ToString("N")));
                }
                if (backup != null && Directory.Exists(backup) && !Directory.Exists(target)) Directory.Move(backup, target);
                throw;
            } finally {
                // Only a uniquely created, verified staging child can be removed here.
                if (Directory.Exists(stage) && Path.GetFullPath(stage) == Child(stageRoot, Path.GetFileName(stage))) {
                    try { Directory.Delete(stage, true); } catch { }
                }
            }
        }
        sealed class PendingInstall
        {
            public string Target, StageRoot, Stage, Backup;
            public bool Committed;
        }
        public static List<string> BuildCepRoots(string appData, string commonX86, string common64, IEnumerable<string> photoshop)
        {
            var roots = new List<string> { Path.Combine(appData, "Adobe", "CEP", "extensions") };
            foreach (string common in new [] { commonX86, common64 })
                if (!String.IsNullOrEmpty(common)) roots.Add(Path.Combine(common, "Adobe", "CEP", "extensions"));
            foreach (string ps in photoshop) roots.Add(Path.Combine(ps, "Required", "CEP", "extensions"));
            return roots.Select(p => Path.GetFullPath(p).TrimEnd(Path.DirectorySeparatorChar)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        public static List<string> CepRoots(IEnumerable<string> photoshop)
        {
            return BuildCepRoots(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFilesX86),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles), photoshop);
        }
        static void CopyVerifiedPayload(string source, string target, FileRecord[] records)
        {
            foreach (var file in records) {
                string destination = Child(target, file.path);
                Directory.CreateDirectory(Path.GetDirectoryName(destination));
                File.Copy(Child(source, file.path), destination, false);
                using (var input = File.OpenRead(destination))
                    if (input.Length != file.bytes || Hash(input) != file.sha256) throw new InvalidDataException("Arquivo copiado com divergência: " + file.path);
            }
            File.Copy(Child(source, "runtime-manifest.json"), Child(target, "runtime-manifest.json"), false);
            ValidateBundle(target);
        }
        static void RemoveStage(string parent, string stage)
        {
            if (Path.GetFullPath(stage) != Child(parent, Path.GetFileName(stage)) || !Path.GetFileName(stage).StartsWith("lightref-", StringComparison.Ordinal))
                throw new IOException("Pasta temporária fora do local esperado.");
            if (Directory.Exists(stage)) Directory.Delete(stage, true);
        }
        static Dictionary<string, object> InstallManyLocked(InstallContext context, Action<int,string> progress)
        {
            var roots = context.CepRoots.Select(Path.GetFullPath).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (!roots.Any()) throw new IOException("Nenhum destino CEP foi encontrado.");
            string temp = Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar);
            string source = Child(temp, "lightref-source-" + Guid.NewGuid().ToString("N"));
            var plans = new List<PendingInstall>();
            Action undoRegistry = null;
            Action<string> log = context.Log ?? delegate { };
            Directory.CreateDirectory(source);
            try {
                int count = VerifyPayload(source, progress == null ? (Action<int,string>)null : (n,message) => progress(5 + n / 3, message));
                FileRecord[] records = Json.Deserialize<FileRecord[]>(File.ReadAllText(Child(source, "runtime-manifest.json")));
                foreach (string cepRoot in roots) {
                    string target = Child(cepRoot, Folder);
                    if (File.Exists(target)) throw new IOException("Há um arquivo no destino: " + target);
                    if (Directory.Exists(target)) ValidateBundle(target);
                    string parent = Directory.GetParent(Path.GetFullPath(cepRoot)).FullName;
                    string stageRoot = Child(parent, "installer-staging");
                    var plan = new PendingInstall { Target = target, StageRoot = stageRoot, Stage = Child(stageRoot, "lightref-" + Guid.NewGuid().ToString("N")) };
                    plans.Add(plan);
                    Directory.CreateDirectory(plan.Stage);
                    log("Preparando: " + target);
                    CopyVerifiedPayload(source, plan.Stage, records);
                    if (progress != null) progress(35 + plans.Count * 40 / roots.Count, "Preparando instalações CEP...");
                }
                if (progress != null) progress(78, "Ativando PlayerDebugMode...");
                undoRegistry = context.ConfigureRegistry();
                log("PlayerDebugMode ativado (HKCU/HKLM, CSXS 6-15).");
                for (int i = 0; i < plans.Count; i++) {
                    if (context.BeforeCommit != null) context.BeforeCommit(i);
                    var plan = plans[i];
                    Directory.CreateDirectory(Path.GetDirectoryName(plan.Target));
                    if (Directory.Exists(plan.Target)) {
                        string backupRoot = Child(Directory.GetParent(Path.GetDirectoryName(plan.Target)).FullName, "extension-backups");
                        Directory.CreateDirectory(backupRoot);
                        plan.Backup = Child(backupRoot, Folder + "-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0,8));
                        Directory.Move(plan.Target, plan.Backup);
                        log("Backup: " + plan.Backup);
                    }
                    Directory.Move(plan.Stage, plan.Target);
                    plan.Committed = true;
                    log("Instalado: " + plan.Target);
                    if (progress != null) progress(80 + (i + 1) * 19 / plans.Count, "Atualizando instalações CEP...");
                }
                var result = new Dictionary<string,object> {
                    { "product", "LightRef" }, { "version", Version }, { "bundleId", Bundle },
                    { "targets", plans.Select(p => p.Target).ToArray() }, { "backups", plans.Where(p => p.Backup != null).Select(p => p.Backup).ToArray() },
                    { "verifiedFiles", count }, { "installedAtUtc", DateTime.UtcNow.ToString("o") }, { "photoshopRestartRequired", true }
                };
                try { Directory.CreateDirectory(context.DataRoot);File.WriteAllText(Child(context.DataRoot,"installer-receipt.json"),Json.Serialize(result),new UTF8Encoding(false)); }
                catch (Exception e) { result.Add("receiptWarning",e.Message); }
                if (progress != null) progress(100,"Concluído! Reinicie o Photoshop.");
                return result;
            } catch (Exception original) {
                var errors = new List<Exception>();
                for (int i = plans.Count - 1; i >= 0; i--) {
                    var plan = plans[i];
                    try {
                        if (plan.Committed && Directory.Exists(plan.Target)) Directory.Move(plan.Target,Child(plan.StageRoot,"lightref-failed-"+Guid.NewGuid().ToString("N")));
                        if (plan.Backup != null && Directory.Exists(plan.Backup) && !Directory.Exists(plan.Target)) Directory.Move(plan.Backup,plan.Target);
                    } catch (Exception error) { errors.Add(error);log("Falha ao restaurar " + plan.Target + ": " + error.Message); }
                }
                if (undoRegistry != null) try { undoRegistry(); } catch (Exception error) { errors.Add(error); }
                if (errors.Any()) throw new AggregateException("A atualização falhou; confira os backups indicados no log.",new [] { original }.Concat(errors));
                throw;
            } finally {
                foreach (var plan in plans) try { RemoveStage(plan.StageRoot,plan.Stage); } catch { }
                try { RemoveStage(temp,source); } catch { }
            }
        }
        public static List<string> DetectPhotoshop()
        {
            var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (string program in new [] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) }) {
                string adobe = Path.Combine(program, "Adobe");
                if (Directory.Exists(adobe)) foreach (var folder in Directory.GetDirectories(adobe, "Adobe Photoshop*")) paths.Add(folder);
            }
            foreach (RegistryView view in new [] { RegistryView.Registry64, RegistryView.Registry32 }) {
                try {
                    using (var registry = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view))
                    using (var adobe = registry.OpenSubKey(@"SOFTWARE\Adobe\Photoshop")) {
                        if (adobe == null) continue;
                        foreach (string version in adobe.GetSubKeyNames()) using (var key = adobe.OpenSubKey(version)) {
                            var value = key.GetValue("ApplicationPath") ?? key.GetValue("Path") ?? key.GetValue("InstallPath");
                            if (value is string) paths.Add(((string)value).TrimEnd('\\'));
                        }
                    }
                } catch { }
            }
            foreach (var process in Process.GetProcessesByName("Photoshop")) {
                try { paths.Add(Path.GetDirectoryName(process.MainModule.FileName)); } catch { } finally { process.Dispose(); }
            }
            var result = new List<string>();
            foreach (string folder in paths) {
                string exe = Path.Combine(folder, "Photoshop.exe");
                try { if (File.Exists(exe) && FileVersionInfo.GetVersionInfo(exe).FileMajorPart >= 19) result.Add(folder); } catch { }
            }
            return result;
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            try {
                if (args.Length > 0 && args[0] == "/verify") {
                    var report = new { ok = true, verifiedFiles = Core.VerifyPayload(null, null), version = Core.Version, compatiblePhotoshop = Core.DetectPhotoshop(), installationTargets=Core.CepRoots(Core.DetectPhotoshop()).Select(p=>Core.Child(p,Core.Folder)).ToArray() };
                    if (args.Length > 1) File.WriteAllText(args[1], Core.Json.Serialize(report), new UTF8Encoding(false));
                    return 0;
                }
                if (args.Length > 1 && args[0] == "/self-test") return SelfTest(args[1]);
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                if (args.Length > 1 && args[0] == "/render-ui") {
                    using (var form = new InstallerForm()) {
                        // Create visible child handles off-screen for DrawToBitmap,
                        // without displaying a taskbar item or taking user focus.
                        form.ShowInTaskbar = false; form.StartPosition = FormStartPosition.Manual;
                        form.Location = new Point(-30000, -30000); form.Opacity = 0;
                        form.Show(); if (args.Length > 2) form.Preview(args[2]); Application.DoEvents(); form.PerformLayout();
                        using (var image = new Bitmap(form.Width, form.Height)) { form.DrawToBitmap(image, new Rectangle(0, 0, form.Width, form.Height)); image.Save(args[1], System.Drawing.Imaging.ImageFormat.Png); }
                        form.Hide();
                    }
                    return 0;
                }
                if (!IsAdministrator()) {
                    try { Process.Start(new ProcessStartInfo { UseShellExecute=true, FileName=Application.ExecutablePath, Verb="runas" }); }
                    catch (Exception e) { MessageBox.Show("A instalação nas pastas do Photoshop precisa da permissão de administrador.\n\n"+e.Message,"LightRef",MessageBoxButtons.OK,MessageBoxIcon.Information);return 1; }
                    return 0;
                }
                Application.Run(new InstallerForm()); return 0;
            } catch (Exception e) {
                if (args.Length > 0) {
                    if (args.Length > 1) File.WriteAllText(args[1] + ".error.txt", e.ToString());
                } else MessageBox.Show(e.Message, "LightRef", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
        static bool IsAdministrator()
        {
            try { return new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator); }
            catch { return false; }
        }
        static int SelfTest(string outputFile)
        {
            // Keep disposable install/rollback fixtures outside synchronized folders.
            string parent = Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar);
            string name = "installer-self-test-" + Guid.NewGuid().ToString("N");
            string root = Core.Child(parent, name);
            Directory.CreateDirectory(root);
            var checks = new List<string>();
            Action<string, bool> check = (description, passed) => { if (!passed) throw new Exception("Self-test: " + description); checks.Add(description); };
            try {
                int registryChanges = 0;
                var ctx = new InstallContext { CepRoot = Path.Combine(root, "Adobe", "CEP", "extensions"), BackupRoot = Path.Combine(root, "backups"), DataRoot = Path.Combine(root, "data"),
                    ConfigureRegistry = () => { registryChanges++; return delegate { registryChanges--; }; } };
                string original = Core.Child(ctx.CepRoot, "com.xuimart.lightref.arttest/sentinel.txt");
                Directory.CreateDirectory(Path.GetDirectoryName(original)); File.WriteAllText(original, "original-preserved");
                Directory.CreateDirectory(ctx.DataRoot); string config = Path.Combine(ctx.DataRoot, "config.json"); File.WriteAllText(config, "user-data");
                string scenes=Path.Combine(ctx.DataRoot,"scenes.json"),models=Path.Combine(ctx.DataRoot,"models");
                Directory.CreateDirectory(models);File.WriteAllText(scenes,"legacy-scenes");File.WriteAllText(Path.Combine(models,"my-model.obj"),"legacy-model");
                var first = Core.Install(ctx, null); string target = (string)first["target"];
                check("fresh_install_verified", (int)first["verifiedFiles"] > 0 && File.Exists(Path.Combine(target, "js", "art-engine.js")));
                check("registry_configuration_called", registryChanges == 1);
                check("original_plugin_preserved", File.ReadAllText(original) == "original-preserved");
                check("user_preferences_preserved", File.ReadAllText(config) == "user-data");
                string legacyManifest=Path.Combine(target,"CSXS","manifest.xml");File.WriteAllText(legacyManifest,File.ReadAllText(legacyManifest).Replace(Core.Version,"0.9.1"));
                File.WriteAllText(Path.Combine(target, "obsolete-marker.txt"), "previous-test");
                var second = Core.Install(ctx, null); string backup = (string)second["backup"];
                check("upgrade_backed_up_previous", File.ReadAllText(Path.Combine(backup, "obsolete-marker.txt")) == "previous-test");
                check("backup_outside_active_extensions", !backup.StartsWith(ctx.CepRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
                check("upgrade_replaces_obsolete_files", !File.Exists(Path.Combine(target, "obsolete-marker.txt")));
                File.WriteAllText(Path.Combine(target, "rollback-marker.txt"), "restore-me");
                ctx.ConfigureRegistry = () => { throw new IOException("Simulated registry failure"); };
                bool failed = false; try { Core.Install(ctx, null); } catch (IOException) { failed = true; }
                check("failed_upgrade_restores_previous", failed && File.ReadAllText(Path.Combine(target, "rollback-marker.txt")) == "restore-me");
                string manifest = Path.Combine(target, "CSXS", "manifest.xml");
                File.WriteAllText(manifest, File.ReadAllText(manifest).Replace(Core.Bundle, "com.other.plugin"));
                failed = false; try { Core.Install(ctx, null); } catch (InvalidDataException) { failed = true; }
                check("foreign_bundle_refused", failed && File.ReadAllText(manifest).Contains("com.other.plugin"));
                foreach (string path in new [] { "../outside", "C:/outside", "/outside", "dir/../../outside", "dir./file" }) {
                    failed = false; try { Core.Child(root, path); } catch (InvalidDataException) { failed = true; }
                    check("reject_path_" + path, failed);
                }
                check("legacy_scenes_and_imported_models_preserved",File.ReadAllText(scenes)=="legacy-scenes"&&File.ReadAllText(Path.Combine(models,"my-model.obj"))=="legacy-model");
                check("original_and_data_still_preserved", File.ReadAllText(original) == "original-preserved" && File.ReadAllText(config) == "user-data");
                var ps = new [] { Core.Child(root,"Photoshop 2025"),Core.Child(root,"Photoshop 2026"),Core.Child(root,"Photoshop Beta") };
                var roots = Core.BuildCepRoots(Core.Child(root,"AppData"),Core.Child(root,"Common x86"),Core.Child(root,"Common x64"),ps);
                check("original_installer_target_layout",roots.Count==6&&ps.All(p=>roots.Contains(Path.Combine(p,"Required","CEP","extensions"))));
                check("duplicate_roots_removed",Core.BuildCepRoots(Core.Child(root,"AppData"),Core.Child(root,"Common x86"),Core.Child(root,"Common x86"),ps).Count==5);
                string goodManifest=File.ReadAllText(Path.Combine((string)first["target"],"CSXS","manifest.xml")).Replace("com.other.plugin",Core.Bundle).Replace(Core.Version,"0.9.1");
                foreach(string cepRoot in roots) {
                    string destination=Core.Child(cepRoot,Core.Folder);
                    Directory.CreateDirectory(Path.Combine(destination,"CSXS"));File.WriteAllText(Path.Combine(destination,"CSXS","manifest.xml"),goodManifest);
                    File.WriteAllText(Path.Combine(destination,"legacy-marker.txt"),"legacy");
                }
                int multiRegistry=0;
                var multi = new InstallContext { CepRoots=roots,DataRoot=ctx.DataRoot,ConfigureRegistry=()=>{multiRegistry++;return delegate{multiRegistry--;};} };
                var all=Core.Install(multi,null);var installed=(string[])all["targets"];var backups=(string[])all["backups"];
                check("all_six_legacy_locations_updated",installed.Length==6&&installed.All(p=>File.Exists(Path.Combine(p,"js","art-engine.js"))&&!File.Exists(Path.Combine(p,"legacy-marker.txt"))));
                check("all_six_previous_copies_backed_up",backups.Length==6&&backups.All(p=>File.ReadAllText(Path.Combine(p,"legacy-marker.txt"))=="legacy"));
                check("registry_configured_once_per_transaction",multiRegistry==1);
                foreach(string destination in installed)File.WriteAllText(Path.Combine(destination,"multi-rollback.txt"),"restore-all");
                multi.BeforeCommit=i=>{if(i==1)throw new IOException("Simulated second-location failure");};
                failed=false;try{Core.Install(multi,null);}catch(IOException){failed=true;}
                check("partial_failure_restores_all_locations",failed&&installed.All(p=>File.ReadAllText(Path.Combine(p,"multi-rollback.txt"))=="restore-all"));
                check("multi_failure_restores_registry",multiRegistry==1);
                check("multi_update_preserves_scenes_models_and_preferences",File.ReadAllText(config)=="user-data"&&File.ReadAllText(scenes)=="legacy-scenes"&&File.ReadAllText(Path.Combine(models,"my-model.obj"))=="legacy-model");
                File.WriteAllText(outputFile, Core.Json.Serialize(new { ok = true, checks = checks, total = checks.Count, usesRealRegistry = false }), new UTF8Encoding(false));
                return 0;
            } finally {
                if (root == Core.Child(parent, name) && name.StartsWith("installer-self-test-")) Directory.Delete(root, true);
            }
        }
    }
}
