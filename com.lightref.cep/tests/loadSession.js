/*
 * loadSession.js - harness de teste (Node, CommonJS) para o Estado_da_Sessao
 * (sv:3). Reusa o loadPanelState() de tests/loadPanelState.js para obter a API
 * pura publicada em window.__lrStateApi, que agora inclui tambem
 * collectSessionState/applySessionState/sanitizeSessionState (Area C, tarefa 4).
 *
 * O makeFakeScene atual (loadPanelState.js) nao tem camera nem selecao; aqui o
 * ENVOLVEMOS (wrapper) adicionando getCameraState/setCameraState e mantendo o
 * lightManager intacto. Nao editamos loadPanelState.js.
 *
 * Expoe tambem helpers: um Estado_da_Sessao "inicial" valido (Estado_Inicial de
 * referencia para o fallback por campo) e um arbitrary fast-check de sessoes.
 */
'use strict';

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadPanelState, makeFakeScene } = require('./loadPanelState');

const SESSION_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'session.js'),
  'utf8'
);

/*
 * Carrega js/session.js (producao, ES5) num sandbox Node controlado e devolve
 * window.LightRefSession. O modulo chama require('fs')/require('path') no topo
 * do IIFE; damos um `require` falso que devolve um fs/path minimo (ou os reais,
 * conforme opts), e um `window` com LightRefStorage e CSInterface opcionais.
 *
 * Importante: as funcoes puras (sessionFileName, shouldRestore, makeDebouncer)
 * ficam disponiveis em LightRefSession sem jamais tocar fs/CSInterface - o IIFE
 * so os referencia dentro das funcoes impuras.
 *
 * opts:
 *   fakeFs      objeto fs falso (default: um fs minimo em memoria - ver abaixo)
 *   storageRoot string retornada por LightRefStorage.rootDir() (default '/root')
 *   CSInterface construtor de CSInterface falso (default: ausente)
 *   stateApi    objeto window.__lrStateApi (default: so sanitizeSessionState id)
 */
