/*
 * Property 1: Somente importados e cenas sao deletaveis.
 * Validates: Requirements 1.1, 1.2, 11.1
 *
 * Feature: library-and-scenes-manager. Para qualquer kind de item do catalogo,
 * a flag deletable e true se e SOMENTE se o kind for 'mymodel' (modelo
 * importado) ou 'scene' (cena). Modelos padrao ('defmodel') nunca sao
 * deletaveis. Exercita a funcao pura REAL itemDeletable(kind) do panel.js e
 * confere que o cardHTML so injeta o botao "x" quando deletable.
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

const knownKinds = ['defmodel', 'mymodel', 'scene'];
const kindArb = fc.oneof(
  fc.constantFrom('defmodel', 'mymodel', 'scene'),
  fc.string({ minLength: 0, maxLength: 8 }) // kinds arbitrarios/invalidos
);

function run() {
  fc.assert(
    fc.property(kindArb, function (kind) {
      var deletable = api.itemDeletable(kind);
      var expected = (kind === 'mymodel' || kind === 'scene');
      assert.strictEqual(deletable, expected, 'deletable de kind=' + JSON.stringify(kind));

      // O cardHTML deve refletir a flag: "x" (lr04-card-del) so quando deletavel.
      var html = api.cardHTML({
        id: 'x', kind: kind, title: 'T', subtitle: '', thumbHTML: '<i></i>',
        deletable: deletable, draggable: true, fromCat: 'C'
      });
      var hasDel = html.indexOf('lr04-card-del') >= 0;
      assert.strictEqual(hasDel, expected, 'presenca do "x" para kind=' + JSON.stringify(kind));
    }),
    { numRuns: 300 }
  );

  // Reforco explicito sobre os kinds conhecidos.
  assert.strictEqual(api.itemDeletable('defmodel'), false, 'defmodel nao e deletavel');
  assert.strictEqual(api.itemDeletable('mymodel'), true, 'mymodel e deletavel');
  assert.strictEqual(api.itemDeletable('scene'), true, 'scene e deletavel');

  console.log('Property 1 (somente importados e cenas sao deletaveis): OK');
}

run();
