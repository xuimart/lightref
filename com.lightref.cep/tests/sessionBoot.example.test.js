/*
 * Testes de exemplo do boot de sessao (fiacao de opts do applySessionState).
 * Requisitos: 12.1, 12.3, 15.2 (parciais, parte pura/sem DOM).
 *
 * Estes testes NAO precisam de DOM: exercitam o contrato de opts que o boot
 * (restoreSessionIntoScene) usa, atraves do fake de scene (makeFakeSessionScene):
 *  - restaurar com um modelo valido chama opts.loadModel EXATAMENTE uma vez (12.1);
 *  - quando loadModel aciona o caminho onFail (modelo ausente), opts.feedback e
 *    chamado e os demais campos ainda sao aplicados (15.2);
 *  - selectLightByIndex recebe um indice clampado em [0, n-1] ou null;
 *  - applyUi recebe o objeto ui do estado.
 *
 * Exercita o codigo de producao real: applySessionState vem de
 * window.__lrStateApi (harness tests/loadSession.js).
 */
'use strict';

const assert = require('assert');
const {
  loadSessionApi,
  makeFakeSessionScene,
  makeInitialSessionState
} = require('./loadSession');

const api = loadSessionApi();

function baseState() {
  // Estado valido com modelo definido, 3 luzes e selectedLight fora da faixa
  // (para exercitar o clamp). Comeca de um Estado_Inicial e ajusta.
  var s = makeInitialSessionState();
  s.scene.model = 'models/ecorche.obj';
  s.scene.lights = [
    { name: 'A', color: '#ffffff', intensity: 1, azimuth: 0, elevation: 0, enabled: true, softness: 0, sourceSize: 0 },
    { name: 'B', color: '#ff0000', intensity: 2, azimuth: 10, elevation: 20, enabled: true, softness: 0, sourceSize: 0 },
    { name: 'C', color: '#00ff00', intensity: 3, azimuth: 30, elevation: 40, enabled: false, softness: 0, sourceSize: 0 }
  ];
  s.selectedLight = 99; // fora da faixa -> deve ser clampado para 2 (n-1)
  s.ui.tab = 'adjust';
  s.ui.page = 'library';
  s.hdrBackground = false;
  return s;
}

// --- Exemplo 1: modelo valido chama loadModel exatamente uma vez (12.1) -----
function test_loadModel_called_once() {
  var sc = makeFakeSessionScene({ scene: { lights: [] } });
  var S = baseState();
  var calls = 0;
  var modelValueSet = null;

  api.applySessionState(sc, S, {
    loadModel: function (url, done, onFail) { calls++; if (done) done(); },
    onModelValue: function (url) { modelValueSet = url; },
    feedback: function () {},
    selectLightByIndex: function () {},
    applyUi: function () {}
  });

  assert.strictEqual(calls, 1, 'loadModel deveria ser chamado exatamente uma vez');
  assert.strictEqual(modelValueSet, 'models/ecorche.obj', 'onModelValue recebe o modelo do estado');
  assert.strictEqual(sc.lightManager.lights.length, 3, 'as 3 luzes do estado foram recriadas (sem extra)');
  console.log('  ok loadModel chamado uma vez; modelo refletido; luzes recriadas');
}

// --- Exemplo 2: onFail (modelo ausente) -> feedback + demais campos aplicados (15.2)
function test_onFail_applies_rest_with_warning() {
  var sc = makeFakeSessionScene({ scene: { lights: [] } });
  var S = baseState();
  var feedbacks = [];
  var uiApplied = null;

  api.applySessionState(sc, S, {
    // Simula modelo ausente: dispara o caminho onFail.
    loadModel: function (url, done, onFail) { if (onFail) onFail(new Error('missing')); },
    onModelValue: function () {},
    feedback: function (msg, isErr) { feedbacks.push({ msg: msg, isErr: isErr }); },
    selectLightByIndex: function () {},
    applyUi: function (ui) { uiApplied = ui; }
  });

  assert.ok(feedbacks.length >= 1, 'feedback deveria ser chamado ao falhar o modelo');
  assert.strictEqual(feedbacks[0].isErr, true, 'o feedback de falha deveria ser de erro');

  // Demais campos aplicados mesmo com o modelo falhando.
  assert.strictEqual(sc.lightManager.lights.length, 3, 'luzes aplicadas apesar da falha do modelo');
  assert.strictEqual(sc.getMaterial(), S.scene.material, 'material aplicado apesar da falha');
  assert.strictEqual(sc.getProjection(), S.scene.projection, 'projecao aplicada apesar da falha');
  assert.strictEqual(sc.getFocalLength(), S.scene.focal, 'focal aplicado apesar da falha');
  assert.ok(uiApplied && uiApplied.tab === 'adjust', 'applyUi recebeu a UI apesar da falha');
  console.log('  ok onFail: feedback de erro + demais campos aplicados');
}

