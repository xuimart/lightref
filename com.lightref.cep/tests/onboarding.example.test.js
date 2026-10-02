/*
 * onboarding.example.test.js - Tarefa 16.2 (Area B).
 * Feature: update-button-wizard-and-session.
 *
 * Testes de exemplo do js/onboarding.js REAL sob o DOM falso de
 * tests/loadOnboarding.js:
 *   - finish e close gravam writeConfig({onboardingCompleted:true, language}) (5.3, 5.4)
 *   - fechar encerra a animacao de fala (intervalo limpo) (5.5)
 *   - clicar num lang-card dispara onLanguageChosen e atualiza textos (6.2)
 *   - open abre mesmo com onboardingCompleted true (9.2); reabrir+fechar mantem true (9.3)
 *   - dois ticks alternam a imagem do avatar entre os dois srcs conhecidos (8.2)
 *   - passo 0 contem exatamente os cards pt e en (6.1)
 *   - ob1..ob5 cobrem os recursos reais (nao-vazios; luz/light e cena/scene) (7.1)
 */
'use strict';

var assert = require('assert');
var loadOnboarding = require('./loadOnboarding').loadOnboarding;

var SRC_NORMAL = 'img/xuim_falando_normal.png';
var SRC_CLOSED = 'img/xuim_falandoolhosfechados.png';

/* Abre o wizard num idioma e devolve o harness ja ligado. */
function openWizard(lang, config) {
  var h = loadOnboarding({ config: config || {} });
  h.fireDOMContentLoaded();
  h.onboarding.open(lang);
  return h;
}

/* finish grava onboardingCompleted:true + idioma (5.3). */
function testFinishWritesConfig() {
  var h = openWizard('en');
  h.elements['onboard-finish'].click();
  assert.ok(h.storage.lastWrite, 'finish deve chamar writeConfig');
  assert.strictEqual(h.storage.lastWrite.onboardingCompleted, true, 'finish deve gravar onboardingCompleted:true');
  assert.strictEqual(h.storage.lastWrite.language, 'en', 'finish deve gravar o idioma escolhido (en)');
}

/* close grava onboardingCompleted:true + idioma (5.4). */
function testCloseWritesConfig() {
  var h = openWizard('pt');
  h.elements['onboard-close'].click();
  assert.ok(h.storage.lastWrite, 'close deve chamar writeConfig');
  assert.strictEqual(h.storage.lastWrite.onboardingCompleted, true, 'close deve gravar onboardingCompleted:true');
  assert.strictEqual(h.storage.lastWrite.language, 'pt', 'close deve gravar o idioma atual (pt)');
}

/* Fechar encerra a animacao: o intervalo e limpo e o tick nao troca mais o src (5.5). */
function testCloseStopsTalk() {
  var h = openWizard('pt');
  assert.strictEqual(h.ticks.active(), 1, 'abrir deve iniciar um intervalo de fala');

  h.elements['onboard-close'].click();
  assert.strictEqual(h.ticks.active(), 0, 'fechar deve limpar o intervalo de fala');
  assert.ok(h.ticks.cleared.length >= 1, 'clearInterval deve ter sido chamado ao fechar');

  // Apos fechar, stopTalk restaura o src normal; ticar nao deve mais troca-lo.
  var before = h.elements['xuim-avatar-img'].src;
  h.ticks.tick();
  assert.strictEqual(
    h.elements['xuim-avatar-img'].src, before,
    'apos fechar, ticar nao deve mais alternar a imagem do avatar'
  );
}

/* Clicar num card dispara onLanguageChosen e atualiza textos (6.2). */
function testLangCardFiresCallback() {
  var h = openWizard('pt');
  var chosen = [];
  h.onboarding.onLanguageChosen(function (l) { chosen.push(l); });

  // Textos em pt antes.
  var titleBefore = h.elements['onboard-title'].textContent;

  // Clica no card EN.
  h.elements['lang-card-en'].click();
  assert.deepStrictEqual(chosen, ['en'], 'clicar no card EN deve disparar onLanguageChosen com "en"');

  // O card EN fica selecionado e os textos trocam para en (titulo muda).
  assert.ok(h.elements['lang-card-en'].classList.contains('selected'), 'card EN deve ficar selecionado');
  var titleAfter = h.elements['onboard-title'].textContent;
  assert.notStrictEqual(titleAfter, titleBefore, 'os textos devem ser atualizados ao escolher outro idioma');
}

/* open abre mesmo com onboardingCompleted true (9.2); reabrir+fechar mantem true (9.3). */
function testReopenKeepsCompleted() {
  var h = loadOnboarding({ config: { onboardingCompleted: true, language: 'pt' } });
  h.fireDOMContentLoaded();

  // open abre independentemente de onboardingCompleted.
  h.onboarding.open('pt');
  assert.strictEqual(h.elements['onboarding-modal'].style.display, 'flex', 'open deve abrir mesmo com onboardingCompleted true (9.2)');

  // Fechar mantem onboardingCompleted true.
  h.elements['onboard-close'].click();
  assert.strictEqual(h.storage._config().onboardingCompleted, true, 'reabrir+fechar deve manter onboardingCompleted true (9.3)');
}

/* Dois ticks alternam a imagem do avatar entre os dois srcs conhecidos (8.2). */
function testTicksSwapAvatar() {
  var h = openWizard('pt');
  var img = h.elements['xuim-avatar-img'];
  assert.strictEqual(img.src, SRC_NORMAL, 'ao abrir, o avatar comeca na imagem normal');

  h.ticks.tick();
  assert.strictEqual(img.src, SRC_CLOSED, 'primeiro tick deve trocar para a imagem de olhos fechados');

  h.ticks.tick();
  assert.strictEqual(img.src, SRC_NORMAL, 'segundo tick deve voltar para a imagem normal');
}

/* Passo 0 contem exatamente os cards pt e en (6.1). */
function testStep0HasLangCards() {
  var h = openWizard('pt');
  var cards = h.doc.getElementsByClassName('lang-card');
  assert.strictEqual(cards.length, 2, 'o passo 0 deve ter exatamente 2 cards de idioma');
  var langs = [cards[0].getAttribute('data-lang'), cards[1].getAttribute('data-lang')].sort();
  assert.deepStrictEqual(langs, ['en', 'pt'], 'os cards devem ser pt e en');
}

/* ob1..ob5 cobrem os recursos reais, ambos idiomas (7.1). */
function testFeatureTexts() {
  ['pt', 'en'].forEach(function (lang) {
    var h = openWizard(lang);
    var all = [];
    for (var f = 1; f <= 5; f++) {
      var txt = h.elements['onboard-feature-' + f].textContent;
      assert.ok(txt && txt.length > 0, 'ob' + f + ' (' + lang + ') deve ser nao-vazio');
      all.push(txt.toLowerCase());
    }
    var joined = all.join(' ');
    var lightWord = (lang === 'pt') ? 'luz' : 'light';
    var sceneWord = (lang === 'pt') ? 'cena' : 'scene';
    assert.ok(joined.indexOf(lightWord) !== -1, 'os textos (' + lang + ') devem mencionar ' + lightWord);
    assert.ok(joined.indexOf(sceneWord) !== -1, 'os textos (' + lang + ') devem mencionar ' + sceneWord);
  });
}

function run() {
  testFinishWritesConfig();
  testCloseWritesConfig();
  testCloseStopsTalk();
  testLangCardFiresCallback();
  testReopenKeepsCompleted();
  testTicksSwapAvatar();
  testStep0HasLangCards();
  testFeatureTexts();
  console.log('Feature: update-button-wizard-and-session, Onboarding exemplos: OK');
}

run();
