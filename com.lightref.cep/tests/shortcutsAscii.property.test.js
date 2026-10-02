/*
 * shortcutsAscii.property.test.js - Tarefa 1.2 (feature shortcuts-help).
 *
 * Property 2: Linhas sao texto ASCII nao vazio e sem emoji.
 * Para toda linha de todo grupo, combo e desc sao strings nao vazias cujos
 * codepoints estao todos em 0x20..0x7E (ASCII imprimivel; sem emoji).
 *
 * Validates: Requirements 3.5, 7.1
 */
'use strict';

var assert = require('assert');
var fc = require('fast-check');
var loadShortcuts = require('./loadShortcuts').loadShortcuts;

var api = loadShortcuts().api;

// Lista plana de todos os campos de texto (combo e desc de cada linha).
function allFields() {
  var groups = api.buildShortcutGroups();
  var out = [];
  for (var g = 0; g < groups.length; g++) {
    var rows = groups[g].rows;
    for (var r = 0; r < rows.length; r++) {
      out.push({ where: 'g' + g + '.r' + r + '.combo', text: rows[r].combo });
      out.push({ where: 'g' + g + '.r' + r + '.desc', text: rows[r].desc });
    }
  }
  return out;
}

function isPrintableAscii(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x20 || c > 0x7E) return false;
  }
  return true;
}

function run() {
  var fields = allFields();

  fc.assert(
    fc.property(fc.integer({ min: 0, max: fields.length - 1 }), function (i) {
      var f = fields[i];
      assert.ok(typeof f.text === 'string' && f.text.length > 0, f.where + ' deve ser string nao vazia');
      assert.ok(isPrintableAscii(f.text), f.where + ' deve ser ASCII imprimivel sem emoji: ' + f.text);
      return true;
    }),
    { numRuns: 100 }
  );

  console.log('Feature: shortcuts-help, Property 2: Linhas sao texto ASCII nao vazio e sem emoji : OK');
}

run();