// --- Exemplo 3: selectLightByIndex recebe indice clampado em [0,n-1] --------
function test_selectLightByIndex_clamped() {
  // (a) selectedLight fora da faixa (99) com 3 luzes -> 2.
  var scA = makeFakeSessionScene({ scene: { lights: [] } });
  var SA = baseState(); // selectedLight = 99
  var idxA = 'unset';
  api.applySessionState(scA, SA, {
    loadModel: function (url, done) { if (done) done(); },
    feedback: function () {},
    selectLightByIndex: function (idx) { idxA = idx; },
    applyUi: function () {}
  });
  assert.strictEqual(idxA, 2, 'indice 99 com 3 luzes deveria clampar para 2 (n-1)');

  // (b) selectedLight negativo -> 0.
  var scB = makeFakeSessionScene({ scene: { lights: [] } });
  var SB = baseState(); SB.selectedLight = -5;
  var idxB = 'unset';
  api.applySessionState(scB, SB, {
    loadModel: function (url, done) { if (done) done(); },
    feedback: function () {},
    selectLightByIndex: function (idx) { idxB = idx; },
    applyUi: function () {}
  });
  assert.strictEqual(idxB, 0, 'indice negativo deveria clampar para 0');

  // (c) sem luzes -> null.
  var scC = makeFakeSessionScene({ scene: { lights: [] } });
  var SC = baseState(); SC.scene.lights = []; SC.selectedLight = 0;
  var idxC = 'unset';
  api.applySessionState(scC, SC, {
    loadModel: function (url, done) { if (done) done(); },
    feedback: function () {},
    selectLightByIndex: function (idx) { idxC = idx; },
    applyUi: function () {}
  });
  assert.strictEqual(idxC, null, 'sem luzes, o indice selecionado deveria ser null');

  // (d) indice valido no meio da faixa e preservado.
  var scD = makeFakeSessionScene({ scene: { lights: [] } });
  var SD = baseState(); SD.selectedLight = 1;
  var idxD = 'unset';
  api.applySessionState(scD, SD, {
    loadModel: function (url, done) { if (done) done(); },
    feedback: function () {},
    selectLightByIndex: function (idx) { idxD = idx; },
    applyUi: function () {}
  });
  assert.strictEqual(idxD, 1, 'indice valido (1) deveria ser preservado');

  console.log('  ok selectLightByIndex clampado em [0,n-1] / null sem luzes');
}

// --- Exemplo 4: applyUi recebe o objeto ui do estado ------------------------
function test_applyUi_receives_ui() {
  var sc = makeFakeSessionScene({ scene: { lights: [] } });
  var S = baseState();
  var uiApplied = null;
  var hdrApplied = null;

  // intercepta setEnvBackgroundVisible para confirmar hdrBackground aplicado.
  var origSet = sc.setEnvBackgroundVisible;
  sc.setEnvBackgroundVisible = function (v) { hdrApplied = v; origSet.call(sc, v); };

  api.applySessionState(sc, S, {
    loadModel: function (url, done) { if (done) done(); },
    feedback: function () {},
    selectLightByIndex: function () {},
    applyUi: function (ui) { uiApplied = ui; }
  });

  assert.ok(uiApplied, 'applyUi deveria ser chamado com o objeto ui');
  assert.strictEqual(uiApplied.tab, 'adjust', 'ui.tab repassado ao applyUi');
  assert.strictEqual(uiApplied.page, 'library', 'ui.page repassado ao applyUi');
  assert.strictEqual(hdrApplied, false, 'hdrBackground do estado aplicado ao motor');
  console.log('  ok applyUi recebe a UI; hdrBackground aplicado');
}

function run() {
  test_loadModel_called_once();
  test_onFail_applies_rest_with_warning();
  test_selectLightByIndex_clamped();
  test_applyUi_receives_ui();
  console.log('Feature: update-button-wizard-and-session, Testes de exemplo do boot de sessao : OK');
}

run();
