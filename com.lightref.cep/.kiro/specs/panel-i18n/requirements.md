# Requirements Document

## Introduction

Esta feature adiciona ao plugin LightRef (extensao CEP do Adobe Photoshop, motor 3D Babylon.js, JavaScript ES5 sem build step, Windows, Photoshop 2019/2020 com CEF antigo Chromium ~61 e versoes atuais com CEF 99) suporte completo a dois idiomas — Portugues (PT) e Ingles (EN) — em toda a interface do Painel.

**O problema:** Hoje o Wizard de primeiro uso (`js/onboarding.js`) ja e biligue: ao clicar em "English" no step 0, os textos do Wizard mudam imediatamente. Porem a funcao `applyLanguage(lang)` em `js/panel.js` faz apenas `LightRefStorage.writeConfig({ language: lang })` — salva a preferencia sem traduzir nada no Painel. O resultado e que o usuario seleciona "English", fecha o Wizard e continua vendo todos os rotulos, botoes, mensagens de feedback, titulos de secoes e dropdowns inteiramente em Portugues.

**A solucao:** estender `applyLanguage` para re-renderizar imediatamente todos os textos visiveis do Painel no idioma escolhido, e garantir que o Painel tambem inicialize no idioma salvo (sem flash de PT antes de EN).

**O mecanismo:** um novo arquivo `js/i18n.js` contera o Dicionario_de_Strings — um objeto ES5 com sub-objetos `pt` e `en` analogos ao `TXT` ja usado em `onboarding.js`. Todos os modulos que precisam de texto leem de `window.LightRefI18n`. A funcao de traducao `t(chave, vars)` substitui variaveis no padrao `{nome}`. Ao chamar `applyLanguage('en')`, o Painel aplica as strings EN a todos os elementos traduziveis do DOM e regenera dinamicamente as secoes que constroem HTML em JS.

**Textos em escopo** (confirmados por leitura do codigo):

- `index.html` — rotulos estaticos: abas (Luz / Lente / Ajustes / Posicao / Composicao), botoes de projecao (Persp / Orto), botoes de enquadramento (Frente / 3/4 / Perfil / Topo), botoes de gizmo (Rotacionar / Mover / Desligar), checkboxes (Posterizar / Cutout / Preto e branco), botoes de pagina (3D / Biblioteca / Cenas), titulo do modal de atalhos ("Atalhos do teclado"), rotulo "Material", rotulos "Cor scatter" e "Fundo", texto de carregamento ("Carregando"), `aria-label` e `data-tooltip` de todos os botoes de acao e ferramentas.
- `panel.js` — textos dinamicos: mensagens de `feedback()` (e.g. "Luz adicionada: {nome}", "Falha ao carregar", "Verificando atualizacoes..."); nomes de luz (`LIGHT_NAMES`: Principal, Preenchimento, Contorno, Recorte, Rebote); rotulos dos sliders gerados em `renderLight` (Intensidade, Girar, Altura), `renderLens` (Lente, Enquadramento, Ambiente / HDR), `renderAdjust` (Exposicao, Contraste, Temperatura, Saturacao, Niveis, Degraus) e `renderPos` (Girar Y, Inclinar X, Altura, Horizontal, Profundidade, Escala, Inclinar Z, Distorcer forma, Largura X, Altura Y, Profund. Z); botoes gerados ("Salvar posicao do modelo", "Centralizar / resetar", "Resetar forma", "Zerar ajustes", "Resetar camera"); titulos de headings gerados ("Gizmo no visor", "Ajuste por sliders", "Gizmo (objeto selecionado)", "Adicionar forma / modelo", "Objetos na cena ({n})", "Distorcer forma"); prompts de dialogo ("Nome da categoria", "Nova categoria", "Renomear categoria"); grupos do select de modelos (optgroup labels: "Cabecas", "Bustos e Torsos", "Figuras", "Formas basicas", "Modelos"); titulos e descricoes dos Grupos_de_Atalhos gerados por `buildShortcutGroups`.
- `update.js` — textos do banner e do toast: "Atualizacao {versao}", "Baixar atualizacao", "Fechar", "Nao foi possivel verificar atualizacoes.", "Voce ja esta na versao mais recente ({versao}).".

A verificacao dentro do Photoshop e manual (ver Requisito 7).

### Escopo

Em escopo:

