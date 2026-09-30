# Requirements Document

## Introduction

Esta feature reorganiza e amplia duas paginas do catalogo do plugin LightRef (extensao CEP do Adobe Photoshop, motor 3D Babylon.js, JavaScript ES5 sem build step): a **Biblioteca de Modelos** e as **Cenas Salvas**.

Hoje a Biblioteca (`renderLibrary` / `renderCatalog('library')` em `panel.js`) mostra modelos padrao (lista `MODELS`, categorias fixas no codigo), formas basicas (`SHAPES`) e "Meus modelos" (importados via `LightRefStorage.importModel`), cada um como um card em galeria de 4 colunas. As Cenas (`renderCatalog('scenes')`) sao uma lista simples de cards com nome e thumb mais um botao "Salvar cena atual".

O objetivo e:

1. **Biblioteca:** permitir deletar modelos importados, adicionar modelos por um card especial "+", categorias editaveis (renomear / criar), categorias em formato gaveta (accordion) e mover modelos entre categorias por arrastar-e-soltar.
2. **Cenas:** refazer a pagina no mesmo estilo visual da Biblioteca, com categorias de cenas criaveis, gavetas e arrastar-e-soltar para mover cenas entre categorias.
3. **Salvar / Carregar estado completo:** garantir que salvar uma cena capture todo o estado atual do estudio e que reabrir a cena restaure exatamente esse estado.

Tudo respeitando as restricoes tecnicas do plugin: ES5 sem build, JS somente ASCII, compativel com CEF 99 / Chromium 99 (sem arrow functions, `let`/`const`, classes, template literals ou Promise nativa nos arquivos do plugin), persistencia via `LightRefStorage` com escrita atomica.

### Escopo

Em escopo:

- **Area A - Biblioteca de Modelos:** deletar modelos importados, card "Adicionar modelo", categorias editaveis, gavetas (accordion), arrastar-e-soltar de modelos entre categorias.
- **Area B - Cenas Salvas:** nova UI no estilo da Biblioteca, categorias de cenas criaveis, gavetas, arrastar-e-soltar de cenas entre categorias, deletar cenas.
- **Area C - Salvar / Carregar estado completo:** capturar e restaurar todo o estado do estudio.

Fora de escopo:

- Alterar o formato de importacao de modelos (o `#file-input` e `LightRefStorage.importModel` existentes sao reutilizados sem mudanca).
- Alterar o motor 3D, o pipeline de exportacao para o Photoshop ou o fluxo de update do plugin.
- Sincronizacao em nuvem ou compartilhamento de bibliotecas/cenas entre maquinas.
- Reordenar itens dentro de uma mesma categoria (o arrastar-e-soltar move entre categorias; ordenacao fina dentro da categoria fica fora de escopo salvo esclarecimento em contrario).

### Pontos de esclarecimento (a confirmar na revisao)

Os itens abaixo foram implementados com um comportamento padrao assumido, marcado em cada requisito. Confirme ou ajuste na revisao:

- **(a) Delecao de modelos padrao:** assumido que **somente modelos importados** podem ser deletados; modelos padrao (`MODELS`) e formas basicas (`SHAPES`) nao exibem acao de deletar. (Ver Requisito 1.)
- **(b) Persistencia de categorias custom e recategorizacao:** assumido persistir em `config.json` via `LightRefStorage.writeConfig`, usando `config.modelCategories` (categorias custom de modelos, com renomeacoes), `config.modelCatOverrides` (mapa item -> categoria) para a Biblioteca; e `config.sceneCategories` + campo `categoryId` por cena em `scenes.json` para as Cenas. (Ver Requisitos 3, 4, 9, 10.)
- **(c) Itens sem categoria:** assumido que itens sem categoria atribuida caem em uma categoria padrao chamada "Outros" (modelos) / "Sem categoria" (cenas), sempre visivel quando tiver ao menos um item. (Ver Requisitos 4 e 10.)
- **(d) Confirmacao antes de deletar:** assumido que toda delecao (modelo importado ou cena) exige confirmacao explicita do usuario antes de remover. (Ver Requisitos 2 e 11.)
- **(e) Arrastar-e-soltar em CEF 99:** assumido uso de eventos HTML5 Drag and Drop (suportados no Chromium 99), com feedback visual no alvo; soltar fora de uma categoria valida cancela o movimento sem alterar dados. (Ver Requisitos 5 e 12.)

