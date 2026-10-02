# Implementation Plan: Shortcuts Help

## Overview

Plano incremental derivado somente do `design.md`. A ordem minimiza risco: primeiro a logica pura e sem DOM (Dados_dos_Atalhos + render + exposicao para teste), que ja fica coberta por testes; depois a mudanca minima no `onboarding.js` (soltar o `#btn-help`); em seguida o DOM (popover + modal) e o CSS; por fim a fiacao no `panel.js` (menu, abrir/fechar lista) e o registro dos testes. Cada mudanca de codigo e seguida por `node --check` (nos `.js`) e verificacao ASCII; a suite (hoje **29 testes**) deve permanecer verde apos cada etapa.

Todo o codigo de producao e ES5 puro e ASCII-only (sem arrow functions, `let`/`const`, classes, template literals, `Promise` nativa, `async/await`), compativel com o CEF_Antigo (Chromium ~61) e o CEF_Atual (Chromium 99), sem build step. Os arquivos sao editados com Python (UTF-8 sem BOM). Apenas os arquivos de teste (fast-check, em Node) podem usar sintaxe moderna.

- Etapa 1 (tarefas 1-2): Dados_dos_Atalhos + render + exposicao `window.__lrShortcuts` em `panel.js`; testes de propriedade e smoke.
- Etapa 2 (tarefa 3): mudanca minima em `onboarding.js` (nao ligar mais o `#btn-help`).
- Etapa 3 (tarefas 4-5): DOM do popover e do modal em `index.html`; CSS em `index.css`.
- Etapa 4 (tarefas 6-7): fiacao do menu e do modal em `panel.js`; registro dos testes no `package.json` e checkpoint final.

## Tasks

### ETAPA 1 - Dados dos atalhos (logica pura, testavel)

- [x] 1. Adicionar Dados_dos_Atalhos, render e exposicao em panel.js
  - Em `js/panel.js` (ES5/ASCII), adicionar `buildShortcutGroups()` retornando os tres grupos exatos do design: "Luzes" (Ctrl+Shift+A Adicionar luz; Ctrl+Shift+X Remover a luz selecionada; Ctrl+Shift+Z Desfazer a remocao; "Ctrl+Shift+1 a 9" Selecionar a luz pelo numero), "Arraste no visor (segure Shift)" ("Shift + arrastar" Girar a luz ativa (direcao e altura); "Ctrl+Shift + arrastar" Mudar so a intensidade; "Ctrl+Shift+Alt + arrastar" Mudar a cor (horizontal) e a temperatura (vertical)), "Transformar objeto (aba Posicao)" (G Mover; S Escalar; R Rotacionar; "X / Y / Z" Travar no eixo; Enter Confirmar; Esc Cancelar).
  - Adicionar `escHtml(s)` e `renderShortcutGroups(groups)` puros, montando `.lr04-sc-group`/`.lr04-sc-title`/`.lr04-sc-list`/`.lr04-sc-row`/`.lr04-sc-combo`/`.lr04-sc-desc` conforme o design (`<dl>/<dt>/<dd>`).
  - No bloco final do IIFE que ja expoe `window.__lrStateApi`/`__lrColorApi`, expor `window.__lrShortcuts = { buildShortcutGroups: buildShortcutGroups, renderShortcutGroups: renderShortcutGroups }` sob o mesmo guarda `typeof window !== 'undefined'`.
  - Nao alterar `bindLightKeys`/`bindCompKeys` nem qualquer logica de atalho real.
  - Rodar `node --check js/panel.js` e conferir ASCII.
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 6.4, 7.1, 7.2_

  - [ ]* 1.1 Escrever teste de propriedade dos grupos e combos
    - Novo `tests/shortcutsData.property.test.js` carregando `panel.js` pelo harness `tests/loadPanelState.js` e lendo `window.__lrShortcuts.buildShortcutGroups`; conferir 3 grupos, titulos exatos, contagens 4/3/6 e combos exatos.
    - **Property 1: Grupos e combos esperados**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5, 4.7**

  - [ ]* 1.2 Escrever teste de propriedade ASCII sem emoji
    - Novo `tests/shortcutsAscii.property.test.js`; para toda linha de todo grupo, `combo` e `desc` sao strings nao vazias com todos os codepoints em 0x20..0x7E (sem emoji).
    - **Property 2: Linhas sao texto ASCII nao vazio e sem emoji**
    - **Validates: Requirements 3.5, 7.1**

  - [ ]* 1.3 Escrever teste de propriedade de determinismo
    - Novo `tests/shortcutsDeterministic.property.test.js`; duas chamadas de `buildShortcutGroups()` produzem estruturas profundamente iguais.
    - **Property 3: buildShortcutGroups e determinista**
    - **Validates: Requirements 4.6**

  - [ ]* 1.4 Escrever teste de propriedade da renderizacao
    - Novo `tests/shortcutsRender.property.test.js`; o HTML de `renderShortcutGroups(buildShortcutGroups())` contem o texto (escapado) de cada `title`, `combo` e `desc`, e nao introduz linhas alem dos dados.
    - **Property 4: Renderizacao contem toda linha de dados**
    - **Validates: Requirements 4.2, 4.7**

  - [ ]* 1.5 Escrever smoke da API de atalhos
    - Novo `tests/shortcutsApi.smoke.test.js`; `window.__lrShortcuts` existe com `buildShortcutGroups`/`renderShortcutGroups`; `renderShortcutGroups([])` retorna string vazia; `renderShortcutGroups(buildShortcutGroups())` retorna string nao vazia.
    - _Requisitos: 4.2, 4.6_

