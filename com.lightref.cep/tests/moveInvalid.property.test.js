/*
 * Property 8: Soltar fora de gaveta valida nao altera dados.
 * Validates: Requirements 6.5, 12.5
 *
 * Feature: library-and-scenes-manager. Quando o destino do arraste e invalido
 * (vazio/nulo) ou igual a categoria de origem:
 *   1) computeMove(dragItem, destCat) indica valid=false;
 *   2) como o painel so persiste quando valid=true, nenhum override e gravado:
 *      a config permanece inalterada (mesma serializacao antes e depois de uma
 *      tentativa de mover que NAO passa persistencia adiante).
 *
 * O teste modela o contrato do drop: onMoveItem so chama setModelCategoryOverride
 * quando computeMove().valid. Aqui verificamos a decisao pura (computeMove) e que,
 * ao respeita-la, a config nao muda. Usa computeMove real (panel.js) e storage real.
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelCatalog } = require('./loadPanelCatalog');
const { loadStorage } = require('./loadStorage');

const api = loadPanelCatalog();
const MODELS = api.MODELS;
const SHAPES = api.SHAPES;

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

// Categoria de origem arbitraria.
const fromCatArb = fc.constantFrom('Cabecas', 'Figuras', 'Referencias', 'Outros', 'Estudos');

// Destinos INVALIDOS: nulo, vazio, so espacos... e o caso "igual a origem"
// e tratado a parte gerando destCat === fromCat.
const invalidDestArb = fc.oneof(
  fc.constant(null),
  fc.constant(''),
  fc.constant(undefined)
);

function run() {
  // Caso A: destino nulo/vazio => invalido, nada muda.
  fc.assert(
    fc.property(dragItemBaseArb, fromCatArb, invalidDestArb, function (base, fromCat, destCat) {
      var dragItem = { kind: base.kind, id: base.id, fromCat: fromCat };
      var mv = api.computeMove(dragItem, destCat);
      assert.strictEqual(mv.valid, false, 'destino vazio/nulo deve ser invalido');

      var storage = loadStorage().storage;
      var before = JSON.stringify(storage.readConfig());
      // O painel NAO persiste quando invalido; simulamos esse contrato.
      if (mv.valid) storage.setModelCategoryOverride(mv.itemKey, destCat);
      var after = JSON.stringify(storage.readConfig());
      assert.strictEqual(after, before, 'config nao pode mudar em drop invalido');
    }),
    { numRuns: 200 }
  );

  // Caso B: destino IGUAL a origem => invalido, nada muda.
  fc.assert(
    fc.property(dragItemBaseArb, fromCatArb, function (base, fromCat) {
      var dragItem = { kind: base.kind, id: base.id, fromCat: fromCat };
      var mv = api.computeMove(dragItem, fromCat); // destCat === fromCat
      assert.strictEqual(mv.valid, false, 'destino igual a origem deve ser invalido');

      var storage = loadStorage().storage;
      var before = JSON.stringify(storage.readConfig());
      if (mv.valid) storage.setModelCategoryOverride(mv.itemKey, fromCat);
      var after = JSON.stringify(storage.readConfig());
      assert.strictEqual(after, before, 'config nao pode mudar quando destino == origem');
    }),
    { numRuns: 200 }
  );

  console.log('Property 8 (soltar fora de gaveta valida nao altera dados): OK');
}

run();
