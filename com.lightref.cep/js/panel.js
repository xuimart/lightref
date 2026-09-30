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
            try { var rec = LightRefStorage.importModel(file.path, file.name.replace(/\.[^.]+$/, '')); loadModel(LightRefStorage.modelFileURL(rec)); feedback('Modelo importado'); } catch (e) { feedback('Falha ao importar', true); }
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
                    row('Altura','sl-elevation',-90,90,1, l.elevation, '\u00b0') +
                    row('Suavidade','sl-softness',1,96,1, (l.softness!=null?l.softness:32), '') +
                    row('Abertura','sl-srcsize',1,14,0.5, (l.sourceSize!=null?l.sourceSize:6), '');
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
                feedback('Posicao do modelo salva');
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
            case 'sl-softness': scene.lightManager.update(selectedLightId,'softness', parseFloat(value)); break;
            case 'sl-srcsize': scene.lightManager.update(selectedLightId,'sourceSize', parseFloat(value)); break;
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
    function renderCatalog(page) {
        var cat = $('.lr04-catalog');
        if (page === 'library') {
            var icon = '<div class="lr04-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg></div>';
            var thumbs = {}; try { thumbs = LightRefStorage.readConfig().modelThumbs || {}; } catch (e) {}
            // Thumbs padronizadas (geradas offline) ficam em models/thumbs/<arquivo>.png.
            function fixedThumb(url) {
                var m = /models\/([^\/]+)\.(obj|stl|glb|gltf)$/i.exec(url || '');
                return m ? 'models/thumbs/' + m[1] + '.png' : null;
            }
            function preview(url) {
                var ft = fixedThumb(url);
                if (ft) return '<img src="'+ft+'" loading="lazy">';
                return thumbs[url] ? '<img src="'+thumbs[url]+'" loading="lazy">' : icon;
            }
            function cardFor(url, title, tag) { return '<button class="lr04-card" data-defurl="'+url+'">'+preview(url)+'<strong>'+title+'</strong><small>'+(tag||'')+'</small></button>'; }
            var allDef = MODELS.slice();
            if (typeof SHAPES !== 'undefined') { SHAPES.forEach(function(s){ allDef.push({v:s.v, t:s.t, cat:'Formas basicas'}); }); }
            var order = ['Cabecas','Bustos e Torsos','Figuras','Formas basicas','Outros'];
            var byCat = {}; allDef.forEach(function(m){ var c=m.cat||'Outros'; (byCat[c]=byCat[c]||[]).push(m); });
            var html = '';
            order.forEach(function(c){ if (!byCat[c]) return; var cards = byCat[c].map(function(m){ return cardFor(m.v, m.t, c); }).join(''); html += '<h3'+(html?' style="margin-top:16px"':'')+'>'+c+'</h3><div class="lr04-gallery">'+cards+'</div>'; });
            var mine; try { mine = LightRefStorage.listModels(); } catch (e) { mine = []; }
            var myCards = mine.map(function (m) { var u = LightRefStorage.modelFileURL(m); return '<button class="lr04-card" data-model="'+m.id+'">'+preview(u)+'<strong>'+m.name+'</strong><small>Meu ('+(m.ext||'').replace('.','')+')</small></button>'; }).join('');
            cat.innerHTML = html +
                            '<h3 style="margin-top:16px">Meus modelos</h3>' + (myCards ? '<div class="lr04-gallery">'+myCards+'</div>' : '<p>Nenhum importado. Use Importar no topo.</p>');
            refreshIcons();
            $all('.lr04-catalog [data-defurl]').forEach(function (b) { b.onclick = function () { var u=this.getAttribute('data-defurl'); var ms=$('#model-select'); if (ms) ms.value=u; loadModel(u); backToStudio(); }; });
            $all('.lr04-catalog [data-model]').forEach(function (b) { b.onclick = function () { var id=parseInt(this.getAttribute('data-model'),10); var models=LightRefStorage.listModels(); for (var i=0;i<models.length;i++) if (models[i].id===id) { loadModel(LightRefStorage.modelFileURL(models[i])); backToStudio(); } }; });
        } else if (page === 'scenes') {
            var scenes; try { scenes = LightRefStorage.listScenes(); } catch (e) { scenes = []; }
            var cards = scenes.map(function (s) { return '<button class="lr04-card" data-scene="'+s.id+'">'+(s.thumb?'<img src="'+s.thumb+'">':'<div class="lr04-placeholder"></div>')+'<strong>'+s.name+'</strong></button>'; }).join('');
            var saveBtn = '<button id="scene-save-btn" class="lr04-widebutton">+ Salvar cena atual</button>';
            cat.innerHTML = '<h3>Cenas salvas</h3>' + saveBtn + (cards ? '<div class="lr04-gallery">'+cards+'</div>' : '<p>Nenhuma cena salva. Clique em Salvar cena atual.</p>');
            var sb = $('#scene-save-btn'); if (sb) sb.onclick = saveScenePrompt;
            $all('.lr04-catalog [data-scene]').forEach(function (b) { b.onclick = function () { var id=parseInt(this.getAttribute('data-scene'),10); var scenes2=LightRefStorage.listScenes(); for (var i=0;i<scenes2.length;i++) if (scenes2[i].id===id) { applyScene(scenes2[i].state); backToStudio(); } }; });
        }
    }
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
    function collectState() {
        var lights = scene.lightManager.lights.map(function (l){ return {name:l.name,color:l.color,intensity:l.intensity,azimuth:l.azimuth,elevation:l.elevation,enabled:l.enabled,softness:l.softness,sourceSize:l.sourceSize,}; });
        var matParams = scene.getMaterialParams ? scene.getMaterialParams() : null;
        var mp = {}; if (matParams) { for (var k in matParams) if (matParams.hasOwnProperty(k)) mp[k] = matParams[k]; }
        var ms = $('#model-select');
        return {
            model: ms ? ms.value : null,
            rotation: scene.getModelRotation ? scene.getModelRotation() : null,
            background: scene.getBackground ? scene.getBackground() : null,
            lights: lights,
            fx: scene.postfx.getParams(),
            focal: scene.getFocalLength(),
            projection: scene.getProjection ? scene.getProjection() : 'persp',
            material: scene.getMaterial(),
            materialParams: mp,
            formColor: scene.getFormColor ? scene.getFormColor() : null,
            environment: scene.getEnvironment ? scene.getEnvironment() : null,
            envIntensity: scene.getEnvIntensity ? scene.getEnvIntensity() : null
        };
    }
    function applyScene(state) {
        if (!state) return;
        function applyRest() {
            if (state.material) scene.setMaterial(state.material);
            if (state.materialParams && scene.setMaterialParam) {
                for (var k in state.materialParams) if (state.materialParams.hasOwnProperty(k)) scene.setMaterialParam(k, state.materialParams[k]);
            }
            if (state.formColor && scene.setFormColor) scene.setFormColor(state.formColor);
            if (state.rotation && scene.setModelRotation) {
                scene.setModelRotation(state.rotation.yaw||0, state.rotation.pitch||0);
                if (scene.setModelRoll && state.rotation.roll != null) scene.setModelRoll(state.rotation.roll);
            }
            if (state.background && scene.setBackground) {
                var tr = state.background.transparent;
                scene.setBackground(tr ? 'transparent' : 'color', state.background.color || '#3a4a6a');
                var vp = $('.lr04-viewport'); if (vp) vp.classList.toggle('transparent', !!tr);
            }
            if (state.projection && scene.setProjection) scene.setProjection(state.projection);
            if (state.focal) scene.setFocalLength(state.focal);
            if (scene.setEnvironment) scene.setEnvironment(state.environment || null);
            if (state.envIntensity != null && scene.setEnvIntensity) scene.setEnvIntensity(state.envIntensity);
            var ex = scene.lightManager.lights.slice(); ex.forEach(function(l){ scene.lightManager.remove(l.id); });
            (state.lights||[]).forEach(function(ld){ scene.lightManager.add(ld); });
            selectLight(scene.lightManager.lights.length?scene.lightManager.lights[0].id:null);
            if (state.fx) scene.postfx.applyParams(state.fx);
            syncMaterialPopover();
            renderTab();
        }
        var ms = $('#model-select');
        if (state.model) { if (ms) ms.value = state.model; loadModel(state.model, applyRest); }
        else { applyRest(); }
    }

})();


