# patch_panel.py - applies all i18n changes to panel.js (CRLF, ASCII-only)
# Run from any directory: python patch_panel.py
import io
import sys
import os

PANEL = r'e:\3D Light Ref\com.lightref.cep\js\panel.js'

with io.open(PANEL, mode='r', encoding='utf-8', newline='') as f:
    src = f.read()

# Detect line ending
assert '\r\n' in src, 'Expected CRLF in panel.js'
NL = '\r\n'

errors = []

def replace_once(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        errors.append('%s: expected 1 match, got %d' % (label, count))
        return
    src = src.replace(old, new, 1)

def replace_all(old, new, label, min_count=1):
    global src
    count = src.count(old)
    if count < min_count:
        errors.append('%s: expected >=%d matches, got %d' % (label, min_count, count))
        return
    src = src.replace(old, new)

# ---------------------------------------------------------------------------
# 1. Replace LIGHT_NAMES array + nextLightName to use getLightNames()
# ---------------------------------------------------------------------------

replace_once(
    "    var LIGHT_NAMES = ['Principal', 'Preenchimento', 'Contorno', 'Recorte', 'Rebote'];",
    "    function getLightNames() {\r\n"
    "        var _i = window.LightRefI18n;\r\n"
    "        if (!_i) return ['Principal', 'Preenchimento', 'Contorno', 'Recorte', 'Rebote'];\r\n"
    "        return [_i.t('lightMain'), _i.t('lightFill'), _i.t('lightRim'), _i.t('lightCut'), _i.t('lightBounce')];\r\n"
    "    }",
    'LIGHT_NAMES -> getLightNames()'
)

replace_once(
    "        return LIGHT_NAMES[n] || ('Luz ' + (n + 1));",
    "        var _ln = getLightNames();\r\n"
    "        return _ln[n] || ('Luz ' + (n + 1));",
    'nextLightName uses getLightNames'
)

# ---------------------------------------------------------------------------
# 2. Add t() helper alias at top of renderLight / renderLens / renderAdjust /
#    renderPos / renderComposition — add a shared helper function before
#    renderLight and use it everywhere.
#    Simplest approach: add a module-level _t() helper just before renderTab().
# ---------------------------------------------------------------------------

replace_once(
    "    // Renderiza o conteudo da aba atual nos subcontainers ja presentes no HTML.\r\n    function renderTab() {",
    "    // Helper de traducao: retorna string do dicionario ativo ou o proprio key.\r\n"
    "    function _t(key, vars) {\r\n"
    "        if (window.LightRefI18n && window.LightRefI18n.t) return window.LightRefI18n.t(key, vars);\r\n"
    "        /* Fallback hardcoded PT for the most common keys (for safety). */\r\n"
    "        var fb = {\r\n"
    "            lightIntensity:'Intensidade', lightRotate:'Girar', lightHeight:'Altura',\r\n"
    "            lightAdd:'Adicionar luz', lightRemove:'Remover',\r\n"
    "            lensLabel:'Lente', lensFraming:'Enquadramento', lensEnvSection:'Ambiente / HDR',\r\n"
    "            lensEnvMap:'Mapa', lensEnvIntensity:'Intensidade', lensEnvBg:'Mostrar fundo do HDR',\r\n"
    "            lensResetCamera:'Resetar camera',\r\n"
    "            adjExposure:'Exposicao', adjContrast:'Contraste', adjTemperature:'Temperatura',\r\n"
    "            adjSaturation:'Saturacao', adjLevels:'Niveis', adjSteps:'Degraus',\r\n"
    "            adjReset:'Zerar ajustes',\r\n"
    "            posRotateY:'Girar Y', posTiltX:'Inclinar X', posHeight:'Altura',\r\n"
    "            posHorizontal:'Horizontal', posDepth:'Profundidade', posScale:'Escala',\r\n"
    "            posTiltZ:'Inclinar Z', posSave:'Salvar posicao do modelo',\r\n"
    "            posCenter:'Centralizar / resetar',\r\n"
    "            posHint:'Atalhos: G mover, S escala, R rotacao (RR livre). X/Y/Z travam eixo, clique confirma, Esc cancela.',\r\n"
    "            compGizmoSection:'Gizmo no visor', compSliderSection:'Ajuste por sliders',\r\n"
    "            compGizmoObj:'Gizmo (objeto selecionado)', compAddSection:'Adicionar forma / modelo',\r\n"
    "            compObjLabel:'Objeto', compCount:'Objetos na cena ({n})',\r\n"
    "            compDeform:'Distorcer forma', compWidthX:'Largura X',\r\n"
    "            compHeightY:'Altura Y', compDepthZ:'Profund. Z',\r\n"
    "            compResetShape:'Resetar forma', compAddBtn:'+ Adicionar a cena',\r\n"
    "            ogHeads:'Cabecas', ogBusts:'Bustos e Torsos', ogFigures:'Figuras',\r\n"
    "            ogShapes:'Formas basicas', ogModels:'Modelos',\r\n"
    "            scGrpLights:'Luzes',\r\n"
    "            scGrpDrag:'Arraste no visor (segure Shift)',\r\n"
    "            scGrpTransform:'Transformar objeto (aba Posicao)',\r\n"
    "            scAddLight:'Adicionar luz', scRemoveLight:'Remover a luz selecionada',\r\n"
    "            scUndoRemove:'Desfazer a remocao', scSelectByNum:'Selecionar a luz pelo numero',\r\n"
    "            scDragRotate:'Girar a luz ativa (direcao e altura)',\r\n"
    "            scDragIntensity:'Mudar so a intensidade',\r\n"
    "            scDragColor:'Mudar a cor (horizontal) e a temperatura (vertical)',\r\n"
    "            scMove:'Mover', scScale:'Escalar', scRotate:'Rotacionar',\r\n"
    "            scLockAxis:'Travar no eixo', scConfirm:'Confirmar', scCancel:'Cancelar',\r\n"
    "            fbLightAdded:'Luz adicionada: {nome}', fbLightRemoved:'Luz removida (Ctrl+Shift+Z desfaz)',\r\n"
    "            fbLightRestored:'Luz restaurada: {nome}', fbNoLight:'Nenhuma luz selecionada',\r\n"
    "            fbNoUndo:'Nada para desfazer', fbLoadFail:'Falha ao carregar',\r\n"
    "            fbImported:'Modelo importado', fbImportFail:'Falha ao importar',\r\n"
    "            fbChecking:'Verificando atualizacoes...', fbSaving:'Salvando...',\r\n"
    "            fbSaved:'Posicao e miniatura salvas', fbMaterial:'Material: {nome}',\r\n"
    "            fbSelectObj:'Selecione um objeto', fbAddingObj:'Adicionando objeto...',\r\n"
    "            fbObjAdded:'Objeto adicionado', fbAddFail:'Falha ao adicionar',\r\n"
    "            fbTransformApplied:'Transformacao aplicada', fbCancelled:'Cancelado',\r\n"
    "            fbAxis:'Eixo: {eixo}', fbXformStart:'{tipo}: mova o mouse, clique confirma, Esc cancela',\r\n"
    "            fbSelectInList:'Selecione um objeto na lista',\r\n"
    "            fbColorPicker:'Nao foi possivel abrir o seletor de cores do Photoshop',\r\n"
    "            fbDeleteFail:'Falha ao remover o arquivo do modelo',\r\n"
    "            fbCatCreateFail:'Falha ao criar categoria',\r\n"
    "            fbCatRenameFail:'Falha ao renomear categoria'\r\n"
    "        };\r\n"
    "        var s = (key in fb) ? fb[key] : key;\r\n"
    "        if (vars) { for (var _k in vars) { if (Object.prototype.hasOwnProperty.call(vars, _k)) { s = s.split('{'+_k+'}').join(String(vars[_k])); } } }\r\n"
    "        return s;\r\n"
    "    }\r\n\r\n"
    "    // Renderiza o conteudo da aba atual nos subcontainers ja presentes no HTML.\r\n"
    "    function renderTab() {",
    'add _t() helper before renderTab'
)

# ---------------------------------------------------------------------------
# 3. applyStaticStrings + extend applyLanguage
# ---------------------------------------------------------------------------

replace_once(
    "    // Aplica o idioma escolhido no wizard. A i18n completa do painel esta\r\n"
    "    // fora de escopo; aqui registramos a escolha (merge no config) sem\r\n"
    "    // quebrar nada. O onboarding.js tambem persiste ao concluir/fechar.\r\n"
    "    function applyLanguage(lang) {\r\n"
    "        if (lang !== 'pt' && lang !== 'en') return;\r\n"
    "        try { LightRefStorage.writeConfig({ language: lang }); } catch (e) {}\r\n"
    "    }",

    "    // Traduz os elementos estaticos do index.html para o idioma ativo.\r\n"
    "    function applyStaticStrings() {\r\n"
    "        function el(sel) { try { return document.querySelector(sel); } catch(e) { return null; } }\r\n"
    "        function els(sel) { try { return Array.prototype.slice.call(document.querySelectorAll(sel)); } catch(e) { return []; } }\r\n"
    "        function setTxt(sel, key) { var e = el(sel); if (e) e.textContent = _t(key); }\r\n"
    "        function setAria(sel, key) { var e = el(sel); if (e) { e.setAttribute('aria-label', _t(key)); e.setAttribute('data-tooltip', _t(key)); } }\r\n"
    "        /* Tabs */\r\n"
    "        setTxt('[data-tab=\"light\"]', 'tabLight');\r\n"
    "        setTxt('[data-tab=\"lens\"]', 'tabLens');\r\n"
    "        setTxt('[data-tab=\"adjust\"]', 'tabAdjust');\r\n"
    "        setTxt('[data-tab=\"position\"]', 'tabPosition');\r\n"
    "        setTxt('[data-tab=\"composition\"]', 'tabComposition');\r\n"
    "        /* Projection */\r\n"
    "        setTxt('[data-projection=\"ortho\"]', 'projOrtho');\r\n"
    "        /* Views */\r\n"
    "        setTxt('[data-view=\"front\"]', 'viewFront');\r\n"
    "        setTxt('[data-view=\"profile\"]', 'viewSide');\r\n"
    "        setTxt('[data-view=\"top\"]', 'viewTop');\r\n"
    "        /* Gizmos (position and composition panes) */\r\n"
    "        els('[data-gizmo=\"rotate\"]').forEach(function(e){ e.textContent = _t('gizmoRotate'); });\r\n"
    "        els('[data-gizmo=\"move\"]').forEach(function(e){ e.textContent = _t('gizmoMove'); });\r\n"
    "        els('[data-gizmo=\"off\"]').forEach(function(e){ e.textContent = _t('gizmoOff'); });\r\n"
    "        /* Pages */\r\n"
    "        setTxt('[data-page=\"library\"]', 'pageLibrary');\r\n"
    "        setTxt('[data-page=\"scenes\"]', 'pageScenes');\r\n"
    "        /* Light color label */\r\n"
    "        var lclEl = el('.lr04-lightcolor span'); if (lclEl) lclEl.textContent = _t('labelColor');\r\n"
    "        /* Shortcuts title */\r\n"
    "        setTxt('#shortcuts-title', 'shortcutsTitle');\r\n"
    "        /* Footer update button label */\r\n"
    "        setTxt('.lr04-updlabel', 'btnUpdate');\r\n"
    "        /* Loading text */\r\n"
    "        var lt = el('.loading-text'); if (lt) { var ltSpan = lt.querySelector('span'); if (ltSpan) ltSpan.textContent = _t('textLoading'); }\r\n"
    "        /* Help menu items */\r\n"
    "        setTxt('[data-help=\"intro\"]', 'menuIntro');\r\n"
    "        setTxt('[data-help=\"shortcuts\"]', 'menuShortcuts');\r\n"
    "        /* Action buttons aria-label + data-tooltip */\r\n"
    "        setAria('[data-action=\"export\"]', 'actionExport');\r\n"
    "        setAria('[data-action=\"save\"]', 'actionSave');\r\n"
    "        setAria('[data-action=\"import\"]', 'actionImport');\r\n"
    "        setAria('[data-action=\"reset\"]', 'actionReset');\r\n"
    "        setAria('[data-action=\"reset-view\"]', 'actionResetView');\r\n"
    "        els('[data-action=\"collapse\"]').forEach(function(e){ e.setAttribute('aria-label', _t('actionCollapse')); });\r\n"
    "        setAria('[data-toggle=\"floor\"]', 'toggleFloor');\r\n"
    "        setAria('[data-toggle=\"guides\"]', 'toggleGuides');\r\n"
    "        setAria('[data-toggle=\"reference\"]', 'toggleReference');\r\n"
    "        setAria('[data-toggle=\"materialOpen\"]', 'toggleMaterial');\r\n"
    "        (function(){ var b = el('#btn-update'); if (b) { b.setAttribute('aria-label', _t('btnUpdateAria')); b.setAttribute('data-tooltip', _t('btnUpdateAria')); } })();\r\n"
    "        (function(){ var b = el('#btn-help'); if (b) { b.setAttribute('aria-label', _t('btnHelp')); b.setAttribute('data-tooltip', _t('btnHelp')); } })();\r\n"
    "        /* Checkboxes in adjust (text node of parent label) */\r\n"
    "        (function(){\r\n"
    "            function setCheckLabel(setting, key) {\r\n"
    "                var inp = el('.lr04-inspector input[data-setting=\"' + setting + '\"]');\r\n"
    "                if (!inp || !inp.parentNode) return;\r\n"
    "                var nodes = inp.parentNode.childNodes;\r\n"
    "                for (var i = 0; i < nodes.length; i++) {\r\n"
    "                    if (nodes[i].nodeType === 3 && nodes[i].textContent.replace(/\\s/g,'')) {\r\n"
    "                        nodes[i].textContent = _t(key); return;\r\n"
    "                    }\r\n"
    "                }\r\n"
    "            }\r\n"
    "            setCheckLabel('poster', 'checkPosterize');\r\n"
    "            setCheckLabel('cutout', 'checkCutout');\r\n"
    "            setCheckLabel('gray', 'checkGray');\r\n"
    "        })();\r\n"
    "        /* Material section labels */\r\n"
    "        (function(){\r\n"
    "            var ml = el('label[for=\"lr04-material-select\"]'); if (ml) ml.textContent = _t('labelMaterial');\r\n"
    "            /* Scatter labels: .lr04-scatter labels have text node + input/span */\r\n"
    "            var scatters = els('.lr04-scatter');\r\n"
    "            if (scatters[0]) {\r\n"
    "                var nodes0 = scatters[0].childNodes;\r\n"
    "                if (nodes0[0] && nodes0[0].nodeType === 3) nodes0[0].textContent = _t('labelScatterColor');\r\n"
    "            }\r\n"
    "            if (scatters[1]) {\r\n"
    "                var nodes1 = scatters[1].childNodes;\r\n"
    "                if (nodes1[0] && nodes1[0].nodeType === 3) nodes1[0].textContent = _t('labelBackground');\r\n"
    "                /* Transparent checkbox label text node */\r\n"
    "                var bgCheck = el('#bg-transp'); if (bgCheck && bgCheck.parentNode) {\r\n"
    "                    var tnodes = bgCheck.parentNode.childNodes;\r\n"
    "                    for (var ti = 0; ti < tnodes.length; ti++) {\r\n"
    "                        if (tnodes[ti].nodeType === 3 && tnodes[ti].textContent.replace(/\\s/g,'')) {\r\n"
    "                            tnodes[ti].textContent = ' ' + _t('labelTransparent'); break;\r\n"
    "                        }\r\n"
    "                    }\r\n"
    "                }\r\n"
    "            }\r\n"
    "        })();\r\n"
    "    }\r\n\r\n"
    "    // Aplica o idioma escolhido no wizard e re-renderiza o painel.\r\n"
    "    // O onboarding.js tambem persiste ao concluir/fechar.\r\n"
    "    function applyLanguage(lang) {\r\n"
    "        if (lang !== 'pt' && lang !== 'en') return;\r\n"
    "        try { LightRefStorage.writeConfig({ language: lang }); } catch (e) {}\r\n"
    "        if (window.LightRefI18n && window.LightRefI18n.setLang) window.LightRefI18n.setLang(lang);\r\n"
    "        applyStaticStrings();\r\n"
    "        renderTab();\r\n"
    "        fillModelSelect();\r\n"
    "        fillAddTypeSelect();\r\n"
    "        if (currentPage === 'library' || currentPage === 'scenes') {\r\n"
    "            try { renderCatalog(currentPage); } catch (e) {}\r\n"
    "        }\r\n"
    "    }",
    'applyStaticStrings + extend applyLanguage'
)

# ---------------------------------------------------------------------------
# 4. DOMContentLoaded boot: call applyLanguage(curLang) early
#    Insert after cfgBoot/curLang setup, before fillModelSelect
# ---------------------------------------------------------------------------

replace_once(
    "        fillModelSelect();\r\n"
    "        fillAddTypeSelect();\r\n"
    "        fillMaterialSelect();\r\n"
    "        initScene();",

    "        /* i18n boot: set active lang before any render. */\r\n"
    "        var cfgI18n = {}; try { cfgI18n = LightRefStorage.readConfig(); } catch (eI18n) {}\r\n"
    "        var bootLang = (cfgI18n && cfgI18n.language) || 'pt';\r\n"
    "        if (window.LightRefI18n && window.LightRefI18n.setLang) window.LightRefI18n.setLang(bootLang);\r\n"
    "        fillModelSelect();\r\n"
    "        fillAddTypeSelect();\r\n"
    "        fillMaterialSelect();\r\n"
    "        initScene();",
    'boot setLang early'
)

# After LightRefOnboarding wiring, before visibilitychange:
# Insert applyStaticStrings(curLang) call after curLang is known
replace_once(
    "        var curLang = cfgBoot.language || 'pt';\r\n"
    "        if (window.LightRefOnboarding) {",

    "        var curLang = cfgBoot.language || 'pt';\r\n"
    "        /* Apply static strings once curLang is known (before wizard shows). */\r\n"
    "        applyStaticStrings();\r\n"
    "        if (window.LightRefOnboarding) {",
    'applyStaticStrings after curLang'
)

# ---------------------------------------------------------------------------
# 5. renderLight: replace hardcoded PT labels
# ---------------------------------------------------------------------------

replace_once(
    "                fieldsHost.innerHTML =\r\n"
    "                    row('Intensidade','sl-intensity',0,10,0.1, l.intensity, '') +\r\n"
    "                    row('Girar','sl-azimuth',0,360,1, l.azimuth, '\\u00b0') +\r\n"
    "                    row('Altura','sl-elevation',-90,90,1, l.elevation, '\\u00b0');",

    "                fieldsHost.innerHTML =\r\n"
    "                    row(_t('lightIntensity'),'sl-intensity',0,10,0.1, l.intensity, '') +\r\n"
    "                    row(_t('lightRotate'),'sl-azimuth',0,360,1, l.azimuth, '\\u00b0') +\r\n"
    "                    row(_t('lightHeight'),'sl-elevation',-90,90,1, l.elevation, '\\u00b0');",
    'renderLight row labels'
)

replace_once(
    "        chipsHost.innerHTML = chips + '<button id=\"add-light\" class=\"lr04-addlight\" title=\"Adicionar luz\">",
    "        chipsHost.innerHTML = chips + '<button id=\"add-light\" class=\"lr04-addlight\" title=\"' + _t('lightAdd') + '\">",
    'renderLight add-light title'
)

replace_once(
    "'<button data-remove=\"'+l.id+'\" title=\"Remover\">",
    "'<button data-remove=\"'+l.id+'\" title=\"' + _t('lightRemove') + '\">",
    'renderLight remove title'
)

# ---------------------------------------------------------------------------
# 6. renderLens / renderEnvSection
# ---------------------------------------------------------------------------

replace_once(
    "        host.innerHTML = row('Lente','sl-focal',10,300,1, f, 'mm');",
    "        host.innerHTML = row(_t('lensLabel'),'sl-focal',10,300,1, f, 'mm');",
    'renderLens lensLabel'
)

replace_once(
    "            '<button type=\"button\" class=\"lr04-widebutton\" id=\"env-drawer-head\" aria-expanded=\"false\">Ambiente / HDR</button>' +",
    "            '<button type=\"button\" class=\"lr04-widebutton\" id=\"env-drawer-head\" aria-expanded=\"false\">' + _t('lensEnvSection') + '</button>' +",
    'renderEnvSection section title'
)

replace_once(
    "            '<div class=\"lr04-row\"><span>Mapa</span>",
    "            '<div class=\"lr04-row\"><span>' + _t('lensEnvMap') + '</span>",
    'renderEnvSection map label'
)

replace_once(
    "            row('Intensidade','sl-envint',0,2,0.05, (ei).toFixed(2), '') +",
    "            row(_t('lensEnvIntensity'),'sl-envint',0,2,0.05, (ei).toFixed(2), '') +",
    'renderEnvSection intensity'
)

replace_once(
    "            '<label class=\"lr04-check\"><input type=\"checkbox\" id=\"ck-envbg\" checked>Mostrar fundo do HDR</label>' +",
    "            '<label class=\"lr04-check\"><input type=\"checkbox\" id=\"ck-envbg\" checked>' + _t('lensEnvBg') + '</label>' +",
    'renderEnvSection env bg label'
)

# Framing heading in lens pane HTML - update via applyStaticStrings approach
# The <span class="lr04-heading">Enquadramento</span> is static HTML in lens pane
# We handle it in applyStaticStrings - add after the gizmos block:
# Actually it's already handled by applyStaticStrings? No - we didn't add it.
# Let's add it in renderLens() by querying + updating after render.
replace_once(
    "        // Secao Ambiente / HDR recolhivel, inserida na coluna direita da lente.\r\n        renderEnvSection();",
    "        /* Update static lens heading for framing. */\r\n"
    "        (function(){ var fh = document.querySelector('#lr04-pane-lens .lr04-heading'); if (fh) fh.textContent = _t('lensFraming'); })();\r\n"
    "        /* Update Resetar camera button. */\r\n"
    "        (function(){ var rc = document.querySelector('#lr04-pane-lens [data-action=\"reset-view\"]'); if (rc) rc.textContent = _t('lensResetCamera'); })();\r\n"
    "        // Secao Ambiente / HDR recolhivel, inserida na coluna direita da lente.\r\n"
    "        renderEnvSection();",
    'renderLens framing heading + reset camera'
)

# ---------------------------------------------------------------------------
# 7. renderAdjust
# ---------------------------------------------------------------------------

replace_once(
    "                row('Exposicao','sl-exposure',-3,3,0.05, fx2(p.exposure), '') +\r\n"
    "                row('Contraste','sl-contrast',-1,1,0.02, fx2(p.contrast), '') +\r\n"
    "                row('Temperatura','sl-temperature',-1,1,0.02, fx2(p.temperature), '') +\r\n"
    "                row('Saturacao','sl-saturation',0,2,0.02, fx2(p.saturation), '');",

    "                row(_t('adjExposure'),'sl-exposure',-3,3,0.05, fx2(p.exposure), '') +\r\n"
    "                row(_t('adjContrast'),'sl-contrast',-1,1,0.02, fx2(p.contrast), '') +\r\n"
    "                row(_t('adjTemperature'),'sl-temperature',-1,1,0.02, fx2(p.temperature), '') +\r\n"
    "                row(_t('adjSaturation'),'sl-saturation',0,2,0.02, fx2(p.saturation), '');",
    'renderAdjust tonal rows'
)

replace_once(
    "        var lv = $('.lr04-levelsfield'); if (lv) { lv.innerHTML = row('Niveis','sl-posterize',2,16,1, p.posterizeLevels, ''); wireRanges(lv); }",
    "        var lv = $('.lr04-levelsfield'); if (lv) { lv.innerHTML = row(_t('adjLevels'),'sl-posterize',2,16,1, p.posterizeLevels, ''); wireRanges(lv); }",
    'renderAdjust levels'
)

replace_once(
    "        var st = $('.lr04-stepsfield'); if (st) { st.innerHTML = row('Degraus','sl-cutout',2,8,1, p.cutoutLevels, ''); wireRanges(st); }",
    "        var st = $('.lr04-stepsfield'); if (st) { st.innerHTML = row(_t('adjSteps'),'sl-cutout',2,8,1, p.cutoutLevels, ''); wireRanges(st); }",
    'renderAdjust steps'
)

# The reset-adjust button is static HTML; update its text in renderAdjust
replace_once(
    "        bindAction('reset-adjust', function () { scene.postfx.reset(); renderTab(); syncFilterButtons(); });",
    "        (function(){ var ra = document.querySelector('[data-action=\"reset-adjust\"]'); if (ra) ra.textContent = _t('adjReset'); })();\r\n"
    "        bindAction('reset-adjust', function () { scene.postfx.reset(); renderTab(); syncFilterButtons(); });",
    'renderAdjust reset button text'
)

# ---------------------------------------------------------------------------
# 8. renderPos
# ---------------------------------------------------------------------------

replace_once(
    "            left.innerHTML =\r\n"
    "                row('Girar Y','sl-yaw',-180,180,1, rot.yaw||0, '\\u00b0') +\r\n"
    "                row('Inclinar X','sl-pitch',-180,180,1, rot.pitch||0, '\\u00b0') +\r\n"
    "                row('Altura','sl-offy',-3,3,0.02, fx2(off.y), '') +\r\n"
    "                row('Horizontal','sl-offx',-3,3,0.02, fx2(off.x), '');",

    "            left.innerHTML =\r\n"
    "                row(_t('posRotateY'),'sl-yaw',-180,180,1, rot.yaw||0, '\\u00b0') +\r\n"
    "                row(_t('posTiltX'),'sl-pitch',-180,180,1, rot.pitch||0, '\\u00b0') +\r\n"
    "                row(_t('posHeight'),'sl-offy',-3,3,0.02, fx2(off.y), '') +\r\n"
    "                row(_t('posHorizontal'),'sl-offx',-3,3,0.02, fx2(off.x), '');",
    'renderPos left rows'
)

replace_once(
    "            right.innerHTML =\r\n"
    "                row('Profundidade','sl-offz',-3,3,0.02, fx2(off.z), '') +\r\n"
    "                row('Escala','sl-mscale',0.2,3,0.02, fx2(sc), 'x') +\r\n"
    "                row('Inclinar Z','sl-roll',-180,180,1, roll, '\\u00b0') +\r\n"
    "                '<button id=\"save-position\" class=\"lr04-widebutton\">Salvar posicao do modelo</button>' +\r\n"
    "                '<button id=\"reset-transform\" class=\"lr04-widebutton\">Centralizar / resetar</button>' +\r\n"
    "                '<div class=\"lr04-hint\" style=\"font-size:10px;color:#8f9198;margin-top:8px;line-height:1.5\">Atalhos: G mover, S escala, R rotacao (RR livre). X/Y/Z travam eixo, clique confirma, Esc cancela.</div>';",

    "            right.innerHTML =\r\n"
    "                row(_t('posDepth'),'sl-offz',-3,3,0.02, fx2(off.z), '') +\r\n"
    "                row(_t('posScale'),'sl-mscale',0.2,3,0.02, fx2(sc), 'x') +\r\n"
    "                row(_t('posTiltZ'),'sl-roll',-180,180,1, roll, '\\u00b0') +\r\n"
    "                '<button id=\"save-position\" class=\"lr04-widebutton\">' + _t('posSave') + '</button>' +\r\n"
    "                '<button id=\"reset-transform\" class=\"lr04-widebutton\">' + _t('posCenter') + '</button>' +\r\n"
    "                '<div class=\"lr04-hint\" style=\"font-size:10px;color:#8f9198;margin-top:8px;line-height:1.5\">' + _t('posHint') + '</div>';",
    'renderPos right rows'
)

# Also update the static position pane headings via applyStaticStrings -
# they are in the HTML as <span class="lr04-heading">Gizmo no visor</span> etc.
# We'll handle them in applyStaticStrings. Add to applyStaticStrings:
replace_once(
    "        /* Material section labels */",
    "        /* Position / Composition static headings */\r\n"
    "        (function(){\r\n"
    "            var posHeadings = document.querySelectorAll ? Array.prototype.slice.call(document.querySelectorAll('#lr04-pane-position .lr04-heading')) : [];\r\n"
    "            if (posHeadings[0]) posHeadings[0].textContent = _t('compGizmoSection');\r\n"
    "            if (posHeadings[1]) posHeadings[1].textContent = _t('compSliderSection');\r\n"
    "            var compHeadings = document.querySelectorAll ? Array.prototype.slice.call(document.querySelectorAll('#lr04-pane-composition .lr04-heading')) : [];\r\n"
    "            if (compHeadings[0]) compHeadings[0].textContent = _t('compGizmoObj');\r\n"
    "            if (compHeadings[1]) compHeadings[1].textContent = _t('compAddSection');\r\n"
    "            /* compCount heading updated by renderComposition */\r\n"
    "            var compObjLabel = document.querySelector('#lr04-pane-composition .lr04-addrow'); if (compObjLabel) { var firstText = compObjLabel.firstChild; if (firstText && firstText.nodeType === 3) firstText.textContent = _t('compObjLabel'); }\r\n"
    "            /* Add to scene button */\r\n"
    "            var addToScene = document.querySelector('[data-action=\"add-object\"]'); if (addToScene) addToScene.textContent = _t('compAddBtn');\r\n"
    "        })();\r\n"
    "        /* Material section labels */",
    'applyStaticStrings: position/composition headings'
)

# ---------------------------------------------------------------------------
# 9. renderComposition
# ---------------------------------------------------------------------------

replace_once(
    "        if (countHost) countHost.textContent = 'Objetos na cena (' + objs.length + ')';",
    "        if (countHost) countHost.textContent = _t('compCount', { n: objs.length });",
    'renderComposition count'
)

replace_once(
    "                deformHost.innerHTML = '<span class=\"lr04-heading\" style=\"margin-top:12px\">Distorcer forma</span>' +\r\n"
    "                    row('Largura X','sl-defx',0.2,3,0.02, fx2(ax.x), 'x') +\r\n"
    "                    row('Altura Y','sl-defy',0.2,3,0.02, fx2(ax.y), 'x') +\r\n"
    "                    row('Profund. Z','sl-defz',0.2,3,0.02, fx2(ax.z), 'x') +\r\n"
    "                    '<button id=\"def-reset\" class=\"lr04-widebutton\">Resetar forma</button>';",

    "                deformHost.innerHTML = '<span class=\"lr04-heading\" style=\"margin-top:12px\">' + _t('compDeform') + '</span>' +\r\n"
    "                    row(_t('compWidthX'),'sl-defx',0.2,3,0.02, fx2(ax.x), 'x') +\r\n"
    "                    row(_t('compHeightY'),'sl-defy',0.2,3,0.02, fx2(ax.y), 'x') +\r\n"
    "                    row(_t('compDepthZ'),'sl-defz',0.2,3,0.02, fx2(ax.z), 'x') +\r\n"
    "                    '<button id=\"def-reset\" class=\"lr04-widebutton\">' + _t('compResetShape') + '</button>';",
    'renderComposition deform section'
)

replace_once(
    "        function nmeOf(url){ var all=SHAPES.concat(MODELS); for(var i=0;i<all.length;i++) if(all[i].v===url) return all[i].t; return 'Objeto'; }",
    "        function nmeOf(url){ var all=SHAPES.concat(MODELS); for(var i=0;i<all.length;i++) if(all[i].v===url) return all[i].t; return _t('compObjLabel'); }",
    'renderComposition nmeOf fallback'
)

# ---------------------------------------------------------------------------
# 10. fillModelSelect - translate optgroup labels
# ---------------------------------------------------------------------------

# The cat label comes from m.cat directly. We need to map m.cat to t() key.
# Current: g.label = c (where c is e.g. 'Cabecas')
# Replace the forEach logic:
replace_once(
    "        cats.forEach(function (c) {\r\n"
    "            var g = document.createElement('optgroup'); g.label = c;\r\n"
    "            MODELS.forEach(function (m) { if ((m.cat||'Outros') === c) { var o = document.createElement('option'); o.value = m.v; o.textContent = m.t; g.appendChild(o); } });\r\n"
    "            sel.appendChild(g);\r\n"
    "        });",

    "        var _catKey = { 'Cabecas':'ogHeads', 'Bustos e Torsos':'ogBusts', 'Figuras':'ogFigures', 'Formas basicas':'ogShapes' };\r\n"
    "        cats.forEach(function (c) {\r\n"
    "            var g = document.createElement('optgroup'); g.label = _t(_catKey[c] || c);\r\n"
    "            MODELS.forEach(function (m) { if ((m.cat||'Outros') === c) { var o = document.createElement('option'); o.value = m.v; o.textContent = m.t; g.appendChild(o); } });\r\n"
    "            sel.appendChild(g);\r\n"
    "        });",
    'fillModelSelect translated optgroups'
)

replace_once(
    "            var gs = document.createElement('optgroup'); gs.label = 'Formas basicas';\r\n"
    "            SHAPES.forEach(function (s) { var o = document.createElement('option'); o.value = s.v; o.textContent = s.t; gs.appendChild(o); });\r\n"
    "            sel.appendChild(gs);",
    "            var gs = document.createElement('optgroup'); gs.label = _t('ogShapes');\r\n"
    "            SHAPES.forEach(function (s) { var o = document.createElement('option'); o.value = s.v; o.textContent = s.t; gs.appendChild(o); });\r\n"
    "            sel.appendChild(gs);",
    'fillModelSelect shapes optgroup'
)

# ---------------------------------------------------------------------------
# 11. fillAddTypeSelect - translate optgroup labels
# ---------------------------------------------------------------------------

replace_once(
    "        var gs = document.createElement('optgroup'); gs.label = 'Formas basicas';\r\n"
    "        SHAPES.forEach(function (s) { var o = document.createElement('option'); o.value = s.v; o.textContent = s.t; gs.appendChild(o); });\r\n"
    "        sel.appendChild(gs);\r\n"
    "        var gm = document.createElement('optgroup'); gm.label = 'Modelos';",
    "        var gs = document.createElement('optgroup'); gs.label = _t('ogShapes');\r\n"
    "        SHAPES.forEach(function (s) { var o = document.createElement('option'); o.value = s.v; o.textContent = s.t; gs.appendChild(o); });\r\n"
    "        sel.appendChild(gs);\r\n"
    "        var gm = document.createElement('optgroup'); gm.label = _t('ogModels');",
    'fillAddTypeSelect optgroups'
)

# ---------------------------------------------------------------------------
# 12. buildShortcutGroups - translate titles and descriptions
# ---------------------------------------------------------------------------

replace_once(
    "        return [\r\n"
    "            { title: 'Luzes', rows: [\r\n"
    "                { combo: 'Ctrl+Shift+A', desc: 'Adicionar luz' },\r\n"
    "                { combo: 'Ctrl+Shift+X', desc: 'Remover a luz selecionada' },\r\n"
    "                { combo: 'Ctrl+Shift+Z', desc: 'Desfazer a remocao' },\r\n"
    "                { combo: 'Ctrl+Shift+1 a 9', desc: 'Selecionar a luz pelo numero' }\r\n"
    "            ] },\r\n"
    "            { title: 'Arraste no visor (segure Shift)', rows: [\r\n"
    "                { combo: 'Shift + arrastar', desc: 'Girar a luz ativa (direcao e altura)' },\r\n"
    "                { combo: 'Ctrl+Shift + arrastar', desc: 'Mudar so a intensidade' },\r\n"
    "                { combo: 'Ctrl+Shift+Alt + arrastar', desc: 'Mudar a cor (horizontal) e a temperatura (vertical)' }\r\n"
    "            ] },\r\n"
    "            { title: 'Transformar objeto (aba Posicao)', rows: [\r\n"
    "                { combo: 'G', desc: 'Mover' },\r\n"
    "                { combo: 'S', desc: 'Escalar' },\r\n"
    "                { combo: 'R', desc: 'Rotacionar' },\r\n"
    "                { combo: 'X / Y / Z', desc: 'Travar no eixo' },\r\n"
    "                { combo: 'Enter', desc: 'Confirmar' },\r\n"
    "                { combo: 'Esc', desc: 'Cancelar' }\r\n"
    "            ] }\r\n"
    "        ];",

    "        return [\r\n"
    "            { title: _t('scGrpLights'), rows: [\r\n"
    "                { combo: 'Ctrl+Shift+A', desc: _t('scAddLight') },\r\n"
    "                { combo: 'Ctrl+Shift+X', desc: _t('scRemoveLight') },\r\n"
    "                { combo: 'Ctrl+Shift+Z', desc: _t('scUndoRemove') },\r\n"
    "                { combo: 'Ctrl+Shift+1 a 9', desc: _t('scSelectByNum') }\r\n"
    "            ] },\r\n"
    "            { title: _t('scGrpDrag'), rows: [\r\n"
    "                { combo: 'Shift + arrastar', desc: _t('scDragRotate') },\r\n"
    "                { combo: 'Ctrl+Shift + arrastar', desc: _t('scDragIntensity') },\r\n"
    "                { combo: 'Ctrl+Shift+Alt + arrastar', desc: _t('scDragColor') }\r\n"
    "            ] },\r\n"
    "            { title: _t('scGrpTransform'), rows: [\r\n"
    "                { combo: 'G', desc: _t('scMove') },\r\n"
    "                { combo: 'S', desc: _t('scScale') },\r\n"
    "                { combo: 'R', desc: _t('scRotate') },\r\n"
    "                { combo: 'X / Y / Z', desc: _t('scLockAxis') },\r\n"
    "                { combo: 'Enter', desc: _t('scConfirm') },\r\n"
    "                { combo: 'Esc', desc: _t('scCancel') }\r\n"
    "            ] }\r\n"
    "        ];",
    'buildShortcutGroups translated'
)

# ---------------------------------------------------------------------------
# 13. feedback() call sites
# ---------------------------------------------------------------------------

# addLight feedback
replace_once(
    "        feedback('Luz adicionada: ' + nl.name);",
    "        feedback(_t('fbLightAdded', { nome: nl.name }));",
    'feedback fbLightAdded'
)

replace_once(
    "        if (!l) { feedback('Nenhuma luz selecionada', true); return; }",
    "        if (!l) { feedback(_t('fbNoLight'), true); return; }",
    'feedback fbNoLight'
)

replace_once(
    "        feedback('Luz removida (Ctrl+Shift+Z desfaz)');",
    "        feedback(_t('fbLightRemoved'));",
    'feedback fbLightRemoved'
)

replace_once(
    "        if (!deletedLights.length) { feedback('Nada para desfazer', true); return; }",
    "        if (!deletedLights.length) { feedback(_t('fbNoUndo'), true); return; }",
    'feedback fbNoUndo'
)

replace_once(
    "        feedback('Luz restaurada: ' + (d.name||''));",
    "        feedback(_t('fbLightRestored', { nome: d.name||'' }));",
    'feedback fbLightRestored'
)

# onXform start: 'Mover'/'Escala'/'Rotacao' + the message
replace_once(
    "            if (phase === 'start') { var t = info==='move'?'Mover':(info==='scale'?'Escala':'Rotacao'); feedback(t + ': mova o mouse, clique confirma, Esc cancela'); }",
    "            if (phase === 'start') { var xfType = _t(info==='move'?'scMove':(info==='scale'?'scScale':'scRotate')); feedback(_t('fbXformStart', { tipo: xfType })); }",
    'feedback fbXformStart'
)

replace_once(
    "            else if (phase === 'axis') { feedback('Eixo: ' + (info ? info.toUpperCase() : 'livre')); }",
    "            else if (phase === 'axis') { feedback(_t('fbAxis', { eixo: info ? info.toUpperCase() : 'livre' })); }",
    'feedback fbAxis'
)

replace_once(
    "            else if (phase === 'confirm') { feedback('Transformacao aplicada');",
    "            else if (phase === 'confirm') { feedback(_t('fbTransformApplied'));",
    'feedback fbTransformApplied'
)

replace_once(
    "            else if (phase === 'cancel') { feedback('Cancelado'); }",
    "            else if (phase === 'cancel') { feedback(_t('fbCancelled')); }",
    'feedback fbCancelled'
)

replace_once(
    "            else if (phase === 'none') { feedback('Selecione um objeto na lista', true); }",
    "            else if (phase === 'none') { feedback(_t('fbSelectInList'), true); }",
    'feedback fbSelectInList'
)

# bindCompKeys 'Selecione um objeto'
replace_all(
    "if (!scene.beginXform('move')) feedback('Selecione um objeto', true)",
    "if (!scene.beginXform('move')) feedback(_t('fbSelectObj'), true)",
    'feedback fbSelectObj move', 1
)
replace_all(
    "if (!scene.beginXform('scale')) feedback('Selecione um objeto', true)",
    "if (!scene.beginXform('scale')) feedback(_t('fbSelectObj'), true)",
    'feedback fbSelectObj scale', 1
)
replace_all(
    "if (!scene.beginXform('rotate')) feedback('Selecione um objeto', true)",
    "if (!scene.beginXform('rotate')) feedback(_t('fbSelectObj'), true)",
    'feedback fbSelectObj rotate', 1
)

# loadModel feedback
replace_once(
    "                feedback('Falha ao carregar' + (em ? ': ' + em.slice(0, 160) : ''), true);",
    "                feedback(_t('fbLoadFail') + (em ? ': ' + em.slice(0, 160) : ''), true);",
    'feedback fbLoadFail'
)

# import feedback
replace_once(
    "                feedback('Modelo importado');",
    "                feedback(_t('fbImported'));",
    'feedback fbImported'
)
replace_once(
    "} catch (e) { pendingImportCat = null; feedback('Falha ao importar', true); }",
    "} catch (e) { pendingImportCat = null; feedback(_t('fbImportFail'), true); }",
    'feedback fbImportFail'
)

# material feedback
replace_once(
    "            feedback('Material: ' + this.options[this.selectedIndex].text);",
    "            feedback(_t('fbMaterial', { nome: this.options[this.selectedIndex].text }));",
    'feedback fbMaterial'
)

# color picker feedback
replace_once(
    "                if (err) { feedback('Nao foi possivel abrir o seletor de cores do Photoshop', true); return; }",
    "                if (err) { feedback(_t('fbColorPicker'), true); return; }",
    'feedback fbColorPicker'
)

# renderPos save feedback
replace_once(
    "                feedback('Salvando...');",
    "                feedback(_t('fbSaving'));",
    'feedback fbSaving'
)
replace_once(
    "                    feedback('Posicao e miniatura salvas');",
    "                    feedback(_t('fbSaved'));",
    'feedback fbSaved savePosition'
)

# renderComposition addBtn feedback
replace_once(
    "            feedback('Adicionando objeto...');",
    "            feedback(_t('fbAddingObj'));",
    'feedback fbAddingObj'
)
replace_once(
    "                if (err) { feedback('Falha ao adicionar', true); return; }",
    "                if (err) { feedback(_t('fbAddFail'), true); return; }",
    'feedback fbAddFail'
)
replace_once(
    "                scene.selectSceneObject(id); renderTab(); feedback('Objeto adicionado');",
    "                scene.selectSceneObject(id); renderTab(); feedback(_t('fbObjAdded'));",
    'feedback fbObjAdded'
)

# confirmDeleteItem feedback
replace_once(
    "                    feedback('Falha ao remover o arquivo do modelo', true);",
    "                    feedback(_t('fbDeleteFail'), true);",
    'feedback fbDeleteFail'
)

# onCreateCategory / onRenameCategory feedback
replace_once(
    "            } catch (e) { feedback('Falha ao criar categoria', true); return; }",
    "            } catch (e) { feedback(_t('fbCatCreateFail'), true); return; }",
    'feedback fbCatCreateFail'
)
replace_once(
    "            } catch (e) { feedback('Falha ao renomear categoria', true); return; }",
    "            } catch (e) { feedback(_t('fbCatRenameFail'), true); return; }",
    'feedback fbCatRenameFail'
)

# runManualUpdateCheck 'Verificando atualizacoes...'
replace_once(
    "    function runManualUpdateCheck(btn) { if (btn) btn.classList.add('is-checking'); feedback('Verificando atualizacoes...', false);",
    "    function runManualUpdateCheck(btn) { if (btn) btn.classList.add('is-checking'); feedback(_t('fbChecking'), false);",
    'feedback fbChecking'
)

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

if errors:
    print('ERRORS:')
    for e in errors:
        print('  ' + e)
    sys.exit(1)

# ASCII check
for i, b in enumerate(src.encode('latin-1', errors='replace')):
    code = b if isinstance(b, int) else ord(b)
    if code > 127:
        print('NON-ASCII at offset %d (byte %d)' % (i, code))
        sys.exit(1)

with io.open(PANEL, mode='w', encoding='utf-8', newline='') as f:
    f.write(src)

print('patch_panel.py: all replacements applied, ASCII clean, written.')
