/*
 * lights.js - gerenciador de luzes do LightRef sobre Babylon.js. ASCII-only.
 * Mantem a API usada pelo panel.js: add/remove/get/update/setHelpersVisible, .lights[].
 * Cada luz e uma DirectionalLight com ShadowGenerator. Posicao por azimute/elevacao.
 */
(function (global) {
    'use strict';

    var LIGHT_DISTANCE = 12;
    var nextId = 1;

    function sphericalDir(azDeg, elDeg) {
        // Direcao da luz APONTANDO para o centro (a luz vem de az/el).
        var az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
        var cosEl = Math.cos(el);
        var x = -cosEl * Math.sin(az), y = Math.sin(el), z = cosEl * Math.cos(az);
        return new BABYLON.Vector3(-x, -y, -z); // aponta para a origem
    }
    var HELPER_DISTANCE = 3.4; // marcador fica logo fora do modelo (~3 unidades)
    function helperPos(azDeg, elDeg) {
        var az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180, cosEl = Math.cos(el);
        return new BABYLON.Vector3(-HELPER_DISTANCE*cosEl*Math.sin(az), HELPER_DISTANCE*Math.sin(el), HELPER_DISTANCE*cosEl*Math.cos(az));
    }
    function sphericalPos(azDeg, elDeg) {
        var az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
        var cosEl = Math.cos(el);
        return new BABYLON.Vector3(-LIGHT_DISTANCE*cosEl*Math.sin(az), LIGHT_DISTANCE*Math.sin(el), LIGHT_DISTANCE*cosEl*Math.cos(az));
    }

    function LightManager(scene) {
        this.scene = scene;
        this.lights = [];
        this.showHelpers = true;
        this._casters = [];
    }

    // Cria a luz Babylon correta conforme light.type e aplica cor/intensidade.
    // 'sun' = DirectionalLight (raios paralelos, posicao por angulo);
    // 'point' = PointLight (irradia de um ponto); 'spot' = SpotLight (cone).
    LightManager.prototype._buildBabylonLight = function (light) {
        var scene = this.scene;
        var dir = sphericalDir(light.azimuth, light.elevation);
        var pos = sphericalPos(light.azimuth, light.elevation);
        var bl;
        if (light.type === 'point') {
            bl = new BABYLON.PointLight('L' + light.id, pos, scene);
            // range grande p/ nao cortar a luz antes de chegar ao modelo (~12u).
            bl.range = Math.max(60, light.range * 2);
            bl.shadowMinZ = 1; bl.shadowMaxZ = 60;
        } else if (light.type === 'spot') {
            // exponent baixo (1) -> brilho uniforme no cone (2 concentrava no centro).
            bl = new BABYLON.SpotLight('L' + light.id, pos, dir,
                light.spotAngle * Math.PI / 180, 1, scene);
            bl.range = Math.max(60, light.range * 2);
            bl.shadowMinZ = 1; bl.shadowMaxZ = 60;
            // innerAngle inicial a partir do Blend (0=dura, 1=toda esfumada).
            var _bl = Math.max(0, Math.min(1, parseFloat(light.spotBlend != null ? light.spotBlend : 0.15)));
            if (typeof bl.innerAngle !== 'undefined') bl.innerAngle = (light.spotAngle * Math.PI / 180) * (1 - _bl);
        } else { // 'sun' (directional)
            bl = new BABYLON.DirectionalLight('L' + light.id, dir, scene);
            bl.position = pos;
            // Frustum ortografico apertado ao redor do modelo (sombra nitida).
            bl.shadowMinZ = 6; bl.shadowMaxZ = 22;
            bl.autoUpdateExtends = false;
            var FR = 14;
            bl.orthoLeft = -FR; bl.orthoRight = FR; bl.orthoTop = FR; bl.orthoBottom = -FR;
        }
        // Point/Spot atenuam com a distancia (queda ~quadratica). A ~12u do modelo,
        // a intensidade 'crua' quase some. Escalamos internamente para que o slider
        // (0..10) tenha efeito comparavel ao do sol, sem mudar o valor mostrado.
        bl.intensity = this._effectiveIntensity(light);
        bl.diffuse = BABYLON.Color3.FromHexString(light.color);
        return bl;
    };

    // Converte a intensidade do slider na intensidade real da luz Babylon,
    // compensando a atenuacao de point/spot pela distancia ao modelo.
    LightManager.prototype._effectiveIntensity = function (light) {
        var it = Math.max(0, parseFloat(light.intensity));
        if (light.type === 'point' || light.type === 'spot') {
            // ~D^2 de atenuacao a LIGHT_DISTANCE (12): fator ~ 12^2 * um ganho.
            return it * 55;
        }
        return it;
    };

    LightManager.prototype.add = function (opts) {
        opts = opts || {};
        var light = {
            id: nextId++,
            name: opts.name || ('Luz ' + nextId),
            color: (opts.color !== undefined) ? opts.color : '#ffffff',
            intensity: (opts.intensity !== undefined) ? opts.intensity : 3.0,
            azimuth: (opts.azimuth !== undefined) ? opts.azimuth : 215,
            elevation: (opts.elevation !== undefined) ? opts.elevation : 30,
            enabled: (opts.enabled !== undefined) ? opts.enabled : true,
            softness: (opts.softness !== undefined) ? opts.softness : 32,   // borra a sombra (0..96)
            sourceSize: (opts.sourceSize !== undefined) ? opts.sourceSize : 6, // 'tamanho da fonte': afeta a maciez da sombra (1..14)
            type: (opts.type !== undefined) ? opts.type : 'sun',   // 'sun' | 'point' | 'spot'
            range: (opts.range !== undefined) ? opts.range : 40,   // alcance (point/spot)
            spotAngle: (opts.spotAngle !== undefined) ? opts.spotAngle : 50, // abertura do cone em graus (spot) = Size do Blender
            spotBlend: (opts.spotBlend !== undefined) ? opts.spotBlend : 0.15 // 0..1 suavidade da borda do cone = Blend do Blender
        };

        var bl = this._buildBabylonLight(light);
        var sg = new BABYLON.ShadowGenerator(2048, bl);
        // CLOSE EXPONENTIAL SHADOW MAP (CESM): elimina o 'shadow acne' POR DESIGN.
        // Em vez de comparar profundidade com bias (que ora causava listras, ora
        // vazamento, dependendo do angulo da superficie), o CESM usa comparacao
        // exponencial suave. O 'Close' mantem a sombra de contato entre objetos
        // (o ESM aberto nao fazia). depthScale controla a nitidez da transicao.
        sg.forceBackFacesOnly = false;
        sg.useCloseExponentialShadowMap = true;
        sg.depthScale = 2500;          // alto -> borda de sombra bem definida, sem 'vazar' luz
        sg.bias = 0.0;                 // CESM nao usa bias tradicional
        light._sg = sg;
        this._applySoftness(light);
        this._applyShadowDarkness(light);
        // Marcador visual: esfera perto do modelo (raio HELPER) + linha ate o centro,
        // indicando a direcao de onde a luz vem.
        var hp = helperPos(light.azimuth, light.elevation);
        var marker = BABYLON.MeshBuilder.CreateSphere('mk' + light.id, { diameter: 0.16 }, this.scene);
        marker.position = hp.clone();
        var mm = new BABYLON.StandardMaterial('mkm' + light.id, this.scene);
        mm.emissiveColor = BABYLON.Color3.FromHexString(light.color);
        mm.disableLighting = true; marker.material = mm; marker.isPickable = false;

        var line = BABYLON.MeshBuilder.CreateLines('ln' + light.id, { points: [hp.clone(), BABYLON.Vector3.Zero()], updatable: true }, this.scene);
        line.color = BABYLON.Color3.FromHexString(light.color); line.isPickable = false; line.alpha = 0.6;

        light._bl = bl; light._sg = sg; light._marker = marker; light._line = line;
        for (var i = 0; i < this._casters.length; i++) sg.addShadowCaster(this._casters[i]);

        this.lights.push(light);
        this._applyEnabled(light);
        marker.setEnabled(this.showHelpers && light.enabled);
        return light;
    };

    // A FORCA da sombra acompanha a intensidade da luz. No Babylon, darkness e
    // invertido: 0 = sombra 100% preta, 1 = sem sombra. Luz mais forte -> sombra
    // mais definida (mais escura). Faixa util: intensidade 0..6 -> darkness 0.85..0.05.
    LightManager.prototype._applyShadowDarkness = function (light) {
        var sg = light._sg; if (!sg) return;
        var it = Math.max(0, parseFloat(light.intensity));
        var t = Math.min(1, it / 6);                 // 0..1 conforme a intensidade
        // Sombra com mais influencia: base ja e razoavelmente densa (0.6) e vai
        // ate preto total (0.0) com luz forte. darkness invertido: 0 = mais escura.
        var darkness = 0.6 - t * 0.6;
        sg.setDarkness(Math.max(0.0, Math.min(0.9, darkness)));
    };

    // Mapeia softness (dureza da borda) + sourceSize (abertura da penumbra)
    // para o blur do CESM. softness alto = borda mais suave (penumbra maior).
    LightManager.prototype._applySoftness = function (light) {
        var sg = light._sg; if (!sg) return;
        var soft = Math.max(0, parseFloat(light.softness));            // 1..96 dureza da borda
        var src = Math.max(1, parseFloat(light.sourceSize != null ? light.sourceSize : 6)); // 1..14 tamanho da fonte
        // Suavidade define o blur base; o tamanho da fonte AMPLIA a penumbra
        // (fonte maior = sombra mais macia e espalhada), como uma luz de area.
        sg.useKernelBlur = true;
        sg.blurKernel = Math.max(1, Math.min(96, soft * (src / 6)));
        sg.blurScale = 2;
    };

    LightManager.prototype.registerShadowCasters = function (meshes) {
        this._casters = meshes || [];
        for (var i = 0; i < this.lights.length; i++) {
            var sg = this.lights[i]._sg;
            for (var j = 0; j < this._casters.length; j++) sg.addShadowCaster(this._casters[j]);
        }
    };

    // Adiciona projetores de sombra SEM apagar os ja registrados (composicao).
    LightManager.prototype.addShadowCasters = function (meshes) {
        if (!meshes) return;
        this._casters = (this._casters || []).concat(meshes);
        for (var i = 0; i < this.lights.length; i++) {
            var sg = this.lights[i]._sg;
            for (var j = 0; j < meshes.length; j++) sg.addShadowCaster(meshes[j]);
        }
    };

    LightManager.prototype.remove = function (id) {
        for (var i = 0; i < this.lights.length; i++) {
            if (this.lights[i].id === id) {
                var l = this.lights[i];
                if (l._sg) l._sg.dispose();
                if (l._bl) l._bl.dispose();
                if (l._marker) l._marker.dispose();
                if (l._line) l._line.dispose();
                this.lights.splice(i, 1);
                return true;
            }
        }
        return false;
    };

    LightManager.prototype.get = function (id) {
        for (var i = 0; i < this.lights.length; i++) if (this.lights[i].id === id) return this.lights[i];
        return null;
    };

    LightManager.prototype.update = function (id, field, value) {
        var l = this.get(id); if (!l) return;
        l[field] = value;
        switch (field) {
            case 'color':
                l._bl.diffuse = BABYLON.Color3.FromHexString(value);
                if (l._marker && l._marker.material) l._marker.material.emissiveColor = BABYLON.Color3.FromHexString(value);
                if (l._line) l._line.color = BABYLON.Color3.FromHexString(value);
                break;
            case 'intensity': l._bl.intensity = this._effectiveIntensity(l); this._applyShadowDarkness(l); break;
            case 'softness': this._applySoftness(l); break;
            case 'sourceSize':
                // Tamanho da fonte: amplia a penumbra da SOMBRA (o Blend cuida da
                // borda do cone separadamente).
                this._applySoftness(l);
                break;
            case 'azimuth':
            case 'elevation':
                // Posicao vale para todos; direcao so para sun/spot.
                l._bl.position = sphericalPos(l.azimuth, l.elevation);
                if (l._bl.direction) l._bl.direction = sphericalDir(l.azimuth, l.elevation);
                var hp = helperPos(l.azimuth, l.elevation);
                if (l._marker) l._marker.position = hp.clone();
                if (l._line) {
                    l._line = BABYLON.MeshBuilder.CreateLines('ln'+l.id, { points:[hp.clone(), BABYLON.Vector3.Zero()], instance: l._line });
                }
                break;
            case 'range':
                l.range = parseFloat(value);
                if (l._bl && typeof l._bl.range !== 'undefined') l._bl.range = Math.max(60, l.range * 2);
                break;
            case 'spotAngle':
                l.spotAngle = parseFloat(value);
                this._applySpotAngle(l);
                break;
            case 'spotBlend':
                l.spotBlend = parseFloat(value);
                this._applySpotAngle(l);
                break;
            case 'enabled': this._applyEnabled(l); break;
        }
    };

    // O cone do spot: 'angle' e a borda externa; 'innerAngle' e onde comeca a
    // suavizacao. Igualar os dois da borda DURA; innerAngle menor da borda macia.
    // Aqui a maciez da borda acompanha o tamanho da fonte (sourceSize).
    LightManager.prototype._applySpotAngle = function (light) {
        var bl = light._bl;
        if (!bl || light.type !== 'spot') return;
        if (typeof bl.angle === 'undefined') return;
        // Size (Blender): abertura do cone.
        var outer = Math.max(5, parseFloat(light.spotAngle)) * Math.PI / 180;
        bl.angle = outer;
        // Blend (Blender): 0 = borda dura (innerAngle == angle);
        // 1 = borda toda esfumada (innerAngle == 0).
        var blend = Math.max(0, Math.min(1, parseFloat(light.spotBlend != null ? light.spotBlend : 0.15)));
        if (typeof bl.innerAngle !== 'undefined') bl.innerAngle = outer * (1 - blend);
    };

    // Troca o TIPO da luz (sun/point/spot) preservando cor, intensidade e
    // posicao. Recria a luz Babylon e reassocia o ShadowGenerator e os casters.
    LightManager.prototype.setType = function (id, type) {
        var l = this.get(id); if (!l) return;
        if (type !== 'sun' && type !== 'point' && type !== 'spot') return;
        if (l.type === type) return;
        l.type = type;
        var wasEnabled = l.enabled;
        // Descarta a luz e o gerador antigos.
        if (l._sg) { try { l._sg.dispose(); } catch (e) {} }
        if (l._bl) { try { l._bl.dispose(); } catch (e) {} }
        // Recria a luz e o gerador com o novo tipo.
        var bl = this._buildBabylonLight(l);
        var sg = new BABYLON.ShadowGenerator(2048, bl);
        sg.forceBackFacesOnly = false;
        sg.useCloseExponentialShadowMap = true;
        sg.depthScale = 2500;
        sg.bias = 0.0;
        l._bl = bl; l._sg = sg;
        this._applySoftness(l);
        this._applySpotAngle(l);
        this._applyShadowDarkness(l);
        // Reassocia todos os projetores de sombra ja conhecidos.
        for (var j = 0; j < this._casters.length; j++) sg.addShadowCaster(this._casters[j]);
        l.enabled = wasEnabled;
        this._applyEnabled(l);
    };

    LightManager.prototype.setHelpersVisible = function (v) {
        this.showHelpers = v;
        for (var i = 0; i < this.lights.length; i++) { var en = v && this.lights[i].enabled; this.lights[i]._marker.setEnabled(en); if (this.lights[i]._line) this.lights[i]._line.setEnabled(en); }
    };

    LightManager.prototype._applyEnabled = function (l) {
        l._bl.setEnabled(l.enabled);
        var v = this.showHelpers && l.enabled;
        if (l._marker) l._marker.setEnabled(v);
        if (l._line) l._line.setEnabled(v);
    };

    global.LightManager = LightManager;
})(window);