## Glossary

- **Plugin:** a extensao CEP LightRef executando dentro do Adobe Photoshop.
- **Biblioteca:** a pagina de catalogo que lista modelos 3D disponiveis para carregar (pagina "library").
- **Pagina_Cenas:** a pagina de catalogo que lista cenas salvas (pagina "scenes").
- **Modelo_Padrao:** um modelo definido no codigo na lista `MODELS` ou uma forma basica em `SHAPES`, com categoria fixa no codigo e thumbnail fixa em `models/thumbs/*.png`.
- **Modelo_Importado:** um modelo adicionado pelo usuario via importacao, registrado por `LightRefStorage` em `models_index.json` com arquivo copiado para a pasta `models`.
- **Card:** o elemento visual `.lr04-card` que representa um modelo ou uma cena, com thumbnail e nome.
- **Card_Adicionar:** um card especial com borda tracejada e um sinal "+" que inicia a importacao de um modelo.
- **Categoria:** um agrupamento nomeado de cards, exibido como uma gaveta.
- **Categoria_Custom:** uma categoria criada ou renomeada pelo usuario.
- **Gaveta:** um grupo de categoria com cabecalho clicavel que expande ou recolhe a lista de cards da categoria (accordion).
- **Cena:** um registro salvo do estado completo do estudio, guardado por `LightRefStorage` em `scenes.json`.
- **Estado_Completo:** o conjunto total de parametros do estudio no momento do salvamento (modelo, transformacoes, luzes, material, fundo, ambiente, pos-processamento, camera/lente).
- **Config:** o arquivo `config.json` acessado por `LightRefStorage.readConfig` e `LightRefStorage.writeConfig`.
- **Arrastar_Soltar:** interacao em que o usuario pressiona sobre um card, arrasta e solta sobre uma Gaveta para mover o item para aquela Categoria.
- **Storage:** o modulo `LightRefStorage` (js/storage.js) responsavel pela persistencia com escrita atomica.

## Requirements

### Area A - Biblioteca de Modelos

### Requirement 1: Selecionar modelo importado para deletar

**User Story:** Como usuario da Biblioteca, quero selecionar um Modelo_Importado para deletar, para remover modelos que nao uso mais e manter a Biblioteca organizada.

#### Acceptance Criteria

1. WHERE um Card representa um Modelo_Importado, THE Biblioteca SHALL exibir uma acao de deletar acessivel a partir do Card.
2. WHERE um Card representa um Modelo_Padrao, THE Biblioteca SHALL ocultar a acao de deletar. (Esclarecimento (a): somente importados sao deletaveis.)
3. WHEN o usuario confirma a delecao de um Modelo_Importado, THE Storage SHALL remover o registro do modelo de `models_index.json` e remover o arquivo copiado da pasta `models`.
4. WHEN a delecao de um Modelo_Importado e concluida, THE Biblioteca SHALL atualizar a galeria para deixar de exibir o Card do modelo removido.
5. IF a remocao do arquivo do modelo falha, THEN THE Plugin SHALL manter o registro do modelo no indice e exibir uma mensagem de falha ao usuario.

### Requirement 2: Confirmacao antes de deletar modelo

**User Story:** Como usuario, quero confirmar antes de deletar um modelo, para evitar remocoes acidentais.

#### Acceptance Criteria

1. WHEN o usuario aciona a acao de deletar um Modelo_Importado, THE Plugin SHALL solicitar confirmacao explicita antes de remover qualquer dado. (Esclarecimento (d).)
2. IF o usuario cancela a confirmacao de delecao, THEN THE Plugin SHALL preservar o modelo e seus arquivos sem alteracao.
3. WHEN o usuario confirma a delecao, THE Plugin SHALL prosseguir com a remocao descrita no Requisito 1.

### Requirement 3: Card "Adicionar modelo"

**User Story:** Como usuario, quero um card "+" com borda tracejada na Biblioteca, para importar um novo modelo diretamente da galeria.

#### Acceptance Criteria

