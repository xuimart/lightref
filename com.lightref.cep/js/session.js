/*
 * session.js - persistencia do Estado_da_Sessao do LightRef (window.LightRefSession).
 *
 * Objetivo (Area C do design): decidir no boot se restauramos o estado em disco
 * (Recarregamento_do_Painel, mesma Sessao_do_Photoshop) ou iniciamos no
 * Estado_Inicial (nova Sessao_do_Photoshop). A decisao combina:
 *   - um arquivo de sessao por versao do Host (payload grande, carrega o
 *     sessionToken que o criou), e
 *   - o sessionToken VIVO da Sessao_do_Photoshop atual, lido via
 *     CSInterface.evalScript('lightrefSessionToken()').
 * Restauramos sse arquivo.sessionToken === tokenVivo e o estado e valido.
 *
 * Depende de window.LightRefStorage (rootDir), opcionalmente window.CSInterface
 * e das funcoes puras publicadas em window.__lrStateApi (sanitizeSessionState).
 *
 * ES5 + ASCII only. Sem arrow functions, let/const, template literals, Promise,
 * classes. Escrita atomica (tmp + rename) no padrao do storage.js.
 */
(function (global) {
    'use strict';

    var fs = require('fs');
    var path = require('path');

    // -------------------------------------------------------------------------
    // Registro de falhas (Req 15.5): nunca propaga; empilha em
    // window.__lrSessionErrors e, se existir, chama window.__lrDiagWrite.
    // -------------------------------------------------------------------------
    function logSessionError(where, err) {
        try {
            if (!global.__lrSessionErrors) global.__lrSessionErrors = [];
            var msg = where + ': ' + String((err && (err.message || err)) || 'erro');
            global.__lrSessionErrors.push(msg);
            if (typeof global.__lrDiagWrite === 'function') {
                try { global.__lrDiagWrite(); } catch (e2) {}
            }
        } catch (e) { /* nunca lanca */ }
    }

    // -------------------------------------------------------------------------
    // PURAS (testaveis sem fs/CSInterface)
    // -------------------------------------------------------------------------

    // Mantem apenas [A-Za-z0-9._-]; o resto some. Entrada nao-string -> ''.
    function safe(s) {
        if (s == null) return '';
        return String(s).replace(/[^A-Za-z0-9._\-]/g, '');
    }

    // Nome do arquivo de sessao por versao do Host (Req 14.3 - isolamento).
    // hostEnv ausente ou sem appName -> 'session_unknown.json'.
    function sessionFileName(hostEnv) {
        if (!hostEnv || typeof hostEnv !== 'object') return 'session_unknown.json';
        var app = safe(hostEnv.appName);
        if (!app) return 'session_unknown.json';
        var ver = safe(hostEnv.appVersion);
        return 'session_' + app + ver + '.json';
    }

    // Decide se restaura (Req 13.1-13.3): token vivo nao-vazio E arquivo objeto
    // E arquivo.sessionToken === token vivo. Qualquer outra coisa -> false.
    function shouldRestore(fileObj, liveToken) {
        if (typeof liveToken !== 'string' || liveToken === '') return false;
        if (!fileObj || typeof fileObj !== 'object') return false;
        if (Object.prototype.toString.call(fileObj) === '[object Array]') return false;
        return fileObj.sessionToken === liveToken;
    }

    // Debouncer testavel com relogio e timers injetaveis (Req 14.6).
    // Coalesce rajadas: em qualquer janela de t ms, no maximo 1 + floor(t/delay)
    // gravacoes efetivas. request(fn) guarda a ultima fn e agenda uma gravacao;
    // novas chamadas enquanto ha timer pendente apenas atualizam a fn (coalesce).
    // flush() dispara a pendente imediatamente.
    function makeDebouncer(delayMs, nowFn, setTimerFn, clearTimerFn) {
        var timer = null;
        var pending = null;
        var hasPending = false;

        function fire() {
            timer = null;
            if (!hasPending) return;
            var fn = pending;
            pending = null;
            hasPending = false;
            if (typeof fn === 'function') fn();
        }

        function request(fn) {
            pending = fn;
            hasPending = true;
            if (timer != null) return; // ja agendado: coalesce
            timer = setTimerFn(fire, delayMs);
        }

        function flush() {
            if (timer != null) {
                clearTimerFn(timer);
                timer = null;
            }
            fire();
        }

        return { request: request, flush: flush };
    }

    // -------------------------------------------------------------------------
    // IMPURAS (fiacao com CSInterface / fs / storage)
    // -------------------------------------------------------------------------

    function newCS() {
        if (typeof global.CSInterface !== 'function') return null;
        try { return new global.CSInterface(); } catch (e) { return null; }
    }

    // Ambiente do Host (appName/appVersion). Falha -> null.
    function hostEnv() {
        var cs = newCS();
        if (!cs || typeof cs.getHostEnvironment !== 'function') return null;
        try { return cs.getHostEnvironment(); } catch (e) { return null; }
    }

    // Resolve o token vivo via evalScript('lightrefSessionToken()').
    // Trata ausencia/erro/'EvalScript error.'/'' como null (lado seguro).
    function resolveToken(cb) {
        var cs = newCS();
        if (!cs || typeof cs.evalScript !== 'function') { cb(null); return; }
        try {
            cs.evalScript('lightrefSessionToken()', function (res) {
                var t = (typeof res === 'string') ? res.replace(/^\s+|\s+$/g, '') : '';
                if (t === '' || t === 'EvalScript error.') { cb(null); return; }
                cb(t);
            });
        } catch (e) {
            logSessionError('resolveToken', e);
            cb(null);
        }
    }

    // Token vivo cacheado por Sessao (resolvido uma vez; carregado nos saves).
    var _cachedToken = null;
    function ensureToken(cb) {
        if (_cachedToken != null) { cb(_cachedToken); return; }
        resolveToken(function (t) { _cachedToken = t; cb(t); });
    }
    // Setter para testes (injeta um token sem CSInterface).
    function _setTokenForTest(t) { _cachedToken = t; }

    function filePath() {
        return path.join(global.LightRefStorage.rootDir(), sessionFileName(hostEnv()));
    }

    // Le + parse do arquivo; qualquer erro -> null + log (Req 15.5).
    function read() {
        try {
            var fp = filePath();
            if (!fs.existsSync(fp)) return null;
            var raw = fs.readFileSync(fp, 'utf8');
            if (raw && raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
            return JSON.parse(raw);
        } catch (e) {
            logSessionError('read', e);
            return null;
        }
    }

    // Gravacao atomica (tmp + rename). Nunca lanca; erro -> log (Req 15.5).
    function save(sessionState) {
        try {
            if (!sessionState) return;
            var fp = filePath();
            var dir = path.dirname(fp);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            var tmp = fp + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(sessionState, null, 2), 'utf8');
            fs.renameSync(tmp, fp);
        } catch (e) {
            logSessionError('save', e);
        }
    }

    // Debouncer de producao: 300 ms, Date.now, setTimeout/clearTimeout.
    var _debouncer = makeDebouncer(300,
        function () { return Date.now(); },
        function (fn, ms) { return setTimeout(fn, ms); },
        function (id) { clearTimeout(id); });

    // Grava com debounce; collectFn() -> SessionState a persistir. Carimba o
    // token vivo cacheado para que a gravacao leve o token certo (Req 14.6).
    function requestSave(collectFn) {
        _debouncer.request(function () {
            try {
                var st = (typeof collectFn === 'function') ? collectFn() : null;
                if (st && _cachedToken != null) st.sessionToken = _cachedToken;
                save(st);
            } catch (e) {
                logSessionError('requestSave', e);
            }
        });
    }

    // Forca a gravacao pendente imediatamente (usado ao ocultar o painel).
    function flush() {
        try { _debouncer.flush(); } catch (e) { logSessionError('flush', e); }
    }

    // Boot: cb(stateParaRestaurar | null). null => Estado_Inicial. Nunca lanca.
    function restoreIfSameSession(initial, cb) {
        try {
            ensureToken(function (liveToken) {
                try {
                    var fileObj = read();
                    if (shouldRestore(fileObj, liveToken)) {
                        var clean = null;
                        try {
                            var api = global.__lrStateApi;
                            if (api && typeof api.sanitizeSessionState === 'function') {
                                clean = api.sanitizeSessionState(fileObj, initial);
                            }
                        } catch (e2) { logSessionError('sanitize', e2); clean = null; }
                        cb(clean || null);
                    } else {
                        cb(null);
                    }
                } catch (e1) {
                    logSessionError('restoreIfSameSession', e1);
                    cb(null);
                }
            });
        } catch (e) {
            logSessionError('restoreIfSameSession', e);
            cb(null);
        }
    }

    global.LightRefSession = {
        // puras (expostas para teste)
        sessionFileName: sessionFileName,
        shouldRestore: shouldRestore,
        makeDebouncer: makeDebouncer,
        // impuras
        resolveToken: resolveToken,
        hostEnv: hostEnv,
        filePath: filePath,
        read: read,
        save: save,
        requestSave: requestSave,
        flush: flush,
        restoreIfSameSession: restoreIfSameSession,
        _setTokenForTest: _setTokenForTest
    };
})(window);
