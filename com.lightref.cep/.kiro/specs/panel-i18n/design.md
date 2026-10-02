# Design Document: panel-i18n

## Overview

This feature adds full PT/EN bilingual support to the LightRef panel by introducing a
central i18n module (`js/i18n.js`) and wiring it into `panel.js` and `update.js`.

The approach is minimal-footprint: one new file, two modified files, zero new DOM
structure, zero build steps. The dictionary is a plain ES5 object; the translation
function `t(key, vars)` is a pure lookup with variable substitution. `applyLanguage`
is extended to call `LightRefI18n.setLang()`, update static DOM elements via
`applyStaticStrings()`, and re-render all dynamic sections.

---

## Architecture

```
index.html (load order)
  storage.js
  i18n.js          <-- NEW: window.LightRefI18n + window.__lrI18nApi
  lights.js
  ...
  update.js        <-- MODIFIED: uses LightRefI18n.t() for banner/toast strings
  onboarding.js
  session.js
  panel.js         <-- MODIFIED: applyLanguage, applyStaticStrings, all render fns
```

Dependency direction: `i18n.js` has no dependencies. `panel.js` and `update.js`
read from `window.LightRefI18n` if available; they degrade gracefully if it is
absent (guard pattern identical to other window globals already used in the project).

---

## Components and Interfaces

### js/i18n.js (new)

An ES5 IIFE that exposes two globals:

```
window.LightRefI18n = {
  strings: { pt: {...}, en: {...} },   // full dictionary
  setLang(lang),                        // 'pt' | 'en'; silent ignore otherwise
  getLang(),                            // returns current lang string
  t(key, vars)                          // translate + interpolate
}
window.__lrI18nApi = {                  // test surface (same refs)
  t, setLang, getLang, strings
}
```

#### t(key, vars)

1. Look up `LightRefI18n.strings[_lang][key]`.
2. If missing in active lang but lang is 'en', fall back to `strings['pt'][key]`.
3. If still missing, fall back to `key` itself (no error).
4. For each entry in `vars`, replace every occurrence of `'{varname}'` in the
   result string using a global `String.replace` with a regex.
5. Pure function — no DOM access, no side effects.

### Additions to panel.js

#### getLightNames()

Replaces the `LIGHT_NAMES` constant array. Returns a fresh array each call:

```js
function getLightNames() {
  var _ = window.LightRefI18n;
  if (!_) return ['Principal','Preenchimento','Contorno','Recorte','Rebote'];
  return [_.t('lightMain'), _.t('lightFill'), _.t('lightRim'),
          _.t('lightCut'), _.t('lightBounce')];
}
```

`nextLightName()` and all callers of `LIGHT_NAMES` are updated to call
`getLightNames()` instead.

#### applyStaticStrings()

Queries stable DOM selectors and writes `textContent`, `aria-label`, or
`data-tooltip`. Guards every element lookup (`if (!el) return`). Called from
`applyLanguage` before `renderTab()`.

See the full element map in the Dictionary section below.

#### applyLanguage(lang) — extended

```js
function applyLanguage(lang) {
  if (lang !== 'pt' && lang !== 'en') return;
  try { LightRefStorage.writeConfig({ language: lang }); } catch (e) {}
  if (window.LightRefI18n && window.LightRefI18n.setLang) {
    window.LightRefI18n.setLang(lang);
  }
  applyStaticStrings();
  renderTab();
  fillModelSelect();
  fillAddTypeSelect();
  if (currentPage === 'library' || currentPage === 'scenes') {
    renderCatalog(currentPage);
  }
}
```

DOMContentLoaded boot calls `applyLanguage(curLang)` early — after config is read
and the wizard hooks are registered, but before `fillModelSelect`, `fillAddTypeSelect`,
`initScene`, and `startDefaultScene`. This ensures static strings are PT or EN from
frame zero, with no flash.

### Modifications to update.js

Guard pattern at the top of both `showBanner` and `check`:

```js
var _ = (window.LightRefI18n && window.LightRefI18n.t)
  ? window.LightRefI18n
  : { t: function(k){ return k; } };
```

Then replace every hardcoded PT string with `_.t('key')` or `_.t('key', {vars})`.

---

## Data Models

### Full Dictionary

All strings are ASCII-only. The `strings` object is the single source of truth.