1. THE Biblioteca SHALL exibir um Card_Adicionar com borda tracejada e um sinal "+" na galeria de modelos.
2. WHEN o usuario aciona o Card_Adicionar, THE Plugin SHALL abrir o seletor de arquivos de modelo reutilizando o elemento `#file-input` existente (aceitando `.obj`, `.glb`, `.gltf`, `.stl`).
3. WHEN o usuario seleciona um arquivo valido pelo seletor, THE Storage SHALL importar o modelo via `LightRefStorage.importModel` e registra-lo na Biblioteca.
4. WHEN a importacao de um modelo e concluida, THE Biblioteca SHALL exibir um novo Card para o Modelo_Importado.
5. WHERE uma Categoria esta selecionada ou expandida no momento da importacao, THE Biblioteca SHALL associar o novo Modelo_Importado a essa Categoria. (Se nenhuma, aplica-se o Requisito 4 sobre itens sem categoria.)

### Requirement 4: Categorias editaveis de modelos

**User Story:** Como usuario, quero renomear categorias existentes e criar novas categorias na Biblioteca, para organizar os modelos do meu jeito.

#### Acceptance Criteria

1. WHEN o usuario cria uma Categoria_Custom informando um nome nao vazio, THE Storage SHALL persistir a Categoria_Custom em `config.modelCategories` via `LightRefStorage.writeConfig`. (Esclarecimento (b).)
2. WHEN o usuario renomeia uma Categoria, THE Storage SHALL persistir o novo nome mantendo a associacao dos modelos daquela Categoria.
3. IF o usuario informa um nome de Categoria que ja existe, THEN THE Plugin SHALL rejeitar a criacao e exibir uma mensagem informando nome duplicado.
4. IF o usuario informa um nome de Categoria vazio ou apenas com espacos, THEN THE Plugin SHALL rejeitar a criacao e manter as categorias inalteradas.
5. WHERE um modelo nao possui Categoria atribuida, THE Biblioteca SHALL exibi-lo na Categoria padrao "Outros". (Esclarecimento (c).)
6. THE Biblioteca SHALL exibir as categorias padrao dos Modelo_Padrao ("Cabecas", "Bustos e Torsos", "Figuras", "Formas basicas") junto das Categoria_Custom.

### Requirement 5: Gavetas (accordion) na Biblioteca

**User Story:** Como usuario, quero expandir e recolher cada categoria da Biblioteca, para focar em um grupo de modelos por vez.

#### Acceptance Criteria

1. THE Biblioteca SHALL exibir cada Categoria como uma Gaveta com cabecalho contendo o nome da Categoria.
2. WHEN o usuario aciona o cabecalho de uma Gaveta expandida, THE Biblioteca SHALL recolher a Gaveta ocultando seus Cards.
3. WHEN o usuario aciona o cabecalho de uma Gaveta recolhida, THE Biblioteca SHALL expandir a Gaveta exibindo seus Cards.
4. THE Storage SHALL persistir em Config o estado expandido ou recolhido de cada Gaveta.
5. WHEN a Biblioteca e reaberta, THE Biblioteca SHALL restaurar o estado expandido ou recolhido de cada Gaveta a partir de Config.

### Requirement 6: Arrastar-e-soltar de modelos entre categorias

**User Story:** Como usuario, quero arrastar um modelo e solta-lo em outra categoria, para recategorizar modelos sem menus.

#### Acceptance Criteria

1. WHEN o usuario inicia o arraste de um Card de modelo, THE Biblioteca SHALL exibir feedback visual indicando que o Card esta sendo arrastado. (Esclarecimento (e): eventos HTML5 Drag and Drop, compativeis com CEF 99.)
2. WHILE um Card e arrastado sobre uma Gaveta valida, THE Biblioteca SHALL destacar visualmente a Gaveta alvo.
3. WHEN o usuario solta um Card de modelo sobre uma Gaveta valida, THE Storage SHALL registrar a nova Categoria do modelo em `config.modelCatOverrides` via `LightRefStorage.writeConfig`.
4. WHEN o movimento de um modelo entre categorias e concluido, THE Biblioteca SHALL exibir o Card na Categoria de destino e remove-lo da Categoria de origem.
5. IF o usuario solta um Card fora de qualquer Gaveta valida, THEN THE Biblioteca SHALL cancelar o movimento e manter a Categoria original do modelo. (Esclarecimento (e).)

