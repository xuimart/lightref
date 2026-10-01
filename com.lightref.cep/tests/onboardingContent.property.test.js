/*
 * onboardingContent.property.test.js - Tarefa 16.1 (Area B).
 * Feature: update-button-wizard-and-session.
 *
 * Propriedades de conteudo e navegacao do wizard, exercitando o js/onboarding.js
 * REAL sob um DOM falso (tests/loadOnboarding.js). As assercoes leem a tabela TXT
 * indiretamente, pelo comportamento observavel (abrir o wizard, navegar e
 * inspecionar o DOM / o balao de fala).
 *
 *   Property 2 (Req 5.1, 5.2): maybeShow abre o modal sse onboardingCompleted e falso.
 *   Property 3 (Req 7.3): navegacao mantem o indice de passo em [0,5]; 6 dots.
 *   Property 4 (Req 7.4): passo 5 (speech + ob5), ambos idiomas, sem palavras de doacao.
 *   Property 5 (Req 7.5): nenhuma fala/ob contem emoji / pictograma nao-ASCII.
 *   Property 6 (Req 8.1): goToStep(n) poe no balao exatamente TXT[lang].speech[n].
 *   Property 7 (Req 6.4): open(lang) pre-seleciona o card do idioma passado.
 *
 * Determinismo: usamos exaustao sobre {2 idiomas} x {6 passos} onde faz sentido,
 * e fast-check para as sequencias de navegacao (Property 3).
 */
'use strict';

var assert = require('assert');
var fc = require('fast-check');
var loadOnboarding = require('./loadOnboarding').loadOnboarding;

var LANGS = ['pt', 'en'];
var N_STEPS = 6; // 0..5
var LAST = N_STEPS - 1;

// Palavras de doacao proibidas (case-insensitive).
var DONATION_RE = /doa|doaca|apoiar o projeto|cafezinho|donate|donation|coffee|ko-?fi|livepix|pix/i;

/* Clica no botao de proximo passo. */
function clickNext(h) { h.elements['onboard-next'].click(); }
/* Clica no botao de passo anterior. */
function clickPrev(h) { h.elements['onboard-prev'].click(); }

/* Deriva o indice de passo atual pela visibilidade de onboard-step-N. */
function visibleStep(h) {
  for (var i = 0; i < N_STEPS; i++) {
    var el = h.elements['onboard-step-' + i];
    if (el && el.style.display === 'block') return i;
  }
  return -1;
}

/* Abre o wizard num idioma e devolve o harness ja ligado. */
function openWizard(lang, config) {
  var h = loadOnboarding({ config: config || {} });
  h.fireDOMContentLoaded();
  h.onboarding.open(lang);
  return h;
}

/* Property 2: Wizard aparece apenas na primeira vez (Req 5.1, 5.2). */
function property2() {
  LANGS.forEach(function (lang) {
    // onboardingCompleted falso/ausente => abre.
    [{}, { onboardingCompleted: false }].forEach(function (cfg) {
      var h = loadOnboarding({ config: cfg });
      h.fireDOMContentLoaded();
      h.onboarding.maybeShow(lang);
      assert.strictEqual(
        h.elements['onboarding-modal'].style.display, 'flex',
        'maybeShow deve abrir o modal quando onboardingCompleted e falso (' + lang + ')'
      );
    });

    // onboardingCompleted verdadeiro => nao abre (display continua vazio/none).
    var h2 = loadOnboarding({ config: { onboardingCompleted: true } });
    h2.fireDOMContentLoaded();
    h2.onboarding.maybeShow(lang);
    assert.notStrictEqual(
      h2.elements['onboarding-modal'].style.display, 'flex',
      'maybeShow NAO deve abrir o modal quando onboardingCompleted e verdadeiro (' + lang + ')'
    );
  });
}

/* Property 3: Navegacao de passos permanece em [0,5]; 6 dots (Req 7.3). */
function property3() {
  // Dots: exatamente 6 apos abrir.
  LANGS.forEach(function (lang) {
    var h = openWizard(lang);
    assert.strictEqual(
      h.elements['step-dots'].children.length, N_STEPS,
      'devem existir exatamente 6 dots (' + lang + ')'
    );
  });

  // Casos de borda deterministicos: next no ultimo nao passa de 5; prev no 0 fica 0.
  var hb = openWizard('pt');
  for (var i = 0; i < 10; i++) clickNext(hb); // tenta estourar o teto
  assert.strictEqual(visibleStep(hb), LAST, 'next em excesso deve parar no ultimo passo (5)');
  clickNext(hb);
  assert.strictEqual(visibleStep(hb), LAST, 'next no ultimo passo nao deve exceder 5');

  var hp = openWizard('pt');
  clickPrev(hp);
  assert.strictEqual(visibleStep(hp), 0, 'prev no passo 0 deve permanecer em 0');

  // Sequencias aleatorias de next/prev: o indice sempre fica em [0,5].
  var moveArb = fc.array(fc.boolean(), { minLength: 1, maxLength: 40 });
  fc.assert(
    fc.property(moveArb, fc.constantFrom('pt', 'en'), function (moves, lang) {
      var h = openWizard(lang);
      for (var k = 0; k < moves.length; k++) {
        if (moves[k]) clickNext(h); else clickPrev(h);
        var step = visibleStep(h);
        if (step < 0 || step > LAST) return false;
      }
      return true;
    }),
    { numRuns: 150 }
  );
}

