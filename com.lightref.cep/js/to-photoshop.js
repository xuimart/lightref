/*
 * to-photoshop.js - ponte painel -> Photoshop (LightRef).
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
     * dataURL: PNG com os efeitos aplicados (modo raster) - usado sempre para o pixel.
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

    /*
     * Abre o Seletor de Cores nativo do Photoshop (lightrefPickColor no init.jsx).
     * hex: cor inicial ('#rrggbb' ou 'rrggbb').
     * callback(err, color): color e '#rrggbb', ou null se o usuario cancelar.
     */
    function pickColor(hex, callback) {
        var cs;
        try { cs = new CSInterface(); } catch (e) { return callback(e); }
        var h = String(hex || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
        cs.evalScript("lightrefPickColor('" + h + "')", function (result) {
            var r = (result === undefined || result === null) ? '' : String(result);
            if (r.indexOf('ERRO') === 0 || r === 'EvalScript error.') return callback(new Error(r));
            if (r === '') return callback(null, null);
            if (!/^[0-9a-fA-F]{6}$/.test(r)) return callback(new Error('Resposta invalida: ' + r));
            callback(null, '#' + r.toLowerCase());
        });
    }

    /*
     * Pede ao Photoshop para manter o painel carregado quando ele e minimizado,
     * recolhido ou fechado (com.adobe.PhotoshopPersistent, Photoshop 14.2+).
     * Assim os ajustes so voltam ao padrao quando o Photoshop e fechado.
     * Retorna true se o pedido foi enviado.
     */
    function keepPanelLoaded() {
        try {
            if (typeof CSInterface === 'undefined' || typeof CSEvent === 'undefined') return false;
            var cs = new CSInterface();
            var id = cs.getExtensionID();
            if (!id) return false;
            var ev = new CSEvent('com.adobe.PhotoshopPersistent', 'APPLICATION');
            ev.extensionId = id;
            cs.dispatchEvent(ev);
            return true;
        } catch (e) {
            return false;
        }
    }

    global.LightRefToPhotoshop = {
        placeAsLayer: placeAsLayer,
        pickColor: pickColor,
        keepPanelLoaded: keepPanelLoaded,
        appDataDir: appDataDir
    };
})(window);
