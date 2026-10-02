/*
 * update.js - verificacao de atualizacao do LightRef (padrao Xuimart).
 * ASCII-only. Faz um GET silencioso ao version.json, compara com a versao
 * compilada e, se houver versao nova, mostra um banner com o changelog e um
 * botao que abre o link de download no navegador. Falhas sao ignoradas.
 */
(function (global) {
    'use strict';

    // Versao compilada deste build. Bump a cada release (ver SISTEMA_DE_UPDATE).
    var LIGHTREF_VERSION = '0.8.0';

    // Fonte da verdade para "existe versao nova?".
    var VERSION_URL = 'https://www.xuimart.com.br/lightref/version.json';
    // Link permanente do instalador (nome fixo, sem versao).
    var FALLBACK_DOWNLOAD = 'https://github.com/xuimart/lightref/releases/latest/download/LightRef_Setup.exe';

    // SemVer numerico por segmento: retorna 1 se a>b, -1 se a<b, 0 se igual.
    function compareVersions(a, b) {
        var pa = String(a).split('.').map(Number);
        var pb = String(b).split('.').map(Number);
        for (var i = 0; i < 3; i++) {
            var x = pa[i] || 0, y = pb[i] || 0;
            if (x > y) return 1;
            if (x < y) return -1;
        }
        return 0;
    }

    // GET simples. Usa o https do Node (CEP com --enable-nodejs); cai no fetch
    // do navegador se precisar. cb(err, dataObj).
    function fetchJson(url, cb) {
        // Cache-buster: proxies/CDN podem servir version.json em cache (A.6).
        var busted = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + (new Date()).getTime();
        try {
            var https = require('https');
            var req = https.get(busted, function (res) {
                var body = '';
                res.on('data', function (c) { body += c; });
                res.on('end', function () {
                    try { cb(null, JSON.parse(body)); }
                    catch (e) { cb(e); }
                });
            });
            req.on('error', function (e) { cb(e); });
            req.setTimeout(6000, function () { req.destroy(); cb(new Error('timeout')); });
        } catch (eNode) {
            // Fallback: fetch (pode esbarrar em CSP, por isso https e o preferido).
            try {
                global.fetch(busted).then(function (r) { return r.json(); })
                    .then(function (j) { cb(null, j); })
                    .catch(function (e) { cb(e); });
            } catch (eFetch) { cb(eFetch); }
        }
    }

    // Abre uma URL no navegador padrao do sistema (fora do painel CEP).
    function openExternal(url) {
        try {
            if (global.cep && global.cep.util && global.cep.util.openURLInDefaultBrowser) {
                global.cep.util.openURLInDefaultBrowser(url);
                return;
            }
        } catch (e) {}
        try {
            var cs = new global.CSInterface();
            cs.openURLInDefaultBrowser(url);
        } catch (e2) {}
    }

    function buildBanner(info) {
        var wrap = global.document.createElement('div');
        wrap.id = 'lf-update-banner';
        var ver = info.version || '';
        var log = info.changelog || 'Nova versao disponivel.';
        var url = info.downloadUrl || FALLBACK_DOWNLOAD;
        wrap.innerHTML =
            '<div class="lf-upd-row">' +
              '<strong>Atualizacao ' + ver + '</strong>' +
              '<button class="lf-upd-x" title="Fechar" aria-label="Fechar">&times;</button>' +
            '</div>' +
            '<div class="lf-upd-log"></div>' +
            '<button class="lf-upd-dl">Baixar atualizacao</button>';
        wrap.querySelector('.lf-upd-log').textContent = log;
        wrap.querySelector('.lf-upd-dl').addEventListener('click', function () { openExternal(url); });
        wrap.querySelector('.lf-upd-x').addEventListener('click', function () {
            if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        });
        return wrap;
    }

    function showBanner(info) {
        try {
            var host = global.document.getElementById('lightref') || global.document.body;
            var existing = global.document.getElementById('lf-update-banner');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            host.appendChild(buildBanner(info));
        } catch (e) {}
    }

    // Decide o desfecho da verificacao de versao (PURA, testavel sem rede).
    // retorna 'banner'  -> existe versao mais nova (mostrar banner/baixar)
    //         'current' -> ja esta atualizado (so avisa se manual)
    //         'silent'  -> nada a fazer
    function decideUpdateOutcome(remote, installed, manual) {
        if (remote && compareVersions(remote, installed) > 0) return 'banner';
        return manual ? 'current' : 'silent';
    }

    // API publica.
    var LightRefUpdate = {
        VERSION: LIGHTREF_VERSION,
        compareVersions: compareVersions,
        decideUpdateOutcome: decideUpdateOutcome,
        // check(manual): se manual=true, avisa mesmo quando ja esta atualizado.
        check: function (manual) {
            fetchJson(VERSION_URL, function (err, info) {
                if (err || !info || !info.version) {
                    if (manual && global.LightRefToast) global.LightRefToast('Nao foi possivel verificar atualizacoes.');
                    return;
                }
                var outcome = decideUpdateOutcome(info.version, LIGHTREF_VERSION, manual);
                if (outcome === 'banner') {
                    showBanner(info);
                } else if (outcome === 'current' && global.LightRefToast) {
                    global.LightRefToast('Voce ja esta na versao mais recente (' + LIGHTREF_VERSION + ').');
                }
            });
        }
    };

    global.LightRefUpdate = LightRefUpdate;
})(this);