- Quando o usuario escolhe "English" no Wizard ou chama `applyLanguage('en')`, **todos os textos visiveis do Painel mudam imediatamente para Ingles** dentro do mesmo ciclo de boot, sem recarregar a pagina.
- Ao inicializar, se `config.language` for `'en'`, o Painel exibe todo o texto em Ingles desde o primeiro frame — sem flash de texto PT.
- Cobertura de traducao: abas, botoes de projecao/enquadramento/gizmo/pagina, secoes estaticas do `index.html`; todas as mensagens de `feedback()`; nomes de luz; rotulos de sliders e campos gerados dinamicamente; headings das secoes geradas; prompts de dialogo; textos do banner de atualizacao e do toast de atualizacao; titulo e grupos de atalhos; optgroup labels dos selects de modelo.
- O modulo `js/i18n.js` e criado como global `window.LightRefI18n`, carregado antes de `panel.js` em `index.html`, compativel com ES5/ASCII e com o CEF_Antigo e o CEF_Atual.
- Testes cobrem a logica pura do Dicionario_de_Strings e da funcao de interpolacao `t()`, registrados no `package.json` sem quebrar os 34 testes existentes.

Fora de escopo:

- Nomes individuais de modelos, materiais, ambientes e formas (ex: Asaro, Clay, Pele, Marmore, Estudio / Lobby — sao nomes proprios ou ja em Ingles). Apenas os rotulos de grupo (optgroup labels) sao traduzidos.
- Texto gravado em `scenes.json` ou `config.json`: nomes de cenas e categorias criados pelo usuario nao sao alterados.
- Layout RTL ou suporte a idiomas alem de PT e EN.
- Alterar o idioma de uma cena salva quando o Painel muda de idioma.
- O Wizard em si (ja e biligue; permanece como esta).
- Traducao de nomes de arquivo, caminhos ou mensagens de erro internas do Babylon.js.

### Pontos de esclarecimento (a confirmar na revisao)

Os itens abaixo foram escritos com um comportamento padrao assumido; confirme ou ajuste:

- **(a) Modulo i18n.js como global:** assumido `window.LightRefI18n` exposto por `js/i18n.js`, carregado antes de `panel.js` e `update.js` em `index.html`, analogamente ao padrao ja usado por `LightRefOnboarding`, `LightRefScene` etc. Alternativa seria embutir o dicionario no proprio `panel.js`. Confirmar que um arquivo separado e preferivel para manter `panel.js` gerenciavel. (Ver Requisito 1.)
- **(b) Interpolacao de strings dinamicas:** assumido que a funcao `t(chave, vars)` faz substituicao simples por `String.replace('{nome}', valor)` para cada entrada em `vars`, sem engine de template. Por exemplo, `t('lightAdded', { nome: 'Principal' })` retorna `'Luz adicionada: Principal'` (PT) ou `'Light added: Principal'` (EN). (Ver Requisito 2.)
- **(c) Boot em idioma correto:** assumido que `applyLanguage` e chamada **sincronamente** no inicio do `DOMContentLoaded`, antes de qualquer `renderTab()` ou `initScene()`, usando `config.language || 'pt'`. Dessa forma o DOM ja e atualizado antes do primeiro frame visivelmente renderizado. (Ver Requisito 3.)
- **(d) Mecanismo de traducao do `index.html`:** assumido que os elementos estaticos do HTML sao traduzidos **por JS** (sem duplicar o HTML): `applyLanguage` faz query por seletor ou atributo `data-i18n` e atualiza `textContent` / `aria-label` / `data-tooltip`. O design define o mecanismo exato (atributo `data-i18n` vs selecao direta por seletor). (Ver Requisito 4.)
- **(e) Strings de `update.js`:** assumido que `update.js` le `window.LightRefI18n` diretamente ao construir o banner e ao chamar `LightRefToast`, sem precisar de uma API separada. (Ver Requisito 5.)

## Glossary

