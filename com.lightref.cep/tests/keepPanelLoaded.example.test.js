/*
 * Persistencia do painel: keepPanelLoaded() (js/to-photoshop.js) pede ao
 * Photoshop para nao descarregar o painel ao minimizar, recolher ou fechar
 * (evento com.adobe.PhotoshopPersistent, escopo APPLICATION, com o
 * extensionId do painel). Fora do CEP nao faz nada e nao lanca erro.
 * O panel.js chama keepPanelLoaded() no fim do init (DOMContentLoaded).
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tpSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'to-photoshop.js'), 'utf8');

// Carrega o to-photoshop.js num sandbox novo, com os globais falsos do caso.
function load(globals) {
    const sandbox = { window: {}, require: require, process: process, Buffer: Buffer, JSON: JSON, Date: Date, console: console };
    Object.keys(globals).forEach(function (k) { sandbox[k] = globals[k]; });
    vm.createContext(sandbox);
    vm.runInContext(tpSrc, sandbox, { filename: 'to-photoshop.js' });
    const api = sandbox.window.LightRefToPhotoshop;
    assert.ok(api && typeof api.keepPanelLoaded === 'function', 'to-photoshop.js deveria exportar keepPanelLoaded');
    return api;
}

// CSEvent/CSInterface falsos: getExtensionID configuravel, dispatchEvent registra os eventos.
function fakeCep(getExtensionID) {
    const dispatched = [];
    function CSEvent(type, scope) { this.type = type; this.scope = scope; }
    function CSInterface() {}
    CSInterface.prototype.getExtensionID = getExtensionID;
    CSInterface.prototype.dispatchEvent = function (ev) { dispatched.push(ev); };
    return { globals: { CSEvent: CSEvent, CSInterface: CSInterface }, dispatched: dispatched };
}

// 1. No CEP: envia um unico com.adobe.PhotoshopPersistent com o id do painel.
const cep = fakeCep(function () { return 'com.lightref.panel'; });
assert.strictEqual(load(cep.globals).keepPanelLoaded(), true, 'deveria retornar true quando o pedido e enviado');
assert.strictEqual(cep.dispatched.length, 1, 'deveria enviar exatamente um evento');
assert.strictEqual(cep.dispatched[0].type, 'com.adobe.PhotoshopPersistent');
assert.strictEqual(cep.dispatched[0].scope, 'APPLICATION');
assert.strictEqual(cep.dispatched[0].extensionId, 'com.lightref.panel');

// 2. Fora do CEP getExtensionID() lanca erro: retorna false, sem lancar e sem enviar nada.
const noCep = fakeCep(function () { throw new TypeError("Cannot read property 'getExtensionId' of undefined"); });
const apiNoCep = load(noCep.globals);
let r2;
assert.doesNotThrow(function () { r2 = apiNoCep.keepPanelLoaded(); }, 'nao deveria lancar fora do CEP');
assert.strictEqual(r2, false);
assert.strictEqual(noCep.dispatched.length, 0, 'nao deveria enviar evento sem extension id');

// 3. Sem os globais CSInterface/CSEvent: retorna false sem lancar.
const apiBare = load({});
let r3;
assert.doesNotThrow(function () { r3 = apiBare.keepPanelLoaded(); }, 'nao deveria lancar sem CSInterface/CSEvent');
assert.strictEqual(r3, false);

// 4. panel.js chama keepPanelLoaded() dentro do handler de DOMContentLoaded,
//    depois do ultimo renderTab(); do handler.
const panelSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'panel.js'), 'utf8').replace(/\r\n/g, '\n');
const head = "document.addEventListener('DOMContentLoaded', function () {";
const start = panelSrc.indexOf(head);
assert.ok(start >= 0, 'panel.js deveria registrar o handler de DOMContentLoaded');
const end = panelSrc.indexOf('\n    });', start);
assert.ok(end > start, 'fim do handler de DOMContentLoaded nao encontrado');
const body = panelSrc.slice(start + head.length, end);
const lastRender = body.lastIndexOf('renderTab();');
assert.ok(lastRender >= 0, 'o handler deveria chamar renderTab();');
assert.ok(body.indexOf('keepPanelLoaded()', lastRender) > lastRender,
    'keepPanelLoaded() deveria ser chamado no handler, depois do ultimo renderTab();');

console.log('Persistencia do painel (com.adobe.PhotoshopPersistent): OK');
