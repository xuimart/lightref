/*
 * loadShortcuts.js - carrega js/panel.js (codigo de producao ES5) num ambiente
 * Node controlado e extrai a API pura de atalhos (feature shortcuts-help):
 *   window.__lrShortcuts = { buildShortcutGroups, renderShortcutGroups }
 *
 * O panel.js e um IIFE que so DEFINE funcoes e registra um listener de
 * DOMContentLoaded no nivel de topo (nunca disparado aqui). Carregar o arquivo
 * com um 'window'/'document' falsos (addEventListener no-op) apenas define as
 * funcoes e publica window.__lrShortcuts, sem tocar em DOM real.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PANEL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'panel.js'),
  'utf8'
);

/** Carrega o panel.js e devolve a API pura de atalhos. */
function loadShortcuts() {
  const fakeWindow = {
    addEventListener: function () {}
  };
  const fakeDocument = {
    addEventListener: function () {}
  };

  const sandbox = {
    window: fakeWindow,
    document: fakeDocument,
    JSON: JSON,
    Date: Date,
    Math: Math,
    console: console
  };
  sandbox.self = fakeWindow;

  vm.createContext(sandbox);
  vm.runInContext(PANEL_SRC, sandbox, { filename: 'panel.js' });

  const api = fakeWindow.__lrShortcuts;
  if (!api || typeof api.buildShortcutGroups !== 'function' || typeof api.renderShortcutGroups !== 'function') {
    throw new Error('panel.js nao publicou window.__lrShortcuts (buildShortcutGroups/renderShortcutGroups)');
  }
  return { api: api, window: fakeWindow };
}

module.exports = { loadShortcuts: loadShortcuts };
