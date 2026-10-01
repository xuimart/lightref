# Requirements Document

## Introduction

Esta feature reune tres melhorias relacionadas do plugin LightRef (extensao CEP do Adobe Photoshop, motor 3D Babylon.js, JavaScript ES5 sem build step, Windows, Photoshop 2019/2020 com CEF antigo Chromium ~61 e versoes atuais com CEF 99). As tres tratam da relacao do usuario com o painel ao longo do tempo: descobrir e aplicar atualizacoes, ser apresentado ao plugin no primeiro uso e nao perder o trabalho ao minimizar o painel.

As tres areas sao:

1. **Area A - Botao de atualizacao:** hoje a unica forma de verificar atualizacoes e clicar no texto simples "LightRef" no rodape (`.lr04-brand` em `index.html`), que nao parece um botao. Na pratica, nao existe um botao de verificar atualizacao. O **sistema de update ja existe** e vai no v0.6.0 (`js/update.js`, global `window.LightRefUpdate`): faz um GET em `https://www.xuimart.com.br/lightref/version.json`, compara semver com `LIGHTREF_VERSION` ('0.6.0') e, se a versao remota for mais nova, mostra um banner (`#lf-update-banner`) com changelog e um botao "Baixar atualizacao" que abre a URL de download no navegador padrao (`cep.util.openURLInDefaultBrowser` / `CSInterface.openURLInDefaultBrowser`). `LightRefUpdate.check(manual)` ja tem um modo manual que, via `window.LightRefToast` (mapeado para `feedback()`), diz "Voce ja esta na versao mais recente (x.y.z)." quando atualizado ou "Nao foi possivel verificar atualizacoes." em caso de falha. O `setupUpdates()` do `panel.js` ja liga o clique na marca do rodape ao `check(true)` e roda `check(false)` ~1.5s apos o carregamento. **A atualizacao NAO e automatica nem silenciosa:** o plugin apenas NOTIFICA e abre o link; o usuario roda o instalador manualmente. O que falta e um controle claramente reconhecivel (botao com icone e rotulo, nao apenas texto) para disparar a verificacao manual existente, dar feedback das etapas e mostrar a versao instalada. O sistema de update em si nao e redesenhado; `LightRefUpdate` e reutilizado.

2. **Area B - Wizard de primeiro uso (Xuimzinho / onboarding):** a logica de onboarding ja existe em `js/onboarding.js` (global `window.LightRefOnboarding` com `maybeShow(lang)`, `open(lang)`, `onLanguageChosen(cb)`): um modal full-panel com o mascote Xuimzinho, 6 passos (0..5) - passo 0 escolha de idioma PT/EN aplicada ao vivo, passos 1..4 apresentacao de recursos, passo 5 encerramento (mensagem amigavel, sem doacao). Persiste via `LightRefStorage.writeConfig({ onboardingCompleted: true, language })` e so aparece quando `config.onboardingCompleted` e falso. Porem o wizard esta **morto**: `index.html` nao carrega `js/onboarding.js`, nao tem a marcacao do modal e `panel.js` nunca chama `maybeShow()`. As imagens do mascote existem (`img/xuim_falando_normal.png` e `img/xuim_falandoolhosfechados.png`). O objetivo e fazer o wizard aparecer de fato no primeiro uso e poder ser reaberto por um controle de ajuda, seguindo o padrao do Manual de Identidade Xuimart (secao "2. Wizard de Primeiro Uso (Onboarding)").

3. **Area C - Persistencia da sessao ao minimizar:** hoje, quando o painel e minimizado, recolhido em icone, ou fechado e reaberto, ele volta do zero (Asaro + luz padrao) e perde os ajustes do usuario. **Esta spec substitui o rascunho anterior** `panel-session-persistence/requirements.md`, que fica obsoleto e cujo conteudo e incorporado aqui como Area C (nao devem coexistir duas specs sobrepostas). O v0.6.0 dispara `com.adobe.PhotoshopPersistent` (`js/to-photoshop.js keepPanelLoaded()`, chamado ao fim do `DOMContentLoaded` de `panel.js`). Isso funcionou no Photoshop 2020 (21.1.3) de um amigo do usuario, mas no Photoshop do usuario o painel ainda reseta ao minimizar. Ha relato documentado no forum da Adobe de que `com.adobe.PhotoshopPersistent` e pouco confiavel (nao impede o recarregamento) em algumas versoes, incluindo 2019/2020. Por isso a Area C deve garantir o comportamento **independente** de o Host manter ou nao o painel carregado: quando o Host recarregar `index.html` ao ocultar/minimizar/fechar dentro da mesma Sessao_do_Photoshop, o painel deve restaurar o estado anterior; uma nova Sessao_do_Photoshop inicia no Estado_Inicial (Asaro + luz padrao).

