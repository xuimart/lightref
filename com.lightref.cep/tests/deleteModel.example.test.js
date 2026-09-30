/*
 * Task 2.1 - Teste de exemplo: deleteModel com falha de unlink.
 * Requirements: 1.5
 *
 * Quando a remocao do arquivo do modelo falha (fs.unlinkSync lanca), deleteModel deve:
 *  - retornar { ok:false, kept:true };
 *  - MANTER o registro do modelo em models_index.json (o card permanece na Biblioteca);
 *  - NAO alterar o indice persistido.
 *
 * Tambem cobre o caminho de sucesso (unlink normal) para contrastar o contrato:
 *  - retorna { ok:true } e remove o registro do indice.
 *
 * Usa o harness loadStorage com fs em memoria; para o caso de falha injeta um fs
 * cujo unlinkSync lanca (via env.fsPatch), mantendo o resto do fs em memoria.
 */
'use strict';

const assert = require('assert');
const { loadStorage } = require('./loadStorage');

const APPDATA = '/appdata';
const INDEX = APPDATA + '/LightRef/models_index.json';

// Semeia um indice com dois modelos importados e o "arquivo" copiado de cada um.
function seedTwoModels(memfs) {
  const models = [
    { id: 111, name: 'Modelo A', file: 'model_111.obj', ext: '.obj', addedAt: 111 },
    { id: 222, name: 'Modelo B', file: 'model_222.glb', ext: '.glb', addedAt: 222 }
  ];
  memfs._files[INDEX] = JSON.stringify(models, null, 2);
  // Arquivos copiados que existem no fs em memoria.
  memfs._files[APPDATA + '/LightRef/models/model_111.obj'] = 'OBJ-DATA-A';
  memfs._files[APPDATA + '/LightRef/models/model_222.glb'] = 'GLB-DATA-B';
  return models;
}

function testUnlinkFailureKeepsRecord() {
  const { storage, memfs } = loadStorage({
    APPDATA: APPDATA,
    fsPatch: function (m) {
      // unlink sempre lanca (ex.: arquivo travado / permissao negada).
      m.unlinkSync = function () {
        const err = new Error('EPERM: operation not permitted, unlink');
        err.code = 'EPERM';
        throw err;
      };
    }
  });
  seedTwoModels(memfs);

  const res = storage.deleteModel(111);

  // Contrato de retorno em falha.
  assert.strictEqual(res.ok, false, 'ok deveria ser false quando unlink falha');
  assert.strictEqual(res.kept, true, 'kept deveria ser true quando unlink falha');

  // Registro preservado no retorno.
  const stillInReturned = res.models.some(function (m) { return m.id === 111; });
  assert.ok(stillInReturned, 'registro deveria permanecer na lista retornada');

  // Registro preservado no indice persistido (nao regravado sem o item).
  const onDisk = JSON.parse(memfs._files[INDEX]);
  const stillOnDisk = onDisk.some(function (m) { return m.id === 111; });
  assert.ok(stillOnDisk, 'registro deveria permanecer em models_index.json');
  assert.strictEqual(onDisk.length, 2, 'indice deveria manter os 2 modelos');

  console.log('Task 2.1 (deleteModel unlink failure keeps record): OK');
}

function testSuccessRemovesRecord() {
  // Sem fsPatch: unlinkSync padrao do memfs (remove a chave, nao lanca).
  const { storage, memfs } = loadStorage({ APPDATA: APPDATA });
  seedTwoModels(memfs);

  const res = storage.deleteModel(111);

  assert.strictEqual(res.ok, true, 'ok deveria ser true no sucesso');
  const removedFromReturn = res.models.every(function (m) { return m.id !== 111; });
  assert.ok(removedFromReturn, 'registro deveria sair da lista retornada');

  const onDisk = JSON.parse(memfs._files[INDEX]);
  const removedOnDisk = onDisk.every(function (m) { return m.id !== 111; });
  assert.ok(removedOnDisk, 'registro deveria sair de models_index.json');
  assert.strictEqual(onDisk.length, 1, 'indice deveria manter apenas 1 modelo');

  // Arquivo copiado tambem foi removido.
  assert.ok(
    !memfs.existsSync(APPDATA + '/LightRef/models/model_111.obj'),
    'arquivo copiado deveria ter sido apagado no sucesso'
  );

  console.log('Task 2.1 (deleteModel success removes record): OK');
}

function testMissingRecordIsTrivialSuccess() {
  const { storage, memfs } = loadStorage({ APPDATA: APPDATA });
  seedTwoModels(memfs);

  const res = storage.deleteModel(999); // id inexistente
  assert.strictEqual(res.ok, true, 'ok deveria ser true quando nao ha nada a remover');
  assert.strictEqual(res.models.length, 2, 'indice inalterado quando id nao existe');

  console.log('Task 2.1 (deleteModel missing record trivial success): OK');
}

testUnlinkFailureKeepsRecord();
testSuccessRemovesRecord();
testMissingRecordIsTrivialSuccess();
