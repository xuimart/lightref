/*
 * i18n.property.test.js
 * Property-based tests for the LightRefI18n module (js/i18n.js).
 * Feature: panel-i18n
 * Runs in Node via: node tests/i18n.property.test.js
 * ASCII-only source.
 */
'use strict';

var fc = require('fast-check');
var path = require('path');
var fs = require('fs');

/* ---------- Load module ---------- */
/* i18n.js uses a plain IIFE with 'this'. In Node strict mode 'this' at top
   level is undefined, so we create a host object to receive the exports. */
var host = {};
(function () {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8');
    /* Execute in a context where 'this' is our host object. */
    var wrapped = '(function(){ ' + src + ' }).call(host)';
    /* We need host in scope for the eval below. */
    eval(wrapped); // jshint ignore:line
})();

var api = host.__lrI18nApi;
if (!api) { console.error('FAIL: __lrI18nApi not exposed'); process.exit(1); }

var t       = api.t;
var setLang = api.setLang;
var getLang = api.getLang;
var strings = api.strings;

var ptKeys = Object.keys(strings.pt);
var enKeys = Object.keys(strings.en);

var pass = 0;
var fail = 0;

function assert(label, cond) {
    if (cond) {
        pass++;
    } else {
        fail++;
        console.error('FAIL: ' + label);
    }
}

/* ---------- Property 1: Dictionary completeness ---------- */
/* Feature: panel-i18n, Property 1: Dictionary completeness */
/* Every PT key exists in EN. Exhaustive (finite dict). */
var p1Fail = [];
ptKeys.forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(strings.en, k)) {
        p1Fail.push(k);
    }
});
assert('Property 1 - every PT key exists in EN (count ' + ptKeys.length + ')', p1Fail.length === 0);
if (p1Fail.length) console.error('  Missing EN keys: ' + p1Fail.join(', '));

/* Also check EN has no extra keys not in PT (symmetric check). */
var p1ExtraFail = [];
enKeys.forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(strings.pt, k)) {
        p1ExtraFail.push(k);
    }
});
assert('Property 1b - no extra EN keys absent from PT', p1ExtraFail.length === 0);
if (p1ExtraFail.length) console.error('  Extra EN keys: ' + p1ExtraFail.join(', '));

/* ---------- Property 2: Translation returns active-language string ---------- */
/* Feature: panel-i18n, Property 2: Translation returns active-language string */
try {
    fc.assert(
        fc.property(
            fc.constantFrom.apply(fc, ptKeys),
            fc.constantFrom('pt', 'en'),
            function (key, lang) {
                setLang(lang);
                var result = t(key);
                var expected = strings[lang][key];
                /* If EN key is missing, expect PT fallback. */
                if (expected === undefined && lang === 'en') expected = strings.pt[key];
                return result === expected;
            }
        ),
        { numRuns: 200 }
    );
    assert('Property 2 - t(key) returns active-lang string (200 runs)', true);
} catch (e) {
    assert('Property 2 - t(key) returns active-lang string', false);
    console.error('  ' + e.message);
}

/* ---------- Property 3: Variable substitution ---------- */
/* Feature: panel-i18n, Property 3: Variable substitution */
/* Find keys that contain at least one {varname} in PT. */
var templateKeys = ptKeys.filter(function (k) { return /\{[^}]+\}/.test(strings.pt[k]); });

try {
    fc.assert(
        fc.property(
            fc.constantFrom.apply(fc, templateKeys),
            fc.constantFrom('pt', 'en'),
            fc.string({ minLength: 1, maxLength: 20 }),
            function (key, lang, varVal) {
                setLang(lang);
                /* Extract placeholder names from the template. */
                var template = strings[lang][key] !== undefined ? strings[lang][key] : strings.pt[key];
                var placeholders = [];
                var re = /\{([^}]+)\}/g;
                var m;
                while ((m = re.exec(template)) !== null) {
                    if (placeholders.indexOf(m[1]) < 0) placeholders.push(m[1]);
                }
                if (!placeholders.length) return true; /* no placeholders in this lang */
                var vars = {};
                for (var i = 0; i < placeholders.length; i++) vars[placeholders[i]] = varVal;
                var result = t(key, vars);
                /* Every placeholder should be gone from the result. */
                for (var j = 0; j < placeholders.length; j++) {
                    if (result.indexOf('{' + placeholders[j] + '}') >= 0) return false;
                }
                /* The varVal should appear in the result (at least once). */
                return result.indexOf(varVal) >= 0;
            }
        ),
        { numRuns: 200 }
    );
    assert('Property 3 - variable substitution (200 runs)', true);
} catch (e) {
    assert('Property 3 - variable substitution', false);
    console.error('  ' + e.message);
}