Tudo respeitando as restricoes tecnicas do plugin: ES5 sem build, JS e JSX somente ASCII, compativel com o CEF_Antigo do Photoshop 2019/2020 (Chromium ~61, polyfills em `js/vendor-compat.js`) e com o CEF_Atual (Chromium 99) das versoes atuais (sem arrow functions, `let`/`const`, classes, template literals ou Promise nativa nos arquivos do plugin), e persistencia em disco via `LightRefStorage` com escrita atomica. A verificacao dentro do Photoshop e manual (ver Requisito 16).

### Escopo

Em escopo:

- **Area A - Botao de atualizacao:** um controle visivel e reconhecivel para verificar atualizacoes (icone + rotulo), que dispara a verificacao manual existente de `LightRefUpdate`, mostra os estados (verificando / ja atualizado / banner de atualizacao disponivel / falha) e exibe a versao instalada ao usuario.
- **Area B - Wizard de primeiro uso:** fazer o wizard aparecer na primeira execucao e ser reabrivel por um controle de ajuda, seguindo o padrao Xuimart (mascote, balao de fala, dots de progresso, navegacao por passos, escolha de idioma PT/EN no Passo 0 aplicada ao vivo, padrao de modal), com conteudo que descreve os recursos reais do LightRef e um encerramento sem doacao.
- **Area C - Persistencia da sessao:** manter os ajustes (cena, camera e interface) durante a mesma Sessao_do_Photoshop apesar de Ocultacao, Reexibicao e Recarregamento_do_Painel; resetar ao Estado_Inicial somente em uma nova Sessao_do_Photoshop; restauracao tolerante a falhas; preservacao dos Dados_Persistentes.
- **Area D - Restricoes transversais (nao funcionais):** ES5/ASCII sem build, CEF_Antigo e CEF_Atual, testes em Node, verificacao manual no Photoshop.

Fora de escopo:

- Redesenhar o sistema de update (`js/update.js`, `LightRefUpdate`), o formato do `version.json` ou o fluxo do banner de download; a atualizacao continua sendo apenas notificacao + abertura do link, nunca instalacao automatica em segundo plano.
- Alterar o motor 3D, o pipeline de exportacao para o Photoshop, a importacao de modelos ou a logica de Cenas salvas.
- Manter os ajustes de uma Sessao_do_Photoshop para a seguinte (para isso continuam as Cenas salvas).
- Alterar o formato ou o comportamento de `scenes.json`, `models_index.json`, categorias, gavetas e demais chaves de `config.json` (exceto a chave de Estado_da_Sessao e `onboardingCompleted`/`language` do onboarding).
- A aba Composicao e os objetos adicionados nela (`scene.sceneObjects`), porque a aba esta oculta na interface.
- Sincronizacao em nuvem.

### Pontos de esclarecimento (a confirmar na revisao)

Os itens abaixo foram escritos com um comportamento padrao assumido, marcado em cada requisito. Confirme ou ajuste na revisao:

- **(a) Poses do mascote:** assumido usar apenas as duas imagens existentes (`xuim_falando_normal.png` e `xuim_falandoolhosfechados.png`) para a animacao de fala; falta confirmar se e preciso uma pose extra. (Ver Requisito 8.)
- **(b) Colocacao do botao de atualizacao:** assumido que o botao fica em um lugar visivel e descoberto do painel (por exemplo, no rodape ou perto da versao) e que a marca "LightRef" do rodape permanece como gatilho secundario; falta confirmar o local exato. (Ver Requisitos 1 e 3.)
- **(c) O que conta como Ocultacao (Area C):** assumido minimizar o grupo do painel, recolher em icone, trocar de aba do mesmo grupo, ocultar paineis com Tab, fechar e reabrir por Janela > Extensoes, encaixar/desencaixar/mover o painel e trocar a area de trabalho. (Ver Requisito 10.)
- **(d) Estado_Inicial apos reiniciar o Photoshop:** assumido identico ao de hoje (Asaro, uma luz "Principal" padrao selecionada, aba Luz, pagina Estudio) e as preferencias de `config.json` continuam aplicadas como hoje. (Ver Requisito 13.)
- **(e) Itens transitorios da interface (Area C):** assumido que historico de desfazer das luzes, transformacao G/S/R em andamento, modo do gizmo, dialogos/modais abertos, textos digitados e posicao de rolagem voltam ao padrao apos um Recarregamento_do_Painel.
- **(f) Modelo indisponivel ao restaurar (Area C):** assumido restaurar os demais ajustes, carregar o Asaro no lugar e avisar o usuario. (Ver Requisito 15.)
- **(g) Duas versoes do Photoshop abertas ao mesmo tempo:** assumido que cada versao mantem o seu proprio Estado_da_Sessao. (Ver Requisito 14.)