```js
strings = {
  pt: {
    // --- Tabs ---
    tabLight: 'Luz',
    tabLens: 'Lente',
    tabAdjust: 'Ajustes',
    tabPosition: 'Posicao',
    tabComposition: 'Composicao',
    // --- Projection / Views ---
    projOrtho: 'Orto',
    viewFront: 'Frente',
    viewSide: 'Perfil',
    viewTop: 'Topo',
    // --- Gizmo ---
    gizmoRotate: 'Rotacionar',
    gizmoMove: 'Mover',
    gizmoOff: 'Desligar',
    // --- Pages ---
    pageLibrary: 'Biblioteca',
    pageScenes: 'Cenas',
    // --- Light tab ---
    labelColor: 'Cor',
    lightIntensity: 'Intensidade',
    lightRotate: 'Girar',
    lightHeight: 'Altura',
    lightAdd: 'Adicionar luz',
    lightRemove: 'Remover',
    // --- Light names ---
    lightMain: 'Principal',
    lightFill: 'Preenchimento',
    lightRim: 'Contorno',
    lightCut: 'Recorte',
    lightBounce: 'Rebote',
    // --- Lens tab ---
    lensLabel: 'Lente',
    lensFraming: 'Enquadramento',
    lensEnvSection: 'Ambiente / HDR',
    lensEnvMap: 'Mapa',
    lensEnvIntensity: 'Intensidade',
    lensEnvBg: 'Mostrar fundo do HDR',
    lensResetCamera: 'Resetar camera',
    // --- Adjust tab ---
    adjExposure: 'Exposicao',
    adjContrast: 'Contraste',
    adjTemperature: 'Temperatura',
    adjSaturation: 'Saturacao',
    adjLevels: 'Niveis',
    adjSteps: 'Degraus',
    adjReset: 'Zerar ajustes',
    // --- Checkboxes (adjust static) ---
    checkPosterize: 'Posterizar',
    checkCutout: 'Cutout',
    checkGray: 'Preto e branco',
    // --- Position tab ---
    posRotateY: 'Girar Y',
    posTiltX: 'Inclinar X',
    posHeight: 'Altura',
    posHorizontal: 'Horizontal',
    posDepth: 'Profundidade',
    posScale: 'Escala',
    posTiltZ: 'Inclinar Z',
    posSave: 'Salvar posicao do modelo',
    posCenter: 'Centralizar / resetar',
    posHint: 'Atalhos: G mover, S escala, R rotacao (RR livre). X/Y/Z travam eixo, clique confirma, Esc cancela.',
    // --- Composition tab ---
    compGizmoSection: 'Gizmo no visor',
    compSliderSection: 'Ajuste por sliders',
    compGizmoObj: 'Gizmo (objeto selecionado)',
    compAddSection: 'Adicionar forma / modelo',
    compObjLabel: 'Objeto',
    compCount: 'Objetos na cena ({n})',
    compDeform: 'Distorcer forma',
    compWidthX: 'Largura X',
    compHeightY: 'Altura Y',
    compDepthZ: 'Profund. Z',
    compResetShape: 'Resetar forma',
    compAddBtn: '+ Adicionar a cena',
    // --- Material section static ---
    labelMaterial: 'Material',
    labelScatterColor: 'Cor scatter',
    labelBackground: 'Fundo',
    labelTransparent: 'Transparente',
    // --- Model select optgroups ---
    ogHeads: 'Cabecas',
    ogBusts: 'Bustos e Torsos',
    ogFigures: 'Figuras',
    ogShapes: 'Formas basicas',
    ogModels: 'Modelos',
    // --- Action buttons aria-labels / tooltips ---
    actionExport: 'Jogar no Photoshop',
    actionSave: 'Salvar cena',
    actionImport: 'Importar modelo',
    actionReset: 'Resetar cena',
    actionResetView: 'Resetar visao',
    actionCollapse: 'Recolher controles',
    toggleFloor: 'Chao',
    toggleGuides: 'Guias das luzes',
    toggleReference: 'Modo referencia',
    toggleMaterial: 'Abrir materiais',
    btnUpdateAria: 'Verificar atualizacoes',
    btnHelp: 'Rever introducao',
    btnUpdate: 'Atualizar',
    // --- UI misc ---
    shortcutsTitle: 'Atalhos do teclado',
    menuIntro: 'Rever introducao',
    menuShortcuts: 'Atalhos',
    textLoading: 'Carregando',
    // --- Feedback / errors ---
    fbLightAdded: 'Luz adicionada: {nome}',
    fbLightRemoved: 'Luz removida (Ctrl+Shift+Z desfaz)',
    fbLightRestored: 'Luz restaurada: {nome}',
    fbNoLight: 'Nenhuma luz selecionada',
    fbNoUndo: 'Nada para desfazer',
    fbLoadFail: 'Falha ao carregar',
    fbImported: 'Modelo importado',
    fbImportFail: 'Falha ao importar',
    fbChecking: 'Verificando atualizacoes...',
    fbSaving: 'Salvando...',
    fbSaved: 'Posicao e miniatura salvas',
    fbMaterial: 'Material: {nome}',
    fbSelectObj: 'Selecione um objeto',
    fbAddingObj: 'Adicionando objeto...',
    fbObjAdded: 'Objeto adicionado',
    fbAddFail: 'Falha ao adicionar',
    fbTransformApplied: 'Transformacao aplicada',
    fbCancelled: 'Cancelado',
    fbAxis: 'Eixo: {eixo}',
    fbXformStart: '{tipo}: mova o mouse, clique confirma, Esc cancela',
    fbSelectInList: 'Selecione um objeto na lista',
    fbColorPicker: 'Nao foi possivel abrir o seletor de cores do Photoshop',
    fbDeleteFail: 'Falha ao remover o arquivo do modelo',
    fbCatCreateFail: 'Falha ao criar categoria',
    fbCatRenameFail: 'Falha ao renomear categoria',
    // --- Dialogs ---
    dlgCatName: 'Nome da categoria',
    dlgNewCat: 'Nova categoria',
    dlgRenameCat: 'Renomear categoria',
    // --- Catalog ---
    catNewCategory: '+ Nova categoria',
    catRename: 'Renomear',
    catDelete: 'Deletar',
    // --- Update banner/toast ---
    updTitle: 'Atualizacao {versao}',
    updDownload: 'Baixar atualizacao',
    updClose: 'Fechar',
    updFail: 'Nao foi possivel verificar atualizacoes.',
    updCurrent: 'Voce ja esta na versao mais recente ({versao}).',
    // --- Shortcuts data ---
    scGrpLights: 'Luzes',
    scGrpDrag: 'Arraste no visor (segure Shift)',
    scGrpTransform: 'Transformar objeto (aba Posicao)',
    scAddLight: 'Adicionar luz',
    scRemoveLight: 'Remover a luz selecionada',
    scUndoRemove: 'Desfazer a remocao',
    scSelectByNum: 'Selecionar a luz pelo numero',
    scDragRotate: 'Girar a luz ativa (direcao e altura)',
    scDragIntensity: 'Mudar so a intensidade',
    scDragColor: 'Mudar a cor (horizontal) e a temperatura (vertical)',
    scMove: 'Mover',
    scScale: 'Escalar',
    scRotate: 'Rotacionar',
    scLockAxis: 'Travar no eixo',
    scConfirm: 'Confirmar',
    scCancel: 'Cancelar'
  },
  en: {
    // --- Tabs ---
    tabLight: 'Light',
    tabLens: 'Lens',
    tabAdjust: 'Adjust',
    tabPosition: 'Position',
    tabComposition: 'Composition',
    // --- Projection / Views ---
    projOrtho: 'Ortho',
    viewFront: 'Front',
    viewSide: 'Side',
    viewTop: 'Top',
    // --- Gizmo ---
    gizmoRotate: 'Rotate',
    gizmoMove: 'Move',
    gizmoOff: 'Off',
    // --- Pages ---
    pageLibrary: 'Library',
    pageScenes: 'Scenes',
    // --- Light tab ---
    labelColor: 'Color',
    lightIntensity: 'Intensity',
    lightRotate: 'Rotate',
    lightHeight: 'Height',
    lightAdd: 'Add light',
    lightRemove: 'Remove',
    // --- Light names ---
    lightMain: 'Main',
    lightFill: 'Fill',
    lightRim: 'Rim',
    lightCut: 'Cut',
    lightBounce: 'Bounce',
    // --- Lens tab ---
    lensLabel: 'Focal',
    lensFraming: 'Framing',
    lensEnvSection: 'Environment / HDR',
    lensEnvMap: 'Map',
    lensEnvIntensity: 'Intensity',
    lensEnvBg: 'Show HDR background',
    lensResetCamera: 'Reset camera',
    // --- Adjust tab ---
    adjExposure: 'Exposure',
    adjContrast: 'Contrast',
    adjTemperature: 'Temperature',
    adjSaturation: 'Saturation',
    adjLevels: 'Levels',
    adjSteps: 'Steps',
    adjReset: 'Reset adjustments',
    // --- Checkboxes (adjust static) ---
    checkPosterize: 'Posterize',
    checkCutout: 'Cutout',
    checkGray: 'Black and white',
    // --- Position tab ---
    posRotateY: 'Rotate Y',
    posTiltX: 'Tilt X',
    posHeight: 'Height',
    posHorizontal: 'Horizontal',
    posDepth: 'Depth',
    posScale: 'Scale',
    posTiltZ: 'Tilt Z',
    posSave: 'Save model position',
    posCenter: 'Center / reset',
    posHint: 'Shortcuts: G move, S scale, R rotate (RR free). X/Y/Z lock axis, click confirms, Esc cancels.',
    // --- Composition tab ---
    compGizmoSection: 'Gizmo in viewport',
    compSliderSection: 'Adjust by sliders',
    compGizmoObj: 'Gizmo (selected object)',
    compAddSection: 'Add shape / model',
    compObjLabel: 'Object',
    compCount: 'Objects in scene ({n})',
    compDeform: 'Deform shape',
    compWidthX: 'Width X',
    compHeightY: 'Height Y',
    compDepthZ: 'Depth Z',
    compResetShape: 'Reset shape',
    compAddBtn: '+ Add to scene',
    // --- Material section static ---
    labelMaterial: 'Material',
    labelScatterColor: 'Scatter color',
    labelBackground: 'Background',
    labelTransparent: 'Transparent',
    // --- Model select optgroups ---
    ogHeads: 'Heads',
    ogBusts: 'Busts and Torsos',
    ogFigures: 'Figures',
    ogShapes: 'Basic shapes',
    ogModels: 'Models',
    // --- Action buttons aria-labels / tooltips ---
    actionExport: 'Send to Photoshop',
    actionSave: 'Save scene',
    actionImport: 'Import model',
    actionReset: 'Reset scene',
    actionResetView: 'Reset view',
    actionCollapse: 'Collapse controls',
    toggleFloor: 'Floor',
    toggleGuides: 'Light guides',
    toggleReference: 'Reference mode',
    toggleMaterial: 'Open materials',
    btnUpdateAria: 'Check for updates',
    btnHelp: 'Review introduction',
    btnUpdate: 'Update',
    // --- UI misc ---
    shortcutsTitle: 'Keyboard shortcuts',
    menuIntro: 'Review introduction',
    menuShortcuts: 'Shortcuts',
    textLoading: 'Loading',
    // --- Feedback / errors ---
    fbLightAdded: 'Light added: {nome}',
    fbLightRemoved: 'Light removed (Ctrl+Shift+Z to undo)',
    fbLightRestored: 'Light restored: {nome}',
    fbNoLight: 'No light selected',
    fbNoUndo: 'Nothing to undo',
    fbLoadFail: 'Failed to load',
    fbImported: 'Model imported',
    fbImportFail: 'Failed to import',
    fbChecking: 'Checking for updates...',
    fbSaving: 'Saving...',
    fbSaved: 'Position and thumbnail saved',
    fbMaterial: 'Material: {nome}',
    fbSelectObj: 'Select an object',
    fbAddingObj: 'Adding object...',
    fbObjAdded: 'Object added',
    fbAddFail: 'Failed to add',
    fbTransformApplied: 'Transform applied',
    fbCancelled: 'Cancelled',
    fbAxis: 'Axis: {eixo}',
    fbXformStart: '{tipo}: move the mouse, click to confirm, Esc to cancel',
    fbSelectInList: 'Select an object in the list',
    fbColorPicker: 'Could not open the Photoshop color picker',
    fbDeleteFail: 'Failed to remove the model file',
    fbCatCreateFail: 'Failed to create category',
    fbCatRenameFail: 'Failed to rename category',
    // --- Dialogs ---
    dlgCatName: 'Category name',
    dlgNewCat: 'New category',
    dlgRenameCat: 'Rename category',
    // --- Catalog ---
    catNewCategory: '+ New category',
    catRename: 'Rename',
    catDelete: 'Delete',
    // --- Update banner/toast ---
    updTitle: 'Update {versao}',
    updDownload: 'Download update',
    updClose: 'Close',
    updFail: 'Could not check for updates.',
    updCurrent: 'You are already on the latest version ({versao}).',
    // --- Shortcuts data ---
    scGrpLights: 'Lights',
    scGrpDrag: 'Drag in viewport (hold Shift)',
    scGrpTransform: 'Transform object (Position tab)',
    scAddLight: 'Add light',
    scRemoveLight: 'Remove selected light',
    scUndoRemove: 'Undo removal',
    scSelectByNum: 'Select light by number',
    scDragRotate: 'Rotate active light (direction and height)',
    scDragIntensity: 'Change intensity only',
    scDragColor: 'Change color (horizontal) and temperature (vertical)',
    scMove: 'Move',
    scScale: 'Scale',
    scRotate: 'Rotate',
    scLockAxis: 'Lock to axis',
    scConfirm: 'Confirm',
    scCancel: 'Cancel'
  }
};
```

