# Implementation Plan: Update Button, Wizard and Session

## Overview

Plano incremental derivado somente do design.md. A ordem minimiza risco: primeiro a Area C (mudanca estrutural de boot/estado/sessao), depois a Area A (botao de atualizacao, baixo risco e isolado) e por fim a Area B (wizard, so DOM/CSS + fiacao e uma string de conteudo). Cada mudanca de codigo e seguida por `node --check` e verificacao ASCII; a suite de testes (hoje 18 testes) deve permanecer verde apos cada etapa.

Todo codigo de producao e ES5 puro e ASCII-only (sem arrow functions, let/const, classes, template literals, Promise nativa, async/await), compativel com o CEF_Antigo (Chromium ~61) e o CEF_Atual (Chromium 99), sem build step. Os arquivos sao editados com Python (UTF-8 sem BOM). Apenas os arquivos de teste (fast-check, rodando em Node) podem usar sintaxe moderna.

- Etapa C1 (tarefas 1-3): camera e pausa de render em `scene.js`; token de sessao em `init.jsx`.
- Etapa C2 (tarefas 4-7): ampliar estado em `panel.js` (sv:3), criar `js/session.js`, fiar boot/captura e ordem de scripts.
- Etapa A (tarefas 8-11): controle de atualizacao no rodape, CSS, `decideUpdateOutcome` + cache-buster, `setupUpdates` ampliado.
- Etapa B (tarefas 12-15): DOM do modal + `#btn-help`, CSS do wizard, reescrever a fala do passo 5, fiar `maybeShow`/`onLanguageChosen` apos a restauracao.

Cada etapa termina num checkpoint testavel.

## Tasks

### ETAPA C1 - Base da Area C (scene.js e init.jsx)

- [x] 1. Adicionar camera e controle de render loop ao LightRefScene
  - Em `js/scene.js` (ES5/ASCII), adicionar a `Scene.prototype`:
  - `getCameraState()`: retorna `{ alpha, beta, radius, target: {x,y,z} }` lidos do `ArcRotateCamera` (`this.camera`), usando `c.target || c.getTarget()`.
  - `setCameraState(s)`: aplica `alpha`/`beta`/`radius` somente quando `isFinite`, e `setTarget(new BABYLON.Vector3(...))` quando `s.target` existir; nao lanca com `s` nulo.
  - `suspendRender()`: `this.engine.stopRenderLoop()` e marca `this._renderPaused = true`.
  - `resumeRender()`: se `this._renderPaused`, religa `engine.runRenderLoop(function(){ self.scene.render(); })` e zera `_renderPaused` (retomada bem abaixo de 1 s).
  - Rodar `node --check js/scene.js` e conferir ASCII apos a edicao.
  - _Requisitos: 11.7, 14.4, 14.5_

- [x] 2. Adicionar o token de sessao persistente em init.jsx
  - Em `init.jsx` (ExtendScript ASCII), dentro de `#targetengine "lightref"`, adicionar `lightrefSessionToken()`: se `$.global.__lightrefSession` for `undefined`/`null`, cria `String(new Date().getTime()) + '-' + String(Math.floor(Math.random()*1e9))`; retorna o token.
  - Garantir que o token nasca uma vez por Sessao_do_Photoshop e sobreviva a recarregamentos do painel (engine persistente), morrendo quando o Host encerra.
  - Rodar `node --check` nao se aplica a `.jsx`; conferir manualmente sintaxe ES3/ASCII (sem recursos ES5+ nao suportados pelo ExtendScript).
  - _Requisitos: 13.1, 13.2, 13.3, 14.3_

- [x] 3. Checkpoint C1 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### ETAPA C2 - Estado da sessao, modulo de sessao e boot (panel.js, session.js, index.html)

