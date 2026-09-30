# Implementation Plan: Library and Scenes Manager

## Overview

Implementacao incremental em 7 etapas testaveis, na ordem em que o usuario vai validar cada uma no Photoshop antes de seguir. Todo codigo de producao e ES5 puro e ASCII-only (sem arrow functions, let/const, classes, template literals, Promise nativa), compativel com CEF 99. Apenas os arquivos de teste PBT (fast-check, rodando em Node) podem usar sintaxe moderna.

- Etapa 1 (tarefas 1-2): fundacao de dados/storage.
- Etapa 2 (tarefas 3-5): salvar/carregar Estado_Completo (Req 13/14). Testavel sozinho.
- Etapa 3 (tarefas 6-8): render generico de catalogo com gavetas (Biblioteca).
- Etapa 4 (tarefas 9-11): deletar e categorias na Biblioteca.
- Etapa 5 (tarefas 12-13): drag-and-drop na Biblioteca.
- Etapa 6 (tarefas 14-16): Cenas no estilo da Biblioteca.
- Etapa 7 (tarefas 17-18): drag-and-drop nas Cenas.

Cada etapa termina num estado testavel pelo usuario no Photoshop.

## Tasks

### ETAPA 1 - Fundacao de dados/storage

- [ ] 1. Adicionar funcoes de categoria e estado de gaveta ao LightRefStorage
  - Em `js/storage.js`, adicionar (ES5/ASCII, todas via read-modify-write com `writeConfig`/escrita atomica):
  - `setModelCategoryOverride(itemKey, catId)`: escreve `config.modelCatOverrides[itemKey] = catId`; se `catId` for nulo/vazio, remove a chave.
  - `addModelCategory(name)`: adiciona `name` ao array `config.modelCategories` (cria se ausente).
  - `renameModelCategory(oldName, newName)`: troca o nome em `config.modelCategories` e atualiza todos os valores de `config.modelCatOverrides` que apontam para `oldName`.
  - `addSceneCategory(name)` / `renameSceneCategory(oldName, newName)`: mantem `config.sceneCategories`; no rename atualiza o campo `categoryId` das cenas correspondentes em `scenes.json`.
  - `setSceneCategory(sceneId, catId)`: le `scenes.json`, seta `categoryId` da cena alvo e regrava atomico.
  - `setDrawerState(page, catId, expanded)`: atualiza `config.drawerState[page][catId]` (cria mapas ausentes).
  - Garantir que campos ausentes de config (`modelCategories`, `modelCatOverrides`, `sceneCategories`, `drawerState`) sejam tratados como vazios na leitura.
  - _Requirements: 4.1, 4.2, 6.3, 9.1, 9.2, 12.3, 5.4, 10.4_

  - [ ]* 1.1 Escrever teste de propriedade para estado de gaveta round-trip
    - Usar stub de config em memoria para `setDrawerState`/leitura.
    - **Property 6: Estado de gaveta faz round-trip pela persistencia**
    - **Validates: Requirements 5.4, 5.5, 10.4, 10.5**

  - [ ]* 1.2 Escrever teste de propriedade para renomear categoria preservando associacao
    - Gera itens associados a uma categoria e renomeia; confere migracao de overrides/categoryId sem perda nem referencia antiga.
    - **Property 5: Renomear categoria preserva a associacao dos itens**
    - **Validates: Requirements 4.2, 9.2**

