/*
 * Property 10: Deteccao de sessao por token.
 * Validates: Requirements 13.1, 13.2, 13.3
 *
 * Feature: update-button-wizard-and-session, Property 10: usando
 * LightRefSession.shouldRestore, restauramos SSE o token salvo no arquivo e
 * igual ao token vivo (nao-vazio) E o arquivo e um objeto valido. Token vivo
 * ausente/vazio, tokens diferentes, ou arquivo nao-objeto/ausente -> nao
 * restaura (Estado_Inicial).
 *
 * Exercita o codigo de producao real: shouldRestore vem de
 * window.LightRefSession, carregado via tests/loadSession.js (vm, sem browser).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadSessionModule } = require('./loadSession');

const { session } = loadSessionModule();

function run() {
  const nonEmptyToken = fc.string({ minLength: 1, maxLength: 24 });

  // 1) Tokens iguais nao-vazios + arquivo objeto => restaura.
  fc.assert(
    fc.property(nonEmptyToken, fc.object(), function (tok, extra) {
      const fileObj = {};
      for (const k in extra) if (extra.hasOwnProperty(k)) fileObj[k] = extra[k];
      fileObj.sessionToken = tok;
      assert.strictEqual(session.shouldRestore(fileObj, tok), true,
        'token igual + objeto deveria restaurar');
    }),
    { numRuns: 150 }
  );

  // 2) Tokens diferentes => nao restaura.
  fc.assert(
    fc.property(nonEmptyToken, nonEmptyToken, function (saved, live) {
      fc.pre(saved !== live);
      assert.strictEqual(session.shouldRestore({ sessionToken: saved }, live), false,
        'tokens diferentes nao deveriam restaurar');
    }),
    { numRuns: 150 }
  );

  // 3) Token vivo null/'' (ou nao-string) => nao restaura, qualquer arquivo.
  fc.assert(
    fc.property(fc.option(fc.string(), { nil: null }), function (saved) {
      const bad = [null, '', undefined, 0, 123, true, {}, []];
      for (let i = 0; i < bad.length; i++) {
        assert.strictEqual(session.shouldRestore({ sessionToken: saved }, bad[i]), false,
          'token vivo invalido nao deveria restaurar: ' + String(bad[i]));
      }
    }),
    { numRuns: 100 }
  );

  // 4) Arquivo nao-objeto/ausente => nao restaura (mesmo com token vivo valido).
  fc.assert(
    fc.property(nonEmptyToken, function (tok) {
      const bad = [null, undefined, 42, 'x', true, [], [1, 2], NaN];
      for (let i = 0; i < bad.length; i++) {
        assert.strictEqual(session.shouldRestore(bad[i], tok), false,
          'arquivo nao-objeto nao deveria restaurar: ' + String(bad[i]));
      }
    }),
    { numRuns: 100 }
  );

  // 5) Propriedade combinada (bicondicional): restaura SSE condicoes acima.
  const tokenOrNil = fc.option(fc.string({ maxLength: 10 }), { nil: null });
  const fileArb = fc.oneof(
    fc.record({ sessionToken: tokenOrNil }),
    fc.option(fc.record({ sessionToken: tokenOrNil }), { nil: null }),
    fc.constant(42),
    fc.constant('x'),
    fc.array(fc.anything(), { maxLength: 2 })
  );
  fc.assert(
    fc.property(fileArb, tokenOrNil, function (fileObj, liveToken) {
      const expected =
        (typeof liveToken === 'string' && liveToken !== '') &&
        (fileObj != null && typeof fileObj === 'object' && !Array.isArray(fileObj)) &&
        (fileObj.sessionToken === liveToken);
      assert.strictEqual(session.shouldRestore(fileObj, liveToken), expected,
        'bicondicional de restauracao divergiu');
    }),
    { numRuns: 300 }
  );

  console.log('Feature: update-button-wizard-and-session, Property 10: Deteccao de sessao por token : OK');
}

run();