- **Plugin:** a extensao CEP LightRef executando dentro do Adobe Photoshop.
- **Host:** o Photoshop (PHXS/PHSP) que executa o Plugin.
- **Painel:** a janela do Plugin no Host (`index.html` carregado no CEF), com o Visor_3D, o Inspector, as abas e as paginas Estudio, Biblioteca e Cenas.
- **Visor_3D:** a area de renderizacao Babylon.js do Painel (canvas `#gl-canvas`).
- **Inspector:** a regiao de abas e campos abaixo do Visor_3D (Luz, Lente, Ajustes, Posicao, Composicao).
- **Wizard:** o fluxo de onboarding em modal full-panel com o mascote Xuimzinho, implementado por `window.LightRefOnboarding` em `js/onboarding.js`. Ja e biligue; permanece fora de escopo desta feature.
- **applyLanguage:** a funcao em `js/panel.js` chamada quando o usuario escolhe o idioma no Wizard ou em qualquer outro ponto de entrada. Atualmente so salva `config.language`; esta feature a estende para traduzir todo o Painel.
- **Dicionario_de_Strings:** o objeto ES5 em `js/i18n.js` com sub-objetos `pt` e `en`, exposto como `window.LightRefI18n`. Contem todas as strings traduziveis do Plugin (exceto as do Wizard).
- **Funcao_t:** a funcao `LightRefI18n.t(chave, vars)` que retorna a string no idioma ativo para a chave dada, com variaveis interpoladas. Fallback para PT se a chave nao existir em EN.
- **Idioma_Ativo:** o idioma atual do Painel, `'pt'` ou `'en'`, lido de `config.language` e mantido em memoria pelo modulo i18n.
- **Strings_Estaticas:** os textos presentes diretamente no HTML em `index.html` que sao PT por padrao e precisam ser sobrescritos por JS quando EN e ativado.
- **Strings_Dinamicas:** os textos gerados por JS em `panel.js` (sliders, chips, headings, listas, botoes) que precisam usar a `Funcao_t` em vez de literais PT.
- **Strings_de_Feedback:** as mensagens exibidas pela funcao `feedback()` de `panel.js` e por `LightRefToast` (e.g. "Luz adicionada: {nome}", "Falha ao carregar", "Verificando atualizacoes...").
- **Banner_de_Atualizacao:** o elemento `#lf-update-banner` construido por `update.js` quando ha versao nova, com titulo "Atualizacao {versao}", botao de download e botao de fechar.
- **Grupos_de_Atalhos:** os tres grupos retornados por `buildShortcutGroups()` em `panel.js` (Luzes / Arraste no visor / Transformar objeto), com titulo e linhas combo+descricao.
- **Optgroup_de_Modelos:** os `<optgroup>` gerados por `fillModelSelect()` e `fillAddTypeSelect()` em `panel.js`, cujos `label` sao: "Cabecas", "Bustos e Torsos", "Figuras", "Formas basicas", "Modelos".
- **CEF_Antigo:** o runtime CEF do Photoshop 2019 (20.x) e 2020 (21.x), com Chromium ~61.
- **CEF_Atual:** o runtime CEF das versoes atuais do Photoshop, com Chromium 99.
- **Estado_da_Sessao:** o estado de cena, camera e interface preservado entre recargas, conforme os specs anteriores (Area C).

## Requirements

### Requirement 1: Modulo de internacionalizacao (js/i18n.js)

**User Story:** Como mantenedor do Plugin, quero um modulo central de strings para que todos os arquivos do Plugin leiam do mesmo dicionario, sem duplicar traducoes.

#### Acceptance Criteria

1. THE Plugin SHALL fornecer um arquivo `js/i18n.js` que expoe `window.LightRefI18n` com um Dicionario_de_Strings contendo sub-objetos `pt` e `en` para todas as strings traduziveis do Plugin (exceto as do Wizard).
2. THE Dicionario_de_Strings SHALL cobrir, no minimo: todos os rotulos do Inspector (sliders, headings, checkboxes, botoes gerados), todas as Strings_de_Feedback, os nomes de luz (`LIGHT_NAMES`), os rotulos de grupo dos selects de modelo (Optgroup_de_Modelos), os titulos e descricoes dos Grupos_de_Atalhos, todos os textos do Banner_de_Atualizacao e do toast, e as Strings_Estaticas do `index.html`.
3. THE `js/i18n.js` SHALL usar somente sintaxe ES5 e caracteres ASCII, sem build step, funcionando no CEF_Antigo e no CEF_Atual.
4. WHEN `js/i18n.js` e carregado antes de `panel.js` em `index.html`, THE `window.LightRefI18n` SHALL estar disponivel quando `panel.js` executar.
5. IF uma chave solicitada por `LightRefI18n.t(chave, vars)` nao existir no sub-objeto do Idioma_Ativo, THEN THE Funcao_t SHALL retornar a string PT correspondente como fallback, sem gerar erro de script.
6. THE `js/i18n.js` SHALL expor `LightRefI18n.setLang(lang)` para que `applyLanguage` defina o Idioma_Ativo sem recarregar a pagina. (Esclarecimento (a).)

