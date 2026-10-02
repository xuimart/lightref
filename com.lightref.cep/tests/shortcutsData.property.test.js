/*
 * shortcutsData.property.test.js - Tarefa 1.1 (feature shortcuts-help).
 *
 * Property 1: Grupos e combos esperados.
 * buildShortcutGroups() retorna exatamente tres grupos, com titulos exatos,
 * contagens de linhas 4/3/6 e os combos exatos de cada grupo.
 *
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.7
 */
'use strict';

var assert = require('assert');
var fc = require('fast-check');
var loadShortcuts = require('./loadShortcuts').loadShortcuts;

var api = loadShortcuts().api;

var EXPECTED = [
  {
    title: 'Luzes',
    combos: ['Ctrl+Shift+A', 'Ctrl+Shift+X', 'Ctrl+Shift+Z', 'Ctrl+Shift+1 a 9']
  },
  {
    title: 'Arraste no visor (segure Shift)',
    combos: ['Shift + arrastar', 'Ctrl+Shift + arrastar', 'Ctrl+Shift+Alt + arrastar']
  },
  {
    title: 'Transformar objeto (aba Posicao)',
    combos: ['G', 'S', 'R', 'X / Y / Z', 'Enter', 'Esc']
  }
];

function run() {
  // Property-based: >= 100 iteracoes sobre a estrutura (determinista por chamada).
  fc.assert(
    fc.property(fc.integer({ min: 0, max: EXPECTED.length - 1 }), function (gi) {
      var groups = api.buildShortcutGroups();
      assert.strictEqual(groups.length, EXPECTED.length, 'devem existir exatamente 3 grupos');

      var exp = EXPECTED[gi];
      var grp = groups[gi];
      assert.strictEqual(grp.title, exp.title, 'titulo do grupo ' + gi);
      assert.strictEqual(grp.rows.length, exp.combos.length, 'contagem de linhas do grupo ' + gi);
      for (var r = 0; r < exp.combos.length; r++) {
        assert.strictEqual(grp.rows[r].combo, exp.combos[r], 'combo ' + gi + '.' + r);
      }
      return true;
    }),
    { numRuns: 100 }
  );

  // Checagem explicita das contagens 4/3/6 e dos titulos (reforco deterministico).
  // Comparacao via JSON para ser robusta a objetos vindos de outro realm (vm).
  var g = api.buildShortcutGroups();
  var counts = [];
  var titles = [];
  for (var ci = 0; ci < g.length; ci++) { counts.push(g[ci].rows.length); titles.push(g[ci].title); }
  assert.strictEqual(
    JSON.stringify(counts),
    JSON.stringify([4, 3, 6]),
    'contagens de linhas devem ser 4, 3 e 6'
  );
  assert.strictEqual(
    JSON.stringify(titles),
    JSON.stringify(EXPECTED.map(function (x) { return x.title; })),
    'titulos exatos e em ordem'
  );

  console.log('Feature: shortcuts-help, Property 1: Grupos e combos esperados : OK');
}

run();
