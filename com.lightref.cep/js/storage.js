/*
 * storage.js - persistencia do LightRef (padrao Xuimart, escrita atomica).
 *
 * Guarda em %APPDATA%\LightRef:
 *   config.json           preferencias (idioma, ultimo modelo, exportMode)
 *   scenes.json           cenas salvas (modelo, luzes, camera, fundo, ajustes)
 *   models\               copias dos .obj/.glb que o usuario upou (biblioteca)
 *   models_index.json     metadados da biblioteca (nome, arquivo, data)
 *
 * Escrita atomica (temp + rename) porque o mesmo arquivo pode ser lido/escrito
 * em momentos concorrentes; escrita direta arrisca ler pela metade. Ver
 * PADRAO_PLUGINS_XUIMART.md secao 7.
 *
 * ES5 + Node (fs, path, os).
 */
(function (global) {
    'use strict';

    var fs = require('fs');
    var path = require('path');
    var os = require('os');

    function rootDir() {
        var base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(base, 'LightRef');
    }
    function ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    function modelsDir() { return ensureDir(path.join(rootDir(), 'models')); }

    // Remove BOM que quebra JSON.parse (arquivos gravados por outros processos).
    function stripBOM(s) {
        return (s && s.charCodeAt(0) === 0xFEFF) ? s.slice(1) : s;
    }

    /* Escrita atomica: grava em .tmp e renomeia (rename e atomico no mesmo volume). */
    function writeJSONAtomic(filePath, data) {
        ensureDir(path.dirname(filePath));
        var tmp = filePath + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmp, filePath);
    }

    /*
     * Leitura resiliente: 3 tentativas. Se o arquivo existe mas falha o parse,
     * NAO cai no default silenciosamente (isso mascarava corrupcao no DrawlapsePS) -
     * relanca o erro na ultima tentativa. Se o arquivo nao existe, retorna fallback.
     */
    function readJSON(filePath, fallback) {
        if (!fs.existsSync(filePath)) return fallback;
        var lastErr;
        for (var i = 0; i < 3; i++) {
            try {
                var raw = stripBOM(fs.readFileSync(filePath, 'utf8'));
                return JSON.parse(raw);
            } catch (e) { lastErr = e; }
        }
        throw lastErr;
    }

    // ---------- Config ----------
    function configPath() { return path.join(rootDir(), 'config.json'); }
    function readConfig() {
        return readJSON(configPath(), { language: 'pt', lastModel: 'models/asaro.obj', exportMode: 'raster' });
    }
    function writeConfig(cfg) {
        // read-modify-write: mescla com disco para nao perder chaves de outra origem.
        var cur = {};
        try { cur = readConfig(); } catch (e) { cur = {}; }
        for (var k in cfg) { if (cfg.hasOwnProperty(k)) cur[k] = cfg[k]; }
        writeJSONAtomic(configPath(), cur);
        return cur;
    }

    // ---------- Cenas ----------
    function scenesPath() { return path.join(rootDir(), 'scenes.json'); }
    function listScenes() {
        return readJSON(scenesPath(), []);
    }
    /*
     * scene: { id, name, createdAt, state:{...}, thumb:dataURL, updatedAt?, categoryId? }.
     * Salva uma nova cena ou sobrescreve a existente de mesmo nome.
     *
     * Ao sobrescrever (Req 8.3): atualizamos apenas state/thumb/updatedAt e
     * PRESERVAMOS o categoryId existente (a categoria e a identidade da cena e nao
     * deve mudar so por regravar o estado). O campo categoryId e opcional; cenas
     * antigas sem ele simplesmente permanecem sem ele (leitura tolerante a ausencia).
     */
    function saveScene(name, state, thumb) {
        var scenes = [];
        try { scenes = listScenes(); } catch (e) { scenes = []; }
        var existing = null;
        for (var i = 0; i < scenes.length; i++) {
            if (scenes[i].name === name) { existing = scenes[i]; break; }
        }
        if (existing) {
            // Sobrescreve estado/thumb; categoryId (se houver) fica intacto.
            existing.state = state;
            if (thumb) existing.thumb = thumb;
            existing.updatedAt = Date.now();
        } else {
            scenes.push({ id: Date.now(), name: name, createdAt: Date.now(), state: state, thumb: thumb || null });
        }
        writeJSONAtomic(scenesPath(), scenes);
        return scenes;
    }
    function deleteScene(id) {
        var scenes = listScenes();
        var out = scenes.filter(function (s) { return s.id !== id; });
        writeJSONAtomic(scenesPath(), out);
        return out;
    }

    // ---------- Biblioteca de modelos ----------
    function modelsIndexPath() { return path.join(rootDir(), 'models_index.json'); }
    function listModels() {
        return readJSON(modelsIndexPath(), []);
    }
    /*
     * Importa um modelo para a biblioteca: copia o arquivo de origem para
     * %APPDATA%\LightRef\models e registra no indice. Retorna o registro criado.
     * srcPath: caminho absoluto do arquivo escolhido pelo usuario.
     */
    function importModel(srcPath, displayName) {
        var ext = path.extname(srcPath).toLowerCase();
        var id = Date.now();
        var destName = 'model_' + id + ext;
        var destPath = path.join(modelsDir(), destName);
        fs.copyFileSync(srcPath, destPath);

        var models = [];
        try { models = listModels(); } catch (e) { models = []; }
        var rec = {
            id: id,
            name: displayName || path.basename(srcPath, ext),
            file: destName,
            ext: ext,
            addedAt: id
        };
        models.push(rec);
        writeJSONAtomic(modelsIndexPath(), models);
        return rec;
    }
    // Caminho absoluto (file URL) de um modelo da biblioteca, para o loader.
    function modelFileURL(rec) {
        var abs = path.join(modelsDir(), rec.file);
        return 'file:///' + abs.replace(/\\/g, '/');
    }
    /*
     * Deleta um modelo importado da biblioteca.
     *
     * Contrato de retorno (estruturado):
     *   sucesso  -> { ok: true, models: <indice sem o registro> }
     *   falha ao apagar o arquivo (unlinkSync lanca) -> { ok: false, models: <indice AINDA COM o registro>, kept: true }
     *
     * Em caso de falha de unlink NAO removemos o registro de models_index.json:
     * o card permanece na Biblioteca e o painel exibe a mensagem de falha (Req 1.5).
     * Se o registro nao existir no indice, tratamos como sucesso trivial (nada a apagar).
     *
     * Nota: o retorno mudou de "array de models" (contrato antigo) para este objeto
     * estruturado. Chamadores devem usar o campo .models para obter a lista.
     */
    function deleteModel(id) {
        var models = listModels();
        var rec = null;
        var i;
        for (i = 0; i < models.length; i++) {
            if (models[i].id === id) { rec = models[i]; break; }
        }
        if (!rec) {
            // Nada a remover: indice ja nao contem o registro.
            return { ok: true, models: models };
        }
        // Tenta apagar o arquivo copiado ANTES de mexer no indice.
        try {
            fs.unlinkSync(path.join(modelsDir(), rec.file));
        } catch (e) {
            // Falhou apagar o arquivo: mantem o registro no indice (nao regrava).
            return { ok: false, models: models, kept: true };
        }
        // Arquivo removido com sucesso: remove o registro do indice e persiste.
        var out = models.filter(function (m) { return m.id !== id; });
        writeJSONAtomic(modelsIndexPath(), out);
        return { ok: true, models: out };
    }

    // ---------- Categorias e estado de gaveta ----------
    /*
     * Novos campos de config (leitura tolerante a ausencia, tratados como vazios):
     *   modelCategories    array de nomes de categorias custom de modelos.
     *   modelCatOverrides  mapa itemKey -> nome de categoria (url ou 'my:<id>').
     *   sceneCategories    array de nomes de categorias de cenas.
     *   drawerState        mapa page -> { catId -> bool } (expandida/recolhida).
     * E, por cena em scenes.json, o campo categoryId (opcional).
     */

    // Define ou remove o override de categoria de um modelo. catId nulo/vazio remove a chave.
    function setModelCategoryOverride(itemKey, catId) {
        if (itemKey == null || itemKey === '') return readConfig();
        var cfg = {};
        try { cfg = readConfig(); } catch (e) { cfg = {}; }
        var ov = cfg.modelCatOverrides;
        if (!ov || typeof ov !== 'object') ov = {};
        if (catId == null || catId === '') {
            if (ov.hasOwnProperty(itemKey)) delete ov[itemKey];
        } else {
            ov[itemKey] = catId;
        }
        return writeConfig({ modelCatOverrides: ov });
    }

    // Utilitario interno: adiciona um nome a um array de categorias sem duplicar (case-insensitive).
    function addCategoryTo(arr, name) {
        var list = (arr && arr.length) ? arr.slice() : [];
        if (name == null) return list;
        var trimmed = String(name).replace(/^\s+|\s+$/g, '');
        if (trimmed === '') return list;
        for (var i = 0; i < list.length; i++) {
            if (String(list[i]).toLowerCase() === trimmed.toLowerCase()) return list;
        }
        list.push(trimmed);
        return list;
    }

    function addModelCategory(name) {
        var cfg = {};
        try { cfg = readConfig(); } catch (e) { cfg = {}; }
        var list = addCategoryTo(cfg.modelCategories, name);
        return writeConfig({ modelCategories: list });
    }

    // Renomeia categoria de modelos no array e migra os overrides que apontavam para o nome antigo.
    function renameModelCategory(oldName, newName) {
        var cfg = {};
        try { cfg = readConfig(); } catch (e) { cfg = {}; }
        var trimmed = (newName == null) ? '' : String(newName).replace(/^\s+|\s+$/g, '');
        if (oldName == null || trimmed === '') return cfg;

        var list = (cfg.modelCategories && cfg.modelCategories.length) ? cfg.modelCategories.slice() : [];
        var i;
        for (i = 0; i < list.length; i++) {
            if (String(list[i]) === String(oldName)) list[i] = trimmed;
        }

        var ov = (cfg.modelCatOverrides && typeof cfg.modelCatOverrides === 'object') ? cfg.modelCatOverrides : {};
        var newOv = {};
        for (var key in ov) {
            if (!ov.hasOwnProperty(key)) continue;
            newOv[key] = (String(ov[key]) === String(oldName)) ? trimmed : ov[key];
        }
        return writeConfig({ modelCategories: list, modelCatOverrides: newOv });
    }

    function addSceneCategory(name) {
        var cfg = {};
        try { cfg = readConfig(); } catch (e) { cfg = {}; }
        var list = addCategoryTo(cfg.sceneCategories, name);
        return writeConfig({ sceneCategories: list });
    }

    // Renomeia categoria de cenas no array e migra o categoryId das cenas correspondentes.
    function renameSceneCategory(oldName, newName) {
        var cfg = {};
        try { cfg = readConfig(); } catch (e) { cfg = {}; }
        var trimmed = (newName == null) ? '' : String(newName).replace(/^\s+|\s+$/g, '');
        if (oldName == null || trimmed === '') return cfg;

        var list = (cfg.sceneCategories && cfg.sceneCategories.length) ? cfg.sceneCategories.slice() : [];
        var i;
        for (i = 0; i < list.length; i++) {
            if (String(list[i]) === String(oldName)) list[i] = trimmed;
        }
        writeConfig({ sceneCategories: list });

        var scenes = [];
        try { scenes = listScenes(); } catch (e) { scenes = []; }
        var changed = false;
        for (i = 0; i < scenes.length; i++) {
            if (scenes[i] && String(scenes[i].categoryId) === String(oldName)) {
                scenes[i].categoryId = trimmed;
                changed = true;
            }
        }
        if (changed) writeJSONAtomic(scenesPath(), scenes);
        return scenes;
    }

    // Define a categoria (categoryId) de uma cena alvo e regrava scenes.json.
    function setSceneCategory(sceneId, catId) {
        var scenes = [];
        try { scenes = listScenes(); } catch (e) { scenes = []; }
        for (var i = 0; i < scenes.length; i++) {
            if (scenes[i] && scenes[i].id === sceneId) {
                if (catId == null || catId === '') {
                    if (scenes[i].hasOwnProperty('categoryId')) delete scenes[i].categoryId;
                } else {
                    scenes[i].categoryId = catId;
                }
                break;
            }
        }
        writeJSONAtomic(scenesPath(), scenes);
        return scenes;
    }

    // Atualiza o estado (expandida/recolhida) de uma gaveta, criando mapas ausentes.
    function setDrawerState(page, catId, expanded) {
        if (page == null || catId == null) return readConfig();
        var cfg = {};
        try { cfg = readConfig(); } catch (e) { cfg = {}; }
        var ds = (cfg.drawerState && typeof cfg.drawerState === 'object') ? cfg.drawerState : {};
        var pageMap = (ds[page] && typeof ds[page] === 'object') ? ds[page] : {};
        pageMap[catId] = !!expanded;
        ds[page] = pageMap;
        return writeConfig({ drawerState: ds });
    }

    global.LightRefStorage = {
        rootDir: rootDir,
        readConfig: readConfig,
        writeConfig: writeConfig,
        listScenes: listScenes,
        saveScene: saveScene,
        deleteScene: deleteScene,
        listModels: listModels,
        importModel: importModel,
        modelFileURL: modelFileURL,
        deleteModel: deleteModel,
        setModelCategoryOverride: setModelCategoryOverride,
        addModelCategory: addModelCategory,
        renameModelCategory: renameModelCategory,
        addSceneCategory: addSceneCategory,
        renameSceneCategory: renameSceneCategory,
        setSceneCategory: setSceneCategory,
        setDrawerState: setDrawerState
    };
})(window);