- [x] 4. Ampliar o estado para Estado_da_Sessao (sv:3) em panel.js
  - Em `js/panel.js`, adicionar funcoes puras expostas junto de `window.__lrStateApi`, sem alterar o contrato de `collectSceneState`/`applySceneState` nem o que "Salvar cena" grava em `scenes.json`:
  - `collectSessionState(sc, modelValue, uiSnapshot)` -> `{ sv:3, sessionToken, scene: collectSceneState(sc, modelValue), selectedLight, camera: sc.getCameraState(), hdrBackground, ui }`, com `selectedLight` = posicao de `selectedLightId` em `sc.lightManager.lights` (ou `null`) e `ui` = page/tab/floor/guides/reference/collapsed/materialOpen/envDrawerOpen lidos de `uiSnapshot`.
  - `applySessionState(sc, state, opts)`: chama `applySceneState(sc, state.scene, opts)` primeiro (modelo primeiro, trata falha, fallback item-a-item); no `afterApply`, aplica `camera` (`sc.setCameraState`), `hdrBackground` (`sc.setEnvBackgroundVisible`), `selectedLight` com clamp em `[0, nLuzes-1]`, e dispara `opts.applyUi(state.ui)`.
  - `sanitizeSessionState(raw, initial)` pura: retorna `null` se `raw` nao e objeto ou `raw.sv` nao e 3; senao valida campo a campo (numero `isFinite`, string, boolean, indice de luz inteiro em faixa ou `null`), usando o valor de `initial` por campo invalido/ausente; nunca lanca; nunca duplica luz.
  - Rodar `node --check js/panel.js` e conferir ASCII.
  - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 15.1, 15.4, 15.7_

  - [x]* 4.1 Escrever teste de propriedade de sanitizacao do Estado_da_Sessao
    - Novo harness `tests/loadSession.js` (carrega `session.js` + reusa `__lrStateApi` do `panel.js` e `makeFakeScene` ampliado com `getCameraState`/`setCameraState`/`selectedLight`); gera JSON invalido, campos ausentes, tipo errado e numeros nao finitos; confere fallback por campo ou `null`, sem excecao e sem duplicar luz.
    - **Property 13: Sanitizacao tolerante do Estado_da_Sessao**
    - **Validates: Requirements 15.1, 15.4**

- [x] 5. Criar o modulo de sessao js/session.js (window.LightRefSession)
  - Criar `js/session.js` (ES5/ASCII), dependente de `LightRefStorage`, `CSInterface` (opcional) e das funcoes `__lrStateApi`:
  - `resolveToken(cb)`: via `CSInterface.evalScript('lightrefSessionToken()', cb)`; `evalScript` ausente/erro/vazio -> `cb(null)` (lado seguro).
  - Nome de arquivo por versao do Host: `session_<appName><appVersion>.json` de `getHostEnvironment()`; fallback `session_unknown.json`.
  - `read()`: le o arquivo via `LightRefStorage`; em erro retorna `null` (try/catch), registra via `window.__lrDiagWrite()` em `window.__lrSessionErrors`.
  - `save(sessionState)`: grava atomico; `requestSave(collectFn)` com debounce de 300 ms que coalesce rajadas em uma gravacao; `flush()` grava a pendente imediatamente.
  - `restoreIfSameSession(initial, cb)`: resolve token vivo, `read()` + `sanitizeSessionState`; `cb(state)` somente se `arquivo.sessionToken === tokenVivo` e estado valido; senao `cb(null)` (Estado_Inicial), sem lancar.
  - Rodar `node --check js/session.js` e conferir ASCII.
  - _Requisitos: 13.1, 13.2, 13.3, 14.3, 14.6, 15.1, 15.5, 15.6_

  - [x]* 5.1 Escrever teste de propriedade de deteccao de sessao por token
    - Em `tests/loadSession.js`, gera `token_salvo` e `token_vivo`; confere que restaura sse `token_salvo === token_vivo` e o estado e valido; token vivo ausente / tokens diferentes / arquivo ausente/invalido -> Estado_Inicial.
    - **Property 10: Deteccao de sessao por token**
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [x]* 5.2 Escrever teste de propriedade de isolamento por versao do Host
    - Gera duas versoes de Host distintas; confere que as chaves/nomes de arquivo de sessao sao distintos (um estado nunca le/sobrescreve o do outro).
    - **Property 11: Isolamento por versao do Host**
    - **Validates: Requirements 14.3**

  - [x]* 5.3 Escrever teste de propriedade de debounce de gravacao
    - Relogio falso; distribui pedidos de `requestSave` ao longo de `t` ms; confere que o numero de gravacoes efetivas e no maximo `1 + floor(t/300)`.
    - **Property 12: Debounce de gravacao**
    - **Validates: Requirements 14.6**