### Area B - Cenas Salvas

### Requirement 7: Nova UI de Cenas no estilo da Biblioteca

**User Story:** Como usuario, quero que a pagina de Cenas tenha o mesmo estilo visual e organizacao da Biblioteca, para uma experiencia consistente.

#### Acceptance Criteria

1. THE Pagina_Cenas SHALL exibir as cenas salvas como Cards no mesmo padrao visual da Biblioteca (galeria em grade com thumbnail e nome).
2. THE Pagina_Cenas SHALL exibir uma acao para salvar a cena atual.
3. WHERE nao existe nenhuma Cena salva, THE Pagina_Cenas SHALL exibir uma mensagem orientando o usuario a salvar a cena atual.
4. WHEN o usuario aciona o Card de uma Cena, THE Plugin SHALL carregar o Estado_Completo daquela Cena conforme o Requisito 14.

### Requirement 8: Salvar cena atual

**User Story:** Como usuario, quero salvar a cena atual com um nome, para reabri-la depois.

#### Acceptance Criteria

1. WHEN o usuario informa um nome nao vazio e confirma o salvamento, THE Storage SHALL gravar a Cena via `LightRefStorage.saveScene` com o Estado_Completo e uma thumbnail.
2. IF o usuario confirma o salvamento com nome vazio ou apenas espacos, THEN THE Plugin SHALL rejeitar o salvamento e manter as cenas inalteradas.
3. WHEN uma Cena e salva com o nome de uma Cena existente, THE Storage SHALL sobrescrever o estado e a thumbnail daquela Cena existente.
4. WHEN uma Cena e salva, THE Pagina_Cenas SHALL exibir o Card da Cena na galeria.

### Requirement 9: Categorias de cenas

**User Story:** Como usuario, quero criar categorias de cenas, para agrupar cenas relacionadas.

#### Acceptance Criteria

1. WHEN o usuario cria uma Categoria de cenas informando um nome nao vazio, THE Storage SHALL persistir a Categoria em `config.sceneCategories` via `LightRefStorage.writeConfig`. (Esclarecimento (b).)
2. WHEN o usuario renomeia uma Categoria de cenas, THE Storage SHALL persistir o novo nome mantendo a associacao das cenas daquela Categoria.
3. IF o usuario informa um nome de Categoria de cenas ja existente, THEN THE Plugin SHALL rejeitar a criacao e exibir uma mensagem informando nome duplicado.
4. IF o usuario informa um nome de Categoria de cenas vazio ou apenas com espacos, THEN THE Plugin SHALL rejeitar a criacao e manter as categorias inalteradas.

### Requirement 10: Gavetas e itens sem categoria nas Cenas

**User Story:** Como usuario, quero expandir e recolher categorias de cenas e ver cenas ainda nao categorizadas, para navegar com facilidade.

#### Acceptance Criteria

1. THE Pagina_Cenas SHALL exibir cada Categoria de cenas como uma Gaveta com cabecalho contendo o nome da Categoria.
2. WHEN o usuario aciona o cabecalho de uma Gaveta de cenas, THE Pagina_Cenas SHALL alternar entre expandir e recolher a Gaveta.
3. WHERE uma Cena nao possui Categoria atribuida, THE Pagina_Cenas SHALL exibi-la na Categoria padrao "Sem categoria". (Esclarecimento (c).)
4. THE Storage SHALL persistir em Config o estado expandido ou recolhido de cada Gaveta de cenas.
5. WHEN a Pagina_Cenas e reaberta, THE Pagina_Cenas SHALL restaurar o estado expandido ou recolhido de cada Gaveta a partir de Config.

### Requirement 11: Deletar cenas com confirmacao

**User Story:** Como usuario, quero deletar cenas que nao preciso mais, com confirmacao, para evitar remocoes acidentais.

#### Acceptance Criteria

1. WHERE um Card representa uma Cena, THE Pagina_Cenas SHALL exibir uma acao de deletar acessivel a partir do Card.
2. WHEN o usuario aciona a acao de deletar uma Cena, THE Plugin SHALL solicitar confirmacao explicita antes de remover qualquer dado. (Esclarecimento (d).)
3. IF o usuario cancela a confirmacao de delecao de Cena, THEN THE Plugin SHALL preservar a Cena sem alteracao.
4. WHEN o usuario confirma a delecao de uma Cena, THE Storage SHALL remover a Cena via `LightRefStorage.deleteScene`.
5. WHEN a delecao de uma Cena e concluida, THE Pagina_Cenas SHALL deixar de exibir o Card da Cena removida.

