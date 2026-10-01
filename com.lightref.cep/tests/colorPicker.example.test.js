/*
 * Seletor de cor: o painel so troca o <input type="color"> pelo Seletor de
 * Cores do Photoshop quando roda no CEP com Chromium < 99 (Photoshop 2019/2020),
 * onde o input nativo nao abre. No CEF novo e fora do CEP, mantem o input.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'panel.js'), 'utf8');
const fakeWindow = { addEventListener: function () {} };
const sandbox = { window: fakeWindow, document: { addEventListener: function () {} }, JSON: JSON, Date: Date, Math: Math, console: console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'panel.js' });
const api = fakeWindow.__lrColorApi;
assert.ok(api && typeof api.shouldUsePsPicker === 'function', 'panel.js deveria publicar __lrColorApi');

const UA_PS2019 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.91 Safari/537.36';
const UA_PS2021 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36';
const UA_PS2025 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 AdobeCEP/12.0.0 Safari/537.36';

assert.strictEqual(api.chromeMajor(UA_PS2019), 61);
assert.strictEqual(api.chromeMajor(UA_PS2025), 99);
assert.strictEqual(api.chromeMajor('sem versao'), 0);

assert.strictEqual(api.shouldUsePsPicker(UA_PS2019, true), true, 'PS 2019 usa o seletor do Photoshop');
assert.strictEqual(api.shouldUsePsPicker(UA_PS2021, true), true, 'Chromium 88 usa o seletor do Photoshop');
assert.strictEqual(api.shouldUsePsPicker(UA_PS2025, true), false, 'CEF 99 mantem o input nativo');
assert.strictEqual(api.shouldUsePsPicker(UA_PS2019, false), false, 'fora do CEP mantem o input nativo');

console.log('Seletor de cor (regra Chromium < 99 no CEP): OK');
