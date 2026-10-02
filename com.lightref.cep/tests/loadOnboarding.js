/*
 * loadOnboarding.js - harness de teste (Node, CommonJS) para js/onboarding.js
 * (window.LightRefOnboarding). O modulo e um IIFE que recebe `window`, consulta
 * o DOM por id/classe no DOMContentLoaded (bind) e manipula estilos/textos.
 *
 * Como o onboarding.js e pesado em DOM e so fecha a fiacao no DOMContentLoaded,
 * aqui montamos um DOM FALSO num sandbox vm, com o minimo necessario:
 *  - fabrica de elementos (id, className, classList, style, textContent,
 *    innerHTML, src, getAttribute/setAttribute, hidden, appendChild,
 *    addEventListener + .click()/.fire(type), hasAttribute/removeAttribute,
 *    querySelector/children);
 *  - document com getElementById (ids pre-registrados), getElementsByClassName
 *    (por classe), createElement, e captura do listener de DOMContentLoaded;
 *  - window com addEventListener;
 *  - LightRefStorage falso (config em memoria: readConfig retorna o objeto,
 *    writeConfig faz merge);
 *  - setInterval/clearInterval stubs com tick() manual.
 *
 * onboarding.js referencia LightRefStorage como global livre (nao
 * window.LightRefStorage), entao expomos LightRefStorage no sandbox e tambem em
 * window para seguranca. O harness e deterministico (sem relogio real).
 *
 * Expoe loadOnboarding(opts) -> {
 *   onboarding, doc, win, storage, ticks, elements, fireDOMContentLoaded()
 * }.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ONB_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'onboarding.js'),
  'utf8'
);

/* Fabrica de elementos DOM falsos. */
function makeFakeEl(tag) {
  var el = {
    tagName: (tag || 'div').toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    innerHTML: '',
    src: '',
    hidden: false,
    style: {},
    _attrs: {},
    _classes: {},
    _handlers: {},
    children: []
  };

  function syncClassNameToSet() {
    el._classes = {};
    String(el.className || '').split(/\s+/).forEach(function (c) {
      if (c) el._classes[c] = true;
    });
  }
  function syncSetToClassName() {
    var out = [];
    for (var k in el._classes) {
      if (Object.prototype.hasOwnProperty.call(el._classes, k) && el._classes[k]) {
        out.push(k);
      }
    }
    el.className = out.join(' ');
  }

  el.classList = {
    add: function (c) { syncClassNameToSet(); el._classes[c] = true; syncSetToClassName(); },
    remove: function (c) { syncClassNameToSet(); delete el._classes[c]; syncSetToClassName(); },
    toggle: function (c, force) {
      syncClassNameToSet();
      var want = (arguments.length > 1) ? !!force : !el._classes[c];
      if (want) el._classes[c] = true; else delete el._classes[c];
      syncSetToClassName();
      return want;
    },
    contains: function (c) { syncClassNameToSet(); return !!el._classes[c]; }
  };

  el.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(el._attrs, name) ? el._attrs[name] : null;
  };
  el.setAttribute = function (name, val) { el._attrs[name] = String(val); };
  el.hasAttribute = function (name) { return Object.prototype.hasOwnProperty.call(el._attrs, name); };
  el.removeAttribute = function (name) { delete el._attrs[name]; };

  el.appendChild = function (child) {
    el.children.push(child);
    if (el._onAppend) el._onAppend(child);
    return child;
  };

  el.addEventListener = function (type, fn) {
    (el._handlers[type] = el._handlers[type] || []).push(fn);
  };
  el.fire = function (type) {
    var list = el._handlers[type] || [];
    for (var i = 0; i < list.length; i++) list[i].call(el, { type: type });
  };
  el.click = function () { el.fire('click'); };

  el.querySelector = function (sel) {
    // Minimo: busca em filhos por classe (.foo) ou id (#foo).
    for (var i = 0; i < el.children.length; i++) {
      var ch = el.children[i];
      if (sel.charAt(0) === '.' && ch.classList.contains(sel.slice(1))) return ch;
      if (sel.charAt(0) === '#' && ch.id === sel.slice(1)) return ch;
    }
    return null;
  };
  el.querySelectorAll = function () { return []; };

  return el;
}

/*
 * loadOnboarding(opts)
 *   opts.config  config inicial de LightRefStorage (default {} => wizard mostra)
 */