### Requirement 12: Arrastar-e-soltar de cenas entre categorias

**User Story:** Como usuario, quero arrastar uma cena e solta-la em uma categoria, para organizar minhas cenas por arrastar-e-soltar.

#### Acceptance Criteria

1. WHEN o usuario inicia o arraste de um Card de Cena, THE Pagina_Cenas SHALL exibir feedback visual indicando que o Card esta sendo arrastado. (Esclarecimento (e).)
2. WHILE um Card de Cena e arrastado sobre uma Gaveta valida, THE Pagina_Cenas SHALL destacar visualmente a Gaveta alvo.
3. WHEN o usuario solta um Card de Cena sobre uma Gaveta valida, THE Storage SHALL registrar a nova Categoria da Cena no campo `categoryId` daquela Cena em `scenes.json` via `LightRefStorage`.
4. WHEN o movimento de uma Cena entre categorias e concluido, THE Pagina_Cenas SHALL exibir o Card na Categoria de destino e remove-lo da Categoria de origem.
5. IF o usuario solta um Card de Cena fora de qualquer Gaveta valida, THEN THE Pagina_Cenas SHALL cancelar o movimento e manter a Categoria original da Cena. (Esclarecimento (e).)

### Area C - Salvar / Carregar Estado Completo

### Requirement 13: Capturar o estado completo do estudio

**User Story:** Como usuario, quero que salvar uma cena guarde tudo do estudio, para nao perder nenhum ajuste ao reabrir.

#### Acceptance Criteria

1. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo o modelo carregado atual.
2. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo a posicao, rotacao (yaw, pitch, roll) e escala do modelo.
3. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo todas as luzes com cor, intensidade, tipo/azimute/elevacao, softness, tamanho de fonte e estado ativo.
4. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo o material atual e seus parametros.
5. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo o fundo (cor ou transparente).
6. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo o ambiente/HDR e a intensidade do ambiente.
7. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo os ajustes de pos-processamento (exposicao, contraste, temperatura, saturacao e filtros posterize, cutout e preto-e-branco).
8. WHEN uma Cena e salva, THE Plugin SHALL incluir no Estado_Completo a camera/lente (distancia focal e projecao).

### Requirement 14: Restaurar o estado completo ao carregar

**User Story:** Como usuario, quero que carregar uma cena restaure exatamente como estava, para retomar meu trabalho de onde parei.

#### Acceptance Criteria

1. WHEN o usuario carrega uma Cena, THE Plugin SHALL carregar o modelo registrado no Estado_Completo antes de aplicar os demais ajustes.
2. WHEN o modelo da Cena e carregado, THE Plugin SHALL restaurar posicao, rotacao (yaw, pitch, roll) e escala conforme o Estado_Completo.
3. WHEN o usuario carrega uma Cena, THE Plugin SHALL restaurar todas as luzes do Estado_Completo, substituindo as luzes atuais.
4. WHEN o usuario carrega uma Cena, THE Plugin SHALL restaurar o material e seus parametros conforme o Estado_Completo.
5. WHEN o usuario carrega uma Cena, THE Plugin SHALL restaurar o fundo, o ambiente/HDR e a intensidade do ambiente conforme o Estado_Completo.
6. WHEN o usuario carrega uma Cena, THE Plugin SHALL restaurar os ajustes de pos-processamento conforme o Estado_Completo.
7. WHEN o usuario carrega uma Cena, THE Plugin SHALL restaurar a distancia focal e a projecao da camera conforme o Estado_Completo.
8. IF o modelo registrado em uma Cena nao pode ser carregado, THEN THE Plugin SHALL exibir uma mensagem de falha e restaurar os demais ajustes do Estado_Completo que independem do modelo.
9. WHERE uma Cena salva por uma versao anterior nao contem um campo do Estado_Completo, THE Plugin SHALL manter o valor atual daquele ajuste sem gerar erro.