### applyStaticStrings() element map

| Selector | Property | Key |
|---|---|---|
| `[data-tab="light"]` | textContent | tabLight |
| `[data-tab="lens"]` | textContent | tabLens |
| `[data-tab="adjust"]` | textContent | tabAdjust |
| `[data-tab="position"]` | textContent | tabPosition |
| `[data-tab="composition"]` | textContent | tabComposition |
| `[data-projection="ortho"]` | textContent | projOrtho |
| `[data-view="front"]` | textContent | viewFront |
| `[data-view="profile"]` | textContent | viewSide |
| `[data-view="top"]` | textContent | viewTop |
| `[data-gizmo="rotate"]` (all) | textContent | gizmoRotate |
| `[data-gizmo="move"]` (all) | textContent | gizmoMove |
| `[data-gizmo="off"]` (all) | textContent | gizmoOff |
| `[data-page="library"]` | textContent | pageLibrary |
| `[data-page="scenes"]` | textContent | pageScenes |
| `.lr04-lightcolor span` | textContent | labelColor |
| `label[for="lr04-material-select"]` | textContent | labelMaterial |
| `.lr04-scatter:first-of-type` (label text node) | firstChild.textContent | labelScatterColor |
| `#bg-transp` parent label text | lastChild.textContent | labelTransparent |
| `#shortcuts-title` | textContent | shortcutsTitle |
| `.lr04-updlabel` | textContent | btnUpdate |
| `.loading-text > span:first-child` | textContent | textLoading |
| `[data-help="intro"]` | textContent | menuIntro |
| `[data-help="shortcuts"]` | textContent | menuShortcuts |
| `[data-action="export"]` | aria-label + data-tooltip | actionExport |
| `[data-action="save"]` | aria-label + data-tooltip | actionSave |
| `[data-action="import"]` | aria-label + data-tooltip | actionImport |
| `[data-action="reset"]` | aria-label + data-tooltip | actionReset |
| `[data-action="reset-view"]` | aria-label + data-tooltip | actionResetView |
| `[data-action="collapse"]` | aria-label | actionCollapse |
| `[data-toggle="floor"]` | aria-label + data-tooltip | toggleFloor |
| `[data-toggle="guides"]` | aria-label + data-tooltip | toggleGuides |
| `[data-toggle="reference"]` | aria-label + data-tooltip | toggleReference |
| `[data-toggle="materialOpen"]` | aria-label + data-tooltip | toggleMaterial |
| `#btn-update` | aria-label + data-tooltip | btnUpdateAria |
| `#btn-help` | aria-label + data-tooltip | btnHelp |
| `label:has([data-setting="poster"])` | text node | checkPosterize |
| `label:has([data-setting="cutout"])` | text node | checkCutout |
| `label:has([data-setting="gray"])` | text node (before the deform div) | checkGray |