Decisoes ja confirmadas na revisao (nao sao mais pontos abertos):

- **Sem passo de doacao no Wizard:** o Wizard nao tem passo de doacao nem links de doacao. O ultimo Passo pode ser uma breve mensagem amigavel de encerramento, ou o encerramento pode ser simplesmente o ultimo Passo de recurso. (Ver Requisito 7.)
- **Idioma escolhido primeiro no Wizard:** o Passo 0 e a escolha de idioma, aplicada ao vivo. Se `config.language` ja estiver definido ao abrir o Wizard, o Passo 0 inicia com esse idioma pre-selecionado. (Ver Requisito 6.)

## Glossary

- **Plugin:** a extensao CEP LightRef executando dentro do Adobe Photoshop.
- **Host:** o Photoshop (PHXS/PHSP) que executa o Plugin.
- **Painel:** a janela do Plugin no Host (`index.html` carregado no CEF), com o Visor_3D, as abas do inspector e as paginas Estudio, Biblioteca e Cenas.
- **Visor_3D:** a area de renderizacao Babylon.js do Painel (canvas `#gl-canvas`).
- **Versao_Instalada:** a versao compilada deste build, exposta por `LightRefUpdate.VERSION` (`LIGHTREF_VERSION`).
- **Sistema_de_Update:** o modulo `js/update.js` (global `window.LightRefUpdate`) que verifica, compara e notifica atualizacoes.
- **Verificacao_Manual:** a chamada `LightRefUpdate.check(true)`, disparada por uma acao explicita do usuario, que avisa mesmo quando ja esta atualizado.
- **Verificacao_Automatica:** a chamada `LightRefUpdate.check(false)` disparada ~1.5s apos o carregamento, que so notifica quando ha versao nova.
- **Botao_de_Atualizacao:** o controle visivel e reconhecivel (icone + rotulo) que dispara a Verificacao_Manual.
- **Banner_de_Atualizacao:** o elemento `#lf-update-banner` com changelog e botao "Baixar atualizacao".
- **Wizard:** o fluxo de primeiro uso (onboarding) em modal full-panel com o mascote Xuimzinho, implementado por `window.LightRefOnboarding` em `js/onboarding.js`.
- **Mascote:** o personagem Xuimzinho exibido no Wizard, animado alternando `img/xuim_falando_normal.png` e `img/xuim_falandoolhosfechados.png`.
- **Passo:** uma tela do Wizard que faz uma unica coisa (escolha de idioma, apresentacao de um recurso ou encerramento).
- **Controle_de_Ajuda:** o controle (por exemplo `#btn-help`) que reabre o Wizard sob demanda.
- **CEF_Antigo:** o runtime CEF do Photoshop 2019 (20.x) e 2020 (21.x), com Chromium ~61.
- **CEF_Atual:** o runtime CEF das versoes atuais do Photoshop, com Chromium 99.
- **Sessao_do_Photoshop:** o periodo entre a inicializacao de uma versao do Host e o seu encerramento, normal ou anormal (falha, travamento ou encerramento forcado).
- **Ocultacao:** qualquer acao que deixa o Painel invisivel sem encerrar o Host, conforme o Esclarecimento (c).
- **Reexibicao:** a acao que torna o Painel visivel de novo apos uma Ocultacao.
- **Recarregamento_do_Painel:** o Host descarta a pagina do Painel e a carrega de novo, do zero, dentro da mesma Sessao_do_Photoshop.
- **Modelo_Padrao:** um modelo da lista `MODELS` ou uma forma basica da lista `SHAPES` em `js/panel.js`.
- **Modelo_Importado:** um modelo adicionado pelo usuario via importacao, registrado em `models_index.json`.
- **Cena:** um registro salvo por "Salvar cena" em `scenes.json`, contendo um Estado_Completo e uma thumbnail.
- **Estado_Inicial:** o estado que o Plugin produz hoje ao abrir o Painel pela primeira vez em uma Sessao_do_Photoshop, conforme o Esclarecimento (d).
- **Estado_Completo:** os ajustes de cena ja capturados por "Salvar cena" (schema 2 de `collectSceneState`/`applySceneState` em `js/panel.js`): modelo, rotacao (yaw, pitch, roll), deslocamento, escala, fundo, luzes, pos-processamento, distancia focal, projecao, material, parametros do material, cor da forma, ambiente/HDR e intensidade do ambiente.
- **Estado_da_Camera:** o enquadramento da camera orbital do Visor_3D: angulo horizontal, angulo vertical, distancia e ponto alvo.
- **Estado_da_Interface:** a pagina ativa, a aba ativa do inspector, os botoes do Visor_3D (chao, guias de luz, modo referencia, inspector recolhido), o popover de Material aberto ou fechado e a gaveta Ambiente/HDR aberta ou fechada.
- **Estado_da_Sessao:** o conjunto que o Plugin mantem durante a Sessao_do_Photoshop: Estado_Completo, luz selecionada, opcao "Mostrar fundo do HDR", Estado_da_Camera e Estado_da_Interface.
- **Captura:** a leitura do Estado_da_Sessao atual do Painel.
- **Restauracao:** a aplicacao de um Estado_da_Sessao capturado ao Painel.
- **Storage:** o modulo `LightRefStorage` (js/storage.js), responsavel pela persistencia em disco com escrita atomica.
- **Config:** o arquivo `config.json` acessado por `LightRefStorage.readConfig` e `LightRefStorage.writeConfig`.
- **Dados_Persistentes:** os dados ja mantidos pelo Storage em `%APPDATA%\LightRef`: Config (por exemplo `modelThumbs`, `modelXforms`, `bg`, `material`, `environment`, `exportMode`, `lastModel`, `onboardingCompleted`, `language`, `modelCategories`, `modelCatOverrides`, `sceneCategories`, `drawerState`), `scenes.json`, `models_index.json` e a pasta `models`.
- **Diagnostico:** o relatorio gravado por `js/diag.js` em `%APPDATA%\LightRef\diag.json`.

