
# make_zip.py - empacota com.lightref.cep em lightref.zip (entradas "cep/...")
# para o instalador v0.7.0 e grava as checagens em _zip.txt.
import zipfile, os, io, time
ROOT = r"E:\3D Light Ref\com.lightref.cep"
OUT  = r"E:\3D Light Ref\build_0.7.0\lightref.zip"
REPORT = r"E:\3D Light Ref\build_0.7.0\_zip.txt"
for attempt in range(10):  # zip pode estar travado por outro processo: espera e tenta de novo
    try:
        if os.path.exists(OUT): os.remove(OUT)
        break
    except OSError:
        time.sleep(3)
EXCL_DIRS = ("node_modules", "tests", ".kiro", ".git")
def skip(rel):
    parts = rel.replace("\\", "/").split("/")
    if any(d in parts for d in EXCL_DIRS): return True
    n = parts[-1]
    return n.endswith(".bak") or n.endswith(".test.js") or n in ("_thumbgen.html", "package-lock.json", "_runner.js", "_result.txt")
z = zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED)
count = 0
for base, dirs, files in os.walk(ROOT):
    for f in files:
        full = os.path.join(base, f)
        rel = os.path.relpath(full, ROOT).replace("\\", "/")
        if skip(rel): continue
        z.write(full, "cep/" + rel)
        count += 1
z.close()
z = zipfile.ZipFile(OUT)
names = z.namelist()
def text(rel): return z.read("cep/" + rel).decode("utf-8", "ignore")
man = text("CSXS/manifest.xml")
html = text("index.html")
pj = text("js/panel.js")
ij = text("init.jsx")
i_compat = html.find("vendor-compat.js"); i_bab = html.find("vendor/babylon.js")
i_onb = html.find("js/onboarding.js"); i_ses = html.find("js/session.js"); i_pan = html.find("js/panel.js")
BAD = ("node_modules", "/tests/", ".kiro", ".git/", ".test.js", ".bak", "_thumbgen.html", "package-lock.json", "_runner.js", "_result.txt", "_runner", "_result")
checks = [
    "entradas=%d tamanho=%.2fMB" % (count, os.path.getsize(OUT) / 1048576.0),
    "manifest RequiredRuntime CSXS 6.0: %s" % ('<RequiredRuntime Name="CSXS" Version="6.0" />' in man),
    "manifest ExtensionBundleVersion 0.7.0: %s" % ('ExtensionBundleVersion="0.7.0"' in man),
    "update.js '0.7.0': %s" % ("'0.7.0'" in text("js/update.js")),
    "cep/js/session.js presente: %s" % ("cep/js/session.js" in names),
    "cep/js/onboarding.js presente: %s" % ("cep/js/onboarding.js" in names),
    "cep/js/vendor-compat.js presente: %s" % ("cep/js/vendor-compat.js" in names),
    "compat antes do babylon no index.html: %s" % (0 <= i_compat < i_bab),
    "onboarding antes do panel no index.html: %s" % (0 <= i_onb < i_pan),
    "session antes do panel no index.html: %s" % (0 <= i_ses < i_pan),
    "init.jsx lightrefSessionToken: %s" % ("lightrefSessionToken" in ij),
    "panel.js restoreIfSameSession: %s" % ("restoreIfSameSession" in pj),
    "panel.js keepPanelLoaded(): %s" % ("keepPanelLoaded()" in pj),
    "panel.js maybeShow: %s" % ("maybeShow" in pj),
    "sem entradas proibidas: %s" % (not any(b in n for n in names for b in BAD)),
]
z.close()
io.open(REPORT, "w", encoding="utf-8", newline="").write("\n".join(checks) + "\n")