For checkbox labels, since `:has()` is not ES5-safe for old CEF, the implementation
walks siblings of the checkbox input to find the text node, or uses the parent label
`textContent` approach with a known structure guard.

**Safer approach for checkboxes**: query the checkbox by `data-setting`, then write
the parent label's text. Use `input.parentNode.childNodes` to update the text node
directly (last child text node), leaving the input element intact.

**Scatter label**: the `.lr04-scatter` labels contain a text node then an input/span.
Update the first text node (index 0) of each label.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system should
do. Properties serve as the bridge between human-readable specifications and
machine-verifiable correctness guarantees.*

### Property 1: Dictionary completeness

*For any* key in `strings.pt`, the same key also exists in `strings.en`.

**Validates: Requirements 1.2, 9.3**

### Property 2: Translation returns active-language string

*For any* key present in the dictionary and any active language ('pt' or 'en'),
calling `t(key)` after `setLang(lang)` returns the string from that language's
sub-object.

**Validates: Requirements 1.6, 2.1, 2.2**

### Property 3: Variable substitution

*For any* string containing at least one `{varname}` placeholder and a vars object
with a matching key, calling `t(key, vars)` replaces all occurrences of
`{varname}` with the corresponding value.

**Validates: Requirements 2.1, 2.3**

### Property 4: EN fallback to PT