## Requirements

### Area A - Botao de atualizacao

### Requirement 1: Botao visivel de verificar atualizacao

**User Story:** Como usuario, quero um botao claramente reconhecivel para verificar atualizacoes, para nao depender de clicar num texto que nao parece clicavel.

#### Acceptance Criteria

1. THE Painel SHALL exibir um Botao_de_Atualizacao reconhecivel como controle acionavel, com um icone e um rotulo de texto.
2. THE Painel SHALL exibir o Botao_de_Atualizacao em um local visivel e descoberto do Painel. (Esclarecimento (b).)
3. WHEN o usuario aciona o Botao_de_Atualizacao, THE Plugin SHALL disparar a Verificacao_Manual via `LightRefUpdate.check(true)`.
4. WHERE a marca "LightRef" do rodape (`.lr04-brand`) permanece como gatilho, THE Plugin SHALL manter o seu clique disparando a Verificacao_Manual como gatilho secundario. (Esclarecimento (b).)

### Requirement 2: Feedback das etapas da verificacao manual

**User Story:** Como usuario, quero ver o que esta acontecendo quando verifico atualizacoes, para saber se esta checando, se estou atualizado ou se deu erro.

#### Acceptance Criteria

1. WHEN o usuario dispara a Verificacao_Manual, THE Plugin SHALL exibir uma indicacao de que a verificacao esta em andamento.
2. WHEN a Verificacao_Manual conclui e a Versao_Instalada ja e a mais recente, THE Plugin SHALL exibir a mensagem "Voce ja esta na versao mais recente (x.y.z)." com a Versao_Instalada.
3. WHEN a Verificacao_Manual conclui e existe uma versao mais nova que a Versao_Instalada, THE Plugin SHALL exibir o Banner_de_Atualizacao com o changelog e o botao "Baixar atualizacao".
4. IF a Verificacao_Manual nao consegue obter o `version.json`, THEN THE Plugin SHALL exibir a mensagem "Nao foi possivel verificar atualizacoes.".
5. WHEN o usuario aciona o botao "Baixar atualizacao" do Banner_de_Atualizacao, THE Plugin SHALL abrir a URL de download no navegador padrao do sistema, sem instalar nada automaticamente.