- [x] 6. Fiar o boot de sessao, a captura e a pausa de render em panel.js
  - Em `js/panel.js`, tornar `initScene()` condicional: cria o motor mas **nao** carrega Asaro nem a luz padrao incondicionalmente; a decisao de sessao define o que carregar.
  - No `DOMContentLoaded`: chamar `LightRefSession.restoreIfSameSession(initial, cb)`; se vier estado valido, aplicar via `applySessionState` carregando **so** o modelo salvo e as luzes exatas (sem luz padrao), com `#loading-overlay` ligado ate o modelo terminar e honrando `loadToken` (vence o ultimo load solicitado); se o modelo salvo faltar, cair no Asaro + aviso e restaurar os demais campos; se `cb(null)`, iniciar no Estado_Inicial (Asaro + 1 luz + prefs de Config como hoje).
  - Ligar `LightRefSession.requestSave(collectSessionStateNow)` nos pontos de fim de ajuste descritos no design (fim de arraste de slider/cor, troca de modelo, add/remove/undo/selecao de luz, material/params/formColor/fundo/ambiente/intensidade/HDR-bg, projecao/focal, troca de pagina/aba, toggles do visor, abrir/fechar popover e gaveta, orbita de camera com debounce, e apos `applyScene` ao carregar uma Cena).
  - Deteccao de oculto: `visibilitychange` (hidden -> `scene.suspendRender()` + `LightRefSession.flush()`; visivel -> `scene.resumeRender()`), complementado por `window` blur/focus e pelo fallback de area zero do `_resizePoll` (500 ms); retomada <= 1 s. Manter `keepPanelLoaded()` como melhor caso. Envolver `restoreIfSameSession` em try/catch para nao derrubar o painel.
  - Rodar `node --check js/panel.js` e conferir ASCII.
  - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.4, 14.2, 14.4, 14.5, 14.6, 15.2, 15.3, 15.5_

  - [x]* 6.1 Escrever teste de propriedade round-trip do Estado_da_Sessao
    - Em `tests/loadSession.js`, gera Estado_da_Sessao valido; roda capturar -> serializar JSON -> desserializar -> restaurar e compara igualdade profunda de todos os campos observaveis (modelo/transform, luzes na mesma ordem, luz selecionada, material/params/formColor, fundo, ambiente/HDR/intensidade, "Mostrar fundo do HDR", pos-processamento, focal, projecao, camera e Estado_da_Interface).
    - **Property 8: Round-trip do Estado_da_Sessao**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 15.7, 10.5**

  - [x]* 6.2 Escrever teste de propriedade de idempotencia da restauracao
    - Restaurar duas vezes seguidas produz o mesmo resultado que restaurar uma vez; o numero de luzes apos restaurar e exatamente o do estado (sem luz padrao extra, sem duplicar).
    - **Property 9: Idempotencia da restauracao (sem luz extra nem duplicada)**
    - **Validates: Requirements 10.4, 12.2, 15.7**

  - [x]* 6.3 Escrever testes de exemplo do boot de sessao
    - Restaurar com modelo valido chama `loadModel` uma vez (12.1); `#loading-overlay` ligado durante e desligado apos (12.3); modelo que falha -> aviso + demais campos aplicados (15.2); dois loads -> vence o ultimo (15.3); `save` que lanca nao propaga e registra no Diagnostico (15.5); captura/restauracao preserva outras chaves e arquivos (15.6).
    - _Requisitos: 12.1, 12.3, 15.2, 15.3, 15.5, 15.6_

- [x] 7. Carregar session.js e onboarding.js na ordem correta em index.html
  - Em `index.html`, adicionar `<script src="js/session.js?v=..."></script>` e `<script src="js/onboarding.js?v=..."></script>` **antes** de `panel.js` e depois de `storage.js`/`scene.js`/`update.js` (ordem recomendada: `... storage, lights, postfx, scene, to-photoshop, update, onboarding, session, panel`), para que `window.LightRefOnboarding` e `window.LightRefSession` ja existam no boot do painel.
  - Conferir ASCII (apenas marcacao HTML/atributos novos).
  - _Requisitos: 5.1, 10.2, 13.1_

- [x] 8. Checkpoint C2 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: minimizar/fechar/reabrir mantem o estado; reiniciar o Photoshop volta ao Estado_Inicial.)

