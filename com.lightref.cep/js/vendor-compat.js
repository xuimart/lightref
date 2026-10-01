/*
 * vendor-compat.js - polyfills para o CEF antigo do Photoshop 2019/2020
 * (Chromium 61-74). O Babylon.js usa APIs mais novas (Array.flat, .at,
 * globalThis, Object.fromEntries, Promise.allSettled...). Aqui definimos
 * APENAS o que estiver faltando; no CEF novo nada muda. ES5, ASCII-only.
 * Precisa carregar ANTES de babylon.js.
 */
(function (g) {
    'use strict';
    var added = [];

    function def(obj, name, fn, label) {
        if (!obj || typeof obj[name] !== 'undefined') return;
        try {
            Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true, enumerable: false });
        } catch (e) { obj[name] = fn; }
        added.push(label || name);
    }

    // globalThis (Chrome 71)
    if (typeof g.globalThis === 'undefined') {
        try { Object.defineProperty(g, 'globalThis', { value: g, writable: true, configurable: true }); }
        catch (e) { g.globalThis = g; }
        added.push('globalThis');
    }

    // Array.prototype.flat / flatMap (Chrome 69)
    function flattenInto(out, arr, depth) {
        for (var i = 0; i < arr.length; i++) {
            if (!(i in arr)) continue;
            var v = arr[i];
            if (depth > 0 && Array.isArray(v)) flattenInto(out, v, depth - 1);
            else out.push(v);
        }
        return out;
    }
    def(Array.prototype, 'flat', function (depth) {
        var d = (depth === undefined) ? 1 : (Math.floor(Number(depth)) || 0);
        return flattenInto([], Object(this), d);
    }, 'Array.flat');
    def(Array.prototype, 'flatMap', function (fn, thisArg) {
        return flattenInto([], Array.prototype.map.call(Object(this), fn, thisArg), 1);
    }, 'Array.flatMap');

    // .at (Chrome 92): Array, String e TypedArrays
    function atImpl(index) {
        var len = this.length >>> 0;
        var n = Number(index);
        if (n !== n) n = 0;
        n = (n < 0) ? Math.ceil(n) : Math.floor(n);
        if (n < 0) n += len;
        if (n < 0 || n >= len) return undefined;
        return (typeof this === 'string') ? this.charAt(n) : this[n];
    }
    def(Array.prototype, 'at', atImpl, 'Array.at');
    def(String.prototype, 'at', atImpl, 'String.at');
    if (typeof Int8Array !== 'undefined') {
        def(Object.getPrototypeOf(Int8Array.prototype), 'at', atImpl, 'TypedArray.at');
    }

    // String.prototype.trimStart / trimEnd (Chrome 66)
    def(String.prototype, 'trimStart', String.prototype.trimLeft || function () {
        return String(this).replace(/^[\s\uFEFF\xA0]+/, '');
    }, 'String.trimStart');
    def(String.prototype, 'trimEnd', String.prototype.trimRight || function () {
        return String(this).replace(/[\s\uFEFF\xA0]+$/, '');
    }, 'String.trimEnd');

    // Object.fromEntries (Chrome 73)
    def(Object, 'fromEntries', function (iterable) {
        if (iterable == null) throw new TypeError('Object.fromEntries: argumento invalido');
        var o = {}, e, i;
        if (typeof Symbol !== 'undefined' && typeof iterable[Symbol.iterator] === 'function') {
            var it = iterable[Symbol.iterator](), step;
            while (!(step = it.next()).done) { e = step.value; o[e[0]] = e[1]; }
        } else {
            for (i = 0; i < iterable.length; i++) { e = iterable[i]; o[e[0]] = e[1]; }
        }
        return o;
    }, 'Object.fromEntries');

    // Promise.allSettled (Chrome 76) e Promise.prototype.finally (Chrome 63)
    if (typeof g.Promise === 'function') {
        var P = g.Promise;
        def(P, 'allSettled', function (items) {
            var C = this || P;
            var list = Array.from ? Array.from(items) : Array.prototype.slice.call(items);
            return C.all(list.map(function (x) {
                return C.resolve(x).then(
                    function (v) { return { status: 'fulfilled', value: v }; },
                    function (r) { return { status: 'rejected', reason: r }; });
            }));
        }, 'Promise.allSettled');
        def(P.prototype, 'finally', function (cb) {
            var C = this.constructor || P;
            var f = (typeof cb === 'function') ? cb : function () {};
            return this.then(
                function (v) { return C.resolve(f()).then(function () { return v; }); },
                function (r) { return C.resolve(f()).then(function () { throw r; }); });
        }, 'Promise.finally');
    }

    // queueMicrotask (Chrome 71)
    if (typeof g.queueMicrotask !== 'function' && typeof g.Promise === 'function') {
        g.queueMicrotask = function (fn) {
            g.Promise.resolve().then(fn)['catch'](function (err) { setTimeout(function () { throw err; }, 0); });
        };
        added.push('queueMicrotask');
    }

    // WeakRef / FinalizationRegistry (Chrome 84): versoes funcionais sem coleta fraca.
    if (typeof g.WeakRef !== 'function') {
        g.WeakRef = function WeakRef(target) { this._target = target; };
        g.WeakRef.prototype.deref = function () { return this._target; };
        added.push('WeakRef');
    }
    if (typeof g.FinalizationRegistry !== 'function') {
        g.FinalizationRegistry = function FinalizationRegistry() {};
        g.FinalizationRegistry.prototype.register = function () {};
        g.FinalizationRegistry.prototype.unregister = function () { return false; };
        added.push('FinalizationRegistry');
    }

    // AbortController / AbortSignal (Chrome 66): versao minima.
    if (typeof g.AbortController !== 'function') {
        var Signal = function () { this.aborted = false; this.reason = undefined; this.onabort = null; this._ls = []; };
        Signal.prototype.addEventListener = function (type, fn) { if (type === 'abort' && typeof fn === 'function') this._ls.push(fn); };
        Signal.prototype.removeEventListener = function (type, fn) { var i = this._ls.indexOf(fn); if (i >= 0) this._ls.splice(i, 1); };
        Signal.prototype.throwIfAborted = function () { if (this.aborted) throw this.reason; };
        g.AbortController = function AbortController() { this.signal = new Signal(); };
        g.AbortController.prototype.abort = function (reason) {
            var s = this.signal;
            if (s.aborted) return;
            s.aborted = true;
            s.reason = (reason === undefined) ? new Error('AbortError') : reason;
            var ev = { type: 'abort', target: s };
            if (typeof s.onabort === 'function') { try { s.onabort(ev); } catch (e) {} }
            var ls = s._ls.slice();
            for (var i = 0; i < ls.length; i++) { try { ls[i].call(s, ev); } catch (e2) {} }
        };
        if (typeof g.AbortSignal !== 'function') g.AbortSignal = Signal;
        added.push('AbortController');
    }

    // Lista do que foi preenchido (o diag.js grava isso para depuracao).
    g.__lrPolyfilled = added;
})(window);