### Requirement 3: Exibir a versao instalada

**User Story:** Como usuario, quero ver qual versao do LightRef esta instalada, para saber se preciso atualizar.

#### Acceptance Criteria

1. THE Painel SHALL exibir a Versao_Instalada ao usuario de forma legivel.
2. THE Painel SHALL obter a Versao_Instalada de `LightRefUpdate.VERSION`.
3. WHERE `LightRefUpdate` nao esta disponivel, THE Painel SHALL exibir a Versao_Instalada sem gerar erro de script.

### Requirement 4: Verificacao automatica silenciosa preservada

**User Story:** Como usuario, quero ser avisado de uma versao nova sem precisar checar manualmente, mas sem ser incomodado quando ja estou atualizado.

#### Acceptance Criteria

1. WHEN o Painel termina de carregar, THE Plugin SHALL executar a Verificacao_Automatica via `LightRefUpdate.check(false)` apos um atraso de aproximadamente 1,5 segundo.
2. WHEN a Verificacao_Automatica encontra uma versao mais nova, THE Plugin SHALL exibir o Banner_de_Atualizacao.
3. WHILE a Verificacao_Automatica nao encontra versao nova, THE Plugin SHALL nao exibir mensagem nem banner.

### Area B - Wizard de primeiro uso

### Requirement 5: Exibir o Wizard na primeira execucao

**User Story:** Como novo usuario, quero ser recebido por um guia no primeiro uso, para entender rapidamente o que o LightRef faz.

#### Acceptance Criteria

1. WHEN o Painel e aberto e `config.onboardingCompleted` e falso ou ausente, THE Plugin SHALL exibir o Wizard.
2. WHEN o Painel e aberto e `config.onboardingCompleted` e verdadeiro, THE Plugin SHALL nao exibir o Wizard automaticamente.
3. WHEN o usuario conclui o Wizard, THE Storage SHALL persistir `onboardingCompleted: true` e o idioma escolhido via `LightRefStorage.writeConfig`.
4. WHEN o usuario fecha o Wizard pelo controle de fechar, THE Plugin SHALL encerrar o Wizard e persistir `onboardingCompleted: true`.
5. WHEN o Wizard e encerrado, THE Plugin SHALL interromper a animacao de fala do Mascote.

### Requirement 6: Escolha de idioma aplicada ao vivo

**User Story:** Como usuario, quero escolher o idioma logo no inicio do Wizard e ver a interface mudar na hora, para usar o plugin no meu idioma.

#### Acceptance Criteria

1. THE Wizard SHALL apresentar, no Passo 0 (o primeiro Passo), a escolha de idioma entre Portugues e Ingles.
2. WHEN o usuario escolhe um idioma no Wizard, THE Plugin SHALL aplicar esse idioma a interface imediatamente.
3. WHEN o usuario escolhe um idioma no Wizard, THE Storage SHALL registrar o idioma em `config.language` via `LightRefStorage.writeConfig`.
4. WHERE `config.language` ja esta definido ao abrir o Wizard, THE Wizard SHALL iniciar a selecao do Passo 0 nesse idioma pre-selecionado.

### Requirement 7: Passos que apresentam os recursos reais do LightRef

**User Story:** Como novo usuario, quero que o Wizard explique o que o LightRef faz de verdade, para aprender o fluxo basico de trabalho.

#### Acceptance Criteria

1. THE Wizard SHALL apresentar os recursos reais do LightRef: referencia de luz 3D dentro do Photoshop, escolher ou importar um modelo, adicionar luzes com direcao/altura/cor/intensidade, filtros de estudo em Ajustes, salvar cenas e enviar o resultado como camada do Photoshop.
2. THE Wizard SHALL fazer cada Passo tratar de um unico assunto.
3. THE Wizard SHALL permitir que o usuario avance e retroceda entre os Passos e exibir o progresso por dots.
4. WHERE o Wizard inclui um Passo final de encerramento, THE Wizard SHALL exibir uma breve mensagem amigavel de encerramento sem passo de doacao e sem links de doacao.
5. THE Wizard SHALL usar somente texto sem emoji no conteudo de producao.

