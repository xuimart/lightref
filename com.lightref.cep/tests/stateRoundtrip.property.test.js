/*
 * Property 11: Round-trip do Estado_Completo (collectState -> applyScene).
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8,
 *            14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7
 *
 * Feature: library-and-scenes-manager, Property 11: Para qualquer estado valido
 * do estudio, aplicar (applyScene) o estado produzido por collectState reproduz
 * os mesmos valores observaveis por todos os getters capturados: modelo, rotacao
 * (yaw/pitch/roll), offset (x/y/z), escala, fundo, ambiente/HDR e intensidade,
 * todas as luzes (cor/intensidade/azimute/elevacao/softness/sourceSize/enabled),
 * material e parametros, pos-processamento (fx) e camera (focal/projecao).
 *
 * Abordagem (documentada): collectState()/applyScene() vivem dentro do IIFE de
 * panel.js e nao sao exportados. Em vez de reimplementar a logica no teste (o
 * que nao provaria nada sobre a producao), extraimos MINIMAMENTE a logica pura
 * para collectSceneState(scene, model) / applySceneState(scene, state, opts) no
 * proprio panel.js e a publicamos em window.__lrStateApi. O harness
 * loadPanelState carrega o panel.js real num vm Node (com window/document
 * falsos, sem disparar DOMContentLoaded) e usa um FAKE de scene (getters/setters
 * + lightManager em array). Assim exercitamos o codigo de producao real, sem
 * navegador nem Babylon.
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadPanelState, makeFakeScene } = require('./loadPanelState');

const api = loadPanelState();

// Numero finito "seguro" para comparacao exata (round-trip por JSON/valor).
const num = fc.integer({ min: -1000, max: 1000 }).map(function (n) { return n / 10; });
const hex = fc.constantFrom('#000000', '#ffffff', '#c9c4bd', '#3a4a6a', '#ff6a6a', '#123456');

const lightArb = fc.record({
  name: fc.string({ minLength: 0, maxLength: 8 }),
  color: hex,
  intensity: num,
  azimuth: fc.integer({ min: 0, max: 360 }),
  elevation: fc.integer({ min: -90, max: 90 }),
  enabled: fc.boolean(),
  softness: num,
  sourceSize: num
});

const fxArb = fc.record({
  exposure: num,
  temperature: num,
  contrast: num,
  saturation: num,
  blackWhite: num,
  posterizeOn: fc.boolean(),
  posterizeLevels: fc.integer({ min: 2, max: 16 }),
  cutoutOn: fc.boolean(),
  cutoutLevels: fc.integer({ min: 1, max: 16 })
});

const matParamsArb = fc.dictionary(
  fc.constantFrom('roughness', 'metalness', 'sheen', 'alpha'),
  num,
  { maxKeys: 4 }
);

// Gera um estado "fonte" (initial) que o fake de scene vai adotar; depois
// collectSceneState le esse estado e applySceneState o reproduz num fake limpo.
const initialArb = fc.record({
  rotation: fc.record({ yaw: fc.integer({ min: -360, max: 360 }), pitch: fc.integer({ min: -180, max: 180 }), roll: fc.integer({ min: -180, max: 180 }) }),
  offset: fc.record({ x: num, y: num, z: num }),
  scaleMult: fc.integer({ min: 1, max: 50 }).map(function (n) { return n / 10; }),
  background: fc.record({ transparent: fc.boolean(), color: hex }),
  environment: fc.option(fc.constantFrom('hdr/a.jpg', 'hdr/b.jpg', 'hdr/c.jpg'), { nil: null }),
  envIntensity: num,
  lights: fc.array(lightArb, { minLength: 0, maxLength: 5 }),
  material: fc.constantFrom('clay', 'matte', 'metal', 'form'),
  materialParams: matParamsArb,
  formColor: hex,
  focal: fc.integer({ min: 10, max: 300 }),
  projection: fc.constantFrom('persp', 'ortho'),
  fx: fxArb
});

const modelArb = fc.option(fc.constantFrom('models/asaro.obj', 'file:///tmp/model_1.obj', 'models/ecorche.obj'), { nil: null });

// Extrai os campos observaveis via os getters do scene (como collectState faz),
// para comparar dois cenarios diretamente por igualdade profunda.
function observe(sc, model) {
  return api.collectSceneState(sc, model);
}

function run() {
  fc.assert(
    fc.property(initialArb, modelArb, function (initial, model) {
      // Cena de origem com o estado gerado.
      const src = makeFakeScene(initial);
      const state = api.collectSceneState(src, model);

      // Cena de destino LIMPA (defaults diferentes dos gerados).
      const dst = makeFakeScene();
      api.applySceneState(dst, state, {}); // sem loadModel: aplica direto (fake sincrono)

      // Observa o destino e compara com o estado coletado da origem.
      const after = observe(dst, model);

      // model faz round-trip pelo proprio campo (dst nao guarda model; o valor
      // e o mesmo passado). Comparamos o restante campo a campo.
      assert.strictEqual(after.model, state.model, 'model deveria fazer round-trip');
      assert.deepStrictEqual(after.rotation, state.rotation, 'rotation (yaw/pitch/roll)');
      assert.deepStrictEqual(after.offset, state.offset, 'offset (x/y/z)');
      assert.strictEqual(after.scaleMult, state.scaleMult, 'scaleMult (escala)');
      assert.deepStrictEqual(after.background, state.background, 'background');
      assert.strictEqual(after.environment, state.environment, 'environment/HDR');
      assert.strictEqual(after.envIntensity, state.envIntensity, 'envIntensity');
      assert.deepStrictEqual(after.material, state.material, 'material');
      assert.deepStrictEqual(after.materialParams, state.materialParams, 'materialParams');
      assert.strictEqual(after.formColor, state.formColor, 'formColor');
      assert.strictEqual(after.focal, state.focal, 'focal');
      assert.strictEqual(after.projection, state.projection, 'projection');
      assert.deepStrictEqual(after.fx, state.fx, 'fx (pos-processamento)');

      // Luzes: mesmo conjunto de campos observaveis, na mesma ordem, ignorando id
      // (o id e reatribuido ao recriar as luzes; nao e campo do Estado_Completo).
      assert.strictEqual(after.lights.length, state.lights.length, 'numero de luzes');
      for (var i = 0; i < after.lights.length; i++) {
        assert.deepStrictEqual(after.lights[i], state.lights[i], 'luz ' + i);
      }
    }),
    { numRuns: 200 }
  );

  console.log('Property 11 (round-trip do Estado_Completo): OK');
}

run();