### ETAPA A - Botao de atualizacao

- [x] 9. Adicionar a marcacao do controle de atualizacao no rodape (index.html)
  - Em `index.html`, no `.lr04-footer` (grid `1fr auto 1fr`), envolver a marca em `.lr04-footleft` e adicionar `#btn-update` (`.lr04-updbtn`, `type="button"`, `aria-label`/`data-tooltip` "Verificar atualizacoes") com `<i data-lucide="refresh-cw">` + `<span class="lr04-updlabel">Atualizar</span>`, e `<span class="lr04-ver" id="lr-version">v0.6.0</span>` dentro da `.lr04-brand` (placeholder preenchido por JS). Manter `nav` e o botao `data-action="collapse"`.
  - Conferir ASCII.
  - _Requisitos: 1.1, 1.2, 3.1_

- [x] 10. Adicionar o CSS do controle de atualizacao (index.css)
  - Em `index.css`, adicionar `.lr04-footleft` (flex/gap/min-width:0), `.lr04-updbtn` (icone + rotulo, borda, hover), `.lr04-updbtn.is-checking i` com `animation: lr-spin`, `.lr04-updlabel`, `.lr04-ver`, o `@keyframes lr-spin` e o media query estreito que esconde so o rotulo mantendo o icone.
  - Conferir ASCII.
  - _Requisitos: 1.1, 2.1, 3.1_

- [x] 11. Extrair decideUpdateOutcome e adicionar cache-buster em js/update.js
  - Em `js/update.js`, extrair de `check(manual)` a funcao pura `decideUpdateOutcome(remote, installed, manual)` que retorna o desfecho: `remote > installed` -> "banner"; senao se `manual` -> "ja atualizado" (contendo a versao instalada); senao -> "silencio". `check` passa a chamar essa funcao e aplicar o efeito (banner / toast / nada), sem mudar o comportamento externo.
  - Em `fetchJson`, acrescentar cache-buster `?t=<timestamp>` na URL do `version.json` (aplicado igualmente a `check(true)` e `check(false)`), sem mudar o contrato.
  - Rodar `node --check js/update.js` e conferir ASCII.
  - _Requisitos: 2.2, 2.3, 2.4, 4.2, 4.3_

  - [x]* 11.1 Escrever teste de propriedade da decisao de atualizacao
    - Novo harness `tests/loadUpdateDecision.js` que extrai `decideUpdateOutcome` sem rede; gera `(remota, instalada, manual)` semver e compara com o desfecho esperado (banner / ja atualizado contendo a versao / silencio).
    - **Property 1: Decisao de atualizacao**
    - **Validates: Requirements 2.2, 2.3, 4.2, 4.3**

- [x] 12. Ampliar setupUpdates em panel.js (versao, botao, gatilho secundario)
  - Em `js/panel.js`, no `setupUpdates()`: preencher `#lr-version` via `installedVersionLabel()` (le `LightRefUpdate.VERSION`; fallback `v?` sem erro quando ausente); ligar `#btn-update` a `runManualUpdateCheck(btn)` que aplica `is-checking`, chama `feedback('Verificando atualizacoes...')` e `LightRefUpdate.check(true)`, removendo `is-checking` apos ~1,2 s; manter o clique da `.lr04-brand` como gatilho secundario de `check(true)`; manter o `check(false)` agendado ~1,5 s.
  - Rodar `node --check js/panel.js` e conferir ASCII.
  - _Requisitos: 1.3, 1.4, 2.1, 3.1, 3.2, 3.3, 4.1_

  - [x]* 12.1 Escrever smoke test do controle de atualizacao
    - `tests/updateButton.smoke.test.js`: icone + rotulo presentes (1.1); clique chama `check(true)` com stub (1.3); `.lr04-brand` tambem (1.4); mensagem "verificando" (2.1); fetch que falha -> toast de falha (2.4); clique de "baixar" chama `openExternal` (2.5); `installedVersionLabel` com/sem `LightRefUpdate` (3.1/3.2/3.3); `check(false)` agendado (4.1).
    - _Requisitos: 1.1, 1.3, 1.4, 2.1, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1_

- [x] 13. Checkpoint A - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: estados do botao e versao exibida.)