### Requirement 2: Funcao de interpolacao de strings

**User Story:** Como desenvolvedor, quero uma funcao de traducao que suporte variaveis, para que mensagens como "Luz adicionada: {nome}" possam ser traduzidas sem concatenacao manual em cada chamada.

#### Acceptance Criteria

1. THE Funcao_t SHALL aceitar uma chave de string e um objeto opcional de variaveis e retornar a string do Idioma_Ativo com todas as ocorrencias de `{chave_var}` substituidas pelos valores correspondentes.
2. WHEN o objeto de variaveis e omitido ou vazio, THE Funcao_t SHALL retornar a string do Idioma_Ativo sem modificacao.
3. WHEN uma variavel referenciada na string nao existe no objeto de variaveis, THE Funcao_t SHALL manter o placeholder `{chave_var}` inalterado, sem gerar erro de script.
4. THE Funcao_t SHALL ser uma funcao pura (sem efeitos colaterais, sem acesso ao DOM), testavel isoladamente em Node sem depender de `document` ou `window`. (Esclarecimento (b).)
5. THE Funcao_t SHALL ser registrada em `window.__lrI18nApi` (analogamente a `window.__lrStateApi`) para que os testes em Node possam carrega-la.

### Requirement 3: Boot do Painel no idioma salvo

**User Story:** Como usuario que escolheu Ingles no Wizard, quero que o Painel abra em Ingles na proxima vez, sem ver um flash de texto Portugues.

#### Acceptance Criteria

1. WHEN o Plugin inicializa e `config.language` e `'en'`, THE Plugin SHALL exibir todo o texto do Painel em Ingles antes do primeiro frame visivelmente renderizado, sem transicao ou flash de texto PT.
2. WHEN o Plugin inicializa e `config.language` e `'pt'` ou ausente, THE Plugin SHALL exibir todo o texto do Painel em Portugues (comportamento atual, sem regressao).
3. THE Plugin SHALL chamar `applyLanguage(curLang)` sincronamente no inicio do listener `DOMContentLoaded`, antes de `renderTab()`, `initScene()` ou qualquer outro passo que gere HTML visivelmente no Inspector. (Esclarecimento (c).)
4. WHILE o Wizard esta aberto e o usuario troca de idioma, THE Plugin SHALL aplicar o novo idioma ao Painel imediatamente, para que ao fechar o Wizard o Painel ja esteja no idioma correto.
5. IF `LightRefStorage.readConfig()` lanca uma excecao no boot, THEN THE Plugin SHALL usar `'pt'` como Idioma_Ativo e continuar sem erro de script.

### Requirement 4: Traducao das Strings_Estaticas do index.html

**User Story:** Como usuario que usa o Plugin em Ingles, quero que todos os rotulos fixos da interface — abas, botoes, checkboxes, titulos — aparecam em Ingles quando eu escolher esse idioma.

#### Acceptance Criteria

1. WHEN `applyLanguage('en')` e chamada, THE Plugin SHALL atualizar o `textContent` ou `aria-label` de todos os elementos do `index.html` que contenham Strings_Estaticas PT, para exibir as strings EN correspondentes.
2. THE Plugin SHALL traduzir, no minimo, os seguintes grupos de elementos estaticos:
   - Abas do Inspector: "Luz" → "Light", "Lente" → "Lens", "Ajustes" → "Adjust", "Posicao" → "Position", "Composicao" → "Composition".
   - Botoes de projecao: "Persp" → "Persp" (inalterado), "Orto" → "Ortho".
   - Botoes de enquadramento: "Frente" → "Front", "3/4" → "3/4" (inalterado), "Perfil" → "Side", "Topo" → "Top".
   - Botoes de gizmo: "Rotacionar" → "Rotate", "Mover" → "Move", "Desligar" → "Off".
   - Botoes de pagina: "3D" → "3D" (inalterado), "Biblioteca" → "Library", "Cenas" → "Scenes".
   - `aria-label` do botao de ajuda, menu de ajuda, botoes de acao (exportar, salvar, importar, resetar, recolher, verificar atualizacoes) e ferramentas do visor.
   - Titulo do modal de atalhos: "Atalhos do teclado" → "Keyboard shortcuts".
   - Rotulos do popover de material: "Material" (inalterado), "Cor scatter" → "Scatter color", "Fundo" → "Background", "Transparente" → "Transparent".
   - Checkboxes da aba Ajustes: "Posterizar" → "Posterize", "Cutout" → "Cutout" (inalterado), "Preto e branco" → "Black and white".
   - Texto de carregamento: "Carregando" → "Loading".
