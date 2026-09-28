/*
 * storage.js â€” persistencia do LightRef (padrao Xuimart, escrita atomica).
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
     * NAO cai no default silenciosamente (isso mascarava corrupcao no DrawlapsePS) â€”
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
    // scene: { id, name, createdAt, state:{...}, thumb:dataURL }. Salva ou sobrescreve por nome.
    function saveScene(name, state, thumb) {
        var scenes = [];
        try { scenes = listScenes(); } catch (e) { scenes = []; }
        var existing = null;
        for (var i = 0; i < scenes.length; i++) {
            if (scenes[i].name === name) { existing = scenes[i]; break; }
        }
        if (existing) {
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
    function deleteModel(id) {
        var models = listModels();
        var rec = null;
        var out = models.filter(function (m) {
            if (m.id === id) { rec = m; return false; }
            return true;
        });
        if (rec) {
            try { fs.unlinkSync(path.join(modelsDir(), rec.file)); } catch (e) { /* ignora */ }
        }
        writeJSONAtomic(modelsIndexPath(), out);
        return out;
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
        deleteModel: deleteModel
    };
})(window);
