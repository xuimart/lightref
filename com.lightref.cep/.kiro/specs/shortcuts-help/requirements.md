# Requirements Document

## Introduction

Esta feature adiciona ao plugin LightRef (extensao CEP do Adobe Photoshop, motor 3D Babylon.js, JavaScript ES5 sem build step, Windows, Photoshop 2019/2020 com CEF antigo Chromium ~61 e versoes atuais com CEF 99) um lugar onde o usuario pode ver a lista de atalhos de teclado. Hoje os atalhos existem no codigo, mas nao ha nenhum lugar no Painel que os mostre; o usuario precisa descobri-los sozinho.

O ponto de entrada reutiliza o botao de ajuda que ja existe. Hoje o Botao_de_Ajuda (`#btn-help`, classe `lr04-help`, no canto superior direito do Visor_3D em `index.html`) reabre diretamente o Wizard de onboarding: `js/onboarding.js` em `bind()` faz `help.addEventListener('click', function(){ open(lang); })`. Esta feature troca esse clique direto por um pequeno menu (popover) com dois itens: **"Rever introducao"** (abre o Wizard existente, `window.LightRefOnboarding.open(lang)`, sem mudar o comportamento dele) e **"Atalhos"** (abre a lista de atalhos de teclado). Um botao, duas acoes.

A lista de atalhos deve usar o mesmo estilo visual do Wizard do Xuimzinho (o padrao de modal/card `.lr04-ob-modal` / `.lr04-ob-card` e/ou `.lr04-modal` da secao 2 do `MANUAL_IDENTIDADE_UI_XUIMART.md`), para parecer que pertence ao mesmo conjunto. A lista mostra apenas os atalhos reais que ja existem no codigo, agrupados por contexto, cada linha com a combinacao de teclas e uma descricao curta. E uma feature de **exibicao**: nao altera, adiciona nem remove nenhum comportamento de atalho; nao reconfigura nem personaliza atalhos.

Os atalhos reais, confirmados no codigo (`js/panel.js` `bindLightKeys`/`bindCompKeys` e `js/scene.js` `_bindLightShortcut`), sao:

1. **Luzes (aba Luz):** `Ctrl+Shift+A` adiciona luz; `Ctrl+Shift+X` remove a luz selecionada; `Ctrl+Shift+Z` desfaz a remocao; `Ctrl+Shift+1..9` seleciona a luz pelo numero.
2. **Arraste no visor (segurando Shift, botao esquerdo do mouse):** `Shift+arrastar` gira a luz ativa (azimute e altura); `Ctrl+Shift+arrastar` muda so a intensidade; `Ctrl+Shift+Alt+arrastar` muda a cor (horizontal = matiz) e a temperatura (vertical).
3. **Transformar objeto (aba Posicao, sem campo de texto focado):** `G` mover, `S` escalar, `R` rotacionar; `X`/`Y`/`Z` travar no eixo; `Enter` confirma; `Esc` cancela. (O mesmo handler `bindCompKeys` atende as abas Posicao e Composicao, mas a aba Composicao esta oculta na interface, entao estes atalhos sao apresentados no contexto da aba Posicao.)

Tudo respeitando as restricoes tecnicas do plugin: ES5 sem build, JS e JSX somente ASCII, sem emoji (regra de identidade), compativel com o CEF_Antigo do Photoshop 2019/2020 (Chromium ~61, polyfills em `js/vendor-compat.js`) e com o CEF_Atual (Chromium 99). A verificacao dentro do Photoshop e manual (ver Requisito 7).

### Escopo

Em escopo:

- Trocar o clique do Botao_de_Ajuda (`#btn-help`) para abrir um pequeno Menu_de_Ajuda (popover) com dois itens: "Rever introducao" e "Atalhos".
- "Rever introducao" abre o Wizard existente (`LightRefOnboarding.open`), sem alterar o comportamento do Wizard.
- "Atalhos" abre a Lista_de_Atalhos: um painel/modal com o estilo visual do Wizard do Xuimzinho, listando os atalhos reais acima, agrupados (Luzes / Arraste no visor / Transformar objeto), cada linha com a combinacao de teclas e uma descricao curta.
- A Lista_de_Atalhos e dispensavel (botao de fechar, clique fora, Esc) e nao perturba a cena 3D nem a sessao restaurada (a persistencia da Area C do spec anterior nao pode ser afetada).
- Funcionar no CEF_Antigo e no CEF_Atual; ES5/ASCII; acessivel pelo teclado e rotulado para leitor de tela.

Fora de escopo:

