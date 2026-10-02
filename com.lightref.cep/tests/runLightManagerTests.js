/*
 * runLightManagerTests.js - tiny Node runner for the light-manager bugfix tests.
 * ASCII-only, ES5. The terminal swallows stdout in this environment, so this
 * runner executes each light-manager test file in-process, captures pass/fail
 * plus any error, and WRITES a human-readable summary to tests/_result.txt.
 *
 * Reusable for the later fix/preserve tests: add their filenames to TESTS below.
 * Usage: node tests/runLightManagerTests.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var TESTS = [
    'lightManagerLimitDispose.fix.test.js',
    'lightManagerLimitDispose.preserve.property.test.js'
];

var lines = [];
var passCount = 0;
var failCount = 0;

lines.push('Light Manager bugfix test run');
lines.push('Timestamp: ' + new Date().toISOString());
lines.push('');

for (var i = 0; i < TESTS.length; i++) {
    var name = TESTS[i];
    var full = path.join(__dirname, name);
    try {
        // Clear require cache so a re-run re-evaluates the test module.
        delete require.cache[require.resolve(full)];
        var mod = require(full);
        var detail = '';
        if (mod && typeof mod.run === 'function') {
            var r = mod.run();
            if (r && r.observedCap !== undefined) {
                // fix test shape
                detail = ' [cap=' + r.observedCap +
                    ', sourceSetsCap=' + r.sourceSetsCap +
                    ', markedAfterAdd=' + r.markedAfterAdd +
                    ', markedAfterRemove=' + r.markedAfterRemove +
                    ', remainingLights=' + r.remainingLights + ']';
            } else if (r && r.propertyRuns !== undefined) {
                // preserve property test shape
                detail = ' [propertyRuns=' + r.propertyRuns + ']';
            }
        }
        passCount++;
        lines.push('PASS: ' + name + detail);
    } catch (e) {
        failCount++;
        lines.push('FAIL: ' + name);
        lines.push('  ' + (e && e.message ? e.message : String(e)));
        if (e && e.stack) {
            var st = String(e.stack).split('\n');
            for (var k = 0; k < st.length && k < 6; k++) {
                lines.push('    ' + st[k]);
            }
        }
    }
}

lines.push('');
lines.push('Summary: ' + passCount + ' passed, ' + failCount + ' failed, ' +
    TESTS.length + ' total.');
lines.push('');
lines.push('Note: these are the POST-FIX tests. The fix test asserts the fixed');
lines.push('state (cap >= 10 and add/remove mark lights dirty); the preserve');
lines.push('property test asserts non-triggering inputs are unchanged. PASS');
lines.push('here means the fix is in place and preservation holds.');

var out = lines.join('\n') + '\n';
var outPath = path.join(__dirname, '_result.txt');
fs.writeFileSync(outPath, out, 'utf8');

process.exit(failCount > 0 ? 1 : 0);
