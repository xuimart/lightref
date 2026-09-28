/*
 * panel.js - controlador da UI v0.4 (layout FormBox). ASCII-only.
 * Estrutura: paginas (3D/Biblioteca/Cenas) + abas de propriedade (Forma/Luz/Lente)
 * cujo conteudo e injetado dinamicamente em #lf-controls. Ajustes num dialogo.
 * Toda a logica 3D fica no LightRefScene (Babylon).
 */
(function () {
    'use strict';

    var scene = null, selectedLightId = null, exportMode = 'raster';
    var currentTab = 'form', currentPage = 'studio';
    function $(s, ctx) { return (ctx || document).querySelector(s); }
    function $all(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }

    // yaw: rotacao inicial em Y (graus) para o modelo abrir de frente.
    // Alguns modelos exportam virados; ajuste aqui qual comeca girado.
    var MODELS = [
        { v:'models/asaro.obj', t:'Asaro', yaw:0 },
        { v:'models/ecorche.obj', t:'Ecorche', yaw:0 },
        { v:'models/cabeca-homem.obj', t:'Cabeca Homem', yaw:0 },
        { v:'models/cabeca-mulher.obj', t:'Cabeca Mulher', yaw:0 },
        { v:'models/cabeca-mulher-face.obj', t:'Rosto Mulher', yaw:0 },
        { v:'models/cabeca-anime.obj', t:'Cabeca Anime', yaw:0 },
        { v:'models/cabeca-semi-realista.obj', t:'Cabeca Semi Realista', yaw:0 },
        { v:'models/busto-mulher.obj', t:'Busto Mulher', yaw:0 },
        { v:'models/torso-masculino.obj', t:'Torso Masculino', yaw:0 },
        { v:'models/torso-mulher.obj', t:'Torso Mulher', yaw:0 },
        { v:'models/homem-romano.obj', t:'Homem Romano', yaw:0 },
        { v:'models/mulher-romana.obj', t:'Mulher Romana', yaw:0 },
        { v:'models/tecido-mulher.obj', t:'Tecido em Mulher', yaw:0 },
        { v:'models/furry.stl', t:'Furry', yaw:0 }
    ];
    function modelYaw(url) { for (var i=0;i<MODELS.length;i++) if (MODELS[i].v===url) return MODELS[i].yaw||0; return 0; }
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

    document.addEventListener('DOMContentLoaded', function () {
        try { var cfg = LightRefStorage.readConfig(); if (cfg.exportMode) exportMode = cfg.exportMode; } catch (e) {}
        fillModelSelect();
        initScene();
        bindTopbar();
        bindViewTools();
        bindTabs();
        bindPages();
        bindDialog();
        setupUpdates();
        if (scene.onTransformChanged) scene.onTransformChanged(function () { if (currentTab === 'pos') renderTab(); });
        if (scene.onLightShortcut) scene.onLightShortcut(function (phase, light) {
            if (phase === 'drag' && currentTab === 'light' && light) {
                // Atualiza os sliders da luz principal ao vivo, sem re-renderizar tudo.
                if (selectedLightId === light.id) {
                    var az = document.getElementById('sl-azimuth'), el = document.getElementById('sl-elevation');
                    if (az) { az.value = light.azimuth; var ao = document.getElementById('sl-azimuth-o'); if (ao) ao.textContent = light.azimuth + '\u00b0'; }
                    if (el) { el.value = light.elevation; var eo = document.getElementById('sl-elevation-o'); if (eo) eo.textContent = light.elevation + '\u00b0'; }
                }
            }
            if (phase === 'end' && currentTab === 'light') renderTab();
        });
        renderTab();
    });

    function fillModelSelect() {
        var sel = $('#model-select'); sel.innerHTML = '';
        MODELS.forEach(function (m) { var o = document.createElement('option'); o.value = m.v; o.textContent = m.t; sel.appendChild(o); });
    }

    function initScene() {
        scene = new LightRefScene($('#gl-canvas'));
        scene.init();
        setTimeout(function () { scene.engine.resize(); }, 60);
        var cfg = {}; try { cfg = LightRefStorage.readConfig(); } catch (e) {}
        if (cfg.material) scene.setMaterial(cfg.material);
        if (cfg.environment && scene.setEnvironment) scene.setEnvironment(cfg.environment);
        loadModelSafe(cfg.lastModel || MODELS[0].v);
        // Luz inicial.
        var l = scene.lightManager.add({ name: nextLightName() });
        selectedLightId = l.id;
    }

    // Carrega com fallback: se o modelo salvo falhar (ex: arquivo removido),
    // volta para o primeiro modelo padrao para a cena nunca ficar vazia.
    function loadModelSafe(url) {
        loadModel(url, null, function () {
            if (url !== MODELS[0].v) { loadModel(MODELS[0].v); }
        });
    }
    function loadModel(url, done, onFail) {
        showLoading(true);
        scene.loadOBJ(url, function (p) { $('#loading-pct').textContent = p + '%'; },
        function (err) {
            showLoading(false);
            if (err) { feedback('Falha ao carregar', true); if (onFail) onFail(err); return; }
            // Orienta o modelo para a frente (alguns exportam virados).
            var y = modelYaw(url);
            if (y && scene.setModelRotation) scene.setModelRotation(y, 0);
            if (currentTab === 'form' || currentTab === 'pos') renderTab();
            // Captura um preview do modelo (apos 1 render) e guarda no config.
            setTimeout(function () {
                try {
                    var thumb = scene.thumbnailDataURL();
                    var cfg = LightRefStorage.readConfig();
                    cfg.modelThumbs = cfg.modelThumbs || {};
                    cfg.modelThumbs[url] = thumb;
                    LightRefStorage.writeConfig({ modelThumbs: cfg.modelThumbs });
                } catch (e) {}
            }, 400);
            if (done) done();
        });
    }
    function showLoading(on) { $('#loading-overlay').style.display = on ? 'flex' : 'none'; if (on) $('#loading-pct').textContent = '0%'; }
    function feedback(msg, err) { var f = $('#status-msg'); f.textContent = msg; f.style.color = err ? '#ff6a6a' : '#8fd39a'; setTimeout(function(){ f.textContent = footerLabel(); f.style.color=''; }, 3500); }
    // Rotulo do rodape com a versao atual (vinda do modulo de update).
    function footerLabel() { var v = (window.LightRefUpdate && window.LightRefUpdate.VERSION) ? window.LightRefUpdate.VERSION : '0.4'; return 'LightRef v' + v; }
    // Toast simples reutilizando a area de feedback (usado pelo update manual).
    window.LightRefToast = function (msg) { feedback(msg, false); };
    // Liga o check de atualizacao: rodape mostra a versao e serve de botao
    // de verificacao manual; um check silencioso roda ao abrir o painel.
    function setupUpdates() {
        var f = $('#status-msg');
        if (f) {
            f.textContent = footerLabel();
            f.style.cursor = 'pointer';
            f.title = 'Clique para verificar atualizacoes';
            f.addEventListener('click', function () {
                if (window.LightRefUpdate) { feedback('Verificando atualizacoes...', false); window.LightRefUpdate.check(true); }
            });
        }
        // Check silencioso ao abrir (nunca bloqueia).
        setTimeout(function () { if (window.LightRefUpdate) window.LightRefUpdate.check(false); }, 1500);
    }

    // ---------- Topbar ----------
    function bindTopbar() {
        $('#model-select').addEventListener('change', function () {
            loadModel(this.value); try { LightRefStorage.writeConfig({ lastModel: this.value }); } catch (e) {}
        });
        $all('.lf-projection button').forEach(function (b) {
            b.addEventListener('click', function () {
                $all('.lf-projection button').forEach(function (x){ x.setAttribute('aria-pressed','false'); });
                this.setAttribute('aria-pressed','true');
                scene.setProjection(this.getAttribute('data-projection') === 'ortho' ? 'ortho' : 'persp');
            });
        });
        bindAction('save', saveScenePrompt);
        bindAction('import', function () { $('#file-input').setAttribute('data-import','1'); $('#file-input').click(); });
        bindAction('reset', function () { scene.setCameraPreset('front'); });
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

    // ---------- View tools ----------
    function bindViewTools() {
        bindAction('camera', function () { scene.setCameraPreset('front'); });
        var floor = true; bindAction('floor', function (b) { floor = !floor; scene.setGroundVisible(floor); b.setAttribute('aria-pressed', floor); });
        var guides = true; bindAction('guides', function (b) { guides = !guides; scene.lightManager.setHelpersVisible(guides); b.setAttribute('aria-pressed', guides); });
        var ref = false; bindAction('reference', function (b) { ref = !ref; $('#lightref .lf-panel').classList.toggle('lf-reference', ref); b.setAttribute('aria-pressed', ref); setTimeout(function(){ scene.engine.resize(); }, 80); });
        bindAction('help', function () { openDialog('Como usar', '<p>Arraste no visor para girar. Adicione luzes na aba Luz. Escolha material e ajuste os sliders na aba Forma. A lente controla a perspectiva. Clique em Jogar como camada para enviar ao Photoshop.</p>'); });
        bindAction('collapse', function () { $('#lightref .lf-panel').classList.toggle('lf-collapsed'); });
    }
    function bindAction(name, fn) {
        $all('[data-action="' + name + '"]').forEach(function (b) { b.addEventListener('click', function () { fn(b); }); });
    }

    // ---------- Abas ----------
    function bindTabs() {
        $all('.lf-tabs button').forEach(function (b) {
            b.addEventListener('click', function () {
                $all('.lf-tabs button').forEach(function (x){ x.setAttribute('aria-pressed','false'); });
                this.setAttribute('aria-pressed','true');
                var prev = currentTab;
                currentTab = this.getAttribute('data-tab');
                if (prev === 'pos' && currentTab !== 'pos' && scene.setGizmoMode) scene.setGizmoMode('off');
                renderTab();
            });
        });
        bindAction('photoshop-menu', openExportMenu);
    }

    // Renderiza o conteudo da aba atual dentro de #lf-controls.
    function renderTab() {
        var c = $('#lf-controls'); if (!c) return;
        if (currentTab === 'form') c.innerHTML = tplForm();
        else if (currentTab === 'light') c.innerHTML = tplLight();
        else if (currentTab === 'lens') c.innerHTML = tplLens();
        else if (currentTab === 'adjust') c.innerHTML = tplAdjust();
        else if (currentTab === 'pos') c.innerHTML = tplPos();
        wireTab();
    }

    // ---------- Templates ----------
    function row(label, id, min, max, step, val, suffix) {
        return '<div class="lf-row"><span>' + label + '</span>' +
               '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
               '<output id="' + id + '-o">' + val + (suffix||'') + '</output></div>';
    }
    function tplForm() {
        var p = scene.getMaterialParams ? scene.getMaterialParams() : {};
        var matOpts = MATERIALS.map(function (m) { return '<option value="'+m.v+'"'+(m.v===scene.getMaterial()?' selected':'')+'>'+m.t+'</option>'; }).join('');
        return '<div class="lf-setup"><span>Material</span>' +
               '<select id="material-select">' + matOpts + '</select>' +
               '<input type="color" id="form-color" value="' + scene.getFormColor() + '"></div>' +
               row('Rugosidade','sl-roughness',0,1,0.01, fx2(p.roughness), '') +
               row('Metalico','sl-metalness',0,1,0.01, fx2(p.metalness), '') +
               row('Especular','sl-specular',0,1,0.01, fx2(p.specular), '') +
               row('Reflexo','sl-reflection',0,2,0.02, fx2(p.reflection), '') +
               row('Subsurface','sl-subsurface',0,1,0.01, fx2(p.subsurface), '') +
               '<div class="lf-colorrow"><span>Cor scatter</span><span></span><input type="color" id="scatter-color" value="' + (p.scatter||'#c65b4e') + '"></div>' +
               (function(){ var bg = scene.getBackground();
                   return '<div class="lf-colorrow"><span>Fundo</span>' +
                          '<label class="lf-check" style="justify-self:start"><input type="checkbox" id="bg-transp"'+(bg.transparent?' checked':'')+'> Transparente</label>' +
                          '<input type="color" id="bg-color" value="'+(bg.color||'#3a4a6a')+'"></div>';
               })();
    }
    // Aba Posicao: corrige modelos importados tortos.
    function tplPos() {
        var off = scene.getModelOffset ? scene.getModelOffset() : {x:0,y:0,z:0};
        var sc = scene.getModelScaleMult ? scene.getModelScaleMult() : 1;
        var roll = scene.getModelRoll ? scene.getModelRoll() : 0;
        var rot = scene.getModelRotation ? scene.getModelRotation() : {yaw:0};
        var gm = scene.getGizmoMode ? scene.getGizmoMode() : 'off';
        return '<div class="lf-section-label" style="border:0;padding-top:0;margin-top:0">Gizmo no visor</div>' +
               '<div class="lf-projection" style="width:100%;margin-bottom:12px">' +
               '<button data-gizmo="rotate" aria-pressed="'+(gm==='rotate')+'" style="flex:1">Rotacionar</button>' +
               '<button data-gizmo="move" aria-pressed="'+(gm==='move')+'" style="flex:1">Mover</button>' +
               '<button data-gizmo="off" aria-pressed="'+(gm==='off')+'" style="flex:1">Desligar</button></div>' +
               '<div class="lf-section-label">Ajuste por sliders</div>' +
               row('Girar','sl-yaw',-180,180,1, rot.yaw||0, '\u00b0') +
               row('Altura','sl-offy',-3,3,0.02, fx2(off.y), '') +
               row('Horizontal','sl-offx',-3,3,0.02, fx2(off.x), '') +
               row('Profundidade','sl-offz',-3,3,0.02, fx2(off.z), '') +
               row('Escala','sl-mscale',0.2,3,0.02, fx2(sc), 'x') +
               row('Inclinar Z','sl-roll',-180,180,1, roll, '\u00b0') +
               '<button id="reset-transform" class="lf-mini-btn">Centralizar / resetar</button>';
    }
    function tplLight() {
        var chips = scene.lightManager.lights.map(function (l) {
            return '<div class="lf-chip'+(l.id===selectedLightId?' active':'')+'" data-id="'+l.id+'">' +
                   '<button data-light="'+l.id+'"><span class="lf-dot" style="background:'+l.color+'"></span>'+l.name+'</button>' +
                   '<button data-remove="'+l.id+'" title="Remover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>';
        }).join('');
        var html = '<div class="lf-chips">' + chips + '<button id="add-light" class="lf-chip" style="padding:4px 10px" title="Adicionar luz">+</button></div>';
        var l = selectedLightId != null ? scene.lightManager.get(selectedLightId) : null;
        if (l) {
            html += '<div class="lf-colorrow"><span>Cor</span><span></span><input type="color" id="l-color" value="'+l.color+'"></div>' +
                    row('Intensidade','sl-intensity',0,10,0.1, l.intensity, '') +
                    row('Girar','sl-azimuth',0,360,1, l.azimuth, '\u00b0') +
                    row('Altura','sl-elevation',-90,90,1, l.elevation, '\u00b0');
        } else {
            html += '<div class="lf-empty">Nenhuma luz. Clique em + para adicionar.</div>';
        }
        return html;
    }
    function tplLens() {
        var f = scene.getFocalLength();
        var curEnv = scene.getEnvironment ? (scene.getEnvironment()||'') : '';
        var envUrl = curEnv ? curEnv.replace(/^.*\/(env\/)/,'$1') : '';
        var envOpts = ENVIRONMENTS.map(function (e) {
            var sel = (e.v && curEnv.indexOf(e.v) >= 0) || (!e.v && !curEnv);
            return '<option value=\"'+e.v+'\"'+(sel?' selected':'')+'>'+e.t+'</option>';
        }).join('');
        var ei = scene.getEnvIntensity ? scene.getEnvIntensity() : 0.8;
        return row('Lente','sl-focal',10,300,1, f, 'mm') +
               '<div class=\"lf-formrow\"><span>Projecao</span><div class=\"lf-projection\" style=\"width:fit-content\">' +
               '<button data-lproj=\"persp\" aria-pressed=\"'+(scene.getProjection()==='persp')+'\">Persp</button>' +
               '<button data-lproj=\"ortho\" aria-pressed=\"'+(scene.getProjection()==='ortho')+'\">Orto</button></div></div>' +
               '<div class=\"lf-section-label\">Ambiente / HDR</div>' +
               '<div class=\"lf-formrow\"><span>Mapa</span><select id=\"env-select\" style=\"flex:1\">'+envOpts+'</select></div>' +
               row('Intensidade','sl-envint',0,2,0.05, (ei).toFixed(2), '') +
               '<div class=\"lf-check\"><input type=\"checkbox\" id=\"ck-envbg\" checked> Mostrar fundo do HDR</div>';
    }
    function tplAdjust() {
        var p = scene.postfx.getParams();
        return row('Exposicao','sl-exposure',-3,3,0.05, fx2(p.exposure), '') +
               row('Contraste','sl-contrast',-1,1,0.02, fx2(p.contrast), '') +
               row('Temperatura','sl-temperature',-1,1,0.02, fx2(p.temperature), '') +
               row('Saturacao','sl-saturation',0,2,0.02, fx2(p.saturation), '') +
               '<div class="lf-check"><input type="checkbox" id="ck-bw"'+(p.blackWhite?' checked':'')+'> Preto e branco</div>' +
               '<div class="lf-check"><input type="checkbox" id="ck-posterize"'+(p.posterizeOn?' checked':'')+'> Posterizar</div>' +
               row('Niveis','sl-posterize',2,16,1, p.posterizeLevels, '') +
               '<div class="lf-check"><input type="checkbox" id="ck-cutout"'+(p.cutoutOn?' checked':'')+'> Cutout</div>' +
               row('Degraus','sl-cutout',2,8,1, p.cutoutLevels, '') +
               '<button id="reset-fx" style="width:100%;margin-top:10px;background:#303136;border:1px solid #3e4046;border-radius:6px;color:#e1e2e6;min-height:34px">Zerar ajustes</button>';
    }
    function fx2(v) { return (v == null ? 0 : v).toFixed ? (+v).toFixed(2) : v; }

    // Liga os controles recem-injetados.
    function wireTab() {
        // sliders genericos: atualiza output
        $all('#lf-controls input[type=range]').forEach(function (r) {
            updateRangeFill(r);
            r.addEventListener('input', function () { updateRangeFill(r); onRange(r.id, r.value); var o = $('#'+r.id+'-o'); if (o) o.textContent = r.value + (r.id==='sl-focal'?'mm':(r.id==='sl-azimuth'||r.id==='sl-elevation'?'\u00b0':'')); });
        });
        if (currentTab === 'form') {
            $('#material-select').addEventListener('change', function () { scene.setMaterial(this.value); try{LightRefStorage.writeConfig({material:this.value});}catch(e){} renderTab(); });
            $('#form-color').addEventListener('input', function () { scene.setFormColor(this.value); });
            var sc = $('#scatter-color'); if (sc) sc.addEventListener('input', function () { scene.setMaterialParam('scatter', this.value); });
            var bgc = $('#bg-color'), bgt = $('#bg-transp');
            function applyBg(){ var tr = bgt && bgt.checked; scene.setBackground(tr ? 'transparent' : 'color', bgc ? bgc.value : '#3a4a6a'); var st = document.querySelector('.lf-stage'); if (st) st.classList.toggle('transparent', tr); }
            if (bgc) bgc.addEventListener('input', applyBg);
            if (bgt) bgt.addEventListener('change', applyBg);

        } else if (currentTab === 'light') {
            var add = $('#add-light'); if (add) add.addEventListener('click', function () { var nl = scene.lightManager.add({ name: nextLightName() }); selectedLightId = nl.id; renderTab(); });
            $all('#lf-controls [data-light]').forEach(function (b) { b.addEventListener('click', function () { selectedLightId = parseInt(this.getAttribute('data-light'),10); renderTab(); }); });
            $all('#lf-controls [data-remove]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); var id = parseInt(this.getAttribute('data-remove'),10); scene.lightManager.remove(id); if (selectedLightId===id) selectedLightId = scene.lightManager.lights.length?scene.lightManager.lights[0].id:null; renderTab(); }); });
            var lc = $('#l-color'); if (lc) lc.addEventListener('input', function () { scene.lightManager.update(selectedLightId,'color',this.value); var dot = $('#lf-controls [data-light=\"'+selectedLightId+'\"] .lf-dot'); if (dot) dot.style.background = this.value; });
        } else if (currentTab === 'lens') {
            var es = $('#env-select'); if (es) es.addEventListener('change', function () {
                var v = this.value;
                if (scene.setEnvironment) scene.setEnvironment(v || null, { showBackground: ($('#ck-envbg')||{}).checked !== false });
                try { LightRefStorage.writeConfig({ environment: v }); } catch (e) {}
            });
            var ceb = $('#ck-envbg'); if (ceb) ceb.addEventListener('change', function () { if (scene.setEnvBackgroundVisible) scene.setEnvBackgroundVisible(this.checked); });
            $all('#lf-controls [data-lproj]').forEach(function (b) { b.addEventListener('click', function () { var mode=this.getAttribute('data-lproj'); scene.setProjection(mode); $all('#lf-controls [data-lproj]').forEach(function(x){x.setAttribute('aria-pressed','false');}); this.setAttribute('aria-pressed','true'); $all('.lf-projection button[data-projection]').forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-projection')===mode); }); }); });
        } else if (currentTab === 'adjust') {
            var bw = $('#ck-bw'); if (bw) bw.addEventListener('change', function(){ scene.postfx.setParam('blackWhite', this.checked?1:0); });
            var po = $('#ck-posterize'); if (po) po.addEventListener('change', function(){ scene.postfx.setParam('posterizeOn', this.checked?1:0); });
            var co = $('#ck-cutout'); if (co) co.addEventListener('change', function(){ scene.postfx.setParam('cutoutOn', this.checked?1:0); });
            var rf = $('#reset-fx'); if (rf) rf.addEventListener('click', function(){ scene.postfx.reset(); renderTab(); });
        } else if (currentTab === 'pos') {
            $all('#lf-controls [data-gizmo]').forEach(function (b) { b.addEventListener('click', function () {
                var m = this.getAttribute('data-gizmo'); scene.setGizmoMode(m);
                $all('#lf-controls [data-gizmo]').forEach(function(x){ x.setAttribute('aria-pressed', x.getAttribute('data-gizmo')===m); });
            }); });
            var rt = $('#reset-transform');
            if (rt) rt.addEventListener('click', function () {
                scene.setModelOffset('x',0); scene.setModelOffset('y',0); scene.setModelOffset('z',0);
                scene.setModelScaleMult(1); scene.setModelRoll(0); scene.setModelRotation(0, 0);
                renderTab();
            });
        }
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
            case 'sl-posterize': scene.postfx.setParam('posterizeLevels', parseInt(value,10)); break;
            case 'sl-cutout': scene.postfx.setParam('cutoutLevels', parseInt(value,10)); break;
            case 'sl-yaw': scene.setModelRotation(parseInt(value,10), scene.getModelRotation().pitch||0); break;
            case 'sl-offy': scene.setModelOffset('y', v); break;
            case 'sl-offx': scene.setModelOffset('x', v); break;
            case 'sl-offz': scene.setModelOffset('z', v); break;
            case 'sl-mscale': scene.setModelScaleMult(v); break;
            case 'sl-roll': scene.setModelRoll(parseInt(value,10)); break;
        }
    }

    // ---------- Paginas ----------
    function bindPages() {
        $all('.lf-mainnav button').forEach(function (b) {
            b.addEventListener('click', function () {
                $all('.lf-mainnav button').forEach(function (x){ x.setAttribute('aria-pressed','false'); });
                this.setAttribute('aria-pressed','true');
                currentPage = this.getAttribute('data-page');
                showPage(currentPage);
            });
        });
    }
    function showPage(page) {
        var isStudio = (page === 'studio');
        $('.lf-tray').hidden = !isStudio;
        $('#lf-catalog').hidden = isStudio;
        if (!isStudio) renderCatalog(page);
    }
    function renderCatalog(page) {
        var cat = $('#lf-catalog');
        if (page === 'library') {
            var icon = '<div class="lf-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg></div>';
            var thumbs = {}; try { thumbs = LightRefStorage.readConfig().modelThumbs || {}; } catch (e) {}
            function preview(url) { return thumbs[url] ? '<img src="'+thumbs[url]+'">' : icon; }
            // Modelos padrao do programa.
            var defCards = MODELS.map(function (m) { return '<button class="lf-card" data-defurl="'+m.v+'">'+preview(m.v)+'<strong>'+m.t+'</strong><small>Padrao</small></button>'; }).join('');
            // Modelos importados pelo usuario.
            var mine; try { mine = LightRefStorage.listModels(); } catch (e) { mine = []; }
            var myCards = mine.map(function (m) { var u = LightRefStorage.modelFileURL(m); return '<button class="lf-card" data-model="'+m.id+'">'+preview(u)+'<strong>'+m.name+'</strong><small>Meu ('+(m.ext||'').replace('.','')+')</small></button>'; }).join('');
            cat.innerHTML = '<h3>Modelos do programa</h3><div class="lf-grid">'+defCards+'</div>' +
                            '<h3 style="margin-top:16px">Meus modelos</h3>' + (myCards ? '<div class="lf-grid">'+myCards+'</div>' : '<div class="lf-empty">Nenhum importado. Use Importar no topo.</div>');
            $all('#lf-catalog [data-defurl]').forEach(function (b) { b.addEventListener('click', function () { var u=this.getAttribute('data-defurl'); $('#model-select').value=u; loadModel(u); backToStudio(); }); });
            $all('#lf-catalog [data-model]').forEach(function (b) { b.addEventListener('click', function () { var id=parseInt(this.getAttribute('data-model'),10); var models=LightRefStorage.listModels(); for (var i=0;i<models.length;i++) if (models[i].id===id) { loadModel(LightRefStorage.modelFileURL(models[i])); backToStudio(); } }); });
        } else if (page === 'scenes') {
            var scenes; try { scenes = LightRefStorage.listScenes(); } catch (e) { scenes = []; }
            var cards = scenes.map(function (s) { return '<button class="lf-card" data-scene="'+s.id+'">'+(s.thumb?'<img src="'+s.thumb+'">':'<div class="lf-placeholder"></div>')+'<strong>'+s.name+'</strong></button>'; }).join('');
            cat.innerHTML = '<h3>Cenas salvas</h3>' + (cards ? '<div class="lf-grid">'+cards+'</div>' : '<div class="lf-empty">Nenhuma cena salva. Salve pela ferramenta de salvar no topo.</div>');
            $all('#lf-catalog [data-scene]').forEach(function (b) { b.addEventListener('click', function () { var id=parseInt(this.getAttribute('data-scene'),10); var scenes=LightRefStorage.listScenes(); for (var i=0;i<scenes.length;i++) if (scenes[i].id===id) { applyScene(scenes[i].state); backToStudio(); } }); });
        }
    }
    function backToStudio() {
        currentPage = 'studio';
        $all('.lf-mainnav button').forEach(function (x){ x.setAttribute('aria-pressed', x.getAttribute('data-page')==='studio'); });
        showPage('studio');
    }

    // ---------- Dialogo ----------
    function bindDialog() { bindAction('close', closeDialog); }
    function openDialog(title, bodyHtml) { $('#lf-dialog-title').textContent = title; $('#lf-dialog-body').innerHTML = bodyHtml; $('#lf-dialog').hidden = false; }
    function closeDialog() { $('#lf-dialog').hidden = true; }
    // Export direto (rasterizado, alta resolucao). Camadas de ajuste foi arquivado.
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
        openDialog('Salvar cena', '<div class="lf-setup"><span>Nome</span><input type="text" id="scene-name" class="form-control" style="background:#303136;border:1px solid #3e4046;border-radius:6px;color:#e1e2e6;height:34px;padding:0 9px"><button id="do-save">Salvar</button></div>');
        $('#do-save').addEventListener('click', function () {
            var name = ($('#scene-name').value||'').trim(); if (!name) return;
            try { var thumb = scene.thumbnailDataURL(); LightRefStorage.saveScene(name, collectState(), thumb); feedback('Cena salva'); closeDialog(); } catch (e) { feedback('Falha ao salvar', true); }
        });
    }
    function collectState() {
        var lights = scene.lightManager.lights.map(function (l){ return {name:l.name,color:l.color,intensity:l.intensity,azimuth:l.azimuth,elevation:l.elevation,enabled:l.enabled}; });
        return { model: $('#model-select').value, rotation: scene.getModelRotation(), background: scene.getBackground(),
                 lights: lights, fx: scene.postfx.getParams(), focal: scene.getFocalLength(), material: scene.getMaterial() };
    }
    function applyScene(state) {
        if (!state) return;
        if (state.model) { $('#model-select').value = state.model; loadModel(state.model); }
        if (state.material) scene.setMaterial(state.material);
        if (state.focal) scene.setFocalLength(state.focal);
        var ex = scene.lightManager.lights.slice(); ex.forEach(function(l){ scene.lightManager.remove(l.id); });
        (state.lights||[]).forEach(function(ld){ scene.lightManager.add(ld); });
        selectedLightId = scene.lightManager.lights.length?scene.lightManager.lights[0].id:null;
        if (state.fx) scene.postfx.applyParams(state.fx);
        renderTab();
    }


})();
