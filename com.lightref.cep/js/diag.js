/*
 * diag.js - diagnostico do painel. Grava %APPDATA%\LightRef\diag.json com o que
 * o CEF realmente carregou (arquivos, regras CSS, layout, erros). ASCII-only.
 */
(function () {
    var errors = [];
    window.addEventListener('error', function (e) {
        errors.push(String(e.message) + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
    });
    window.addEventListener('unhandledrejection', function (e) {
        var r = e && e.reason;
        errors.push('promise: ' + String((r && (r.message || r)) || 'rejeitada'));
    });
    // Estado do motor 3D (ajuda a diagnosticar o CEF antigo do Photoshop 2019/2020).
    function engineInfo() {
        var info = {};
        try {
            var B = window.BABYLON;
            info.babylon = B ? (B.Engine && B.Engine.Version) : 'AUSENTE';
            if (B && B.SceneLoader && B.SceneLoader.IsPluginForExtensionAvailable) {
                info.pluginObj = B.SceneLoader.IsPluginForExtensionAvailable('.obj');
                info.pluginStl = B.SceneLoader.IsPluginForExtensionAvailable('.stl');
            }
            var eng = B && B.EngineStore && B.EngineStore.LastCreatedEngine;
            if (eng) {
                info.webgl = eng.webGLVersion;
                try { var gi = eng.getGlInfo(); info.renderer = gi.renderer; info.glVersion = gi.version; } catch (e1) {}
            }
        } catch (e) { info.erro = String(e.message || e); }
        return info;
    }
    function rectOf(sel) {
        var el = document.querySelector(sel);
        if (!el) return sel + ' MISSING';
        var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return sel + ' top=' + Math.round(r.top) + ' h=' + Math.round(r.height) + ' w=' + Math.round(r.width) +
            ' disp=' + cs.display + ' pos=' + cs.position + ' flex=' + cs.flex + ' cssH=' + cs.height +
            ' minH=' + cs.minHeight + ' z=' + cs.zIndex + ' hidden=' + el.hidden;
    }
    function write() {
        try {
            var fs = require('fs'), path = require('path');
            var dir = path.join(process.env.APPDATA, 'LightRef');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            var sheets = [];
            for (var i = 0; i < document.styleSheets.length; i++) {
                var sh = document.styleSheets[i], n = -1, last = [];
                try { n = sh.cssRules.length; for (var k = Math.max(0, n - 4); k < n; k++) last.push(sh.cssRules[k].cssText.slice(0, 120)); }
                catch (e2) { last.push('ERR ' + e2.message); }
                sheets.push({ href: sh.href, rules: n, last: last });
            }
            var probe = document.createElement('div');
            probe.style.cssText = 'position:absolute;top:0;left:-9px;width:1px;height:100vh';
            document.body.appendChild(probe);
            var vh = probe.getBoundingClientRect().height; probe.parentNode.removeChild(probe);
            var report = {
                time: new Date().toISOString(), ua: navigator.userAgent, url: location.href,
                inner: window.innerWidth + 'x' + window.innerHeight, dpr: window.devicePixelRatio, vh100: vh,
                sheets: sheets,
                layout: ['#lr04', '.lr04-window', '.lr04-studio', '.lr04-viewport', '.lr04-middle', '.lr04-inspector',
                         '.lr04-footer', '.lr04-catalog', '#gl-canvas', '.lr04-toptools'].map(rectOf),
                errors: errors,
                engine: engineInfo(),
                polyfilled: window.__lrPolyfilled || [],
                loadErrors: window.__lrLoadErrors || []
            };
            var json = JSON.stringify(report, null, 2);
            fs.writeFileSync(path.join(dir, 'diag.json'), json);
            // Um arquivo por versao do Chrome: o Photoshop novo nao sobrescreve o do antigo.
            var m = /Chrome\/(\d+)/.exec(navigator.userAgent);
            fs.writeFileSync(path.join(dir, 'diag-chrome' + (m ? m[1] : 'x') + '.json'), json);
        } catch (e) { /* sem Node (navegador comum): ignora */ }
    }
    window.__lrDiagWrite = write;
    window.addEventListener('load', function () { setTimeout(write, 2500); });
    var t = 0;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(write, 800); });
})();
