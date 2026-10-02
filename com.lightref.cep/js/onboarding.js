/*
 * onboarding.js - wizard de primeiro uso do LightRef (padrao Xuimart).
 *
 * Modal full-panel com o mascote Xuimzinho guiando o usuario. Aparece so na
 * primeira execucao (config.onboardingCompleted). Pode ser reaberto pelo botao
 * de ajuda no viewport.
 *
 * Expoe window.LightRefOnboarding.{ maybeShow, open, onLanguageChosen }.
 * O panel.js chama maybeShow() no boot e registra onLanguageChosen para aplicar
 * o idioma escolhido no step 0.
 *
 * ES5 puro.
 */
(function (global) {
    'use strict';

    var TOTAL_STEPS = 6; // 0..5
    var lang = 'pt';
    var currentStep = 0;
    var talkTimer = null;
    var onLangCb = null;

    // Textos por idioma. Cada step de feature tem um balao (mascote) e um corpo.
    var TXT = {
        pt: {
            title: 'Bem-vindo ao LightRef',
            back: 'Voltar', next: 'Proximo', start: 'Comecar!',
            speech: [
                'Oi! Eu sou o Xuimzinho. Em qual idioma prefere?',
                'O LightRef te ajuda a estudar luz e sombra em 3D. Vem que sao 4 passos rapidos!',
                'Escolha um modelo ou suba o seu. Arraste no visor pra girar e ver a forma.',
                'Adicione quantas luzes quiser. Cada uma tem direcao, altura, cor e intensidade.',
                'Em Ajustes voce estuda valores: posterize, cutout, preto e branco e mais.',
                'Pronto! Qualquer duvida, reabra este guia pelo botao de ajuda no visor. Bons estudos!'
            ],
            ob1: 'O LightRef monta uma cena 3D dentro do Photoshop pra voce ver como a luz esculpe a forma. Quando gostar, joga o resultado como uma camada no seu documento.',
            ob2: 'Aba Cena: escolha o modelo (ou importe o seu), gire com os sliders ou arrastando no visor, e troque o fundo (cor ou transparente).',
            ob3: 'Aba Luzes: clique em Adicionar para criar luzes. Ajuste direcao, altura, cor e intensidade. O olho liga/desliga; a lixeira remove.',
            ob4: 'Aba Ajustes: exposicao, contraste, temperatura e saturacao em tempo real, mais filtros de estudo (posterize, cutout, P&B) pra simplificar valores.',
            ob5: 'Voce esta pronto! Salve cenas com miniatura para reusar depois. Reabra este guia pelo botao de ajuda no visor.'
        },
        en: {
            title: 'Welcome to LightRef',
            back: 'Back', next: 'Next', start: 'Start!',
            speech: [
                'Hi! I am Xuimzinho. Which language do you prefer?',
                'LightRef helps you study light and shadow in 3D. Just 4 quick steps!',
                'Pick a model or upload yours. Drag in the viewport to spin and read the form.',
                'Add as many lights as you want. Each has direction, height, color and intensity.',
                'In Adjust you study values: posterize, cutout, black & white and more.',
                'All set! Reopen this guide anytime via the help button in the viewport. Happy studies!'
            ],
            ob1: 'LightRef builds a 3D scene inside Photoshop so you can see how light sculpts the form. When you like it, send the result as a layer into your document.',
            ob2: 'Scene tab: pick the model (or import yours), rotate with sliders or by dragging in the viewport, and change the background (color or transparent).',
            ob3: 'Lights tab: click Add to create lights. Set direction, height, color and intensity. The eye toggles; the trash removes.',
            ob4: 'Adjust tab: exposure, contrast, temperature and saturation in real time, plus study filters (posterize, cutout, B&W) to simplify values.',
            ob5: 'You are ready! Save scenes with a thumbnail to reuse later. Reopen this guide via the help button in the viewport.'
        }
    };

    function $(id) { return document.getElementById(id); }
    function tt() { return TXT[lang]; }

    function buildDots() {
        var wrap = $('step-dots');
        wrap.innerHTML = '';
        for (var i = 0; i < TOTAL_STEPS; i++) {
            var d = document.createElement('span');
            d.className = 'dot';
            d.id = 'ob-dot-' + i;
            wrap.appendChild(d);
        }
    }

    function applyTexts() {
        var x = tt();
        $('onboard-title').textContent = x.title;
        setText('lang-back', x.back);
        setText('lang-next', x.next);
        setText('lang-start', x.start);
        setBox('lang-ob-1', x.ob1);
        setBox('lang-ob-2', x.ob2);
        setBox('lang-ob-3', x.ob3);
        setBox('lang-ob-4', x.ob4);
        setBox('lang-ob-5', x.ob5);
    }
    function setText(cls, val) {
        var n = document.getElementsByClassName(cls);
        for (var i = 0; i < n.length; i++) n[i].textContent = val;
    }
    function setBox(cls, val) { setText(cls, val); }

    function goToStep(n) {
        currentStep = n;
        for (var i = 0; i < TOTAL_STEPS; i++) {
            var el = $('onboard-step-' + i);
            if (el) el.style.display = (i === n) ? 'block' : 'none';
            var dot = $('ob-dot-' + i);
            if (dot) {
                dot.className = 'dot';
                if (i < n) dot.classList.add('completed');
                if (i === n) dot.classList.add('active');
            }
        }
        $('xuim-speech-bubble').textContent = tt().speech[n] || '';
        $('onboard-prev').style.visibility = (n === 0) ? 'hidden' : 'visible';
        var last = (n === TOTAL_STEPS - 1);
        $('onboard-next').style.display = last ? 'none' : 'inline-flex';
        $('onboard-finish').style.display = last ? 'inline-flex' : 'none';
    }

    // Animacao de fala: alterna as duas imagens do mascote.
    function startTalk() {
        stopTalk();
        talkTimer = setInterval(function () {
            var img = $('xuim-avatar-img');
            if (!img) return;
            var normal = img.src.indexOf('olhosfechados') === -1;
            img.src = normal ? 'img/xuim_falandoolhosfechados.png' : 'img/xuim_falando_normal.png';
        }, 600);
    }
    function stopTalk() {
        if (talkTimer) { clearInterval(talkTimer); talkTimer = null; }
        var img = $('xuim-avatar-img');
        if (img) img.src = 'img/xuim_falando_normal.png';
    }

    function open(startLang) {
        if (startLang) lang = startLang;
        buildDots();
        applyTexts();
        // marca o card de idioma atual
        selectLangCard(lang);
        goToStep(0);
        $('onboarding-modal').style.display = 'flex';
        startTalk();
    }

    function close(markDone) {
        $('onboarding-modal').style.display = 'none';
        stopTalk();
        if (markDone) {
            try { LightRefStorage.writeConfig({ onboardingCompleted: true, language: lang }); } catch (e) {}
        }
    }

    function selectLangCard(l) {
        var cards = document.getElementsByClassName('lang-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('selected', cards[i].getAttribute('data-lang') === l);
        }
    }

    function bind() {
        // Cards de idioma
        var cards = document.getElementsByClassName('lang-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function () {
                lang = this.getAttribute('data-lang');
                selectLangCard(lang);
                applyTexts();
                $('xuim-speech-bubble').textContent = tt().speech[currentStep] || '';
                if (onLangCb) onLangCb(lang); // aplica no painel em tempo real
            });
        }
        $('onboard-next').addEventListener('click', function () {
            if (currentStep < TOTAL_STEPS - 1) goToStep(currentStep + 1);
        });
        $('onboard-prev').addEventListener('click', function () {
            if (currentStep > 0) goToStep(currentStep - 1);
        });
        $('onboard-finish').addEventListener('click', function () { close(true); });
        $('onboard-close').addEventListener('click', function () { close(true); });
        // O #btn-help agora e controlado pelo panel.js (menu de ajuda).
    }

    // Mostra o wizard so na primeira vez.
    function maybeShow(currentLang) {
        if (currentLang) lang = currentLang;
        var done = false;
        try { done = !!LightRefStorage.readConfig().onboardingCompleted; } catch (e) { done = false; }
        if (!done) open(lang);
    }

    document.addEventListener('DOMContentLoaded', bind);

    global.LightRefOnboarding = {
        maybeShow: maybeShow,
        open: open,
        onLanguageChosen: function (cb) { onLangCb = cb; }
    };
})(window);