- [x] 2. Checkpoint Etapa 1 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### ETAPA 2 - Soltar o #btn-help do onboarding

- [x] 3. Remover a ligacao do #btn-help em onboarding.js
  - Em `js/onboarding.js`, dentro de `bind()`, remover **apenas** as duas linhas que ligam o `#btn-help` ao Wizard (`var help = $('btn-help'); if (help) help.addEventListener('click', function(){ open(lang); });`). Nao alterar `open`, `maybeShow`, `onLanguageChosen`, passos, animacao nem persistencia.
  - Rodar `node --check js/onboarding.js` e conferir ASCII.
  - _Requisitos: 2.1, 2.2, 2.3_

### ETAPA 3 - DOM e CSS (popover + modal)

- [x] 4. Adicionar a marcacao do popover e do modal em index.html
  - Em `index.html`, dentro de `.lr04-viewport`, logo apos o `#btn-help`, adicionar `#help-menu.lr04-helpmenu[role=menu][hidden]` com dois botoes `role=menuitem`: `data-help="intro"` ("Rever introducao") e `data-help="shortcuts"` ("Atalhos").
  - Dentro de `.lr04-window` (irmao do `#onboarding-modal`), adicionar `#shortcuts-modal.lr04-ob-modal[role=dialog][aria-modal=true][aria-labelledby=shortcuts-title]` iniciando com `style="display:none"`, contendo `.lr04-ob-card.lr04-sc-card` com `header.lr04-ob-head` (`#shortcuts-title` "Atalhos do teclado" + `#shortcuts-close.lr04-ob-x` com icone `x`) e `#shortcuts-body.lr04-ob-body` vazio.
  - Conferir ASCII (apenas marcacao HTML/atributos novos).
  - _Requisitos: 1.1, 3.1, 3.2, 3.3, 5.1, 6.1, 6.3_

- [x] 5. Adicionar o CSS do popover e da lista em index.css
  - Em `index.css`, adicionar `.lr04-helpmenu` (position:absolute; top:42px; right:8px; z-index:7; fundo escuro; sombra), `.lr04-helpmenu[hidden]{display:none}`, `.lr04-helpmenu-item` (bloco, texto a esquerda, hover/focus com fundo e `outline:none`).
  - Adicionar os estilos de conteudo da lista reusando o card do Wizard: `.lr04-sc-card{max-width:360px}`, `.lr04-sc-group`, `.lr04-sc-title`, `.lr04-sc-list`, `.lr04-sc-row` (grid combo/desc), `.lr04-sc-combo`, `.lr04-sc-desc`. Nao duplicar `.lr04-ob-modal`/`.lr04-ob-card` (reaproveitados).
  - Conferir ASCII.
  - _Requisitos: 1.5, 3.2, 6.3_

### ETAPA 4 - Fiacao e registro

