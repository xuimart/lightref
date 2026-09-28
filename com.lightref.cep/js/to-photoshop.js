/*
 * to-photoshop.js — ponte painel -> Photoshop (LightRef).
 *
 * Fluxo do "jogar como layer":
 *   1. scene.snapshotDataURL() gera um PNG em base64 do canvas WebGL
 *   2. gravamos esse PNG em %APPDATA%\LightRef\temp\render_<ts>.png via Node fs
 *   3. csInterface.evalScript() chama lightrefPlaceRender(path) no ExtendScript
 *   4. o ExtendScript coloca o PNG como nova layer no documento ativo
 *
 * Por que passar por disco em vez de mandar o base64 direto ao ExtendScript?
 * base64 grande estoura o limite de tamanho do evalScript e e lento. Gravar o
 * arquivo e passar so o caminho e o padrao robusto no CEP.
 *
 * ES5 puro. Depende de CSInterface (global) e dos modulos node fs/path/os.
 */
(function (global) {
    'use strict';

    var fs = require('fs');
    var path = require('path');
    var os = require('os');

    // %APPDATA% no Windows; fallback para home em outros SOs.
    function appDataDir() {
        var base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(base, 'LightRef');
    }

    function tempDir() {
        var dir = path.join(appDataDir(), 'temp');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    /* Converte um dataURL "data:image/png;base64,...." em Buffer binario. */
    function dataURLtoBuffer(dataURL) {
        var comma = dataURL.indexOf(',');
        var b64 = dataURL.substring(comma + 1);
        return Buffer.from(b64, 'base64');
    }

    /*
     * Grava o render em disco e pede ao Photoshop para coloca-lo como layer.
     * dataURL: PNG com os efeitos aplicados (modo raster) — usado sempre para o pixel.
     * opts: { mode: 'raster'|'adjustment', fx: {...}, rawDataURL: string }
     *   - raster: coloca uma unica camada rasterizada com tudo queimado
     *   - adjustment: coloca o PNG cru (rawDataURL) e cria adjustment layers a partir de fx
     * callback(err, message): err null em sucesso.
     *
     * Assinatura retrocompativel: placeAsLayer(dataURL, callback) ainda funciona.
     */
    function placeAsLayer(dataURL, opts, callback) {
        if (typeof opts === 'function') { callback = opts; opts = { mode: 'raster' }; }
        opts = opts || { mode: 'raster' };
        var csInterface = new CSInterface();

        // No modo adjustment usamos a imagem crua (sem efeitos) como pixel base.
        var imageDataURL = (opts.mode === 'adjustment' && opts.rawDataURL) ? opts.rawDataURL : dataURL;

        var buffer, filePath;
        try {
            buffer = dataURLtoBuffer(imageDataURL);
            var ts = Date.now();
            filePath = path.join(tempDir(), 'render_' + ts + '.png');
            fs.writeFileSync(filePath, buffer);
        } catch (e) {
            return callback(e);
        }

        var jsxPath = filePath.replace(/\\/g, '/').replace(/'/g, "\\'");
        var script;
        if (opts.mode === 'adjustment') {
            // Serializa os fx como JSON para o ExtendScript recriar as camadas de ajuste.
            var fxJson = JSON.stringify(opts.fx || {}).replace(/'/g, "\\'");
            script = "lightrefPlaceRenderWithAdjustments('" + jsxPath + "', '" + fxJson + "')";
        } else {
            script = "lightrefPlaceRender('" + jsxPath + "')";
        }

        csInterface.evalScript(script, function (result) {
            try { fs.unlinkSync(filePath); } catch (e) { /* ignora */ }
            if (result && result.indexOf('OK') === 0) callback(null, result);
            else callback(new Error(result || 'Falha desconhecida no ExtendScript'));
        });
    }

    global.LightRefToPhotoshop = {
        placeAsLayer: placeAsLayer,
        appDataDir: appDataDir
    };
})(window);
