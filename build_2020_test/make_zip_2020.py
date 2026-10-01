
import zipfile, os, io
ROOT = r"e:\3D Light Ref\com.lightref.cep"
OUT  = r"e:\3D Light Ref\build_2020_test\lightref_2020.zip"
MAN  = io.open(r"e:\3D Light Ref\build_2020_test\manifest_2020.xml", "r", encoding="utf-8").read()
if os.path.exists(OUT): os.remove(OUT)
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
        if rel == "CSXS/manifest.xml":
            z.writestr("cep/" + rel, MAN.encode("utf-8"))
        else:
            z.write(full, "cep/" + rel)
        count += 1
z.close()
z = zipfile.ZipFile(OUT)
html = z.read("cep/index.html").decode("utf-8", "ignore")
i_compat = html.find("vendor-compat.js"); i_bab = html.find("vendor/babylon.js")
checks = [
    "entradas=%d tamanho=%.2fMB" % (count, os.path.getsize(OUT) / 1048576.0),
    "manifest CSXS 6.0: %s" % ('Version="6.0"' in z.read("cep/CSXS/manifest.xml").decode("utf-8")),
    "vendor-compat.js no pacote: %s" % ("cep/js/vendor-compat.js" in z.namelist()),
    "compat antes do babylon: %s" % (0 <= i_compat < i_bab),
    "erro real no panel.js: %s" % ("em.slice(0, 160)" in z.read("cep/js/panel.js").decode("utf-8", "ignore")),
    "diag por versao: %s" % ("diag-chrome" in z.read("cep/js/diag.js").decode("utf-8", "ignore")),
    "node_modules fora: %s" % (not any("node_modules" in n for n in z.namelist())),
]
z.close()
io.open(r"e:\3D Light Ref\build_2020_test\_zip.txt", "w", encoding="utf-8").write("\n".join(checks))
