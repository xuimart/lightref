/*
 * lightManagerLimitDispose.fix.test.js - FIX-CHECKING test for the bugfix spec
 * "light-manager-limit-and-dispose". ASCII-only, ES5 (var; no arrow/const/let/
 * template literals).
 *
 * Unlike the exploration test (which replicated the material-creation path with
 * a local copy), this test observes the REAL cap from the actual production
 * code. It does so two ways:
 *   (a) RUNTIME: it loads the real js/scene.js in a vm sandbox (its IIFE exposes
 *       Scene as window.LightRefScene) and invokes the REAL
 *       Scene.prototype._ensureMaterial on a minimal fake "this" with a stubbed
 *       BABYLON.PBRMaterial. The Scene constructor only assigns fields (the heavy
 *       Babylon Engine is built in init(), which we never call), so grabbing the
 *       prototype method and invoking it headlessly is safe and exercises the
 *       real assignment "this._material.maxSimultaneousLights = 10;".
 *   (b) SOURCE-LEVEL (backstop): it reads js/scene.js text and asserts
 *       _ensureMaterial contains an assignment of maxSimultaneousLights to 10.
 *       This is a source-level assertion, kept as a defensive cross-check in
 *       case the runtime path ever changes shape.
 *
 * The add()/remove() dirty-marking assertions load the REAL js/lights.js via vm
 * against the stubbed Babylon and inspect the markAsDirty spies.
 *
 * These are the FIXED expectations: they must PASS on the fixed code.
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

/* ----------------------------------------------------------------------------
 * Minimal stubbed BABYLON, enough to (a) run the real _ensureMaterial creation
 * path and (b) run LightManager.add()/remove() end to end. Every material
 * exposes a markAsDirty spy that records the flags it receives.
 * ------------------------------------------------------------------------- */
function makeBabylon(scene) {
    var B = {};

    // PBRMaterial: default maxSimultaneousLights to 4 (matches stock Babylon),
    // so the only way the test observes 10 is if the production code sets it.
    B.PBRMaterial = function (name, sc) {
        this.name = name;
        this.scene = sc;
        this.enableSpecularAntiAliasing = false;
        this.maxSimultaneousLights = 4; // stock Babylon default
        this.isDisposed = false;
        this._dirtyFlags = [];
        this.markAsDirty = function (flag) { this._dirtyFlags.push(flag); };
        B._pbrInstances.push(this);
        if (sc && sc.materials) sc.materials.push(this);
    };
    B._pbrInstances = [];

    // StandardMaterial: marker material created inside LightManager.add().
    B.StandardMaterial = function (name, sc) {
        this.name = name;
        this.scene = sc;
        this.emissiveColor = null;
        this.disableLighting = false;
        this.isDisposed = false;
        this._dirtyFlags = [];
        this.markAsDirty = function (flag) { this._dirtyFlags.push(flag); };
        if (sc && sc.materials) sc.materials.push(this);
    };

    B.Material = { LightDirtyFlag: 2 };

    B.Vector3 = function (x, y, z) {
        this.x = x || 0; this.y = y || 0; this.z = z || 0;
        this.clone = function () { return new B.Vector3(this.x, this.y, this.z); };
    };
    B.Vector3.Zero = function () { return new B.Vector3(0, 0, 0); };

    B.Color3 = function (r, g, b) { this.r = r || 0; this.g = g || 0; this.b = b || 0; };
    B.Color3.FromHexString = function (hex) { return new B.Color3(0, 0, 0); };
    B.Color3.Zero = function () { return new B.Color3(0, 0, 0); };

    B.DirectionalLight = function (name, dir, sc) {
        this.name = name; this.direction = dir; this.scene = sc;
        this.position = null; this.intensity = 1; this.diffuse = null;
        this.shadowMinZ = 0; this.shadowMaxZ = 0; this.autoUpdateExtends = true;
        this.orthoLeft = 0; this.orthoRight = 0; this.orthoTop = 0; this.orthoBottom = 0;
        this.enabled = true; this.disposed = false;
        this.setEnabled = function (v) { this.enabled = v; };
        this.dispose = function () { this.disposed = true; };
    };

    B.ShadowGenerator = function (size, light) {
        this.size = size; this.light = light; this.disposed = false;
        this.forceBackFacesOnly = false;
        this.useCloseExponentialShadowMap = false;
        this.depthScale = 0; this.bias = 0;
        this.useKernelBlur = false; this.blurKernel = 0; this.blurScale = 0;
        this.setDarkness = function () {};
        this.addShadowCaster = function () {};
        this.dispose = function () { this.disposed = true; };
    };

    function makeMesh(name, sc) {
        return {
            name: name, scene: sc, position: new B.Vector3(0, 0, 0),
            material: null, isPickable: true, color: null, alpha: 1,
            disposed: false,
            setEnabled: function (v) { this.enabled = v; },
            dispose: function () { this.disposed = true; }
        };
    }
    B.MeshBuilder = {
        CreateSphere: function (name, opts, sc) { return makeMesh(name, sc); },
        CreateLines: function (name, opts, sc) { return makeMesh(name, sc); }
    };

    return B;
}

/* ----------------------------------------------------------------------------
 * Load the REAL js/scene.js and return window.LightRefScene (the Scene ctor).
 * scene.js is an IIFE over `window` that assigns global.LightRefScene = Scene.
 * The Scene constructor only sets fields; the Babylon Engine is built in init(),
 * which we never call, so loading is headless-safe.
 * ------------------------------------------------------------------------- */