function loadSessionModule(opts) {
  opts = opts || {};

  // fs falso em memoria (mapa path -> conteudo). Suficiente para read/save.
  var files = opts.files || {};
  var fakeFs = opts.fakeFs || {
    existsSync: function (p) { return Object.prototype.hasOwnProperty.call(files, p); },
    readFileSync: function (p) {
      if (!Object.prototype.hasOwnProperty.call(files, p)) {
        var err = new Error('ENOENT: ' + p); err.code = 'ENOENT'; throw err;
      }
      return files[p];
    },
    writeFileSync: function (p, data) { files[p] = String(data); },
    renameSync: function (a, b) { files[b] = files[a]; delete files[a]; },
    mkdirSync: function () {},
    _files: files
  };

  var storageRoot = opts.storageRoot || '/root';
  var fakeWindow = {
    addEventListener: function () {},
    LightRefStorage: { rootDir: function () { return storageRoot; } },
    __lrStateApi: opts.stateApi || {
      sanitizeSessionState: function (raw) { return raw; }
    }
  };
  if (opts.CSInterface) fakeWindow.CSInterface = opts.CSInterface;
  if (opts.diagWrite) fakeWindow.__lrDiagWrite = opts.diagWrite;

  function fakeRequire(name) {
    if (name === 'fs') return fakeFs;
    if (name === 'path') return path; // path real do Node e inofensivo/determinista
    throw new Error('require inesperado: ' + name);
  }

  var sandbox = {
    window: fakeWindow,
    require: fakeRequire,
    JSON: JSON,
    Date: Date,
    Math: Math,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  sandbox.self = fakeWindow;

  vm.createContext(sandbox);
  vm.runInContext(SESSION_SRC, sandbox, { filename: 'session.js' });

  var sess = fakeWindow.LightRefSession;
  if (!sess ||
    typeof sess.sessionFileName !== 'function' ||
    typeof sess.shouldRestore !== 'function' ||
    typeof sess.makeDebouncer !== 'function') {
    throw new Error('session.js nao publicou window.LightRefSession (sessionFileName/shouldRestore/makeDebouncer)');
  }
  return { session: sess, window: fakeWindow, files: files, fs: fakeFs };
}

/** Carrega a API de sessao publicada em __lrStateApi. */
function loadSessionApi() {
  const api = loadPanelState();
  if (
    typeof api.collectSessionState !== 'function' ||
    typeof api.applySessionState !== 'function' ||
    typeof api.sanitizeSessionState !== 'function'
  ) {
    throw new Error('panel.js nao publicou collectSessionState/applySessionState/sanitizeSessionState em __lrStateApi');
  }
  return api;
}

/**
 * Envolve makeFakeScene adicionando suporte a camera e selecao de luz:
 *  - getCameraState()/setCameraState(s): guarda um objeto de camera em memoria.
 *  - setEnvBackgroundVisible(v): guarda hdrBackground.
 *  - selectedLight: posicao da luz selecionada (apenas armazenamento para teste).
 * Mantem lightManager/postfx/getters/setters do fake original intactos.
 */
function makeFakeSessionScene(initial) {
  initial = initial || {};
  const sc = makeFakeScene(initial.scene || initial);

  var camera = initial.camera
    ? JSON.parse(JSON.stringify(initial.camera))
    : { alpha: -1.5707, beta: 1.4279, radius: 5, target: { x: 0, y: 0.3, z: 0 } };
  var hdrBackground = (initial.hdrBackground != null) ? !!initial.hdrBackground : true;
  var selectedLight = (initial.selectedLight != null) ? initial.selectedLight : null;

  sc.getCameraState = function () {
    return {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: { x: camera.target.x, y: camera.target.y, z: camera.target.z }
    };
  };
  sc.setCameraState = function (s) {
    if (!s) return;
    if (typeof s.alpha === 'number' && isFinite(s.alpha)) camera.alpha = s.alpha;
    if (typeof s.beta === 'number' && isFinite(s.beta)) camera.beta = s.beta;
    if (typeof s.radius === 'number' && isFinite(s.radius)) camera.radius = s.radius;
    if (s.target) {
      camera.target = {
        x: s.target.x || 0,
        y: s.target.y || 0,
        z: s.target.z || 0
      };
    }
  };
  sc.setEnvBackgroundVisible = function (v) { hdrBackground = !!v; };
  sc.getEnvBackgroundVisible = function () { return hdrBackground; };
  sc.setSelectedLightIndex = function (i) { selectedLight = i; };
  sc.getSelectedLightIndex = function () { return selectedLight; };

  return sc;
}

/**
 * Estado_da_Sessao inicial valido (Estado_Inicial de referencia). Usado como
 * fallback por campo pela sanitizacao e como semente nos testes.
 */
function makeInitialSessionState() {
  return {
    sv: 3,
    sessionToken: null,
    scene: {
      schema: 2,
      model: 'models/asaro.obj',
      rotation: { yaw: 180, pitch: 0, roll: 0 },
      offset: { x: 0, y: 0, z: 0 },
      scaleMult: 1,
      background: { transparent: false, color: '#3a4a6a' },
      lights: [
        { name: 'Principal', color: '#f4f4f2', intensity: 1.2, azimuth: 45, elevation: 30, enabled: true, softness: 0, sourceSize: 0 }
      ],
      fx: { exposure: 0, temperature: 0, contrast: 0, saturation: 1, blackWhite: 0, posterizeOn: false, posterizeLevels: 4, cutoutOn: false, cutoutLevels: 3 },
      focal: 50,
      projection: 'persp',
      material: 'clay',
      materialParams: {},
      formColor: null,
      environment: null,
      envIntensity: 0.8
    },
    selectedLight: 0,
    camera: { alpha: -1.5707, beta: 1.4279, radius: 5, target: { x: 0, y: 0.3, z: 0 } },
    hdrBackground: true,
    ui: {
      page: 'studio',
      tab: 'light',
      floor: true,
      guides: true,
      reference: false,
      collapsed: false,
      materialOpen: false,
      envDrawerOpen: false
    }
  };
}

// ---- Arbitraries ----------------------------------------------------------

const finiteNum = fc.integer({ min: -10000, max: 10000 }).map(function (n) { return n / 100; });
const hex = fc.constantFrom('#000000', '#ffffff', '#c9c4bd', '#3a4a6a', '#ff6a6a', '#123456');

const validLightArb = fc.record({
  name: fc.string({ minLength: 0, maxLength: 8 }),
  color: hex,
  intensity: finiteNum,
  azimuth: fc.integer({ min: 0, max: 360 }),
  elevation: fc.integer({ min: -90, max: 90 }),
  enabled: fc.boolean(),
  softness: finiteNum,
  sourceSize: finiteNum
});

const validSceneArb = fc.record({
  schema: fc.constant(2),
  model: fc.option(fc.constantFrom('models/asaro.obj', 'models/ecorche.obj'), { nil: null }),
  rotation: fc.record({ yaw: finiteNum, pitch: finiteNum, roll: finiteNum }),
  offset: fc.record({ x: finiteNum, y: finiteNum, z: finiteNum }),
  scaleMult: fc.integer({ min: 1, max: 50 }).map(function (n) { return n / 10; }),
  background: fc.record({ transparent: fc.boolean(), color: hex }),
  lights: fc.array(validLightArb, { minLength: 0, maxLength: 5 }),
  fx: fc.record({
    exposure: finiteNum, temperature: finiteNum, contrast: finiteNum, saturation: finiteNum,
    blackWhite: finiteNum, posterizeOn: fc.boolean(), posterizeLevels: fc.integer({ min: 2, max: 16 }),
    cutoutOn: fc.boolean(), cutoutLevels: fc.integer({ min: 1, max: 16 })
  }),
  focal: fc.integer({ min: 10, max: 300 }),
  projection: fc.constantFrom('persp', 'ortho'),
  material: fc.constantFrom('clay', 'matte', 'metal', 'form'),
  materialParams: fc.dictionary(fc.constantFrom('roughness', 'metalness', 'sheen'), finiteNum, { maxKeys: 3 }),
  formColor: fc.option(hex, { nil: null }),
  environment: fc.option(fc.constantFrom('hdr/a.jpg', 'hdr/b.jpg'), { nil: null }),
  envIntensity: finiteNum
});

const validCameraArb = fc.record({
  alpha: finiteNum, beta: finiteNum, radius: fc.integer({ min: 1, max: 50 }),
  target: fc.record({ x: finiteNum, y: finiteNum, z: finiteNum })
});

const validUiArb = fc.record({
  page: fc.constantFrom('studio', 'library', 'scenes'),
  tab: fc.constantFrom('light', 'lens', 'adjust', 'pos', 'comp'),
  floor: fc.boolean(), guides: fc.boolean(), reference: fc.boolean(),
  collapsed: fc.boolean(), materialOpen: fc.boolean(), envDrawerOpen: fc.boolean()
});

/** Estado_da_Sessao valido (sv:3). */
const validSessionArb = fc.record({
  sv: fc.constant(3),
  sessionToken: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  scene: validSceneArb,
  selectedLight: fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }),
  camera: validCameraArb,
  hdrBackground: fc.boolean(),
  ui: validUiArb
});