### ETAPA B - Wizard de primeiro uso

- [x] 14. Adicionar a marcacao do modal do wizard e o #btn-help (index.html)
  - Em `index.html`, dentro de `.lr04-window`, adicionar `#onboarding-modal` com exatamente os ids/classes que `onboarding.js` espera: `#onboard-title`, `#step-dots`, `#onboard-close`; `.xuim-mascot-container` com `#xuim-avatar-img` e `#xuim-speech-bubble`; `#onboard-step-0..5` (passo 0 com `.lang-card[data-lang="pt"|"en"]`, passos 1..5 com `.onboard-feature-box.lang-ob-1..5`); nav com `#onboard-prev.lang-back`, `#onboard-next.lang-next`, `#onboard-finish.lang-start`.
  - Adicionar `#btn-help` (`.lr04-help`, `data-lucide="help-circle"`) no viewport junto da `.lr04-toptools` (o `onboarding.js` liga sozinho se existir).
  - Conferir ASCII.
  - _Requisitos: 5.1, 6.1, 7.1, 7.3, 8.1, 9.1_

- [x] 15. Adicionar o CSS do wizard e do #btn-help (index.css)
  - Em `index.css`, adicionar `.lr04-ob-modal` (position:fixed com fallback top/right/bottom/left:0 para o CEF_Antigo, overlay rgba, z-index 10000), `.lr04-ob-card` (max-width:340px), `.lr04-ob-head`, `.step-dots`/`.dot`/`.active`/`.completed`, `.lr04-ob-x`, `.xuim-mascot-container`, `.xuim-avatar-img`, `.speech-bubble-box`, `.lr04-ob-body`, `.onboard-feature-box`, `.lang-cards-group`/`.lang-card`/`.lang-card.selected`/`.lang-name`, `.lr04-ob-nav`/`.lr04-ob-btn`/`.lr04-ob-primary` e `.lr04-help`.
  - Conferir ASCII.
  - _Requisitos: 7.3, 8.1, 9.1_

- [x] 16. Reescrever a fala do passo 5 do onboarding.js (conteudo, sem doacao)
  - Em `js/onboarding.js`, alterar **somente** a(s) string(s) de fala do passo 5 (PT e EN) para remover a frase de "apoiar o projeto / cafezinho", deixando um encerramento amigavel (ex.: "Pronto! Qualquer duvida, reabra este guia pelo botao de ajuda."). Mudanca de conteudo apenas, ASCII, sem alterar estrutura, numero de passos nem logica.
  - Rodar `node --check js/onboarding.js` e conferir ASCII.
  - _Requisitos: 7.4, 7.5_

  - [x]* 16.1 Escrever testes de propriedade de conteudo e navegacao do wizard
    - Novo harness `tests/loadOnboarding.js` (carrega `onboarding.js` num `vm` com `document`/`window` falsos e `LightRefStorage` fake). Propriedades:
    - **Property 2: Wizard aparece apenas na primeira vez** - **Validates: Requirements 5.1, 5.2**
    - **Property 3: Navegacao de passos permanece em faixa valida** - **Validates: Requirements 7.3**
    - **Property 4: Conteudo do Wizard sem doacao** - **Validates: Requirements 7.4**
    - **Property 5: Conteudo do Wizard sem emoji** - **Validates: Requirements 7.5**
    - **Property 6: Balao do Mascote corresponde ao passo** - **Validates: Requirements 8.1**
    - **Property 7: Idioma inicial pre-selecionado** - **Validates: Requirements 6.4**

  - [x]* 16.2 Escrever testes de exemplo do onboarding
    - `tests/onboarding.example.test.js`: `finish`/`close` chamam `writeConfig({onboardingCompleted:true, language})` (5.3/5.4); `stopTalk` encerra a animacao (5.5); card dispara `onLanguageChosen` (6.2); `open` abre mesmo com `onboardingCompleted` true (9.2); reabrir+fechar mantem true (9.3); dois ticks alternam as imagens (8.2); passo 0 contem cards pt/en (6.1); textos cobrem os recursos reais (7.1).
    - _Requisitos: 5.3, 5.4, 5.5, 6.1, 6.2, 7.1, 8.2, 9.2, 9.3_