- [ ] 2. Ajustar deleteModel para sinalizar falha de unlink e definir campos de config/scenes
  - Em `js/storage.js`, alterar `deleteModel(id)` para retornar resultado estruturado: `{ ok:true, models }` em sucesso; se `fs.unlinkSync` (ou equivalente) falhar, retornar `{ ok:false, models, kept:true }` mantendo o registro em `models_index.json`.
  - Assegurar que `saveScene(name, state, thumb)` preserve o `categoryId` existente ao sobrescrever cena de mesmo nome (Req 8.3).
  - Documentar/estabelecer no codigo os novos campos de dados: config (`modelCategories`, `modelCatOverrides`, `sceneCategories`, `drawerState`) e `categoryId` por cena em `scenes.json` (leitura tolerante a ausencia).
  - _Requirements: 1.5, 8.3_

  - [ ]* 2.1 Escrever teste de exemplo para deleteModel com falha de unlink
    - Mock de `fs` que lanca no unlink; verifica `ok:false`, `kept:true` e registro preservado.
    - _Requirements: 1.5_

  - [ ]* 2.2 Escrever teste de propriedade para salvar cena sobrescrevendo por nome
    - Stub de scenes em memoria.
    - **Property 9: Salvar cena com nome existente sobrescreve sem duplicar**
    - **Validates: Requirements 8.3**

- [ ] 3. Checkpoint Etapa 1 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### ETAPA 2 - Salvar/Carregar Estado_Completo (Req 13/14)

- [ ] 4. Expandir collectState para capturar Estado_Completo
  - Em `js/panel.js`, dentro de `collectState()`, adicionar ao objeto de estado:
  - `offset: scene.getModelOffset()` (posicao X/Y/Z).
  - `scaleMult: scene.getModelScaleMult()` (escala).
  - `schema: 2` (versao do estado).
  - Confirmar que os demais campos ja capturados cobrem modelo, rotacao (yaw/pitch/roll), luzes completas, material+params, fundo, ambiente/HDR + intensidade, fx (pos-processamento) e camera (focal/projecao).
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [ ] 5. Reescrever applyScene robusto (modelo primeiro, onFail, fallback item-a-item)
  - Em `js/panel.js`, reescrever `applyScene(state)`:
  - Carregar o modelo primeiro via `loadModel(state.model, applyRest, onFail)`; `applyRest` roda apos o modelo carregar.
  - Em `applyRest`, restaurar transform: rotation (yaw/pitch/roll via `setModelRotation`/`setModelRoll`), **offset** (`setModelOffset` x/y/z) e **scaleMult** (`setModelScaleMult`).
  - Restaurar material/params/formColor, fundo, projecao, focal, environment, envIntensity; substituir luzes (remover todas + `lightManager.add` por luz); aplicar `fx` via `postfx.applyParams`.
  - Falha de modelo (Req 14.8): `onFail` chama `feedback('Falha ao carregar modelo da cena', true)` e ainda executa `applyRest()` para restaurar o que independe do modelo.
  - Fallback item-a-item (Req 14.9): cada restauracao protegida por checagem de presenca (`if (state.campo != null)`), mantendo o valor atual quando o campo estiver ausente; nunca lancar.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [ ]* 5.1 Escrever teste de propriedade round-trip do Estado_Completo
    - Fake de scene (getters/setters + lightManager em array); gera estados aleatorios, roda `collectState` -> `applyScene` e compara igualdade profunda dos campos observaveis.
    - **Property 11: Round-trip do Estado_Completo (collectState -> applyScene)**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7**

  - [ ]* 5.2 Escrever teste de propriedade para cena antiga com campos ausentes
    - Remove subconjuntos aleatorios de campos do estado; garante ausencia de excecao e preservacao do valor atual.
    - **Property 12: Cena antiga com campos ausentes nao quebra e preserva o valor atual**
    - **Validates: Requirements 14.9**

- [ ] 6. Checkpoint Etapa 2 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: salvar uma cena e recarregar.)

### ETAPA 3 - Render generico de catalogo (gavetas) - Biblioteca

