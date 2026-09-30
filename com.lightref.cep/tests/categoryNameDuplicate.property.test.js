/*
 * Property 4: Nome de categoria duplicado (case-insensitive) e sempre rejeitado.
 * Validates: Requirements 4.3, 9.3
 *
 * Feature: library-and-scenes-manager. Se o nome informado (apos trim) coincide,
 * ignorando maiusculas/minusculas, com algum nome ja existente, entao
 * validateNewCategoryName(name, existing) DEVE retornar { ok:false, reason:'duplicate' }.
 * Reciprocamente, um nome nao vazio que NAO coincide com nenhum existente DEVE
 * ser aceito ({ ok:true }).
 *
 * Exercita a funcao pura REAL do panel.js (validateNewCategoryName), carregada
 * via harness loadPanelCatalog (window.__lrCatalogApi), sem tocar em DOM.
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

// Nomes-base nao vazios e sem espacos nas pontas (para controlar o trim no teste).
const baseNameArb = fc.constantFrom(
  'Cabecas', 'Referencias', 'Projeto X', 'Estudos', 'Favoritos', 'Bustos e Torsos'
);

// Aplica variacao aleatoria de caixa a uma string (para testar case-insensitive).
function randomCaseArb(str) {
  return fc.array(fc.boolean(), { minLength: str.length, maxLength: str.length })
    .map(function (flags) {
      var out = '';
      for (var i = 0; i < str.length; i++) {
        out += flags[i] ? str.charAt(i).toUpperCase() : str.charAt(i).toLowerCase();
      }
      return out;
    });
}

// Padding de espacos ao redor (o trim deve neutraliza-lo antes da comparacao).
const padArb = fc.constantFrom('', ' ', '  ', '\t');

function runDuplicateRejected() {
  fc.assert(
    fc.property(
      fc.uniqueArray(baseNameArb, { minLength: 1, maxLength: 4 }),
      fc.nat(),
      padArb,
      padArb,
      function (existing, pickIdx, padL, padR) {
        var target = existing[pickIdx % existing.length];
        // Gera o mesmo nome com caixa e espacos variados.
        return fc.assert(
          fc.property(randomCaseArb(target), function (cased) {
            var candidate = padL + cased + padR;
            var res = api.validateNewCategoryName(candidate, existing);
            assert.strictEqual(res.ok, false, 'duplicado deveria ser rejeitado: ' + JSON.stringify(candidate) + ' vs ' + JSON.stringify(existing));
            assert.strictEqual(res.reason, 'duplicate', 'reason deveria ser "duplicate"');
          }),
          { numRuns: 20 }
        );
      }
    ),
    { numRuns: 200 }
  );
  console.log('Property 4 (nome de categoria duplicado case-insensitive rejeitado): OK');
}

function runNonDuplicateAccepted() {
  fc.assert(
    fc.property(
      fc.uniqueArray(baseNameArb, { minLength: 0, maxLength: 3 }),
      fc.constantFrom('CategoriaNova', 'Outra Coisa', 'ZZZ Unica', 'Rascunho 2024'),
      function (existing, fresh) {
        // Garante que o nome novo nao colide (case-insensitive) com os existentes.
        var lower = fresh.toLowerCase();
        var collides = existing.some(function (n) { return n.toLowerCase() === lower; });
        fc.pre(!collides);
        var res = api.validateNewCategoryName(fresh, existing);
        assert.strictEqual(res.ok, true, 'nome unico deveria ser aceito: ' + fresh);
        assert.strictEqual(res.name, fresh, 'name deveria vir com trim aplicado');
      }
    ),
    { numRuns: 200 }
  );
  console.log('Property 4 (nome unico aceito): OK');
}

runDuplicateRejected();
runNonDuplicateAccepted();