### Requirement 8: Mascote Xuimzinho com animacao de fala

**User Story:** Como usuario, quero um guia amigavel durante o Wizard, para que a apresentacao seja leve e clara.

#### Acceptance Criteria

1. THE Wizard SHALL exibir o Mascote em um container com um balao de fala cujo texto muda a cada Passo.
2. WHILE o Wizard esta aberto, THE Plugin SHALL animar a fala do Mascote alternando `img/xuim_falando_normal.png` e `img/xuim_falandoolhosfechados.png`. (Esclarecimento (a).)
3. THE Wizard SHALL manter o texto do Mascote em linguagem coloquial, em primeira pessoa e sem jargao tecnico.

### Requirement 9: Reabrir o Wizard pelo controle de ajuda

**User Story:** Como usuario, quero reabrir o guia depois, para rever a apresentacao quando quiser.

#### Acceptance Criteria

1. THE Painel SHALL exibir um Controle_de_Ajuda visivel que reabre o Wizard.
2. WHEN o usuario aciona o Controle_de_Ajuda, THE Plugin SHALL abrir o Wizard mesmo que `config.onboardingCompleted` seja verdadeiro.
3. WHEN o usuario reabre o Wizard pelo Controle_de_Ajuda e o conclui ou fecha, THE Plugin SHALL manter `config.onboardingCompleted` verdadeiro.
4. THE Wizard SHALL completar em bem menos de 90 segundos para um usuario que apenas avanca os Passos.

### Area C - Persistencia da sessao ao minimizar

### Requirement 10: Manter os ajustes ao ocultar e reexibir o Painel

**User Story:** Como usuario, quero minimizar, recolher ou fechar o Painel e reabri-lo sem perder nada, para continuar de onde parei enquanto o Photoshop estiver aberto.

#### Acceptance Criteria

1. WHEN o Painel e reexibido apos uma Ocultacao na mesma Sessao_do_Photoshop, THE Plugin SHALL exibir o Estado_da_Sessao do momento da Ocultacao. (Esclarecimento (c).)
2. WHEN ocorre um Recarregamento_do_Painel na mesma Sessao_do_Photoshop, THE Plugin SHALL restaurar o Estado_da_Sessao do momento anterior ao Recarregamento_do_Painel.
3. WHEN o usuario conclui um ajuste e a Ocultacao ocorre 1 segundo ou mais depois, THE Plugin SHALL incluir o ajuste concluido no Estado_da_Sessao exibido na Reexibicao.
4. WHEN o Painel passa por varias Ocultacoes e Reexibicoes seguidas sem ajustes do usuario entre elas, THE Plugin SHALL exibir o mesmo Estado_da_Sessao apos cada Reexibicao.
5. WHEN o usuario carrega uma Cena, THE Plugin SHALL usar o resultado do carregamento como o Estado_da_Sessao mantido nas Ocultacoes seguintes.

### Requirement 11: Ajustes de cena, camera e interface mantidos

**User Story:** Como usuario, quero que modelo, luzes, material, fundo, ambiente, pos-processamento, lente, camera e navegacao da interface sobrevivam a Ocultacao, para nao refazer o estudo.

#### Acceptance Criteria

1. THE Plugin SHALL manter no Estado_da_Sessao o modelo carregado (Modelo_Padrao, Modelo_Importado ou arquivo aberto do disco) com a sua posicao, rotacao (yaw, pitch, roll) e escala.
2. THE Plugin SHALL manter no Estado_da_Sessao todas as luzes, na mesma ordem, com nome, cor, intensidade, azimute, elevacao, suavidade (softness), tamanho da fonte (sourceSize) e estado ligado ou desligado.
3. THE Plugin SHALL manter no Estado_da_Sessao a luz selecionada, identificada pela posicao na lista de luzes.
4. THE Plugin SHALL manter no Estado_da_Sessao o material, os parametros do material (rugosidade, metalico, especular, reflexo, subsurface e scatter) e a cor da forma.
5. THE Plugin SHALL manter no Estado_da_Sessao o fundo (cor solida ou transparente), o ambiente/HDR, a intensidade do ambiente e a opcao "Mostrar fundo do HDR".
6. THE Plugin SHALL manter no Estado_da_Sessao os ajustes de pos-processamento: exposicao, contraste, temperatura, saturacao, posterizar com niveis, cutout com degraus e preto-e-branco.
7. THE Plugin SHALL manter no Estado_da_Sessao a distancia focal, a projecao (perspectiva ou ortografica) e o Estado_da_Camera.
8. THE Plugin SHALL manter no Estado_da_Sessao o Estado_da_Interface: pagina ativa, aba ativa do inspector, botoes do Visor_3D (chao, guias de luz, modo referencia, inspector recolhido), popover de Material e gaveta Ambiente/HDR.

