# Implementation Plan: panel-i18n

## Overview

Introduce `js/i18n.js` as a central string dictionary and translation function,
wire it into `panel.js` (static DOM + all dynamic renders) and `update.js`.
All code is ES5/ASCII. No build step. The 34 existing tests must keep passing.

## Tasks

- [ ] 1. Create js/i18n.js and register it in index.html
  - [ ] 1.1 Create `js/i18n.js`: ES5 IIFE exposing `window.LightRefI18n` with `strings`, `setLang`, `getLang`, `t`; expose `window.__lrI18nApi` for tests
    - Full PT+EN dictionary as specified in design.md Data Models section
    - `t(key, vars)`: lookup active lang -> PT fallback -> key fallback; replace all `{varname}` occurrences
    - `setLang(lang)`: accepts only `'pt'` or `'en'`; silent ignore otherwise
    - ASCII-only source; run `node --check js/i18n.js` and verify no non-ASCII chars
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 9.1_
  - [ ] 1.2 Add `<script src="js/i18n.js?v=0929161917"></script>` to `index.html` immediately after the `storage.js` script tag
    - Verify load order: storage.js -> i18n.js -> lights.js ... -> update.js -> onboarding.js -> session.js -> panel.js
    - _Requirements: 1.4_

- [ ] 2. Write property tests for i18n module
  - [ ]* 2.1 Create `tests/i18n.property.test.js` — dictionary completeness
    - Assert every key in `strings.pt` has a matching key in `strings.en` (exhaustive, no randomness)
    - **Property 1: Dictionary completeness**
    - **Validates: Requirements 1.2, 9.3**
    - _Tag: Feature: panel-i18n, Property 1: Dictionary completeness_
  - [ ]* 2.2 Write property test: translation returns active-language string
    - fast-check: generate random key from dict + random lang ('pt'|'en'); assert `t(key)` matches `strings[lang][key]`
    - Min 100 iterations
    - **Property 2: Translation returns active-language string**
    - **Validates: Requirements 1.6, 2.1, 2.2**
    - _Tag: Feature: panel-i18n, Property 2: Translation returns active-language string_
  - [ ]* 2.3 Write property test: variable substitution
    - fast-check: generate key with placeholder(s) + vars object; assert all `{varname}` tokens replaced
    - Min 100 iterations
    - **Property 3: Variable substitution**
    - **Validates: Requirements 2.1, 2.3**
    - _Tag: Feature: panel-i18n, Property 3: Variable substitution_
  - [ ]* 2.4 Write property test: EN fallback to PT
    - For keys only in PT (or simulate missing EN key), assert `t(key)` with lang='en' returns PT value
    - Min 100 iterations
    - **Property 4: EN fallback to PT**
    - **Validates: Requirements 1.5, 9.3**
    - _Tag: Feature: panel-i18n, Property 4: EN fallback to PT_
  - [ ]* 2.5 Write property test: missing-key fallback
    - fast-check: generate strings not in dict; assert `t(key)` returns key itself without throwing
    - Min 100 iterations
    - **Property 5: Missing-key fallback**
    - **Validates: Requirements 1.5_**
    - _Tag: Feature: panel-i18n, Property 5: Missing-key fallback_
  - [ ]* 2.6 Write property test: no non-ASCII in dictionary values
    - Exhaustively check every string value in `strings.pt` and `strings.en`; assert all char codes <= 127
    - **Property 6: No non-ASCII in any dictionary value**
    - **Validates: Requirements 1.3, 9.1**
    - _Tag: Feature: panel-i18n, Property 6: No non-ASCII in any dictionary value_
  - [ ]* 2.7 Add `node tests/i18n.property.test.js` to the `"test"` script in `package.json`
    - Append it to the existing semicolon-separated list
    - Run full suite; expect 34 + N passing (N = assertions in the new file)
    - _Requirements: 9.2_

- [ ] 3. Checkpoint — all i18n module tests pass
  - Run full test suite. Expect 34 + N (where N >= 6 property groups). Ask the user if anything is unexpected.