- [x] 6. Fiar o menu e o modal no boot do panel.js
  - Em `js/panel.js`, adicionar `setupHelpMenu()` (dono do clique do `#btn-help`): seta `aria-haspopup=true`/`aria-expanded`; toggle do `#help-menu` ao clicar; fecha por clique fora e por Esc; cada item fecha o menu antes de agir; "intro" chama `window.LightRefOnboarding.open(cfg.language||'pt')` sob guarda; "shortcuts" chama `openShortcuts()`.
  - Adicionar `openShortcuts()` (preenche `#shortcuts-body` com `renderShortcutGroups(buildShortcutGroups())`, mostra o overlay, `refreshIcons()`, foca o `#shortcuts-close`), `closeShortcuts()` (esconde o overlay) e `setupShortcutsModal()` (fecha pelo `#shortcuts-close`, por clique no overlay fora do card e por Esc quando visivel). Nenhuma dessas funcoes chama `scene.*` nem `LightRefSession.*`.
  - No `DOMContentLoaded`, chamar `setupHelpMenu()` e `setupShortcutsModal()` (apos `refreshIcons()`, junto das demais `bind*`).
  - Rodar `node --check js/panel.js` e conferir ASCII.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3_

- [x] 7. Registrar os novos testes no package.json e checkpoint final
  - Acrescentar `tests/shortcutsData.property.test.js`, `tests/shortcutsAscii.property.test.js`, `tests/shortcutsDeterministic.property.test.js`, `tests/shortcutsRender.property.test.js` e `tests/shortcutsApi.smoke.test.js` a cadeia `&&` do script `test` no `package.json` (mantendo os 29 existentes). Rodar a suite completa pelo runner Node que grava o resultado em arquivo (ex.: `node tests/run-all.js > tests-out.txt`), ja que `npm test` pode falhar neste terminal.
  - Ensure all tests pass, ask the user if questions arise.
  - _Requisitos: 7.3_

## Notes

- Tarefas marcadas com `*` sao opcionais (testes) e podem ser puladas para um MVP mais rapido; as tarefas de implementacao (sem `*`) devem ser executadas.
- ES5 somente; `.js`/`.jsx` ASCII-only; sem build step. Deve rodar no CEF_Antigo (Chromium ~61) e no CEF_Atual (Chromium 99).
- Editar arquivos sempre com Python (UTF-8 sem BOM). Rodar `node --check <arquivo>` apos cada mudanca em `.js`.
- Nunca usar `git checkout`/`restore` de arquivos inteiros; nenhum commit a menos que o usuario peca.
- Esta feature e so exibicao: nao altera, adiciona nem remove nenhum atalho real (`bindLightKeys`/`bindCompKeys`/arraste em `scene.js` ficam intactos) (Req 7.2).
- Testes de propriedade usam fast-check em Node, >= 100 iteracoes, etiquetados `Feature: shortcuts-help, Property N: <texto>`; reusam o harness `tests/loadPanelState.js` (que passa a expor `window.__lrShortcuts`). `npm test` pode falhar neste terminal; usar o runner Node que grava o resultado em arquivo.
- Cada tarefa referencia os requisitos que cobre; tarefas de teste referenciam a propriedade do design.

### Verificacao manual no Photoshop (Req 7.4 - NAO e tarefa de codigo; o usuario executa)

1. Clicar no `#btn-help` e confirmar o Menu_de_Ajuda com exatamente "Rever introducao" e "Atalhos", abaixo do botao, sem cobri-lo.
2. Clicar de novo no `#btn-help` (fecha por toggle); clicar fora (fecha); Esc (fecha).
3. Selecionar "Rever introducao" e confirmar que o Wizard abre como antes.
4. Selecionar "Atalhos" e confirmar a Lista_de_Atalhos no estilo do Wizard (sem mascote), titulo "Atalhos do teclado", os tres grupos e os atalhos reais.
5. Fechar a Lista_de_Atalhos pelo botao de fechar, por clique fora do card e por Esc.
6. Navegar menu e lista so pelo teclado (Tab/Shift+Tab, Enter/Space, Esc).
7. Confirmar que a cena 3D e a sessao restaurada permanecem iguais depois de abrir e fechar o menu e a lista.
8. Confirmar o comportamento no Photoshop 2019, 2020 e nas versoes atuais.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "3"] },
    { "id": 1, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "4"] },
    { "id": 2, "tasks": ["5"] },
    { "id": 3, "tasks": ["6"] },
    { "id": 4, "tasks": ["7"] }
  ]
}
```
