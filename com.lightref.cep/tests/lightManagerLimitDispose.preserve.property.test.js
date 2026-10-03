/*
 * lightManagerLimitDispose.preserve.property.test.js - PRESERVATION property
 * test for the bugfix spec "light-manager-limit-and-dispose". ASCII-only, ES5
 * (var; no arrow/const/let/template literals). Uses fast-check from node_modules.
 *
 * Loads the REAL js/lights.js via vm against a minimal stubbed Babylon (plus a
 * fake scene whose single shared material records markAsDirty flags and dispose
 * calls). For random sequences of add/remove/update operations it asserts the
 * preservation invariants from design.md "Preservation Checking":
 *
 *  P-A Single-material invariant proxy: LightManager never constructs a
 *      PBRMaterial (it only marks dirty). We count PBRMaterial constructions and
 *      assert the count stays 0 across the whole random sequence.
 *  P-B Public API arity unchanged: add/remove/get/update/registerShadowCasters/
 *      addShadowCasters/setHelpersVisible exist with their original arities, and
 *      .lights[] length equals the net (adds - successful removes) for the run.
 *  P-C Shadow pipeline preserved: each add() builds a ShadowGenerator; each
 *      successful remove() disposes _sg, _bl, _marker, _line (dispose spies).
 *  P-D update() for color/intensity/azimuth/elevation mutates _bl and does NOT
 *      mark lights dirty. Verified by counting markAsDirty(LightDirtyFlag)
 *      calls: that count must equal the number of SET-CHANGING ops (adds +
 *      successful removes), NOT including updates.
 *
 * Iteration counts are kept modest so the test runs fast.
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var fc = require('fast-check');

/* Original public-API arities (function .length) that must be preserved. */
var EXPECTED_ARITY = {
    add: 1,
    remove: 1,
    get: 1,
    update: 3,
    registerShadowCasters: 1,
    addShadowCasters: 1,
    setHelpersVisible: 1
};

/* ----------------------------------------------------------------------------
 * Build a fresh stubbed Babylon + fake scene for each property run so counters
 * do not leak between fast-check iterations. Returns { B: BABYLON, scene }.
 * The scene starts with ONE shared material (as the real app has after
 * _ensureMaterial), with markAsDirty and dispose spies.
 * ------------------------------------------------------------------------- */
function makeEnv() {
    var B = {};
    B._pbrCount = 0; // how many PBRMaterial the loaded code constructs

    B.PBRMaterial = function (name, sc) {
        B._pbrCount++;
        this.name = name; this.scene = sc;
        this.maxSimultaneousLights = 4;
        this.isDisposed = false;
        this._dirtyFlags = [];
        this.markAsDirty = function (flag) { this._dirtyFlags.push(flag); };
        if (sc && sc.materials) sc.materials.push(this);
    };

    B.StandardMaterial = function (name, sc) {
        this.name = name; this.scene = sc;
        this.emissiveColor = null; this.disableLighting = false;
        this._dirtyFlags = [];
        this.markAsDirty = function (flag) { this._dirtyFlags.push(flag); };
        // marker material is attached to the mesh, not pushed into scene.materials
    };

    B.Material = { LightDirtyFlag: 2 };

    B.Vector3 = function (x, y, z) {
        this.x = x || 0; this.y = y || 0; this.z = z || 0;
        this.clone = function () { return new B.Vector3(this.x, this.y, this.z); };
    };
    B.Vector3.Zero = function () { return new B.Vector3(0, 0, 0); };

    B.Color3 = function (r, g, b) { this.r = r || 0; this.g = g || 0; this.b = b || 0; };
    B.Color3.FromHexString = function (hex) { return new B.Color3(1, 1, 1); };
    B.Color3.Zero = function () { return new B.Color3(0, 0, 0); };

    B._sgCount = 0; // how many ShadowGenerator built
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
        B._sgCount++;
        this.size = size; this.light = light; this.disposed = false;
        this.forceBackFacesOnly = false; this.useCloseExponentialShadowMap = false;
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

    // Fake scene with ONE shared material already present (post _ensureMaterial).
    var scene = { materials: [] };
    var sharedMat = new B.PBRMaterial('lightrefMat', scene);
    // The shared material was created by the harness, not by LightManager, so
    // reset the PBR counter to 0: the invariant we test is that LightManager
    // itself never constructs a PBRMaterial.
    B._pbrCount = 0;

    return { B: B, scene: scene, sharedMat: sharedMat };
}

