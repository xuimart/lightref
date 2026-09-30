/*
 * loadPanelCatalog.js - carrega js/panel.js (codigo de producao ES5) num
 * ambiente Node controlado e extrai a API pura do catalogo de gavetas:
 *   window.__lrCatalogApi = {
 *     defaultCatOf, categoryExists, resolveModelCategory,
 *     cardHTML, addCardHTML, drawerHTML, catalogToolbarHTML, catalogHTML,
 *     MODELS, SHAPES
 *   }
 *
 * Assim como loadPanelState.js, o panel.js e um IIFE que apenas DEFINE funcoes
 * e registra um listener de DOMContentLoaded no topo (nunca disparado aqui).
 * Carregar o arquivo com um 'window'/'document' falsos so define as funcoes e
 * publica window.__lrCatalogApi, sem tocar em DOM real. As funcoes de catalogo
 * expostas sao PURAS (nao dependem de DOM): resolucao de categoria e geracao de
 * HTML como strings.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PANEL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'panel.js'),
  'utf8'
);

/** Carrega o panel.js e devolve a API pura do catalogo. */
function loadPanelCatalog() {
  const fakeWindow = { addEventListener: function () {} };
  const fakeDocument = { addEventListener: function () {} };

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

  const api = fakeWindow.__lrCatalogApi;
  if (!api || typeof api.resolveModelCategory !== 'function' || typeof api.drawerHTML !== 'function') {
    throw new Error('panel.js nao publicou window.__lrCatalogApi (catalogo)');
  }
  return api;
}

module.exports = { loadPanelCatalog: loadPanelCatalog };
