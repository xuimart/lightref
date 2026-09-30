/*
 * Property 7: Mover para gaveta valida recategoriza o item.
 * Validates: Requirements 6.3, 6.4, 12.3, 12.4
 *
 * Feature: library-and-scenes-manager. Para qualquer item da Biblioteca e
 * qualquer gaveta destino VALIDA (categoria existente e diferente da origem):
 *   1) computeMove(dragItem, destCat) indica valid=true e devolve o itemKey de
 *      persistencia correto (url para defmodel, 'my:<id>' para importado);
 *   2) aplicar LightRefStorage.setModelCategoryOverride(itemKey, destCat) e reler
 *      a config faz resolveModelCategory(itemKey, cfg) passar a devolver destCat.
 *
 * Exercita a funcao pura REAL computeMove/resolveModelCategory (panel.js via
 * harness) e a persistencia REAL de override (storage.js via fs em memoria).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelCatalog } = require('./loadPanelCatalog');
const { loadStorage } = require('./loadStorage');

const api = loadPanelCatalog();
const MODELS = api.MODELS;
const SHAPES = api.SHAPES;

// Categorias custom que criaremos (para serem destinos validos alem das padrao).
const CUSTOM_CATS = ['Referencias', 'Projeto X', 'Estudos', 'Favoritos'];
// Destinos possiveis: categorias padrao da Biblioteca + custom criadas.
const DEFAULT_CATS = ['Cabecas', 'Bustos e Torsos', 'Figuras', 'Formas basicas'];

// Item arrastado: modelo padrao (url), forma basica (url) ou importado (my:<id>).
const defModelItemArb = fc.constantFrom.apply(fc, MODELS.map(function (m) {
  return { kind: 'defmodel', id: m.v };
}));
const shapeItemArb = fc.constantFrom.apply(fc, SHAPES.map(function (s) {
  return { kind: 'defmodel', id: s.v };
}));
const importedItemArb = fc.record({
  kind: fc.constant('mymodel'),
  id: fc.constantFrom('1', '42', '1699999999999')
});

const dragItemBaseArb = fc.oneof(defModelItemArb, shapeItemArb, importedItemArb);

const destCatArb = fc.constantFrom.apply(fc, DEFAULT_CATS.concat(CUSTOM_CATS));

function run() {
  fc.assert(
    fc.property(dragItemBaseArb, destCatArb, function (base, destCat) {
      // Origem sempre diferente do destino (para o movimento ser valido).
      var fromCat = '__origem_diferente__';
      var dragItem = { kind: base.kind, id: base.id, fromCat: fromCat };

      // 1) computeMove indica valido e retorna o itemKey correto.
      var mv = api.computeMove(dragItem, destCat);
      var expectedKey = (base.kind === 'mymodel') ? ('my:' + base.id) : base.id;
      assert.strictEqual(mv.valid, true, 'destino valido e != origem deve ser movimento valido');
      assert.strictEqual(mv.itemKey, expectedKey, 'itemKey de persistencia');
      assert.strictEqual(mv.destCat, destCat, 'destCat preservado');

      // 2) Persiste o override e verifica que a categoria resolvida passa a ser destCat.
      var s = loadStorage();
      var storage = s.storage;
      // Cria as categorias custom para que destCat seja categoria valida.
      CUSTOM_CATS.forEach(function (c) { storage.addModelCategory(c); });

      storage.setModelCategoryOverride(mv.itemKey, destCat);

      var cfg = storage.readConfig();
      var resolved = api.resolveModelCategory(mv.itemKey, cfg);
      assert.strictEqual(resolved, destCat, 'apos mover, item resolve para o destino ' + destCat);
    }),
    { numRuns: 300 }
  );

  console.log('Property 7 (mover para gaveta valida recategoriza): OK');
}

run();
