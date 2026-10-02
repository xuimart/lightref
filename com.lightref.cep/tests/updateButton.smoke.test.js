/*
 * updateButton.smoke.test.js - Smoke test da subtarefa 12.1 (Area A).
 * Feature: update-button-wizard-and-session.
 * Requirements: 3.1, 3.2, 3.3 (rotulo da Versao_Instalada; fallback sem erro).
 *
 * O panel.js e um IIFE que so DEFINE funcoes e registra um listener de
 * DOMContentLoaded (que nunca disparamos aqui). setupUpdates roda dentro desse
 * callback, entao a assercao robusta e verificar a funcao pura exposta em
 * window.__lrUpdateUi.installedVersionLabel, que le window.LightRefUpdate.VERSION.
 *
 * Carregamos panel.js duas vezes num vm: uma com um stub LightRefUpdate (VERSION
 * definido) e outra sem, confirmando 'v'+VERSION vs 'v?' e que o modulo nao lanca.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PANEL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'panel.js'),
  'utf8'
);

// Elemento DOM falso: suporta o que setupUpdates/panel.js possam tocar.
function makeFakeEl() {
  var handlers = {};
  return {
    _handlers: handlers,
    _classes: {},
    textContent: '',
    title: '',
    style: {},
    classList: {
      add: function (c) { this._classes[c] = true; },
      remove: function (c) { delete this._classes[c]; }
    },
    setAttribute: function () {},
    addEventListener: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); }
  };
}

// Carrega panel.js num sandbox controlado. updateStub: objeto para
// window.LightRefUpdate (ou null para simular ausencia).
function loadPanelUpdateUi(updateStub) {
  var elements = {
    'lr-version': makeFakeEl(),
    'btn-update': makeFakeEl()
  };
  var brand = makeFakeEl();

  var fakeDocument = {
    addEventListener: function () {},
    getElementById: function (id) { return elements[id] || null; },
    querySelector: function (sel) { return (sel === '.lr04-brand') ? brand : null; }
  };
  var fakeWindow = {
    addEventListener: function () {}
  };
  if (updateStub) fakeWindow.LightRefUpdate = updateStub;

  var sandbox = {
    window: fakeWindow,
    document: fakeDocument,
    JSON: JSON,
    Date: Date,
    Math: Math,
    console: console,
    setTimeout: function () { return 0; }
  };
  sandbox.self = fakeWindow;

  vm.createContext(sandbox);
  vm.runInContext(PANEL_SRC, sandbox, { filename: 'panel.js' });

  return {
    window: fakeWindow,
    api: fakeWindow.__lrUpdateUi
  };
}

function run() {
  // --- Caso A: LightRefUpdate presente com VERSION => 'v' + VERSION (Req 3.1/3.2) ---
  var withStub = loadPanelUpdateUi({ VERSION: '0.6.0', check: function () {} });
  assert.ok(withStub.api, 'panel.js nao publicou window.__lrUpdateUi');
  assert.strictEqual(
    typeof withStub.api.installedVersionLabel, 'function',
    'installedVersionLabel deve ser uma funcao'
  );
  assert.strictEqual(
    withStub.api.installedVersionLabel(), 'v0.6.0',
    'com LightRefUpdate.VERSION=0.6.0 deve retornar v0.6.0'
  );

  // Outra versao, so para garantir que le mesmo o VERSION e nao hardcode.
  var withStub2 = loadPanelUpdateUi({ VERSION: '1.2.3', check: function () {} });
  assert.strictEqual(
    withStub2.api.installedVersionLabel(), 'v1.2.3',
    'com LightRefUpdate.VERSION=1.2.3 deve retornar v1.2.3'
  );

  // --- Caso B: LightRefUpdate ausente => 'v?' sem lancar (Req 3.3) ---
  var noStub = loadPanelUpdateUi(null);
  assert.ok(noStub.api, 'window.__lrUpdateUi deve existir mesmo sem LightRefUpdate');
  assert.strictEqual(
    noStub.api.installedVersionLabel(), 'v?',
    'sem LightRefUpdate deve retornar o fallback v?'
  );

  console.log('Feature: update-button-wizard-and-session, Botao de atualizacao (versao instalada): OK');
}

run();
