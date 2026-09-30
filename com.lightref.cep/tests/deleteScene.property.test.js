/*
 * Property 10: Deletar cena remove apenas a cena alvo.
 * Validates: Requirements 11.4, 11.5
 *
 * Para qualquer conjunto de cenas gravadas (cada uma com id unico e, as vezes,
 * um categoryId), deletar uma cena pelo seu id deve:
 *  - remover exatamente a cena alvo (ela deixa de existir na lista - Req 11.5);
 *  - preservar TODAS as demais cenas intactas, com o mesmo id, name, createdAt,
 *    state, thumb e categoryId (nada alem da alvo pode mudar - Req 11.4);
 *  - reduzir a contagem em exatamente 1;
 *  - retornar a lista restante (deleteScene retorna o array restante).
 *
 * Usa o harness loadStorage com fs em memoria (scenes.json em memoria).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadStorage } = require('./loadStorage');

const APPDATA = '/appdata';
const SCENES = APPDATA + '/LightRef/scenes.json';

// Nomes distinguiveis e nao vazios.
const nameArb = fc
  .string({ minLength: 1, maxLength: 12 })
  .map(function (s) { return s.replace(/^\s+|\s+$/g, ''); })
  .filter(function (s) { return s.length > 0; });

// categoryId opcional (undefined => cena sem categoria).
const catArb = fc.option(nameArb, { nil: undefined });

function run() {
  fc.assert(
    fc.property(
      // Ids unicos para cada cena (a delecao usa igualdade estrita por id).
      fc.uniqueArray(fc.integer({ min: 1, max: 100000 }), { minLength: 1, maxLength: 8 }),
      fc.array(nameArb, { minLength: 1, maxLength: 8 }),
      fc.array(catArb, { minLength: 1, maxLength: 8 }),
      fc.nat(),
      function (ids, names, cats, targetPick) {
        const { storage, memfs } = loadStorage({ APPDATA: APPDATA });

        // Semeia scenes.json: uma cena por id, com dados distinguiveis.
        const seeded = ids.map(function (id, i) {
          const scene = {
            id: id,
            name: names[i % names.length] + '#' + i,
            createdAt: 1000 + i,
            state: { model: 'm' + i, focal: 10 + i },
            thumb: 'thumb-' + i
          };
          const c = cats[i % cats.length];
          if (c !== undefined) scene.categoryId = c;
          return scene;
        });
        memfs._files[SCENES] = JSON.stringify(seeded, null, 2);

        // Escolhe uma cena alvo pelo indice.
        const idx = targetPick % ids.length;
        const targetId = ids[idx];

        // Snapshot das demais cenas (deep) antes de deletar, para comparar depois.
        const othersBefore = seeded.filter(function (s) { return s.id !== targetId; });
        const expectedOthers = JSON.parse(JSON.stringify(othersBefore));

        const returned = storage.deleteScene(targetId);
        const after = storage.listScenes();

        // Contagem reduzida em exatamente 1.
        assert.strictEqual(after.length, seeded.length - 1, 'deletar deve remover exatamente uma cena');

        // A cena alvo nao existe mais (Req 11.5).
        const stillTarget = after.filter(function (s) { return s.id === targetId; });
        assert.strictEqual(stillTarget.length, 0, 'a cena alvo nao deveria mais existir');

        // Toda cena restante permanece intacta (mesma identidade e conteudo) (Req 11.4).
        assert.strictEqual(after.length, expectedOthers.length, 'as demais cenas deveriam permanecer');
        expectedOthers.forEach(function (exp) {
          const match = after.filter(function (s) { return s.id === exp.id; });
          assert.strictEqual(match.length, 1, 'cena nao-alvo deveria continuar exatamente uma vez: ' + exp.id);
          assert.deepStrictEqual(match[0], exp, 'cena nao-alvo nao pode ser alterada: ' + exp.id);
        });

        // O valor retornado por deleteScene reflete a lista restante.
        assert.deepStrictEqual(returned, after, 'deleteScene deveria retornar a lista restante');
      }
    ),
    { numRuns: 200 }
  );

  console.log('Property 10 (delete scene removes only the target): OK');
}

run();
