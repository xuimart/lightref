// init.jsx — ExtendScript do LightRef (host Photoshop).
// Roda no interpretador ExtendScript do Photoshop (nao no CEF do painel).
// Funcao principal: pegar um PNG salvo em disco pelo painel e coloca-lo como
// uma nova layer no documento ativo.

// Coloca o PNG em pngPath como uma nova camada no documento ativo.
// Retorna "OK" em sucesso ou "ERRO: <motivo>" (string, para o evalScript ler).
function lightrefPlaceRender(pngPath) {
    try {
        if (app.documents.length === 0) {
            return "ERRO: Nenhum documento aberto no Photoshop.";
        }
        var fileRef = new File(pngPath);
        if (!fileRef.exists) {
            return "ERRO: Arquivo de render nao encontrado: " + pngPath;
        }

        var doc = app.activeDocument;

        // Estrategia: abrir o PNG como documento, duplicar a layer para o doc ativo,
        // fechar o PNG. Isso preserva a resolucao do render e cria uma camada limpa.
        var renderDoc = app.open(fileRef);
        var renderLayer = renderDoc.activeLayer;
        renderLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
        renderDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Renomeia a camada recem-colada (fica ativa no doc destino).
        app.activeDocument = doc;
        doc.activeLayer.name = "LightRef " + _lightrefTimestamp();

        return "OK";
    } catch (e) {
        return "ERRO: " + e.toString();
    }
}

function _lightrefTimestamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

// Modo nao-destrutivo: coloca o render cru como camada e cria camadas de ajuste
// do Photoshop por cima, agrupadas, a partir dos parametros de pos-producao (fxJson).
// Assim o usuario pode reeditar os ajustes dentro do Photoshop.
function lightrefPlaceRenderWithAdjustments(pngPath, fxJson) {
    try {
        if (app.documents.length === 0) {
            return "ERRO: Nenhum documento aberto no Photoshop.";
        }
        var fileRef = new File(pngPath);
        if (!fileRef.exists) {
            return "ERRO: Arquivo de render nao encontrado: " + pngPath;
        }

        var fx = {};
        try { fx = _lightrefParseJSON(fxJson); } catch (e) { fx = {}; }

        var doc = app.activeDocument;

        // 1. Coloca o render cru como camada base.
        var renderDoc = app.open(fileRef);
        renderDoc.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
        renderDoc.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = doc;
        var baseLayer = doc.activeLayer;
        baseLayer.name = "LightRef " + _lightrefTimestamp();

        // 2. Cria as camadas de ajuste conforme os efeitos ativos.
        //    Usamos Action Manager para os tipos que o DOM nao expoe diretamente.
        if (fx.exposure && Math.abs(fx.exposure) > 0.001) _lrAddExposure(fx.exposure);
        if (fx.contrast && Math.abs(fx.contrast) > 0.001) _lrAddBrightnessContrast(Math.round(fx.contrast * 50));
        if (fx.saturation !== undefined && Math.abs(fx.saturation - 1) > 0.001) {
            _lrAddHueSaturation(Math.round((fx.saturation - 1) * 100));
        }
        if (fx.blackWhite === 1) _lrAddBlackAndWhite();
        if (fx.posterizeOn === 1) _lrAddPosterize(fx.posterizeLevels || 6);

        return "OK";
    } catch (e) {
        return "ERRO: " + e.toString();
    }
}

// Parser JSON minimo (ExtendScript antigo pode nao ter JSON nativo).
function _lightrefParseJSON(s) {
    if (typeof JSON !== "undefined" && JSON.parse) return JSON.parse(s);
    return eval("(" + s + ")"); // fonte propria (gerado pelo painel), nao entrada externa
}

// ----- Camadas de ajuste via Action Manager -----
function _lrAddExposure(ev) {
    var d = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(stringIDToTypeID("adjustmentLayer"));
    d.putReference(charIDToTypeID("null"), ref);
    var type = new ActionDescriptor();
    var adj = new ActionDescriptor();
    adj.putDouble(stringIDToTypeID("exposure"), ev);
    adj.putDouble(stringIDToTypeID("offset"), 0);
    adj.putDouble(stringIDToTypeID("gammaCorrection"), 1);
    type.putObject(charIDToTypeID("Type"), stringIDToTypeID("exposure"), adj);
    d.putObject(charIDToTypeID("Usng"), stringIDToTypeID("adjustmentLayer"), type);
    executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);
}
function _lrAddBrightnessContrast(contrast) {
    var d = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(stringIDToTypeID("adjustmentLayer"));
    d.putReference(charIDToTypeID("null"), ref);
    var type = new ActionDescriptor();
    var adj = new ActionDescriptor();
    adj.putInteger(stringIDToTypeID("brightness"), 0);
    adj.putInteger(stringIDToTypeID("center"), contrast);
    type.putObject(charIDToTypeID("Type"), stringIDToTypeID("brightnessEvent"), adj);
    d.putObject(charIDToTypeID("Usng"), stringIDToTypeID("adjustmentLayer"), type);
    executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);
}
function _lrAddHueSaturation(saturation) {
    var d = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(stringIDToTypeID("adjustmentLayer"));
    d.putReference(charIDToTypeID("null"), ref);
    var type = new ActionDescriptor();
    var adj = new ActionDescriptor();
    adj.putBoolean(stringIDToTypeID("colorize"), false);
    var adjList = new ActionList();
    var chan = new ActionDescriptor();
    chan.putInteger(stringIDToTypeID("hue"), 0);
    chan.putInteger(stringIDToTypeID("saturation"), saturation);
    chan.putInteger(stringIDToTypeID("lightness"), 0);
    adjList.putObject(stringIDToTypeID("hueSatAdjustmentV2"), chan);
    adj.putList(stringIDToTypeID("adjustment"), adjList);
    type.putObject(charIDToTypeID("Type"), stringIDToTypeID("hueSaturation"), adj);
    d.putObject(charIDToTypeID("Usng"), stringIDToTypeID("adjustmentLayer"), type);
    executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);
}
function _lrAddBlackAndWhite() {
    var d = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(stringIDToTypeID("adjustmentLayer"));
    d.putReference(charIDToTypeID("null"), ref);
    var type = new ActionDescriptor();
    var adj = new ActionDescriptor();
    type.putObject(charIDToTypeID("Type"), stringIDToTypeID("blackAndWhite"), adj);
    d.putObject(charIDToTypeID("Usng"), stringIDToTypeID("adjustmentLayer"), type);
    executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);
}
function _lrAddPosterize(levels) {
    var d = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(stringIDToTypeID("adjustmentLayer"));
    d.putReference(charIDToTypeID("null"), ref);
    var type = new ActionDescriptor();
    var adj = new ActionDescriptor();
    adj.putInteger(stringIDToTypeID("levels"), levels);
    type.putObject(charIDToTypeID("Type"), stringIDToTypeID("posterization"), adj);
    d.putObject(charIDToTypeID("Usng"), stringIDToTypeID("adjustmentLayer"), type);
    executeAction(charIDToTypeID("Mk  "), d, DialogModes.NO);
}