- Alterar, adicionar ou remover qualquer comportamento de atalho real; esta feature e somente exibicao.
- Reconfigurar ou personalizar atalhos.
- Traduzir o painel inteiro; a internacionalizacao completa continua fora de escopo, como no spec anterior.

### Pontos de esclarecimento (a confirmar na revisao)

Os itens abaixo foram escritos com um comportamento padrao assumido, marcado em cada requisito. Confirme ou ajuste na revisao:

- **(a) Mascote na Lista_de_Atalhos:** assumido usar o mesmo estilo de card do Wizard, com o Mascote opcional ou omitido para manter a lista compacta (uma lista com titulo no estilo visual do Wizard, sem exigir o Xuimzinho). Falta confirmar se a Lista_de_Atalhos deve mostrar o Mascote tambem. (Ver Requisito 3.)
- **(b) Menu x acao direta:** assumido que o Botao_de_Ajuda passa a abrir um Menu_de_Ajuda de dois itens e NAO reabre mais o Wizard diretamente (hoje o `#btn-help` abre o Wizard direto). Falta confirmar que o comportamento direto deve ser substituido pelo menu. (Ver Requisitos 1 e 2.)
- **(c) Idioma do conteudo:** assumido Portugues (PT) agora para os rotulos do menu e as descricoes dos atalhos. Ingles (EN) so se o mecanismo de idioma do Wizard (`config.language`) tornar isso barato de implementar; caso contrario, PT e o minimo. (Ver Requisitos 4 e 6.)

## Glossary

- **Plugin:** a extensao CEP LightRef executando dentro do Adobe Photoshop.
- **Host:** o Photoshop (PHXS/PHSP) que executa o Plugin.
- **Painel:** a janela do Plugin no Host (`index.html` carregado no CEF), com o Visor_3D, as abas do inspector e as paginas Estudio, Biblioteca e Cenas.
- **Visor_3D:** a area de renderizacao Babylon.js do Painel (canvas `#gl-canvas`).
- **Botao_de_Ajuda:** o controle existente `#btn-help` (classe `lr04-help`), no canto superior direito do Visor_3D, hoje usado para reabrir o Wizard.
- **Menu_de_Ajuda:** o pequeno menu (popover) aberto pelo Botao_de_Ajuda, com os itens "Rever introducao" e "Atalhos".
- **Wizard:** o fluxo de onboarding em modal full-panel com o mascote Xuimzinho, implementado por `window.LightRefOnboarding` em `js/onboarding.js`, aberto por `LightRefOnboarding.open(lang)`.
- **Mascote:** o personagem Xuimzinho usado no Wizard (`img/xuim_falando_normal.png` e `img/xuim_falandoolhosfechados.png`).
- **Lista_de_Atalhos:** o painel/modal aberto pelo item "Atalhos" do Menu_de_Ajuda, que mostra os atalhos de teclado agrupados, no estilo visual do Wizard.
- **Estilo_do_Wizard:** o padrao visual de modal/card do Wizard do Xuimzinho (`.lr04-ob-modal` / `.lr04-ob-card` e/ou `.lr04-modal`), descrito na secao 2 do `MANUAL_IDENTIDADE_UI_XUIMART.md`.
- **Grupo_de_Atalhos:** uma secao da Lista_de_Atalhos que reune atalhos de um mesmo contexto: Luzes, Arraste no visor ou Transformar objeto.
- **Combinacao_de_Teclas:** a representacao textual de um atalho (por exemplo `Ctrl+Shift+A`, `Shift+arrastar`, `G`).
- **Dados_dos_Atalhos:** a estrutura de dados no Painel que descreve os Grupos_de_Atalhos e suas linhas (combinacao + descricao), mantida em sincronia com os atalhos reais do codigo.
- **Estado_da_Sessao:** o estado de cena, camera e interface que o Plugin mantem durante a Sessao_do_Photoshop, conforme o spec `update-button-wizard-and-session` (Area C).
- **CEF_Antigo:** o runtime CEF do Photoshop 2019 (20.x) e 2020 (21.x), com Chromium ~61.
- **CEF_Atual:** o runtime CEF das versoes atuais do Photoshop, com Chromium 99.

## Requirements

### Requirement 1: Botao de ajuda abre um menu de duas opcoes

**User Story:** Como usuario, quero clicar no botao de ajuda e ver duas opcoes claras, para escolher entre rever a introducao e ver os atalhos.

#### Acceptance Criteria

