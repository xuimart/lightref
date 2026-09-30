/*
 * panel.js - controlador da UI v0.4 (layout lr04). ASCII-only.
 * Estrutura do mockup lr04: viewport (canvas real do Babylon) + barra do meio
 * (tabs + acoes) + inspector com uma <section data-pane> por aba. Paginas
 * (3D/Biblioteca/Cenas) no rodape. Toda a logica 3D fica no LightRefScene.
 *
 * Mapeamento de abas: o HTML usa data-tab="position"/"composition"; internamente
 * mantemos os codigos curtos pos/comp para casar com o resto da logica.
 */
(function () {
    'use strict';

    var scene = null, selectedLightId = null, exportMode = 'raster';
    // Mapeia data-tab do HTML (lr04) para os codigos internos usados na logica.
    function tabFromDom(v) { if (v === 'position') return 'pos'; if (v === 'composition') return 'comp'; return v; }
    function domFromTab(v) { if (v === 'pos') return 'position'; if (v === 'comp') return 'composition'; return v; }
    // O pane no HTML usa os nomes longos (data-pane="position"/"composition").
    function paneName(tab) { return domFromTab(tab); }

    // Centraliza a selecao de luz: guarda o id e avisa a cena para os atalhos.
    function selectLight(id) { selectedLightId = id; if (scene && scene.setActiveLight) scene.setActiveLight(id); }
    // Renderiza os icones lucide presentes no DOM (estaticos do mockup).
    function refreshIcons() { try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {} }
    // Ctrl+Shift+1..5 seleciona rapidamente a luz correspondente.
    function bindLightKeys() {
        window.addEventListener('keydown', function (e) {
            if (!e.ctrlKey || !e.shiftKey) return;
            // Ctrl+Shift+A adiciona, X remove, Z desfaz (nao usa Alt).
            if (!e.altKey && e.code === 'KeyA') { addLight(); e.preventDefault(); return; }
            if (!e.altKey && e.code === 'KeyX') { removeSelectedLight(); e.preventDefault(); return; }
            if (!e.altKey && e.code === 'KeyZ') { undoLight(); e.preventDefault(); return; }
            var n = -1;
            if (e.code && e.code.indexOf('Digit') === 0) n = parseInt(e.code.slice(5),10);
            else if (e.key >= '1' && e.key <= '9') n = parseInt(e.key,10);
            if (n < 1 || n > 9) return;
            var lights = scene.lightManager.lights;
            if (n <= lights.length) {
                selectLight(lights[n-1].id);
                if (currentTab !== 'light') { setActiveTab('light'); }
                renderTab();
                e.preventDefault();
            }
        });
    }
    function bindCompKeys() {
        window.addEventListener('keydown', function (e) {
            if (currentTab !== 'comp' && currentTab !== 'pos') return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
            var code = e.code;
            if (scene.isXforming && scene.isXforming()) {
                if (code === 'Escape') { scene.cancelXform(); e.preventDefault(); return; }
                if (code === 'Enter') { scene.confirmXform(); if (currentTab==='pos') { saveModelXform(); renderTab(); } e.preventDefault(); return; }
                if (code === 'KeyX') { scene.setXformAxis('x'); e.preventDefault(); return; }
                if (code === 'KeyY') { scene.setXformAxis('y'); e.preventDefault(); return; }
                if (code === 'KeyZ') { scene.setXformAxis('z'); e.preventDefault(); return; }
                if (code === 'KeyR') { scene.beginXform('rotate'); e.preventDefault(); return; }
                if (code === 'KeyG') { scene.beginXform('move'); e.preventDefault(); return; }
                if (code === 'KeyS') { scene.beginXform('scale'); e.preventDefault(); return; }
                return;
            }
            if (code === 'KeyG') { if (!scene.beginXform('move')) feedback('Selecione um objeto', true); e.preventDefault(); }
            else if (code === 'KeyS') { if (!scene.beginXform('scale')) feedback('Selecione um objeto', true); e.preventDefault(); }
            else if (code === 'KeyR') { if (!scene.beginXform('rotate')) feedback('Selecione um objeto', true); e.preventDefault(); }
        });
    }
    var currentTab = 'light', currentPage = 'studio';
    function $(s, ctx) { return (ctx || document).querySelector(s); }
    function $all(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }

    // yaw: rotacao inicial em Y (graus) para o modelo abrir de frente.
    var MODELS = [
        { v:'models/asaro.obj', t:'Asaro', yaw:180, cat:'Cabecas' },
        { v:'models/ecorche.obj', t:'Ecorche', yaw:180, cat:'Cabecas' },
        { v:'models/cabeca-homem.obj', t:'Cabeca Homem', yaw:180, cat:'Cabecas' },
        { v:'models/cabeca-mulher.obj', t:'Cabeca Mulher', yaw:180, cat:'Cabecas' },
        { v:'models/cabeca-mulher-face.obj', t:'Rosto Mulher', yaw:180, cat:'Cabecas' },
        { v:'models/cabeca-anime.obj', t:'Cabeca Anime', yaw:180, cat:'Cabecas' },
        { v:'models/cabeca-semi-realista.obj', t:'Cabeca Semi Realista', yaw:180, cat:'Cabecas' },
        { v:'models/busto-mulher.obj', t:'Busto Mulher', yaw:180, cat:'Bustos e Torsos' },
        { v:'models/torso-masculino.obj', t:'Torso Masculino', yaw:180, cat:'Bustos e Torsos' },
        { v:'models/torso-mulher.obj', t:'Torso Mulher', yaw:180, cat:'Bustos e Torsos' },
        { v:'models/homem-romano.obj', t:'Homem Romano', yaw:180, cat:'Figuras' },
        { v:'models/mulher-romana.obj', t:'Mulher Romana', yaw:180, cat:'Figuras' },
        { v:'models/tecido-mulher.obj', t:'Tecido em Mulher', yaw:180, cat:'Figuras' },
        { v:'models/furry.stl', t:'Furry', yaw:180, cat:'Figuras' }
    ];
    function modelYaw(url) { for (var i=0;i<MODELS.length;i++) if (MODELS[i].v===url) return MODELS[i].yaw||0; return 0; }
    // Persistencia dos ajustes de Posicao por modelo (config.modelXforms[url]).
    var currentModelUrl = null;
    function saveModelXform() {
        if (!currentModelUrl || !scene) return;
        try {
            var rot = scene.getModelRotation ? scene.getModelRotation() : {yaw:0,pitch:0,roll:0};
            var off = scene.getModelOffset ? scene.getModelOffset() : {x:0,y:0,z:0};
            var sc = scene.getModelScaleMult ? scene.getModelScaleMult() : 1;
            var cfg = LightRefStorage.readConfig(); cfg.modelXforms = cfg.modelXforms || {};
            cfg.modelXforms[currentModelUrl] = { yaw:rot.yaw, pitch:rot.pitch, roll:rot.roll, ox:off.x, oy:off.y, oz:off.z, scale:sc };
            LightRefStorage.writeConfig({ modelXforms: cfg.modelXforms });
        } catch (e) {}
    }
    function restoreModelXform(url) {
        try {
            var cfg = LightRefStorage.readConfig(); var x = (cfg.modelXforms||{})[url];
            if (!x) return false;
            if (scene.setModelRotation) scene.setModelRotation(x.yaw||0, x.pitch||0);
            if (scene.setModelRoll && x.roll != null) scene.setModelRoll(x.roll);
            if (scene.setModelOffset) { scene.setModelOffset('x', x.ox||0); scene.setModelOffset('y', x.oy||0); scene.setModelOffset('z', x.oz||0); }
            if (scene.setModelScaleMult && x.scale != null) scene.setModelScaleMult(x.scale);
            return true;
        } catch (e) { return false; }
    }
    // Mapas de ambiente (HDR/panorama). v=arquivo, t=nome exibido.
    var ENVIRONMENTS = [
        { v:'', t:'Nenhum (fundo normal)' },
        { v:'env/lobby-center.jpg', t:'Estudio / Lobby' },
        { v:'env/factory-catwalk.jpg', t:'Fabrica' },
        { v:'env/etnies-park.jpg', t:'Parque' },
        { v:'env/charles-river.jpg', t:'Rio / Cidade' },
        { v:'env/la-downtown.jpg', t:'LA Centro' },
        { v:'env/parking-lot.jpg', t:'Estacionamento' },
        { v:'env/grand-canyon.jpg', t:'Canyon' },
        { v:'env/ueno-shrine.jpg', t:'Templo Ueno' },
        { v:'env/frozen-waterfall.jpg', t:'Cachoeira Gelada' },
        { v:'env/milkyway.jpg', t:'Via Lactea' }
    ];
    // Formas basicas + modelos para 'Montar cena' (objetos extras).
    var SHAPES = [
        { v:'models/forma-cubo.obj', t:'Cubo' },
        { v:'models/forma-esfera.obj', t:'Esfera' },
        { v:'models/forma-cilindro.obj', t:'Cilindro' },
        { v:'models/forma-cone.obj', t:'Cone' },
        { v:'models/forma-cone-facetado.obj', t:'Cone facetado' }
    ];
    var MATERIALS = [
        { v:'clay', t:'Clay' }, { v:'skin', t:'Pele' }, { v:'marble', t:'Marmore' },
        { v:'jade', t:'Jade' }, { v:'gold', t:'Ouro' }, { v:'copper', t:'Cobre' },
        { v:'bronze', t:'Bronze' }, { v:'metal', t:'Metal' },
        { v:'pearl', t:'Perola' }, { v:'white', t:'Branco' }
    ];

    var LIGHT_NAMES = ['Principal', 'Preenchimento', 'Contorno', 'Recorte', 'Rebote'];
    function nextLightName() {
        var n = scene.lightManager.lights.length;
        return LIGHT_NAMES[n] || ('Luz ' + (n + 1));
    }

    // Pilha simples de luzes deletadas para o desfazer (Ctrl+Shift+Z).
    var deletedLights = [];
    function addLight() {
        var nl = scene.lightManager.add({ name: nextLightName() });
        selectLight(nl.id);
        if (currentTab === 'light') renderTab();
        feedback('Luz adicionada: ' + nl.name);
        return nl;
    }
    function removeSelectedLight() {
        var l = scene.lightManager.get ? scene.lightManager.get(selectedLightId) : null;
        if (!l) { feedback('Nenhuma luz selecionada', true); return; }
        deletedLights.push({ name:l.name, color:l.color, intensity:l.intensity, azimuth:l.azimuth, elevation:l.elevation, enabled:l.enabled });
        var wasId = l.id;
        scene.lightManager.remove(wasId);
        if (selectedLightId === wasId) selectLight(scene.lightManager.lights.length ? scene.lightManager.lights[0].id : null);
        if (currentTab === 'light') renderTab();
        feedback('Luz removida (Ctrl+Shift+Z desfaz)');
    }
    function undoLight() {
        if (!deletedLights.length) { feedback('Nada para desfazer', true); return; }
        var d = deletedLights.pop();
        var nl = scene.lightManager.add(d);
        selectLight(nl.id);
        if (currentTab === 'light') renderTab();
        feedback('Luz restaurada: ' + (d.name||''));
    }

    document.addEventListener('DOMContentLoaded', function () {
        try { var cfg = LightRefStorage.readConfig(); if (cfg.exportMode) exportMode = cfg.exportMode; } catch (e) {}
        fillModelSelect();
        fillAddTypeSelect();
        fillMaterialSelect();
        initScene();
        bindMiddleBar();
        bindViewTools();
        bindTabs();
        bindPages();
        bindDialog();
        bindMaterialPopover();
        setupUpdates();
        bindLightKeys();
        bindCompKeys();
        if (scene.onTransformChanged) scene.onTransformChanged(function () { if (currentTab === 'pos') renderTab(); if (currentTab !== 'comp') saveModelXform(); });
        if (scene.onXform) scene.onXform(function (phase, info) {
            if (phase === 'start') { var t = info==='move'?'Mover':(info==='scale'?'Escala':'Rotacao'); feedback(t + ': mova o mouse, clique confirma, Esc cancela'); }
            else if (phase === 'axis') { feedback('Eixo: ' + (info ? info.toUpperCase() : 'livre')); }
            else if (phase === 'confirm') { feedback('Transformacao aplicada'); if (currentTab === 'comp') renderTab(); else if (currentTab === 'pos') { saveModelXform(); renderTab(); } }
            else if (phase === 'cancel') { feedback('Cancelado'); }
            else if (phase === 'none') { feedback('Selecione um objeto na lista', true); }
        });
        if (scene.onLightShortcut) scene.onLightShortcut(function (phase, light) {
            if (phase === 'drag' && currentTab === 'light' && light) {
                if (selectedLightId === light.id) {
                    var az = document.getElementById('sl-azimuth'), el = document.getElementById('sl-elevation');
                    if (az) { az.value = light.azimuth; updateRangeFill(az); var ao = document.getElementById('sl-azimuth-o'); if (ao) ao.textContent = light.azimuth + '\u00b0'; }
                    if (el) { el.value = light.elevation; updateRangeFill(el); var eo = document.getElementById('sl-elevation-o'); if (eo) eo.textContent = light.elevation + '\u00b0'; }
                    var it = document.getElementById('sl-intensity');
                    if (it) { it.value = light.intensity; updateRangeFill(it); var io = document.getElementById('sl-intensity-o'); if (io) io.textContent = light.intensity; }
                    var lc = document.getElementById('l-color');
                    if (lc) lc.value = light.color;
                    var dot = document.querySelector('.lr04-lightchips [data-light="'+light.id+'"] .lr04-dot'); if (dot) dot.style.background = light.color;
                }
            }
            if (phase === 'end' && currentTab === 'light') renderTab();
        });
        setActiveTab('light');
        refreshIcons();
        renderTab();
    });

    // Elemento onde as classes de estado (reference/collapsed) sao aplicadas.
    // O CSS usa "#lr04 .lr04-reference ..." entao a classe fica na .lr04-window.
    function stateHost() { return $('#lr04 .lr04-window'); }

    function fillModelSelect() {
        var sel = $('#model-select'); if (!sel) return; sel.innerHTML = '';
        var cats = [];
        MODELS.forEach(function (m) { var c = m.cat || 'Outros'; if (cats.indexOf(c) < 0) cats.push(c); });
        cats.forEach(function (c) {
            var g = document.createElement('optgroup'); g.label = c;
            MODELS.forEach(function (m) { if ((m.cat||'Outros') === c) { var o = document.createElement('option'); o.value = m.v; o.textContent = m.t; g.appendChild(o); } });
            sel.appendChild(g);
        });
        if (typeof SHAPES !== 'undefined' && SHAPES.length) {
            var gs = document.createElement('optgroup'); gs.label = 'Formas basicas';
            SHAPES.forEach(function (s) { var o = document.createElement('option'); o.value = s.v; o.textContent = s.t; gs.appendChild(o); });
            sel.appendChild(gs);
        }
    }
    // Preenche o select .lr04-addtype (aba Composicao) com formas + modelos.
    function fillAddTypeSelect() {
        var sel = $('.lr04-addtype'); if (!sel) return; sel.innerHTML = '';
        var gs = document.createElement('optgroup'); gs.label = 'Formas basicas';
        SHAPES.forEach(function (s) { var o = document.createElement('option'); o.value = s.v; o.textContent = s.t; gs.appendChild(o); });
        sel.appendChild(gs);
        var gm = document.createElement('optgroup'); gm.label = 'Modelos';
        MODELS.forEach(function (m) { var o = document.createElement('option'); o.value = m.v; o.textContent = m.t; gm.appendChild(o); });
        sel.appendChild(gm);
    }
    // Preenche o select de material do popover do visor.
    function fillMaterialSelect() {
        var sel = $('.lr04-material select[data-setting="material"]'); if (!sel) return; sel.innerHTML = '';
        MATERIALS.forEach(function (m) { var o = document.createElement('option'); o.value = m.v; o.textContent = m.t; sel.appendChild(o); });
    }

    function initScene() {
        scene = new LightRefScene($('#gl-canvas'));
        scene.init();
        setTimeout(function () { scene.engine.resize(); }, 60);
        // O visor muda de altura quando o inspector troca de aba: mantem o render nitido.
        if (window.ResizeObserver) { var vpEl = $('.lr04-viewport'); if (vpEl) new ResizeObserver(function () { if (scene && scene.engine) scene.engine.resize(); }).observe(vpEl); }
        var cfg = {}; try { cfg = LightRefStorage.readConfig(); } catch (e) {}
        if (cfg.material) scene.setMaterial(cfg.material);
        if (cfg.environment && scene.setEnvironment) scene.setEnvironment(cfg.environment);
        if (cfg.bg && scene.setBackground) { scene.setBackground(cfg.bg.transparent ? 'transparent' : 'color', cfg.bg.color || '#3a4a6a'); var vp0 = $('.lr04-viewport'); if (vp0) vp0.classList.toggle('transparent', !!cfg.bg.transparent); }
        loadModelSafe(MODELS[0].v);   // sempre abre no Asaro (modelo padrao)
        var l = scene.lightManager.add({ name: nextLightName() });
        selectLight(l.id);
        syncMaterialPopover();
        // Comeca na aba Luz: composicao oculta, modelo principal visivel.
        if (scene.setCompositionVisible) scene.setCompositionVisible(false);
        if (scene.setMainModelVisible) scene.setMainModelVisible(true);
    }

    function loadModelSafe(url) {
        loadModel(url, null, function () {
            if (url !== MODELS[0].v) { loadModel(MODELS[0].v); }
        });
    }
    // Token de carregamento: descarta resultados de loads antigos e evita corrida
    // quando o usuario troca de modelo antes do anterior terminar.
    var loadToken = 0, loadingNow = false;
    function loadModel(url, done, onFail) {
        var myToken = ++loadToken;
        loadingNow = true;
        showLoading(true);
        var pct = $('#loading-pct'); if (pct) pct.textContent = 'carregando...';
        scene.loadOBJ(url, function (p) { if (myToken !== loadToken) return; var el = $('#loading-pct'); if (el) el.textContent = p + '%'; },
        function (err) {
            // Se um load mais novo comecou, ignora este resultado (obsoleto).
            if (myToken !== loadToken) { return; }
            loadingNow = false;
            showLoading(false);
            if (err) { feedback('Falha ao carregar', true); if (onFail) onFail(err); return; }
            currentModelUrl = url;
            // Restaura ajustes salvos deste modelo; se nao houver, usa o yaw padrao.
            if (!restoreModelXform(url)) { var y = modelYaw(url); if (y && scene.setModelRotation) scene.setModelRotation(y, 0); }
            if (currentTab === 'pos') renderTab();
            // Modelos padrao tem thumb fixa (models/thumbs/*.png). So geramos
            // thumb sob demanda para modelos IMPORTADOS pelo usuario.
            var isDefault = /(^|\/)models\//.test(url) && !/importados|imported|Meus/.test(url);
            if (!isDefault) {
                setTimeout(function () {
                    if (myToken !== loadToken) return;
                    try {
                        var cfg = LightRefStorage.readConfig();
                        cfg.modelThumbs = cfg.modelThumbs || {};
                        if (!cfg.modelThumbs[url]) {
                            var thumb = scene.frontThumbnailDataURL ? scene.frontThumbnailDataURL() : scene.thumbnailDataURL();
                            cfg.modelThumbs[url] = thumb;
                            LightRefStorage.writeConfig({ modelThumbs: cfg.modelThumbs });
                        }
                    } catch (e) {}
                }, 400);
            }
            if (done) done();
        });
    }
    function showLoading(on) { var o = $('#loading-overlay'); if (o) o.style.display = on ? 'flex' : 'none'; if (on) { var p = $('#loading-pct'); if (p) p.textContent = '0%'; } }

    // Feedback: escreve na .lr04-notice do mockup (auto-esconde quando vazio).
    function feedback(msg, err) {
        var f = $('.lr04-notice'); if (!f) return;
        f.textContent = msg; f.style.color = err ? '#ff6a6a' : '#8fd39a';
        clearTimeout(feedback._t);
        feedback._t = setTimeout(function(){ f.textContent = ''; f.style.color=''; }, 3500);
    }
    function footerLabel() { var v = (window.LightRefUpdate && window.LightRefUpdate.VERSION) ? window.LightRefUpdate.VERSION : '0.4'; return 'LightRef v' + v; }
    window.LightRefToast = function (msg) { feedback(msg, false); };
    function setupUpdates() {
        // A marca no rodape serve de botao de verificacao manual de update.
        var brand = $('.lr04-brand');
        if (brand) {
            brand.textContent = 'LightRef';
            brand.style.cursor = 'pointer';
            brand.title = footerLabel() + ' - clique para verificar atualizacoes';
            brand.addEventListener('click', function () {
                if (window.LightRefUpdate) { feedback('Verificando atualizacoes...', false); window.LightRefUpdate.check(true); }
            });
        }
        setTimeout(function () { if (window.LightRefUpdate) window.LightRefUpdate.check(false); }, 1500);
    }

    // ---------- Barra do meio (modelo + projecao + acoes de arquivo/export) ----------
    function bindMiddleBar() {
        var ms = $('#model-select');
        if (ms) ms.addEventListener('change', function () {
            loadModel(this.value); try { LightRefStorage.writeConfig({ lastModel: this.value }); } catch (e) {}
        });
        $all('.lr04-projection button[data-projection]').forEach(function (b) {
            b.addEventListener('click', function () {
                $all('.lr04-projection button[data-projection]').forEach(function (x){ x.setAttribute('aria-pressed','false'); });
                this.setAttribute('aria-pressed','true');
                scene.setProjection(this.getAttribute('data-projection') === 'ortho' ? 'ortho' : 'persp');
            });
        });
        bindAction('save', saveScenePrompt);
        bindAction('import', function () { var fi = $('#file-input'); fi.setAttribute('data-import','1'); fi.click(); });
        bindAction('reset', function () { scene.setCameraPreset('front'); });
        bindAction('export', openExportMenu);
        $('#file-input').addEventListener('change', onFilePicked);
    }
    function onFilePicked() {
        var inp = $('#file-input'); if (!inp.files || !inp.files.length) return;
        var file = inp.files[0], isImport = inp.getAttribute('data-import') === '1';
        inp.removeAttribute('data-import');
        if (isImport && file.path) {
            try {
                var rec = LightRefStorage.importModel(file.path, file.name.replace(/\.[^.]+$/, ''));
                // Se o "+" foi clicado numa gaveta de categoria valida (diferente
                // de 'Outros'), associa o modelo importado a essa categoria. (Req 3.5)
                var target = pendingImportCat; pendingImportCat = null;
                if (target && target !== CAT_OUTROS) {
                    var cfg = {}; try { cfg = LightRefStorage.readConfig() || {}; } catch (e2) { cfg = {}; }
                    if (categoryExists(target, cfg)) {
                        try { LightRefStorage.setModelCategoryOverride('my:' + rec.id, target); } catch (e3) {}
                    }
                }
                loadModel(LightRefStorage.modelFileURL(rec));
                feedback('Modelo importado');
                // Re-renderiza a Biblioteca se ela estiver aberta, para mostrar o novo card.
                if (currentPage === 'library') renderCatalog('library');
            } catch (e) { pendingImportCat = null; feedback('Falha ao importar', true); }
        } else {
            var url = file.path ? ('file:///' + file.path.replace(/\\/g,'/')) : URL.createObjectURL(file);
            loadModel(url);
        }
        inp.value = '';
    }

    // ---------- Ferramentas do visor + filtros ----------
    var floorOn = true, guidesOn = true, refOn = false;
    function bindViewTools() {
        bindAction('reset-view', function () { scene.setCameraPreset('front'); });
        bindToggle('floor', function (b) { floorOn = !floorOn; scene.setGroundVisible(floorOn); b.setAttribute('aria-pressed', floorOn); });
        bindToggle('guides', function (b) { guidesOn = !guidesOn; scene.lightManager.setHelpersVisible(guidesOn); b.setAttribute('aria-pressed', guidesOn); });
        bindToggle('reference', function (b) { refOn = !refOn; stateHost().classList.toggle('lr04-reference', refOn); b.setAttribute('aria-pressed', refOn); setTimeout(function(){ scene.engine.resize(); }, 80); });
        bindAction('collapse', function () { stateHost().classList.toggle('lr04-collapsed'); setTimeout(function(){ scene.engine.resize(); }, 120); });
        bindViewFxToggles();
    }
    function bindAction(name, fn) {
        $all('[data-action="' + name + '"]').forEach(function (b) { b.addEventListener('click', function () { fn(b); }); });
    }
    function bindToggle(name, fn) {
        $all('[data-toggle="' + name + '"]').forEach(function (b) { b.addEventListener('click', function () { fn(b); }); });
    }
    // Filtros rapidos: posterizar/cutout (com quickslider) e P&B (gray).
    function bindViewFxToggles() {
        function syncBtn(name, on) { var b = document.querySelector('[data-toggle="'+name+'"]'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
        var pf = scene.postfx.getParams();
        syncBtn('poster', !!pf.posterizeOn); syncBtn('cutout', !!pf.cutoutOn); syncBtn('gray', !!pf.blackWhite);
        // Mostra/esconde o quickslider conforme o filtro esta ligado.
        function showQuick(filter, on) {
            var q = document.querySelector('.lr04-quickslider[data-filter-controls="'+filter+'"]');
            if (q) { if (on) q.removeAttribute('hidden'); else q.setAttribute('hidden',''); }
        }
        showQuick('poster', !!pf.posterizeOn); showQuick('cutout', !!pf.cutoutOn);

        bindToggle('poster', function (b) { var on = scene.postfx.getParams().posterizeOn ? 0 : 1; scene.postfx.setParam('posterizeOn', on); syncBtn('poster', on); showQuick('poster', on); if (currentTab==='adjust') renderTab(); });
        bindToggle('cutout', function (b) { var on = scene.postfx.getParams().cutoutOn ? 0 : 1; scene.postfx.setParam('cutoutOn', on); syncBtn('cutout', on); showQuick('cutout', on); if (currentTab==='adjust') renderTab(); });
        bindToggle('gray', function (b) { var on = scene.postfx.getParams().blackWhite ? 0 : 1; scene.postfx.setParam('blackWhite', on); syncBtn('gray', on); if (currentTab==='adjust') renderTab(); });

        // Sliders dos quickslider (data-key=levels/steps).
        var sp = document.querySelector('.lr04-quickslider[data-filter-controls="poster"] input[data-key="levels"]');
        if (sp) { sp.value = pf.posterizeLevels; updateRangeFill(sp); var spo = sp.parentNode.querySelector('output'); if (spo) spo.textContent = pf.posterizeLevels; sp.addEventListener('input', function () { updateRangeFill(sp); scene.postfx.setParam('posterizeLevels', parseInt(this.value,10)); var o=this.parentNode.querySelector('output'); if(o)o.textContent=this.value; if (currentTab==='adjust') syncAdjustSliders(); }); }
        var sc = document.querySelector('.lr04-quickslider[data-filter-controls="cutout"] input[data-key="steps"]');
        if (sc) { sc.value = pf.cutoutLevels; updateRangeFill(sc); var sco = sc.parentNode.querySelector('output'); if (sco) sco.textContent = pf.cutoutLevels; sc.addEventListener('input', function () { updateRangeFill(sc); scene.postfx.setParam('cutoutLevels', parseInt(this.value,10)); var o=this.parentNode.querySelector('output'); if(o)o.textContent=this.value; if (currentTab==='adjust') syncAdjustSliders(); }); }
    }
    function syncAdjustSliders() {
        // Mantem os sliders da aba Ajustes coerentes com os quicksliders.
        var p = scene.postfx.getParams();
        var pl = document.getElementById('sl-posterize'); if (pl) { pl.value = p.posterizeLevels; updateRangeFill(pl); var plo = document.getElementById('sl-posterize-o'); if (plo) plo.textContent = p.posterizeLevels; }
        var cl = document.getElementById('sl-cutout'); if (cl) { cl.value = p.cutoutLevels; updateRangeFill(cl); var clo = document.getElementById('sl-cutout-o'); if (clo) clo.textContent = p.cutoutLevels; }
    }

    // ---------- Material popover ----------
    function bindMaterialPopover() {
        var toggle = $('[data-toggle="materialOpen"]');
        var pop = $('.lr04-material');
        if (toggle && pop) {
            toggle.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = pop.hasAttribute('hidden');
                if (open) pop.removeAttribute('hidden'); else pop.setAttribute('hidden','');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                toggle.setAttribute('aria-pressed', open ? 'true' : 'false');
                var vp = $('.lr04-viewport'); if (vp) vp.classList.toggle('lr04-matopen', open);
            });
            document.addEventListener('click', function (e) {
                if (!pop.hasAttribute('hidden') && !pop.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
                    pop.setAttribute('hidden',''); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-pressed','false'); var vp2 = $('.lr04-viewport'); if (vp2) vp2.classList.remove('lr04-matopen');
                }
            });
        }
        var msel = $('.lr04-material select[data-setting="material"]');
        if (msel) msel.addEventListener('change', function () {
            scene.setMaterial(this.value);
            try { LightRefStorage.writeConfig({ material:this.value }); } catch (e) {}
            renderMaterialFields();
            feedback('Material: ' + this.options[this.selectedIndex].text);
        });
        var fc = $('.lr04-material input[data-setting="formColor"]');
        if (fc) fc.addEventListener('input', function () { scene.setFormColor(this.value); });
        var sca = $('.lr04-material input[data-setting="scatter"]');
        if (sca) sca.addEventListener('input', function () { scene.setMaterialParam('scatter', this.value); });
        // Fundo: cor solida ou transparente (xadrez).
        var bgc = $('#bg-color'), bgt = $('#bg-transp');
        var bgSaveTimer = null;
        function applyBg() {
            // Aplica a cor IMEDIATAMENTE (barato). A escrita em disco e cara e
            // travava o color picker quando disparada a cada pixel; por isso e
            // adiada (debounce) para 300 ms apos o usuario parar de mexer.
            var tr = bgt && bgt.checked;
            scene.setBackground(tr ? 'transparent' : 'color', bgc ? bgc.value : '#3a4a6a');
            var vp = $('.lr04-viewport'); if (vp) vp.classList.toggle('transparent', !!tr);
            if (bgSaveTimer) clearTimeout(bgSaveTimer);
            bgSaveTimer = setTimeout(function () {
                bgSaveTimer = null;
                try { LightRefStorage.writeConfig({ bg: { transparent: !!tr, color: bgc ? bgc.value : '#3a4a6a' } }); } catch (e) {}
            }, 300);
        }
        if (bgc) bgc.addEventListener('input', applyBg);
        if (bgt) bgt.addEventListener('change', applyBg);
        renderMaterialFields();
    }
    function syncMaterialPopover() {
        var msel = $('.lr04-material select[data-setting="material"]'); if (msel && scene.getMaterial) msel.value = scene.getMaterial();
        var fc = $('.lr04-material input[data-setting="formColor"]'); if (fc && scene.getFormColor) fc.value = scene.getFormColor();
        var p = scene.getMaterialParams ? scene.getMaterialParams() : {};
        var sca = $('.lr04-material input[data-setting="scatter"]'); if (sca && p.scatter) sca.value = p.scatter;
        try { var bg = scene.getBackground ? scene.getBackground() : null; if (bg) { var bt=$('#bg-transp'), bcc=$('#bg-color'); if (bt) bt.checked = !!bg.transparent; if (bcc && bg.color) bcc.value = bg.color; var vp2=$('.lr04-viewport'); if (vp2) vp2.classList.toggle('transparent', !!bg.transparent); } } catch (e) {}
    }
    // Preenche .lr04-material-fields com os sliders PBR (ids sl-* usados em onRange).
    function renderMaterialFields() {
        var host = $('.lr04-material-fields'); if (!host) return;
        var p = scene.getMaterialParams ? scene.getMaterialParams() : {};
        host.innerHTML =
            row('Rugosidade','sl-roughness',0,1,0.01, fx2(p.roughness), '') +
            row('Metalico','sl-metalness',0,1,0.01, fx2(p.metalness), '') +
            row('Especular','sl-specular',0,1,0.01, fx2(p.specular), '') +
            row('Reflexo','sl-reflection',0,2,0.02, fx2(p.reflection), '') +
            row('Subsurface','sl-subsurface',0,1,0.01, fx2(p.subsurface), '');
        wireRanges(host);
        syncMaterialPopover();
    }

    // ---------- Abas ----------
    function setActiveTab(tab) {
        currentTab = tab;
        var dom = domFromTab(tab);
        $all('.lr04-tabs button').forEach(function (x){ x.setAttribute('aria-pressed', String(x.getAttribute('data-tab') === dom)); });
        // Mostra a section do pane ativo, esconde as demais.
        $all('.lr04-inspector section[data-pane]').forEach(function (p) { p.hidden = (p.getAttribute('data-pane') !== paneName(tab)); });
    }
    function bindTabs() {
        $all('.lr04-tabs button').forEach(function (b) {
            b.addEventListener('click', function () {
                var prev = currentTab;
                var next = tabFromDom(this.getAttribute('data-tab'));
                setActiveTab(next);
                // Como no mockup: clicar numa aba reabre o inspector se estava recolhido.
                var hostWin = stateHost(); if (hostWin && hostWin.classList.contains('lr04-collapsed')) { hostWin.classList.remove('lr04-collapsed'); setTimeout(function(){ scene.engine.resize(); }, 60); }
                var gizTabs = { pos:1, comp:1 };
                if (gizTabs[prev] && !gizTabs[next] && scene.setGizmoMode) scene.setGizmoMode('off');
                // Composicao e uma cena separada: mostra so os objetos da composicao
                // quando na aba Composicao; fora dela, mostra so o modelo principal.
                if (scene.setMainModelVisible) scene.setMainModelVisible(next !== 'comp');
                if (scene.setCompositionVisible) scene.setCompositionVisible(next === 'comp');
                if (next !== 'comp' && scene.selectSceneObject) scene.selectSceneObject(null);
                renderTab();
            });
        });
    }

    // Renderiza o conteudo da aba atual nos subcontainers ja presentes no HTML.
    function renderTab() {
        if (currentTab === 'light') renderLight();
        else if (currentTab === 'lens') renderLens();
        else if (currentTab === 'adjust') renderAdjust();
        else if (currentTab === 'pos') renderPos();
        else if (currentTab === 'comp') renderComposition();
    }

    // ---------- Templates de rows ----------
    function row(label, id, min, max, step, val, suffix) {
        return '<div class="lr04-row"><span>' + label + '</span>' +
               '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
               '<output id="' + id + '-o">' + val + (suffix||'') + '</output></div>';
    }
    function fx2(v) { return (v == null ? 0 : v).toFixed ? (+v).toFixed(2) : v; }

    // Liga os sliders (range) de um container: fill + output + onRange.
    function wireRanges(host) {
        $all('input[type=range]', host).forEach(function (r) {
            updateRangeFill(r);
            r.addEventListener('input', function () {
                updateRangeFill(r);
                onRange(r.id, r.value);
                var o = document.getElementById(r.id + '-o');
                if (o) o.textContent = r.value + (r.id==='sl-focal'?'mm':(r.id==='sl-azimuth'||r.id==='sl-elevation'||r.id==='sl-yaw'||r.id==='sl-roll'?'\u00b0':''));
            });
        });
    }

    // ---------- Aba Luz ----------
    function renderLight() {
        var chipsHost = $('.lr04-lightchips'); if (!chipsHost) return;
        var chips = scene.lightManager.lights.map(function (l) {
            return '<div class="lr04-chip'+(l.id===selectedLightId?' active':'')+'" data-id="'+l.id+'">' +
                   '<button data-light="'+l.id+'"><span class="lr04-dot" style="background:'+l.color+'"></span>'+l.name+'</button>' +
                   '<button data-remove="'+l.id+'" title="Remover"><i data-lucide="x" aria-hidden="true"></i></button></div>';
        }).join('');
        chipsHost.innerHTML = chips + '<button id="add-light" class="lr04-addlight" title="Adicionar luz"><i data-lucide="plus" aria-hidden="true"></i></button>';

        var fieldsHost = $('.lr04-lightfields'); if (fieldsHost) {
            var l = selectedLightId != null ? scene.lightManager.get(selectedLightId) : null;
            if (l) {
                fieldsHost.innerHTML =
                    row('Intensidade','sl-intensity',0,10,0.1, l.intensity, '') +
                    row('Girar','sl-azimuth',0,360,1, l.azimuth, '\u00b0') +
                    row('Altura','sl-elevation',-90,90,1, l.elevation, '\u00b0');
                wireRanges(fieldsHost);
            } else {
                fieldsHost.innerHTML = '';
            }
        }
        // Cor da luz: o input color fixo do HTML (id l-color).
        var lc = $('#l-color');
        var lsel = selectedLightId != null ? scene.lightManager.get(selectedLightId) : null;
        if (lc && lsel) {
            lc.value = lsel.color;
            lc.onchange = null;
            lc.oninput = function () { scene.lightManager.update(selectedLightId,'color',this.value); var dot = document.querySelector('.lr04-lightchips [data-light="'+selectedLightId+'"] .lr04-dot'); if (dot) dot.style.background = this.value; };
        }
        // Chips: selecionar / remover / adicionar.
        var add = $('#add-light'); if (add) add.onclick = function () { addLight(); };
        $all('.lr04-lightchips [data-light]').forEach(function (b) { b.onclick = function () { selectLight(parseInt(this.getAttribute('data-light'),10)); renderTab(); }; });
        $all('.lr04-lightchips [data-remove]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var id = parseInt(this.getAttribute('data-remove'),10); selectLight(id); removeSelectedLight(); }; });
        refreshIcons();
    }

    // ---------- Aba Lente ----------
    function renderLens() {
        var host = $('.lr04-lensfields'); if (!host) return;
        var f = scene.getFocalLength();
        host.innerHTML = row('Lente','sl-focal',10,300,1, f, 'mm');
        wireRanges(host);
        // Enquadramento (botoes data-view). setCameraPreset existe; presets 3/4,
        // perfil e topo ainda nao existem no motor, entao caem no 'front'.
        $all('.lr04-views button[data-view]').forEach(function (b) {
            b.onclick = function () {
                var v = this.getAttribute('data-view');
                var map = { front:'front', three:'threeq', profile:'side', top:'top' };
                scene.setCameraPreset(map[v] || 'front');
            };
        });
        // Botao "Resetar camera" tambem reseta a visao.
        // (data-action="reset-view" ja tratado em bindViewTools.)
        // Secao Ambiente / HDR recolhivel, inserida na coluna direita da lente.
        renderEnvSection();
    }
    // Secao Ambiente / HDR: reaproveita ENVIRONMENTS e setEnvironment/setEnvIntensity.
    function renderEnvSection() {
        var wrap = $('.lr04-envwrap'); if (!wrap) return;
        var curEnv = scene.getEnvironment ? (scene.getEnvironment()||'') : '';
        var envOpts = ENVIRONMENTS.map(function (e) {
            var sel = (e.v && curEnv.indexOf(e.v) >= 0) || (!e.v && !curEnv);
            return '<option value="'+e.v+'"'+(sel?' selected':'')+'>'+e.t+'</option>';
        }).join('');
        var ei = scene.getEnvIntensity ? scene.getEnvIntensity() : 0.8;
        wrap.innerHTML =
            '<button type="button" class="lr04-widebutton" id="env-drawer-head" aria-expanded="false">Ambiente / HDR</button>' +
            '<div id="env-drawer-body" hidden style="margin-top:8px">' +
            '<div class="lr04-row"><span>Mapa</span><select id="env-select" style="grid-column:2 / span 2">'+envOpts+'</select></div>' +
            row('Intensidade','sl-envint',0,2,0.05, (ei).toFixed(2), '') +
            '<label class="lr04-check"><input type="checkbox" id="ck-envbg" checked>Mostrar fundo do HDR</label>' +
            '</div>';
        var head = $('#env-drawer-head'), body = $('#env-drawer-body');
        if (head && body) head.onclick = function () {
            var open = body.hasAttribute('hidden');
            if (open) body.removeAttribute('hidden'); else body.setAttribute('hidden','');
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        var es = $('#env-select'); if (es) es.onchange = function () {
            var v = this.value;
            if (scene.setEnvironment) scene.setEnvironment(v || null, { showBackground: ($('#ck-envbg')||{}).checked !== false });
            try { LightRefStorage.writeConfig({ environment: v }); } catch (e) {}
        };
        var ceb = $('#ck-envbg'); if (ceb) ceb.onchange = function () { if (scene.setEnvBackgroundVisible) scene.setEnvBackgroundVisible(this.checked); };
        wireRanges(body);
    }

    // ---------- Aba Ajustes ----------
    function renderAdjust() {
        var tonal = $('.lr04-tonalfields');
        var p = scene.postfx.getParams();
        if (tonal) {
            tonal.innerHTML =
                row('Exposicao','sl-exposure',-3,3,0.05, fx2(p.exposure), '') +
                row('Contraste','sl-contrast',-1,1,0.02, fx2(p.contrast), '') +
                row('Temperatura','sl-temperature',-1,1,0.02, fx2(p.temperature), '') +
                row('Saturacao','sl-saturation',0,2,0.02, fx2(p.saturation), '');
            wireRanges(tonal);
        }
        // Niveis (posterizar) e Degraus (cutout) nos campos dedicados.
        var lv = $('.lr04-levelsfield'); if (lv) { lv.innerHTML = row('Niveis','sl-posterize',2,16,1, p.posterizeLevels, ''); wireRanges(lv); }
        var st = $('.lr04-stepsfield'); if (st) { st.innerHTML = row('Degraus','sl-cutout',2,8,1, p.cutoutLevels, ''); wireRanges(st); }
        // Checkboxes fixos do HTML.
        var cp = $('.lr04-inspector input[data-setting="poster"]'); if (cp) { cp.checked = !!p.posterizeOn; cp.onchange = function(){ scene.postfx.setParam('posterizeOn', this.checked?1:0); syncFilterButtons(); }; }
        var cc = $('.lr04-inspector input[data-setting="cutout"]'); if (cc) { cc.checked = !!p.cutoutOn; cc.onchange = function(){ scene.postfx.setParam('cutoutOn', this.checked?1:0); syncFilterButtons(); }; }
        var cg = $('.lr04-inspector input[data-setting="gray"]'); if (cg) { cg.checked = !!p.blackWhite; cg.onchange = function(){ scene.postfx.setParam('blackWhite', this.checked?1:0); syncFilterButtons(); }; }
        bindAction('reset-adjust', function () { scene.postfx.reset(); renderTab(); syncFilterButtons(); });
    }
    // Reflete o estado dos filtros nos botoes do visor + quicksliders.
    function syncFilterButtons() {
        var p = scene.postfx.getParams();
        function sb(name, on) { var b = document.querySelector('[data-toggle="'+name+'"]'); if (b) b.setAttribute('aria-pressed', on?'true':'false'); }
        function sq(filter, on) { var q = document.querySelector('.lr04-quickslider[data-filter-controls="'+filter+'"]'); if (q) { if (on) q.removeAttribute('hidden'); else q.setAttribute('hidden',''); } }
        sb('poster', !!p.posterizeOn); sb('cutout', !!p.cutoutOn); sb('gray', !!p.blackWhite);
        sq('poster', !!p.posterizeOn); sq('cutout', !!p.cutoutOn);
    }

    // ---------- Aba Posicao ----------
    function renderPos() {
        var left = $('.lr04-positionleft');
        var right = $('.lr04-positionright');
        var off = scene.getModelOffset ? scene.getModelOffset() : {x:0,y:0,z:0};
        var sc = scene.getModelScaleMult ? scene.getModelScaleMult() : 1;
        var roll = scene.getModelRoll ? scene.getModelRoll() : 0;
        var rot = scene.getModelRotation ? scene.getModelRotation() : {yaw:0};
        var gm = scene.getGizmoMode ? scene.getGizmoMode() : 'off';
        if (left) {
            left.innerHTML =
                row('Girar Y','sl-yaw',-180,180,1, rot.yaw||0, '\u00b0') +
                row('Inclinar X','sl-pitch',-180,180,1, rot.pitch||0, '\u00b0') +
                row('Altura','sl-offy',-3,3,0.02, fx2(off.y), '') +
                row('Horizontal','sl-offx',-3,3,0.02, fx2(off.x), '');
            wireRanges(left);
        }
        if (right) {
            right.innerHTML =
                row('Profundidade','sl-offz',-3,3,0.02, fx2(off.z), '') +
                row('Escala','sl-mscale',0.2,3,0.02, fx2(sc), 'x') +
                row('Inclinar Z','sl-roll',-180,180,1, roll, '\u00b0') +
                '<button id="save-position" class="lr04-widebutton">Salvar posicao do modelo</button>' +
                '<button id="reset-transform" class="lr04-widebutton">Centralizar / resetar</button>' +
                '<div class="lr04-hint" style="font-size:10px;color:#8f9198;margin-top:8px;line-height:1.5">Atalhos: G mover, S escala, R rotacao (RR livre). X/Y/Z travam eixo, clique confirma, Esc cancela.</div>';
            wireRanges(right);
            var rt = $('#reset-transform');
            if (rt) rt.onclick = function () {
                scene.setModelOffset('x',0); scene.setModelOffset('y',0); scene.setModelOffset('z',0);
                scene.setModelScaleMult(1); scene.setModelRoll(0); scene.setModelRotation(0, 0);
                saveModelXform();
                renderTab();
            };
            var sp = $('#save-position');
            if (sp) sp.onclick = function () {
                saveModelXform();
                feedback('Salvando...');
                // Miniatura PADRONIZADA (igual as geradas): assincrona.
                var savedUrl = currentModelUrl;
                function useThumb(thumb) {
                    try {
                        if (savedUrl && thumb) {
                            var cfg = LightRefStorage.readConfig(); cfg.modelThumbs = cfg.modelThumbs || {};
                            cfg.modelThumbs[savedUrl] = thumb;
                            LightRefStorage.writeConfig({ modelThumbs: cfg.modelThumbs });
                        }
                    } catch (e) {}
                    feedback('Posicao e miniatura salvas');
                }
                if (scene.standardThumbnail) scene.standardThumbnail(useThumb);
                else useThumb(scene.thumbnailDataURL ? scene.thumbnailDataURL() : null);
            };
        }
        // Gizmo do pane Posicao (atua no modelo principal).
        $all('#lr04-pane-position [data-gizmo]').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-gizmo') === gm));
            b.onclick = function () {
                var m = this.getAttribute('data-gizmo');
                scene.selectSceneObject(null);
                scene.setGizmoMode(m);
                $all('#lr04-pane-position [data-gizmo]').forEach(function(x){ x.setAttribute('aria-pressed', String(x.getAttribute('data-gizmo')===m)); });
            };
        });
    }

    // ---------- Aba Composicao ----------
    function renderComposition() {
        var listHost = $('.lr04-objectlist');
        var countHost = $('.lr04-objectcount');
        var objs = (scene.listSceneObjects ? scene.listSceneObjects() : []);
        var sel = scene._selectedObj;
        var gm = (scene.getGizmoMode ? scene.getGizmoMode() : 'off');
        function nmeOf(url){ var all=SHAPES.concat(MODELS); for(var i=0;i<all.length;i++) if(all[i].v===url) return all[i].t; return 'Objeto'; }
        if (countHost) countHost.textContent = 'Objetos na cena (' + objs.length + ')';
        if (listHost) {
            if (!objs.length) {
                listHost.innerHTML = '';
            } else {
                var h = '';
                for (var i=0;i<objs.length;i++) {
                    var o = objs[i];
                    var vis = scene.isSceneObjectVisible ? scene.isSceneObjectVisible(o.id) : true;
                    var active = (o.id === sel) ? ' selected' : '';
                    h += '<div class="lr04-objectrow'+active+'">';
                    h += '<button data-vis-object="'+o.id+'" aria-pressed="'+vis+'" title="'+(vis?'Ocultar':'Mostrar')+'"><i data-lucide="'+(vis?'eye':'eye-off')+'" aria-hidden="true"></i></button>';
                    h += '<button data-select-object="'+o.id+'" aria-pressed="'+(o.id===sel)+'">'+nmeOf(o.url)+'</button>';
                    h += '<button data-del-object="'+o.id+'" title="Remover"><i data-lucide="x" aria-hidden="true"></i></button>';
                    h += '</div>';
                }
                listHost.innerHTML = h;
                refreshIcons();
            }
            $all('.lr04-objectlist [data-select-object]').forEach(function (b) { b.onclick = function () { scene.selectSceneObject(parseInt(this.getAttribute('data-select-object'),10)); renderTab(); }; });
            $all('.lr04-objectlist [data-del-object]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); scene.removeSceneObject(parseInt(this.getAttribute('data-del-object'),10)); renderTab(); }; });
            $all('.lr04-objectlist [data-vis-object]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var id=parseInt(this.getAttribute('data-vis-object'),10); var v = scene.isSceneObjectVisible ? scene.isSceneObjectVisible(id) : true; scene.setSceneObjectVisible(id, !v); renderTab(); }; });
        }
        // Distorcao por eixo (achatar/esticar/alargar) do objeto selecionado.
        var deformHost = document.getElementById('obj-deform');
        if (!deformHost) { var lh = document.querySelector('.lr04-objectlist'); if (lh && lh.parentNode) { deformHost = document.createElement('div'); deformHost.id = 'obj-deform'; lh.parentNode.appendChild(deformHost); } }
        if (deformHost) {
            var selObj = (sel != null && scene.getSceneObject) ? scene.getSceneObject(sel) : null;
            if (!selObj) { deformHost.innerHTML = ''; }
            else {
                var ax = scene.getSceneObjAxisScale ? scene.getSceneObjAxisScale() : {x:1,y:1,z:1};
                deformHost.innerHTML = '<span class="lr04-heading" style="margin-top:12px">Distorcer forma</span>' +
                    row('Largura X','sl-defx',0.2,3,0.02, fx2(ax.x), 'x') +
                    row('Altura Y','sl-defy',0.2,3,0.02, fx2(ax.y), 'x') +
                    row('Profund. Z','sl-defz',0.2,3,0.02, fx2(ax.z), 'x') +
                    '<button id="def-reset" class="lr04-widebutton">Resetar forma</button>';
                wireRanges(deformHost);
                var dr = document.getElementById('def-reset');
                if (dr) dr.onclick = function () { scene.setSceneObjAxisScale('x',1); scene.setSceneObjAxisScale('y',1); scene.setSceneObjAxisScale('z',1); renderTab(); };
            }
        }
        // Adicionar objeto (onclick substitui - nao acumula listener).
        var addBtn = document.querySelector('[data-action="add-object"]');
        if (addBtn) addBtn.onclick = function () {
            var pick = $('.lr04-addtype'); var url = pick ? pick.value : null; if (!url) return;
            addBtn.disabled = true;
            feedback('Adicionando objeto...');
            scene.addSceneObject(url, function (err, id) {
                addBtn.disabled = false;
                if (err) { feedback('Falha ao adicionar', true); return; }
                scene.selectSceneObject(id); renderTab(); feedback('Objeto adicionado');
            });
        };
        // Gizmo do pane Composicao (atua no objeto selecionado).
        $all('#lr04-pane-composition [data-gizmo]').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-gizmo') === gm));
            b.onclick = function () {
                var m = this.getAttribute('data-gizmo'); scene.setGizmoMode(m);
                $all('#lr04-pane-composition [data-gizmo]').forEach(function(x){ x.setAttribute('aria-pressed', String(x.getAttribute('data-gizmo')===m)); });
            };
        });
    }

    function updateRangeFill(r) { var pct = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--fill', pct + '%'); }
    function onRange(id, value) {
        var v = parseFloat(value);
        switch (id) {
            case 'sl-roughness': scene.setMaterialParam('roughness', v); break;
            case 'sl-metalness': scene.setMaterialParam('metalness', v); break;
            case 'sl-specular': scene.setMaterialParam('specular', v); break;
            case 'sl-reflection': scene.setMaterialParam('reflection', v); break;
            case 'sl-subsurface': scene.setMaterialParam('subsurface', v); break;
            case 'sl-intensity': scene.lightManager.update(selectedLightId,'intensity', v); break;
            case 'sl-azimuth': scene.lightManager.update(selectedLightId,'azimuth', parseInt(value,10)); break;
            case 'sl-elevation': scene.lightManager.update(selectedLightId,'elevation', parseInt(value,10)); break;
            case 'sl-focal': scene.setFocalLength(parseInt(value,10)); break;
            case 'sl-envint': if (scene.setEnvIntensity) scene.setEnvIntensity(v); break;
            case 'sl-exposure': scene.postfx.setParam('exposure', v); break;
            case 'sl-contrast': scene.postfx.setParam('contrast', v); break;
            case 'sl-temperature': scene.postfx.setParam('temperature', v); break;
            case 'sl-saturation': scene.postfx.setParam('saturation', v); break;
            case 'sl-posterize': scene.postfx.setParam('posterizeLevels', parseInt(value,10)); syncQuickFromAdjust(); break;
            case 'sl-cutout': scene.postfx.setParam('cutoutLevels', parseInt(value,10)); syncQuickFromAdjust(); break;
            case 'sl-yaw': scene.setModelRotation(parseInt(value,10), scene.getModelRotation().pitch||0); break;
            case 'sl-pitch': scene.setModelRotation(scene.getModelRotation().yaw||0, parseInt(value,10)); break;
            case 'sl-offy': scene.setModelOffset('y', v); break;
            case 'sl-offx': scene.setModelOffset('x', v); break;
            case 'sl-offz': scene.setModelOffset('z', v); break;
            case 'sl-mscale': scene.setModelScaleMult(v); break;
            case 'sl-roll': scene.setModelRoll(parseInt(value,10)); break;
            case 'sl-defx': if (scene.setSceneObjAxisScale) scene.setSceneObjAxisScale('x', v); break;
            case 'sl-defy': if (scene.setSceneObjAxisScale) scene.setSceneObjAxisScale('y', v); break;
            case 'sl-defz': if (scene.setSceneObjAxisScale) scene.setSceneObjAxisScale('z', v); break;
        }
        // Persiste ajustes de posicao do modelo (debounce).
        if (/^sl-(yaw|pitch|offx|offy|offz|mscale|roll)$/.test(id)) { clearTimeout(onRange._sx); onRange._sx = setTimeout(saveModelXform, 300); }
    }
    // Reflete os niveis/degraus nos quicksliders do visor quando mudados na aba.
    function syncQuickFromAdjust() {
        var p = scene.postfx.getParams();
        var sp = document.querySelector('.lr04-quickslider[data-filter-controls="poster"] input[data-key="levels"]');
        if (sp) { sp.value = p.posterizeLevels; updateRangeFill(sp); var o=sp.parentNode.querySelector('output'); if(o)o.textContent=p.posterizeLevels; }
        var sc = document.querySelector('.lr04-quickslider[data-filter-controls="cutout"] input[data-key="steps"]');
        if (sc) { sc.value = p.cutoutLevels; updateRangeFill(sc); var o2=sc.parentNode.querySelector('output'); if(o2)o2.textContent=p.cutoutLevels; }
    }

    // ---------- Paginas ----------
    function bindPages() {
        $all('.lr04-footer nav button[data-page]').forEach(function (b) {
            b.addEventListener('click', function () {
                $all('.lr04-footer nav button[data-page]').forEach(function (x){ x.setAttribute('aria-pressed','false'); });
                this.setAttribute('aria-pressed','true');
                currentPage = this.getAttribute('data-page');
                showPage(currentPage);
            });
        });
    }
    function showPage(page) {
        var isStudio = (page === 'studio');
        var studio = $('.lr04-studio'); if (studio) studio.hidden = !isStudio;
        var cat = $('.lr04-catalog'); if (cat) cat.hidden = isStudio;
        if (!isStudio) renderCatalog(page); else setTimeout(function(){ if (scene) scene.engine.resize(); }, 80);
    }
    // ---------- Catalogo (gavetas) ----------
    // renderCatalog e um dispatcher fino: monta o CatalogModel via adaptador de
    // dominio (buildLibraryModel/buildScenesModel) e delega ao render generico
    // renderDrawers. Biblioteca e Cenas compartilham drawerHTML/cardHTML e os
    // handlers de accordion.
    //
    // As funcoes puras de dominio (defaultCatOf/categoryExists/resolveModelCategory
    // e os construtores de descritor/HTML) sao expostas em window.__lrCatalogApi
    // para os testes em Node (Property 1/2 e smoke), analogo a __lrStateApi.

    // Categorias padrao dos modelos (Req 4.6). Ordem fixa de exibicao.
    var LIBRARY_DEFAULT_CATS = ['Cabecas', 'Bustos e Torsos', 'Figuras', 'Formas basicas'];
    var CAT_OUTROS = 'Outros';
    var CAT_SEM = 'Sem categoria';

    // Categoria alvo da proxima importacao pelo card "+" (guardada ao clicar no
    // card "+" de uma gaveta; consumida por onFilePicked). Req 3.5.
    var pendingImportCat = null;

    // Estado do arraste atual (DnD HTML5). Guardado no dragstart do card e lido no
    // drop/dragend. Req 6.1-6.5. Nulo fora de um arraste.
    var dragItem = null;

    // Categoria padrao (do codigo) de um item da Biblioteca. itemKey e a url
    // ('models/asaro.obj') para modelo padrao, ou 'my:<id>' para importado.
    // Importados nao tem categoria padrao => null.
    function defaultCatOf(itemKey) {
        if (itemKey == null) return null;
        var key = String(itemKey);
        if (key.indexOf('my:') === 0) return null;
        for (var i = 0; i < MODELS.length; i++) if (MODELS[i].v === key) return MODELS[i].cat || null;
        if (typeof SHAPES !== 'undefined') { for (var j = 0; j < SHAPES.length; j++) if (SHAPES[j].v === key) return 'Formas basicas'; }
        return null;
    }

    // Uma categoria "existe" se for uma das padrao ou uma custom em modelCategories.
    function categoryExists(name, cfg) {
        if (name == null || name === '') return false;
        for (var i = 0; i < LIBRARY_DEFAULT_CATS.length; i++) if (LIBRARY_DEFAULT_CATS[i] === name) return true;
        var custom = (cfg && cfg.modelCategories) || [];
        for (var j = 0; j < custom.length; j++) if (custom[j] === name) return true;
        return false;
    }

    // Valida um nome de categoria (criar ou renomear). Comparacao case-insensitive
    // e trim contra a lista de nomes existentes. Funcao pura (testavel) usada tanto
    // no create quanto no rename. (Req 4.3/4.4, 9.3/9.4)
    // Retorna { ok:true, name:<trim> } ou { ok:false, reason:'empty'|'duplicate' }.
    function validateNewCategoryName(name, existingNames) {
        var trimmed = (name == null) ? '' : String(name).replace(/^\s+|\s+$/g, '');
        if (trimmed === '') return { ok: false, reason: 'empty' };
        var lower = trimmed.toLowerCase();
        var list = existingNames || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i] != null && String(list[i]).toLowerCase() === lower) {
                return { ok: false, reason: 'duplicate' };
            }
        }
        return { ok: true, name: trimmed };
    }

    // Precedencia: override (se valido) > categoria padrao > 'Outros' (Req 4.5).
    function resolveModelCategory(itemKey, cfg) {
        var ov = (cfg && cfg.modelCatOverrides) ? cfg.modelCatOverrides[itemKey] : null;
        if (ov && categoryExists(ov, cfg)) return ov;
        var def = defaultCatOf(itemKey);
        if (def) return def;
        return CAT_OUTROS;
    }

    // Monta a chave de persistencia (itemKey) de um item arrastado. Para modelo
    // padrao (defmodel) o id ja e a url; para importado (mymodel) e 'my:<id>'.
    // Para cena (scene) o itemKey e o proprio id (numerico). Funcao pura.
    function moveItemKeyFor(dragItem) {
        if (!dragItem) return null;
        if (dragItem.kind === 'mymodel') return 'my:' + dragItem.id;
        return dragItem.id;
    }

    // Calcula o resultado de mover um item para uma gaveta destino, sem DOM e sem
    // persistir. Retorna { valid, itemKey, destCat, fromCat }. O movimento e valido
    // sse destCat nao for vazio E for diferente de fromCat. (Req 6.3/6.4/6.5;
    // Property 7 e 8). A persistencia (setModelCategoryOverride/setSceneCategory)
    // fica com onMoveItem; aqui so a decisao pura.
    function computeMove(dragItem, destCat) {
        var fromCat = dragItem ? dragItem.fromCat : null;
        var valid = !!(dragItem && destCat != null && destCat !== '' && destCat !== fromCat);
        return {
            valid: valid,
            itemKey: moveItemKeyFor(dragItem),
            destCat: destCat,
            fromCat: fromCat
        };
    }

    // ----- Thumbnails (reaproveita override > thumb fixa > icone) -----
    function catalogIcon() {
        return '<div class="lr04-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg></div>';
    }
    function fileBaseName(url) { var m = /([^\/]+)\.(obj|stl|glb|gltf)$/i.exec(url || ''); return m ? m[1] : null; }
    function hasFixedThumb(url) {
        for (var i = 0; i < MODELS.length; i++) if (MODELS[i].v === url) return true;
        if (typeof SHAPES !== 'undefined') { for (var j = 0; j < SHAPES.length; j++) if (SHAPES[j].v === url) return true; }
        return false;
    }
    function previewHTML(url, thumbs) {
        if (thumbs && thumbs[url]) return '<img src="' + thumbs[url] + '" loading="lazy">';
        if (hasFixedThumb(url)) { var base = fileBaseName(url); if (base) return '<img src="models/thumbs/' + base + '.png" loading="lazy">'; }
        return catalogIcon();
    }

    // ----- Adaptador: Biblioteca -----
    function buildLibraryModel() {
        var cfg = {}; try { cfg = LightRefStorage.readConfig() || {}; } catch (e) { cfg = {}; }
        var thumbs = cfg.modelThumbs || {};
        var customCats = cfg.modelCategories || [];
        var drawer = (cfg.drawerState && cfg.drawerState.library) || {};

        function expandedOf(catId) { return (drawer[catId] === false) ? false : true; }

        // Agrupa itens por categoria resolvida.
        var byCat = {};
        function push(catId, item) { (byCat[catId] = byCat[catId] || []).push(item); }

        // Modelos padrao (MODELS).
        MODELS.forEach(function (m) {
            var c = resolveModelCategory(m.v, cfg);
            push(c, {
                id: m.v, kind: 'defmodel', title: m.t, subtitle: c, url: m.v,
                thumbHTML: previewHTML(m.v, thumbs), deletable: itemDeletable('defmodel'), draggable: true, fromCat: c
            });
        });
        // Formas basicas (SHAPES) -> categoria padrao 'Formas basicas'.
        if (typeof SHAPES !== 'undefined') {
            SHAPES.forEach(function (s) {
                var c = resolveModelCategory(s.v, cfg);
                push(c, {
                    id: s.v, kind: 'defmodel', title: s.t, subtitle: c, url: s.v,
                    thumbHTML: previewHTML(s.v, thumbs), deletable: itemDeletable('defmodel'), draggable: true, fromCat: c
                });
            });
        }
        // Modelos importados.
        var mine = []; try { mine = LightRefStorage.listModels(); } catch (e) { mine = []; }
        mine.forEach(function (m) {
            var key = 'my:' + m.id;
            var c = resolveModelCategory(key, cfg);
            var u = LightRefStorage.modelFileURL(m);
            push(c, {
                id: m.id, kind: 'mymodel', title: m.name, subtitle: 'Meu (' + (m.ext || '').replace('.', '') + ')',
                url: u, thumbHTML: previewHTML(u, thumbs), deletable: itemDeletable('mymodel'), draggable: true, fromCat: c
            });
        });

        // Ordem: padrao + custom (na ordem de modelCategories) + 'Outros' (se tiver item).
        var order = [];
        LIBRARY_DEFAULT_CATS.forEach(function (c) { order.push(c); });
        customCats.forEach(function (c) { if (order.indexOf(c) < 0) order.push(c); });
        if (byCat[CAT_OUTROS] && byCat[CAT_OUTROS].length) order.push(CAT_OUTROS);

        var categories = [];
        order.forEach(function (c) {
            var renamable = (LIBRARY_DEFAULT_CATS.indexOf(c) < 0) && (c !== CAT_OUTROS);
            categories.push({
                id: c, name: c, builtin: !renamable, renamable: renamable,
                expanded: expandedOf(c), items: byCat[c] || []
            });
        });

        return { page: 'library', categories: categories, canCreateCategory: true, canImport: true, emptyHint: '' };
    }

    // ----- Adaptador: Cenas -----
    function buildScenesModel() {
        var cfg = {}; try { cfg = LightRefStorage.readConfig() || {}; } catch (e) { cfg = {}; }
        var sceneCats = cfg.sceneCategories || [];
        var drawer = (cfg.drawerState && cfg.drawerState.scenes) || {};
        function expandedOf(catId) { return (drawer[catId] === false) ? false : true; }

        var scenes = []; try { scenes = LightRefStorage.listScenes(); } catch (e) { scenes = []; }

        function sceneCatExists(name) { for (var i = 0; i < sceneCats.length; i++) if (sceneCats[i] === name) return true; return false; }

        var byCat = {};
        function push(catId, item) { (byCat[catId] = byCat[catId] || []).push(item); }
        scenes.forEach(function (s) {
            var c = (s.categoryId && sceneCatExists(s.categoryId)) ? s.categoryId : CAT_SEM;
            push(c, {
                id: s.id, kind: 'scene', title: s.name, subtitle: '',
                thumbHTML: s.thumb ? ('<img src="' + s.thumb + '">') : '<div class="lr04-placeholder"></div>',
                deletable: itemDeletable('scene'), draggable: true, fromCat: c
            });
        });

        var order = [];
        sceneCats.forEach(function (c) { if (order.indexOf(c) < 0) order.push(c); });
        if (byCat[CAT_SEM] && byCat[CAT_SEM].length) order.push(CAT_SEM);

        var categories = [];
        order.forEach(function (c) {
            var renamable = (c !== CAT_SEM);
            categories.push({
                id: c, name: c, builtin: !renamable, renamable: renamable,
                expanded: expandedOf(c), items: byCat[c] || []
            });
        });

        return {
            page: 'scenes', categories: categories, canCreateCategory: true, canImport: false,
            emptyHint: scenes.length ? '' : 'Nenhuma cena salva. Clique em Salvar cena atual.'
        };
    }

    // Regra unica de deletabilidade: somente importados e cenas sao deletaveis
    // (Req 1.1/1.2/11.1). Usada pelos adaptadores ao montar cada ItemDesc.
    function itemDeletable(kind) { return kind === 'mymodel' || kind === 'scene'; }

    // ----- Render generico (HTML) -----
    function cardHTML(item) {
        var del = item.deletable ? '<span class="lr04-card-del" data-action="del" title="Excluir">x</span>' : '';
        return '<button class="lr04-card" draggable="' + (item.draggable ? 'true' : 'false') + '"' +
            ' data-kind="' + item.kind + '" data-id="' + item.id + '" data-cat="' + item.fromCat + '">' +
            del + item.thumbHTML + '<strong>' + item.title + '</strong>' +
            (item.subtitle ? ('<small>' + item.subtitle + '</small>') : '') + '</button>';
    }
    function addCardHTML() {
        return '<button class="lr04-card lr04-card-add" data-action="add-model" title="Adicionar modelo">' +
            '<span class="lr04-plus">+</span><strong>Adicionar</strong></button>';
    }
    function drawerHTML(cat, canImport) {
        var count = cat.items.length;
        var cards = cat.items.map(function (it) { return cardHTML(it); }).join('');
        if (canImport) cards += addCardHTML();
        var tools = cat.renamable ? '<span class="lr04-drawertools"><button data-action="rename-cat" data-cat="' + cat.id + '" title="Renomear">Renomear</button></span>' : '';
        return '<section class="lr04-drawer" data-cat="' + cat.id + '" aria-expanded="' + (cat.expanded ? 'true' : 'false') + '">' +
            '<header class="lr04-drawerhead" tabindex="0">' +
            '<button class="lr04-drawertoggle" type="button"><span class="lr04-arrow">&#9656;</span> ' + cat.name + ' (' + count + ')</button>' + tools +
            '</header>' +
            '<div class="lr04-drawerbody lr04-gallery"' + (cat.expanded ? '' : ' hidden') + '>' + cards + '</div>' +
            '</section>';
    }
    function catalogToolbarHTML(model) {
        var html = '<div class="lr04-drawertools-top">';
        if (model.canCreateCategory) html += '<button class="lr04-widebutton" data-action="new-cat">+ Nova categoria</button>';
        if (model.page === 'scenes') html += '<button id="scene-save-btn" class="lr04-widebutton" data-action="save-scene">+ Salvar cena atual</button>';
        html += '</div>';
        return html;
    }
    // Monta todo o HTML do catalogo (toolbar + gavetas). Funcao pura (testavel).
    function catalogHTML(model) {
        var html = catalogToolbarHTML(model);
        if (model.categories.length === 0 && model.emptyHint) {
            html += '<p class="lr04-emptyhint">' + model.emptyHint + '</p>';
            return html;
        }
        model.categories.forEach(function (cat) { html += drawerHTML(cat, model.canImport); });
        return html;
    }

    // ----- Render generico (DOM + handlers) -----
    function renderDrawers(model) {
        var cat = $('.lr04-catalog'); if (!cat) return;
        cat.innerHTML = catalogHTML(model);
        refreshIcons();
        bindDrawerHandlers(model);
        bindCardOpenHandlers(model);
        bindCardDeleteHandlers(model);
        bindCardAddHandlers(model);
        bindDnD(model);
        bindCatalogTopActions(model);
    }

    // Accordion: clique/Enter/Space no cabecalho alterna a gaveta e persiste. (Req 5/10)
    function bindDrawerHandlers(model) {
        $all('.lr04-catalog .lr04-drawer').forEach(function (drawer) {
            var head = drawer.querySelector('.lr04-drawerhead');
            if (!head) return;
            function toggle() {
                var expanded = drawer.getAttribute('aria-expanded') !== 'true' ? true : false;
                // aria-expanded true -> recolher; false/ausente -> expandir.
                var isOpen = drawer.getAttribute('aria-expanded') === 'true';
                var next = !isOpen;
                drawer.setAttribute('aria-expanded', next ? 'true' : 'false');
                var body = drawer.querySelector('.lr04-drawerbody');
                if (body) { if (next) body.removeAttribute('hidden'); else body.setAttribute('hidden', 'hidden'); }
                var catId = drawer.getAttribute('data-cat');
                try { LightRefStorage.setDrawerState(model.page, catId, next); } catch (e) {}
            }
            head.onclick = function (ev) {
                // Nao alternar quando o clique for num botao de ferramenta (renomear).
                var t = ev.target;
                if (t && t.getAttribute && t.getAttribute('data-action') === 'rename-cat') return;
                toggle();
            };
            head.onkeydown = function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ' || ev.keyCode === 13 || ev.keyCode === 32) {
                    ev.preventDefault(); toggle();
                }
            };
        });
    }

    // Abrir item: clicar card de modelo carrega o modelo; card de cena aplica a
    // cena. (Delete/DnD/importar/categorias entram nas Etapas 4/5.)
    function bindCardOpenHandlers(model) {
        $all('.lr04-catalog .lr04-drawerbody .lr04-card').forEach(function (b) {
            if (b.getAttribute('data-action') === 'add-model') return; // card "+" tratado em top actions
            b.onclick = function (ev) {
                // Clique no "x" (delete) sera tratado nas proximas etapas; por ora ignora.
                var t = ev.target;
                if (t && t.getAttribute && t.getAttribute('data-action') === 'del') { ev.stopPropagation(); return; }
                var kind = this.getAttribute('data-kind');
                var id = this.getAttribute('data-id');
                if (kind === 'defmodel') {
                    var ms = $('#model-select'); if (ms) ms.value = id;
                    loadModel(id); backToStudio();
                } else if (kind === 'mymodel') {
                    var mid = parseInt(id, 10);
                    var models = LightRefStorage.listModels();
                    for (var i = 0; i < models.length; i++) if (models[i].id === mid) { loadModel(LightRefStorage.modelFileURL(models[i])); backToStudio(); return; }
                } else if (kind === 'scene') {
                    var sid = parseInt(id, 10);
                    var scenes = LightRefStorage.listScenes();
                    for (var j = 0; j < scenes.length; j++) if (scenes[j].id === sid) { applyScene(scenes[j].state); backToStudio(); return; }
                }
            };
        });
    }

    // Acoes de topo: "Salvar cena atual" (Cenas), "Nova categoria" e o botao
    // "Renomear" no cabecalho de cada gaveta renomeavel.
    function bindCatalogTopActions(model) {
        var sb = $('#scene-save-btn'); if (sb) sb.onclick = saveScenePrompt;
        var nc = $('.lr04-catalog [data-action="new-cat"]');
        if (nc) nc.onclick = function () { onCreateCategory(model.page); };
        $all('.lr04-catalog [data-action="rename-cat"]').forEach(function (btn) {
            btn.onclick = function (ev) {
                ev.stopPropagation();
                var catId = btn.getAttribute('data-cat');
                onRenameCategory(model.page, catId);
            };
        });
    }

    // Card "+": ao clicar, guarda a categoria da gaveta onde o "+" esta (para
    // associar o modelo importado a ela) e abre o seletor de arquivo. (Req 3.2/3.5)
    function bindCardAddHandlers(model) {
        $all('.lr04-catalog [data-action="add-model"]').forEach(function (btn) {
            btn.onclick = function (ev) {
                ev.stopPropagation();
                var drawer = btn.closest ? btn.closest('.lr04-drawer') : null;
                pendingImportCat = drawer ? drawer.getAttribute('data-cat') : null;
                var inp = $('#file-input');
                if (inp) { inp.setAttribute('data-import', '1'); inp.click(); }
            };
        });
    }

    // Arrastar-e-soltar de itens entre categorias, via API HTML5 (compat CEF 99).
    // Cards (exceto o "+") sao a origem; as gavetas (.lr04-drawer) sao os alvos.
    // Req 6.1-6.5 (biblioteca) e 12.1-12.5 (cenas, ligadas via onMoveItem).
    function bindDnD(model) {
        // Cards de item: dragstart guarda o dragItem e marca .lr04-dragging;
        // dragend limpa realces. O card "+" nao e arrastavel.
        $all('.lr04-catalog .lr04-drawerbody .lr04-card').forEach(function (card) {
            if (card.getAttribute('data-action') === 'add-model') return;
            card.ondragstart = function (ev) {
                dragItem = {
                    kind: card.getAttribute('data-kind'),
                    id: card.getAttribute('data-id'),
                    fromCat: card.getAttribute('data-cat')
                };
                if (ev.dataTransfer) {
                    ev.dataTransfer.effectAllowed = 'move';
                    // CEF exige que algum dado seja setado para o arraste valer.
                    try { ev.dataTransfer.setData('text/plain', String(dragItem.id)); } catch (e) {}
                }
                card.className += ' lr04-dragging';
            };
            card.ondragend = function () {
                clearDnDHighlights();
                dragItem = null;
            };
        });

        // Gavetas: dragover permite o drop e destaca; dragleave remove o destaque;
        // drop aplica o movimento se destCat for valido.
        $all('.lr04-catalog .lr04-drawer').forEach(function (drawer) {
            drawer.ondragover = function (ev) {
                if (ev.preventDefault) ev.preventDefault();
                if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
                if (drawer.className.indexOf('lr04-dropok') < 0) drawer.className += ' lr04-dropok';
                return false;
            };
            drawer.ondragleave = function () {
                removeClass(drawer, 'lr04-dropok');
            };
            drawer.ondrop = function (ev) {
                if (ev.preventDefault) ev.preventDefault();
                if (ev.stopPropagation) ev.stopPropagation();
                var destCat = drawer.getAttribute('data-cat');
                var mv = computeMove(dragItem, destCat);
                clearDnDHighlights();
                if (mv.valid) onMoveItem(dragItem, destCat, model.page);
                return false;
            };
        });
    }

    // Remove uma classe de um elemento (ES5, sem classList.remove por compat).
    function removeClass(el, cls) {
        if (!el || !el.className) return;
        var parts = String(el.className).split(/\s+/);
        var out = [];
        for (var i = 0; i < parts.length; i++) if (parts[i] && parts[i] !== cls) out.push(parts[i]);
        el.className = out.join(' ');
    }

    // Limpa todos os realces de arraste (card em arraste e gavetas destacadas).
    function clearDnDHighlights() {
        $all('.lr04-catalog .lr04-dragging').forEach(function (el) { removeClass(el, 'lr04-dragging'); });
        $all('.lr04-catalog .lr04-dropok').forEach(function (el) { removeClass(el, 'lr04-dropok'); });
    }

    // Aplica o movimento de um item para a categoria destino e re-renderiza.
    // Biblioteca: grava override de categoria do modelo. Cenas: grava categoryId
    // da cena. Movimento invalido (destCat vazio/igual a origem) nao chega aqui.
    function onMoveItem(item, destCat, page) {
        var mv = computeMove(item, destCat);
        if (!mv.valid) return;
        if (page === 'scenes') {
            var sid = parseInt(mv.itemKey, 10);
            try { LightRefStorage.setSceneCategory(sid, destCat); } catch (e) {}
            renderCatalog('scenes');
        } else {
            try { LightRefStorage.setModelCategoryOverride(mv.itemKey, destCat); } catch (e2) {}
            renderCatalog('library');
        }
    }

    // Deletar item (o "x" no card, so em cards deletaveis). Abre confirmacao;
    // ao confirmar chama deleteModel; se o unlink falhar, mantem o card. (Req 1/2)
    function bindCardDeleteHandlers(model) {
        $all('.lr04-catalog .lr04-card-del').forEach(function (x) {
            x.onclick = function (ev) {
                ev.stopPropagation();
                var card = x.closest ? x.closest('.lr04-card') : null;
                if (!card) return;
                var kind = card.getAttribute('data-kind');
                var id = card.getAttribute('data-id');
                var title = '';
                var strong = card.querySelector('strong');
                if (strong) title = strong.textContent || '';
                confirmDeleteItem(model.page, kind, id, title);
            };
        });
    }

    // Dialogo de confirmacao de delecao. Trata modelo importado (mymodel) e cena
    // (scene). Cancelar nao altera nada. (Req 1/2 e Req 11)
    function confirmDeleteItem(page, kind, id, title) {
        openDialog('Excluir',
            '<p style="margin:0 0 12px">Excluir ' + escapeText(title) + '?</p>' +
            '<div class="lr04-row" style="justify-content:flex-end;gap:8px">' +
            '<button id="del-cancel" style="background:#303540">Cancelar</button>' +
            '<button id="del-confirm" style="background:#7a2e2e;color:#fff">Excluir</button>' +
            '</div>');
        var cancel = $('#del-cancel'); if (cancel) cancel.onclick = function () { closeDialog(); };
        var confirm = $('#del-confirm');
        if (confirm) confirm.onclick = function () {
            if (kind === 'mymodel') {
                var mid = parseInt(id, 10);
                var res;
                try { res = LightRefStorage.deleteModel(mid); } catch (e) { res = { ok: false }; }
                if (res && res.ok === false) {
                    feedback('Falha ao remover o arquivo do modelo', true);
                    // Mantem o card (nao re-renderiza removendo).
                    return;
                }
                closeDialog();
                renderCatalog('library');
            } else if (kind === 'scene') {
                var sid = parseInt(id, 10);
                try { LightRefStorage.deleteScene(sid); } catch (e) {}
                closeDialog();
                renderCatalog('scenes');
            } else {
                closeDialog();
            }
        };
    }

    // Escapa texto para uso seguro em innerHTML (nomes de modelo/categoria).
    function escapeText(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Nomes existentes para validacao de categoria (padrao + custom) da pagina.
    function existingCategoryNames(page) {
        var cfg = {}; try { cfg = LightRefStorage.readConfig() || {}; } catch (e) { cfg = {}; }
        var names = [];
        if (page === 'library') {
            LIBRARY_DEFAULT_CATS.forEach(function (c) { names.push(c); });
            (cfg.modelCategories || []).forEach(function (c) { names.push(c); });
        } else {
            (cfg.sceneCategories || []).forEach(function (c) { names.push(c); });
        }
        return names;
    }

    // Criar categoria: dialogo com input + Salvar. Valida vazio/duplicado. (Req 4.1/4.3/4.4)
    function onCreateCategory(page) {
        openDialog('Nova categoria',
            '<div class="lr04-row"><span>Nome</span><input type="text" id="cat-name" style="grid-column:2 / span 2;background:#303540;border:1px solid #414953;border-radius:4px;color:#e1e2e6;height:30px;padding:0 9px"></div>' +
            '<button id="cat-save" style="background:#303540;margin-top:8px">Salvar</button>');
        var save = $('#cat-save');
        if (save) save.onclick = function () {
            var input = $('#cat-name');
            var v = validateNewCategoryName(input ? input.value : '', existingCategoryNames(page));
            if (!v.ok) {
                feedback(v.reason === 'duplicate' ? 'Categoria ja existe' : 'Informe um nome de categoria', true);
                return; // mantem o dialogo aberto
            }
            try {
                if (page === 'library') LightRefStorage.addModelCategory(v.name);
                else LightRefStorage.addSceneCategory(v.name);
            } catch (e) { feedback('Falha ao criar categoria', true); return; }
            closeDialog();
            renderCatalog(page);
        };
    }

    // Renomear categoria: dialogo preenchido com o nome atual. Mesmas validacoes.
    // (Req 4.2/4.3/4.4) So categorias renamable tem o botao (garantido no drawerHTML).
    function onRenameCategory(page, catId) {
        var oldName = catId;
        openDialog('Renomear categoria',
            '<div class="lr04-row"><span>Nome</span><input type="text" id="cat-name" value="' + escapeText(oldName) + '" style="grid-column:2 / span 2;background:#303540;border:1px solid #414953;border-radius:4px;color:#e1e2e6;height:30px;padding:0 9px"></div>' +
            '<button id="cat-save" style="background:#303540;margin-top:8px">Salvar</button>');
        var save = $('#cat-save');
        if (save) save.onclick = function () {
            var input = $('#cat-name');
            var raw = input ? input.value : '';
            var trimmed = String(raw == null ? '' : raw).replace(/^\s+|\s+$/g, '');
            // Nome igual ao atual (ignorando trim): apenas fecha, nada muda.
            if (trimmed === oldName) { closeDialog(); return; }
            // Valida contra os demais nomes (exclui o proprio nome atual).
            var others = existingCategoryNames(page).filter(function (n) { return n !== oldName; });
            var v = validateNewCategoryName(raw, others);
            if (!v.ok) {
                feedback(v.reason === 'duplicate' ? 'Categoria ja existe' : 'Informe um nome de categoria', true);
                return;
            }
            try {
                if (page === 'library') LightRefStorage.renameModelCategory(oldName, v.name);
                else LightRefStorage.renameSceneCategory(oldName, v.name);
            } catch (e) { feedback('Falha ao renomear categoria', true); return; }
            closeDialog();
            renderCatalog(page);
        };
    }

    function renderCatalog(page) {
        var model = (page === 'library') ? buildLibraryModel() : buildScenesModel();
        renderDrawers(model);
    }

    // Exposto para testes em Node (Property 1/2 e smoke da renderizacao). So
    // quando ha 'window'. As funcoes puras nao dependem de DOM.
    try {
        if (typeof window !== 'undefined' && window) {
            window.__lrCatalogApi = {
                defaultCatOf: defaultCatOf,
                categoryExists: categoryExists,
                resolveModelCategory: resolveModelCategory,
                validateNewCategoryName: validateNewCategoryName,
                itemDeletable: itemDeletable,
                computeMove: computeMove,
                moveItemKeyFor: moveItemKeyFor,
                cardHTML: cardHTML,
                addCardHTML: addCardHTML,
                drawerHTML: drawerHTML,
                catalogToolbarHTML: catalogToolbarHTML,
                catalogHTML: catalogHTML,
                MODELS: MODELS,
                SHAPES: (typeof SHAPES !== 'undefined') ? SHAPES : []
            };
        }
    } catch (e) {}
    function backToStudio() {
        currentPage = 'studio';
        $all('.lr04-footer nav button[data-page]').forEach(function (x){ x.setAttribute('aria-pressed', String(x.getAttribute('data-page')==='studio')); });
        showPage('studio');
    }

    // ---------- Dialogo / modal ----------
    function bindDialog() { bindAction('close', closeDialog); }
    function openDialog(title, bodyHtml) { $('#lr04-modal-title').textContent = title; $('.lr04-modalbody').innerHTML = bodyHtml; $('.lr04-modal').hidden = false; refreshIcons(); }
    function closeDialog() { $('.lr04-modal').hidden = true; }
    function openExportMenu() { doExport(); }
    function doExport() {
        feedback('Colocando camada...');
        scene.snapshotHiRes(function (dataURL) {
            LightRefToPhotoshop.placeAsLayer(dataURL, { mode: 'raster' }, function (err) {
                if (err) feedback(/no document|Nenhum/i.test(err.message) ? 'Abra um documento no Photoshop' : 'Falha ao criar camada', true);
                else feedback('Camada criada!');
            });
        }, 2048);
    }

    // ---------- Cenas ----------
    function saveScenePrompt() {
        openDialog('Salvar cena', '<div class="lr04-row"><span>Nome</span><input type="text" id="scene-name" style="grid-column:2 / span 2;background:#303540;border:1px solid #414953;border-radius:4px;color:#e1e2e6;height:30px;padding:0 9px"></div><button id="do-save" style="background:#303540;margin-top:8px">Salvar</button>');
        $('#do-save').onclick = function () {
            var name = ($('#scene-name').value||'').trim(); if (!name) return;
            try { var thumb = scene.thumbnailDataURL(); LightRefStorage.saveScene(name, collectState(), thumb); feedback('Cena salva'); closeDialog(); } catch (e) { feedback('Falha ao salvar', true); }
        };
    }
    // ---------- Estado_Completo (Req 13/14) ----------
    // A logica pura de coletar/aplicar o estado do estudio foi extraida para
    // collectSceneState(scene, modelValue) e applySceneState(scene, state, opts),
    // que dependem apenas do objeto 'scene' (mesmos getters/setters do
    // LightRefScene) e de callbacks opcionais em 'opts'. Isso permite testar o
    // round-trip (Property 11/12) em Node com um fake de scene, sem navegador.
    // collectState()/applyScene() abaixo sao wrappers finos que ligam o 'scene'
    // real e os efeitos de UI (loadModel/feedback/DOM). Expostos em
    // window.__lrStateApi para os testes.

    // Coleta o Estado_Completo a partir de 'sc' (objeto scene). 'modelValue' e o
    // valor do #model-select (modelo carregado atual); pode ser null.
    function collectSceneState(sc, modelValue) {
        var lights = sc.lightManager.lights.map(function (l){ return {name:l.name,color:l.color,intensity:l.intensity,azimuth:l.azimuth,elevation:l.elevation,enabled:l.enabled,softness:l.softness,sourceSize:l.sourceSize}; });
        var matParams = sc.getMaterialParams ? sc.getMaterialParams() : null;
        var mp = {}; if (matParams) { for (var k in matParams) if (matParams.hasOwnProperty(k)) mp[k] = matParams[k]; }
        return {
            schema: 2,
            model: (modelValue != null) ? modelValue : null,
            rotation: sc.getModelRotation ? sc.getModelRotation() : null,
            offset: sc.getModelOffset ? sc.getModelOffset() : null,
            scaleMult: sc.getModelScaleMult ? sc.getModelScaleMult() : null,
            background: sc.getBackground ? sc.getBackground() : null,
            lights: lights,
            fx: sc.postfx.getParams(),
            focal: sc.getFocalLength ? sc.getFocalLength() : null,
            projection: sc.getProjection ? sc.getProjection() : 'persp',
            material: sc.getMaterial ? sc.getMaterial() : null,
            materialParams: mp,
            formColor: sc.getFormColor ? sc.getFormColor() : null,
            environment: sc.getEnvironment ? sc.getEnvironment() : null,
            envIntensity: sc.getEnvIntensity ? sc.getEnvIntensity() : null
        };
    }

    // Aplica o Estado_Completo em 'sc'. Robusto: carrega o modelo primeiro (via
    // opts.loadModel se dado), trata falha de modelo (opts.onModelFail) e faz
    // fallback item-a-item (campo ausente => mantem valor atual, nunca lanca).
    // opts (todos opcionais):
    //   loadModel(url, done, onFail)  - carrega o modelo; se ausente, aplica direto.
    //   onModelValue(url)             - reflete o modelo carregado na UI (#model-select).
    //   onBackground(state)           - efeito de UI extra para o fundo (classe transparent).
    //   feedback(msg, isErr)          - feedback ao usuario.
    //   afterApply()                  - hook pos-aplicacao (selectLight/syncMaterialPopover/renderTab).
    function applySceneState(sc, state, opts) {
        if (!state) return;
        opts = opts || {};
        function applyRest() {
            if (state.material != null && sc.setMaterial) sc.setMaterial(state.material);
            if (state.materialParams && sc.setMaterialParam) {
                for (var k in state.materialParams) if (state.materialParams.hasOwnProperty(k)) sc.setMaterialParam(k, state.materialParams[k]);
            }
            if (state.formColor != null && sc.setFormColor) sc.setFormColor(state.formColor);
            if (state.rotation && sc.setModelRotation) {
                sc.setModelRotation(state.rotation.yaw||0, state.rotation.pitch||0);
                if (sc.setModelRoll && state.rotation.roll != null) sc.setModelRoll(state.rotation.roll);
            }
            if (state.offset && sc.setModelOffset) {
                var o = state.offset;
                if (o.x != null) sc.setModelOffset('x', o.x);
                if (o.y != null) sc.setModelOffset('y', o.y);
                if (o.z != null) sc.setModelOffset('z', o.z);
            }
            if (state.scaleMult != null && sc.setModelScaleMult) sc.setModelScaleMult(state.scaleMult);
            if (state.background && sc.setBackground) {
                var tr = state.background.transparent;
                sc.setBackground(tr ? 'transparent' : 'color', state.background.color || '#3a4a6a');
                if (opts.onBackground) opts.onBackground(state);
            }
            if (state.projection != null && sc.setProjection) sc.setProjection(state.projection);
            if (state.focal != null && sc.setFocalLength) sc.setFocalLength(state.focal);
            if (sc.setEnvironment) sc.setEnvironment(state.environment || null);
            if (state.envIntensity != null && sc.setEnvIntensity) sc.setEnvIntensity(state.envIntensity);
            if (state.lights != null) {
                var ex = sc.lightManager.lights.slice(); ex.forEach(function(l){ sc.lightManager.remove(l.id); });
                state.lights.forEach(function(ld){ sc.lightManager.add(ld); });
            }
            if (state.fx && sc.postfx && sc.postfx.applyParams) sc.postfx.applyParams(state.fx);
            if (opts.afterApply) opts.afterApply();
        }
        if (state.model != null) {
            if (opts.onModelValue) opts.onModelValue(state.model);
            if (opts.loadModel) {
                opts.loadModel(state.model, applyRest, function () {
                    if (opts.feedback) opts.feedback('Falha ao carregar modelo da cena', true);
                    applyRest();
                });
            } else {
                applyRest();
            }
        } else {
            applyRest();
        }
    }

    function collectState() {
        var ms = $('#model-select');
        return collectSceneState(scene, ms ? ms.value : null);
    }
    function applyScene(state) {
        applySceneState(scene, state, {
            loadModel: function (url, done, onFail) { loadModel(url, done, onFail); },
            onModelValue: function (url) { var ms = $('#model-select'); if (ms) ms.value = url; },
            onBackground: function (st) {
                var tr = st.background && st.background.transparent;
                var vp = $('.lr04-viewport'); if (vp) vp.classList.toggle('transparent', !!tr);
            },
            feedback: feedback,
            afterApply: function () {
                selectLight(scene.lightManager.lights.length ? scene.lightManager.lights[0].id : null);
                syncMaterialPopover();
                renderTab();
            }
        });
    }

    // Exposto para testes em Node (round-trip do Estado_Completo). So quando ha
    // 'window' (no CEF sempre ha; em Node os testes criam um window fake).
    try { if (typeof window !== 'undefined' && window) window.__lrStateApi = { collectSceneState: collectSceneState, applySceneState: applySceneState }; } catch (e) {}

})();