- [x] 17. Fiar o wizard no boot apos a restauracao de sessao (panel.js)
  - Em `js/panel.js`, no fim do `DOMContentLoaded` e **depois** do boot de sessao da Area C: ler `cfgBoot = LightRefStorage.readConfig()` (try/catch), `curLang = cfgBoot.language || 'pt'`; se `window.LightRefOnboarding` existir, registrar `onLanguageChosen(function(lang){ applyLanguage(lang); })` e chamar `maybeShow(curLang)` dentro de try/catch. `applyLanguage(lang)` registra o idioma e aplica o que o painel ja suporta sem quebrar (i18n completa fora de escopo); abrir o wizard nunca captura nem limpa o Estado_da_Sessao restaurado.
  - Rodar `node --check js/panel.js` e conferir ASCII.
  - _Requisitos: 5.1, 5.2, 6.2, 6.4, 9.2, 9.3_

- [x] 18. Registrar os novos testes no package.json e checkpoint final
  - Acrescentar os novos arquivos de teste a cadeia `&&` do script `test` no `package.json` (mantendo os 18 existentes). Rodar a suite completa pelo runner Node que grava o resultado em arquivo (ex.: `node tests/run-all.js > tests-out.txt`), ja que `npm test` falha neste terminal.
  - Ensure all tests pass, ask the user if questions arise.
  - _Requisitos: 16.2_

## Notes

- Tarefas marcadas com `*` sao opcionais (testes) e podem ser puladas para um MVP mais rapido; as tarefas de implementacao (sem `*`) devem ser executadas.
- ES5 somente; `.js`/`.jsx` ASCII-only; sem build step. Deve rodar no CEF_Antigo (Chromium ~61) e no CEF_Atual (Chromium 99).
- Editar arquivos sempre com Python (UTF-8 sem BOM). Rodar `node --check <arquivo>` apos cada mudanca em `.js`.
- Nunca usar `git checkout`/`restore` de arquivos inteiros; nenhum commit a menos que o usuario peca.
- Testes de propriedade usam fast-check em Node, >= 100 iteracoes, etiquetados `Feature: update-button-wizard-and-session, Property N: <texto>`; reusam/estendem `tests/loadPanelState.js`/`makeFakeScene` e os novos harnesses `loadUpdateDecision.js`, `loadOnboarding.js`, `loadSession.js`. `npm test` falha neste terminal; usar o runner Node que grava o resultado em arquivo.
- Cada tarefa referencia os requisitos que cobre; tarefas de teste referenciam a propriedade do design.

### Verificacao manual no Photoshop (Req 16.4 - NAO e tarefa de codigo; o usuario executa)

1. Primeiro uso: o Wizard aparece sozinho; concluir aplica o idioma e nao reaparece ao reabrir.
2. Reabrir o Wizard pelo `#btn-help` depois de concluido o onboarding.
3. Botao de atualizacao: estados verificando / ja atualizado / banner de atualizacao disponivel / falha; abrir o link de download no navegador.
4. Versao instalada exibida no rodape.
5. Minimizar, recolher em icone, fechar e reabrir o Painel na mesma Sessao_do_Photoshop e confirmar que os ajustes (cena, camera, interface) permanecem; sem flash do Asaro e sem luz padrao extra ao restaurar.
6. Reiniciar o Photoshop (e simular encerramento anormal) e confirmar que o Painel inicia no Estado_Inicial.
7. Confirmar o comportamento no Photoshop 2019, 2020 e nas versoes atuais, inclusive com duas versoes abertas ao mesmo tempo (estados separados).
8. Medir consumo de GPU/CPU com o Painel oculto e confirmar retomada do visor em ate 1 s ao reexibir.
9. Confirmar que a deteccao de sessao via engine persistente (`$.global`) distingue recarregamento de reinicio em cada versao.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["4", "4.1"] },
    { "id": 2, "tasks": ["5", "5.1", "5.2", "5.3"] },
    { "id": 3, "tasks": ["6", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["9", "10", "11", "11.1"] },
    { "id": 6, "tasks": ["12", "12.1"] },
    { "id": 7, "tasks": ["14", "15", "16", "16.1", "16.2"] },
    { "id": 8, "tasks": ["17"] },
    { "id": 9, "tasks": ["18"] }
  ]
}
```
