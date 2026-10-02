/*
 * shortcutsApi.smoke.test.js - Tarefa 1.5 (feature shortcuts-help).
 *
 * Smoke da API de atalhos:
 *   - window.__lrShortcuts existe com buildShortcutGroups e renderShortcutGroups.
 *   - renderShortcutGroups([]) retorna string vazia.
 *   - renderShortcutGroups(buildShortcutGroups()) retorna string nao vazia.
 *
 * Requisitos: 4.2, 4.6
 */
'use strict';

var assert = require('assert');
var loaded = require('./loadShortcuts').loadShortcuts();
var api = loaded.api;
var win = loaded.window;

function run() {
  assert.ok(win.__lrShortcuts, 'window.__lrShortcuts deve existir');
  assert.strictEqual(typeof api.buildShortcutGroups, 'function', 'buildShortcutGroups deve ser funcao');
  assert.strictEqual(typeof api.renderShortcutGroups, 'function', 'renderShortcutGroups deve ser funcao');

  assert.strictEqual(api.renderShortcutGroups([]), '', 'renderShortcutGroups([]) deve ser string vazia');

  var html = api.renderShortcutGroups(api.buildShortcutGroups());
  assert.ok(typeof html === 'string' && html.length > 0, 'render dos grupos reais deve ser string nao vazia');

  console.log('Feature: shortcuts-help, API de atalhos (smoke): OK');
}

run();