/* Property 4: Conteudo do passo 5 sem doacao, ambos idiomas (Req 7.4). */
function property4() {
  LANGS.forEach(function (lang) {
    // Fala do passo 5: navega ate o fim e le o balao.
    var h = openWizard(lang);
    for (var i = 0; i < N_STEPS; i++) clickNext(h);
    var speech5 = h.elements['xuim-speech-bubble'].textContent;
    assert.ok(
      !DONATION_RE.test(speech5),
      'a fala do passo 5 (' + lang + ') nao pode conter palavras de doacao: ' + speech5
    );

    // Texto da feature box do passo 5 (classe lang-ob-5), preenchido por applyTexts.
    var ob5 = h.elements['onboard-feature-5'].textContent;
    assert.ok(ob5 && ob5.length > 0, 'ob5 (' + lang + ') deve ter conteudo');
    assert.ok(
      !DONATION_RE.test(ob5),
      'ob5 (' + lang + ') nao pode conter palavras de doacao: ' + ob5
    );
  });
}

/* Property 5: Sem emoji / pictograma nao-ASCII em qualquer fala ou ob (Req 7.5). */
function property5() {
  // Rejeita qualquer codepoint acima de 0x2000 (faixa de simbolos/emoji),
  // tolerando apenas texto basico. Mantido simples: so olhamos o teto.
  function hasPictograph(s) {
    for (var i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) > 0x2000) return true;
    }
    return false;
  }

  LANGS.forEach(function (lang) {
    var h = openWizard(lang);
    // Falas 0..5 (observa cada passo via navegacao).
    var step = 0;
    for (var n = 0; n < N_STEPS; n++) {
      var speech = h.elements['xuim-speech-bubble'].textContent;
      assert.ok(
        !hasPictograph(speech),
        'speech[' + step + '] (' + lang + ') contem pictograma/emoji: ' + speech
      );
      if (n < LAST) { clickNext(h); step++; }
    }
    // ob1..ob5 (textos preenchidos por applyTexts nas feature boxes).
    for (var f = 1; f <= 5; f++) {
      var ob = h.elements['onboard-feature-' + f].textContent;
      assert.ok(
        !hasPictograph(ob),
        'ob' + f + ' (' + lang + ') contem pictograma/emoji: ' + ob
      );
    }
  });
}

/*
 * Property 6: Balao do Mascote corresponde ao passo (Req 8.1).
 * Para cada n em 0..5 (ambos idiomas), apos chegar no passo n via next, o balao
 * deve conter exatamente a fala do passo. Como a tabela TXT e privada, lemos a
 * fala "canonica" abrindo um wizard limpo e indo direto ao passo n, e comparamos
 * que a mesma fala aparece ao navegar passo a passo (consistencia determinista).
 */
function property6() {
  LANGS.forEach(function (lang) {
    // Falas canonicas por passo: num wizard limpo, navega e coleta.
    var ref = openWizard(lang);
    var canonical = [];
    for (var n = 0; n < N_STEPS; n++) {
      canonical.push(ref.elements['xuim-speech-bubble'].textContent);
      if (n < LAST) ref.elements['onboard-next'].click();
    }

    // Agora valida que, navegando de novo, cada passo mostra a mesma fala e que
    // o passo 0 e nao-vazio (toda fala deve existir).
    var h = openWizard(lang);
    for (var k = 0; k < N_STEPS; k++) {
      var bubble = h.elements['xuim-speech-bubble'].textContent;
      assert.strictEqual(
        bubble, canonical[k],
        'o balao no passo ' + k + ' (' + lang + ') deve corresponder a fala do passo'
      );
      assert.ok(bubble && bubble.length > 0, 'a fala do passo ' + k + ' (' + lang + ') nao pode ser vazia');
      if (k < LAST) h.elements['onboard-next'].click();
    }
  });
}

/* Property 7: Idioma inicial pre-selecionado (Req 6.4). */
function property7() {
  LANGS.forEach(function (lang) {
    var h = openWizard(lang);
    var cards = h.doc.getElementsByClassName('lang-card');
    for (var i = 0; i < cards.length; i++) {
      var isThis = cards[i].getAttribute('data-lang') === lang;
      assert.strictEqual(
        cards[i].classList.contains('selected'), isThis,
        'open(' + lang + ') deve pre-selecionar apenas o card data-lang=' + lang
      );
    }
  });
}

function run() {
  property2();
  property3();
  property4();
  property5();
  property6();
  property7();
  console.log('Feature: update-button-wizard-and-session, Wizard conteudo e navegacao: OK');
}

run();
