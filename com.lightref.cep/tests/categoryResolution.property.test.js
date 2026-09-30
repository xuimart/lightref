/*
 * Property 2: Resolucao de categoria segue a precedencia override > padrao > fallback.
 * Validates: Requirements 4.5, 10.3
 *
 * Feature: library-and-scenes-manager. Para qualquer item da Biblioteca e
 * qualquer config, resolveModelCategory(itemKey, cfg) devolve:
 *   1) o override (cfg.modelCatOverrides[itemKey]) SE ele existir E for uma
 *      categoria valida (padrao ou custom em cfg.modelCategories);
 *   2) senao, a categoria padrao do item (defaultCatOf, via MODELS/SHAPES);
 *   3) senao, o fallback 'Outros'.
 *
 * Exercita as funcoes puras REAIS do panel.js (defaultCatOf/categoryExists/
 * resolveModelCategory), carregadas via harness. Usa MODELS/SHAPES reais.
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

const MODELS = api.MODELS;
const SHAPES = api.SHAPES;

// Chaves de item possiveis: modelo padrao (url), forma basica (url), importado
// (my:<id>) e uma url desconhecida (sem categoria padrao).
const defModelKeys = MODELS.map(function (m) { return m.v; });
const shapeKeys = SHAPES.map(function (s) { return s.v; });
const importedKeys = ['my:1', 'my:1699999999999', 'my:42'];
const unknownKeys = ['models/desconhecido.obj', 'file:///tmp/x.obj'];

const itemKeyArb = fc.constantFrom.apply(
  fc,
  defModelKeys.concat(shapeKeys).concat(importedKeys).concat(unknownKeys)
);

// Categorias custom possiveis (nomes arbitrarios).
const customCatArb = fc.array(
  fc.constantFrom('Referencias', 'Projeto X', 'Estudos', 'Favoritos'),
  { maxLength: 4 }
);

// Valor de override: pode ser uma categoria valida, uma invalida (nao existe),
// vazio ou ausente.
const overrideValueArb = fc.oneof(
  fc.constantFrom('Cabecas', 'Bustos e Torsos', 'Figuras', 'Formas basicas'),
  fc.constantFrom('Referencias', 'Projeto X', 'Estudos', 'Favoritos'),
  fc.constantFrom('CategoriaInexistente', 'Fantasma'),
  fc.constant(''),
  fc.constant(null)
);

function expectedCategory(itemKey, cfg) {
  var ov = (cfg.modelCatOverrides || {})[itemKey];
  if (ov && api.categoryExists(ov, cfg)) return ov;
  var def = api.defaultCatOf(itemKey);
  if (def) return def;
  return 'Outros';
}

function run() {
  fc.assert(
    fc.property(itemKeyArb, customCatArb, overrideValueArb, function (itemKey, customCats, ovVal) {
      var cfg = { modelCategories: customCats, modelCatOverrides: {} };
      if (ovVal != null) cfg.modelCatOverrides[itemKey] = ovVal;

      var got = api.resolveModelCategory(itemKey, cfg);
      var want = expectedCategory(itemKey, cfg);

      assert.strictEqual(got, want, 'resolucao para ' + itemKey + ' com override=' + JSON.stringify(ovVal));

      // Invariante de precedencia explicita:
      var ov = cfg.modelCatOverrides[itemKey];
      if (ov && api.categoryExists(ov, cfg)) {
        assert.strictEqual(got, ov, 'override valido deve vencer');
      } else {
        var def = api.defaultCatOf(itemKey);
        if (def) assert.strictEqual(got, def, 'sem override valido: usa categoria padrao');
        else assert.strictEqual(got, 'Outros', 'sem override nem padrao: fallback Outros');
      }
    }),
    { numRuns: 300 }
  );

  console.log('Property 2 (resolucao de categoria override > padrao > Outros): OK');
}

run();
