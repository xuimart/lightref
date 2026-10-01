/*
 * Property 9: Idempotencia da restauracao (sem luz extra nem duplicada).
 * Validates: Requirements 10.4, 12.2, 15.7
 *
 * Feature: update-button-wizard-and-session, Property 9: Para qualquer
 * Estado_da_Sessao valido S, aplicar S DUAS vezes seguidas e coletar produz
 * exatamente o mesmo resultado observavel que aplicar S UMA vez e coletar; e o
 * numero de luzes apos restaurar e EXATAMENTE S.scene.lights.length (sem luz
 * padrao extra, sem duplicacao), pois applySceneState remove todas as luzes
 * antes de re-adicionar.
 *
 * Exercita o codigo de producao real via window.__lrStateApi (harness
 * tests/loadSession.js).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const {
  loadSessionApi,
  makeFakeSessionScene,
  arb
} = require('./loadSession');

const api = loadSessionApi();

// Aplica S a um fake, capturando a UI/selecao, e devolve o estado coletado
// (ja normalizado por JSON). Opera sobre um fake vazio de luzes.
function applyAndCollect(S, timesList) {
  var seed = JSON.parse(JSON.stringify(S));
  seed.scene.lights = [];
  var sc = makeFakeSessionScene(seed);

  var captured = { ui: null, selectedIndex: null };
  function applyOnce() {
    captured = { ui: null, selectedIndex: null };
    api.applySessionState(sc, S, {
      loadModel: function (url, done) { if (done) done(); },
      onModelValue: function () {},
      onBackground: function () {},
      feedback: function () {},
      selectLightByIndex: function (idx) {
        captured.selectedIndex = idx;
        if (typeof sc.setSelectedLightIndex === 'function') sc.setSelectedLightIndex(idx);
      },
      applyUi: function (ui) { captured.ui = ui; },
      afterApply: function () {}
    });
  }

  for (var t = 0; t < timesList; t++) applyOnce();

  // Monta o uiSnapshot que o painel passaria para a coleta.
  var ui = captured.ui || {};
  var list = sc.lightManager.lights;
  var selId = null;
  var idx = captured.selectedIndex;
  if (idx != null && list.length) {
    var i = idx < 0 ? 0 : (idx > list.length - 1 ? list.length - 1 : idx);
    selId = list[i].id;
  }
  var snap = {
    selectedLightId: selId,
    hdrBackground: sc.getEnvBackgroundVisible(),
    page: ui.page, tab: ui.tab, floor: ui.floor, guides: ui.guides,
    reference: ui.reference, collapsed: ui.collapsed,
    materialOpen: ui.materialOpen, envDrawerOpen: ui.envDrawerOpen
  };
  var collected = api.collectSessionState(sc, (S.scene && S.scene.model) || null, snap);
  return {
    collected: JSON.parse(JSON.stringify(collected)),
    lightCount: sc.lightManager.lights.length
  };
}

function run() {
  fc.assert(
    fc.property(arb.validSessionArb, function (Sraw) {
      var S = JSON.parse(JSON.stringify(Sraw));

      var once = applyAndCollect(S, 1);
      var twice = applyAndCollect(S, 2);

      // Idempotencia: aplicar duas vezes == aplicar uma vez (observavel).
      assert.deepStrictEqual(twice.collected, once.collected,
        'aplicar duas vezes deveria produzir o mesmo estado coletado que uma vez');

      // Numero de luzes exato: igual a S.scene.lights.length nas duas execucoes
      // (sem luz padrao extra, sem duplicar ao reaplicar).
      assert.strictEqual(once.lightCount, S.scene.lights.length,
        'uma restauracao: numero de luzes deveria ser exatamente o do estado');
      assert.strictEqual(twice.lightCount, S.scene.lights.length,
        'duas restauracoes: numero de luzes deveria permanecer o do estado (sem duplicar)');
      assert.strictEqual(once.collected.scene.lights.length, S.scene.lights.length,
        'coleta: numero de luzes deveria ser exatamente o do estado');
    }),
    { numRuns: 200 }
  );

  console.log('Feature: update-button-wizard-and-session, Property 9: Idempotencia da restauracao : OK');
}

run();
