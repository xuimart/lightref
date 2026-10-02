/*
 * shortcutsDeterministic.property.test.js - Tarefa 1.3 (feature shortcuts-help).
 *
 * Property 3: buildShortcutGroups e determinista.
 * Duas chamadas de buildShortcutGroups() produzem estruturas profundamente
 * iguais (igualdade por JSON.stringify).
 *
 * Validates: Requirements 4.6
 */
'use strict';

var assert = require('assert');
var fc = require('fast-check');
var loadShortcuts = require('./loadShortcuts').loadShortcuts;

var api = loadShortcuts().api;

function run() {
  fc.assert(
    fc.property(fc.integer(), function (_seed) {
      var a = api.buildShortcutGroups();
      var b = api.buildShortcutGroups();
      assert.strictEqual(
        JSON.stringify(a),
        JSON.stringify(b),
        'duas chamadas de buildShortcutGroups() devem ser profundamente iguais'
      );
      return true;
    }),
    { numRuns: 100 }
  );

  console.log('Feature: shortcuts-help, Property 3: buildShortcutGroups e determinista : OK');
}

run();
