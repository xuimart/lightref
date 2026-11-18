/*
 * postfx.js - pos-producao do LightRef (Babylon.js v9). ASCII-only.
 *
 * Faz TUDO num unico PostProcess de shader na camera: exposicao, contraste,
 * temperatura, saturacao, preto e branco, curvas (LUT), posterize e cutout.
 * Controle total, sem depender de ColorCurves (que nao recomputava saturacao/
 * temperatura direito).
 *
 * API: setParam / getParams / applyParams / reset / setCurve / getCurves.
 *
 * Depende de window.LightRefCurves (carregado por js/curves.js ANTES deste
 * arquivo em index.html).
 */
(function (global) {
    'use strict';

    var NEUTRAL = {
        exposure: 0.0, temperature: 0.0, contrast: 0.0, saturation: 1.0,
        blackWhite: 0, posterizeOn: 0, posterizeLevels: 6, cutoutOn: 0, cutoutLevels: 4,
        curves: {
            lum: [ { x: 0, y: 0 }, { x: 1, y: 1 } ],
            r:   [ { x: 0, y: 0 }, { x: 1, y: 1 } ],
            g:   [ { x: 0, y: 0 }, { x: 1, y: 1 } ],
            b:   [ { x: 0, y: 0 }, { x: 1, y: 1 } ]
        }
    };

    /*
     * Deep copy of a curves object into a brand-new object with new {x,y}
     * objects for every point, so NEUTRAL.curves is never shared/mutated.
     * Each of the four channels falls back to sanitized identity when missing
     * or malformed (LightRefCurves.sanitizePoints returns identity for junk).
     */
    function deepCopyCurves(c) {
        var src = c || {};
        var out = {};
        var channels = ['lum', 'r', 'g', 'b'];
        var i, j, chan, pts, dst, p;
        for (i = 0; i < channels.length; i++) {
            chan = channels[i];
            pts = global.LightRefCurves.sanitizePoints(src[chan]);
            dst = [];
            for (j = 0; j < pts.length; j++) {
                p = pts[j];
                dst.push({ x: p.x, y: p.y });
            }
            out[chan] = dst;
        }
        return out;
    }

    function PostFX(scene, camera, engine) {
        this.scene = scene; this.camera = camera; this.engine = engine;
        this.enabled = true;
        this.params = {};
        for (var k in NEUTRAL) {
            if (!NEUTRAL.hasOwnProperty(k)) continue;
            if (k === 'curves') {
                // DEEP COPY so edits never leak into NEUTRAL (the generic loop
                // would copy the object by reference).
                this.params.curves = deepCopyCurves(NEUTRAL.curves);
            } else {
                this.params[k] = NEUTRAL[k];
            }
        }
        // LUT state.
        this._lutTex = null;
        this._lutDirty = true;
        this._curvesOn = 0;
        // Desliga o image processing da cena (fariamos dupla aplicacao).
        try { scene.imageProcessingConfiguration.isEnabled = false; } catch (e) {}
        this._registerShader();
        this._pp = null;
        this._ensurePP();
        this._installLutObserver();
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
            'uniform sampler2D curveLut;',// 256 x 2 RGBA, UNSIGNED_BYTE
            'uniform float curvesOn;',    // 0/1 fast-path flag
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
            '  if (curvesOn > 0.5) {',
            '    float lc = dot(c, LUMA);',
            '    float lOut = texture2D(curveLut, vec2(lc, 0.75)).r;',
            '    float ratio = lc > 0.0001 ? lOut / lc : 0.0;',
            '    c = clamp(c * ratio, 0.0, 1.0);',
            '    c.r = texture2D(curveLut, vec2(c.r, 0.25)).r;',
            '    c.g = texture2D(curveLut, vec2(c.g, 0.25)).g;',
            '    c.b = texture2D(curveLut, vec2(c.b, 0.25)).b;',
            '    c = clamp(c, 0.0, 1.0);',
            '  }',
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
            ['exposure','contrast','temperature','saturation','bw','postOn','postLv','cutOn','cutLv','curvesOn'],
            ['curveLut'], 1.0, this.camera);
        this._pp.onApply = function (effect) {
            var p = self.params;
            // Texture uploads run before the scene, never while this pass is bound.
            effect.setFloat('exposure', Math.pow(2, p.exposure));
            effect.setFloat('contrast', 1 + p.contrast);
            effect.setFloat('temperature', p.temperature);
            effect.setFloat('saturation', p.blackWhite === 1 ? 1.0 : p.saturation);
            effect.setFloat('bw', p.blackWhite);
            effect.setFloat('postOn', p.posterizeOn);
            effect.setFloat('postLv', p.posterizeLevels);
            effect.setFloat('cutOn', p.cutoutOn);
            effect.setFloat('cutLv', p.cutoutLevels);
            effect.setFloat('curvesOn', self._curvesOn);
            if (self._lutTex) effect.setTexture('curveLut', self._lutTex);
            // When _lutTex is null, bind nothing; curvesOn is 0 so the shader
            // skips the block entirely.
        };
    };

    PostFX.prototype._installLutObserver = function () {
        if (this._lutObserver) return;
        var self = this;
        this._lutObserver = this.scene.onBeforeRenderObservable.add(function () {
            if (self._lutDirty) self._rebuildLut();
        });
        this.scene.onDisposeObservable.addOnce(function () {
            self.scene.onBeforeRenderObservable.remove(self._lutObserver);
            if (self._lutTex) self._lutTex.dispose();
            self._lutTex = null;
        });
    };

    /*
     * Rebuild the 256x2 RGBA UNSIGNED_BYTE LUT texture from the four curves.
     *   row 0 (y center 0.25): per-channel R=lutR, G=lutG, B=lutB, A=255
     *   row 1 (y center 0.75): luminance R=G=B=lutLum, A=255
     * curvesOn = 0 when all four channels are identity, else 1.
     *
     * Babylon API used (confirmed in js/vendor/babylon.js):
     *   BABYLON.RawTexture.CreateRGBATexture(data, width, height, scene,
     *       generateMipMaps, invertY, samplingMode, type)
     * This factory sets TEXTUREFORMAT_RGBA (=5) and TEXTURETYPE_UNSIGNED_BYTE
     * internally, so we do not have to guess format/type constant names. We
     * pass nearest sampling and no mipmaps, then force CLAMP wrap on both axes.
     * The same texture is updated for the whole drag. A failed update keeps
     * the last valid texture and curve flag instead of flashing the identity.
     */
    PostFX.prototype._rebuildLut = function () {
        var LRC = global.LightRefCurves;
        var tex = null;
        try {
            var cv = this.params.curves || {};
            var lutLum = LRC.buildLut256(cv.lum);
            var lutR = LRC.buildLut256(cv.r);
            var lutG = LRC.buildLut256(cv.g);
            var lutB = LRC.buildLut256(cv.b);

            var buf = new Uint8Array(256 * 2 * 4);
            var i, o;
            // Row 0: per-channel curves.
            for (i = 0; i < 256; i++) {
                o = i * 4;
                buf[o] = lutR[i];
                buf[o + 1] = lutG[i];
                buf[o + 2] = lutB[i];
                buf[o + 3] = 255;
            }
            // Row 1: luminance curve replicated into R/G/B.
            for (i = 0; i < 256; i++) {
                o = (256 + i) * 4;
                buf[o] = lutLum[i];
                buf[o + 1] = lutLum[i];
                buf[o + 2] = lutLum[i];
                buf[o + 3] = 255;
            }

            // Resolve nearest sampling mode and clamp address mode defensively
            // (prefer named statics, fall back to the well-known numeric values
            // NEAREST_SAMPLINGMODE=1, CLAMP_ADDRESSMODE=0).
            var TEX = BABYLON.Texture;
            var nearest = (TEX && TEX.NEAREST_SAMPLINGMODE != null) ? TEX.NEAREST_SAMPLINGMODE : 1;
            var clampMode = (TEX && TEX.CLAMP_ADDRESSMODE != null) ? TEX.CLAMP_ADDRESSMODE : 0;

            if (this._lutTex) {
                this._lutTex.update(buf);
            } else {
                tex = BABYLON.RawTexture.CreateRGBATexture(
                    buf, 256, 2, this.scene,
                    false,      // no mipmaps
                    false,      // no invertY
                    nearest     // nearest sampling (type defaults to UNSIGNED_BYTE)
                );
                tex.wrapU = clampMode;
                tex.wrapV = clampMode;
                this._lutTex = tex;
            }

            this._curvesOn = (LRC.isIdentity(cv.lum) && LRC.isIdentity(cv.r) &&
                              LRC.isIdentity(cv.g) && LRC.isIdentity(cv.b)) ? 0 : 1;
            this._lutError = null;
        } catch (e) {
            if (tex && tex !== this._lutTex) { try { tex.dispose(); } catch (e2) {} }
            this._lutError = String(e && e.message || e);
        }
        // Clear the dirty flag in BOTH success and failure so we do not spin.
        this._lutDirty = false;
    };

    PostFX.prototype.setCurve = function (channel, points) {
        if (channel !== 'lum' && channel !== 'r' && channel !== 'g' && channel !== 'b') return;
        this.params.curves[channel] = global.LightRefCurves.sanitizePoints(points);
        this._lutDirty = true;
    };

    PostFX.prototype.getCurves = function () {
        return deepCopyCurves(this.params.curves);
    };

    PostFX.prototype._apply = function () { /* uniforms lidos no onApply a cada frame */ };

    PostFX.prototype.setParam = function (name, value) {
        if (!(name in this.params)) return;
        if (name === 'curves') return; // curves go through setCurve only
        this.params[name] = value;
    };
    PostFX.prototype.getParams = function () {
        var out = {};
        for (var k in this.params) {
            if (!this.params.hasOwnProperty(k)) continue;
            if (k === 'curves') { out.curves = deepCopyCurves(this.params.curves); }
            else { out[k] = this.params[k]; }
        }
        return out;
    };
    PostFX.prototype.applyParams = function (obj) {
        for (var k in NEUTRAL) {
            if (!NEUTRAL.hasOwnProperty(k)) continue;
            if (k === 'curves') continue; // handled below
            this.params[k] = (obj && obj[k] !== undefined) ? obj[k] : NEUTRAL[k];
        }
        // Restore curves: deep copy + sanitize each channel; missing/malformed
        // channel falls back to identity (deepCopyCurves does both).
        this.params.curves = deepCopyCurves(obj && obj.curves);
        this._lutDirty = true;
    };
    PostFX.prototype.reset = function () { this.applyParams(NEUTRAL); };
    PostFX.prototype.render = function () {};
    PostFX.prototype.setSize = function () {};

    PostFX.NEUTRAL = NEUTRAL;
    global.LightRefPostFX = PostFX;
})(window);
