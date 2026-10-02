/*
 * Property 12: Debounce de gravacao.
 * Validates: Requirements 14.6
 *
 * Feature: update-button-wizard-and-session, Property 12: dirigindo
 * LightRefSession.makeDebouncer com um relogio e timers FALSOS, para qualquer
 * sequencia de pedidos request() distribuidos ao longo de uma janela de t ms,
 * o numero de gravacoes efetivas e no maximo 1 + floor(t/300); e um flush()
 * final sempre persiste a ultima pendente.
 *
 * Exercita o codigo de producao real: makeDebouncer vem de
 * window.LightRefSession, carregado via tests/loadSession.js (vm, sem browser).
 */
'use strict';

const assert = require('assert');
const fc = require('fast-check');
const { loadSessionModule } = require('./loadSession');

const { session } = loadSessionModule();
const DELAY = 300;

/*
 * Relogio + agendador falsos. Timers tem um horario de disparo absoluto;
 * advance(dt) avanca o relogio e dispara os timers vencidos em ordem.
 */
function makeFakeClock() {
  let now = 0;
  let seq = 1;
  const timers = {}; // id -> { at, fn }

  function nowFn() { return now; }
  function setTimerFn(fn, ms) {
    const id = seq++;
    timers[id] = { at: now + ms, fn: fn };
    return id;
  }
  function clearTimerFn(id) { delete timers[id]; }

  function advance(dt) {
    const target = now + dt;
    // Dispara repetidamente enquanto houver timer vencido <= target.
    for (;;) {
      let nextId = null, nextAt = Infinity;
      for (const id in timers) {
        if (timers.hasOwnProperty(id) && timers[id].at <= target && timers[id].at < nextAt) {
          nextAt = timers[id].at; nextId = id;
        }
      }
      if (nextId === null) break;
      now = nextAt;
      const t = timers[nextId];
      delete timers[nextId];
      t.fn();
    }
    now = target;
  }

  return { nowFn: nowFn, setTimerFn: setTimerFn, clearTimerFn: clearTimerFn, advance: advance };
}

function run() {
  // offsets: pedidos em instantes nao-decrescentes dentro de [0, t].
  const burst = fc.record({
    span: fc.integer({ min: 0, max: 3000 }),
    offsets: fc.array(fc.integer({ min: 0, max: 3000 }), { minLength: 1, maxLength: 40 })
  });

  fc.assert(
    fc.property(burst, function (b) {
      const t = b.span;
      // normaliza offsets para [0, t], ordenado (nao-decrescente).
      const offs = b.offsets
        .map(function (o) { return t === 0 ? 0 : (o % (t + 1)); })
        .sort(function (a, c) { return a - c; });

      const clock = makeFakeClock();
      let writes = 0;
      let lastPersisted = null;

      const deb = session.makeDebouncer(DELAY, clock.nowFn, clock.setTimerFn, clock.clearTimerFn);

      let prev = 0;
      for (let i = 0; i < offs.length; i++) {
        clock.advance(offs[i] - prev);
        prev = offs[i];
        (function (seqVal) {
          deb.request(function () { writes++; lastPersisted = seqVal; });
        })(i);
      }
      // avanca ate o fim da janela de t ms a partir do ultimo offset.
      clock.advance(DELAY + 10);

      // numero de gravacoes efetivas <= 1 + floor(t/300).
      const maxWrites = 1 + Math.floor(t / DELAY);
      assert.ok(writes <= maxWrites,
        'writes=' + writes + ' > limite=' + maxWrites + ' (t=' + t + ')');
      // pelo menos uma gravacao ocorreu (houve ao menos um request).
      assert.ok(writes >= 1, 'deveria haver ao menos uma gravacao');
    }),
    { numRuns: 300 }
  );

  // flush() final sempre persiste a ultima pendente.
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 20 }), function (n) {
      const clock = makeFakeClock();
      let writes = 0, last = null;
      const deb = session.makeDebouncer(DELAY, clock.nowFn, clock.setTimerFn, clock.clearTimerFn);
      // n requests em rajada sem avancar o relogio (todos coalescem).
      for (let i = 0; i < n; i++) {
        (function (v) { deb.request(function () { writes++; last = v; }); })(i);
      }
      // antes do flush, nada escreveu (timer ainda nao venceu).
      assert.strictEqual(writes, 0, 'rajada sem avanco nao deveria escrever ainda');
      deb.flush();
      assert.strictEqual(writes, 1, 'flush deveria escrever exatamente uma vez');
      assert.strictEqual(last, n - 1, 'flush deveria persistir a ultima pendente');
      // flush extra sem pendente nao escreve.
      deb.flush();
      assert.strictEqual(writes, 1, 'flush sem pendente nao deveria escrever de novo');
    }),
    { numRuns: 100 }
  );

  console.log('Feature: update-button-wizard-and-session, Property 12: Debounce de gravacao : OK');
}

run();