/* Load the REAL js/lights.js against a given stubbed BABYLON. */
function loadLightManager(BABYLON) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'lights.js'), 'utf8');
    var fakeWindow = {};
    var sandbox = { window: fakeWindow, BABYLON: BABYLON, Math: Math, console: console };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'lights.js' });
    assert.ok(typeof fakeWindow.LightManager === 'function',
        'lights.js deveria publicar window.LightManager');
    return fakeWindow.LightManager;
}

function countFlag(mat, flag) {
    var n = 0;
    for (var i = 0; i < mat._dirtyFlags.length; i++) {
        if (mat._dirtyFlags[i] === flag) n++;
    }
    return n;
}

/* ----------------------------------------------------------------------------
 * Operation generators. Each op is a plain record with a "kind".
 *   add    -> { kind:'add' }
 *   remove -> { kind:'remove', pick } pick in [0,1) selects an existing light
 *   update -> { kind:'update', field, value } field in color/intensity/azimuth/
 *             elevation (the non-set-changing fields this test targets for P-D)
 * ------------------------------------------------------------------------- */
function opArb() {
    var addArb = fc.record({ kind: fc.constant('add') });
    var removeArb = fc.record({ kind: fc.constant('remove'), pick: fc.double({ min: 0, max: 0.999, noNaN: true }) });
    var updateFieldArb = fc.constantFrom('color', 'intensity', 'azimuth', 'elevation');
    var updateArb = fc.record({
        kind: fc.constant('update'),
        pick: fc.double({ min: 0, max: 0.999, noNaN: true }),
        field: updateFieldArb,
        value: fc.double({ min: 0, max: 180, noNaN: true })
    });
    // Weight toward add so sequences build up lights to remove/update.
    return fc.oneof(
        { weight: 3, arbitrary: addArb },
        { weight: 1, arbitrary: removeArb },
        { weight: 2, arbitrary: updateArb }
    );
}