### Requirement 12: Reexibicao direta, sem passar pelo Estado_Inicial

**User Story:** Como usuario, quero que ao reabrir o Painel ele mostre direto o meu trabalho, sem piscar o Asaro nem carregar modelos a toa, para retomar rapido.

#### Acceptance Criteria

1. WHEN o Plugin restaura, apos um Recarregamento_do_Painel, um Estado_da_Sessao cujo modelo esta disponivel, THE Plugin SHALL carregar somente o modelo do Estado_da_Sessao como modelo principal.
2. WHEN o Plugin restaura um Estado_da_Sessao apos um Recarregamento_do_Painel, THE Plugin SHALL exibir exatamente as luzes do Estado_da_Sessao, sem acrescentar a luz padrao do Estado_Inicial.
3. WHILE o Plugin restaura o Estado_da_Sessao, THE Plugin SHALL exibir o indicador de carregamento do Visor_3D ate o modelo do Estado_da_Sessao terminar de carregar.
4. WHEN o Estado_da_Sessao e restaurado, THE Plugin SHALL exibir cada controle do Painel (sliders, seletores, checkboxes, chips de luz, botoes de filtro e quicksliders) e a camera com o valor correspondente do Estado_da_Sessao restaurado.
5. WHEN o Painel e reexibido sem Recarregamento_do_Painel, THE Plugin SHALL manter o modelo e os ajustes ja presentes em memoria, sem recarregar o modelo.

### Requirement 13: Iniciar no Estado_Inicial em uma nova Sessao_do_Photoshop

**User Story:** Como usuario, quero que o Painel volte ao padrao (Asaro + luz padrao) somente quando eu fechar e abrir o Photoshop, para comecar cada sessao de trabalho do jeito de sempre.

#### Acceptance Criteria

1. WHEN o Painel e aberto pela primeira vez em uma nova Sessao_do_Photoshop, THE Plugin SHALL iniciar no Estado_Inicial. (Esclarecimento (d).)
2. WHEN o Painel e aberto pela primeira vez em uma nova Sessao_do_Photoshop, THE Plugin SHALL desconsiderar o Estado_da_Sessao de qualquer Sessao_do_Photoshop anterior.
3. IF a Sessao_do_Photoshop anterior terminou de forma anormal (falha, travamento ou encerramento forcado), THEN THE Plugin SHALL iniciar no Estado_Inicial na Sessao_do_Photoshop seguinte.
4. WHEN o Plugin inicia no Estado_Inicial, THE Plugin SHALL aplicar as preferencias de Config da mesma forma que aplica hoje (material, ambiente/HDR, fundo e `modelXforms` do Asaro).

### Requirement 14: Compatibilidade e consumo de recursos com o Painel oculto

**User Story:** Como usuario do Photoshop 2019/2020 e das versoes atuais, quero o mesmo comportamento em todas elas e que o Painel oculto nao pese no Photoshop.

#### Acceptance Criteria

1. THE Plugin SHALL atender os Requisitos 10 a 13 no Photoshop 2019 (20.x), no Photoshop 2020 (21.x) e nas versoes atuais do Photoshop.
2. THE Plugin SHALL atender o Requisito 10 tanto quando o Host mantem o Painel carregado durante a Ocultacao quanto quando o Host faz um Recarregamento_do_Painel.
3. WHILE duas versoes diferentes do Host executam o Plugin ao mesmo tempo, THE Plugin SHALL manter um Estado_da_Sessao separado para cada versao do Host. (Esclarecimento (g).)
4. WHILE o Painel esta oculto e carregado pelo Host, THE Plugin SHALL suspender a renderizacao de quadros do Visor_3D.
5. WHEN o Painel e reexibido, THE Plugin SHALL retomar a renderizacao do Visor_3D em ate 1 segundo.
6. WHILE o usuario arrasta um controle continuo do Painel (slider ou seletor de cor), THE Plugin SHALL fazer no maximo uma gravacao em disco relacionada ao Estado_da_Sessao a cada 300 ms.

