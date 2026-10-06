/* ============================================================
   Tree House — المنيو «الغرفة» (محرّك WebGL: لوحة رسم وحدة)
   كاميرا من فوق داخل تري هاوس. كل قسم طاولة حقيقية بمكانها بالغرفة:
   ▸ البيتزا: طاولة بلوط عسلي، ورقة A3 (مثل ورقهم) لكل بيتزا، والاسم ينكتب على ورقتها.
     «الجاية» ← هبّة هوا تشيل البيتزات وتجيب اللي بعدها على نفس الطاولة.
   ▸ الحلويات: الطاولة المدورة اللي جنبها. الكاميرا تمشي لها فوق الأرض والسجادة
     (الأرض أبعد، فتتحرك أبطأ = عمق)، دوائر الورق تنزل، والصحون تنحط عليها.
   ليش لوحة وحدة؟ نسخة الـ DOM (عشرات الطبقات) طلّعت بمتصفح تلغرام/واتساب بالتلفون
   فتحات مربعة والحلويات ما بانت: ذاكرة كرت الشاشة ما تكفي. هسه كل شي ينرسم بلوحة
   بحجم الشاشة، والصور تنصغّر لحجمها الحقيقي على الشاشة (~٤٥MB بدل مئات).
   ‎?t=dolci‎ يفتح على طاولة · ‎?freeze=1500‎ يجمّد لحظة · ‎?go=dolci&freeze=900‎ لحظة من الانتقال
   ‎?pg=1&freeze=900‎ لحظة من «الجاية» · ‎?snap=1‎ الطاولة فاضية (صورة الغطسة بالانترو) · ‎?gl=0‎ رسم 2D
   ============================================================ */
