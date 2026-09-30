/*
 * Smoke test (Etapa 3, subtarefa 7.3): renderizacao de gavetas.
 * Requirements: 3.1, 5.1
 *
 * Nao ha jsdom neste ambiente, entao validamos as FUNCOES PURAS de geracao de
 * HTML do panel.js real (drawerHTML/cardHTML/addCardHTML/catalogHTML) como
 * strings:
 *   - uma <section class="lr04-drawer"> por categoria, com a contagem correta;
 *   - o card "+" (lr04-card-add) aparece SO na Biblioteca (canImport) e no fim
 *     do corpo de CADA gaveta;
 *   - o "x" (lr04-card-del) aparece SO em cards deletaveis.
 * Quando jsdom estiver disponivel, este smoke pode ser promovido a um teste de
 * DOM real sem mudar as asсерcoes de conteudo.
 */
'use strict';

const assert = require('assert');
const { loadPanelCatalog } = require('./loadPanelCatalog');

const api = loadPanelCatalog();

function occurrences(hay, needle) {
  var n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
  return n;
}

function item(kind, id, title, deletable, cat) {
  return {
    id: id, kind: kind, title: title, subtitle: (kind === 'defmodel' ? cat : ''),
    thumbHTML: '<div class="lr04-placeholder"></div>',
    deletable: deletable, draggable: true, fromCat: cat
  };
}