- [ ] 7. Reescrever renderCatalog como dispatcher e criar render generico de gavetas
  - Em `js/panel.js`, reescrever `renderCatalog(page)` para: montar o `CatalogModel` via adaptador e delegar a `renderDrawers`.
  - Implementar `buildLibraryModel()`: le config (`modelCategories`, `modelCatOverrides`, `drawerState.library`), lista importados (`listModels()`), resolve categoria de cada item, monta a ordem de categorias (padrao + custom + "Outros" quando houver itens), aplica `expanded` do drawerState (default expandida), `canImport=true`, `canCreateCategory=true`.
  - Implementar helpers `defaultCatOf(itemKey)` (consulta `MODELS`/`SHAPES`), `categoryExists(name, cfg)` e `resolveModelCategory(itemKey, cfg)` (precedencia override > padrao > "Outros").
  - Implementar `renderDrawers(model)`: monta HTML das gavetas + `catalogToolbarHTML`, injeta em `.lr04-catalog`, chama `refreshIcons()` e liga handlers.
  - Implementar `drawerHTML(cat)`, `cardHTML(item)`, `addCardHTML()`, `catalogToolbarHTML(model)` conforme o design (ASCII, `aria-expanded`, `data-kind`/`data-id`/`data-cat`).
  - _Requirements: 3.1, 4.5, 4.6, 5.1, 7.1_

  - [ ]* 7.1 Escrever teste de propriedade para resolucao de categoria
    - Gera item + config aleatorios; verifica precedencia override > padrao > "Outros" (e "Sem categoria" para cenas).
    - **Property 2: Resolucao de categoria segue a precedencia override > padrao > fallback**
    - **Validates: Requirements 4.5, 10.3**

  - [ ]* 7.2 Escrever teste de propriedade para flag deletable do descritor
    - Gera itens de varios `kind`; verifica `deletable` true sse e somente se `mymodel` ou `scene`.
    - **Property 1: Somente importados e cenas sao deletaveis**
    - **Validates: Requirements 1.1, 1.2, 11.1**

  - [ ]* 7.3 Escrever smoke test (jsdom) da renderizacao de gavetas
    - `renderDrawers` desenha uma `.lr04-drawer` por categoria com contagem correta; card "+" so na Biblioteca e no fim de cada gaveta; "x" so em cards deletaveis.
    - _Requirements: 3.1, 5.1_

- [ ] 8. Adicionar CSS das gavetas e cards especiais
  - Em `index.css`, adicionar classes: `.lr04-drawer`, `.lr04-drawerhead`, `.lr04-drawerbody` (accordion, seta gira por `aria-expanded`), `.lr04-drawertoggle`, `.lr04-drawertools`, `.lr04-card-add` (borda tracejada, sem thumb, centralizado) e `.lr04-card-del` (canto do card, sempre visivel).
  - Reaproveitar `.lr04-gallery` e `.lr04-card` existentes.
  - _Requirements: 3.1, 5.1_

- [ ] 9. Ligar accordion (toggle) das gavetas na Biblioteca
  - Em `js/panel.js`, implementar `bindDrawerHandlers(model)`: clique/Enter/Space no `.lr04-drawerhead` alterna `aria-expanded` e `hidden` do `.lr04-drawerbody`, e persiste via `LightRefStorage.setDrawerState(page, catId, expanded)`.
  - Garantir que `buildLibraryModel()` restaure o estado a partir do drawerState no proximo render.
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [ ] 10. Checkpoint Etapa 3 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: Biblioteca com gavetas accordion e card "+".)

### ETAPA 4 - Deletar e categorias na Biblioteca

- [ ] 11. Implementar abrir/importar e deletar modelo importado com confirmacao
  - Em `js/panel.js`, implementar `bindCardHandlers(model)` e `bindCatalogActions(model)`:
  - `onCardOpen(item)`: `loadModel(url)` + `backToStudio()`.
  - Card "+" (`onAddModel`): guarda `pendingImportCat = catId` da gaveta clicada, seta `#file-input[data-import="1"]` e chama `.click()`.
  - Estender `onFilePicked()`: apos `importModel`, se `pendingImportCat` for categoria valida (diferente de "Outros"), grava `modelCatOverrides['my:'+rec.id]`; limpa `pendingImportCat`; re-renderiza a Biblioteca se aberta.
  - `onCardDelete(item)` (so `deletable`): dialogo de confirmacao (reusa `openDialog`/`closeDialog`); ao confirmar chama `deleteModel(id)`; se retorno `ok:false` chama `feedback('Falha ao remover o arquivo do modelo', true)` e mantem o card; em sucesso re-renderiza. Clique no "x" usa `stopPropagation`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.2, 3.3, 3.4, 3.5_