/* ---------- Property 4: EN fallback to PT ---------- */
/* Feature: panel-i18n, Property 4: EN fallback to PT */
/* Simulate missing EN key by calling with a key that is present in PT and
   testing that when lang='en' and the EN entry is absent the PT value is returned.
   We test this structurally: for every key where strings.en has the key, swapping
   it to undefined and then calling t() should return the PT value. We do this by
   creating a temporary shadow -- actually we just test against the real dict:
   any key that IS in EN returns EN value; we test keys only in PT (none expected
   by P1, but use the fallback logic directly). */
/* Instead test that t() lang='en' never returns undefined or throws: */
try {
    fc.assert(
        fc.property(
            fc.constantFrom.apply(fc, ptKeys),
            function (key) {
                setLang('en');
                var result = t(key);
                return typeof result === 'string' && result.length > 0;
            }
        ),
        { numRuns: 200 }
    );
    assert('Property 4 - EN fallback never returns undefined/empty (200 runs)', true);
} catch (e) {
    assert('Property 4 - EN fallback', false);
    console.error('  ' + e.message);
}

/* Verify fallback logic directly by checking a key known only in PT (inject test). */
(function () {
    /* Save EN state, temporarily check behavior with a manufactured missing key. */
    setLang('en');
    var testKey = '__test_pt_only__';
    strings.pt[testKey] = 'valor_pt';
    var result = t(testKey);
    delete strings.pt[testKey];
    assert('Property 4b - key only in PT returns PT value when lang=en', result === 'valor_pt');
})();

/* ---------- Property 5: Missing-key fallback ---------- */
/* Feature: panel-i18n, Property 5: Missing-key fallback */
try {
    fc.assert(
        fc.property(
            fc.string({ minLength: 1, maxLength: 40 }).filter(function (k) {
                return !Object.prototype.hasOwnProperty.call(strings.pt, k) &&
                       !Object.prototype.hasOwnProperty.call(strings.en, k) &&
                       !/[{}]/.test(k); /* avoid accidental template collision */
            }),
            fc.constantFrom('pt', 'en'),
            function (key, lang) {
                setLang(lang);
                var result = t(key);
                return result === key;
            }
        ),
        { numRuns: 200 }
    );
    assert('Property 5 - missing key returns key itself (200 runs)', true);
} catch (e) {
    assert('Property 5 - missing key fallback', false);
    console.error('  ' + e.message);
}

/* ---------- Property 6: No non-ASCII in any dictionary value ---------- */
/* Feature: panel-i18n, Property 6: No non-ASCII in any dictionary value */
var asciiFailKeys = [];
['pt', 'en'].forEach(function (lang) {
    Object.keys(strings[lang]).forEach(function (k) {
        var val = strings[lang][k];
        for (var i = 0; i < val.length; i++) {
            if (val.charCodeAt(i) > 127) {
                asciiFailKeys.push(lang + '.' + k + '[' + i + ']=' + val.charCodeAt(i));
            }
        }
    });
});
assert('Property 6 - no non-ASCII in any dictionary value (' + (ptKeys.length + enKeys.length) + ' entries)', asciiFailKeys.length === 0);
if (asciiFailKeys.length) console.error('  Non-ASCII at: ' + asciiFailKeys.slice(0, 5).join('; '));

/* ---------- setLang guard ---------- */
setLang('pt');
setLang('xx'); /* should be silently ignored */
assert('setLang guard - invalid lang ignored', getLang() === 'pt');

setLang('en');
setLang(''); /* should be silently ignored */
assert('setLang guard - empty string ignored', getLang() === 'en');

setLang('pt'); /* reset */

/* ---------- Example asserts ---------- */
setLang('pt');
assert('example - tabLight PT', t('tabLight') === 'Luz');
setLang('en');
assert('example - tabLight EN', t('tabLight') === 'Light');
setLang('en');
assert('example - fbLightAdded EN with var', t('fbLightAdded', { nome: 'Main' }) === 'Light added: Main');
setLang('pt');
assert('example - fbLightAdded PT with var', t('fbLightAdded', { nome: 'Principal' }) === 'Luz adicionada: Principal');
assert('example - compCount with n', t('compCount', { n: 3 }) === 'Objetos na cena (3)');
setLang('en');
assert('example - compCount EN with n', t('compCount', { n: 5 }) === 'Objects in scene (5)');
setLang('pt');
assert('example - unknown key returns key', t('no_such_key_xyz') === 'no_such_key_xyz');
assert('example - updCurrent PT with version', t('updCurrent', { versao: '0.9.0' }) === 'Voce ja esta na versao mais recente (0.9.0).');
setLang('en');
assert('example - updCurrent EN with version', t('updCurrent', { versao: '0.9.0' }) === 'You are already on the latest version (0.9.0).');

/* ---------- Report ---------- */
console.log('i18n.property.test.js: ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) process.exit(1);