function run() {
  // --- cardHTML: "x" so em deletaveis ---
  var defCard = api.cardHTML(item('defmodel', 'models/asaro.obj', 'Asaro', false, 'Cabecas'));
  var myCard = api.cardHTML(item('mymodel', 7, 'Meu modelo', true, 'Outros'));
  var sceneCard = api.cardHTML(item('scene', 123, 'Retrato', true, 'Sem categoria'));

  assert.ok(defCard.indexOf('lr04-card') >= 0, 'card padrao usa .lr04-card');
  assert.ok(defCard.indexOf('lr04-card-del') < 0, 'card padrao NAO tem "x"');
  assert.ok(myCard.indexOf('lr04-card-del') >= 0, 'card importado TEM "x"');
  assert.ok(sceneCard.indexOf('lr04-card-del') >= 0, 'card de cena TEM "x"');

  // data-* presentes para etapas futuras (open/DnD/delete).
  assert.ok(myCard.indexOf('data-kind="mymodel"') >= 0, 'data-kind no card');
  assert.ok(myCard.indexOf('data-id="7"') >= 0, 'data-id no card');
  assert.ok(myCard.indexOf('data-cat="Outros"') >= 0, 'data-cat no card');
  assert.ok(myCard.indexOf('draggable="true"') >= 0, 'card arrastavel');

  // --- addCardHTML ---
  var addC = api.addCardHTML();
  assert.ok(addC.indexOf('lr04-card-add') >= 0, 'card + usa .lr04-card-add');
  assert.ok(addC.indexOf('data-action="add-model"') >= 0, 'card + tem data-action add-model');

  // --- drawerHTML: contagem e card "+" ---
  var catCabecas = {
    id: 'Cabecas', name: 'Cabecas', builtin: true, renamable: false, expanded: true,
    items: [item('defmodel', 'a', 'A', false, 'Cabecas'), item('defmodel', 'b', 'B', false, 'Cabecas')]
  };
  var libDrawer = api.drawerHTML(catCabecas, true);
  assert.ok(libDrawer.indexOf('class="lr04-drawer"') >= 0, 'gaveta usa .lr04-drawer');
  assert.ok(libDrawer.indexOf('aria-expanded="true"') >= 0, 'gaveta expandida tem aria-expanded=true');
  assert.ok(libDrawer.indexOf('data-cat="Cabecas"') >= 0, 'gaveta tem data-cat');
  assert.ok(libDrawer.indexOf('Cabecas (2)') >= 0, 'cabecalho mostra contagem (2)');
  assert.strictEqual(occurrences(libDrawer, 'lr04-card-add'), 1, 'exatamente 1 card "+" na gaveta da biblioteca');
  // O "+" deve vir DEPOIS do ultimo card de item (fim do corpo).
  assert.ok(libDrawer.lastIndexOf('lr04-card-add') > libDrawer.lastIndexOf('data-kind="defmodel"'), 'card "+" no fim da gaveta');

  // Gaveta de cenas (sem canImport): sem "+".
  var catSem = {
    id: 'Sem categoria', name: 'Sem categoria', builtin: true, renamable: false, expanded: false,
    items: [item('scene', 1, 'S1', true, 'Sem categoria')]
  };
  var sceneDrawer = api.drawerHTML(catSem, false);
  assert.strictEqual(occurrences(sceneDrawer, 'lr04-card-add'), 0, 'gaveta de cenas NAO tem card "+"');
  assert.ok(sceneDrawer.indexOf('aria-expanded="false"') >= 0, 'gaveta recolhida tem aria-expanded=false');
  assert.ok(sceneDrawer.indexOf('lr04-drawerbody lr04-gallery" hidden') >= 0, 'corpo recolhido tem hidden');
  assert.strictEqual(occurrences(sceneDrawer, 'lr04-card-del'), 1, '"x" no card de cena');

  // --- catalogHTML (biblioteca): uma gaveta por categoria, "+" em todas ---
  var libModel = {
    page: 'library', canImport: true, canCreateCategory: true, emptyHint: '',
    categories: [
      { id: 'Cabecas', name: 'Cabecas', builtin: true, renamable: false, expanded: true, items: [item('defmodel', 'a', 'A', false, 'Cabecas')] },
      { id: 'Figuras', name: 'Figuras', builtin: true, renamable: false, expanded: true, items: [item('defmodel', 'c', 'C', false, 'Figuras'), item('defmodel', 'd', 'D', false, 'Figuras')] },
      { id: 'Referencias', name: 'Referencias', builtin: false, renamable: true, expanded: true, items: [item('mymodel', 9, 'Meu', true, 'Referencias')] }
    ]
  };
  var libHTML = api.catalogHTML(libModel);
  assert.strictEqual(occurrences(libHTML, 'class="lr04-drawer"'), 3, 'uma gaveta por categoria (3)');
  assert.strictEqual(occurrences(libHTML, 'lr04-card-add'), 3, 'card "+" em cada gaveta da biblioteca');
  assert.ok(libHTML.indexOf('data-action="new-cat"') >= 0, 'toolbar tem Nova categoria');
  assert.ok(libHTML.indexOf('data-action="rename-cat" data-cat="Referencias"') >= 0, 'gaveta custom tem Renomear');
  assert.ok(libHTML.indexOf('data-action="rename-cat" data-cat="Cabecas"') < 0, 'gaveta padrao NAO tem Renomear');
  assert.ok(libHTML.indexOf('Figuras (2)') >= 0, 'contagem correta por gaveta');

  // --- catalogHTML (cenas): sem "+", com "Salvar cena atual" ---
  var sceneModel = {
    page: 'scenes', canImport: false, canCreateCategory: true, emptyHint: '',
    categories: [
      { id: 'Retratos', name: 'Retratos', builtin: false, renamable: true, expanded: true, items: [item('scene', 1, 'R1', true, 'Retratos')] },
      { id: 'Sem categoria', name: 'Sem categoria', builtin: true, renamable: false, expanded: true, items: [item('scene', 2, 'S1', true, 'Sem categoria')] }
    ]
  };
  var sceneHTML = api.catalogHTML(sceneModel);
  assert.strictEqual(occurrences(sceneHTML, 'class="lr04-drawer"'), 2, 'duas gavetas de cenas');
  assert.strictEqual(occurrences(sceneHTML, 'lr04-card-add'), 0, 'cenas sem card "+"');
  assert.ok(sceneHTML.indexOf('data-action="save-scene"') >= 0, 'toolbar de cenas tem Salvar cena atual');

  // --- emptyHint quando nao ha categorias/cenas ---
  var emptyModel = { page: 'scenes', canImport: false, canCreateCategory: true, categories: [], emptyHint: 'Nenhuma cena salva. Clique em Salvar cena atual.' };
  var emptyHTML = api.catalogHTML(emptyModel);
  assert.ok(emptyHTML.indexOf('Nenhuma cena salva') >= 0, 'exibe emptyHint quando vazio');
  assert.strictEqual(occurrences(emptyHTML, 'class="lr04-drawer"'), 0, 'sem gavetas quando vazio');

  console.log('Smoke 7.3 (renderizacao de gavetas): OK');
}

run();