3. WHEN `applyLanguage('pt')` e chamada apos um estado EN, THE Plugin SHALL restaurar todas as Strings_Estaticas para Portugues.
4. THE Plugin SHALL implementar a traducao de Strings_Estaticas via JS (atualizando os elementos do DOM), sem duplicar o HTML de `index.html`. (Esclarecimento (d).)
5. THE Plugin SHALL preservar o funcionamento de todos os `data-action`, `data-tab`, `data-page`, `data-projection`, `data-view`, `data-gizmo` e demais atributos funcionais ao traduzir; somente o texto visivelmente exibido e o `aria-label` sao alterados.

### Requirement 5: Traducao das Strings_Dinamicas geradas por panel.js

**User Story:** Como usuario em Ingles, quero que os sliders, headings, botoes e listas gerados dinamicamente pelo codigo tambem aparecam em Ingles, para que a experiencia seja consistente em toda a interface.

#### Acceptance Criteria

1. WHEN o Painel gera rotulos de sliders nas abas (Luz, Lente, Ajustes, Posicao), THE Plugin SHALL usar a Funcao_t para obter o texto do Idioma_Ativo em vez de literais PT.
2. THE Plugin SHALL traduzir, no minimo, os seguintes grupos de strings dinamicas:
   - Aba Luz: "Intensidade" → "Intensity", "Girar" → "Rotate", "Altura" → "Height", "Adicionar luz" (titulo do chip) → "Add light", "Remover" → "Remove".
   - Aba Lente: "Lente" → "Focal", "Enquadramento" → "Framing", "Ambiente / HDR" → "Environment / HDR", "Mapa" → "Map", "Intensidade" → "Intensity", "Mostrar fundo do HDR" → "Show HDR background", "Resetar camera" → "Reset camera".
   - Aba Ajustes: "Exposicao" → "Exposure", "Contraste" → "Contrast", "Temperatura" → "Temperature", "Saturacao" → "Saturation", "Niveis" → "Levels", "Degraus" → "Steps", "Zerar ajustes" → "Reset adjustments".
   - Aba Posicao: "Girar Y" → "Rotate Y", "Inclinar X" → "Tilt X", "Altura" → "Height", "Horizontal" → "Horizontal", "Profundidade" → "Depth", "Escala" → "Scale", "Inclinar Z" → "Tilt Z", "Salvar posicao do modelo" → "Save model position", "Centralizar / resetar" → "Center / reset".
   - Aba Composicao: "Gizmo no visor" → "Gizmo in viewport", "Ajuste por sliders" → "Adjust by sliders", "Gizmo (objeto selecionado)" → "Gizmo (selected object)", "Adicionar forma / modelo" → "Add shape / model", "Objeto" → "Object", "Objetos na cena ({n})" → "Objects in scene ({n})", "Distorcer forma" → "Deform shape", "Largura X" → "Width X", "Altura Y" → "Height Y", "Profund. Z" → "Depth Z", "Resetar forma" → "Reset shape", "+ Adicionar a cena" → "+ Add to scene".
   - Optgroup_de_Modelos: "Cabecas" → "Heads", "Bustos e Torsos" → "Busts and Torsos", "Figuras" → "Figures", "Formas basicas" → "Basic shapes", "Modelos" → "Models".
3. WHEN `applyLanguage` e chamada, THE Plugin SHALL re-renderizar a aba ativa (e os selects de modelo) para refletir o idioma novo imediatamente, sem exigir que o usuario troque de aba manualmente.
4. THE `LIGHT_NAMES` SHALL ser obtidos via Funcao_t quando adicionando ou restaurando uma luz, de modo que luzes criadas em EN recebam nomes em Ingles: "Main", "Fill", "Rim", "Cut", "Bounce".

### Requirement 6: Traducao das Strings_de_Feedback e de dialogo