*For any* key present in `strings.pt` but absent from `strings.en`, calling
`t(key)` when lang is 'en' returns the PT string (not undefined or the key itself).

**Validates: Requirements 1.5, 9.3**

### Property 5: Missing-key fallback

*For any* key absent from both `strings.pt` and `strings.en`, calling `t(key)`
returns the key itself without throwing.

**Validates: Requirements 1.5**

### Property 6: No non-ASCII in any dictionary value

*For all* (lang, key) pairs in the dictionary, the string value contains only
characters with code points 0–127 (ASCII range).

**Validates: Requirements 1.3, 9.1**

---

## Error Handling

- **Missing LightRefI18n**: all callers guard with
  `var _ = window.LightRefI18n || { t: function(k){ return k; } }` or equivalent.
  No code path throws if `i18n.js` failed to load.
- **Missing DOM element in applyStaticStrings**: every element query is guarded
  with `if (!el) return` / `if (!el) continue`. Silent skip.
- **Invalid lang in setLang**: non-`'pt'`/`'en'` values are silently ignored.
- **Missing placeholder key in t()**: unmatched `{varname}` tokens are preserved
  unchanged in the output string.

---

## Testing Strategy

PBT is applicable here: `t()` is a pure function with a large key/vars input space
where input variation (key names, variable values, lang switches) meaningfully
affects output. 100+ iterations catch edge cases like empty strings, keys with
multiple placeholders, and keys shared between dicts.

