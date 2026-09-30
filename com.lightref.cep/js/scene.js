/*
 * scene.js - motor 3D do LightRef sobre Babylon.js. ASCII-only comments.
 * Mantem a MESMA API publica que o panel.js ja usava (loadOBJ, setMaterial,
 * setBackground, setModelRotation, setCameraPreset, setFocalLength, setProjection,
 * snapshotDataURL, thumbnailDataURL, lightManager, postfx, getMannequin...).
 *
 * Babylon da PBR completo e subsurface real (subSurface.isTranslucencyEnabled),
 * tone mapping ACES e image processing nativo (resolve o bug de gamma dos ajustes).
 */
(function (global) {
    'use strict';

    function Scene(canvas) {
        this.canvas = canvas;
        this.engine = null; this.scene = null; this.camera = null;
        this.lightManager = null; this.postfx = null; this.mannequin = null;
        this.modelRoot = null; this.ground = null; this.env = null;
        this._materialType = 'clay'; this._formColor = null;
        this._matParams = null;
        this._bgColor = '#3a4a6a'; this._bgTransparent = false;
        this._projection = 'persp'; this._focalMM = 50;
        this._yaw = 0; this._pitch = 0;
        // Composicao: objetos independentes numa 'cena' separada do modelo principal.
        this.sceneObjects = []; this._objId = 1; this._selectedObj = null;
        this._compHidden = true;
    }

    function hexToColor3(hex) { var c = BABYLON.Color3.FromHexString(hex); return c; }

    Scene.prototype.init = function () {
        var self = this;
        this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, alpha: true, adaptToDeviceRatio: false, powerPreference: 'high-performance' });
        // Nao renderizar acima de 1x (CEF pode reportar devicePixelRatio alto e travar).
        this.engine.setHardwareScalingLevel(1);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.skipPointerMovePicking = true; // evita picking custoso a cada mousemove
        this.scene.clearColor = BABYLON.Color4.FromHexString(this._bgColor + 'ff');

        // Ambiente para reflexos PBR (cria um env procedural simples).
        this.env = this.scene.createDefaultEnvironment ? null : null;
        this._buildEnv();

        // Camera orbital (ArcRotate): alfa/beta em torno do alvo, raio = zoom.
        this.camera = new BABYLON.ArcRotateCamera('cam', -Math.PI/2, Math.PI/2.2, 5, new BABYLON.Vector3(0, 0.3, 0), this.scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 0.5; this.camera.upperRadiusLimit = 200;
        this.camera.wheelDeltaPercentage = 0.01; this.camera.minZ = 0.05;
        this.camera.inertia = 0.6;               // suaviza a orbita
        this.camera.angularSensibilityX = 400;   // resposta do arraste (menor = mais rapido)
        this.camera.angularSensibilityY = 400;
        this.camera.panningSensibility = 250;    // pan com o botao direito reativado
        this.camera.panningInertia = 0.6;
        this.camera.useNaturalPinchZoom = true;
        this.camera.fov = this._fovFromFocal(this._focalMM);

        // image processing da cena: o postfx.js configura exposure/contrast etc.
        // Nao desabilitar aqui - o postfx habilita e usa na sua inicializacao.

        // Fill ambiente minimo: sem luzes do usuario a cena fica praticamente escura.
        this.ambient = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), this.scene);
        this.ambient.intensity = 0.012;
        this.ambient.diffuse = new BABYLON.Color3(1, 1, 1);
        this.ambient.groundColor = new BABYLON.Color3(0.05, 0.05, 0.06);
        // Ambiente PBR (reflexos) tambem baixo, senao ilumina sem luz.
        this.scene.environmentIntensity = 0.08;

        this._buildGround();
        this.lightManager = new LightManager(this.scene);
        this.postfx = new LightRefPostFX(this.scene, this.camera, this.engine);

        this.engine.runRenderLoop(function () { self.scene.render(); });
        this._bindXformPointer();
        window.addEventListener('resize', function () { self.engine.resize(); });
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(function () { self.engine.resize(); });
            this._ro.observe(this.canvas.parentNode || this.canvas);
        }
        this._resizePoll = setInterval(function () { self.engine.resize(); }, 500);

        // Atalho: segurar SHIFT e arrastar gira a LUZ PRINCIPAL (primeira luz).
        // Enquanto o Shift esta pressionado, a camera nao orbita.
        this._bindLightShortcut();
    };

    Scene.prototype._buildEnv = function () {
        // Textura de ambiente procedural: um gradiente em cubo para reflexos.
        // Usamos um HDR-like simples via CreateDefault se disponivel; senao cor.
        try {
            var tex = new BABYLON.Texture('data:lightref-env', this.scene); // placeholder
        } catch (e) {}
        // Ambiente neutro: define environmentIntensity global.
        this.scene.environmentIntensity = 0.8;
    };

    Scene.prototype._fovFromFocal = function (mm) {
        // FOV vertical a partir da distancia focal (sensor full-frame 36mm).
        mm = Math.max(10, Math.min(300, mm));
        return 2 * Math.atan(24 / (2 * mm)); // 24mm altura do sensor
    };

    Scene.prototype._buildGround = function () {
        var g = BABYLON.MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, this.scene);
        g.position.y = -1.5;
        // ShadowOnlyMaterial vive na lib de materiais (nao carregada). Usamos um
        // StandardMaterial escuro semi-transparente: so a sombra fica visivel.
        var m = new BABYLON.StandardMaterial('gmat', this.scene);
        // Chao cinza claro visivel: a area iluminada aparece e a sombra projetada
        // escurece sobre ela, dando contraste real (antes o chao preto escondia
        // a sombra, que 'escurecia' algo ja escuro).
        m.diffuseColor = new BABYLON.Color3(0.62, 0.62, 0.64);
        m.specularColor = new BABYLON.Color3(0, 0, 0);
        m.alpha = 0.85;
        g.material = m;
        g.receiveShadows = true;
        this.ground = g;
    };
    Scene.prototype.setGroundVisible = function (v) { if (this.ground) this.ground.setEnabled(v); };

    Scene.prototype.setBackground = function (mode, color) {
        if (color) this._bgColor = color;
        this._bgTransparent = (mode === 'transparent');
        if (this._bgTransparent) this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        else this.scene.clearColor = BABYLON.Color4.FromHexString(this._bgColor + 'ff');
    };
    Scene.prototype.getBackground = function () { return { transparent: this._bgTransparent, color: this._bgColor }; };

    // ---------- Ambiente / HDR ----------
    // Carrega um panorama equiretangular (jpg) como iluminacao de ambiente (IBL)
    // e, opcionalmente, como fundo (skybox). url=null limpa e volta ao fundo normal.
    Scene.prototype.setEnvironment = function (url, opts) {
        opts = opts || {};
        var showBg = (opts.showBackground !== false); // por padrao mostra o fundo
        // Limpa ambiente atual.
        if (!url) {
            if (this.scene.environmentTexture) { try { this.scene.environmentTexture.dispose(); } catch (e) {} this.scene.environmentTexture = null; }
            if (this._skybox) { try { this._skybox.dispose(); } catch (e) {} this._skybox = null; }
            this._envUrl = null;
            this._reapplyMaterial && this._reapplyMaterial();
            return;
        }
        this._envUrl = url;
        var self = this;
        try {
            var envTex = new BABYLON.EquiRectangularCubeTexture(url, this.scene, 512);
            this.scene.environmentTexture = envTex;
            // Skybox: esfera grande com a textura equiretangular por dentro.
            if (this._skybox) { try { this._skybox.dispose(); } catch (e) {} this._skybox = null; }
            if (showBg) {
                var sky = BABYLON.MeshBuilder.CreateSphere('skybox', { diameter: 100, sideOrientation: BABYLON.Mesh.BACKSIDE }, this.scene);
                var sm = new BABYLON.BackgroundMaterial('skymat', this.scene);
                var bgTex = new BABYLON.Texture(url, this.scene);
                bgTex.coordinatesMode = BABYLON.Texture.FIXED_EQUIRECTANGULAR_MODE;
                sm.reflectionTexture = bgTex;
                sm.reflectionTexture.coordinatesMode = BABYLON.Texture.FIXED_EQUIRECTANGULAR_MODE;
                sm.backFaceCulling = false;
                sm.disableLighting = true;
                sky.material = sm;
                sky.infiniteDistance = true;
                sky.isPickable = false;
                this._skybox = sky;
            }
            this._reapplyMaterial && this._reapplyMaterial();
        } catch (e) {}
    };
    Scene.prototype.getEnvironment = function () { return this._envUrl || null; };
    // Intensidade da luz de ambiente (0..2). Afeta o quanto o HDR ilumina.
    Scene.prototype.setEnvIntensity = function (v) {
        this._envIntensity = v;
        this.scene.environmentIntensity = v;
    };
    Scene.prototype.getEnvIntensity = function () { return (this._envIntensity != null) ? this._envIntensity : 0.8; };
    // Mostra/esconde so o fundo (skybox) sem tirar a iluminacao de ambiente.
    Scene.prototype.setEnvBackgroundVisible = function (on) {
        if (this._skybox) this._skybox.setEnabled(!!on);
    };

    Scene.prototype.setModelRotation = function (yaw, pitch) {
        this._yaw = yaw; this._pitch = pitch;
        this._applyTransform();
    };
    Scene.prototype.getModelRotation = function () { return { yaw: this._yaw || 0, pitch: this._pitch || 0, roll: this._roll || 0 }; };

    // Aplica a transform completa do pivot: base (normalizacao) + ajustes do usuario.
    Scene.prototype._applyTransform = function () {
        if (!this.modelRoot) return;
        var s = (this._baseScale || 1) * (this._scaleMult || 1);
        this.modelRoot.scaling = new BABYLON.Vector3(s, s, s);
        var bp = this._basePos || BABYLON.Vector3.Zero();
        var o = this._offset || { x:0, y:0, z:0 };
        this.modelRoot.position = new BABYLON.Vector3(bp.x + o.x, bp.y + o.y, bp.z + o.z);
        this.modelRoot.rotation = new BABYLON.Vector3((this._pitch||0)*Math.PI/180, (this._yaw||0)*Math.PI/180, (this._roll||0)*Math.PI/180);
    };

    // Ajuste fino de posicao (X/Y/Z) para corrigir modelos importados tortos.
    Scene.prototype.setModelOffset = function (axis, value) {
        if (!this._offset) this._offset = { x:0, y:0, z:0 };
        this._offset[axis] = value; this._applyTransform();
    };
    Scene.prototype.getModelOffset = function () { return this._offset || { x:0, y:0, z:0 }; };

    // Escala extra do usuario (multiplicador sobre a normalizacao).
    Scene.prototype.setModelScaleMult = function (m) { this._scaleMult = m; this._applyTransform(); };
    Scene.prototype.getModelScaleMult = function () { return this._scaleMult || 1; };

    // Roll (girar no eixo Z) - modelos as vezes vem deitados.
    Scene.prototype.setModelRoll = function (deg) { this._roll = deg; this._applyTransform(); };
    Scene.prototype.getModelRoll = function () { return this._roll || 0; };

    // ---------- Gizmo de transform (rotacao / movimento) ----------
    // Cria o GizmoManager sob demanda, numa camada utilitaria por cima da cena.
    Scene.prototype._ensureGizmo = function () {
        if (this._gizmo) return this._gizmo;
        this._gizmoLayer = new BABYLON.UtilityLayerRenderer(this.scene);
        this._gizmo = new BABYLON.GizmoManager(this.scene, 1, this._gizmoLayer);
        this._gizmo.usePointerToAttachGizmos = false;
        this._gizmo.rotationGizmoEnabled = false;
        this._gizmo.positionGizmoEnabled = false;
        return this._gizmo;
    };

    // mode: 'rotate' | 'move' | 'off'
    Scene.prototype.setGizmoMode = function (mode) {
        var g = this._ensureGizmo();
        var self = this;
        var rot = (mode === 'rotate'), pos = (mode === 'move');
        g.rotationGizmoEnabled = rot;
        g.positionGizmoEnabled = pos;
        this._gizmoMode = mode;
        // Escala fixa (nao cresce com a distancia nem com a escala do pivot).
        var rg = g.gizmos.rotationGizmo, pg = g.gizmos.positionGizmo;
        if (rg) { rg.updateScale = true; rg.scaleRatio = 0.7; }
        if (pg) { pg.updateScale = true; pg.scaleRatio = 0.7; }
        // Liga os observadores de arraste UMA vez por gizmo (cada um tem sua flag).
        if (rg && !rg._lrBound) {
            rg._lrBound = true;
            rg.onDragObservable.add(function () { self._syncFromAnchor(); });
            rg.onDragEndObservable.add(function () { self._syncFromAnchor(); if (self._onTransformChanged) self._onTransformChanged(); });
        }
        if (pg && !pg._lrBound) {
            pg._lrBound = true;
            pg.onDragObservable.add(function () { self._syncPosFromAnchor(); });
            pg.onDragEndObservable.add(function () { self._syncPosFromAnchor(); if (self._onTransformChanged) self._onTransformChanged(); });
        }
        if ((rot || pos) && this.modelRoot) {
            // Anchor SEM escala no centro do modelo, para o gizmo nao herdar a
            // escala do pivot (que variava por modelo). O anchor espelha para o pivot.
            if (!this._gizmoAnchor) {
                this._gizmoAnchor = new BABYLON.TransformNode('gizmoAnchor', this.scene);
            }
            var bp = this._basePos || BABYLON.Vector3.Zero();
            var o = this._offset || { x:0, y:0, z:0 };
            this._gizmoAnchor.position = new BABYLON.Vector3(bp.x+o.x, bp.y+o.y, bp.z+o.z);
            this._gizmoAnchor.rotationQuaternion = null; // usa euler ao re-semear
            this._gizmoAnchor.rotation = new BABYLON.Vector3((this._pitch||0)*Math.PI/180, (this._yaw||0)*Math.PI/180, (this._roll||0)*Math.PI/180);
            g.attachToNode(this._gizmoAnchor);
        } else {
            g.attachToNode(null);
        }
    };
    Scene.prototype.getGizmoMode = function () { return this._gizmoMode || 'off'; };

    // Copia a rotacao do anchor (mexido pelo gizmo) para o pivot do modelo.
    Scene.prototype._syncFromAnchor = function () {
        if (!this._gizmoAnchor || !this.modelRoot) return;
        var a = this._gizmoAnchor;
        // O gizmo de rotacao escreve em rotationQuaternion; converte para euler.
        var r;
        if (a.rotationQuaternion) { r = a.rotationQuaternion.toEulerAngles(); }
        else { r = a.rotation; }
        this._pitch = Math.round(r.x * 180 / Math.PI);
        this._yaw = Math.round(r.y * 180 / Math.PI);
        this._roll = Math.round(r.z * 180 / Math.PI);
        this._applyTransform();
    };
    // Copia a posicao do anchor (gizmo de mover) para o offset do modelo.
    Scene.prototype._syncPosFromAnchor = function () {
        if (!this._gizmoAnchor || !this.modelRoot) return;
        var bp = this._basePos || BABYLON.Vector3.Zero();
        var pos = this._gizmoAnchor.position;
        this._offset = { x: pos.x - bp.x, y: pos.y - bp.y, z: pos.z - bp.z };
        this._applyTransform();
    };
    Scene.prototype.onTransformChanged = function (cb) { this._onTransformChanged = cb; };

    Scene.prototype.getMannequin = function () { return this.mannequin || null; };
    Scene.prototype.poseJoint = function () {}; // manequim arquivado por ora

    Scene.prototype.getFocalLength = function () { return this._focalMM || 50; };
    Scene.prototype.setFocalLength = function (mm) {
        this._focalMM = Math.max(10, Math.min(300, mm));
        if (this.camera.mode !== BABYLON.Camera.PERSPECTIVE_CAMERA) return;
        var newFov = this._fovFromFocal(this._focalMM);
        // Dolly: ajusta o raio para o modelo ocupar o mesmo tamanho na tela ao mudar
        // o FOV (so a perspectiva/distorcao muda, nao o "zoom"). Usa a altura do alvo.
        // tan(fov/2) * raio = constante -> raio = alvoHalf / tan(fov/2).
        var subjectHalf = 1.6; // meia-altura aproximada do modelo normalizado (~3 unidades)
        this.camera.radius = subjectHalf / Math.tan(newFov / 2);
        this.camera.fov = newFov;
    };

    Scene.prototype.setProjection = function (mode) {
        this._projection = mode;
        if (mode === 'ortho') {
            this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
            var r = this.camera.radius, aspect = this.engine.getRenderWidth() / this.engine.getRenderHeight();
            var h = r * 0.5;
            this.camera.orthoTop = h; this.camera.orthoBottom = -h;
            this.camera.orthoLeft = -h * aspect; this.camera.orthoRight = h * aspect;
        } else {
            this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
            this.camera.fov = this._fovFromFocal(this._focalMM);
        }
    };
    Scene.prototype.getProjection = function () { return this._projection || 'persp'; };

    Scene.prototype.setCameraPreset = function (preset) {
        var b = Math.PI / 2.2; // beta (altura)
        var a = -Math.PI / 2;  // alpha (frente)
        switch (preset) {
            case 'front':  a = -Math.PI/2; b = Math.PI/2.2; break;
            case 'threeq': a = -Math.PI/2 - Math.PI/5; b = Math.PI/2.4; break;
            case 'side':   a = 0; b = Math.PI/2.1; break;
            case 'top':    a = -Math.PI/2; b = 0.15; break;
        }
        this.camera.alpha = a; this.camera.beta = b;
    };

    // ---------- Materiais PBR de estudo ----------
    // Cada preset define os parametros PBR de partida. O usuario pode ajustar via
    // setMaterialParam (sliders estilo FormBox: roughness, metalness, specular,
    // reflection, subsurface, scatter). subsurface usa translucency REAL do Babylon.
    Scene.MATERIALS = ['clay','skin','marble','jade','gold','copper','bronze','metal','pearl','white'];
    Scene.MATERIAL_BASE_COLOR = {
        clay:'#c9c4bd', skin:'#e8b89a', marble:'#e8e6e0', jade:'#4fb286',
        gold:'#d4af37', copper:'#b87333', bronze:'#8c6a3f', metal:'#bfc3c7',
        pearl:'#f3ece2', white:'#f0efec'
    };
    // Parametros PBR por preset: roughness, metalness, specular(0..1), reflection(env 0..2),
    // subsurface(0..1 translucencia), scatter(cor da luz que penetra).
    Scene.MATERIAL_PRESETS = {
        clay:    { roughness:0.85, metalness:0.0, specular:0.2, reflection:0.2, subsurface:0.0, scatter:'#000000' },
        skin:    { roughness:0.55, metalness:0.0, specular:0.35, reflection:0.3, subsurface:0.75, scatter:'#c65b4e' },
        marble:  { roughness:0.30, metalness:0.0, specular:0.5, reflection:0.6, subsurface:0.35, scatter:'#d8cfc6' },
        jade:    { roughness:0.28, metalness:0.0, specular:0.5, reflection:0.6, subsurface:0.85, scatter:'#2f8f66' },
        gold:    { roughness:0.30, metalness:1.0, specular:0.9, reflection:1.2, subsurface:0.0, scatter:'#000000' },
        copper:  { roughness:0.35, metalness:1.0, specular:0.9, reflection:1.1, subsurface:0.0, scatter:'#000000' },
        bronze:  { roughness:0.45, metalness:1.0, specular:0.8, reflection:1.0, subsurface:0.0, scatter:'#000000' },
        metal:   { roughness:0.25, metalness:0.9, specular:0.9, reflection:1.2, subsurface:0.0, scatter:'#000000' },
        pearl:   { roughness:0.25, metalness:0.1, specular:0.7, reflection:1.0, subsurface:0.3, scatter:'#f0e6da' },
        white:   { roughness:0.9, metalness:0.0, specular:0.2, reflection:0.1, subsurface:0.0, scatter:'#000000' }
    };

    Scene.prototype._defaultParams = function (type) {
        var p = Scene.MATERIAL_PRESETS[type] || Scene.MATERIAL_PRESETS.clay;
        return { roughness:p.roughness, metalness:p.metalness, specular:p.specular,
                 reflection:p.reflection, subsurface:p.subsurface, scatter:p.scatter };
    };

    // Garante um unico PBRMaterial persistente e o aplica em todas as meshes.
    Scene.prototype._ensureMaterial = function () {
        if (!this._material || this._material.isDisposed) {
            this._material = new BABYLON.PBRMaterial('lightrefMat', this.scene);
            this._material.enableSpecularAntiAliasing = true;
        }
        if (this.modelRoot) {
            var meshes = this.modelRoot.getChildMeshes ? this.modelRoot.getChildMeshes() : [];
            for (var i = 0; i < meshes.length; i++) {
                if (meshes[i].material !== this._material) meshes[i].material = this._material;
            }
        }
        return this._material;
    };

    // Atualiza as propriedades do material existente (NAO recria - evita o modelo sumir).
    Scene.prototype._updateMaterial = function () {
        var type = this._materialType || 'clay';
        var pr = this._matParams || this._defaultParams(type);
        var color = hexToColor3(this._formColor || Scene.MATERIAL_BASE_COLOR[type] || '#c9c4bd');
        var m = this._ensureMaterial();

        m.albedoColor = color;
        m.metallic = pr.metalness;
        m.roughness = pr.roughness;
        m.metallicF0Factor = pr.specular;
        m.environmentIntensity = pr.reflection;

        m.subSurface.isRefractionEnabled = false;
        m.alpha = 1.0; m.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;

        var hasSSS = pr.subsurface > 0.001;
        m.subSurface.isTranslucencyEnabled = hasSSS;
        if (hasSSS) {
            // Translucency moderada (valor anterior, sutil - nao estoura a imagem).
            m.subSurface.translucencyIntensity = pr.subsurface;
            m.subSurface.minimumThickness = 0.0;
            m.subSurface.maximumThickness = 2.0 + pr.subsurface * 4.0;
            m.subSurface.tintColor = hexToColor3(pr.scatter && pr.scatter !== '#000000' ? pr.scatter : '#c65b4e');
        }
    };

    // Compat: chamado apos carregar modelo ou trocar params.
    Scene.prototype._reapplyMaterial = function () { this._updateMaterial(); };

    Scene.prototype.setMaterial = function (type) {
        this._materialType = type;
        this._formColor = null;
        this._matParams = this._defaultParams(type);
        this._updateMaterial();
    };
    Scene.prototype.setFormColor = function (hex) { this._formColor = hex; this._reapplyMaterial(); };
    Scene.prototype.getFormColor = function () { return this._formColor || Scene.MATERIAL_BASE_COLOR[this._materialType || 'clay'] || '#c9c4bd'; };
    Scene.prototype.getMaterial = function () { return this._materialType || 'clay'; };

    // Ajuste fino de um parametro PBR (sliders estilo FormBox).
    Scene.prototype.setMaterialParam = function (name, value) {
        if (!this._matParams) this._matParams = this._defaultParams(this._materialType);
        this._matParams[name] = value;
        this._reapplyMaterial();
    };
    Scene.prototype.getMaterialParams = function () {
        return this._matParams || this._defaultParams(this._materialType || 'clay');
    };

    // ---------- Carregar modelo ----------
    Scene.prototype.loadOBJ = function (url, onProgress, onDone) {
        var self = this;
        var lower = String(url).toLowerCase().split('?')[0];
        var ext = /\.glb$/.test(lower) ? '.glb' : (/\.gltf$/.test(lower) ? '.gltf' : (/\.stl$/.test(lower) ? '.stl' : '.obj'));
        // Separa base e arquivo para o ImportMesh.
        var idx = url.lastIndexOf('/');
        var rootUrl = url.substring(0, idx + 1);
        var fileName = url.substring(idx + 1);

        this._currentLoadUrl = url;
        BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, this.scene, function (meshes) {
            self._installModel(meshes, onDone);
        }, function (evt) {
            if (onProgress && evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
        }, function (scene, msg) {
            if (onDone) onDone(new Error(msg || 'Falha ao carregar o modelo'));
        }, ext);
    };

    Scene.prototype._installModel = function (meshes, onDone) {
        if (this.modelRoot) { this.modelRoot.dispose(false, true); this.modelRoot = null; }
        this.mannequin = null;

        // Agrupa tudo num TransformNode pivot para rotacionar/normalizar sem quebrar skin.
        var pivot = new BABYLON.TransformNode('modelRoot', this.scene);
        var real = [];
        for (var i = 0; i < meshes.length; i++) {
            var mesh = meshes[i];
            if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
                real.push(mesh);
                // STL (e alguns OBJ) vem sem normais, ou com normais zeradas
                // (o STL binario sempre traz um campo de normal, que pode ser 0,0,0).
                // Nesses casos recalcula, senao o modelo fica preto (sem iluminacao).
                if (mesh.getVerticesData) {
                    try {
                        var nrm = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
                        var needN = !nrm;
                        if (nrm && nrm.length >= 9) {
                            // Amostra alguns vertices: se as normais sao ~0, recalcula.
                            var bad = 0, samples = 0;
                            var step = Math.max(3, Math.floor(nrm.length / 300) * 3);
                            for (var s = 0; s + 2 < nrm.length; s += step) {
                                var mag = Math.abs(nrm[s]) + Math.abs(nrm[s+1]) + Math.abs(nrm[s+2]);
                                samples++; if (mag < 1e-6) bad++;
                            }
                            if (samples > 0 && bad === samples) needN = true;
                        }
                        if (needN) {
                            var positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                            var indices = mesh.getIndices();
                            if (positions && indices) {
                                var normals = [];
                                BABYLON.VertexData.ComputeNormals(positions, indices, normals);
                                mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
                            }
                        }
                    } catch (e) {}
                }
            }
            if (!mesh.parent) mesh.parent = pivot;
        }

        // Normaliza escala/posicao pelo bounding total.
        var min = new BABYLON.Vector3(1e9,1e9,1e9), max = new BABYLON.Vector3(-1e9,-1e9,-1e9);
        for (var j = 0; j < real.length; j++) {
            real[j].computeWorldMatrix(true);
            var bi = real[j].getBoundingInfo().boundingBox;
            min = BABYLON.Vector3.Minimize(min, bi.minimumWorld);
            max = BABYLON.Vector3.Maximize(max, bi.maximumWorld);
        }
        var size = max.subtract(min), center = min.add(size.scale(0.5));
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var scale = 3 / maxDim;
        // Formas basicas carregam 40% menores que os modelos normais.
        if (/forma-/i.test(this._currentLoadUrl || '')) scale *= 0.6;
        // Transform base (normalizacao automatica). Os ajustes do usuario sao aplicados por cima.
        this._baseScale = scale;
        this._basePos = new BABYLON.Vector3(-center.x * scale, -center.y * scale, -center.z * scale);
        this._offset = { x: 0, y: 0, z: 0 };  // ajuste fino do usuario
        this._scaleMult = 1;                  // multiplicador de escala do usuario
        this.modelRoot = pivot;
        this._applyTransform();
        this._matParams = this._defaultParams(this._materialType || 'clay');
        this._reapplyMaterial();

        // Registra as meshes como projetoras de sombra em todas as luzes.
        if (this.lightManager && this.lightManager.registerShadowCasters) this.lightManager.registerShadowCasters(real);

        this._yaw = 0; this._pitch = 0;
        if (onDone) onDone(null);
    };

    // ---------- Snapshot / miniatura ----------
    // Export: captura o CANVAS real (mesmo enquadramento e pos-processamento que
    // voce ve), escondendo o chao e os marcadores de luz. Sobe a resolucao
    // temporariamente para o PNG nao sair pequeno. Assincrono: cb(dataURL).
    Scene.prototype.snapshotHiRes = function (cb, size) {
        var self = this;
        var ground = this.ground, showGround = ground && ground.isEnabled();
        var markersHidden = [];
        // Esconde chao e marcadores/linhas das luzes.
        if (ground) ground.setEnabled(false);
        // Esconde o skybox e forca fundo transparente (export recortado sem fundo).
        var skyWasOn = this._skybox && this._skybox.isEnabled();
        if (this._skybox) this._skybox.setEnabled(false);
        var prevClear = this.scene.clearColor;
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        if (this.lightManager) {
            for (var i = 0; i < this.lightManager.lights.length; i++) {
                var l = this.lightManager.lights[i];
                if (l._marker && l._marker.isEnabled()) { l._marker.setEnabled(false); markersHidden.push(l._marker); }
                if (l._line && l._line.isEnabled()) { l._line.setEnabled(false); markersHidden.push(l._line); }
            }
        }
        // Sobe a resolucao: dobra o tamanho do render temporariamente.
        var prevScale = this.engine.getHardwareScalingLevel();
        this.engine.setHardwareScalingLevel(0.33); // ~3x a resolucao (mais pixels reais no recorte)
        this.engine.resize();
        this.scene.render(); this.scene.render();

        // Calcula a caixa do modelo projetada na tela, para RECORTAR no modelo
        // (senao o PNG sai com muito espaco vazio e o modelo minusculo).
        var rect = this._modelScreenRect();
        var w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();

        var src = this.canvas;
        var out = document.createElement('canvas');
        // Regiao a recortar (no modelo, com margem) ou o frame inteiro.
        var sx, sy, sw, sh;
        if (rect) {
            var pad = Math.round(Math.max(rect.w, rect.h) * 0.12);
            sx = Math.max(0, rect.x - pad); sy = Math.max(0, rect.y - pad);
            sw = Math.min(w - sx, rect.w + pad * 2); sh = Math.min(h - sy, rect.h + pad * 2);
        } else { sx = 0; sy = 0; sw = w; sh = h; }

        // Sai sempre em ALTA (2K no lado maior), redimensionando o recorte.
        var target = size || 2048;
        var ratio = sw / sh;
        var outW, outH;
        if (ratio >= 1) { outW = target; outH = Math.round(target / ratio); }
        else { outH = target; outW = Math.round(target * ratio); }
        out.width = outW; out.height = outH;
        var octx = out.getContext('2d');
        octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
        octx.drawImage(src, sx, sy, sw, sh, 0, 0, outW, outH);
        var data = out.toDataURL('image/png');

        // Restaura.
        this.engine.setHardwareScalingLevel(prevScale);
        this.engine.resize();
        this.scene.clearColor = prevClear;
        if (skyWasOn && this._skybox) this._skybox.setEnabled(true);
        if (showGround && ground) ground.setEnabled(true);
        for (var k = 0; k < markersHidden.length; k++) markersHidden[k].setEnabled(true);
        this.scene.render();
        cb(data);
    };

    // Projeta a bounding box do modelo para coordenadas de tela (px do render atual).
    Scene.prototype._modelScreenRect = function () {
        if (!this.modelRoot) return null;
        var meshes = this.modelRoot.getChildMeshes ? this.modelRoot.getChildMeshes() : [];
        if (!meshes.length) return null;
        var min = new BABYLON.Vector3(1e9,1e9,1e9), max = new BABYLON.Vector3(-1e9,-1e9,-1e9);
        for (var i = 0; i < meshes.length; i++) {
            if (!meshes[i].getBoundingInfo) continue;
            meshes[i].computeWorldMatrix(true);
            var bb = meshes[i].getBoundingInfo().boundingBox;
            min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
            max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
        }
        // 8 cantos da caixa, projetados na tela.
        var w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
        var vp = this.camera.viewport.toGlobal(w, h);
        var tm = this.scene.getTransformMatrix();
        var corners = [
            new BABYLON.Vector3(min.x,min.y,min.z), new BABYLON.Vector3(max.x,min.y,min.z),
            new BABYLON.Vector3(min.x,max.y,min.z), new BABYLON.Vector3(min.x,min.y,max.z),
            new BABYLON.Vector3(max.x,max.y,min.z), new BABYLON.Vector3(max.x,min.y,max.z),
            new BABYLON.Vector3(min.x,max.y,max.z), new BABYLON.Vector3(max.x,max.y,max.z)
        ];
        var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
        for (var c = 0; c < corners.length; c++) {
            var p = BABYLON.Vector3.Project(corners[c], BABYLON.Matrix.Identity(), tm, vp);
            if (p.x<minX) minX=p.x; if (p.x>maxX) maxX=p.x;
            if (p.y<minY) minY=p.y; if (p.y>maxY) maxY=p.y;
        }
        minX=Math.max(0,minX); minY=Math.max(0,minY); maxX=Math.min(w,maxX); maxY=Math.min(h,maxY);
        if (maxX<=minX || maxY<=minY) return null;
        return { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX-minX), h: Math.round(maxY-minY) };
    };
    // Compat sincrono (fallback do canvas) - usado se necessario.
    Scene.prototype.snapshotDataURL = function () { this.scene.render(); return this.canvas.toDataURL('image/png'); };
    Scene.prototype.snapshotRawDataURL = function () { return this.snapshotDataURL(); };
    Scene.prototype.thumbnailDataURL = function () {
        this.scene.render();
        // Miniatura: reduz via canvas 2D.
        var tmp = document.createElement('canvas'); tmp.width = 160; tmp.height = 160;
        var ctx = tmp.getContext('2d');
        ctx.drawImage(this.canvas, 0, 0, 160, 160);
        return tmp.toDataURL(this._bgTransparent ? 'image/png' : 'image/jpeg', 0.7);
    };

    // Miniatura PADRONIZADA (igual as geradas offline): camera de frente, luz
    // Miniatura da CENA como o usuario montou (luzes, material, fundo atuais),
    // mas em retrato 480x640 e alta qualidade (sem distorcao/achatamento). Usa a
    // camera atual do usuario num RenderTarget; so esconde os marcadores de luz.
    // Assincrono: cb(dataURL PNG).
    Scene.prototype.sceneThumbnail = function (cb) {
        var self = this;
        var sc = this.scene;
        // Esconde apenas os helpers de luz (esferinhas/linhas), preservando o
        // resto exatamente como esta na cena.
        var hadHelpers = this.lightManager && this.lightManager.showHelpers;
        if (this.lightManager && this.lightManager.setHelpersVisible) this.lightManager.setHelpersVisible(false);
        function restore() {
            if (self.lightManager && hadHelpers && self.lightManager.setHelpersVisible) self.lightManager.setHelpersVisible(true);
        }
        try {
            // Render target retrato (3:4). O Babylon ajusta a projecao ao aspect
            // do alvo, entao a imagem NAO fica achatada como no canvas widescreen.
            BABYLON.Tools.CreateScreenshotUsingRenderTarget(self.engine, self.camera, { width: 600, height: 800 }, function (data) {
                restore();
                cb(data);
            }, 'image/png');
        } catch (e) {
            restore();
            // Fallback: thumb simples (pode distorcer, mas nao quebra o salvar).
            try { cb(self.thumbnailDataURL ? self.thumbnailDataURL() : null); } catch (e2) { cb(null); }
        }
    };

    // chapada, fundo cinza, retrato 480x640. Renderiza o modelo principal numa
    // camera/luz temporarias e captura via RenderTarget. Assincrono: cb(dataURL).
    Scene.prototype.standardThumbnail = function (cb) {
        var self = this;
        if (!this.modelRoot) { cb(null); return; }
        var sc = this.scene;
        // Camera temporaria de frente (mesmos parametros do gerador).
        var tcam = new BABYLON.ArcRotateCamera('thumbCam', -Math.PI/2, Math.PI/2, 4.2, new BABYLON.Vector3(0,0,0), sc);
        tcam.fov = 0.7; tcam.minZ = 0.05;
        // Luz chapada temporaria.
        var themi = new BABYLON.HemisphericLight('thumbHemi', new BABYLON.Vector3(0.3,1,0.6), sc);
        themi.intensity = 0.95; themi.groundColor = new BABYLON.Color3(0.4,0.4,0.42);
        var tdir = new BABYLON.DirectionalLight('thumbDir', new BABYLON.Vector3(-0.4,-0.6,1), sc);
        tdir.intensity = 1.1;
        // Esconde chao e marcadores; luzes do usuario ficam (nao afetam pois a
        // camera/luz temporarias dominam) - mas escondemos o chao e helpers.
        var ground = this.ground, showGround = ground && ground.isEnabled();
        if (ground) ground.setEnabled(false);
        var hadHelpers = this.lightManager && this.lightManager.showHelpers;
        if (this.lightManager && this.lightManager.setHelpersVisible) this.lightManager.setHelpersVisible(false);
        // Desliga as luzes do usuario temporariamente (thumb usa so a luz chapada).
        var userLights = [];
        if (this.lightManager) {
            for (var i=0;i<this.lightManager.lights.length;i++){ var L=this.lightManager.lights[i]; if (L._bl && L._bl.isEnabled()){ userLights.push(L); L._bl.setEnabled(false); } }
        }
        var prevClear = sc.clearColor;
        sc.clearColor = new BABYLON.Color4(0.17,0.185,0.21,1);
        function restore() {
            sc.clearColor = prevClear;
            if (ground && showGround) ground.setEnabled(true);
            for (var i=0;i<userLights.length;i++) userLights[i]._bl.setEnabled(true);
            if (this.lightManager && hadHelpers && this.lightManager.setHelpersVisible) this.lightManager.setHelpersVisible(true);
            try { tcam.dispose(); } catch(e){} try { themi.dispose(); } catch(e){} try { tdir.dispose(); } catch(e){}
        }
        try {
            BABYLON.Tools.CreateScreenshotUsingRenderTarget(self.engine, tcam, { width: 480, height: 640 }, function (data) {
                restore.call(self);
                cb(data);
            }, 'image/png');
        } catch (e) {
            restore.call(self);
            cb(null);
        }
    };

    // Modo pose e helpers de luz (compat com panel.js; manequim arquivado).
    Scene.prototype.enablePoseMode = function () {};
    Scene.prototype.isPoseMode = function () { return false; };
    Scene.prototype.onJointPicked = function () {};
    Scene.prototype.requestRender = function () {};

    // ---- Atalhos de ARRASTAR no visor para editar a luz principal ----
    // Sem Ctrl: Shift+arrastar gira a luz (azimute/elevacao).
    // Ctrl+Shift+arrastar: intensidade (vertical) + hue da cor (horizontal).
    // Ctrl+Shift+Alt+arrastar: hue da cor (horizontal) + temperatura (vertical).
    // Helpers de cor (hex <-> hsl) para girar hue e ajustar temperatura.
    function _hexToRgb(hex) {
        hex = String(hex).replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
    }
    function _rgbToHex(r, g, b) {
        function h(x){ x = Math.max(0, Math.min(255, Math.round(x))); var t = x.toString(16); return t.length < 2 ? '0'+t : t; }
        return '#' + h(r) + h(g) + h(b);
    }
    function _rgbToHsl(r, g, b) {
        r/=255; g/=255; b/=255;
        var mx = Math.max(r,g,b), mn = Math.min(r,g,b), h, s, l = (mx+mn)/2;
        if (mx === mn) { h = s = 0; }
        else {
            var d = mx - mn;
            s = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
            if (mx === r) h = (g-b)/d + (g < b ? 6 : 0);
            else if (mx === g) h = (b-r)/d + 2;
            else h = (r-g)/d + 4;
            h /= 6;
        }
        return { h: h, s: s, l: l };
    }
    function _hslToRgb(h, s, l) {
        var r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
            function hue2rgb(p, q, t) {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1/6) return p + (q-p)*6*t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q-p)*(2/3-t)*6;
                return p;
            }
            var q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l - q;
            r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
        }
        return { r: r*255, g: g*255, b: b*255 };
    }
    function _shiftHue(hex, deltaDeg) {
        var c = _hexToRgb(hex), hsl = _rgbToHsl(c.r, c.g, c.b);
        hsl.h = ((hsl.h + deltaDeg/360) % 1 + 1) % 1;
        if (hsl.s < 0.05) hsl.s = 0.6;   // se era branco/cinza, da saturacao para o hue aparecer
        var o = _hslToRgb(hsl.h, hsl.s, hsl.l);
        return _rgbToHex(o.r, o.g, o.b);
    }
    function _shiftTemp(hex, delta) {
        // delta > 0 esquenta (mais vermelho, menos azul); < 0 esfria.
        var c = _hexToRgb(hex);
        return _rgbToHex(c.r + delta, c.g + delta * 0.2, c.b - delta);
    }

    Scene.prototype._bindLightShortcut = function () {
        var self = this;
        var dragging = false, mode = 'rotate', lastX = 0, lastY = 0;
        var canvas = this.canvas;

        canvas.addEventListener('pointerdown', function (ev) {
            // Precisa de Shift e do botao esquerdo. Ctrl/Alt escolhem o modo.
            if (!ev.shiftKey || ev.button !== 0) return;
            if (!self.lightManager || !self.lightManager.lights.length) return;
            if (ev.ctrlKey && ev.altKey) mode = 'huetemp';
            else if (ev.ctrlKey) mode = 'colorint';
            else mode = 'rotate';
            dragging = true; lastX = ev.clientX; lastY = ev.clientY;
            self.camera.detachControl(canvas); // trava a camera durante o arraste da luz
            self._onLightShortcut && self._onLightShortcut('start');
            ev.preventDefault(); ev.stopPropagation();
        }, true);

        window.addEventListener('pointermove', function (ev) {
            if (!dragging) return;
            var dx = ev.clientX - lastX, dy = ev.clientY - lastY;
            lastX = ev.clientX; lastY = ev.clientY;
            var l = self._activeLightObj();
            if (!l) return;

            if (mode === 'rotate') {
                var az = ((l.azimuth + dx * 0.6) % 360 + 360) % 360;
                var el = Math.max(-89, Math.min(89, l.elevation - dy * 0.5));
                self.lightManager.update(l.id, 'azimuth', Math.round(az));
                self.lightManager.update(l.id, 'elevation', Math.round(el));
            } else if (mode === 'colorint') {
                // So intensidade (vertical). A cor/hue fica no modo Ctrl+Shift+Alt.
                var inten = Math.max(0, Math.min(10, l.intensity - dy * 0.02));
                self.lightManager.update(l.id, 'intensity', Math.round(inten * 10) / 10);
            } else if (mode === 'huetemp') {
                // Horizontal: hue. Vertical: temperatura (cima esquenta).
                if (Math.abs(dx) > 0) self.lightManager.update(l.id, 'color', _shiftHue(l.color, dx * 1.2));
                if (Math.abs(dy) > 0) self.lightManager.update(l.id, 'color', _shiftTemp(l.color, -dy * 1.5));
            }
            if (self._onLightShortcut) self._onLightShortcut('drag', l);
        });

        window.addEventListener('pointerup', function () {
            if (!dragging) return;
            dragging = false;
            self.camera.attachControl(canvas, true); // devolve o controle da camera
            if (self._onLightShortcut) self._onLightShortcut('end');
        });
    };
    // Luz ATIVA (selecionada no painel): os atalhos de arraste agem sobre ela.
    Scene.prototype.setActiveLight = function (id) { this._activeLightId = id; };
    Scene.prototype.getActiveLight = function () { return this._activeLightId; };
    // Resolve o objeto da luz ativa; se nenhuma, cai na primeira da lista.
    Scene.prototype._activeLightObj = function () {
        if (!this.lightManager || !this.lightManager.lights.length) return null;
        if (this._activeLightId != null && this.lightManager.get) {
            var a = this.lightManager.get(this._activeLightId);
            if (a) return a;
        }
        return this.lightManager.lights[0];
    };

    Scene.prototype.onLightShortcut = function (cb) { this._onLightShortcut = cb; };

    // ============================================================
    // COMPOSICAO: cena de objetos independentes (separada do modelo principal)
    // ============================================================

    // Mostra/esconde o modelo principal (usado ao entrar/sair da aba Composicao).
    Scene.prototype.setMainModelVisible = function (on) {
        if (this.modelRoot && this.modelRoot.setEnabled) this.modelRoot.setEnabled(!!on);
    };

    // Mostra/esconde TODOS os objetos da composicao. Ao mostrar, respeita o
    // estado individual (objeto ocultado pelo 'olho' continua oculto).
    Scene.prototype.setCompositionVisible = function (on) {
        this._compHidden = !on;
        for (var i = 0; i < this.sceneObjects.length; i++) {
            var o = this.sceneObjects[i];
            if (o.pivot && o.pivot.setEnabled) o.pivot.setEnabled(on ? !o.hidden : false);
        }
    };

    // Carrega um modelo/forma como objeto INDEPENDENTE, com pivot proprio.
    // Compartilha o material atual. NAO mexe no modelo principal.
    Scene.prototype.addSceneObject = function (url, onDone) {
        var self = this;
        var idx = url.lastIndexOf('/');
        var rootUrl = url.substring(0, idx + 1);
        var fileName = url.substring(idx + 1);
        BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, this.scene, function (meshes) {
          try {
            var id = self._objId++;
            var pivot = new BABYLON.TransformNode('obj' + id, self.scene);
            var real = [];
            for (var i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];
                if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
                    real.push(mesh);
                    mesh.receiveShadows = true;
                    // Recalcula normais se vierem zeradas (STL/alguns OBJ).
                    if (mesh.getVerticesData) { try {
                        var nrm = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind); var needN = !nrm;
                        if (nrm && nrm.length >= 9) {
                            var bad=0, sm=0, st=Math.max(3, Math.floor(nrm.length/300)*3);
                            for (var q=0;q+2<nrm.length;q+=st){ var mg=Math.abs(nrm[q])+Math.abs(nrm[q+1])+Math.abs(nrm[q+2]); sm++; if(mg<1e-6)bad++; }
                            if (sm>0 && bad===sm) needN=true;
                        }
                        if (needN) { var po=mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind), ix=mesh.getIndices(); if(po&&ix){ var no=[]; BABYLON.VertexData.ComputeNormals(po,ix,no); mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, no); } }
                    } catch (e) {} }
                }
                if (!mesh.parent) mesh.parent = pivot;
            }
            // Normaliza escala/posicao pelo bounding (mesmo criterio do modelo principal).
            var mn = new BABYLON.Vector3(1e9,1e9,1e9), mx = new BABYLON.Vector3(-1e9,-1e9,-1e9);
            for (var j=0;j<real.length;j++){ real[j].computeWorldMatrix(true); var bi=real[j].getBoundingInfo().boundingBox; mn=BABYLON.Vector3.Minimize(mn,bi.minimumWorld); mx=BABYLON.Vector3.Maximize(mx,bi.maximumWorld); }
            var sz = mx.subtract(mn), ctr = mn.add(sz.scale(0.5));
            var maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
            var baseScale = 2 / maxDim;
            var groundY = (self.ground ? self.ground.position.y : -1.5);
            var obj = {
                id:id, url:url, pivot:pivot, meshes:real, baseScale:baseScale,
                baseCenter:{ x:-ctr.x*baseScale, y:groundY - mn.y*baseScale, z:-ctr.z*baseScale },
                offset:{ x:(self.sceneObjects.length+1)*1.1, y:0, z:0 },
                scaleMult:1, sx:1, sy:1, sz:1, yaw:0, pitch:0, roll:0, hidden:false
            };
            self.sceneObjects.push(obj);
            self._applyObjTransform(obj);
            // Material compartilhado.
            var mat = self._ensureMaterial();
            for (var k=0;k<real.length;k++) real[k].material = mat;
            // Sombra: adiciona como caster sem apagar os ja registrados.
            if (self.lightManager && self.lightManager.addShadowCasters) self.lightManager.addShadowCasters(real);
            // Respeita a visibilidade atual da composicao.
            pivot.setEnabled(!self._compHidden);
            if (onDone) onDone(null, id);
          } catch (e) { if (onDone) onDone(e); }
        }, null, function (sc, msg) { if (onDone) onDone(msg || 'load error'); });
    };

    // Aplica posicao/escala/rotacao do objeto de composicao (com distorcao por eixo).
    Scene.prototype._applyObjTransform = function (obj) {
        var s = obj.baseScale * obj.scaleMult;
        obj.pivot.scaling = new BABYLON.Vector3(s * (obj.sx||1), s * (obj.sy||1), s * (obj.sz||1));
        var bc = obj.baseCenter, o = obj.offset;
        // Reassenta no chao ao mudar a escala Y (a base acompanha o piso).
        var groundY = (this.ground ? this.ground.position.y : -1.5);
        var yFloor = groundY - (obj.minY != null ? obj.minY : 0) * s * (obj.sy||1);
        obj.pivot.position = new BABYLON.Vector3(bc.x + o.x, yFloor + o.y, bc.z + o.z);
        obj.pivot.rotation = new BABYLON.Vector3((obj.pitch||0)*Math.PI/180,(obj.yaw||0)*Math.PI/180,(obj.roll||0)*Math.PI/180);
    };

    Scene.prototype.listSceneObjects = function () {
        return this.sceneObjects.map(function (o) { return { id:o.id, url:o.url }; });
    };
    Scene.prototype.getSceneObject = function (id) {
        for (var i=0;i<this.sceneObjects.length;i++) if (this.sceneObjects[i].id===id) return this.sceneObjects[i];
        return null;
    };
    Scene.prototype.removeSceneObject = function (id) {
        for (var i=0;i<this.sceneObjects.length;i++) {
            if (this.sceneObjects[i].id===id) {
                this.sceneObjects[i].pivot.dispose(false, true);
                this.sceneObjects.splice(i,1);
                if (this._selectedObj===id) { this._selectedObj=null; if (this.setGizmoMode) this.setGizmoMode('off'); }
                return;
            }
        }
    };
    Scene.prototype.clearSceneObjects = function () {
        for (var i=0;i<this.sceneObjects.length;i++) this.sceneObjects[i].pivot.dispose(false, true);
        this.sceneObjects = []; this._selectedObj = null;
    };
    Scene.prototype.isSceneObjectVisible = function (id) {
        var o = this.getSceneObject(id); return o ? !o.hidden : false;
    };
    Scene.prototype.setSceneObjectVisible = function (id, v) {
        var o = this.getSceneObject(id); if (!o) return;
        o.hidden = !v;
        if (o.pivot && o.pivot.setEnabled) o.pivot.setEnabled(v && !this._compHidden);
    };

    // ============================================================
    // COMPOSICAO - Etapa 2/3/4: selecao (highlight), xform G/S/R, distorcao
    // ============================================================

    Scene.prototype._ensureHighlight = function () {
        if (!this._hl) {
            this._hl = new BABYLON.HighlightLayer('objhl', this.scene);
            this._hl.innerGlow = false; this._hl.outerGlow = true;
        }
        return this._hl;
    };

    // Destaca visualmente o objeto de composicao selecionado.
    Scene.prototype._refreshSelectionHighlight = function () {
        var hl = this._ensureHighlight();
        hl.removeAllMeshes();
        var o = this.getSceneObject(this._selectedObj);
        if (o) {
            for (var i=0;i<o.meshes.length;i++) {
                try { hl.addMesh(o.meshes[i], new BABYLON.Color3(1.0, 0.62, 0.2)); } catch (e) {}
            }
        }
    };

    // Alvo do xform: objeto de composicao selecionado, ou o modelo principal (aba pos).
    Scene.prototype._xformTarget = function () {
        var o = this.getSceneObject(this._selectedObj);
        if (o) {
            var self = this;
            return {
                kind: 'obj',
                getPos: function(){ return { x:o.offset.x, y:o.offset.y, z:o.offset.z }; },
                addPos: function(dx,dy,dz){ o.offset.x+=dx; o.offset.y+=dy; o.offset.z+=dz; self._applyObjTransform(o); },
                addRot: function(dx,dy,dz){ o.pitch=(o.pitch||0)+dx; o.yaw=(o.yaw||0)+dy; o.roll=(o.roll||0)+dz; self._applyObjTransform(o); },
                mulScale: function(f){ o.scaleMult=Math.max(0.05, o.scaleMult*f); self._applyObjTransform(o); }
            };
        }
        if (this.modelRoot) {
            var s2 = this;
            return {
                kind: 'model',
                getPos: function(){ var o2=s2._offset||{x:0,y:0,z:0}; return {x:o2.x,y:o2.y,z:o2.z}; },
                addPos: function(dx,dy,dz){ var o2=s2._offset||{x:0,y:0,z:0}; s2._offset={x:o2.x+dx,y:o2.y+dy,z:o2.z+dz}; s2._applyTransform(); },
                addRot: function(dx,dy,dz){ s2._pitch=(s2._pitch||0)+dx*180/Math.PI; s2._yaw=(s2._yaw||0)+dy*180/Math.PI; s2._roll=(s2._roll||0)+dz*180/Math.PI; s2._applyTransform(); },
                mulScale: function(f){ s2._scaleMult=Math.max(0.05,(s2._scaleMult||1)*f); s2._applyTransform(); }
            };
        }
        return null;
    };

    Scene.prototype.onXform = function (cb) { this._onXform = cb; };
    Scene.prototype.onTransformChanged = function (cb) { this._onTransformChanged = cb; };
    Scene.prototype.isXforming = function () { return !!this._xf; };

    // Inicia uma transformacao interativa (mode: 'move'|'scale'|'rotate').
    Scene.prototype.beginXform = function (mode) {
        var tgt = this._xformTarget();
        if (!tgt) { if (this._onXform) this._onXform('none'); return false; }
        // Snapshot para poder cancelar (Esc).
        this._xf = { mode: mode, axis: null, target: tgt, lastX: null, lastY: null, snap: this._snapshotTarget(tgt) };
        if (this._onXform) this._onXform('start', mode);
        return true;
    };

    Scene.prototype._snapshotTarget = function (tgt) {
        var o = this.getSceneObject(this._selectedObj);
        if (o) return { offset:{x:o.offset.x,y:o.offset.y,z:o.offset.z}, pitch:o.pitch,yaw:o.yaw,roll:o.roll, scaleMult:o.scaleMult };
        return { offset:{x:(this._offset||{}).x||0,y:(this._offset||{}).y||0,z:(this._offset||{}).z||0}, pitch:this._pitch,yaw:this._yaw,roll:this._roll, scaleMult:this._scaleMult||1 };
    };
    Scene.prototype._restoreTarget = function (snap) {
        var o = this.getSceneObject(this._selectedObj);
        if (o) { o.offset={x:snap.offset.x,y:snap.offset.y,z:snap.offset.z}; o.pitch=snap.pitch; o.yaw=snap.yaw; o.roll=snap.roll; o.scaleMult=snap.scaleMult; this._applyObjTransform(o); }
        else if (this.modelRoot) { this._offset={x:snap.offset.x,y:snap.offset.y,z:snap.offset.z}; this._pitch=snap.pitch; this._yaw=snap.yaw; this._roll=snap.roll; this._scaleMult=snap.scaleMult; this._applyTransform(); }
    };

    Scene.prototype.setXformAxis = function (axis) {
        if (!this._xf) return;
        this._xf.axis = (this._xf.axis === axis) ? null : axis;  // re-pressionar destrava
        if (this._onXform) this._onXform('axis', this._xf.axis);
    };

    Scene.prototype.confirmXform = function () {
        if (!this._xf) return;
        this._xf = null;
        if (this._onXform) this._onXform('confirm');
        if (this._onTransformChanged) this._onTransformChanged();
    };
    Scene.prototype.cancelXform = function () {
        if (!this._xf) return;
        this._restoreTarget(this._xf.snap);
        this._xf = null;
        if (this._onXform) this._onXform('cancel');
    };

    // Movimento do mouse durante o xform (chamado pelo pointer bind).
    Scene.prototype._xformMove = function (ev) {
        var xf = this._xf; if (!xf) return;
        if (xf.lastX == null) { xf.lastX = ev.clientX; xf.lastY = ev.clientY; return; }
        var dx = ev.clientX - xf.lastX, dy = ev.clientY - xf.lastY;
        xf.lastX = ev.clientX; xf.lastY = ev.clientY;
        var ax = xf.axis;
        if (xf.mode === 'move') {
            var sp = 0.01;
            var mx = (ax==null||ax==='x') ? dx*sp : 0;
            var my = (ax==null||ax==='y') ? -dy*sp : 0;
            var mz = (ax==='z') ? dx*sp : 0;
            if (ax==='y') { mx = 0; my = -dy*sp; }
            xf.target.addPos(mx, my, mz);
        } else if (xf.mode === 'scale') {
            var f = 1 + (-dy) * 0.01;
            xf.target.mulScale(f);
        } else if (xf.mode === 'rotate') {
            var r = dx * 0.01;
            if (ax==='x') xf.target.addRot(r,0,0);
            else if (ax==='z') xf.target.addRot(0,0,r);
            else xf.target.addRot(0,r,0);
        }
    };

    // Liga o mouse do visor ao xform em andamento (clique confirma).
    Scene.prototype._bindXformPointer = function () {
        var self = this, canvas = this.canvas;
        window.addEventListener('pointermove', function (ev) { if (self._xf) self._xformMove(ev); });
        canvas.addEventListener('pointerdown', function (ev) {
            if (self._xf) { self.confirmXform(); ev.preventDefault(); ev.stopPropagation(); }
        }, true);
    };

    // selectSceneObject com highlight (sobrescreve o stub da Etapa 1).
    Scene.prototype.selectSceneObject = function (id) {
        this._selectedObj = id;
        this._refreshSelectionHighlight();
    };

    // Distorcao por eixo (sx/sy/sz) do objeto selecionado.
    Scene.prototype.setSceneObjAxisScale = function (axis, value) {
        var o = this.getSceneObject(this._selectedObj); if (!o) return;
        var v = Math.max(0.05, parseFloat(value));
        if (axis === 'x') o.sx = v; else if (axis === 'y') o.sy = v; else if (axis === 'z') o.sz = v;
        this._applyObjTransform(o);
    };
    Scene.prototype.getSceneObjAxisScale = function () {
        var o = this.getSceneObject(this._selectedObj);
        return o ? { x:o.sx||1, y:o.sy||1, z:o.sz||1 } : { x:1, y:1, z:1 };
    };

    global.LightRefScene = Scene;
})(window);