1. WHEN o usuario aciona o Botao_de_Ajuda, THE Plugin SHALL exibir o Menu_de_Ajuda com exatamente dois itens: "Rever introducao" e "Atalhos".
2. WHEN o usuario aciona o Botao_de_Ajuda e o Menu_de_Ajuda ja esta aberto, THE Plugin SHALL fechar o Menu_de_Ajuda.
3. WHEN o usuario clica fora do Menu_de_Ajuda, THE Plugin SHALL fechar o Menu_de_Ajuda.
4. WHEN o usuario pressiona Esc com o Menu_de_Ajuda aberto, THE Plugin SHALL fechar o Menu_de_Ajuda.
5. THE Plugin SHALL posicionar o Menu_de_Ajuda proximo ao Botao_de_Ajuda, sem cobrir o proprio Botao_de_Ajuda.

### Requirement 2: Botao de ajuda deixa de reabrir o Wizard diretamente

**User Story:** Como usuario, quero que o botao de ajuda leve ao menu, para que a introducao seja uma das opcoes e nao a unica acao.

#### Acceptance Criteria

1. WHEN o usuario aciona o Botao_de_Ajuda, THE Plugin SHALL abrir o Menu_de_Ajuda em vez de abrir o Wizard diretamente. (Esclarecimento (b).)
2. WHEN o usuario seleciona "Rever introducao" no Menu_de_Ajuda, THE Plugin SHALL abrir o Wizard via `LightRefOnboarding.open` com o idioma atual, sem alterar o comportamento do Wizard.
3. WHEN o usuario seleciona "Rever introducao" e conclui ou fecha o Wizard, THE Plugin SHALL manter `config.onboardingCompleted` verdadeiro, como no comportamento atual do Wizard.
4. WHEN o usuario seleciona um item do Menu_de_Ajuda, THE Plugin SHALL fechar o Menu_de_Ajuda antes de executar a acao escolhida.
5. WHERE `window.LightRefOnboarding` nao esta disponivel, THE Plugin SHALL manter o Menu_de_Ajuda e o item "Atalhos" funcionando sem gerar erro de script.

### Requirement 3: Lista de atalhos no estilo do Wizard

**User Story:** Como usuario, quero que a lista de atalhos tenha a mesma cara do guia do Xuimzinho, para que pareca parte do mesmo plugin.

#### Acceptance Criteria

1. WHEN o usuario seleciona "Atalhos" no Menu_de_Ajuda, THE Plugin SHALL exibir a Lista_de_Atalhos.
2. THE Plugin SHALL apresentar a Lista_de_Atalhos usando o Estilo_do_Wizard (padrao de modal/card `.lr04-ob-modal` / `.lr04-ob-card` e/ou `.lr04-modal`).
3. THE Lista_de_Atalhos SHALL exibir um titulo que identifica o conteudo como a lista de atalhos de teclado.
4. WHERE a Lista_de_Atalhos exibe o Mascote, THE Lista_de_Atalhos SHALL usar as imagens de Mascote ja existentes, sem exigir uma pose nova. (Esclarecimento (a).)
5. THE Plugin SHALL manter o conteudo da Lista_de_Atalhos somente em texto sem emoji e somente em caracteres ASCII nos arquivos JS/JSX.

### Requirement 4: Conteudo da lista reflete os atalhos reais, agrupados

**User Story:** Como usuario, quero ver os atalhos reais do LightRef organizados por contexto, para encontrar rapido o que preciso.

#### Acceptance Criteria

1. THE Lista_de_Atalhos SHALL organizar os atalhos em tres Grupos_de_Atalhos: "Luzes", "Arraste no visor" e "Transformar objeto".
2. THE Lista_de_Atalhos SHALL exibir cada atalho em uma linha com a Combinacao_de_Teclas e uma descricao curta da acao.
3. THE Grupo_de_Atalhos "Luzes" SHALL listar: `Ctrl+Shift+A` adiciona luz; `Ctrl+Shift+X` remove a luz selecionada; `Ctrl+Shift+Z` desfaz a remocao; `Ctrl+Shift+1..9` seleciona a luz pelo numero.
4. THE Grupo_de_Atalhos "Arraste no visor" SHALL listar, segurando Shift com o botao esquerdo do mouse: `Shift+arrastar` gira a luz ativa (azimute e altura); `Ctrl+Shift+arrastar` muda so a intensidade; `Ctrl+Shift+Alt+arrastar` muda a cor (horizontal = matiz) e a temperatura (vertical).
5. THE Grupo_de_Atalhos "Transformar objeto" SHALL listar, no contexto da aba Posicao e sem campo de texto focado: `G` mover, `S` escalar, `R` rotacionar; `X`/`Y`/`Z` travar no eixo; `Enter` confirma; `Esc` cancela.
6. THE Plugin SHALL definir o conteudo da Lista_de_Atalhos como Dados_dos_Atalhos no Painel, para manter a lista em sincronia com os atalhos reais do codigo.
7. THE Lista_de_Atalhos SHALL exibir somente os atalhos definidos nos Dados_dos_Atalhos, sem inventar atalhos inexistentes.

