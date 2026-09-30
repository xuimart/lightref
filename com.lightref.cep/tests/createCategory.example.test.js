/*
 * Task 12.3 - Teste de exemplo: criar categoria com nome valido persiste.
 * Requirements: 4.1
 *
 * Ao criar uma Categoria_Custom com um nome nao vazio, o Storage deve persistir
 * o nome em config.modelCategories (via writeConfig). Aqui exercitamos o mesmo
 * caminho de persistencia acionado por onCreateCategory('library') no painel:
 * validacao pura (validateNewCategoryName do panel.js) + LightRefStorage.addModelCategory.
 *
 * Usa o harness loadStorage (fs em memoria) e loadPanelCatalog (API pura do painel).
 */
'use strict';

const assert = require('assert');
const { loadStorage } = require('./loadStorage');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

function testCreateValidPersists() {
  const { storage } = loadStorage();

  // Categorias existentes = padrao da Biblioteca (nenhuma custom ainda).
  const existing = ['Cabecas', 'Bustos e Torsos', 'Figuras', 'Formas basicas'];
  const name = 'Referencias';

  // Validacao (mesma funcao pura usada pelo painel).
  const v = api.validateNewCategoryName(name, existing);
  assert.strictEqual(v.ok, true, 'nome valido deveria passar na validacao');

  // Persistencia.
  storage.addModelCategory(v.name);

  const cfg = storage.readConfig();
  assert.ok(Array.isArray(cfg.modelCategories), 'modelCategories deveria ser um array');
  assert.ok(cfg.modelCategories.indexOf('Referencias') !== -1, 'categoria criada deveria persistir em config.modelCategories');

  console.log('Task 12.3 (criar categoria valida persiste em modelCategories): OK');
}

function testCreateSecondCategoryAppends() {
  const { storage } = loadStorage();
  storage.addModelCategory('Referencias');
  storage.addModelCategory('Projeto X');

  const cfg = storage.readConfig();
  assert.strictEqual(cfg.modelCategories.length, 2, 'deveria haver 2 categorias custom');
  assert.ok(cfg.modelCategories.indexOf('Referencias') !== -1);
  assert.ok(cfg.modelCategories.indexOf('Projeto X') !== -1);

  console.log('Task 12.3 (criar segunda categoria acumula): OK');
}

testCreateValidPersists();
testCreateSecondCategoryAppends();
