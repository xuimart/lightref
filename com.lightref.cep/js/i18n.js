/*
 * i18n.js - modulo de internacionalizacao do LightRef. ASCII-only. ES5.
 * Expoe window.LightRefI18n com o dicionario PT/EN e a funcao t(key, vars).
 * Tambem expoe window.__lrI18nApi para os testes em Node.
 */
(function (global) {
    'use strict';

    var _lang = 'pt';

    var strings = {
        pt: {
            /* --- Tabs --- */
            tabLight: 'Luz',
            tabLens: 'Lente',
            tabAdjust: 'Ajustes',
            tabPosition: 'Posicao',
            tabComposition: 'Composicao',
            /* --- Projection / Views --- */
            projOrtho: 'Orto',
            viewFront: 'Frente',
            viewSide: 'Perfil',
            viewTop: 'Topo',
            /* --- Gizmo --- */
            gizmoRotate: 'Rotacionar',
            gizmoMove: 'Mover',
            gizmoOff: 'Desligar',
            /* --- Pages --- */
            pageLibrary: 'Biblioteca',
            pageScenes: 'Cenas',
            /* --- Light tab --- */
            labelColor: 'Cor',
            lightIntensity: 'Intensidade',
            lightRotate: 'Girar',
            lightHeight: 'Altura',
            lightAdd: 'Adicionar luz',
            lightRemove: 'Remover',
            /* --- Light names --- */
            lightMain: 'Principal',
            lightFill: 'Preenchimento',
            lightRim: 'Contorno',
            lightCut: 'Recorte',
            lightBounce: 'Rebote',
            /* --- Lens tab --- */
            lensLabel: 'Lente',
            lensFraming: 'Enquadramento',
            lensEnvSection: 'Ambiente / HDR',
            lensEnvMap: 'Mapa',
            lensEnvIntensity: 'Intensidade',
            lensEnvBg: 'Mostrar fundo do HDR',
            lensResetCamera: 'Resetar camera',
            /* --- Adjust tab --- */
            adjExposure: 'Exposicao',
            adjContrast: 'Contraste',
            adjTemperature: 'Temperatura',
            adjSaturation: 'Saturacao',
            adjLevels: 'Niveis',
            adjSteps: 'Degraus',
            adjReset: 'Zerar ajustes',
            /* --- Checkboxes (adjust static) --- */
            checkPosterize: 'Posterizar',
            checkCutout: 'Cutout',
            checkGray: 'Preto e branco',
            /* --- Position tab --- */
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
            /* --- Composition tab --- */
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
            /* --- Material section static --- */
            labelMaterial: 'Material',
            labelScatterColor: 'Cor scatter',
            labelBackground: 'Fundo',
            labelTransparent: 'Transparente',
            /* --- Model select optgroups --- */
            ogHeads: 'Cabecas',
            ogBusts: 'Bustos e Torsos',
            ogFigures: 'Figuras',
            ogShapes: 'Formas basicas',
            ogModels: 'Modelos',
            /* --- Action buttons aria-labels / tooltips --- */
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
            /* --- UI misc --- */
            shortcutsTitle: 'Atalhos do teclado',
            menuIntro: 'Rever introducao',
            menuShortcuts: 'Atalhos',
            textLoading: 'Carregando',
            /* --- Feedback / errors --- */
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
            /* --- Dialogs --- */
            dlgCatName: 'Nome da categoria',
            dlgNewCat: 'Nova categoria',
            dlgRenameCat: 'Renomear categoria',
            /* --- Catalog --- */
            catNewCategory: '+ Nova categoria',
            catRename: 'Renomear',
            catDelete: 'Deletar',
            /* --- Update banner/toast --- */
            updTitle: 'Atualizacao {versao}',
            updDownload: 'Baixar atualizacao',
            updClose: 'Fechar',
            updFail: 'Nao foi possivel verificar atualizacoes.',
            updCurrent: 'Voce ja esta na versao mais recente ({versao}).',
            /* --- Shortcuts data --- */
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
            /* --- Tabs --- */
            tabLight: 'Light',
            tabLens: 'Lens',
            tabAdjust: 'Adjust',
            tabPosition: 'Position',
            tabComposition: 'Composition',
            /* --- Projection / Views --- */
            projOrtho: 'Ortho',
            viewFront: 'Front',
            viewSide: 'Side',
            viewTop: 'Top',
            /* --- Gizmo --- */
            gizmoRotate: 'Rotate',
            gizmoMove: 'Move',
            gizmoOff: 'Off',
            /* --- Pages --- */
            pageLibrary: 'Library',
            pageScenes: 'Scenes',
            /* --- Light tab --- */
            labelColor: 'Color',
            lightIntensity: 'Intensity',
            lightRotate: 'Rotate',
            lightHeight: 'Height',
            lightAdd: 'Add light',
            lightRemove: 'Remove',
            /* --- Light names --- */
            lightMain: 'Main',
            lightFill: 'Fill',
            lightRim: 'Rim',
            lightCut: 'Cut',
            lightBounce: 'Bounce',
            /* --- Lens tab --- */
            lensLabel: 'Focal',
            lensFraming: 'Framing',
            lensEnvSection: 'Environment / HDR',
            lensEnvMap: 'Map',
            lensEnvIntensity: 'Intensity',
            lensEnvBg: 'Show HDR background',
            lensResetCamera: 'Reset camera',
            /* --- Adjust tab --- */
            adjExposure: 'Exposure',
            adjContrast: 'Contrast',
            adjTemperature: 'Temperature',
            adjSaturation: 'Saturation',
            adjLevels: 'Levels',
            adjSteps: 'Steps',
            adjReset: 'Reset adjustments',
            /* --- Checkboxes (adjust static) --- */
            checkPosterize: 'Posterize',
            checkCutout: 'Cutout',
            checkGray: 'Black and white',
            /* --- Position tab --- */
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
            /* --- Composition tab --- */
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
            /* --- Material section static --- */
            labelMaterial: 'Material',
            labelScatterColor: 'Scatter color',
            labelBackground: 'Background',
            labelTransparent: 'Transparent',
            /* --- Model select optgroups --- */
            ogHeads: 'Heads',
            ogBusts: 'Busts and Torsos',
            ogFigures: 'Figures',
            ogShapes: 'Basic shapes',
            ogModels: 'Models',
            /* --- Action buttons aria-labels / tooltips --- */
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
            /* --- UI misc --- */
            shortcutsTitle: 'Keyboard shortcuts',
            menuIntro: 'Review introduction',
            menuShortcuts: 'Shortcuts',
            textLoading: 'Loading',
            /* --- Feedback / errors --- */
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
            /* --- Dialogs --- */
            dlgCatName: 'Category name',
            dlgNewCat: 'New category',
            dlgRenameCat: 'Rename category',
            /* --- Catalog --- */
            catNewCategory: '+ New category',
            catRename: 'Rename',
            catDelete: 'Delete',
            /* --- Update banner/toast --- */
            updTitle: 'Update {versao}',
            updDownload: 'Download update',
            updClose: 'Close',
            updFail: 'Could not check for updates.',
            updCurrent: 'You are already on the latest version ({versao}).',
            /* --- Shortcuts data --- */
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

    function setLang(lang) {
        if (lang === 'pt' || lang === 'en') { _lang = lang; }
    }

    function getLang() {
        return _lang;
    }

    var hop = Object.prototype.hasOwnProperty;

    /* t(key, vars): translate key in active lang, interpolate {varname} tokens. */
    function t(key, vars) {
        var dict = strings[_lang];
        var val;
        if (dict && hop.call(dict, key)) {
            val = dict[key];
        } else if (_lang !== 'pt' && hop.call(strings.pt, key)) {
            val = strings.pt[key];
        } else if (hop.call(strings.pt, key)) {
            val = strings.pt[key];
        } else {
            val = key;
        }
        if (vars) {
            for (var k in vars) {
                if (Object.prototype.hasOwnProperty.call(vars, k)) {
                    val = val.split('{' + k + '}').join(String(vars[k]));
                }
            }
        }
        return val;
    }

    var LightRefI18n = {
        strings: strings,
        setLang: setLang,
        getLang: getLang,
        t: t
    };

    global.LightRefI18n = LightRefI18n;

    /* Test surface: exposed the same way as __lrStateApi etc. */
    try {
        if (typeof global !== 'undefined' && global) {
            global.__lrI18nApi = { t: t, setLang: setLang, getLang: getLang, strings: strings };
        }
    } catch (e) {}

})(this);
