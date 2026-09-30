/*
 * Property 6: Estado de gaveta faz round-trip pela persistencia.
 * Validates: Requirements 5.4, 5.5, 10.4, 10.5
 *
 * Para qualquer sequencia de setDrawerState(page, catId, expanded), a leitura
 * subsequente de config.drawerState[page][catId] devolve exatamente o ultimo
 * valor gravado (o "ultimo a escrever vence" por chave), sem perder outras
 * chaves ja gravadas. Usa um stub de config em memoria (fs em memoria).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadStorage } = require('./loadStorage');

const pageArb = fc.constantFrom('library', 'scenes');
// Nomes de categoria variados (inclui chaves especiais e espacos).
// Chaves inseguras (__proto__/constructor/prototype) sao rejeitadas de proposito
// por setDrawerState (anti prototype-pollution), entao as excluimos do gerador.
function safeKey(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
const catArb = fc.oneof(
  fc.constantFrom('Cabecas', 'Bustos e Torsos', 'Formas basicas', '__outros__', '__sem__'),
  fc.string({ minLength: 1, maxLength: 12 })
).filter(safeKey);
const opArb = fc.record({
  page: pageArb,
  cat: catArb,
  expanded: fc.boolean()
});

function run() {
  // Propriedade principal: apos aplicar N operacoes, cada (page,cat) reflete
  // o ultimo expanded gravado para aquela chave.
  fc.assert(
    fc.property(fc.array(opArb, { minLength: 1, maxLength: 40 }), function (ops) {
      const { storage } = loadStorage();

      // Modelo de referencia do que esperamos ler de volta.
      const expected = {}; // page -> { cat -> bool }

      ops.forEach(function (op) {
        storage.setDrawerState(op.page, op.cat, op.expanded);
        if (!expected[op.page]) expected[op.page] = {};
        expected[op.page][op.cat] = !!op.expanded;
      });

      const cfg = storage.readConfig();
      const ds = cfg.drawerState || {};

      Object.keys(expected).forEach(function (page) {
        const pageMap = ds[page] || {};
        Object.keys(expected[page]).forEach(function (cat) {
          assert.strictEqual(
            pageMap[cat],
            expected[page][cat],
            'round-trip falhou para ' + page + '/' + cat
          );
        });
      });
    }),
    { numRuns: 200 }
  );

  // Propriedade de nao-interferencia: gravar uma gaveta nao apaga outra ja gravada
  // (nem em outra page). Reforca Req 5.5/10.5 (restaurar estado de cada gaveta).
  fc.assert(
    fc.property(
      opArb,
      opArb,
      function (a, b) {
        fc.pre(!(a.page === b.page && a.cat === b.cat)); // chaves distintas
        const { storage } = loadStorage();
        storage.setDrawerState(a.page, a.cat, a.expanded);
        storage.setDrawerState(b.page, b.cat, b.expanded);
        const ds = storage.readConfig().drawerState || {};
        assert.strictEqual((ds[a.page] || {})[a.cat], !!a.expanded, 'primeira gaveta perdida');
        assert.strictEqual((ds[b.page] || {})[b.cat], !!b.expanded, 'segunda gaveta perdida');
      }
    ),
    { numRuns: 200 }
  );

  console.log('Property 6 (drawer state round-trip): OK');
}

run();