function loadOnboarding(opts) {
  opts = opts || {};

  var byId = {};
  var byClass = {}; // classe -> array de elementos

  function registerClass(el, cls) {
    (byClass[cls] = byClass[cls] || []).push(el);
  }

  function makeAndRegister(id, classes) {
    var el = makeFakeEl();
    el.id = id;
    if (classes) {
      el.className = classes;
      classes.split(/\s+/).forEach(function (c) { if (c) registerClass(el, c); });
    }
    byId[id] = el;
    return el;
  }

  // Ids que onboarding.js consulta.
  makeAndRegister('onboarding-modal');
  makeAndRegister('onboard-title');
  makeAndRegister('xuim-speech-bubble');
  var avatar = makeAndRegister('xuim-avatar-img');
  avatar.src = 'img/xuim_falando_normal.png';

  // Dots container: appendChild registra os dots criados por id.
  var stepDots = makeAndRegister('step-dots');
  stepDots._onAppend = function (child) {
    if (child && child.id) byId[child.id] = child;
  };

  // Passos 0..5.
  for (var s = 0; s < 6; s++) makeAndRegister('onboard-step-' + s);

  // Nav + mascote.
  makeAndRegister('onboard-prev', 'lr04-ob-btn lang-back');
  makeAndRegister('onboard-next', 'lr04-ob-btn lr04-ob-primary lang-next');
  makeAndRegister('onboard-finish', 'lr04-ob-btn lr04-ob-primary lang-start');
  makeAndRegister('onboard-close');
  makeAndRegister('btn-help');

  // Cards de idioma (passo 0): pt e en, classe lang-card + data-lang.
  var cardPt = makeAndRegister('lang-card-pt', 'lang-card');
  cardPt.setAttribute('data-lang', 'pt');
  var cardEn = makeAndRegister('lang-card-en', 'lang-card');
  cardEn.setAttribute('data-lang', 'en');

  // Feature boxes 1..5: classe lang-ob-N.
  for (var f = 1; f <= 5; f++) makeAndRegister('onboard-feature-' + f, 'onboard-feature-box lang-ob-' + f);

  var dcl = []; // listeners de DOMContentLoaded

  var fakeDocument = {
    getElementById: function (id) { return byId[id] || null; },
    getElementsByClassName: function (name) { return byClass[name] ? byClass[name].slice() : []; },
    querySelector: function (sel) {
      if (sel.charAt(0) === '#') return byId[sel.slice(1)] || null;
      if (sel.charAt(0) === '.') { var a = byClass[sel.slice(1)]; return (a && a[0]) || null; }
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel.charAt(0) === '.') return byClass[sel.slice(1)] ? byClass[sel.slice(1)].slice() : [];
      return [];
    },
    createElement: function (tag) { return makeFakeEl(tag); },
    addEventListener: function (type, fn) {
      if (type === 'DOMContentLoaded') dcl.push(fn);
    }
  };

  // LightRefStorage falso (config em memoria).
  var cfg = opts.config ? JSON.parse(JSON.stringify(opts.config)) : {};
  var storage = {
    readConfig: function () { return JSON.parse(JSON.stringify(cfg)); },
    writeConfig: function (patch) {
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) cfg[k] = patch[k];
      }
      storage.lastWrite = JSON.parse(JSON.stringify(patch));
      storage.writeCount = (storage.writeCount || 0) + 1;
      return cfg;
    },
    _config: function () { return cfg; },
    lastWrite: null,
    writeCount: 0
  };

  // Intervalos controlaveis manualmente.
  var ticks = {
    callbacks: {},
    nextId: 1,
    cleared: [],
    setInterval: function (fn) {
      var id = ticks.nextId++;
      ticks.callbacks[id] = fn;
      ticks.lastId = id;
      return id;
    },
    clearInterval: function (id) {
      if (ticks.callbacks[id]) { delete ticks.callbacks[id]; ticks.cleared.push(id); }
    },
    tick: function () {
      for (var id in ticks.callbacks) {
        if (Object.prototype.hasOwnProperty.call(ticks.callbacks, id)) ticks.callbacks[id]();
      }
    },
    active: function () {
      var n = 0;
      for (var id in ticks.callbacks) {
        if (Object.prototype.hasOwnProperty.call(ticks.callbacks, id)) n++;
      }
      return n;
    }
  };

  var fakeWindow = {
    addEventListener: function () {},
    LightRefStorage: storage
  };

  var sandbox = {
    window: fakeWindow,
    document: fakeDocument,
    LightRefStorage: storage,
    setInterval: ticks.setInterval,
    clearInterval: ticks.clearInterval,
    JSON: JSON,
    Date: Date,
    Math: Math,
    console: console
  };
  sandbox.self = fakeWindow;

  vm.createContext(sandbox);
  vm.runInContext(ONB_SRC, sandbox, { filename: 'onboarding.js' });

  var onboarding = fakeWindow.LightRefOnboarding;
  if (!onboarding ||
    typeof onboarding.maybeShow !== 'function' ||
    typeof onboarding.open !== 'function' ||
    typeof onboarding.onLanguageChosen !== 'function') {
    throw new Error('onboarding.js nao publicou window.LightRefOnboarding (maybeShow/open/onLanguageChosen)');
  }

  function fireDOMContentLoaded() {
    for (var i = 0; i < dcl.length; i++) dcl[i].call(fakeDocument, { type: 'DOMContentLoaded' });
  }

  return {
    onboarding: onboarding,
    doc: fakeDocument,
    win: fakeWindow,
    storage: storage,
    ticks: ticks,
    elements: byId,
    byClass: byClass,
    fireDOMContentLoaded: fireDOMContentLoaded
  };
}

module.exports = {
  loadOnboarding: loadOnboarding,
  makeFakeEl: makeFakeEl
};