- [ ] 4. Extend applyLanguage and add static/dynamic translations in panel.js
  - [ ] 4.1 Add `getLightNames()` function; replace `LIGHT_NAMES` array and all its usages
    - `getLightNames()` returns translated array via `LightRefI18n.t()` with PT fallback
    - Update `nextLightName()` and any other caller of `LIGHT_NAMES`
    - _Requirements: 5.4_
  - [ ] 4.2 Add `applyStaticStrings()` function implementing the full element map from design.md
    - Translate tabs, projection, views, gizmos, pages, labels, checkboxes, action buttons, aria-labels, data-tooltips, shortcuts title, footer label, loading text, help menu items
    - Guard every element lookup (`if (!el) continue / return`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 4.3 Extend `applyLanguage()` to call `LightRefI18n.setLang()`, `applyStaticStrings()`, `renderTab()`, `fillModelSelect()`, `fillAddTypeSelect()`, and `renderCatalog()` when on catalog page
    - Preserve existing config-save behavior
    - _Requirements: 3.4, 4.1, 5.3, 7.3, 8.1, 8.2_
  - [ ] 4.4 Update `DOMContentLoaded` boot: call `applyLanguage(curLang)` synchronously before `fillModelSelect`, `fillAddTypeSelect`, `initScene`, and `startDefaultScene`
    - Read curLang from config (default 'pt'), wrap in try/catch to guard storage errors
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 4.5 Replace hardcoded PT literals in `renderLight()` with `t()` calls
    - `row('Intensidade',...)` -> `row(t('lightIntensity'),...)`
    - `row('Girar',...)` -> `row(t('lightRotate'),...)`
    - `row('Altura',...)` -> `row(t('lightHeight'),...)`
    - chip `title="Adicionar luz"` -> `t('lightAdd')`
    - chip `title="Remover"` -> `t('lightRemove')`
    - _Requirements: 5.1, 5.2_
  - [ ] 4.6 Replace hardcoded PT literals in `renderLens()` and `renderEnvSection()` with `t()` calls
    - `row('Lente',...)` -> `row(t('lensLabel'),...)`
    - `'Ambiente / HDR'` -> `t('lensEnvSection')`
    - `'<span>Mapa</span>'` -> `t('lensEnvMap')`
    - `row('Intensidade',...)` (env) -> `row(t('lensEnvIntensity'),...)`
    - `'Mostrar fundo do HDR'` -> `t('lensEnvBg')`
    - `'Resetar camera'` button -> `t('lensResetCamera')`
    - `'Enquadramento'` heading -> `t('lensFraming')` (static span in HTML; also handle via applyStaticStrings or renderLens re-write)
    - _Requirements: 5.1, 5.2_
  - [ ] 4.7 Replace hardcoded PT literals in `renderAdjust()` with `t()` calls
    - `row('Exposicao',...)` -> `row(t('adjExposure'),...)`
    - `row('Contraste',...)` -> `row(t('adjContrast'),...)`
    - `row('Temperatura',...)` -> `row(t('adjTemperature'),...)`
    - `row('Saturacao',...)` -> `row(t('adjSaturation'),...)`
    - `row('Niveis',...)` -> `row(t('adjLevels'),...)`
    - `row('Degraus',...)` -> `row(t('adjSteps'),...)`
    - `data-action="reset-adjust"` button text -> `t('adjReset')` (set in renderAdjust or via applyStaticStrings)
    - _Requirements: 5.1, 5.2_
  - [ ] 4.8 Replace hardcoded PT literals in `renderPos()` with `t()` calls
    - All `row()` labels: posRotateY, posTiltX, posHeight, posHorizontal, posDepth, posScale, posTiltZ
    - Buttons: `t('posSave')`, `t('posCenter')`
    - Hint text: `t('posHint')`
    - _Requirements: 5.1, 5.2_
  - [ ] 4.9 Replace hardcoded PT literals in `renderComposition()` with `t()` calls
    - `'Objetos na cena (' + n + ')'` -> `t('compCount', {n: objs.length})`
    - `'Distorcer forma'` heading -> `t('compDeform')`
    - `row('Largura X',...)` -> `row(t('compWidthX'),...)`
    - `row('Altura Y',...)` -> `row(t('compHeightY'),...)`
    - `row('Profund. Z',...)` -> `row(t('compDepthZ'),...)`
    - `'Resetar forma'` button -> `t('compResetShape')`
    - `'+ Adicionar a cena'` button -> `t('compAddBtn')`
    - `nmeOf` fallback `'Objeto'` -> `t('compObjLabel')`
    - Static composition headings in HTML are handled via applyStaticStrings (gizmo sections, add section)
    - _Requirements: 5.1, 5.2_
  - [ ] 4.10 Replace hardcoded PT literals in `fillModelSelect()` and `fillAddTypeSelect()` with `t()` calls
    - Map each `m.cat` value to its i18n key (ogHeads, ogBusts, ogFigures, ogShapes) in fillModelSelect
    - `'Formas basicas'` -> `t('ogShapes')`, `'Modelos'` -> `t('ogModels')` in fillAddTypeSelect
    - _Requirements: 5.2_
  - [ ] 4.11 Replace hardcoded PT literals in `buildShortcutGroups()` with `t()` calls
    - Group titles: `t('scGrpLights')`, `t('scGrpDrag')`, `t('scGrpTransform')`
    - All row descriptions: map to sc* keys
    - _Requirements: 6.5_
  - [ ] 4.12 Replace all hardcoded PT strings in `feedback()` call sites in panel.js with `t()` calls
    - `'Luz adicionada: ' + nl.name` -> `t('fbLightAdded', {nome: nl.name})`
    - `'Nenhuma luz selecionada'` -> `t('fbNoLight')`
    - `'Luz removida (Ctrl+Shift+Z desfaz)'` -> `t('fbLightRemoved')`
    - `'Nada para desfazer'` -> `t('fbNoUndo')`
    - `'Luz restaurada: '` -> `t('fbLightRestored', {nome: d.name||''})`
    - `'Selecione um objeto'` -> `t('fbSelectObj')`
    - `'Mover'/'Escala'/'Rotacao'` in onXform start -> use `t('fbXformStart', {tipo: ...})`
    - `'Eixo: '` -> `t('fbAxis', {eixo: info.toUpperCase()})`
    - `'Transformacao aplicada'` -> `t('fbTransformApplied')`
    - `'Cancelado'` -> `t('fbCancelled')`
    - `'Selecione um objeto na lista'` -> `t('fbSelectInList')`
    - `'Falha ao carregar'` -> `t('fbLoadFail')`
    - `'Modelo importado'` -> `t('fbImported')`
    - `'Falha ao importar'` -> `t('fbImportFail')`
    - `'Salvando...'` -> `t('fbSaving')`
    - `'Posicao e miniatura salvas'` -> `t('fbSaved')`
    - `'Material: '` -> `t('fbMaterial', {nome: ...})`
    - `'Nao foi possivel abrir o seletor de cores do Photoshop'` -> `t('fbColorPicker')`
    - `'Adicionando objeto...'` -> `t('fbAddingObj')`
    - `'Falha ao adicionar'` -> `t('fbAddFail')`
    - `'Objeto adicionado'` -> `t('fbObjAdded')`
    - `'Falha ao remover o arquivo do modelo'` -> `t('fbDeleteFail')`
    - `'Falha ao criar categoria'` -> `t('fbCatCreateFail')`
    - `'Falha ao renomear categoria'` -> `t('fbCatRenameFail')`
    - `'Verificando atualizacoes...'` in runManualUpdateCheck -> `t('fbChecking')`
    - _Requirements: 6.1, 6.2_
  - [ ] 4.13 Run `node --check js/panel.js` and ASCII check; run full test suite; expect 34 + N passing
    - _Requirements: 9.1, 9.2_

- [ ] 5. Checkpoint — panel.js changes verified
  - Run full test suite. Expect 34 + N passing. Ask the user if questions arise.

- [ ] 6. Update update.js with LightRefI18n guard and t() calls
  - [ ] 6.1 Add LightRefI18n guard local var at top of `showBanner()` and `check()`
    - `var _ = (window.LightRefI18n && window.LightRefI18n.t) ? window.LightRefI18n : { t: function(k){ return k; } };`
  - [ ] 6.2 Replace PT literals in `buildBanner()` with `_.t()` calls
    - `'Atualizacao ' + ver` -> `_.t('updTitle', {versao: ver})`
    - `title="Fechar" aria-label="Fechar"` -> `_.t('updClose')`
    - `'Baixar atualizacao'` -> `_.t('updDownload')`
    - _Requirements: 6.4_
  - [ ] 6.3 Replace PT literals in `check()` with `_.t()` calls
    - `'Nao foi possivel verificar atualizacoes.'` -> `_.t('updFail')`
    - `'Voce ja esta na versao mais recente (' + LIGHTREF_VERSION + ').'` -> `_.t('updCurrent', {versao: LIGHTREF_VERSION})`
    - _Requirements: 6.4_
  - [ ] 6.4 Run `node --check js/update.js` and ASCII check; run full test suite; expect 34 + N passing
    - _Requirements: 9.1, 9.2_

- [ ] 7. Final checkpoint — run full suite, verify totals
  - Run the complete `npm test` command via Node; report total test count
  - Verify all existing 34 tests still pass plus the new i18n tests
  - Delete any temporary files created during development
  - _Requirements: 8.5, 9.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- panel.js uses CRLF line endings — all edits must preserve CRLF
- All production JS must be ES5/ASCII only; use `node --check` after each file change
- The `t()` helper in panel.js can be aliased: `var t = window.LightRefI18n ? window.LightRefI18n.t.bind(window.LightRefI18n) : function(k){ return k; };` at top of render functions
- applyStaticStrings must be idempotent (safe to call multiple times)
- Checkpoints use automated tests only; no DOM or Photoshop environment needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.7"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12"] },
    { "id": 6, "tasks": ["4.13", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4"] }
  ]
}
```
