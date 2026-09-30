/*
 * loadStorage.js - carrega js/storage.js (codigo de producao ES5) num ambiente
 * Node controlado, com um fs em memoria e um window falso, para os testes PBT.
 *
 * O storage.js real usa require('fs'/'path'/'os') e escreve/le no disco de forma
 * atomica (writeJSONAtomic = tmp + rename). Aqui injetamos um fs em memoria que
 * respeita esse mesmo padrao, para exercitar a logica real de read-modify-write
 * sem tocar no disco.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Le o fonte de producao uma vez.
const STORAGE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'storage.js'),
  'utf8'
);

/** Cria um fs em memoria minimo, compativel com o uso feito por storage.js. */
function makeMemFs() {
  const files = Object.create(null); // caminho normalizado -> conteudo string

  function norm(p) {
    return String(p).replace(/\\/g, '/');
  }

  return {
    _files: files,
    existsSync(p) {
      return Object.prototype.hasOwnProperty.call(files, norm(p));
    },
    mkdirSync() {
      // diretorios sao implicitos no mapa em memoria; no-op.
    },
    readFileSync(p) {
      const key = norm(p);
      if (!Object.prototype.hasOwnProperty.call(files, key)) {
        const err = new Error('ENOENT: ' + key);
        err.code = 'ENOENT';
        throw err;
      }
      return files[key];
    },
    writeFileSync(p, data) {
      files[norm(p)] = String(data);
    },
    renameSync(from, to) {
      const a = norm(from);
      const b = norm(to);
      if (!Object.prototype.hasOwnProperty.call(files, a)) {
        const err = new Error('ENOENT: ' + a);
        err.code = 'ENOENT';
        throw err;
      }
      files[b] = files[a];
      delete files[a];
    },
    unlinkSync(p) {
      delete files[norm(p)];
    },
    copyFileSync(src, dest) {
      files[norm(dest)] = Object.prototype.hasOwnProperty.call(files, norm(src))
        ? files[norm(src)]
        : '';
    }
  };
}

/**
 * Instancia um LightRefStorage novo, isolado, apoiado num fs em memoria.
 * Retorna { storage, memfs }.
 *
 * Opcoes (env):
 *   APPDATA   raiz simulada (default '/appdata').
 *   fsPatch   funcao (memfs) => void que altera/estende o fs em memoria antes de
 *             carregar o storage (ex.: fazer unlinkSync lancar). Opcional; nao
 *             afeta os testes existentes que nao passam esta opcao.
 */
function loadStorage(env) {
  env = env || {};
  const memfs = makeMemFs();
  if (typeof env.fsPatch === 'function') {
    env.fsPatch(memfs);
  }
  const os = {
    homedir() {
      return '/home/test';
    }
  };

  const fakeRequire = function (name) {
    if (name === 'fs') return memfs;
    if (name === 'path') return path.posix; // caminhos com barra "/" (batem com norm)
    if (name === 'os') return os;
    throw new Error('require nao suportado no teste: ' + name);
  };

  const fakeWindow = {};
  const sandbox = {
    require: fakeRequire,
    window: fakeWindow,
    process: { env: { APPDATA: env.APPDATA || '/appdata' } },
    JSON: JSON,
    Date: Date,
    console: console
  };

  vm.createContext(sandbox);
  vm.runInContext(STORAGE_SRC, sandbox, { filename: 'storage.js' });

  return { storage: fakeWindow.LightRefStorage, memfs: memfs };
}

module.exports = { loadStorage, makeMemFs };
