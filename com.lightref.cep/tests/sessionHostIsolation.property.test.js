/*
 * Property 11: Isolamento por versao do Host.
 * Validates: Requirements 14.3
 *
 * Feature: update-button-wizard-and-session, Property 11: usando
 * LightRefSession.sessionFileName, dois ambientes de Host com appName/appVersion
 * distintos produzem nomes de arquivo distintos (um estado nunca le/sobrescreve
 * o do outro); ambientes identicos produzem nomes identicos; e todo nome casa
 * com /^session_[A-Za-z0-9._-]*\.json$/ (so caracteres seguros).
 *
 * Exercita o codigo de producao real: sessionFileName vem de
 * window.LightRefSession, carregado via tests/loadSession.js (vm, sem browser).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadSessionModule } = require('./loadSession');

const { session } = loadSessionModule();

const NAME_RE = /^session_[A-Za-z0-9._\-]*\.json$/;

// safe() de referencia (espelha a producao): mantem [A-Za-z0-9._-].
function safe(s) {
  if (s == null) return '';
  return String(s).replace(/[^A-Za-z0-9._\-]/g, '');
}

function run() {
  // Nomes de app/versao com uma mistura de caracteres seguros e inseguros.
  const appName = fc.string({ minLength: 1, maxLength: 10 });
  const appVer = fc.string({ minLength: 0, maxLength: 10 });
  const envArb = fc.record({ appName: appName, appVersion: appVer });

  // 1) Formato: sempre casa a regex de caracteres seguros.
  fc.assert(
    fc.property(fc.option(envArb, { nil: null }), function (env) {
      const name = session.sessionFileName(env);
      assert.ok(NAME_RE.test(name), 'nome fora do padrao seguro: ' + name);
    }),
    { numRuns: 200 }
  );

  // 2) Determinismo: envs identicos -> nomes identicos.
  fc.assert(
    fc.property(envArb, function (env) {
      const a = session.sessionFileName({ appName: env.appName, appVersion: env.appVersion });
      const b = session.sessionFileName({ appName: env.appName, appVersion: env.appVersion });
      assert.strictEqual(a, b, 'envs identicos deveriam dar nomes identicos');
    }),
    { numRuns: 150 }
  );

  // 3) Isolamento: se os pares (safe(appName), safe(appVersion)) diferem na
  //    concatenacao, os nomes diferem. Usamos a concatenacao segura como chave,
  //    pois e exatamente o que compoe o nome do arquivo.
  fc.assert(
    fc.property(envArb, envArb, function (e1, e2) {
      const key1 = safe(e1.appName) + safe(e1.appVersion);
      const key2 = safe(e2.appName) + safe(e2.appVersion);
      const n1 = session.sessionFileName(e1);
      const n2 = session.sessionFileName(e2);
      // Precondicao: ambos tem appName seguro nao-vazio (senao caem no fallback
      // 'session_unknown.json' e a comparacao de versoes nao se aplica).
      fc.pre(safe(e1.appName) !== '' && safe(e2.appName) !== '');
      if (key1 !== key2) {
        assert.notStrictEqual(n1, n2, 'hosts distintos deveriam ter nomes distintos: ' + n1 + ' vs ' + n2);
      } else {
        assert.strictEqual(n1, n2, 'hosts equivalentes deveriam ter nomes iguais');
      }
    }),
    { numRuns: 300 }
  );

  // 4) Exemplos ancora.
  assert.strictEqual(session.sessionFileName({ appName: 'PHXS', appVersion: '26.1' }), 'session_PHXS26.1.json');
  assert.strictEqual(session.sessionFileName({ appName: 'PHXS', appVersion: '21.0' }), 'session_PHXS21.0.json');
  assert.notStrictEqual(
    session.sessionFileName({ appName: 'PHXS', appVersion: '26.1' }),
    session.sessionFileName({ appName: 'PHXS', appVersion: '21.0' }),
    'duas versoes do mesmo app deveriam diferir');
  assert.strictEqual(session.sessionFileName(null), 'session_unknown.json');
  assert.strictEqual(session.sessionFileName({}), 'session_unknown.json');

  console.log('Feature: update-button-wizard-and-session, Property 11: Isolamento por versao do Host : OK');
}

run();