### Requirement 5: Dispensar a lista sem perturbar a cena nem a sessao

**User Story:** Como usuario, quero fechar a lista de atalhos facilmente e voltar ao meu trabalho exatamente como estava, para nao perder o estudo.

#### Acceptance Criteria

1. THE Lista_de_Atalhos SHALL oferecer um controle de fechar visivel.
2. WHEN o usuario aciona o controle de fechar da Lista_de_Atalhos, THE Plugin SHALL fechar a Lista_de_Atalhos.
3. WHEN o usuario clica fora da Lista_de_Atalhos, THE Plugin SHALL fechar a Lista_de_Atalhos.
4. WHEN o usuario pressiona Esc com a Lista_de_Atalhos aberta, THE Plugin SHALL fechar a Lista_de_Atalhos.
5. WHILE a Lista_de_Atalhos esta aberta ou e fechada, THE Plugin SHALL preservar o Estado_da_Sessao da cena 3D sem alteracao.
6. WHEN a Lista_de_Atalhos e aberta ou fechada, THE Plugin SHALL nao disparar gravacao nem alteracao do Estado_da_Sessao restaurado.

### Requirement 6: Acessibilidade e idioma

**User Story:** Como usuario de teclado ou de leitor de tela, quero navegar pelo menu e pela lista de atalhos sem mouse, para usar a feature com qualquer forma de interacao.

#### Acceptance Criteria

1. THE Botao_de_Ajuda SHALL expor um rotulo acessivel que descreve a abertura do Menu_de_Ajuda.
2. THE Menu_de_Ajuda SHALL permitir foco e acionamento de cada item por teclado.
3. THE Lista_de_Atalhos SHALL expor um rotulo acessivel e permitir que o controle de fechar seja acionado por teclado.
4. THE Plugin SHALL apresentar os rotulos do Menu_de_Ajuda e as descricoes dos atalhos em Portugues. (Esclarecimento (c).)
5. WHERE o mecanismo de idioma do Wizard (`config.language`) torna barato alternar PT/EN, THE Plugin SHALL exibir os rotulos e as descricoes no idioma selecionado; caso contrario, THE Plugin SHALL exibir em Portugues. (Esclarecimento (c).)

### Requirement 7: Restricoes tecnicas, testes e verificacao

**User Story:** Como mantenedor do Plugin, quero que esta feature respeite as restricoes do projeto e seja verificavel, para nao quebrar a compatibilidade nem a confianca no plugin.

#### Acceptance Criteria

1. THE Plugin SHALL usar nos arquivos JS e JSX somente sintaxe ES5 e caracteres ASCII, sem build step, executando no CEF_Antigo (Chromium ~61, polyfills em `js/vendor-compat.js`) e no CEF_Atual (Chromium 99).
2. THE Plugin SHALL nao alterar, adicionar nem remover nenhum comportamento de atalho real; esta feature apenas exibe os atalhos existentes.
3. THE Plugin SHALL cobrir a logica testavel desta feature (os Dados_dos_Atalhos e a montagem da Lista_de_Atalhos) com testes automatizados em Node usando fast-check, registrados no script "test" do `package.json`, sem quebrar os testes ja existentes.
4. WHERE a verificacao exige o Photoshop real, THE verificacao SHALL ser feita manualmente pelo usuario conforme a lista abaixo:
   - Abrir o Botao_de_Ajuda e confirmar que aparece o Menu_de_Ajuda com "Rever introducao" e "Atalhos".
   - Selecionar "Rever introducao" e confirmar que o Wizard abre como antes.
   - Selecionar "Atalhos" e confirmar que a Lista_de_Atalhos aparece no estilo do Wizard, com os tres grupos e os atalhos reais.
   - Fechar a Lista_de_Atalhos pelo botao de fechar, por clique fora e por Esc.
   - Confirmar que a cena 3D e a sessao restaurada permanecem iguais depois de abrir e fechar a Lista_de_Atalhos.
   - Confirmar os comportamentos no Photoshop 2019, 2020 e nas versoes atuais.
