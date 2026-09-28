/*
 * postfx.js - pos-producao do LightRef (Babylon.js v9). ASCII-only.
 *
 * Faz TUDO num unico PostProcess de shader na camera: exposicao, contraste,
 * temperatura, saturacao, preto e branco, posterize e cutout. Controle total,
 * sem depender de ColorCurves (que nao recomputava saturacao/temperatura direito).
 *
 * API: setParam / getParams / applyParams / reset.
 */
(function (global) {
    'use strict';

    var NEUTRAL = {
        exposure: 0.0, temperature: 0.0, contrast: 0.0, saturation: 1.0,
        blackWhite: 0, posterizeOn: 0, posterizeLevels: 6, cutoutOn: 0, cutoutLevels: 4
    };

    function PostFX(scene, camera, engine) {
        this.scene = scene; this.camera = camera; this.engine = engine;
        this.enabled = true;
        this.params = {};
        for (var k in NEUTRAL) if (NEUTRAL.hasOwnProperty(k)) this.params[k] = NEUTRAL[k];
        // Desliga o image processing da cena (fariamos dupla aplicacao).
        try { scene.imageProcessingConfiguration.isEnabled = false; } catch (e) {}
        this._registerShader();
        this._pp = null;
        this._ensurePP();
        this._apply();
    }

    PostFX.prototype._registerShader = function () {
        var n = 'lightrefFx';
        if (BABYLON.Effect.ShadersStore[n + 'FragmentShader']) return;
        BABYLON.Effect.ShadersStore[n + 'FragmentShader'] = [
            'precision highp float;',
            'varying vec2 vUV;',
            'uniform sampler2D textureSampler;',
            'uniform float exposure;',   // multiplicador
            'uniform float contrast;',   // 0..2
            'uniform float temperature;',// -1..1
            'uniform float saturation;', // 0..2
            'uniform float bw;',         // 0/1
            'uniform float postOn; uniform float postLv;',
            'uniform float cutOn; uniform float cutLv;',
            'const vec3 LUMA = vec3(0.2126,0.7152,0.0722);',
            'void main(void){',
            '  vec4 texel = texture2D(textureSampler, vUV);',
            '  vec3 c = texel.rgb;',
            '  c *= exposure;',                                   // exposicao
            '  c.r += temperature * 0.12; c.b -= temperature * 0.12;', // temperatura
            '  c = (c - 0.5) * contrast + 0.5;',                 // contraste
            '  float l = dot(c, LUMA);',
            '  c = mix(vec3(l), c, saturation);',                // saturacao
            '  if (bw > 0.5) c = vec3(dot(c, LUMA));',           // p&b
            '  c = clamp(c, 0.0, 1.0);',
            '  if (postOn > 0.5) { c = floor(c * postLv) / max(postLv - 1.0, 1.0); c = clamp(c,0.0,1.0); }',
            '  if (cutOn > 0.5) {',
            '    float lum = dot(c, LUMA);',
            '    float st = floor(lum * cutLv) / max(cutLv - 1.0, 1.0);',
            '    float ratio = lum > 0.001 ? st / lum : 0.0;',
            '    c = clamp(c * ratio, 0.0, 1.0);',
            '  }',
            '  gl_FragColor = vec4(c, texel.a);',
            '}'
        ].join('\n');
    };

    PostFX.prototype._ensurePP = function () {
        if (this._pp) return;
        var self = this;
        this._pp = new BABYLON.PostProcess('lightrefFx', 'lightrefFx',
            ['exposure','contrast','temperature','saturation','bw','postOn','postLv','cutOn','cutLv'],
            null, 1.0, this.camera);
        this._pp.onApply = function (effect) {
            var p = self.params;
            effect.setFloat('exposure', Math.pow(2, p.exposure));
            effect.setFloat('contrast', 1 + p.contrast);
            effect.setFloat('temperature', p.temperature);
            effect.setFloat('saturation', p.blackWhite === 1 ? 1.0 : p.saturation);
            effect.setFloat('bw', p.blackWhite);
            effect.setFloat('postOn', p.posterizeOn);
            effect.setFloat('postLv', p.posterizeLevels);
            effect.setFloat('cutOn', p.cutoutOn);
            effect.setFloat('cutLv', p.cutoutLevels);
        };
    };

    PostFX.prototype._apply = function () { /* uniforms lidos no onApply a cada frame */ };

    PostFX.prototype.setParam = function (name, value) {
        if (!(name in this.params)) return;
        this.params[name] = value;
    };
    PostFX.prototype.getParams = function () {
        var out = {}; for (var k in this.params) if (this.params.hasOwnProperty(k)) out[k] = this.params[k]; return out;
    };
    PostFX.prototype.applyParams = function (obj) {
        for (var k in NEUTRAL) { if (!NEUTRAL.hasOwnProperty(k)) continue; this.params[k] = (obj && obj[k] !== undefined) ? obj[k] : NEUTRAL[k]; }
    };
    PostFX.prototype.reset = function () { this.applyParams(NEUTRAL); };
    PostFX.prototype.render = function () {};
    PostFX.prototype.setSize = function () {};

    PostFX.NEUTRAL = NEUTRAL;
    global.LightRefPostFX = PostFX;
})(window);