function loadRealScene(BABYLON) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'scene.js'), 'utf8');
    var fakeWindow = {};
    var sandbox = {
        window: fakeWindow,
        BABYLON: BABYLON,
        Math: Math,
        console: console
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'scene.js' });
    assert.ok(typeof fakeWindow.LightRefScene === 'function',
        'scene.js deveria publicar window.LightRefScene');
    return fakeWindow.LightRefScene;
}

/* ----------------------------------------------------------------------------
 * Load the REAL js/lights.js so LightManager is defined on the fake window.
 * ------------------------------------------------------------------------- */
function loadLightManager(BABYLON) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'lights.js'), 'utf8');
    var fakeWindow = {};
    var sandbox = {
        window: fakeWindow,
        BABYLON: BABYLON,
        Math: Math,
        console: console
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'lights.js' });
    assert.ok(typeof fakeWindow.LightManager === 'function',
        'lights.js deveria publicar window.LightManager');
    return fakeWindow.LightManager;
}

function anyMaterialMarkedLightDirty(scene, flag) {
    for (var i = 0; i < scene.materials.length; i++) {
        var m = scene.materials[i];
        if (!m || !m._dirtyFlags) continue;
        for (var j = 0; j < m._dirtyFlags.length; j++) {
            if (m._dirtyFlags[j] === flag) return true;
        }
    }
    return false;
}

/* Source-level backstop: assert the real _ensureMaterial text sets the cap to 10. */
function sceneSourceSetsCap() {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'scene.js'), 'utf8');
    // Tolerate any whitespace around the assignment; ASCII regex only.
    var re = /maxSimultaneousLights\s*=\s*10\b/;
    return re.test(src);
}

function run() {
    var scene = { materials: [] };
    var BABYLON = makeBabylon(scene);
    var FLAG = BABYLON.Material.LightDirtyFlag; // 2

    /* --- Assertion 1: cap >= 10 from the REAL scene.js _ensureMaterial. -------
     * Invoke the real production method on a minimal fake "this". The fake
     * exposes only the fields _ensureMaterial reads: _material, modelRoot. */
    var Scene = loadRealScene(BABYLON);
    var fakeThis = {
        scene: scene,
        _material: null,
        modelRoot: null // no meshes -> skips the mesh-assignment loop
    };
    var material = Scene.prototype._ensureMaterial.call(fakeThis);
    var observedCap = material.maxSimultaneousLights;
    assert.ok(observedCap >= 10,
        'Fix 1 (runtime): real _ensureMaterial should set maxSimultaneousLights >= 10, got ' + observedCap);

    // Source-level backstop (clearly a source assertion, not runtime behavior).
    assert.ok(sceneSourceSetsCap(),
        'Fix 1 (source): js/scene.js _ensureMaterial should contain maxSimultaneousLights = 10');

    /* --- Assertion 2: add() marks a material lights-dirty. ------------------- */
    // Fresh scene whose materials array already holds the shared material (as a
    // real scene would after _ensureMaterial ran), so add() has something to mark.
    var scene2 = { materials: [] };
    var BABYLON2 = makeBabylon(scene2);
    var Scene2 = loadRealScene(BABYLON2);
    var fakeThis2 = { scene: scene2, _material: null, modelRoot: null };
    Scene2.prototype._ensureMaterial.call(fakeThis2); // pushes shared material into scene2.materials
    var LightManager = loadLightManager(BABYLON2);
    var FLAG2 = BABYLON2.Material.LightDirtyFlag;

    var lm = new LightManager(scene2);
    var l1 = lm.add({ name: 'L1' });
    var markedAfterAdd = anyMaterialMarkedLightDirty(scene2, FLAG2);
    assert.strictEqual(markedAfterAdd, true,
        'Fix 2: after add() at least one material should be markAsDirty(LightDirtyFlag)');

    /* --- Assertion 3: remove() while one light remains marks dirty. ---------
     * Use a clean scene with ONLY the shared material so prior add() marks do
     * not leak into this assertion; verify the remove() itself marks dirty. */
    var scene3 = { materials: [] };
    var BABYLON3 = makeBabylon(scene3);
    var Scene3 = loadRealScene(BABYLON3);
    var fakeThis3 = { scene: scene3, _material: null, modelRoot: null };
    var sharedMat3 = Scene3.prototype._ensureMaterial.call(fakeThis3);
    var LightManager3 = loadLightManager(BABYLON3);
    var FLAG3 = BABYLON3.Material.LightDirtyFlag;

    var lm3 = new LightManager3(scene3);
    var a = lm3.add({ name: 'A' });
    var b = lm3.add({ name: 'B' });
    // Clear the shared material's dirty log so we observe ONLY the remove() mark.
    sharedMat3._dirtyFlags.length = 0;
    lm3.remove(a.id);
    var markedAfterRemove = (function () {
        for (var j = 0; j < sharedMat3._dirtyFlags.length; j++) {
            if (sharedMat3._dirtyFlags[j] === FLAG3) return true;
        }
        return false;
    })();
    assert.strictEqual(markedAfterRemove, true,
        'Fix 3: after remove() with a light remaining, the shared material should be markAsDirty(LightDirtyFlag)');
    assert.strictEqual(lm3.lights.length, 1,
        'Fix 3: one light should remain after removing one of two');

    return {
        observedCap: observedCap,
        sourceSetsCap: sceneSourceSetsCap(),
        markedAfterAdd: markedAfterAdd,
        markedAfterRemove: markedAfterRemove,
        remainingLights: lm3.lights.length
    };
}

var result = run();
console.log('Fix test (fixed code) OK: cap=' + result.observedCap +
    ' (source sets cap=' + result.sourceSetsCap + '), markedAfterAdd=' +
    result.markedAfterAdd + ', markedAfterRemove=' + result.markedAfterRemove);

module.exports = { run: run };