- [ ] 12. Implementar criar e renomear categorias de modelos
  - Em `js/panel.js`, implementar `onCreateCategory(page)` e `onRenameCategory(page, catId)` usando o dialogo de nome (reusa `openDialog`):
  - Validar vazio/so espacos (rejeita, `feedback` de erro, categorias inalteradas) e duplicado case-insensitive contra padrao + custom (rejeita com "nome ja existe").
  - Criar valido: `addModelCategory(name)` + `renderCatalog('library')`. Renomear valido: `renameModelCategory(old, new)` (migra overrides) + re-render.
  - Botao "Nova categoria" na `catalogToolbarHTML`; botao de renomear no `.lr04-drawertools` de gavetas renomeaveis (custom).
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ]* 12.1 Escrever teste de propriedade para nome vazio/espacos rejeitado
    - **Property 3: Nome de categoria vazio ou so espacos e sempre rejeitado**
    - **Validates: Requirements 4.4, 9.4**

  - [ ]* 12.2 Escrever teste de propriedade para nome duplicado rejeitado
    - **Property 4: Nome de categoria duplicado e sempre rejeitado**
    - **Validates: Requirements 4.3, 9.3**

  - [ ]* 12.3 Escrever teste de exemplo para criar categoria valida
    - Criar categoria com nome valido persiste em `config.modelCategories`.
    - _Requirements: 4.1_

- [ ] 13. Checkpoint Etapa 4 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: deletar importado com confirmacao, criar/renomear categoria.)

### ETAPA 5 - Drag-and-drop na Biblioteca

- [ ] 14. Implementar drag-and-drop de modelos entre categorias
  - Em `js/panel.js`, implementar `bindDnD(model)` com API HTML5 (compat CEF 99):
  - `dragstart` no card: guarda `dragItem = { kind, id, fromCat }`, `effectAllowed='move'`, `setData('text/plain', id)`, adiciona `.lr04-dragging`.
  - `dragover` na `.lr04-drawer`: `preventDefault()`, adiciona `.lr04-dropok`, `dropEffect='move'`.
  - `dragleave`: remove `.lr04-dropok`.
  - `drop`: `preventDefault()`, le `destCat`; se `destCat !== dragItem.fromCat`, chama `onMoveItem(dragItem, destCat, 'library')`; limpa realces.
  - `dragend`: remove `.lr04-dragging` e realces; drop invalido nao altera dados.
  - `onMoveItem` (library): `setModelCategoryOverride(itemKey, destCat)` + `renderCatalog('library')`.
  - Adicionar estados visuais `.lr04-dragging` e `.lr04-dropok` no `index.css`.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 14.1 Escrever teste de propriedade para mover para gaveta valida recategoriza
    - **Property 7: Mover para gaveta valida recategoriza o item**
    - **Validates: Requirements 6.3, 6.4, 12.3, 12.4**

  - [ ]* 14.2 Escrever teste de propriedade para drop fora de gaveta valida nao altera dados
    - **Property 8: Soltar fora de gaveta valida nao altera dados**
    - **Validates: Requirements 6.5, 12.5**

  - [ ]* 14.3 Escrever smoke test (jsdom) do feedback visual de arraste
    - `dragstart` adiciona `.lr04-dragging`; `dragover` adiciona `.lr04-dropok`.
    - _Requirements: 6.1, 6.2_

