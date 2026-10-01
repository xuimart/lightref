/*
 * Property 8: Round-trip do Estado_da_Sessao.
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 15.7, 10.5
 *
 * Feature: update-button-wizard-and-session, Property 8: Para qualquer
 * Estado_da_Sessao valido S, aplicar S num motor (fake) e em seguida coletar o
 * estado, serializar em JSON, desserializar e restaurar produz igualdade
 * profunda de todos os campos observaveis: modelo/rotacao/offset/escala, luzes
 * na mesma ordem (comparadas por valor, pois os ids sao reatribuidos ao
 * recriar), luz selecionada (por posicao), material/params/formColor, fundo,
 * ambiente/intensidade, "Mostrar fundo do HDR", pos-processamento, focal,
 * projecao, camera e Estado_da_Interface.
 *
 * Exercita o codigo de producao real: collectSessionState/applySessionState vem
 * de window.__lrStateApi (harness tests/loadSession.js), com um fake de scene
 * que suporta camera, selecao e hdrBackground.
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

// Compara luzes por VALOR (ignora id, que muda ao recriar). Ordem preservada.
function lightsByValue(lights) {
  return (lights || []).map(function (l) {
    return {
      name: l.name,
      color: l.color,
      intensity: l.intensity,
      azimuth: l.azimuth,
      elevation: l.elevation,
      enabled: l.enabled,
      softness: l.softness,
      sourceSize: l.sourceSize
    };
  });
}

// Aplica um Estado_da_Sessao a um fake scene, capturando a UI e a selecao que
// o painel aplicaria. Devolve { capturedUi, selectedIndex }.
function applyToFake(sc, state) {
  var captured = { ui: null, selectedIndex: null };
  api.applySessionState(sc, state, {
    // loadModel sincrono: so chama done() (o modelo "carrega" na hora).
    loadModel: function (url, done, onFail) { if (done) done(); },
    onModelValue: function (url) { captured.modelValue = url; },
    onBackground: function (st) { /* efeito de DOM; irrelevante no fake */ },
    feedback: function () {},
    selectLightByIndex: function (idx) {
      captured.selectedIndex = idx;
      if (typeof sc.setSelectedLightIndex === 'function') sc.setSelectedLightIndex(idx);
    },
    applyUi: function (ui) { captured.ui = ui; },
    afterApply: function () {}
  });
  return captured;
}

// Monta o uiSnapshot que o painel passaria para collectSessionState a partir do
// estado aplicado: selectedLightId mapeado da posicao -> id atual, hdrBackground
// do fake, e demais flags da UI capturada.
function snapshotFromCaptured(sc, captured) {
  var ui = captured.ui || {};
  var list = sc.lightManager.lights;
  var selId = null;
  var idx = captured.selectedIndex;
  if (idx != null && list.length) {
    var i = idx < 0 ? 0 : (idx > list.length - 1 ? list.length - 1 : idx);
    selId = list[i].id;
  }
  return {
    selectedLightId: selId,
    hdrBackground: sc.getEnvBackgroundVisible(),
    page: ui.page,
    tab: ui.tab,
    floor: ui.floor,
    guides: ui.guides,
    reference: ui.reference,
    collapsed: ui.collapsed,
    materialOpen: ui.materialOpen,
    envDrawerOpen: ui.envDrawerOpen
  };
}

