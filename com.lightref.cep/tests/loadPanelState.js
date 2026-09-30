/*
 * loadPanelState.js - carrega js/panel.js (codigo de producao ES5) num ambiente
 * Node controlado e extrai a API pura de Estado_Completo:
 *   window.__lrStateApi = { collectSceneState, applySceneState }
 *
 * O panel.js e um IIFE que so DEFINE funcoes e registra um listener de
 * DOMContentLoaded no nivel de topo (o trabalho pesado roda dentro desse
 * callback, que nunca disparamos aqui). Assim, carregar o arquivo com um
 * 'window' e 'document' falsos apenas define as funcoes e publica
 * window.__lrStateApi, sem tocar em DOM real, Babylon, MODELS/SHAPES etc.
 *
 * Isso permite testar collectSceneState/applySceneState (Property 11/12) com um
 * fake de scene, sem navegador e sem transpilar o codigo de producao (ES5).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PANEL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'panel.js'),
  'utf8'
);

/** Carrega o panel.js e devolve a API pura de estado. */
function loadPanelState() {
  // 'document'/'window' minimos: so precisam de addEventListener (no-op) e o
  // window para receber __lrStateApi. Nada dispara DOMContentLoaded.
  const fakeWindow = {
    addEventListener: function () {}
  };
  const fakeDocument = {
    addEventListener: function () {}
  };

  const sandbox = {
    window: fakeWindow,
    document: fakeDocument,
    JSON: JSON,
    Date: Date,
    Math: Math,
    console: console
  };
  // Permite que codigo que faz `typeof window` e referencias globais resolvam
  // para o mesmo objeto window do sandbox.
  sandbox.self = fakeWindow;

  vm.createContext(sandbox);
  vm.runInContext(PANEL_SRC, sandbox, { filename: 'panel.js' });

  const api = fakeWindow.__lrStateApi;
  if (!api || typeof api.collectSceneState !== 'function' || typeof api.applySceneState !== 'function') {
    throw new Error('panel.js nao publicou window.__lrStateApi (collectSceneState/applySceneState)');
  }
  return api;
}

/**
 * Cria um fake de scene com os mesmos getters/setters usados por
 * collectSceneState/applySceneState. Guarda os valores em memoria; o
 * lightManager e um array simples com add/remove.
 *
 * initial: objeto opcional para semear valores iniciais (usado pela Property 12
 * para verificar preservacao do valor atual quando um campo esta ausente).
 */
function makeFakeScene(initial) {
  initial = initial || {};

  var state = {
    rotation: initial.rotation || { yaw: 0, pitch: 0, roll: 0 },
    offset: initial.offset || { x: 0, y: 0, z: 0 },
    scaleMult: (initial.scaleMult != null) ? initial.scaleMult : 1,
    background: initial.background || { transparent: false, color: '#3a4a6a' },
    environment: (initial.environment !== undefined) ? initial.environment : null,
    envIntensity: (initial.envIntensity != null) ? initial.envIntensity : 0.8,
    material: (initial.material != null) ? initial.material : 'clay',
    materialParams: initial.materialParams ? JSON.parse(JSON.stringify(initial.materialParams)) : {},
    formColor: (initial.formColor !== undefined) ? initial.formColor : '#c9c4bd',
    focal: (initial.focal != null) ? initial.focal : 50,
    projection: (initial.projection != null) ? initial.projection : 'persp',
    fx: initial.fx ? JSON.parse(JSON.stringify(initial.fx)) : { exposure: 0, temperature: 0, contrast: 0, saturation: 0, blackWhite: 0, posterizeOn: false, posterizeLevels: 4, cutoutOn: false, cutoutLevels: 3 }
  };

  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  var nextLightId = 1;
  var lights = (initial.lights || []).map(function (l) {
    var copy = {};
    for (var k in l) if (has(l, k)) copy[k] = l[k];
    if (copy.id == null) copy.id = nextLightId++;
    return copy;
  });

  var lightManager = {
    lights: lights,
    add: function (opts) {
      var copy = {};
      for (var k in opts) if (has(opts, k)) copy[k] = opts[k];
      copy.id = nextLightId++;
      this.lights.push(copy);
      return copy;
    },
    remove: function (id) {
      for (var i = 0; i < this.lights.length; i++) {
        if (this.lights[i].id === id) { this.lights.splice(i, 1); return; }
      }
    }
  };

  var postfx = {
    getParams: function () { return JSON.parse(JSON.stringify(state.fx)); },
    applyParams: function (obj) {
      for (var k in obj) if (obj.hasOwnProperty(k)) state.fx[k] = obj[k];
    }
  };

  return {
    _state: state,
    lightManager: lightManager,
    postfx: postfx,

    getModelRotation: function () { return { yaw: state.rotation.yaw, pitch: state.rotation.pitch, roll: state.rotation.roll }; },
    setModelRotation: function (yaw, pitch) { state.rotation.yaw = yaw; state.rotation.pitch = pitch; },
    setModelRoll: function (deg) { state.rotation.roll = deg; },

    getModelOffset: function () { return { x: state.offset.x, y: state.offset.y, z: state.offset.z }; },
    setModelOffset: function (axis, value) { state.offset[axis] = value; },

    getModelScaleMult: function () { return state.scaleMult; },
    setModelScaleMult: function (m) { state.scaleMult = m; },

    getBackground: function () { return { transparent: state.background.transparent, color: state.background.color }; },
    setBackground: function (mode, color) { state.background.transparent = (mode === 'transparent'); state.background.color = color; },

    getEnvironment: function () { return state.environment; },
    setEnvironment: function (url) { state.environment = (url != null) ? url : null; },

    getEnvIntensity: function () { return state.envIntensity; },
    setEnvIntensity: function (v) { state.envIntensity = v; },

    getMaterial: function () { return state.material; },
    setMaterial: function (type) { state.material = type; },

    getMaterialParams: function () { return JSON.parse(JSON.stringify(state.materialParams)); },
    setMaterialParam: function (name, value) { state.materialParams[name] = value; },

    getFormColor: function () { return state.formColor; },
    setFormColor: function (hex) { state.formColor = hex; },

    getFocalLength: function () { return state.focal; },
    setFocalLength: function (mm) { state.focal = mm; },

    getProjection: function () { return state.projection; },
    setProjection: function (mode) { state.projection = mode; }
  };
}

module.exports = { loadPanelState: loadPanelState, makeFakeScene: makeFakeScene };
