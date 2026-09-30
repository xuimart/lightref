/*
 * Property 3: Nome de categoria vazio ou so espacos e sempre rejeitado.
 * Validates: Requirements 4.4, 9.4
 *
 * Feature: library-and-scenes-manager. Para qualquer conjunto de categorias
 * existentes, validateNewCategoryName(name, existing) com um nome vazio ou
 * composto apenas por espacos em branco DEVE retornar { ok:false, reason:'empty' },
 * independentemente da lista de nomes existentes.
 *
 * Exercita a funcao pura REAL do panel.js (validateNewCategoryName), carregada
 * via harness loadPanelCatalog (window.__lrCatalogApi), sem tocar em DOM.
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

// Gerador de strings compostas apenas por caracteres de espaco em branco
// (incluindo string vazia). Usa apenas caracteres ASCII de whitespace.
const whitespaceCharArb = fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v');
const blankNameArb = fc.array(whitespaceCharArb, { minLength: 0, maxLength: 10 })
  .map(function (chars) { return chars.join(''); });

// Lista arbitraria de nomes existentes (pode ate conter nomes em branco).
const existingArb = fc.array(
  fc.constantFrom('Cabecas', 'Referencias', 'Projeto X', '', '   ', 'Estudos'),
  { maxLength: 5 }
);

function run() {
  fc.assert(
    fc.property(blankNameArb, existingArb, function (name, existing) {
      var res = api.validateNewCategoryName(name, existing);
      assert.strictEqual(res.ok, false, 'nome em branco deveria ser rejeitado: ' + JSON.stringify(name));
      assert.strictEqual(res.reason, 'empty', 'reason deveria ser "empty" para nome em branco');
    }),
    { numRuns: 300 }
  );

  // Casos-exemplo explicitos.
  assert.strictEqual(api.validateNewCategoryName('', []).reason, 'empty');
  assert.strictEqual(api.validateNewCategoryName('   ', []).reason, 'empty');
  assert.strictEqual(api.validateNewCategoryName(null, []).reason, 'empty');
  assert.strictEqual(api.validateNewCategoryName(undefined, []).reason, 'empty');

  console.log('Property 3 (nome de categoria vazio/espacos rejeitado): OK');
}

run();
