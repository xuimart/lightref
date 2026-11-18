/*
 * curves.js - pure Curve_Model module for the LightRef "Adjust Curves" feature.
 *
 * DECISION: this module holds the PURE curve model only. It has NO DOM access
 * and NO Babylon dependency, so it can be unit-tested in isolation and loaded
 * via Node's vm without a browser or a GPU. It is loaded BEFORE postfx.js in
 * index.html because postfx.js depends on window.LightRefCurves.
 *
 * ES5 + ASCII only: var (no const/let), no arrow functions, no template
 * literals, no class, no destructuring, no default params. Every source byte
 * is ASCII (char code <= 127).
 *
 * Exposes:
 *   global.LightRefCurves = { ... }   // production API
 *   global.__lrCurvesApi  = (same)    // test surface, mirrors __lrStateApi/__lrI18nApi
 */
(function (global) {
    'use strict';

    var IDENTITY_EPS = 1e-6;
    var MOVE_EPS = 1 / 255;

    /* Clamp a finite number into [0,1]; non-finite -> 0. */
    function clamp01(v) {
        v = +v;
        if (!isFinite(v)) { return 0; }
        if (v < 0) { return 0; }
        if (v > 1) { return 1; }
        return v;
    }

    /* Clamp a finite number into [lo,hi]; non-finite -> lo. */
    function clampRange(v, lo, hi) {
        v = +v;
        if (!isFinite(v)) { return lo; }
        if (v < lo) { return lo; }
        if (v > hi) { return hi; }
        return v;
    }

    /* Fresh identity curve: two endpoints at (0,0) and (1,1). */
    function identityPoints() {
        return [ { x: 0, y: 0 }, { x: 1, y: 1 } ];
    }

    /*
     * Validate/normalize a points array into a NEW array:
     *   - sort by x,
     *   - force first point x=0 and last point x=1,
     *   - strictly increasing x (drop duplicate/decreasing-x points),
     *   - all y clamped to [0,1], non-finite coerced,
     *   - if input is not a usable array or has <2 valid points, return a fresh
     *     identity curve.
     * Idempotent: sanitizePoints(sanitizePoints(p)) deep-equals sanitizePoints(p).
     */
    function sanitizePoints(points) {
        if (!points || typeof points.length !== 'number' || points.length < 2) {
            return identityPoints();
        }

        var cleaned = [];
        var i, p, x, y;
        for (i = 0; i < points.length; i++) {
            p = points[i];
            if (!p || typeof p !== 'object') { continue; }
            x = +p.x;
            y = +p.y;
            if (!isFinite(x)) { continue; }
            x = clamp01(x);
            y = clamp01(y);
            cleaned.push({ x: x, y: y });
        }

        if (cleaned.length < 2) {
            return identityPoints();
        }

        /* Stable sort by x. */
        cleaned.sort(function (a, b) {
            if (a.x < b.x) { return -1; }
            if (a.x > b.x) { return 1; }
            return 0;
        });

        /* Force endpoints to x=0 and x=1 (keep their y). */
        cleaned[0] = { x: 0, y: clamp01(cleaned[0].y) };
        cleaned[cleaned.length - 1] = { x: 1, y: clamp01(cleaned[cleaned.length - 1].y) };

        /* Keep only strictly increasing x. Always keep the forced first point;
         * always keep the forced last point. Drop interior points whose x does
         * not strictly exceed the previous kept x, or that reach/exceed x=1. */
        var out = [];
        out.push(cleaned[0]);
        var lastX = cleaned[0].x;
        for (i = 1; i < cleaned.length - 1; i++) {
            x = cleaned[i].x;
            if (x > lastX && x < 1) {
                out.push({ x: x, y: clamp01(cleaned[i].y) });
                lastX = x;
            }
        }
        /* Append the forced last endpoint only if strictly greater than lastX
         * (always true since interior points are < 1 and first is 0). */
        if (1 > lastX) {
            out.push(cleaned[cleaned.length - 1]);
        } else {
            /* Degenerate: everything collapsed; fall back to identity. */
            return identityPoints();
        }

        if (out.length < 2) {
            return identityPoints();
        }
        return out;
    }

    /*
     * Add a control point {x:clamp01(x), y:clamp01(y)} keeping sorted order.
     * Endpoints are not moved/replaced: if x coincides with an endpoint x, the
     * new point is inserted just inside. Returns a new sorted sanitized array.
     */
    function addPoint(points, x, y) {
        var pts = sanitizePoints(points);
        var nx = clamp01(x);
        var ny = clamp01(y);
        var last = pts.length - 1;

        /* Nudge off the endpoints so we never displace them. */
        if (nx <= 0) { nx = MOVE_EPS; }
        if (nx >= 1) { nx = 1 - MOVE_EPS; }

        /* Build a new array with the point inserted in sorted order. Then
         * sanitize to re-enforce strictly increasing x. */
        var out = [];
        var i;
        var inserted = false;
        for (i = 0; i < pts.length; i++) {
            /* Insert before the first interior/last point whose x >= nx, but
             * never before the first endpoint. */
            if (!inserted && i > 0 && pts[i].x >= nx) {
                out.push({ x: nx, y: ny });
                inserted = true;
            }
            out.push({ x: pts[i].x, y: pts[i].y });
        }
        if (!inserted) {
            /* nx is >= all interior xs but < 1: insert just before the last. */
            out.splice(last, 0, { x: nx, y: ny });
        }

        return sanitizePoints(out);
    }

    /*
     * Move point at index to (x,y).
     *   - Endpoints (index 0 / last): vertical only -> x forced to 0 or 1,
     *     y clamped [0,1].
     *   - Interior points: x clamped strictly between neighbors using
     *     eps = 1/255, y clamped [0,1].
     * Returns a NEW sanitized array of the SAME length.
     */
    function movePoint(points, index, x, y) {
        var pts = sanitizePoints(points);
        var last = pts.length - 1;
        var ny = clamp01(y);

        /* Copy points. */
        var out = [];
        var i;
        for (i = 0; i < pts.length; i++) {
            out.push({ x: pts[i].x, y: pts[i].y });
        }

        if (index <= 0) {
            out[0] = { x: 0, y: ny };
        } else if (index >= last) {
            out[last] = { x: 1, y: ny };
        } else {
            var lo = pts[index - 1].x + MOVE_EPS;
            var hi = pts[index + 1].x - MOVE_EPS;
            var cx;
            if (lo > hi) {
                /* No room between neighbors: pin to the midpoint. */
                cx = (pts[index - 1].x + pts[index + 1].x) / 2;
            } else {
                cx = clampRange(x, lo, hi);
            }
            out[index] = { x: cx, y: ny };
        }

        /* Re-sanitize but preserve length: endpoints stay fixed, interior x is
         * already strictly between neighbors, so sanitize will not drop points. */
        return sanitizePoints(out);
    }

    /*
     * Delete interior point at index. If index is 0 or last (an endpoint),
     * return the array unchanged (same length). Otherwise remove exactly that
     * interior point. Returns a new sanitized array.
     */
    function deletePoint(points, index) {
        var pts = sanitizePoints(points);
        var last = pts.length - 1;

        if (index <= 0 || index >= last) {
            /* Endpoint: reject deletion, return unchanged (sanitized) copy. */
            return pts;
        }

        var out = [];
        var i;
        for (i = 0; i < pts.length; i++) {
            if (i === index) { continue; }
            out.push({ x: pts[i].x, y: pts[i].y });
        }
        return sanitizePoints(out);
    }

    /*
     * Build a 256-entry LUT (plain Array, values 0..255 integers) from points
     * using the Fritsch-Carlson monotone cubic Hermite scheme, per design.md.
     *
     * Preconditions: caller passes sanitized points; we defensively sanitize.
     * Postconditions: length 256; integer entries in [0,255]; identity input
     * yields lut[i] === i; monotone non-decreasing y points yield a
     * non-decreasing lut. Returns a plain Array (NOT a typed array).
     */
    function buildLut256(points) {
        var pts = sanitizePoints(points);
        var n = pts.length;
        var k;

        /* Step 1: secant slopes between consecutive points. */
        var delta = [];
        for (k = 0; k < n - 1; k++) {
            var dx = pts[k + 1].x - pts[k].x;
            delta[k] = (dx > 0) ? (pts[k + 1].y - pts[k].y) / dx : 0;
        }

        /* Step 2: tangents m[k] (Fritsch-Carlson). */
        var m = [];
        m[0] = delta[0];
        m[n - 1] = delta[n - 2];
        for (k = 1; k < n - 1; k++) {
            if (delta[k - 1] * delta[k] <= 0) {
                m[k] = 0;
            } else {
                m[k] = (delta[k - 1] + delta[k]) / 2;
            }
        }

        /* Step 3: enforce monotonicity (limit tangents to circle of radius 3). */
        for (k = 0; k < n - 1; k++) {
            if (delta[k] === 0) {
                m[k] = 0;
                m[k + 1] = 0;
            } else {
                var a = m[k] / delta[k];
                var b = m[k + 1] / delta[k];
                var s = a * a + b * b;
                if (s > 9) {
                    var t = 3 / Math.sqrt(s);
                    m[k] = t * a * delta[k];
                    m[k + 1] = t * b * delta[k];
                }
            }
        }

        /* Step 4: evaluate Hermite basis at each of 256 sample inputs. */
        var lut = [];
        var seg = 0;
        var i;
        for (i = 0; i < 256; i++) {
            var xq = i / 255;
            while (seg < n - 2 && xq > pts[seg + 1].x) { seg = seg + 1; }
            var x0 = pts[seg].x;
            var x1 = pts[seg + 1].x;
            var y0 = pts[seg].y;
            var y1 = pts[seg + 1].y;
            var h = x1 - x0;
            var tt = (h > 0) ? (xq - x0) / h : 0;
            var t2 = tt * tt;
            var t3 = t2 * tt;
            var h00 = 2 * t3 - 3 * t2 + 1;
            var h10 = t3 - 2 * t2 + tt;
            var h01 = -2 * t3 + 3 * t2;
            var h11 = t3 - t2;
            var yv = h00 * y0 + h10 * h * m[seg] + h01 * y1 + h11 * h * m[seg + 1];
            yv = clamp01(yv);
            lut[i] = Math.round(yv * 255);
        }

        return lut;
    }

    /*
     * True ONLY for exactly two points at (0,0) and (1,1), within a small
     * epsilon tolerance. Any other shape (extra points, moved endpoints) is
     * not identity.
     */
    function isIdentity(points) {
        if (!points || typeof points.length !== 'number' || points.length !== 2) {
            return false;
        }
        var p0 = points[0];
        var p1 = points[1];
        if (!p0 || !p1) { return false; }
        return Math.abs((+p0.x) - 0) <= IDENTITY_EPS &&
               Math.abs((+p0.y) - 0) <= IDENTITY_EPS &&
               Math.abs((+p1.x) - 1) <= IDENTITY_EPS &&
               Math.abs((+p1.y) - 1) <= IDENTITY_EPS;
    }

    /*
     * 256-bin luminance histogram of an RGBA byte buffer (length
     * width*height*4) using weights 0.2126/0.7152/0.0722, rounded, index
     * clamped to 0..255. Returns a plain Array(256) of counts. The sum of all
     * bins equals width*height.
     */
    function binLuminance(pixels, width, height) {
        var bins = [];
        var i;
        for (i = 0; i < 256; i++) { bins[i] = 0; }

        var count = width * height;
        if (!pixels || typeof pixels.length !== 'number' || count <= 0) {
            return bins;
        }

        var p;
        for (p = 0; p < count; p++) {
            var base = 4 * p;
            var r = +pixels[base];
            var g = +pixels[base + 1];
            var b = +pixels[base + 2];
            if (!isFinite(r)) { r = 0; }
            if (!isFinite(g)) { g = 0; }
            if (!isFinite(b)) { b = 0; }
            var l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
            if (l < 0) { l = 0; }
            if (l > 255) { l = 255; }
            bins[l] = bins[l] + 1;
        }

        return bins;
    }

    var api = {
        clamp01: clamp01,
        sanitizePoints: sanitizePoints,
        addPoint: addPoint,
        movePoint: movePoint,
        deletePoint: deletePoint,
        buildLut256: buildLut256,
        isIdentity: isIdentity,
        binLuminance: binLuminance
    };

    /* Publish on the production global and the Node test surface. Guard with
     * typeof checks so this also works in a vm sandbox where 'global' is the
     * provided context (no real window/self). */
    try {
        if (typeof global !== 'undefined' && global) {
            global.LightRefCurves = api;
            global.__lrCurvesApi = api;
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof window !== 'undefined' && window) {
            window.LightRefCurves = api;
            window.__lrCurvesApi = api;
        }
    } catch (e2) { /* ignore */ }

})(typeof window !== 'undefined' ? window : this);
