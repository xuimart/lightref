/*
 * Property 1: Decisao de atualizacao.
 * Validates: Requirements 2.2, 2.3, 4.2, 4.3
 *
 * Feature: update-button-wizard-and-session, Property 1: Decisao de
 * atualizacao. Exercita a funcao PURA decideUpdateOutcome(remote, installed,
 * manual) extraida de check() em js/update.js, carregada num sandbox vm sem
 * rede (o stub de require().get nunca dispara; so precisamos que o modulo
 * carregue e publique window.LightRefUpdate).
 *
 *   remote > installed  => 'banner'  (independe de manual)
 *   senao, manual===true => 'current'
 *   senao                => 'silent'
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const UPDATE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'update.js'),
  'utf8'
);

function loadUpdateModule() {
  const fakeWindow = {};
  const sandbox = {
    window: fakeWindow,
    require: function () {
      return {
        get: function () {
          return { on: function () {}, setTimeout: function () {}, destroy: function () {} };
        }
      };
    },
    JSON: JSON,
    Date: Date,
    Math: Math,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  // update.js e um IIFE que recebe `this`; em sloppy mode no vm, `this` ser o
  // objeto global do contexto. Fazemos window ser esse global para capturar
  // window.LightRefUpdate.
  vm.createContext(fakeWindow);
  fakeWindow.window = fakeWindow;
  fakeWindow.require = sandbox.require;
  fakeWindow.JSON = JSON;
  fakeWindow.Date = Date;
  fakeWindow.Math = Math;
  fakeWindow.console = console;
  fakeWindow.setTimeout = setTimeout;
  fakeWindow.clearTimeout = clearTimeout;
  vm.runInContext(UPDATE_SRC, fakeWindow, { filename: 'update.js' });

  const up = fakeWindow.LightRefUpdate;
  if (!up ||
    typeof up.decideUpdateOutcome !== 'function' ||
    typeof up.compareVersions !== 'function') {
    throw new Error('update.js nao publicou decideUpdateOutcome/compareVersions em window.LightRefUpdate');
  }
  return up;
}

const up = loadUpdateModule();
const decide = up.decideUpdateOutcome;
const cmp = up.compareVersions;

const seg = fc.integer({ min: 0, max: 9 });
const semver = fc.tuple(seg, seg, seg).map(function (t) {
  return t[0] + '.' + t[1] + '.' + t[2];
});

function run() {
  // Propriedade principal: oraculo via compareVersions.
  fc.assert(
    fc.property(semver, semver, fc.boolean(), function (remote, installed, manual) {
      const expected = (cmp(remote, installed) > 0)
        ? 'banner'
        : (manual ? 'current' : 'silent');
      assert.strictEqual(decide(remote, installed, manual), expected,
        'desfecho divergiu para remote=' + remote + ' installed=' + installed + ' manual=' + manual);
    }),
    { numRuns: 300 }
  );

  // remote estritamente maior => sempre 'banner', independe de manual.
  fc.assert(
    fc.property(semver, semver, fc.boolean(), function (a, b, manual) {
      fc.pre(cmp(a, b) > 0);
      assert.strictEqual(decide(a, b, manual), 'banner');
    }),
    { numRuns: 150 }
  );

  // remote <= installed => depende so de manual.
  fc.assert(
    fc.property(semver, semver, function (a, b) {
      fc.pre(cmp(a, b) <= 0);
      assert.strictEqual(decide(a, b, true), 'current');
      assert.strictEqual(decide(a, b, false), 'silent');
    }),
    { numRuns: 150 }
  );

  // remote ausente/falsy => nunca 'banner'.
  fc.assert(
    fc.property(fc.constantFrom(null, undefined, '', 0, false), semver, fc.boolean(),
      function (remote, installed, manual) {
        assert.strictEqual(decide(remote, installed, manual), manual ? 'current' : 'silent');
      }),
    { numRuns: 100 }
  );

  // Exemplos ancora.
  assert.strictEqual(decide('0.7.0', '0.6.0', false), 'banner');
  assert.strictEqual(decide('0.6.0', '0.6.0', true), 'current');
  assert.strictEqual(decide('0.6.0', '0.6.0', false), 'silent');
  assert.strictEqual(decide('0.5.0', '0.6.0', true), 'current');
  assert.strictEqual(decide(null, '0.6.0', true), 'current');

  console.log('Feature: update-button-wizard-and-session, Property 1: Decisao de atualizacao : OK');
}

run();
