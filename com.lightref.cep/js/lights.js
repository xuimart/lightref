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
        var x = cosEl * Math.sin(az), y = Math.sin(el), z = cosEl * Math.cos(az);
        return new BABYLON.Vector3(-x, -y, -z); // aponta para a origem
    }
    var HELPER_DISTANCE = 3.4; // marcador fica logo fora do modelo (~3 unidades)
    function helperPos(azDeg, elDeg) {
        var az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180, cosEl = Math.cos(el);
        return new BABYLON.Vector3(HELPER_DISTANCE*cosEl*Math.sin(az), HELPER_DISTANCE*Math.sin(el), HELPER_DISTANCE*cosEl*Math.cos(az));
    }
    function sphericalPos(azDeg, elDeg) {
        var az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
        var cosEl = Math.cos(el);
        return new BABYLON.Vector3(LIGHT_DISTANCE*cosEl*Math.sin(az), LIGHT_DISTANCE*Math.sin(el), LIGHT_DISTANCE*cosEl*Math.cos(az));
    }

    function LightManager(scene) {
        this.scene = scene;
        this.lights = [];
        this.showHelpers = true;
        this._casters = [];
    }

    LightManager.prototype.add = function (opts) {
        opts = opts || {};
        var light = {
            id: nextId++,
            name: opts.name || ('Luz ' + nextId),
            color: (opts.color !== undefined) ? opts.color : '#ffffff',
            intensity: (opts.intensity !== undefined) ? opts.intensity : 3.0,
            azimuth: (opts.azimuth !== undefined) ? opts.azimuth : 215,
            elevation: (opts.elevation !== undefined) ? opts.elevation : 30,
            enabled: (opts.enabled !== undefined) ? opts.enabled : true
        };

        var dir = sphericalDir(light.azimuth, light.elevation);
        var bl = new BABYLON.DirectionalLight('L' + light.id, dir, this.scene);
        bl.position = sphericalPos(light.azimuth, light.elevation);
        bl.intensity = light.intensity;
        bl.diffuse = BABYLON.Color3.FromHexString(light.color);

        var sg = new BABYLON.ShadowGenerator(512, bl);
        sg.usePercentageCloserFiltering = true;   // PCF: suave e barato
        sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
        sg.bias = 0.002;

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

    LightManager.prototype.registerShadowCasters = function (meshes) {
        this._casters = meshes || [];
        for (var i = 0; i < this.lights.length; i++) {
            var sg = this.lights[i]._sg;
            for (var j = 0; j < this._casters.length; j++) sg.addShadowCaster(this._casters[j]);
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
            case 'intensity': l._bl.intensity = parseFloat(value); break;
            case 'azimuth':
            case 'elevation':
                l._bl.direction = sphericalDir(l.azimuth, l.elevation);
                l._bl.position = sphericalPos(l.azimuth, l.elevation);
                var hp = helperPos(l.azimuth, l.elevation);
                if (l._marker) l._marker.position = hp.clone();
                if (l._line) {
                    // Atualiza a geometria da linha in-place (instance) - sem recriar,
                    // o que causava o piscar durante o arraste.
                    l._line = BABYLON.MeshBuilder.CreateLines('ln'+l.id, { points:[hp.clone(), BABYLON.Vector3.Zero()], instance: l._line });
                }
                break;
            case 'enabled': this._applyEnabled(l); break;
        }
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