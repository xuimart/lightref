/*
 * Smoke test (Etapa 5, subtarefa 14.3): feedback visual de arraste.
 * Requirements: 6.1, 6.2
 *
 * Nao ha jsdom neste ambiente, entao validamos a LOGICA PURA que dirige o
 * feedback visual, em vez de eventos reais de DOM:
 *   - cardHTML(item) emite draggable="true" (o card e a origem do arraste, com
 *     .lr04-dragging aplicado no dragstart pelo bindDnD real);
 *   - o card "+" (addCardHTML) NAO e arrastavel (bindDnD ignora data-action add-model);
 *   - computeMove classifica corretamente destino valido (aciona .lr04-dropok e o
 *     movimento) x invalido (nao aciona nada).
 * Quando jsdom estiver disponivel, promover para smoke real: dragstart adiciona
 * .lr04-dragging; dragover adiciona .lr04-dropok.
 */
'use strict';

const assert = require('assert');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

function item(kind, id, cat, deletable) {
  return {
    id: id, kind: kind, title: 'T', subtitle: '',
    thumbHTML: '<div class="lr04-placeholder"></div>',
    deletable: !!deletable, draggable: true, fromCat: cat
  };
}

function run() {
  // 1) Card de item e arrastavel (draggable="true"): habilita o dragstart que
  // aplica o feedback .lr04-dragging (Req 6.1). data-cat guarda a origem.
  var myCard = api.cardHTML(item('mymodel', 7, 'Outros', true));
  assert.ok(myCard.indexOf('draggable="true"') >= 0, 'card de item e arrastavel');
  assert.ok(myCard.indexOf('data-cat="Outros"') >= 0, 'card guarda categoria de origem');

  var defCard = api.cardHTML(item('defmodel', 'models/asaro.obj', 'Cabecas', false));
  assert.ok(defCard.indexOf('draggable="true"') >= 0, 'modelo padrao tambem e arrastavel');

  // 2) O card "+" nao e arrastavel (bindDnD real filtra data-action add-model).
  var addC = api.addCardHTML();
  assert.ok(addC.indexOf('data-action="add-model"') >= 0, 'card "+" identificado por data-action');
  assert.ok(addC.indexOf('draggable="true"') < 0, 'card "+" NAO e arrastavel');

  // 3) computeMove: destino valido aciona o realce/movimento; invalido nao.
  var dragging = { kind: 'mymodel', id: '7', fromCat: 'Outros' };

  var mvValid = api.computeMove(dragging, 'Cabecas');
  assert.strictEqual(mvValid.valid, true, 'destino diferente da origem => valido (dropok)');
  assert.strictEqual(mvValid.itemKey, 'my:7', 'itemKey do importado');

  var mvSame = api.computeMove(dragging, 'Outros');
  assert.strictEqual(mvSame.valid, false, 'destino igual a origem => invalido (sem dropok)');

  var mvEmpty = api.computeMove(dragging, '');
  assert.strictEqual(mvEmpty.valid, false, 'destino vazio => invalido');

  var mvNull = api.computeMove(dragging, null);
  assert.strictEqual(mvNull.valid, false, 'destino nulo => invalido');

  // defmodel: itemKey e a propria url.
  var mvDef = api.computeMove({ kind: 'defmodel', id: 'models/asaro.obj', fromCat: 'Figuras' }, 'Cabecas');
  assert.strictEqual(mvDef.valid, true, 'mover modelo padrao para outra categoria e valido');
  assert.strictEqual(mvDef.itemKey, 'models/asaro.obj', 'itemKey do modelo padrao e a url');

  console.log('Smoke 14.3 (feedback visual de arraste): OK');
}

run();