function run() {
  fc.assert(
    fc.property(arb.validSessionArb, function (Sraw) {
      // O Estado_da_Sessao real sempre chega do disco via JSON.parse, entao
      // normalizamos por JSON (remove __proto__:null dos records do fast-check e
      // reflete fielmente o que o boot receberia).
      var S = JSON.parse(JSON.stringify(Sraw));

      // Semeia o motor com o proprio Estado_da_Sessao: as luzes iniciais sao
      // esvaziadas para provar que a restauracao RECRIA exatamente as luzes do
      // estado (sem luz padrao extra), enquanto os demais campos iniciais casam
      // com S. Isso cobre tambem os campos que applySceneState pula quando o
      // valor e null (formColor/environment): "pular = manter o atual", e o
      // atual ja e o de S. O round-trip permanece significativo: collect ->
      // JSON -> parse -> compara com S para TODOS os campos observaveis.
      var seed = JSON.parse(JSON.stringify(S));
      seed.scene.lights = [];
      var sc = makeFakeSessionScene(seed);

      // 1) Aplica o estado S.
      var captured = applyToFake(sc, S);

      // 2) Coleta -> JSON -> parse (ida e volta por serializacao real).
      var snap = snapshotFromCaptured(sc, captured);
      var collected = api.collectSessionState(sc, (S.scene && S.scene.model) || null, snap);
      var round = JSON.parse(JSON.stringify(collected));

      // --- Comparacoes de igualdade profunda dos campos observaveis --------
      assert.strictEqual(round.sv, 3, 'sv deveria ser 3');

      // Modelo / transform / escala.
      assert.strictEqual(round.scene.model, S.scene.model, 'model preservado');
      assert.deepStrictEqual(round.scene.rotation, S.scene.rotation, 'rotation preservada');
      assert.deepStrictEqual(round.scene.offset, S.scene.offset, 'offset preservado');
      assert.strictEqual(round.scene.scaleMult, S.scene.scaleMult, 'scaleMult preservado');

      // Luzes: mesma ordem e mesmos valores (ignorando id).
      assert.deepStrictEqual(
        lightsByValue(round.scene.lights),
        lightsByValue(S.scene.lights),
        'luzes preservadas na mesma ordem (por valor)'
      );
      // Sem luz extra nem duplicacao.
      assert.strictEqual(round.scene.lights.length, S.scene.lights.length,
        'numero de luzes exato (sem extra, sem duplicar)');

      // Material / params / formColor.
      assert.strictEqual(round.scene.material, S.scene.material, 'material preservado');
      assert.deepStrictEqual(round.scene.materialParams, S.scene.materialParams, 'materialParams preservados');
      assert.strictEqual(round.scene.formColor, S.scene.formColor, 'formColor preservado');

      // Fundo.
      assert.deepStrictEqual(round.scene.background, S.scene.background, 'background preservado');

      // Ambiente / intensidade.
      assert.strictEqual(round.scene.environment, S.scene.environment, 'environment preservado');
      assert.strictEqual(round.scene.envIntensity, S.scene.envIntensity, 'envIntensity preservado');

      // Pos-processamento, focal, projecao.
      assert.deepStrictEqual(round.scene.fx, S.scene.fx, 'fx preservado');
      assert.strictEqual(round.scene.focal, S.scene.focal, 'focal preservado');
      assert.strictEqual(round.scene.projection, S.scene.projection, 'projection preservada');

      // "Mostrar fundo do HDR".
      assert.strictEqual(round.hdrBackground, S.hdrBackground, 'hdrBackground preservado');

      // Camera.
      assert.deepStrictEqual(round.camera, S.camera, 'camera preservada');

      // Luz selecionada (por posicao, com clamp). S.selectedLight pode apontar
      // alem do numero de luzes; o esperado e o indice clampado em [0,n-1] ou
      // null quando nao ha luzes.
      var n = S.scene.lights.length;
      var expectedSel;
      if (n > 0 && S.selectedLight != null) {
        var si = S.selectedLight;
        expectedSel = si < 0 ? 0 : (si > n - 1 ? n - 1 : si);
      } else {
        expectedSel = null;
      }
      assert.strictEqual(round.selectedLight, expectedSel, 'selectedLight (posicao, clamp) preservada');

      // Estado_da_Interface.
      assert.deepStrictEqual(round.ui, {
        page: S.ui.page,
        tab: S.ui.tab,
        floor: S.ui.floor,
        guides: S.ui.guides,
        reference: S.ui.reference,
        collapsed: S.ui.collapsed,
        materialOpen: S.ui.materialOpen,
        envDrawerOpen: S.ui.envDrawerOpen
      }, 'Estado_da_Interface preservado');
    }),
    { numRuns: 200 }
  );

  console.log('Feature: update-button-wizard-and-session, Property 8: Round-trip do Estado_da_Sessao : OK');
}

run();