// Valores "lixo" que podem aparecer num JSON corrompido/arbitrario. NaN/Infinity
// nunca sobrevivem ao JSON, mas podem aparecer num objeto em memoria.
const garbage = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.string(),
  fc.boolean(),
  fc.integer(),
  fc.array(fc.anything(), { maxLength: 3 }),
  fc.object()
);

/**
 * raw com sv:3 porem com campos arbitrarios/invalidos (tipos errados, nao
 * finitos, ausentes). Alguns campos vem do valido, outros de lixo, para
 * exercitar o fallback por campo sem nunca lancar.
 */
const noisySessionArb = fc.record({
  sv: fc.constant(3),
  sessionToken: fc.oneof(fc.string(), garbage),
  scene: fc.oneof(validSceneArb, fc.record({
    model: garbage, rotation: garbage, offset: garbage, scaleMult: garbage,
    background: garbage, lights: fc.oneof(fc.array(fc.oneof(validLightArb, garbage), { maxLength: 4 }), garbage),
    fx: garbage, focal: garbage, projection: garbage, material: garbage,
    materialParams: garbage, formColor: garbage, environment: garbage, envIntensity: garbage
  }), garbage),
  selectedLight: fc.oneof(fc.integer(), finiteNum, garbage),
  camera: fc.oneof(validCameraArb, fc.record({ alpha: garbage, beta: garbage, radius: garbage, target: garbage }), garbage),
  hdrBackground: fc.oneof(fc.boolean(), garbage),
  ui: fc.oneof(validUiArb, fc.record({
    page: garbage, tab: garbage, floor: garbage, guides: garbage,
    reference: garbage, collapsed: garbage, materialOpen: garbage, envDrawerOpen: garbage
  }), garbage)
}, { requiredKeys: ['sv'] });

module.exports = {
  loadSessionApi: loadSessionApi,
  loadSessionModule: loadSessionModule,
  makeFakeSessionScene: makeFakeSessionScene,
  makeInitialSessionState: makeInitialSessionState,
  arb: {
    finiteNum: finiteNum,
    validLightArb: validLightArb,
    validSceneArb: validSceneArb,
    validCameraArb: validCameraArb,
    validUiArb: validUiArb,
    validSessionArb: validSessionArb,
    noisySessionArb: noisySessionArb,
    garbage: garbage
  }
};