/* Run one random sequence; assert all invariants. Returns a small summary. */
function runSequence(ops) {
    var env = makeEnv();
    var LightManager = loadLightManager(env.B);
    var FLAG = env.B.Material.LightDirtyFlag;
    var lm = new LightManager(env.scene);

    // P-B: public API arity unchanged (checked once per run, cheap).
    for (var key in EXPECTED_ARITY) {
        if (!EXPECTED_ARITY.hasOwnProperty(key)) continue;
        assert.strictEqual(typeof lm[key], 'function',
            'Public API: ' + key + ' should exist as a function');
        assert.strictEqual(lm[key].length, EXPECTED_ARITY[key],
            'Public API: ' + key + ' arity should be ' + EXPECTED_ARITY[key] +
            ', got ' + lm[key].length);
    }

    var setChangingOps = 0; // adds + successful removes
    var disposedRecords = []; // light objects we removed (to check their spies)

    for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        if (op.kind === 'add') {
            var before = lm.lights.length;
            var light = lm.add({ name: 'L' + i });
            assert.ok(light && light._sg, 'add() should return a light with a _sg (ShadowGenerator)');
            assert.strictEqual(lm.lights.length, before + 1, 'add() should grow .lights by 1');
            setChangingOps++;
        } else if (op.kind === 'remove') {
            if (lm.lights.length === 0) continue; // nothing to remove
            var idx = Math.floor(op.pick * lm.lights.length);
            if (idx >= lm.lights.length) idx = lm.lights.length - 1;
            var target = lm.lights[idx];
            var sg = target._sg, bl = target._bl, mk = target._marker, ln = target._line;
            var ok = lm.remove(target.id);
            assert.strictEqual(ok, true, 'remove() of an existing id should return true');
            // P-C: shadow pipeline disposed.
            assert.strictEqual(sg.disposed, true, 'remove() should dispose _sg');
            assert.strictEqual(bl.disposed, true, 'remove() should dispose _bl');
            assert.strictEqual(mk.disposed, true, 'remove() should dispose _marker');
            assert.strictEqual(ln.disposed, true, 'remove() should dispose _line');
            disposedRecords.push(target);
            setChangingOps++;
        } else { // update
            if (lm.lights.length === 0) continue; // nothing to update
            var uidx = Math.floor(op.pick * lm.lights.length);
            if (uidx >= lm.lights.length) uidx = lm.lights.length - 1;
            var utarget = lm.lights[uidx];
            var blBefore = utarget._bl;
            // P-D: update mutates the light's _bl; capture a field to confirm change.
            var preDiffuse = utarget._bl.diffuse;
            var preIntensity = utarget._bl.intensity;
            var preDir = utarget._bl.direction;
            lm.update(utarget.id, op.field, op.value);
            // _bl object identity is preserved (not recreated) for these fields.
            assert.strictEqual(utarget._bl, blBefore, 'update() must not recreate the light _bl');
            if (op.field === 'color') {
                assert.notStrictEqual(utarget._bl.diffuse, preDiffuse,
                    'update(color) should set a new diffuse on _bl');
            } else if (op.field === 'intensity') {
                assert.strictEqual(utarget._bl.intensity, parseFloat(op.value),
                    'update(intensity) should set _bl.intensity');
            } else { // azimuth / elevation
                assert.notStrictEqual(utarget._bl.direction, preDir,
                    'update(' + op.field + ') should recompute _bl.direction');
            }
        }
    }

    // P-A: LightManager never constructed a PBRMaterial.
    assert.strictEqual(env.B._pbrCount, 0,
        'Single-material invariant: LightManager must not construct any PBRMaterial (got ' +
        env.B._pbrCount + ')');

    // P-B: .lights[] length tracks the net of adds and successful removes. The
    // per-op asserts above already verified add() grows .lights by exactly 1 and
    // remove() returns true for an existing id; here we cross-check the final
    // length equals (adds - successful removes) reconstructed from this run.
    var adds = 0, successfulRemoves = disposedRecords.length;
    for (var j = 0; j < ops.length; j++) { if (ops[j].kind === 'add') adds++; }
    var finalLen = lm.lights.length;
    assert.strictEqual(finalLen, adds - successfulRemoves,
        '.lights length (' + finalLen + ') should equal adds (' + adds +
        ') minus successful removes (' + successfulRemoves + ')');

    // P-D: markAsDirty(LightDirtyFlag) count on the shared material equals the
    // number of SET-CHANGING ops (adds + successful removes). Updates excluded.
    var dirtyCount = countFlag(env.sharedMat, FLAG);
    assert.strictEqual(dirtyCount, setChangingOps,
        'markAsDirty(LightDirtyFlag) count (' + dirtyCount +
        ') should equal set-changing ops (' + setChangingOps + '); updates must NOT mark dirty');

    return { setChangingOps: setChangingOps, finalLen: finalLen, dirtyCount: dirtyCount };
}

function run() {
    var runs = 0;
    fc.assert(
        fc.property(fc.array(opArb(), { minLength: 0, maxLength: 20 }), function (ops) {
            runs++;
            runSequence(ops);
            return true;
        }),
        { numRuns: 60 }
    );

    // Also run a couple of fixed deterministic sequences as sanity examples.
    runSequence([{ kind: 'add' }]);
    runSequence([{ kind: 'add' }, { kind: 'add' }, { kind: 'remove', pick: 0 }]);
    runSequence([{ kind: 'add' }, { kind: 'update', pick: 0, field: 'intensity', value: 5 }]);

    return { propertyRuns: runs };
}

var result = run();
console.log('Preserve property test OK: ' + result.propertyRuns +
    ' randomized runs + 3 deterministic sequences passed.');

module.exports = { run: run };