**User Story:** Como usuario em Ingles, quero que as mensagens de status, erros e prompts de dialogo tambem aparecam em Ingles, para que eu nao precise entender Portugues para usar o Plugin.

#### Acceptance Criteria

1. WHEN `feedback()` e chamada, THE Plugin SHALL exibir a mensagem no Idioma_Ativo, usando a Funcao_t.
2. THE Plugin SHALL traduzir, no minimo, as seguintes Strings_de_Feedback:
   - "Luz adicionada: {nome}" → "Light added: {name}"
   - "Luz removida (Ctrl+Shift+Z desfaz)" → "Light removed (Ctrl+Shift+Z to undo)"
   - "Luz restaurada: {nome}" → "Light restored: {name}"
   - "Nenhuma luz selecionada" → "No light selected"
   - "Nada para desfazer" → "Nothing to undo"
   - "Falha ao carregar: {mensagem}" → "Failed to load: {message}"
   - "Modelo importado" → "Model imported"
   - "Falha ao importar" → "Failed to import"
   - "Verificando atualizacoes..." → "Checking for updates..."
   - "Salvando..." → "Saving..."
   - "Posicao e miniatura salvas" → "Position and thumbnail saved"
   - "Material: {nome}" → "Material: {name}"
   - "Selecione um objeto" → "Select an object"
   - "Adicionando objeto..." → "Adding object..."
   - "Objeto adicionado" → "Object added"
   - "Falha ao adicionar" → "Failed to add"
   - "Transformacao aplicada" → "Transform applied"
   - "Cancelado" → "Cancelled"
   - "Eixo: {eixo}" → "Axis: {axis}"
   - "{tipo}: mova o mouse, clique confirma, Esc cancela" → "{type}: move the mouse, click to confirm, Esc to cancel"
   - "Selecione um objeto na lista" → "Select an object in the list"
   - "Nao foi possivel abrir o seletor de cores do Photoshop" → "Could not open the Photoshop color picker"
3. WHEN um prompt de dialogo e exibido (criar categoria, renomear categoria), THE Plugin SHALL mostrar o texto do prompt no Idioma_Ativo: "Nome da categoria" → "Category name", "Nova categoria" → "New category", "Renomear categoria" → "Rename category".
4. THE Plugin SHALL traduzir os textos do Banner_de_Atualizacao e do toast de `update.js`:
   - "Atualizacao {versao}" → "Update {version}"
   - "Baixar atualizacao" → "Download update"
   - "Fechar" → "Close" (aria-label do botao de fechar do banner)
   - "Nao foi possivel verificar atualizacoes." → "Could not check for updates."
   - "Voce ja esta na versao mais recente ({versao})." → "You are already on the latest version ({version})."
5. THE Plugin SHALL traduzir os titulos e descricoes dos Grupos_de_Atalhos retornados por `buildShortcutGroups()`:
   - Titulos: "Luzes" → "Lights", "Arraste no visor (segure Shift)" → "Drag in viewport (hold Shift)", "Transformar objeto (aba Posicao)" → "Transform object (Position tab)".
   - Descricoes: "Adicionar luz" → "Add light", "Remover a luz selecionada" → "Remove selected light", "Desfazer a remocao" → "Undo removal", "Selecionar a luz pelo numero" → "Select light by number", "Girar a luz ativa (direcao e altura)" → "Rotate active light (direction and height)", "Mudar so a intensidade" → "Change intensity only", "Mudar a cor (horizontal) e a temperatura (vertical)" → "Change color (horizontal) and temperature (vertical)", "Mover" → "Move", "Escalar" → "Scale", "Rotacionar" → "Rotate", "Travar no eixo" → "Lock to axis", "Confirmar" → "Confirm", "Cancelar" → "Cancel".

### Requirement 7: Catalogo (Biblioteca e Cenas) e cabecalhos gerados

**User Story:** Como usuario em Ingles, quero que as gavetas do catalogo e os cabecalhos das secoes geradas tambem aparecem em Ingles, para que a Biblioteca e as Cenas sejam legiveis.

#### Acceptance Criteria