**Unit/property testing library**: fast-check (already a dev dependency).

**Tests in `tests/i18n.property.test.js`**:

- Property 1 (dictionary completeness): for every key in `strings.pt`, assert
  `strings.en` has the same key. Example-based (single exhaustive check, no
  randomness needed since the dict is finite).
- Property 2 (translation returns active lang): fast-check generates random keys
  from the dict and a random lang; asserts `t(key)` matches `strings[lang][key]`.
  Min 100 runs.
- Property 3 (variable substitution): fast-check generates random key + vars object;
  asserts all `{varname}` tokens in template are replaced.
  Min 100 runs.
- Property 4 (EN fallback to PT): removes a random EN key at runtime, calls `t`
  with lang='en', asserts PT value returned.
  Min 100 runs.
- Property 5 (missing-key fallback): fast-check generates random strings not in
  dict; asserts `t(key)` returns the key itself.
  Min 100 runs.
- Property 6 (no non-ASCII): for each string value in the full dict (exhaustive),
  assert all char codes <= 127.

**Tag format**: `// Feature: panel-i18n, Property N: <property text>`

**Unit tests (example-based)**:
- `t('tabLight')` with `setLang('pt')` returns `'Luz'`.
- `t('tabLight')` with `setLang('en')` returns `'Light'`.
- `t('fbLightAdded', {nome: 'Main'})` returns `'Light added: Main'` in EN.
- `setLang('xx')` is ignored (lang stays unchanged).

**Integration**: manual verification in Photoshop per Requirement 9.4.
No property tests touch the DOM or Babylon.js engine.
