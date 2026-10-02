/*
 * shortcutsRender.property.test.js - Tarefa 1.4 (feature shortcuts-help).
 *
 * Property 4: Renderizacao contem toda linha de dados.
 * renderShortcutGroups(groups) contem o texto (escapado) de cada title, combo
 * e desc; e o numero de ocorrencias de '<div class="lr04-sc-row">' e igual ao
 * numero total de linhas (sem linhas extras).
 *
 * Validates: Requirements 4.2, 4.7
 */
'use strict';

var assert = require('assert');
var fc = require('fast-check');
var loadShortcuts = require('./loadShortcuts').loadShortcuts;

var api = loadShortcuts().api;

// Mesmo escape da producao (puro, sem DOM).
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function countOccurrences(haystack, needle) {
  var n = 0;
  var idx = haystack.indexOf(needle);
  while (idx !== -1) {
    n++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return n;
}

function run() {
  var ROW_MARKER = '<div class="lr04-sc-row">';

  fc.assert(
    fc.property(fc.integer(), function (_seed) {
      var groups = api.buildShortcutGroups();
      var html = api.renderShortcutGroups(groups);

      var totalRows = 0;
      for (var g = 0; g < groups.length; g++) {
        assert.ok(html.indexOf(escHtml(groups[g].title)) !== -1, 'HTML deve conter o titulo: ' + groups[g].title);
        var rows = groups[g].rows;
        totalRows += rows.length;
        for (var r = 0; r < rows.length; r++) {
          assert.ok(html.indexOf(escHtml(rows[r].combo)) !== -1, 'HTML deve conter o combo: ' + rows[r].combo);
          assert.ok(html.indexOf(escHtml(rows[r].desc)) !== -1, 'HTML deve conter a desc: ' + rows[r].desc);
        }
      }

      assert.strictEqual(
        countOccurrences(html, ROW_MARKER),
        totalRows,
        'o numero de linhas renderizadas deve ser exatamente o numero de linhas de dados'
      );
      return true;
    }),
    { numRuns: 100 }
  );

  console.log('Feature: shortcuts-help, Property 4: Renderizacao contem toda linha de dados : OK');
}

run();
