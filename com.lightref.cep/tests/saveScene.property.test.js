/*
 * Property 9: Salvar cena com nome existente sobrescreve sem duplicar.
 * Validates: Requirements 8.3
 *
 * Para qualquer conjunto de cenas ja gravadas, salvar novamente com um nome que
 * ja existe deve:
 *  - NAO criar uma cena duplicada (a contagem por nome permanece 1);
 *  - atualizar o state e o thumb daquela cena;
 *  - PRESERVAR o categoryId existente da cena (Req 8.3);
 *  - manter o mesmo id/createdAt da cena original.
 *
 * E, ao salvar com um nome novo, a cena e adicionada (contagem +1) sem categoryId.
 *
 * Usa o harness loadStorage com fs em memoria (scenes.json em memoria).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadStorage } = require('./loadStorage');

const APPDATA = '/appdata';
const SCENES = APPDATA + '/LightRef/scenes.json';

// Nomes de cena distinguiveis e nao vazios.
const nameArb = fc
  .string({ minLength: 1, maxLength: 12 })
  .map(function (s) { return s.replace(/^\s+|\s+$/g, ''); })
  .filter(function (s) { return s.length > 0; });

// Um "estado" arbitrario simples (o storage nao interpreta o conteudo).
const stateArb = fc.record({
  model: fc.option(fc.string({ minLength: 1, maxLength: 8 }), { nil: null }),
  focal: fc.integer({ min: 10, max: 200 })
});

const catArb = fc.option(nameArb, { nil: undefined });

function run() {
  fc.assert(
    fc.property(
      fc.uniqueArray(nameArb, { minLength: 1, maxLength: 6 }),
      fc.array(catArb, { minLength: 1, maxLength: 6 }),
      stateArb,
      fc.integer({ min: 0, max: 5 }),
      function (names, cats, newState, targetIdx) {
        const { storage, memfs } = loadStorage({ APPDATA: APPDATA });

        // Semeia scenes.json diretamente, cada cena com id/createdAt e (as vezes) categoryId.
        const seeded = names.map(function (nm, i) {
          const scene = {
            id: 5000 + i,
            name: nm,
            createdAt: 5000 + i,
            state: { model: 'seed', focal: 50 },
            thumb: 'seed-thumb'
          };
          const c = cats[i % cats.length];
          if (c !== undefined) scene.categoryId = c;
          return scene;
        });
        memfs._files[SCENES] = JSON.stringify(seeded, null, 2);

        // Escolhe uma cena existente pelo nome para sobrescrever.
        const idx = targetIdx % names.length;
        const targetName = names[idx];
        const before = seeded[idx];
        const hadCategory = Object.prototype.hasOwnProperty.call(before, 'categoryId');
        const beforeCategory = before.categoryId;

        storage.saveScene(targetName, newState, 'new-thumb');

        // Normaliza o estado esperado pelo mesmo caminho (JSON) que o storage usa,
        // para comparar valores sem colidir com o prototipo nulo do fc.record.
        const expectedState = JSON.parse(JSON.stringify(newState));

        const after = storage.listScenes();

        // Sem duplicata: exatamente uma cena com esse nome.
        const withName = after.filter(function (s) { return s.name === targetName; });
        assert.strictEqual(withName.length, 1, 'sobrescrever nao pode duplicar a cena por nome');

        // Contagem total inalterada (nenhuma cena nova).
        assert.strictEqual(after.length, seeded.length, 'contagem total nao pode mudar ao sobrescrever');

        const updated = withName[0];

        // Estado e thumb atualizados.
        assert.deepStrictEqual(updated.state, expectedState, 'state deveria ter sido sobrescrito');
        assert.strictEqual(updated.thumb, 'new-thumb', 'thumb deveria ter sido sobrescrito');

        // Identidade preservada.
        assert.strictEqual(updated.id, before.id, 'id da cena deveria ser preservado');
        assert.strictEqual(updated.createdAt, before.createdAt, 'createdAt deveria ser preservado');

        // categoryId preservado exatamente como estava (Req 8.3).
        if (hadCategory) {
          assert.strictEqual(updated.categoryId, beforeCategory, 'categoryId deveria ser preservado ao sobrescrever');
        } else {
          assert.ok(
            !Object.prototype.hasOwnProperty.call(updated, 'categoryId'),
            'cena sem categoria nao deveria ganhar categoryId ao sobrescrever'
          );
        }
      }
    ),
    { numRuns: 200 }
  );

  // Salvar com nome novo adiciona uma cena (sem categoryId) sem afetar as existentes.
  fc.assert(
    fc.property(
      fc.uniqueArray(nameArb, { minLength: 1, maxLength: 5 }),
      nameArb,
      stateArb,
      function (existing, rawNew, newState) {
        fc.pre(existing.indexOf(rawNew) === -1);
        const { storage, memfs } = loadStorage({ APPDATA: APPDATA });

        const seeded = existing.map(function (nm, i) {
          return { id: 6000 + i, name: nm, createdAt: 6000 + i, state: {}, thumb: null, categoryId: 'C' + i };
        });
        memfs._files[SCENES] = JSON.stringify(seeded, null, 2);

        storage.saveScene(rawNew, newState, 'thumb-new');

        const after = storage.listScenes();
        assert.strictEqual(after.length, seeded.length + 1, 'salvar nome novo deveria adicionar 1 cena');

        const created = after.filter(function (s) { return s.name === rawNew; });
        assert.strictEqual(created.length, 1, 'nome novo deveria ter exatamente uma cena');
        assert.ok(
          !Object.prototype.hasOwnProperty.call(created[0], 'categoryId'),
          'cena nova nao deveria ter categoryId'
        );

        // Cenas existentes intactas (categoryId preservado).
        seeded.forEach(function (s, i) {
          const match = after.filter(function (x) { return x.id === s.id; })[0];
          assert.ok(match, 'cena existente deveria permanecer: ' + s.id);
          assert.strictEqual(match.categoryId, 'C' + i, 'categoryId de cena existente nao pode mudar');
        });
      }
    ),
    { numRuns: 200 }
  );

  console.log('Property 9 (save scene overwrites by name without duplicating): OK');
}

run();