(function () {
  "use strict";
  var D = window.TH_TABLES;
  var qs = new URLSearchParams(location.search);
  var FREEZE = qs.has("freeze") ? parseFloat(qs.get("freeze")) : null;
  var SNAP = qs.get("snap") === "1";
  var room = document.getElementById("room");
  var rail = document.getElementById("rail");
  var nextBtn = document.getElementById("next");
  var nextLabel = document.getElementById("nextLabel");
  var ttl = document.getElementById("ttl");
  if (SNAP) document.body.classList.add("snap");
  var LEAVES = ["storm-1", "storm-2", "storm-4", "storm-5", "storm-6"].map(function (n) { return "assets/leaves/" + n + ".webp"; });
  var R = "assets/menu/room/";
  var INK = "#7a2c1e", INK_SOFT = "#8d4b3b", TERRA = "#b3543f", CARAMEL = "#f0c27a";

  /* ---------- أدوات ---------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }
  function portrait() { return vw() / vh() < 0.9; }
  function eio(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eout(t) { return 1 - Math.pow(1 - t, 3); }
  function ein(t) { return t * t * t; }
  // cubic-bezier مثل الـ CSS
  function cubic(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function X(t) { return ((ax * t + bx) * t + cx) * t; }
    function Y(t) { return ((ay * t + by) * t + cy) * t; }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x, i;
      for (i = 0; i < 8; i++) { var e = X(t) - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(e) < 1e-5) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      var lo = 0, hi = 1; t = x;
      for (i = 0; i < 30; i++) { var v = X(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  var LIN = function (t) { return t; };
  var SOFT = cubic(.33, 0, .2, 1), EXPO = cubic(.16, 1, .3, 1), EOUT = cubic(0, 0, .58, 1);
  var AWAY = cubic(.55, 0, .75, .4), LIFTR = cubic(.5, 0, .8, .4), SWEEP = cubic(.55, 0, .8, .3);
  function money(n) { return n.toLocaleString("ar-IQ") + " " + D.currency; }
  var IMG = {};
  function loadImg(src) {
    if (IMG[src]) return Promise.resolve(IMG[src]);
    return new Promise(function (res) {
      var im = new Image(); im.decoding = "async";
      im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { IMG[src] = im; res(im); }, function () { IMG[src] = im; res(im); }); };
      im.onerror = function () { res(null); }; im.src = src;
    });
  }
  function tIndex(id) { for (var i = 0; i < D.tables.length; i++) if (D.tables[i].id === id) return i; return 0; }
  function wa(e, kf, o) { return e.animate(kf, o); }      // حركات DOM الصغيرة (العنوان بس)

  /* ============================================================
     الوقت والحركات: ساعة وحدة لكل شي (تتجمّد للفحص)
     ============================================================ */
  var TW = [], TM = [], clk = { cur: 0, step: false }, FROZEN = false;
  function now() { return (clk.step || FROZEN) ? clk.cur : performance.now(); }
  // fn(تقدّم بعد الـ easing، التقدّم الخام). الحالة الأولى تنطبق فوراً (مثل fill:both)
  function play(node, dur, delay, ease, fn, done, loop) {
    var w = { n: node, s: now() + (delay || 0), d: dur, e: ease || LIN, fn: fn, done: done, loop: !!loop };
    fn(w.e(0), 0);
    TW.push(w); kick(); return w;
  }
  function after(ms, fn) { TM.push({ t: now() + ms, fn: fn }); kick(); }
  function untween(n) { TW.forEach(function (w) { if (w.n === n) w.x = true; }); }
  function advance(T) {
    clk.step = true;
    for (;;) {                                            // المواعيد بالترتيب، كل وحدة بوقتها بالضبط
      var k = -1;
      for (var i = 0; i < TM.length; i++) if (TM[i].t <= T && (k < 0 || TM[i].t < TM[k].t)) k = i;
      if (k < 0) break;
      var m = TM.splice(k, 1)[0]; clk.cur = m.t; m.fn();
    }
    clk.cur = T;
    for (var j = 0; j < TW.length; j++) {
      var w = TW[j]; if (w.x) continue;
      if (w.n && w.n.dead) { w.x = true; continue; }
      var t = (T - w.s) / w.d;
      if (t < 0) { w.fn(w.e(0), 0); continue; }          // ينتظر دوره: حالته الأولى (الأحدث يغلب، مثل WAAPI)
      if (w.loop) { t = t % 1; w.fn(w.e(t), t); continue; }
      if (t >= 1) {
        w.fn(w.e(1), 1); w.x = true;
        if (w.done) { clk.cur = w.s + w.d; w.done(); clk.cur = T; }
        continue;
      }
      w.fn(w.e(t), t);
    }
    TW = TW.filter(function (w) { return !w.x; });
    clk.step = false; dirty = true;
  }
  // نخلّص كل الحركات لآخرها (تدوير الشاشة، والفحص)
  function finishAll() {
    var T = now() + 60000; advance(T);
    if (FROZEN) return;
    var real = performance.now();
    TW.forEach(function (w) { if (w.loop) w.s = real; });
  }
  var raf = 0, tmo = 0, dirty = true;
  function kick() { dirty = true; if (!raf && !FROZEN) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0;
    advance(performance.now());
    render();
    if (TW.length) { raf = requestAnimationFrame(frame); return; }
    if (TM.length) {                                      // بس مواعيد: لا ترسم كل إطار، اصحى بموعدها
      clearTimeout(tmo);
      var nx = Infinity; TM.forEach(function (m) { nx = Math.min(nx, m.t); });
      tmo = setTimeout(kick, Math.max(0, nx - performance.now()));
    }
  }

  /* ============================================================
     المشهد: عُقد بموقع ودوران وحجم وشفافية (مثل DOM صغير)
     ============================================================ */
  function N(o) {
    var n = { x: 0, y: 0, r: 0, sx: 1, sy: 1, a: 1, w: 0, h: 0, tex: null, c0: 0, c1: 1, kids: [], par: null, vis: true };
    for (var k in o) n[k] = o[k];
    return n;
  }
  function add(par, n) { n.par = par; par.kids.push(n); dirty = true; return n; }
  function kill(n) { n.dead = true; n.kids.forEach(kill); }
  function del(n) {
    kill(n);
    if (n.par) { var k = n.par.kids, i = k.indexOf(n); if (i >= 0) k.splice(i, 1); n.par = null; }
    dirty = true;
  }
  var floorRoot = N({}), worldRoot = N({});

  /* ============================================================
     الرسم: WebGL (أو 2D إذا ما موجود)
     ============================================================ */
  var cv = el("canvas", "stage", room); cv.setAttribute("aria-hidden", "true");
  var DPR = 1, VW = 1, VH = 1, gl = null, g2 = null, uM, uUV, uA, boundTex = null, lost = false, MAXTEX = 4096;
  var m9 = new Float32Array(9);
  var TEX = [];
  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); VW = vw(); VH = vh();
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    dirty = true;
  }
  function initGL() {
    if (qs.get("gl") !== "0") {
      try {
        gl = cv.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true,
          preserveDrawingBuffer: SNAP || FREEZE !== null, powerPreference: "low-power" });
      } catch (e) { gl = null; }
    }
    if (!gl) { g2 = cv.getContext("2d", { alpha: false }); return; }
    setupGL();
    cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); lost = true; });
    cv.addEventListener("webglcontextrestored", function () {
      lost = false; setupGL();
      TEX.forEach(function (t) { var c = t.make(); upload(t, c); c.width = c.height = 0; });
      kick();
    });
  }
  function setupGL() {
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, "attribute vec2 p;uniform mat3 m;uniform vec4 uv;varying vec2 t;void main(){t=mix(uv.xy,uv.zw,p);gl_Position=vec4((m*vec3(p,1.)).xy,0.,1.);}"));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, "precision mediump float;uniform sampler2D s;uniform float a;varying vec2 t;void main(){gl_FragColor=texture2D(s,t)*a;}"));
    gl.linkProgram(p); gl.useProgram(p);
    uM = gl.getUniformLocation(p, "m"); uUV = gl.getUniformLocation(p, "uv"); uA = gl.getUniformLocation(p, "a");
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.clearColor(36 / 255, 24 / 255, 16 / 255, 1);
    MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    boundTex = null;
  }
  function mkCanvas(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function upload(t, c) {
    t.g = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t.g); boundTex = t.g;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }
  // كل صورة على الكرت تنصنع من دالة، حتى نرجّعها لو انفقد السياق
  function makeTex(make, meta) {
    var t = meta || {}, c = make(); t.make = make; t.W = c.width; t.H = c.height; t.pad = t.pad || 0;
    if (t.iw == null) { t.iw = t.W - 2 * t.pad; t.ih = t.H - 2 * t.pad; }
    if (gl) { upload(t, c); c.width = c.height = 0; } else t.cv = c;
    TEX.push(t); return t;
  }
  function freeTex(t) {
    if (!t) return;
    if (gl && t.g) gl.deleteTexture(t.g);
    t.g = null; t.cv = null; boundTex = null;
    var i = TEX.indexOf(t); if (i >= 0) TEX.splice(i, 1);
  }
  // الصورة تنصغّر لأكبر حجم تنعرض بيه على الشاشة (+ حافة شفافة حتى الأطراف المايلة تطلع ناعمة)
  function imgTex(im, worldMax, res) {
    var nw = im.naturalWidth, nh = im.naturalHeight, big = Math.max(nw, nh);
    var sc = Math.min(1, worldMax * res / big, (MAXTEX - 8) / big);
    var w = Math.max(2, Math.round(nw * sc)), h = Math.max(2, Math.round(nh * sc)), P = 2;
    var t = makeTex(function () {
      var c = mkCanvas(w + 2 * P, h + 2 * P), x = c.getContext("2d");
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(im, P, P, w, h);
      return c;
    }, { pad: P, iw: w, ih: h });
    t.nw = nw; t.nh = nh; return t;
  }
  function radialTex(stops) {
    return makeTex(function () {
      var c = mkCanvas(128, 128), x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return c;
    });
  }
  // نص أو رسمة: محتوى cw×ch (وحدات عالم) + هامش P، يترسم بدقة res بكسل لكل وحدة
  function canvasTex(cw, ch, P, res, paint) {
    return makeTex(function () {
      var c = mkCanvas(Math.ceil((cw + 2 * P) * res), Math.ceil((ch + 2 * P) * res)), x = c.getContext("2d");
      x.scale(res, res); x.translate(P, P); paint(x, res);
      return c;
    });
  }

  function mul(A, n) {
    var cs = 1, sn = 0;
    if (n.r) { var rr = n.r * Math.PI / 180; cs = Math.cos(rr); sn = Math.sin(rr); }
    var la = cs * n.sx, lb = sn * n.sx, lc = -sn * n.sy, ld = cs * n.sy;
    return [A[0] * la + A[2] * lb, A[1] * la + A[3] * lb, A[0] * lc + A[2] * ld, A[1] * lc + A[3] * ld,
            A[0] * n.x + A[2] * n.y + A[4], A[1] * n.x + A[3] * n.y + A[5]];
  }
  function quad(t, M, n, al) {
    if (!t || (gl && !t.g) || (!gl && !t.cv)) return;
    var w = n.w, h = n.h, px = t.pad / t.iw, py = t.pad / t.ih;
    var c0 = n.c0 <= 0 ? -px : n.c0, c1 = n.c1 >= 1 ? 1 + px : n.c1;
    if (c1 <= c0) return;
    var X0 = -w / 2 + c0 * w, X1 = -w / 2 + c1 * w, Y0 = -h / 2 - py * h, Y1 = h / 2 + py * h;
    var u0 = (t.pad + c0 * t.iw) / t.W, u1 = (t.pad + c1 * t.iw) / t.W;
    if (gl) {
      var dX = X1 - X0, dY = Y1 - Y0, sx = 2 / VW, sy = 2 / VH;
      m9[0] = sx * M[0] * dX; m9[1] = -sy * M[1] * dX; m9[2] = 0;
      m9[3] = sx * M[2] * dY; m9[4] = -sy * M[3] * dY; m9[5] = 0;
      m9[6] = sx * (M[0] * X0 + M[2] * Y0 + M[4]) - 1; m9[7] = 1 - sy * (M[1] * X0 + M[3] * Y0 + M[5]); m9[8] = 1;
      gl.uniformMatrix3fv(uM, false, m9); gl.uniform4f(uUV, u0, 0, u1, 1); gl.uniform1f(uA, al);
      if (t.g !== boundTex) { gl.bindTexture(gl.TEXTURE_2D, t.g); boundTex = t.g; }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      g2.setTransform(DPR * M[0], DPR * M[1], DPR * M[2], DPR * M[3], DPR * M[4], DPR * M[5]); g2.globalAlpha = al;
      g2.drawImage(t.cv, u0 * t.W, 0, Math.max(1e-3, (u1 - u0) * t.W), t.H, X0, Y0, X1 - X0, Y1 - Y0);
    }
  }
  function drawNode(n, M, al) {
    if (!n.vis) return;
    var a = al * n.a; if (a <= 0.002) return;
    var W = mul(M, n);
    if (n.tex) quad(n.tex, W, n, a);
    for (var i = 0; i < n.kids.length; i++) drawNode(n.kids[i], W, a);
  }
  function drawLayer(root, k) {
    var s = cam.z * k, M = [s, 0, 0, s, VW / 2 - s * cam.x, VH / 2 - s * cam.y];
    for (var i = 0; i < root.kids.length; i++) drawNode(root.kids[i], M, 1);
  }
  var shown = false;
  function render() {
    if (!dirty || lost || !ready) return; dirty = false;
    if (gl) { gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT); }
    else { g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalAlpha = 1; g2.fillStyle = "#241810"; g2.fillRect(0, 0, cv.width, cv.height); }
    drawLayer(floorRoot, K_FLOOR); drawLayer(worldRoot, 1);
    if (!shown) { shown = true; firstFrame(); }
  }

  /* ============================================================
     تخطيط الغرفة (وحدات «العالم»، تتغيّر حسب اتجاه الشاشة)
     ============================================================ */
  var K_FLOOR = 0.66;                                     // الأرض أبعد عن الكاميرا
  var PHONE = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || Math.min(window.innerWidth, window.innerHeight) < 600;
  var L;                                                  // التخطيط الحالي
  function layout() {
    var P = portrait(), W = vw(), H = vh();
    var o = { P: P };
    // الطاولتين: البيتزا بالنص، والحلويات جنبها (يسار = الجاية بالعربي)
    o.pizza = P ? { x: 0, y: 0, w: 1150, h: 2000, rot: 90 } : { x: 0, y: 0, w: 2000, h: 1150, rot: 0 };
    o.dolci = P ? { x: -1900, y: 0, d: 1700 } : { x: -2250, y: 40, d: 1700 };
    // الأرضية صورة وحدة صغيرة (الأرض + السجادة) بنفس حدود tools/room_assets.py floors()
    o.floor = P ? { src: "floor_tall.jpg", x0: -3000, y0: -2600, x1: 1400, y1: 2600 }
                : { src: "floor_wide.jpg", x0: -5400, y0: -2200, x1: 2800, y1: 2200 };
    o.cam = {
      pizza: P ? { x: 0, y: 20, z: Math.min(W * 1.06 / 1150, (H - 150) / 2000) }
               : { x: 0, y: -10, z: Math.min(W * 0.9 / 2000, (H - 110) / 1150) },
      dolci: P ? { x: -1900, y: 20, z: (H - 170) / 1700 }
               : { x: -2250, y: 40, z: Math.min(W * 0.92 / 1700, H * 1.1 / 1700) }
    };
    // مقاسات الكتابة (وحدات عالم) حتى تطلع مقروءة بكل شاشة
    var zp = o.cam.pizza.z, zd = o.cam.dolci.z;
    o.font = { nm: Math.max(58, 21 / zp), en: Math.max(28, 12.5 / zp), ds: Math.max(26, 13 / zp), note: Math.max(24, 11.5 / zp) };
    o.fontD = { nm: Math.max(62, 24 / zd), en: Math.max(30, 13 / zd), ds: Math.max(28, 13.5 / zd), note: Math.max(26, 12 / zd) };
    // خانات البيتزا: بيتزا + ورقتها
    if (P) {
      o.slots = [-640, 0, 640].map(function (ry, i) {
        var right = i % 2 === 0;
        return { px: right ? 290 : -290, py: ry - 10, d: 540, mx: right ? -262 : 262, my: ry + 30, mw: 540, mr: right ? -2.2 : 1.8 };
      });
    } else {
      o.slots = [620, 0, -620].map(function (x, i) {
        return { px: x, py: -120, d: 450, mx: x + (i - 1) * 8, my: 300, mw: 570, mr: [-2, 1.4, -1.2][i] };
      });
    }
    // خانات الحلويات: دائرة ورق + صحن + كتابة
    var dx = o.dolci.x, dy = o.dolci.y;
    o.dslots = P ? [{ x: dx + 20, y: dy - 480, disc: 500, plate: 390, lx: dx, ly: dy - 210, lw: 900 },
                    { x: dx - 20, y: dy + 320, disc: 500, plate: 390, lx: dx, ly: dy + 590, lw: 900 }]
                 : [{ x: dx + 390, y: dy - 150, disc: 600, plate: 460, lx: dx + 390, ly: dy + 200, lw: 640 },
                    { x: dx - 390, y: dy - 150, disc: 600, plate: 460, lx: dx - 390, ly: dy + 200, lw: 640 }];
    // دقة الصور: بكسل لكل وحدة عالم بأقرب كاميرا
    o.res = DPR * Math.max(zp, zd);
    o.resP = DPR * zp * 1.1; o.resD = DPR * zd * 1.1;
    return o;
  }

  /* ============================================================
     الكاميرا: طبقتين، كل طبقة بعمقها
     ============================================================ */
  var cam = { x: 0, y: 0, z: 0.5 }, CAMN = {};
  function setCam(c) { untween(CAMN); cam = { x: c.x, y: c.y, z: c.z }; dirty = true; kick(); }
  function moveCam(to, ms, delay, done) {
    var from = { x: cam.x, y: cam.y, z: cam.z };
    play(CAMN, ms, delay || 0, LIN, function (_, t) {
      var e = eio(t);
      cam.x = lerp(from.x, to.x, e); cam.y = lerp(from.y, to.y, e); cam.z = lerp(from.z, to.z, e) * (1 - 0.17 * Math.sin(Math.PI * t));
    }, function () { cam = { x: to.x, y: to.y, z: to.z }; if (done) done(); });
  }
  function toWorld(sx, sy) { return [cam.x + (sx - vw() / 2) / cam.z, cam.y + (sy - vh() / 2) / cam.z]; }

  /* ============================================================
     الصور على الكرت
     ============================================================ */
  var TX = { dish: {} }, LEAF_TX = [];
  function baseTextures() {
    var res = L.res, F = L.floor;
    TX.floor = imgTex(IMG[R + F.src], Math.max(F.x1 - F.x0, F.y1 - F.y0) * K_FLOOR, res);
    TX.rect = imgTex(IMG[R + "table_rect.webp"], 2180, res);
    TX.mat = imgTex(IMG[R + "placemat.webp"], 600, res);
    // ظل الصحن، والبخار، وذرّة ضوء القلم: تدرّجات دائرية
    TX.shadow = radialTex([[0, "rgba(30,12,4,.6)"], [.6, "rgba(30,12,4,.3)"], [1, "rgba(30,12,4,0)"]]);
    TX.steam = radialTex([[0, "rgba(255,246,232,.42)"], [1, "rgba(255,246,232,0)"]]);
    TX.nib = radialTex([[0, "#fff3dc"], [.45, "rgba(255,196,120,.85)"], [.72, "rgba(255,170,90,0)"], [1, "rgba(255,170,90,0)"]]);
    LEAF_TX = LEAVES.filter(function (s) { return IMG[s]; }).map(function (s) { return imgTex(IMG[s], 400, res); });
  }
  function dishTex(it) {
    if (TX.dish[it.img]) return TX.dish[it.img];
    if (!IMG[it.img]) return null;
    return (TX.dish[it.img] = imgTex(IMG[it.img], 660, L.res));
  }
  function discTex() { return TX.disc || (IMG[R + "disc.webp"] && (TX.disc = imgTex(IMG[R + "disc.webp"], 830, L.res))); }
  // الطاولة المدورة ما تبين من طاولة البيتزا: تترفع للكرت بعدين (بهدوء)
  function roundTex() {
    if (!TX.round) { TX.round = imgTex(IMG[R + "table_round.webp"], L.dolci.d + 180, L.res); if (ROUND) ROUND.tex = TX.round; }
    return TX.round;
  }
  // نتأكد إن صور الأصناف جاهزة قبل ما ننقدّمها
  function need(items) {
    var srcs = items.map(function (it) { return it.img; }), dolci = items.some(function (it) { return it.tbl === "dolci"; });
    if (dolci) srcs.push(R + "disc.webp");
    return Promise.all(srcs.map(loadImg)).then(function () {
      items.forEach(function (it) { dishTex(it); labelSpec(it, it.tbl); });
      if (dolci) { discTex(); roundTex(); }
    });
  }
  // شغل التحضير (رفع صور، رسم كتابة) واحد واحد، بس لما ماكو حركة: حتى ما يقطّع شي
  var IDLE = [];
  function idleWork(fns) { IDLE = IDLE.concat(fns); tickIdle(); }
  var idleT = 0;
  function tickIdle() {
    clearTimeout(idleT);
    if (!IDLE.length) return;
    idleT = setTimeout(function () {
      if (!TW.some(function (w) { return !w.loop; })) {
        var t0 = performance.now(), job = IDLE.shift(); job();
        if (window.__th) window.__th.jobs.push((job.name || "job") + ":" + (performance.now() - t0).toFixed(0));
      }
      tickIdle();
    }, 120);
  }

  /* ============================================================
     الكتابة: كل جزء (الاسم، الخط، الوصف…) صورة صغيرة تنرسم مرة وحدة
     ============================================================ */
  var MEAS = mkCanvas(4, 4).getContext("2d");
  function textW(font, s, dir) { MEAS.font = font; MEAS.direction = dir || "rtl"; return MEAS.measureText(s).width; }
  function wrap(font, s, maxW) {
    var lines = [], cur = "";
    s.split(/\s+/).forEach(function (w) {
      if (!w) return;
      var t = cur ? cur + " " + w : w;
      if (cur && textW(font, t) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // ظل النص: ينرسم لوحده (النص برّه اللوحة والظل بس يرجع لمكانه)، وبعدين النص نظيف
  function fillShadowed(x, r, s, px, py, shadows) {
    (shadows || []).forEach(function (sh) {
      x.save(); x.shadowColor = sh[0]; x.shadowBlur = sh[1] * r; x.shadowOffsetX = 10000 * r; x.shadowOffsetY = sh[2] * r;
      x.fillText(s, px - 10000, py); x.restore();
    });
    x.fillText(s, px, py);
  }
  function textPart(s, font, size, color, lh, dir, shadows, res) {
    var cw = textW(font, s, dir), ch = size * lh, P = size * (shadows ? .7 : .45);
    var tex = canvasTex(cw, ch, P, res, function (x, r) {
      x.font = font; x.direction = dir; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = color;
      fillShadowed(x, r, s, cw / 2, ch / 2, shadows);
    });
    return { tex: tex, w: cw + 2 * P, h: ch + 2 * P, cw: cw, ch: ch };
  }
  function swashPart(w, h, lw, color, res) {
    var P = lw * 2 + 2;
    var tex = canvasTex(w, h, P, res, function (x) {
      x.scale(1, h / 12);                                  // مثل الـ SVG القديم (viewBox ‎w×12‎ ممطوط)
      x.beginPath(); x.moveTo(w - 2, 5); x.bezierCurveTo(w * .7, 9, w * .35, 2, 6, 7);
      x.bezierCurveTo(12 - w * .35, 12, -2, 3, 4, 2);
      x.lineWidth = lw; x.lineCap = "round"; x.strokeStyle = color; x.globalAlpha = .85; x.stroke();
    });
    return { tex: tex, w: w + 2 * P, h: h + 2 * P, cw: w, ch: h };
  }
  function notePart(s, size, C, res) {
    var f = "500 " + size + "px Tajawal", bw = size * .06, w = textW(f, s) + size * 1.2 + bw * 2, h = size * 1.35 + bw * 2, P = size * .3;
    var tex = canvasTex(w, h, P, res, function (x) {
      var r = (h - bw) / 2, x0 = bw / 2, y0 = bw / 2, x1 = w - bw / 2, y1 = h - bw / 2;
      x.beginPath(); x.moveTo(x0 + r, y0); x.lineTo(x1 - r, y0); x.arc(x1 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
      x.lineTo(x0 + r, y1); x.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5); x.closePath();
      x.lineWidth = bw; x.strokeStyle = C.bd; x.stroke();
      x.font = f; x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = C.note;
      x.fillText(s, w / 2, h / 2 + size * .04);
    });
    return { tex: tex, w: w + 2 * P, h: h + 2 * P, cw: w, ch: h };
  }
  var PAPER_C = { nm: INK, en: INK_SOFT, ds: "#6d4536", note: TERRA, bd: "rgba(179,84,63,.5)", sw: TERRA };
  var WOOD_C = { nm: CARAMEL, en: "#e3c9a1", ds: "#f1e2cc", note: CARAMEL, bd: "rgba(240,194,122,.55)", sw: CARAMEL };
  // على الخشب الغامق: ظل تحت الكتابة (مثل text-shadow القديم)
  function prepLabel(it, F, wood, boxW, res) {
    var C = wood ? WOOD_C : PAPER_C, o = { wood: wood, F: F, texs: [] }, y = 0;
    function keep(p) { o.texs.push(p.tex); return p; }
    var fN = "700 " + F.nm + "px 'Aref Ruqaa'";
    o.nm = { p: keep(textPart(it.name, fN, F.nm, C.nm, 1.2, "rtl", wood ? [["rgba(0,0,0,.35)", F.nm * .5, 0], ["rgba(60,25,8,.7)", 0, F.nm * .03]] : null, res)), top: 0 };
    y = o.nm.p.ch;
    var sw = Math.max(40, o.nm.p.cw * .92), shh = F.nm * .22;
    o.sw = { p: keep(swashPart(sw, shh, Math.max(1.4, F.nm * .035), C.sw, res)), top: y }; y += shh;
    if (it.en) {
      o.en = { p: keep(textPart(it.en, "italic 500 " + F.en + "px 'Cormorant Garamond'", F.en, C.en, 1.21, "ltr", wood ? [["rgba(0,0,0,.5)", 6, 1]] : null, res)), top: y };
      y += o.en.p.ch;
    }
    o.ds = [];
    if (it.desc) {
      y += F.ds * .25;
      var fD = "500 " + F.ds + "px Tajawal";
      wrap(fD, it.desc, boxW).forEach(function (ln) {
        var q = keep(textPart(ln, fD, F.ds, C.ds, 1.5, "rtl", wood ? [["rgba(0,0,0,.55)", 8, 1]] : null, res));
        o.ds.push({ p: q, top: y }); y += q.ch;
      });
    }
    if (it.note) { y += F.note * .5; o.note = { p: keep(notePart(it.note, F.note, C, res)), top: y }; y += o.note.p.ch; }
    if (it.price != null) {
      var ps = F.ds * 1.1;
      o.pr = { p: keep(textPart(money(it.price), "700 " + ps + "px Tajawal", ps, TERRA, 1.3, "rtl", null, res)), top: y + F.ds * .2 };
    }
    return o;
  }
  var LBL = {};                                           // كتابة كل صنف جاهزة (تنعاد إذا تغيّر التخطيط)
  function labelSpec(it, tbl) {
    var k = tbl + ":" + it.id;
    if (LBL[k]) return LBL[k];
    if (tbl === "dolci") return (LBL[k] = prepLabel(it, L.fontD, true, L.dslots[0].lw, L.resD));
    return (LBL[k] = prepLabel(it, L.font, false, L.slots[0].mw * 1460 / 1400 * .66, L.resP));
  }
  function freeLabels() { Object.keys(LBL).forEach(function (k) { LBL[k].texs.forEach(freeTex); }); LBL = {}; }

  // كتابة على ورقة (محاذاة يمين) أو على الخشب (بالنص). (x,y) = أعلى نقطة الحافة
  function makeLabel(par, x, y, S) {
    var g = add(par, N({ x: x, y: y }));
    function part(o) {
      if (!o) return null;
      var n = add(g, N({ x: S.wood ? 0 : -o.p.cw / 2, y: o.top + o.p.ch / 2, w: o.p.w, h: o.p.h, tex: o.p.tex }));
      n.by = n.y; return n;
    }
    g.nm = part(S.nm); g.sw = part(S.sw); g.en = part(S.en); g.ds = S.ds.map(part); g.note = part(S.note); g.pr = part(S.pr);
    var ns = S.F.nm * .36;
    g.nib = add(g, N({ w: ns, h: ns, tex: TX.nib, a: 0 }));
    g.S = S;
    return g;
  }
  function writeLabel(g, delay) {
    var S = g.S, cw = S.nm.p.cw, ch = S.nm.p.ch, nm = g.nm, nib = g.nib, F = S.F;
    var dur = clamp(380 + cw * 0.9 / (cam.z || 1) * 0.5, 520, 1100);
    // الاسم ينكشف من اليمين لليسار، وذرّة الضوء تمشي ويا الحافة
    play(g, dur, delay, SOFT, function (p) {
      nm.c0 = 1 - p;
      nib.x = clamp(nm.x - nm.w / 2 + nm.c0 * nm.w, nm.x - cw / 2, nm.x + cw / 2); nib.y = nm.y + ch * .05;
      nib.a = p < .12 ? p / .12 : p < .82 ? 1 : 1 - (p - .82) / .18;
    });
    play(g, 480, delay + dur * 0.8, SOFT, function (p) { g.sw.c0 = 1 - p; });
    var t = delay + dur * 0.85;
    if (g.en) play(g, 520, t, EXPO, function (p) { g.en.a = p; g.en.y = g.en.by + F.en * .3 * (1 - p); });
    g.ds.forEach(function (n, k) { play(g, 600, t + 110 + k * 90, EXPO, function (p) { n.a = p; n.y = n.by + F.ds * .35 * (1 - p); }); });
    [g.note, g.pr].forEach(function (n) { if (n) play(g, 560, t + 480, EXPO, function (p) { n.a = p; n.sx = n.sy = lerp(.86, 1, p); }); });
  }
  function unwriteLabel(g) { play(g, 380, 0, SOFT, function (p) { g.a = 1 - p; }, function () { del(g); }); }

  /* ============================================================
     بناء الغرفة
     ============================================================ */
  var TBL = {}, ROUND = null;                             // حالة كل طاولة: الأوراق والأطباق والكتابة
  function buildRoom() {
    floorRoot.kids.slice().forEach(del); worldRoot.kids.slice().forEach(del);
    var F = L.floor;
    add(floorRoot, N({ x: (F.x0 + F.x1) / 2, y: (F.y0 + F.y1) / 2, w: F.x1 - F.x0, h: F.y1 - F.y0, tex: TX.floor }));
    // طاولة البيتزا (الصورة بيها هامش ظل 90px)، والمدورة جنبها
    add(worldRoot, N({ x: L.pizza.x, y: L.pizza.y, w: 2180, h: 1330, r: L.pizza.rot || 0, tex: TX.rect }));
    ROUND = add(worldRoot, N({ x: L.dolci.x, y: L.dolci.y, w: L.dolci.d + 180, h: L.dolci.d + 180, tex: TX.round || null }));
    // أوراق البيتزا (ثابتة على الطاولة)
    TBL.pizza = { papers: [], dishes: [], labels: [], page: 0, served: false };
    L.slots.forEach(function (s) {
      var w = s.mw * 1460 / 1400, h = w * 1050 / 1460;
      var p = add(worldRoot, N({ x: s.mx, y: s.my, w: w, h: h, r: s.mr, tex: TX.mat }));
      p.hx = s.mx; p.hy = s.my; p.hr = s.mr; p.on = true;
      TBL.pizza.papers.push(p);
    });
    TBL.dolci = { discs: [], dishes: [], labels: [], served: false };
  }

  /* ---------- الأطباق ---------- */
  function makeDish(it, x, y, d) {
    var g = add(worldRoot, N({ x: x, y: y }));
    g.d = d; g.cx = x; g.cy = y;
    g.sd = add(g, N({ x: d * .02, y: d * .035, w: d, h: d, sx: 1.04, sy: 1.04, tex: TX.shadow }));
    g.fd = add(g, N({ w: d, h: d, tex: dishTex(it) }));
    return g;
  }
  /* البيتزا تنقدّم: تنزل من فوق (أقرب للكاميرا = أكبر، وظلها بعيد) لحد ما تلمس الطاولة */
  function serve(g, from, delay, r0, r1) {
    var d = g.d;
    play(g, 1350, delay, LIN, function (_, t) {
      var u = eout(t);
      g.x = g.cx + lerp(from[0], 0, u) + Math.sin(u * Math.PI) * from[0] * -0.12;
      g.y = g.cy + lerp(from[1], 0, u) - Math.sin(u * Math.PI) * d * 0.18;
      g.sx = g.sy = 1 + 0.2 * Math.pow(1 - u, 1.4);
      var lf = Math.pow(1 - u, 1.2);
      g.sd.x = d * (0.02 + 0.1 * lf); g.sd.y = d * (0.035 + 0.16 * lf); g.sd.sx = g.sd.sy = 1.04 + 0.16 * lf; g.sd.a = 1 - 0.55 * lf;
      g.fd.r = lerp(r0, r1, eout(Math.min(1, t * 1.08)));
    });
  }
  function lift(g, to, delay) {
    var d = g.d, r = g.fd.r;
    play(g, 1000, delay, LIN, function (_, t) {
      var u = ein(t), lf = Math.min(1, t * 1.6);
      g.x = g.cx + to[0] * u; g.y = g.cy + to[1] * u - Math.sin(t * Math.PI) * d * 0.1;
      g.sx = g.sy = 1 + 0.16 * Math.sin(lf * Math.PI / 2);
      g.sd.x = d * (0.02 + 0.12 * lf); g.sd.y = d * (0.035 + 0.18 * lf); g.sd.sx = g.sd.sy = 1.04 + 0.18 * lf; g.sd.a = 1 - 0.6 * lf;
      g.fd.r = r - 70 * LIFTR(t);
    }, function () { del(g); });
  }

  /* ---------- ورق الشجر (بالعالم: يمشي ويا الكاميرا) ---------- */
  var QUIET = false;
  function bez(p0, p1, p2, p3, t) { var u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
  function flyLeaf(o) {
    if (!LEAF_TX.length) return;
    var tex = LEAF_TX[(Math.random() * LEAF_TX.length) | 0], sc = o.size / 160;
    var n = add(worldRoot, N({ w: tex.nw * sc, h: tex.nh * sc, tex: tex, leaf: true }));
    var p0 = o.from, p3 = o.to, H = vh() / cam.z, ox = tex.nw / 2 - 80, oy = tex.nh / 2 - 90;
    var p1 = [lerp(p0[0], p3[0], .33), p0[1] + rnd(-.25, .25) * H], p2 = [lerp(p0[0], p3[0], .66), p3[1] + rnd(-.25, .25) * H];
    var r0 = rnd(0, 360), spin = rnd(260, 600) * (Math.random() < .5 ? -1 : 1) * (o.land ? .5 : 1);
    var dur = o.dur || rnd(1500, 2200), cyc = Math.max(1, Math.round(dur / rnd(420, 700)));
    // يتقلّب (وجه/ظهر) وهو يطير؛ اللي ينزل يستقر على وجهه
    var fl = o.land ? (Math.random() < .5 ? 0 : Math.PI) + rnd(-.6, .6) : rnd(0, 6.28);
    play(n, dur, o.delay || 0, LIN, function (_, t) {
      var e = o.land ? 1 - Math.pow(1 - t, 2.4) : t, p = bez(p0, p1, p2, p3, e);
      var wob = Math.sin(t * 9 + r0) * o.size * .08 * (o.land ? 1 - t : 1);
      n.x = p[0] + ox; n.y = p[1] + oy + wob; n.r = r0 + spin * e;
      n.sx = Math.cos(fl + t * cyc * 6.2832);
    }, o.land ? function () { n.rest = true; } : function () { del(n); });
  }
  function gust(n, land) {
    if (SNAP || QUIET) return;
    var a = toWorld(vw() + 120, 0), b = toWorld(-160, vh()), H = b[1] - a[1], sz = 150 / Math.max(cam.z, .3) * .45;
    for (var i = 0; i < n; i++) flyLeaf({ from: [a[0] + rnd(0, 200 / cam.z), a[1] + rnd(-.05, 1) * H], to: [b[0] - rnd(0, 200 / cam.z), a[1] + rnd(0, 1) * H], delay: rnd(0, 520), size: sz * rnd(.7, 1.25) });
    (land || []).forEach(function (pt, k) { flyLeaf({ from: [a[0] + rnd(40, 160), pt[1] + rnd(-.3, .1) * H], to: pt, land: true, delay: 380 + k * 170, dur: rnd(1700, 2100), size: sz * rnd(.85, 1.05) }); });
  }
  function sweepRested() {
    worldRoot.kids.slice().forEach(function (n) {
      if (!n.rest) return; n.rest = false;
      var x0 = n.x, y0 = n.y, r0 = n.r, x1 = x0 - vw() * .9 / cam.z, y1 = y0 + rnd(-120, 60), r1 = r0 + rnd(-400, -200);
      play(n, 1100, rnd(0, 200), SWEEP, function (u) { n.x = lerp(x0, x1, u); n.y = lerp(y0, y1, u); n.r = lerp(r0, r1, u); }, function () { del(n); });
    });
  }

  /* ============================================================
     طاولة البيتزا
     ============================================================ */
  function pages(t) { var p = []; for (var i = 0; i < t.items.length; i += 3) p.push(t.items.slice(i, i + 3)); return p; }
  function slotsFor(n) { return n === 3 ? [0, 1, 2] : n === 2 ? [0, 2] : [1]; }
  function servePizzaPage(pg, t0) {
    var T = D.tables[tIndex("pizza")], S = TBL.pizza, items = pages(T)[pg], idx = slotsFor(items.length);
    S.dishes = []; S.labels = [];
    items.forEach(function (it, k) {
      var s = L.slots[idx[k]];
      var g = makeDish(it, s.px, s.py, s.d);
      var r1 = rnd(-25, 25); g.fd.r = r1;
      S.dishes.push(g);
      serve(g, [vw() * 0.85 / cam.z + s.d * 0.3, -vh() * 0.25 / cam.z + k * 40], t0 + 250 + k * 190, r1 + 170 + k * 20, r1);
      var p = S.papers[idx[k]];
      var lb = makeLabel(p, p.w * .43, -p.h * .36, labelSpec(it, "pizza"));
      S.labels.push(lb);
      writeLabel(lb, t0 + 1150 + k * 260);
    });
    // الورق الراسي: على الخشب الفاضي (بعيد عن البيتزا والورق)
    var land = L.P ? [[L.pizza.x + rnd(-380, 380), L.pizza.y - 960], [L.pizza.x + 470, L.pizza.y + rnd(-120, 120)]]
                   : [[L.pizza.x + rnd(-150, 150), L.pizza.y - 480], [L.pizza.x - 900, L.pizza.y + 470]];
    gust(PHONE ? 6 : (L.P ? 10 : 16), pg === 0 && !S.served ? land : []);
    S.served = true; S.page = pg;
  }
  /* الورقة اللي ما إلها بيتزا يطيّرها الهوا وتختفي (لا تنزل على طاولة الحلويات)، وترجع لما تحتاجها */
  function paperAway(p, delay) {
    if (!p.on) return; p.on = false; untween(p);
    var far = vw() * 1.2 / cam.z, y2 = rnd(-200, 100);
    play(p, 1150, delay, AWAY, function (u) {
      if (u < .4) { var v = u / .4; p.x = p.hx - far * .35 * v; p.y = p.hy - 80 * v; p.r = lerp(p.hr, -14, v); p.a = 1; }
      else { var v2 = (u - .4) / .6; p.x = lerp(p.hx - far * .35, p.hx - far, v2); p.y = lerp(p.hy - 80, p.hy + y2, v2); p.r = lerp(-14, -38, v2); p.a = 1 - v2; }
    }, function () { p.vis = false; });
  }
  function paperBack(p, delay) {
    if (p.on) return; p.on = true; untween(p);
    var far = vw() * 1.15 / cam.z;
    p.vis = true;
    play(p, 1300, delay, LIN, function (_, t) {
      var u = 1 - Math.pow(1 - t, 2.6), sway = Math.sin(t * Math.PI * 2) * 40 * (1 - u);
      p.x = p.hx + far * (1 - u); p.y = p.hy - 160 * Math.sin(u * Math.PI) + sway; p.r = p.hr + 28 * (1 - u); p.a = 1;
    });
  }
  function swapPizzaPage(pg) {
    var T = D.tables[tIndex("pizza")], S = TBL.pizza;
    busy = true;
    return need(pages(T)[pg]).then(function () {
      gust(PHONE ? 7 : (L.P ? 12 : 18), []);
      sweepRested();
      S.dishes.forEach(function (d, k) { lift(d, [-(vw() * 1.1 / cam.z + d.d), rnd(-60, 40)], 120 + k * 110); });
      S.labels.forEach(unwriteLabel);
      var use = slotsFor(pages(T)[pg].length);
      S.papers.forEach(function (p, i) { if (use.indexOf(i) < 0) paperAway(p, 180 + i * 90); else paperBack(p, 60 + i * 120); });
      after(520, function () { servePizzaPage(pg, 0); updateUI(); });
      after(2600, function () { busy = false; });
    });
  }
  function nextPizzaPage() { return swapPizzaPage((TBL.pizza.page + 1) % pages(D.tables[tIndex("pizza")]).length); }

  /* ============================================================
     طاولة الحلويات: دوائر الورق تنزل مثل ورق الشجر، وبعدين الصحون تنحط
     ============================================================ */
  function serveDolci(t0) {
    var T = D.tables[tIndex("dolci")], S = TBL.dolci;
    if (S.served) return;
    S.served = true;
    T.items.slice(0, L.dslots.length).forEach(function (it, k) {
      var s = L.dslots[k], dw = s.disc * 960 / 900, rr = rnd(-30, 30);
      var disc = add(worldRoot, N({ x: s.x, y: s.y, w: dw, h: dw, tex: discTex() }));
      play(disc, 1300, t0 + k * 220, LIN, function (_, t) {
        var u = eout(t), sway = Math.sin(t * Math.PI * 2.2) * dw * .06 * (1 - u);
        disc.x = s.x + sway + (1 - u) * dw * .25; disc.y = s.y - (1 - u) * dw * .35; disc.r = rr * (1 - u);
        disc.sx = disc.sy = 1 + .38 * (1 - u); disc.a = Math.min(1, t * 3.5);
      });
      S.discs.push(disc);
      var g = makeDish(it, s.x, s.y, s.plate), pl = s.plate;
      S.dishes.push(g);
      play(g, 1100, t0 + 900 + k * 260, EXPO, function (p) {
        g.y = g.cy - pl * .12 * (1 - p); g.sx = g.sy = lerp(1.16, 1, p); g.a = p < .35 ? p / .35 : 1;
        g.sd.x = lerp(pl * .14, pl * .02, p); g.sd.y = lerp(pl * .2, pl * .035, p); g.sd.sx = g.sd.sy = lerp(1.25, 1.04, p); g.sd.a = lerp(.2, 1, p);
      });
      if (it.steam) steam(s, t0 + 2000 + k * 260);
      var lb = makeLabel(worldRoot, s.lx, s.ly, labelSpec(it, "dolci"));
      S.labels.push(lb);
      writeLabel(lb, t0 + 1500 + k * 300);
    });
  }
  function steam(s, delay) {
    for (var k = 0; k < 3; k++) (function (k) {
      var w = s.plate * .16, h = s.plate * .5, x = s.x - s.plate * .12 + (k - 1) * s.plate * .08 + w / 2, y = s.y - s.plate * .3 - h / 2;
      var n = add(worldRoot, N({ w: w, h: h, tex: TX.steam, a: 0 })), dx = rnd(-10, 10), rr = rnd(-12, 12);
      play(n, rnd(2600, 3400), delay + k * 700, EOUT, function (p) {
        n.x = x + dx * p; n.y = y + lerp(h * .4, -h * .4, p); n.sx = lerp(.6, 1.5, p); n.r = rr * p;
        n.a = p < .3 ? .85 * p / .3 : .85 * (1 - (p - .3) / .7);
      }, null, true);
    })(k);
  }

  /* ============================================================
     التنقل
     ============================================================ */
  var cur = "pizza", busy = false;
  function updateUI() {
    var ti = tIndex(cur), T = D.tables[ti], nt = D.tables[(ti + 1) % D.tables.length], sm = vw() < 560;
    if (cur === "pizza" && TBL.pizza.page < pages(T).length - 1) nextLabel.textContent = sm ? "الجاية" : "البيتزا الجاية";
    else nextLabel.textContent = sm ? nt.short : (ti < D.tables.length - 1 ? "التالي: " : "رجوع: ") + nt.title;
    Array.prototype.forEach.call(rail.children, function (b) { b.setAttribute("aria-current", b.dataset.id === cur ? "true" : "false"); });
  }
  function setTitle(T, delay) {
    var t = ttl.querySelector(".t"), s = ttl.querySelector(".s");
    wa(ttl, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "cubic-bezier(.33,0,.2,1)", fill: "forwards" }).finished.then(function () {
      t.textContent = T.title; s.textContent = T.tagline || "";
      ttl.getAnimations().forEach(function (a) { a.cancel(); });
      wa(ttl, [{ opacity: 0, transform: "translateX(-50%) translateY(10px)" }, { opacity: 1, transform: "translateX(-50%)" }], { duration: 700, delay: delay || 0, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
    });
  }
  function goTable(id) {
    if (busy || id === cur) return;
    busy = true;
    var to = D.tables[tIndex(id)];
    need(id === "dolci" ? to.items : pages(D.tables[tIndex("pizza")])[0]).then(function () {
      sweepRested();
      gust(PHONE ? 5 : (L.P ? 6 : 10), []);
      setTitle(to, 1100);
      cur = id; updateUI();
      history.replaceState(null, "", "?t=" + id);
      // الأطباق تنبني هسه وحركتها تبدي والكاميرا بعدها تستقر: ما يصير فراغ
      if (id === "dolci") serveDolci(1450);
      else if (!TBL.pizza.served) servePizzaPage(0, 1450);
      var backToFirst = id === "pizza" && TBL.pizza.served && TBL.pizza.page !== 0;
      moveCam(L.cam[id], 1850, 150, function () {
        if (backToFirst) { swapPizzaPage(0); return; }
        after(id === "dolci" ? 900 : 200, function () { busy = false; });
      });
    });
  }
  function goNext() {
    if (busy) return;
    if (cur === "pizza" && TBL.pizza.page < pages(D.tables[tIndex("pizza")]).length - 1) return nextPizzaPage();
    goTable(D.tables[(tIndex(cur) + 1) % D.tables.length].id);
  }
  nextBtn.addEventListener("click", goNext);

  function buildRail() {
    D.tables.forEach(function (t) {
      var b = el("button", "", rail); b.type = "button"; b.dataset.id = t.id; b.textContent = t.title;
      b.addEventListener("click", function () { goTable(t.id); });
    });
  }

  /* الشاشة تغيّرت: نفس الاتجاه ← الكاميرا بس. تدوير ← نعيد البناء بالحالة النهائية بلا حركة */
  var rz = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (!ready) return;
      sizeCanvas();
      var wasP = L.P; L = layout();
      if (wasP === L.P) { setCam(L.cam[cur]); return; }
      var pg = TBL.pizza.page, served = TBL.pizza.served, ds = TBL.dolci.served;
      TW.length = 0; TM.length = 0; busy = false;
      // الصور تنعاد بدقة الاتجاه الجديد
      [TX.floor, TX.rect, TX.round, TX.mat, TX.disc].concat(LEAF_TX).forEach(freeTex);
      Object.keys(TX.dish).forEach(function (k) { freeTex(TX.dish[k]); }); TX.dish = {}; TX.disc = null; TX.round = null;
      [TX.shadow, TX.steam, TX.nib].forEach(freeTex);
      freeLabels(); baseTextures(); roundTex();
      buildRoom(); setCam(L.cam[cur]);
      QUIET = true;
      if (served) servePizzaPage(pg, 0);
      if (ds) { TBL.dolci.served = false; serveDolci(0); }
      finishAll(); QUIET = false;
      var use = slotsFor(pages(D.tables[tIndex("pizza")])[pg].length);
      TBL.pizza.papers.forEach(function (p, i) { if (use.indexOf(i) < 0) { p.vis = false; p.on = false; } });
      updateUI(); kick();
    }, 200);
  });

  /* ---------- أول رسمة: نشيل التحميل وصورة الوصول من الانترو ---------- */
  function firstFrame() {
    var ld = document.getElementById("loading");
    if (ld) wa(ld, [{ opacity: getComputedStyle(ld).opacity }, { opacity: 0 }], { duration: 300, fill: "forwards" }).onfinish = function () { ld.remove(); };
    var ar = document.getElementById("arrive");
    if (ar) requestAnimationFrame(function () {
      wa(ar, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: "ease-out", fill: "forwards" }).onfinish = function () { ar.remove(); };
    });
  }

  // فحص: ‎?debug‎ يطلّع حجم الصور على كرت الشاشة (MB) وعددها
  if (qs.has("debug")) window.__th = { jobs: [], mem: function () { var b = 0; TEX.forEach(function (t) { b += t.W * t.H * 4; }); return { mb: +(b / 1048576).toFixed(1), n: TEX.length, gl: !!gl }; } };

  /* ---------- التشغيل ---------- */
  var ready = false;
  sizeCanvas(); initGL();
  L = layout();
  var names = [], latin = [], body = [];
  D.tables.forEach(function (t) { t.items.forEach(function (it) { names.push(it.name); if (it.en) latin.push(it.en); body.push(it.desc || "", it.note || ""); }); });
  var fontsP = document.fonts && document.fonts.load ? Promise.all([
    document.fonts.load("700 40px 'Aref Ruqaa'", names.join(" ")),
    document.fonts.load("italic 500 30px 'Cormorant Garamond'", latin.join(" ")),
    document.fonts.load("500 30px Tajawal", body.join(" ")),
    document.fonts.load("700 30px Tajawal", "٠١٢٣ د.ع")
  ]).catch(function () {}) : Promise.resolve();
  var timeout = new Promise(function (r) { setTimeout(r, 4000); });
  Promise.all([
    Promise.all(LEAVES.map(loadImg)),
    fetch("assets/intro/logo.svg").then(function (r) { return r.text(); }).catch(function () { return ""; }),
    Promise.all([R + "table_rect.webp", R + "table_round.webp", R + "placemat.webp", R + L.floor.src].map(loadImg)),
    Promise.all(D.tables[0].items.slice(0, 3).map(function (it) { return loadImg(it.img); }))
  ]).then(function (r) {
    var m = document.getElementById("mark"); if (r[1]) m.innerHTML = r[1].replace(/<path class="la"[^>]*\/>/, "");
    D.tables.forEach(function (t) { t.items.forEach(function (it) { it.tbl = t.id; }); });
    baseTextures();
    D.tables[0].items.slice(0, 3).forEach(dishTex);
    buildRail();
    buildRoom();
    cur = D.tables[tIndex(qs.get("t") || "pizza")].id;
    cam = { x: L.cam[cur].x, y: L.cam[cur].y, z: L.cam[cur].z };
    if (cur === "dolci") roundTex();
    var T = D.tables[tIndex(cur)];
    ttl.querySelector(".t").textContent = T.title; ttl.querySelector(".s").textContent = T.tagline || "";
    updateUI();
    ready = true;
    if (FREEZE !== null) { FROZEN = true; clk.cur = performance.now(); }
    dirty = true; render();                                // أول رسمة: الطاولة الفاضية (نفس صورة الغطسة)
    if (SNAP) return;
    var arriving = document.documentElement.classList.contains("from-intro");
    wa(ttl, [{ opacity: 0, transform: "translateX(-50%) translateY(10px)" }, { opacity: 1, transform: "translateX(-50%)" }], { duration: 800, delay: arriving ? 100 : 250, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
    var go = function () {
      if (cur === "pizza") servePizzaPage(0, arriving ? 0 : 350);
      else need(D.tables[tIndex("dolci")].items).then(function () { serveDolci(300); if (FROZEN) { advance(clk.cur + FREEZE); render(); } });
    };
    // أول إطار يطلع للشاشة قبل ما نبدي نحضّر الكتابة والحركات
    var fontsReady = Promise.race([fontsP, timeout]);
    if (FROZEN) return fontsReady.then(function () { go(); afterGo(); });
    fontsReady.then(function () { requestAnimationFrame(function () { requestAnimationFrame(function () { go(); afterGo(); }); }); });
  });
  function afterGo() {
    // جهّز الباقي بهدوء: ينزل من هسه، ويتحضّر قطعة قطعة لما ماكو حركة كبيرة (بترتيب الحاجة: البيتزا الجاية، الحلويات)
    var rest = []; D.tables.forEach(function (t) { rest = rest.concat(t.items); });
    rest = rest.filter(function (it) { return D.tables[0].items.slice(0, 3).indexOf(it) < 0; });
    Promise.all(rest.map(function (it) { return loadImg(it.img); }).concat([loadImg(R + "disc.webp")])).then(function () {
      var jobs = [], prep = function (it) { jobs.push(function () { dishTex(it); }, function () { labelSpec(it, it.tbl); }); };
      rest.filter(function (it) { return it.tbl === "pizza"; }).forEach(prep);
      jobs.push(roundTex, discTex);
      rest.filter(function (it) { return it.tbl !== "pizza"; }).forEach(prep);
      idleWork(jobs);
    });
    if (FROZEN) {
      if (qs.has("go") || qs.has("pg")) {                  // فحص: لحظة من الانتقال أو «الجاية»
        finishAll();
        var t0 = clk.cur, then = function () { advance(t0 + FREEZE); render(); };
        if (qs.has("go")) {
          var id = qs.get("go"), to = D.tables[tIndex(id)];
          need(id === "dolci" ? to.items : pages(D.tables[tIndex("pizza")])[0]).then(function () { clk.cur = t0; goTable(id); setTimeout(then, 50); });
        } else need(pages(D.tables[tIndex("pizza")])[1] || []).then(function () { clk.cur = t0; nextPizzaPage().then(function () { setTimeout(then, 50); }); });
      } else if (cur === "pizza") { advance(clk.cur + FREEZE); render(); }
    }
  }
})();
