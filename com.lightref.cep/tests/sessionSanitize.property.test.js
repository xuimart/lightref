/*
 * Property 13: Sanitizacao tolerante do Estado_da_Sessao.
 * Validates: Requirements 15.1, 15.4
 *
 * Feature: update-button-wizard-and-session, Property 13: Para qualquer conteudo
 * lido como Estado_da_Sessao (JSON invalido, objeto com campos ausentes, tipos
 * errados ou numeros nao finitos), a sanitizacao produz ou um Estado_da_Sessao
 * valido - usando o Estado_Inicial como fallback por campo e preservando os
 * campos validos - ou null (que leva ao Estado_Inicial), e nunca lanca.
 *
 * Exercita o codigo de producao real: sanitizeSessionState vem de
 * window.__lrStateApi, carregado via o harness tests/loadSession.js (que reusa
 * loadPanelState e envolve makeFakeScene com camera/selecao).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadSessionApi, makeInitialSessionState, arb } = require('./loadSession');

const api = loadSessionApi();
const initial = makeInitialSessionState();

// Verifica recursivamente que nenhum numero no objeto e nao-finito (NaN/Inf).
function assertAllNumbersFinite(obj, path) {
  path = path || 'root';
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') {
    assert.ok(isFinite(obj), 'numero nao finito em ' + path + ': ' + obj);
    return;
  }
  if (typeof obj !== 'object') return;
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    for (var i = 0; i < obj.length; i++) assertAllNumbersFinite(obj[i], path + '[' + i + ']');
    return;
  }
  for (var k in obj) if (obj.hasOwnProperty(k)) assertAllNumbersFinite(obj[k], path + '.' + k);
}

function run() {
  // --- Casos diretos: nao-objeto e sv errado -> null -----------------------
  var nonObjects = [null, undefined, 42, 'x', true, NaN, Infinity, [], ['a']];
  for (var i = 0; i < nonObjects.length; i++) {
    assert.strictEqual(api.sanitizeSessionState(nonObjects[i], initial), null,
      'nao-objeto deveria sanitizar para null: ' + String(nonObjects[i]));
  }
  assert.strictEqual(api.sanitizeSessionState({ sv: 2, scene: {}, ui: {} }, initial), null,
    'sv !== 3 deveria sanitizar para null');
  assert.strictEqual(api.sanitizeSessionState({ scene: {} }, initial), null,
    'sv ausente deveria sanitizar para null');

  // --- Propriedade: raw com sv:3 e lixo arbitrario -------------------------
  fc.assert(
    fc.property(arb.noisySessionArb, function (raw) {
      var out;
      // 1) nunca lanca.
      assert.doesNotThrow(function () { out = api.sanitizeSessionState(raw, initial); },
        'sanitizeSessionState lancou excecao');

      // sv:3 valido => resultado nao-null (nunca descartamos um raw com sv:3).
      assert.ok(out && typeof out === 'object', 'raw com sv:3 deveria produzir objeto');
      assert.strictEqual(out.sv, 3, 'sv deveria permanecer 3');

      // 2) todo numero no resultado e finito.
      assertAllNumbersFinite(out, 'result');

      // 3) campos invalidos caem no Estado_Inicial; validos sao preservados.
      // scaleMult: numero finito do raw.scene, senao o do initial.
      var rs = (raw.scene && typeof raw.scene === 'object' && !Array.isArray(raw.scene)) ? raw.scene : {};
      if (typeof rs.scaleMult === 'number' && isFinite(rs.scaleMult)) {
        assert.strictEqual(out.scene.scaleMult, rs.scaleMult, 'scaleMult valido preservado');
      } else {
        assert.strictEqual(out.scene.scaleMult, initial.scene.scaleMult, 'scaleMult invalido -> initial');
      }
      // projection: string do raw, senao initial.
      if (typeof rs.projection === 'string') {
        assert.strictEqual(out.scene.projection, rs.projection, 'projection valida preservada');
      } else {
        assert.strictEqual(out.scene.projection, initial.scene.projection, 'projection invalida -> initial');
      }
      // hdrBackground: boolean coerido.
      if (typeof raw.hdrBackground === 'boolean') {
        assert.strictEqual(out.hdrBackground, raw.hdrBackground, 'hdrBackground valido preservado');
      }
      assert.strictEqual(typeof out.hdrBackground, 'boolean', 'hdrBackground sempre boolean');

      // ui.page: string do raw.ui, senao initial.
      var ru = (raw.ui && typeof raw.ui === 'object' && !Array.isArray(raw.ui)) ? raw.ui : {};
      if (typeof ru.page === 'string') {
        assert.strictEqual(out.ui.page, ru.page, 'ui.page valida preservada');
      } else {
        assert.strictEqual(out.ui.page, initial.ui.page, 'ui.page invalida -> initial');
      }
      // ui booleans sempre boolean.
      var uiBools = ['floor', 'guides', 'reference', 'collapsed', 'materialOpen', 'envDrawerOpen'];
      for (var b = 0; b < uiBools.length; b++) {
        assert.strictEqual(typeof out.ui[uiBools[b]], 'boolean', 'ui.' + uiBools[b] + ' deveria ser boolean');
      }

      // selectedLight: inteiro >= 0 ou null.
      if (out.selectedLight !== null) {
        assert.ok(typeof out.selectedLight === 'number' && isFinite(out.selectedLight) &&
          Math.floor(out.selectedLight) === out.selectedLight && out.selectedLight >= 0,
          'selectedLight deveria ser inteiro >= 0 ou null');
      }

      // 4) comprimento do array de luzes: o do raw.scene.lights quando valido,
      //    senao o do initial (sem duplicar).
      if (Array.isArray(rs.lights)) {
        var validCount = 0;
        for (var li = 0; li < rs.lights.length; li++) {
          var l = rs.lights[li];
          if (l && typeof l === 'object' && !Array.isArray(l)) validCount++;
        }
        assert.strictEqual(out.scene.lights.length, validCount,
          'lights.length deveria ser o numero de luzes-objeto validas do raw');
      } else {
        assert.strictEqual(out.scene.lights.length, initial.scene.lights.length,
          'lights invalidas -> comprimento do initial (sem duplicar)');
      }
    }),
    { numRuns: 300 }
  );

  // --- Propriedade: Estado_da_Sessao ja valido sobrevive intacto -----------
  fc.assert(
    fc.property(arb.validSessionArb, function (valid) {
      var out = api.sanitizeSessionState(valid, initial);
      assert.ok(out && out.sv === 3, 'estado valido deveria sanitizar para objeto sv:3');
      assertAllNumbersFinite(out, 'validResult');
      assert.strictEqual(out.scene.lights.length, valid.scene.lights.length,
        'estado valido: numero de luzes preservado (sem duplicar)');
    }),
    { numRuns: 150 }
  );

  console.log('Feature: update-button-wizard-and-session, Property 13: Sanitizacao tolerante do Estado_da_Sessao : OK');
}

run();