- [ ] 15. Checkpoint Etapa 5 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: arrastar modelo entre categorias.)

### ETAPA 6 - Cenas no estilo da Biblioteca

- [ ] 16. Implementar buildScenesModel e reutilizar render/handlers genericos nas Cenas
  - Em `js/panel.js`, implementar `buildScenesModel()`: le config (`sceneCategories`, `drawerState.scenes`), lista cenas (`listScenes()`), categoria de cada cena = `categoryId` (se existir em `sceneCategories`) senao "Sem categoria"; ordem custom + "Sem categoria" (quando houver); `canImport=false`; `emptyHint` quando nao ha cenas.
  - Fazer `renderCatalog('scenes')` usar o mesmo `renderDrawers`/`drawerHTML`/`cardHTML`/`bindDrawerHandlers`.
  - Toolbar de cenas: botao "Salvar cena atual" reaproveitando `saveScenePrompt()`.
  - `onCardOpen` para cena: `applyScene(scene.state)` + `backToStudio()`.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.4, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 17. Implementar deletar cena e categorias de cenas
  - Em `js/panel.js`:
  - `onCardDelete` para cena: dialogo de confirmacao; ao confirmar `deleteScene(id)` + re-render; cancelar nao altera nada. Card de cena mostra "x" (deletable).
  - `onCreateCategory('scenes')` / `onRenameCategory('scenes', catId)`: valida vazio/espacos e duplicado; usa `addSceneCategory`/`renameSceneCategory` (migra `categoryId`) + re-render.
  - Accordion das gavetas de cenas ja coberto por `bindDrawerHandlers` (persistindo `drawerState.scenes`).
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.1, 11.2, 11.3, 11.4, 11.5, 10.2, 10.4, 10.5_

  - [ ]* 17.1 Escrever teste de propriedade para deletar cena remove apenas a alvo
    - **Property 10: Deletar cena remove apenas a cena alvo**
    - **Validates: Requirements 11.4, 11.5**

- [ ] 18. Checkpoint Etapa 6 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: Cenas com gavetas, salvar/deletar/categorias.)

### ETAPA 7 - Drag-and-drop nas Cenas

- [ ] 19. Estender drag-and-drop para mover cenas entre categorias
  - Em `js/panel.js`, garantir que `bindDnD(model)` funcione para a pagina de cenas: `onMoveItem` (scenes) chama `LightRefStorage.setSceneCategory(sceneId, destCat)` + `renderCatalog('scenes')`.
  - Reutilizar o feedback visual (`.lr04-dragging`/`.lr04-dropok`) ja existente; drop invalido mantem categoria original.
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 20. Checkpoint final Etapa 7 - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. (Usuario testa: arrastar cena entre categorias.)

## Notes

- Tarefas marcadas com `*` sao opcionais (testes) e podem ser puladas para um MVP mais rapido; as tarefas de implementacao (sem `*`) devem ser executadas.
- Testes de propriedade usam fast-check em Node com 100+ iteracoes; usam fake de scene (P11/P12) e config/scenes em memoria (P3-P10). Codigo de producao permanece ES5/ASCII.
- Cada etapa termina num checkpoint testavel pelo usuario no Photoshop.
- Cada tarefa referencia os requisitos que cobre para rastreabilidade; tarefas de teste referenciam a propriedade do design.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "1.1", "1.2"] },
    { "id": 1, "tasks": ["2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5", "5.1", "5.2"] },
    { "id": 4, "tasks": ["7", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["9"] },
    { "id": 7, "tasks": ["11"] },
    { "id": 8, "tasks": ["12", "12.1", "12.2", "12.3"] },
    { "id": 9, "tasks": ["14", "14.1", "14.2", "14.3"] },
    { "id": 10, "tasks": ["16"] },
    { "id": 11, "tasks": ["17", "17.1"] },
    { "id": 12, "tasks": ["19"] }
  ]
}
```