1. WHEN a pagina Biblioteca ou Cenas e exibida no Idioma_Ativo EN, THE Plugin SHALL exibir os rotulos das gavetas e botoes de acao do catalogo em Ingles.
2. THE Plugin SHALL traduzir, no minimo: "Biblioteca" → "Library" (cabecalho da pagina, se gerado por JS), "Cenas" → "Scenes" (idem), botao "+ Nova categoria" → "+ New category", botao de renomear categoria → "Rename", botao de deletar categoria → "Delete", titulo de gaveta do tipo cena → mantido como nome salvo pelo usuario (nao traduzido), placeholder ou mensagem de lista vazia (se houver).
3. WHEN `applyLanguage` e chamada enquanto a pagina Biblioteca ou Cenas esta visivel, THE Plugin SHALL re-renderizar o catalogo ativo para refletir o idioma novo imediatamente.
4. THE Plugin SHALL traduzir o rotulo de exibicao do botao de atualizacao no rodape: "Atualizar" → "Update".

### Requirement 8: Consistencia, sem regressao e persistencia

**User Story:** Como usuario, quero que trocar de idioma e voltar ao idioma original funcione corretamente e que nenhuma feature existente quebre por causa da internacionalizacao.

#### Acceptance Criteria

1. WHEN o usuario troca de PT para EN e depois de EN para PT, THE Plugin SHALL restaurar todos os textos PT sem necessidade de recarregar a pagina.
2. THE Plugin SHALL preservar o Estado_da_Sessao (cena 3D, luzes, camera, aba ativa) ao trocar de idioma; a troca de idioma nao deve disparar gravacao nem alteracao do Estado_da_Sessao.
3. WHEN `applyLanguage` e chamada com qualquer valor que nao seja `'pt'` nem `'en'`, THE Plugin SHALL ignorar a chamada sem gerar erro de script.
4. THE Plugin SHALL nao alterar o funcionamento de nenhum atalho, acao ou comportamento 3D ao aplicar a traducao; somente os textos visiveis sao modificados.
5. THE Plugin SHALL manter todos os 34 testes automatizados existentes passando apos a introducao do modulo `js/i18n.js` e das alteracoes em `panel.js` e `update.js`.
6. WHILE o Wizard esta visivel, THE Plugin SHALL nao sobrescrever os textos do Wizard com o mecanismo de traducao do Painel (o Wizard gerencia seus proprios textos via `onboarding.js`).

### Requirement 9: Restricoes tecnicas e testes

**User Story:** Como mantenedor do Plugin, quero que a feature de internacionalizacao respeite todas as restricoes tecnicas do projeto e seja verificavel por testes automatizados e manuais.

#### Acceptance Criteria

1. THE Plugin SHALL usar nos arquivos JS somente sintaxe ES5 e caracteres ASCII, sem build step, executando no CEF_Antigo (Chromium ~61, polyfills em `js/vendor-compat.js`) e no CEF_Atual (Chromium 99).
2. THE Plugin SHALL cobrir a logica testavel do modulo `js/i18n.js` com testes automatizados em Node usando fast-check, registrados no script `"test"` do `package.json`, sem quebrar os 34 testes ja existentes.
3. THE testes de i18n SHALL cobrir, no minimo: completude do Dicionario_de_Strings (toda chave em PT tem correspondente em EN), corretude da Funcao_t com e sem variaveis, e comportamento de fallback quando uma chave EN esta ausente.
4. WHERE a verificacao exige o Photoshop real, THE verificacao SHALL ser feita manualmente pelo usuario conforme a lista abaixo:
   - Abrir o Plugin no Photoshop 2019, 2020 e versao atual; confirmar que o Painel abre em PT por padrao.
   - Clicar em "English" no Wizard; confirmar que o Wizard muda para EN e, ao fechar, o Painel inteiro esta em EN (abas, botoes, sliders, feedback, dropdowns).
   - Trocar de aba (Luz → Lente → Ajustes → Posicao) e confirmar que os sliders e headings gerados dinamicamente aparecem em EN.
   - Adicionar e remover uma luz; confirmar que as Strings_de_Feedback aparecem em EN.
   - Verificar atualizacoes manualmente; confirmar que o toast e o banner (se houver) aparecem em EN.
   - Abrir a lista de atalhos; confirmar que o titulo, os grupos e as descricoes aparecem em EN.
   - Fechar e reabrir o Plugin; confirmar que o Painel reabre em EN sem flash de PT.
   - Chamar `applyLanguage('pt')` pelo console do Plugin; confirmar que tudo volta para PT.
   - Confirmar que a cena 3D, as luzes e a sessao restaurada permanecem intactas apos troca de idioma.
