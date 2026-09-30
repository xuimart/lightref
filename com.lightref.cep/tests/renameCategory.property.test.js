/*
 * Property 5: Renomear categoria preserva a associacao dos itens.
 * Validates: Requirements 4.2, 9.2
 *
 * Gera itens associados a uma categoria (modelos via modelCatOverrides; cenas via
 * categoryId em scenes.json) e renomeia a categoria. Verifica que:
 *  - nenhum item que apontava para oldName continua apontando para oldName;
 *  - todos os itens que apontavam para oldName passam a apontar para newName;
 *  - itens de outras categorias permanecem inalterados;
 *  - o array de categorias passa a conter newName no lugar de oldName.
 * Usa fs em memoria (stub de config/scenes).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadStorage } = require('./loadStorage');

// Nomes de categoria distinguiveis e nao vazios (sem colisao trivial).
const catNameArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .map(function (s) { return s.replace(/^\s+|\s+$/g, ''); })
  .filter(function (s) { return s.length > 0; });

function seedModelTest() {
  fc.assert(
    fc.property(
      fc.uniqueArray(catNameArb, { minLength: 2, maxLength: 4 }),
      fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 20 }),
      catNameArb,
      function (cats, itemKeys, rawNewName) {
        const oldName = cats[0];
        const others = cats.slice(1);
        const newName = rawNewName;
        // Evita casos onde o novo nome coincide com uma categoria existente/antiga.
        fc.pre(cats.indexOf(newName) === -1);

        const { storage } = loadStorage();

        // Semeia categorias.
        cats.forEach(function (c) { storage.addModelCategory(c); });

        // Distribui itens entre oldName e as outras categorias (deterministico por indice).
        const assignment = {}; // itemKey -> cat atribuida
        const uniqueKeys = Array.from(new Set(itemKeys));
        uniqueKeys.forEach(function (key, i) {
          const cat = (i % 2 === 0) ? oldName : others[i % others.length];
          assignment[key] = cat;
          storage.setModelCategoryOverride(key, cat);
        });

        // Renomeia.
        storage.renameModelCategory(oldName, newName);

        const cfg = storage.readConfig();
        const ov = cfg.modelCatOverrides || {};
        const list = cfg.modelCategories || [];

        // Array migrado.
        assert.ok(list.indexOf(newName) !== -1, 'newName ausente do array de categorias');
        assert.ok(list.indexOf(oldName) === -1, 'oldName ainda presente no array de categorias');

        // Associacoes migradas item a item.
        uniqueKeys.forEach(function (key) {
          const before = assignment[key];
          const after = ov[key];
          if (before === oldName) {
            assert.strictEqual(after, newName, 'item deveria migrar para newName: ' + key);
          } else {
            assert.strictEqual(after, before, 'item de outra categoria mudou: ' + key);
          }
          assert.notStrictEqual(after, oldName, 'nenhum item pode continuar em oldName: ' + key);
        });
      }
    ),
    { numRuns: 200 }
  );
  console.log('Property 5 (rename model category preserves overrides): OK');
}

function seedSceneTest() {
  fc.assert(
    fc.property(
      fc.uniqueArray(catNameArb, { minLength: 2, maxLength: 4 }),
      fc.integer({ min: 1, max: 12 }),
      catNameArb,
      function (cats, nScenes, rawNewName) {
        const oldName = cats[0];
        const others = cats.slice(1);
        const newName = rawNewName;
        fc.pre(cats.indexOf(newName) === -1);

        const { storage, memfs } = loadStorage();

        cats.forEach(function (c) { storage.addSceneCategory(c); });

        // Semeia scenes.json diretamente com categoryId (evita depender de saveScene).
        const scenes = [];
        const assignment = {}; // id -> cat
        for (let i = 0; i < nScenes; i++) {
          const id = 1000 + i;
          const cat = (i % 2 === 0) ? oldName : others[i % others.length];
          scenes.push({ id: id, name: 'cena_' + i, createdAt: id, categoryId: cat, state: {}, thumb: null });
          assignment[id] = cat;
        }
        // Grava no fs em memoria no caminho que storage usa (APPDATA=/appdata -> /appdata/LightRef/scenes.json).
        memfs._files['/appdata/LightRef/scenes.json'] = JSON.stringify(scenes, null, 2);

        storage.renameSceneCategory(oldName, newName);

        const cfg = storage.readConfig();
        const list = cfg.sceneCategories || [];
        assert.ok(list.indexOf(newName) !== -1, 'newName ausente do array de categorias de cena');
        assert.ok(list.indexOf(oldName) === -1, 'oldName ainda presente no array de categorias de cena');

        const after = storage.listScenes();
        after.forEach(function (s) {
          const before = assignment[s.id];
          if (before === oldName) {
            assert.strictEqual(s.categoryId, newName, 'cena deveria migrar para newName: ' + s.id);
          } else {
            assert.strictEqual(s.categoryId, before, 'cena de outra categoria mudou: ' + s.id);
          }
          assert.notStrictEqual(s.categoryId, oldName, 'nenhuma cena pode continuar em oldName: ' + s.id);
        });
      }
    ),
    { numRuns: 200 }
  );
  console.log('Property 5 (rename scene category preserves categoryId): OK');
}

seedModelTest();
seedSceneTest();