### Requirement 15: Robustez da restauracao e preservacao dos Dados_Persistentes

**User Story:** Como usuario, quero que o Painel sempre abra, mesmo se algo der errado ao recuperar a sessao, e que cenas, biblioteca, categorias e preferencias continuem intactas.

#### Acceptance Criteria

1. IF o Estado_da_Sessao a restaurar esta ausente, ilegivel ou corrompido, THEN THE Plugin SHALL iniciar no Estado_Inicial sem exibir erro de script.
2. IF o modelo do Estado_da_Sessao nao pode ser carregado, THEN THE Plugin SHALL carregar o modelo do Estado_Inicial, restaurar os demais ajustes do Estado_da_Sessao e exibir uma mensagem de aviso. (Esclarecimento (f).)
3. IF a Ocultacao ocorre durante o carregamento de um modelo, THEN THE Plugin SHALL restaurar o modelo cujo carregamento foi solicitado por ultimo.
4. IF o Estado_da_Sessao a restaurar nao contem um campo ou um campo tem tipo diferente do esperado ou numero nao finito, THEN THE Plugin SHALL usar o valor do Estado_Inicial para aquele campo e restaurar os demais campos.
5. IF a gravacao ou a leitura do Estado_da_Sessao falha, THEN THE Plugin SHALL continuar operando com o estado atual do Painel e registrar a falha no Diagnostico.
6. WHEN o Plugin captura ou restaura o Estado_da_Sessao, THE Storage SHALL preservar o conteudo de `scenes.json`, `models_index.json`, da pasta `models` e das chaves existentes de Config (`drawerState`, `modelXforms`, categorias e demais), exceto a chave de Estado_da_Sessao e a miniatura de Modelo_Importado que o carregamento ja grava hoje.
7. THE Plugin SHALL representar o Estado_da_Sessao somente com valores serializaveis em JSON, incluir um numero de versao do formato, e garantir que Restaurar/Capturar/serializar/desserializar produza um Estado_da_Sessao equivalente (round-trip) e que Restaurar duas vezes seguidas produza o mesmo resultado que Restaurar uma vez (idempotencia), sem duplicar luzes.

### Area D - Restricoes transversais (nao funcionais)

### Requirement 16: Restricoes tecnicas, testes e verificacao

**User Story:** Como mantenedor do Plugin, quero que estas tres areas respeitem as restricoes do projeto e sejam verificaveis, para nao quebrar a compatibilidade nem a confianca no plugin.

#### Acceptance Criteria

1. THE Plugin SHALL usar nos arquivos JS e JSX somente sintaxe ES5 e caracteres ASCII, sem build step, executando no CEF_Antigo (Chromium ~61, polyfills em `js/vendor-compat.js`) e no CEF_Atual (Chromium 99).
2. THE Plugin SHALL cobrir a logica testavel das Areas A, B e C com testes automatizados em Node usando fast-check, registrados no script "test" do `package.json`.
3. THE Plugin SHALL nao realizar instalacao automatica de atualizacoes em segundo plano; a atualizacao continua sendo notificacao e abertura do link, com o usuario rodando o instalador manualmente.
4. WHERE a verificacao exige o Photoshop real, THE verificacao SHALL ser feita manualmente pelo usuario conforme a lista abaixo:
   - Primeiro uso: o Wizard aparece automaticamente; concluir aplica o idioma e nao reaparece no proximo abrir.
   - Reabrir o Wizard pelo Controle_de_Ajuda apos ja ter concluido o onboarding.
   - Botao de atualizacao: estados verificando / ja atualizado / banner de atualizacao disponivel / falha; abrir o link de download no navegador.
   - Exibicao da versao instalada.
   - Minimizar, recolher, fechar e reabrir o Painel na mesma Sessao_do_Photoshop e confirmar que os ajustes permanecem.
   - Reiniciar o Photoshop e confirmar que o Painel inicia no Estado_Inicial.
   - Confirmar os comportamentos no Photoshop 2019, 2020 e nas versoes atuais.
   - Medir consumo de GPU/CPU com o Painel oculto (por exemplo, no Gerenciador de Tarefas).
