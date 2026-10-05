/* ============================================================
   Tree House — المنيو «الغرفة»
   كاميرا من فوق داخل تري هاوس. كل قسم طاولة حقيقية بمكانها بالغرفة:
   ▸ البيتزا: طاولة بلوط عسلي، ورقة A3 (مثل ورقهم) لكل بيتزا، والاسم ينكتب على ورقتها.
     «الجاية» ← هبّة هوا تشيل البيتزات وتجيب اللي بعدها على نفس الطاولة.
   ▸ الحلويات: الطاولة المدورة اللي جنبها. الكاميرا تمشي لها فوق الأرض والسجادة
     (الأرض أبعد، فتتحرك أبطأ = عمق)، دوائر الورق تنزل، والصحون تنحط عليها.
   كل الحركة transform/opacity بـ Web Animations (كرت الشاشة).
   ‎?t=dolci‎ يفتح على طاولة · ‎?freeze=1500‎ يجمّد لحظة · ‎?go=dolci&freeze=900‎ لحظة من الانتقال
   ‎?pg=1&freeze=900‎ لحظة من «الجاية» · ‎?snap=1‎ الطاولة فاضية (صورة الغطسة بالانترو)
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
  var SOFT = "cubic-bezier(.33,0,.2,1)", EXPO = "cubic-bezier(.16,1,.3,1)";
  var ANIMS = [];
  function anim(e, kf, o) { var a = e.animate(kf, o); ANIMS.push(a); return a; }
  function money(n) { return n.toLocaleString("ar-IQ") + " " + D.currency; }
  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image(); im.decoding = "async";
      im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { res(im); }, function () { res(im); }); };
      im.onerror = function () { res(null); }; im.src = src;
    });
  }
  function tIndex(id) { for (var i = 0; i < D.tables.length; i++) if (D.tables[i].id === id) return i; return 0; }

  /* ============================================================
     تخطيط الغرفة (وحدات «العالم»، تتغيّر حسب اتجاه الشاشة)
     ============================================================ */
  var K_FLOOR = 0.66;
  var PHONE = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || Math.min(window.innerWidth, window.innerHeight) < 600;                                     // الأرض أبعد عن الكاميرا
  var L;                                                  // التخطيط الحالي
  function layout() {
    var P = portrait(), W = vw(), H = vh();
    var o = { P: P };
    // الطاولتين: البيتزا بالنص، والحلويات جنبها (يسار = الجاية بالعربي)
    o.pizza = P ? { x: 0, y: 0, w: 1150, h: 2000, rot: 90 } : { x: 0, y: 0, w: 2000, h: 1150, rot: 0 };
    o.dolci = P ? { x: -1900, y: 0, d: 1700 } : { x: -2250, y: 40, d: 1700 };
    o.rug = P ? { x: -812, y: 0 } : { x: -1200, y: 0 };
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
    return o;
  }

  /* ============================================================
     الكاميرا: ٣ طبقات، كل طبقة بعمقها
     ============================================================ */
  var floorL = el("div", "layer", room), worldL = el("div", "layer", room);
  var cam = { x: 0, y: 0, z: 0.5 };
  function tf(c, k) {
    var s = c.z * k;
    return "translate(" + (vw() / 2).toFixed(2) + "px," + (vh() / 2).toFixed(2) + "px) scale(" + s.toFixed(5) + ") translate(" + (-c.x).toFixed(2) + "px," + (-c.y).toFixed(2) + "px)";
  }
  function setCam(c) { cam = { x: c.x, y: c.y, z: c.z }; floorL.style.transform = tf(cam, K_FLOOR); worldL.style.transform = tf(cam, 1); }
  function moveCam(to, ms, delay) {
    var from = { x: cam.x, y: cam.y, z: cam.z }, N = 48, kw = [], kf = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, e = eio(t);
      var c = { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), z: lerp(from.z, to.z, e) * (1 - 0.17 * Math.sin(Math.PI * t)) };
      kw.push({ transform: tf(c, 1) }); kf.push({ transform: tf(c, K_FLOOR) });
    }
    var o = { duration: ms, delay: delay || 0, easing: "linear", fill: "both" };
    anim(floorL, kf, o);
    var a = anim(worldL, kw, o);
    return a.finished.then(function () { setCam(to); floorL.getAnimations().forEach(function (x) { x.cancel(); }); a.cancel(); });
  }
  function toWorld(sx, sy) { return [cam.x + (sx - vw() / 2) / cam.z, cam.y + (sy - vh() / 2) / cam.z]; }

  /* ============================================================
     بناء الغرفة
     ============================================================ */
  var TBL = {};                                           // حالة كل طاولة: الأوراق والأطباق والكتابة
  function place(e, x, y, w, h, rot) {
    e.style.width = w + "px"; e.style.height = h + "px";
    e.style.transform = "translate(" + (x - w / 2) + "px," + (y - h / 2) + "px)" + (rot ? " rotate(" + rot + "deg)" : "");
  }
  function buildRoom() {
    floorL.innerHTML = ""; worldL.innerHTML = "";
    var fi = el("img", "floor-img", floorL), F = L.floor; fi.src = R + F.src; fi.alt = "";
    fi.style.width = (F.x1 - F.x0) + "px"; fi.style.height = (F.y1 - F.y0) + "px";
    fi.style.transform = "translate(" + F.x0 + "px," + F.y0 + "px)";
    // طاولة البيتزا (الصورة بيها هامش ظل 90px)
    var pt = el("div", "tbl", worldL), pi = el("img", "", pt); pi.src = R + "table_rect.webp"; pi.alt = "";
    var t = L.pizza;
    if (t.rot) place(pt, t.x, t.y, 2180, 1330, 90); else place(pt, t.x, t.y, 2180, 1330, 0);
    // الطاولة المدورة
    var rt = el("div", "tbl", worldL), rimg = el("img", "", rt); rimg.src = R + "table_round.webp"; rimg.alt = "";
    place(rt, L.dolci.x, L.dolci.y, L.dolci.d + 180, L.dolci.d + 180, 0);
    // أوراق البيتزا (ثابتة على الطاولة)
    TBL.pizza = { papers: [], dishes: [], labels: [], page: 0, served: false };
    L.slots.forEach(function (s) {
      var p = el("div", "paper", worldL), im = el("img", "", p); im.src = R + "placemat.webp"; im.alt = "";
      var w = s.mw * 1460 / 1400, h = w * 1050 / 1460;
      place(p, s.mx, s.my, w, h, s.mr);
      p._home = p.style.transform; p._on = true;
      var lb = el("div", "lbl", p);
      // منطقة الكتابة: يمين الورقة (يسارها بيه الختم)
      lb.style.right = (w * 0.07) + "px"; lb.style.top = (h * 0.14) + "px"; lb.style.width = (w * 0.66) + "px";
      p._lbl = lb;
      TBL.pizza.papers.push(p);
    });
    TBL.dolci = { discs: [], dishes: [], labels: [], served: false };
  }

  /* ---------- الأطباق والكتابة ---------- */
  function makeDish(it, x, y, d) {
    var e = el("div", "dish", worldL);
    var sd = el("div", "sd", e), fd = el("img", "fd", e); fd.src = it.img; fd.alt = it.name;
    e.style.width = e.style.height = d + "px";
    e._x = x - d / 2; e._y = y - d / 2; e._d = d;
    e.style.transform = "translate(" + e._x + "px," + e._y + "px)";
    sd.style.transform = "translate(" + (d * 0.02) + "px," + (d * 0.035) + "px) scale(1.04)";
    return e;
  }
  function makeLabel(host, it, F, cls) {
    host._gen = (host._gen || 0) + 1;
    host.style.visibility = "";
    host.innerHTML = ""; host.className = "lbl" + (cls ? " " + cls : "");
    host.style.fontSize = F.nm + "px";
    var nm = el("div", "nm", host);
    var clip = el("span", "clip", nm), inn = el("span", "in", clip); inn.textContent = it.name;
    el("i", "nib", nm);
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "swash");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path"); svg.appendChild(path); host.appendChild(svg);
    if (it.en) { var en = el("span", "en", host); en.textContent = it.en; en.style.fontSize = F.en + "px"; }
    if (it.desc) {
      var ds = el("div", "ds", host); ds.style.fontSize = F.ds + "px"; ds.style.marginTop = (F.ds * 0.25) + "px";
      it.desc.split(/(\s+)/).forEach(function (w) { if (w) { var sp = el("span", "", ds); sp.textContent = w; } });
    }
    if (it.note) { var no = el("span", "note", host); no.textContent = it.note; no.style.fontSize = F.note + "px"; no.style.marginTop = (F.note * 0.5) + "px"; }
    if (it.price != null) { var pr = el("span", "pr", host); pr.textContent = money(it.price); pr.style.fontSize = F.ds * 1.1 + "px"; }
    // خط التوقيع تحت الاسم
    var w = Math.max(40, nm.offsetWidth * 0.92), sw = Math.max(1.4, F.nm * 0.035);
    svg.setAttribute("width", w); svg.setAttribute("height", F.nm * 0.22); svg.setAttribute("viewBox", "0 0 " + w + " 12");
    svg.style.width = w + "px"; svg.style.height = (F.nm * 0.22) + "px"; svg.setAttribute("preserveAspectRatio", "none");
    path.setAttribute("d", "M" + (w - 2) + " 5 C " + (w * 0.7).toFixed(1) + " 9, " + (w * 0.35).toFixed(1) + " 2, 6 7 S -2 3, 4 2");
    path.style.strokeWidth = sw;
    host._nw = nm.offsetWidth; host._plen = path.getTotalLength ? path.getTotalLength() : w * 1.2;
    return host;
  }
  function write(lb, delay) {
    // بناء عشرات الحركات بلحظة وحدة يوقف التلفون: كل كتابة تنبني قبل موعدها بـ ٢٥٠ms
    if (delay > 350 && FREEZE === null) {
      var gen = lb._gen;
      lb.style.visibility = "hidden";                      // ما يبين قبل ما تبدي كتابته
      setTimeout(function () { if (lb._gen === gen) writeNow(lb, 250); }, delay - 250);
      return;
    }
    writeNow(lb, delay);
  }
  function writeNow(lb, delay) {
    lb.style.visibility = "";
    var clip = lb.querySelector(".clip"), inn = lb.querySelector(".in"), nib = lb.querySelector(".nib");
    var w = lb._nw || 120, dur = clamp(380 + w * 0.9 / (cam.z || 1) * 0.5, 520, 1100);
    anim(clip, [{ transform: "translateX(101%)" }, { transform: "none" }], { duration: dur, delay: delay, easing: SOFT, fill: "both" });
    anim(inn, [{ transform: "translateX(-101%)" }, { transform: "none" }], { duration: dur, delay: delay, easing: SOFT, fill: "both" });
    anim(nib, [{ transform: "translateX(" + w + "px)", opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .82 }, { transform: "translateX(0)", opacity: 0 }],
      { duration: dur, delay: delay, easing: SOFT, fill: "both" });
    var path = lb.querySelector(".swash path"), Ln = lb._plen || 150;
    path.style.strokeDasharray = Ln;
    anim(path, [{ strokeDashoffset: Ln }, { strokeDashoffset: 0 }], { duration: 480, delay: delay + dur * 0.8, easing: SOFT, fill: "both" });
    var t = delay + dur * 0.85, en = lb.querySelector(".en");
    if (en) anim(en, [{ opacity: 0, transform: "translateY(.3em)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: t, easing: EXPO, fill: "both" });
    if (PHONE) {                                         // التلفون: الوصف كتلة وحدة (طبقة وحدة مو ٢٠)
      var ds = lb.querySelector(".ds");
      if (ds) { ds.querySelectorAll("span").forEach(function (sp) { sp.style.opacity = "1"; });
        anim(ds, [{ opacity: 0, transform: "translateY(.35em)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: t + 110, easing: EXPO, fill: "both" }); }
    } else Array.prototype.forEach.call(lb.querySelectorAll(".ds span"), function (sp, k) {
      anim(sp, [{ opacity: 0, transform: "translateY(.35em)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: t + 110 + k * 30, easing: EXPO, fill: "both" });
    });
    Array.prototype.forEach.call(lb.querySelectorAll(".pr,.note"), function (x) {
      anim(x, [{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: t + 480, easing: EXPO, fill: "both" });
    });
  }
  function unwrite(lb) {
    var gen = lb._gen = (lb._gen || 0) + 1;
    return anim(lb, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: SOFT, fill: "forwards" }).finished.then(function () {
      if (lb._gen !== gen) return;                         // انكتب اسم جديد بنفس الورقة
      lb.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); lb.innerHTML = ""; lb.style.opacity = "";
    }, function () {});
  }

  /* ---------- البيتزا تنقدّم: تنزل من فوق (أقرب للكاميرا = أكبر) لحد ما تلمس الطاولة ---------- */
  function serve(dish, from, delay, r0, r1) {
    var sd = dish.querySelector(".sd"), fd = dish.querySelector(".fd"), N = 30, kd = [], ks = [], kr = [];
    var d = dish._d;
    for (var i = 0; i <= N; i++) {
      var t = i / N, u = eout(t);
      var bx = lerp(from[0], 0, u) + Math.sin(u * Math.PI) * from[0] * -0.12, by = lerp(from[1], 0, u) - Math.sin(u * Math.PI) * d * 0.18;
      var s = 1 + 0.2 * Math.pow(1 - u, 1.4);
      kd.push({ transform: "translate(" + (dish._x + bx).toFixed(1) + "px," + (dish._y + by).toFixed(1) + "px) scale(" + s.toFixed(4) + ")" });
      var lift = Math.pow(1 - u, 1.2);
      ks.push({ transform: "translate(" + (d * (0.02 + 0.1 * lift)).toFixed(1) + "px," + (d * (0.035 + 0.16 * lift)).toFixed(1) + "px) scale(" + (1.04 + 0.16 * lift).toFixed(3) + ")", opacity: (1 - 0.55 * lift).toFixed(3) });
      kr.push({ transform: "rotate(" + lerp(r0, r1, eout(Math.min(1, t * 1.08))).toFixed(2) + "deg)" });
    }
    var o = { duration: 1350, delay: delay, easing: "linear", fill: "both" };
    anim(dish, kd, o); anim(sd, ks, o); return anim(fd, kr, o);
  }
  function lift(dish, to, delay) {
    var sd = dish.querySelector(".sd"), fd = dish.querySelector(".fd"), d = dish._d, N = 24, kd = [], ks = [];
    var r = parseFloat(dish._rot || 0);
    for (var i = 0; i <= N; i++) {
      var t = i / N, u = ein(t);
      kd.push({ transform: "translate(" + (dish._x + to[0] * u).toFixed(1) + "px," + (dish._y + to[1] * u - Math.sin(t * Math.PI) * d * 0.1).toFixed(1) + "px) scale(" + (1 + 0.16 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)).toFixed(4) + ")" });
      var lf = Math.min(1, t * 1.6);
      ks.push({ transform: "translate(" + (d * (0.02 + 0.12 * lf)).toFixed(1) + "px," + (d * (0.035 + 0.18 * lf)).toFixed(1) + "px) scale(" + (1.04 + 0.18 * lf).toFixed(3) + ")", opacity: (1 - 0.6 * lf).toFixed(3) });
    }
    var o = { duration: 1000, delay: delay, easing: "linear", fill: "forwards" };
    anim(fd, [{ transform: "rotate(" + r + "deg)" }, { transform: "rotate(" + (r - 70) + "deg)" }], { duration: 1000, delay: delay, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" });
    anim(sd, ks, o);
    return anim(dish, kd, o).finished.then(function () { dish.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); dish.remove(); });
  }

  /* ---------- ورق الشجر (بالعالم: يمشي ويا الكاميرا) ---------- */
  var LEAF_IMGS = [];
  function bez(p0, p1, p2, p3, t) { var u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
  function flyLeaf(o) {
    var box = el("div", "leaf", worldL), im = el("img", "", box);
    im.src = LEAF_IMGS[(Math.random() * LEAF_IMGS.length) | 0]; im.alt = "";
    var sz = o.size, p0 = o.from, p3 = o.to, H = vh() / cam.z;
    var p1 = [lerp(p0[0], p3[0], .33), p0[1] + rnd(-.25, .25) * H], p2 = [lerp(p0[0], p3[0], .66), p3[1] + rnd(-.25, .25) * H];
    var r0 = rnd(0, 360), spin = rnd(260, 600) * (Math.random() < .5 ? -1 : 1) * (o.land ? .5 : 1), N = 34, kf = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, e = o.land ? 1 - Math.pow(1 - t, 2.4) : t, p = bez(p0, p1, p2, p3, e);
      var wob = Math.sin(t * 9 + r0) * sz * .08 * (o.land ? 1 - t : 1);
      kf.push({ transform: "translate(" + (p[0] - 80).toFixed(1) + "px," + (p[1] - 90 + wob).toFixed(1) + "px) rotate(" + (r0 + spin * e).toFixed(1) + "deg) scale(" + (sz / 160).toFixed(3) + ")" });
    }
    var dur = o.dur || rnd(1500, 2200);
    var a = anim(box, kf, { duration: dur, delay: o.delay || 0, easing: "linear", fill: "both" });
    var fp = rnd(420, 700), fl = rnd(0, 6.28), fk = [];
    for (var j = 0; j <= 8; j++) fk.push({ transform: "scaleX(" + Math.cos(fl + j / 8 * 6.283).toFixed(3) + ")" });
    anim(im, fk, { duration: fp, delay: o.delay || 0, iterations: Math.max(1, Math.round(dur / fp)), easing: "linear", fill: "forwards" });
    if (o.land) box._rest = true;
    else a.finished.then(function () { box.getAnimations({ subtree: true }).forEach(function (x) { x.cancel(); }); box.remove(); }, function () {});
    return box;
  }
  function gust(n, land) {
    if (SNAP) return;
    var a = toWorld(vw() + 120, 0), b = toWorld(-160, vh()), H = b[1] - a[1], sz = 150 / Math.max(cam.z, .3) * .45;
    for (var i = 0; i < n; i++) flyLeaf({ from: [a[0] + rnd(0, 200 / cam.z), a[1] + rnd(-.05, 1) * H], to: [b[0] - rnd(0, 200 / cam.z), a[1] + rnd(0, 1) * H], delay: rnd(0, 520), size: sz * rnd(.7, 1.25) });
    (land || []).forEach(function (pt, k) { flyLeaf({ from: [a[0] + rnd(40, 160), pt[1] + rnd(-.3, .1) * H], to: pt, land: true, delay: 380 + k * 170, dur: rnd(1700, 2100), size: sz * rnd(.85, 1.05) }); });
  }
  function sweepRested() {
    Array.prototype.forEach.call(worldL.querySelectorAll(".leaf"), function (lf) {
      if (!lf._rest) return;
      var m = new DOMMatrix(getComputedStyle(lf).transform);
      anim(lf, [{ transform: m.toString() }, { transform: "translate(" + (m.e - vw() * .9 / cam.z) + "px," + (m.f + rnd(-120, 60)) + "px) rotate(" + rnd(-400, -200) + "deg) scale(" + Math.hypot(m.a, m.b).toFixed(3) + ")" }],
        { duration: 1100, delay: rnd(0, 200), easing: "cubic-bezier(.55,0,.8,.3)", fill: "forwards" }).finished.then(function () { lf.remove(); });
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
    var land = [];
    items.forEach(function (it, k) {
      var s = L.slots[idx[k]];
      var dish = makeDish(it, s.px, s.py, s.d);
      var r1 = rnd(-25, 25); dish._rot = r1;
      dish.querySelector(".fd").style.transform = "rotate(" + r1 + "deg)";
      S.dishes.push(dish);
      if (!SNAP) serve(dish, [vw() * 0.85 / cam.z + s.d * 0.3, -vh() * 0.25 / cam.z + k * 40], t0 + 250 + k * 190, r1 + 170 + k * 20, r1);
      var host = S.papers[idx[k]]._lbl;
      host.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); }); host.style.opacity = "";
      var lb = makeLabel(host, it, L.font);
      S.labels.push(lb);
      if (!SNAP) write(lb, t0 + 1150 + k * 260);
    });
    // الورق الراسي: على الخشب الفاضي (بعيد عن البيتزا والورق)
    if (L.P) land = [[L.pizza.x + rnd(-380, 380), L.pizza.y - 960], [L.pizza.x + 470, L.pizza.y + rnd(-120, 120)]];
    else land = [[L.pizza.x + rnd(-150, 150), L.pizza.y - 480], [L.pizza.x - 900, L.pizza.y + 470]];
    gust(PHONE ? 5 : (L.P ? 10 : 16), pg === 0 && !S.served ? land : []);
    S.served = true; S.page = pg;
  }
  /* الورقة اللي ما إلها بيتزا يطيّرها الهوا، وترجع لما تحتاجها */
  function paperAway(p, delay) {
    if (!p._on) return; p._on = false;
    var m = new DOMMatrix(p._home), far = vw() * 1.2 / cam.z;
    anim(p, [{ transform: p._home }, { transform: "translate(" + (m.e - far * .35) + "px," + (m.f - 80) + "px) rotate(-14deg)", offset: .4 },
             { transform: "translate(" + (m.e - far) + "px," + (m.f + rnd(-200, 100)) + "px) rotate(-38deg)" }],
      { duration: 1150, delay: delay, easing: "cubic-bezier(.55,0,.75,.4)", fill: "forwards" });
  }
  function paperBack(p, delay) {
    if (p._on) return; p._on = true;
    p.getAnimations().forEach(function (a) { a.cancel(); });
    var m = new DOMMatrix(p._home), far = vw() * 1.15 / cam.z, N = 24, kf = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, u = 1 - Math.pow(1 - t, 2.6), sway = Math.sin(t * Math.PI * 2) * 40 * (1 - u);
      kf.push({ transform: "translate(" + (m.e + far * (1 - u)).toFixed(1) + "px," + (m.f - 160 * Math.sin(u * Math.PI) + sway).toFixed(1) + "px) rotate(" + (28 * (1 - u)).toFixed(2) + "deg)" });
    }
    kf[N] = { transform: p._home };
    anim(p, kf, { duration: 1300, delay: delay, easing: "linear", fill: "both" });
  }
  function swapPizzaPage(pg) {
    var T = D.tables[tIndex("pizza")], S = TBL.pizza;
    busy = true;
    gust(PHONE ? 6 : (L.P ? 12 : 18), []);
    sweepRested();
    var outs = S.dishes.map(function (d, k) { return lift(d, [-(vw() * 1.1 / cam.z + d._d), rnd(-60, 40)], 120 + k * 110); });
    S.labels.forEach(function (lb) { unwrite(lb); });
    var use = slotsFor(pages(T)[pg].length);
    S.papers.forEach(function (p, i) { if (use.indexOf(i) < 0) paperAway(p, 180 + i * 90); else paperBack(p, 60 + i * 120); });
    setTimeout(function () { servePizzaPage(pg, 0); updateUI(); }, 520);
    return Promise.all(outs).then(function () { setTimeout(function () { busy = false; }, 1500); });
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
      var s = L.dslots[k];
      var disc = el("div", "paper", worldL), di = el("img", "", disc); di.src = R + "disc.webp"; di.alt = "";
      var dw = s.disc * 960 / 900; place(disc, s.x, s.y, dw, dw, 0);
      var rr = rnd(-30, 30);
      var tx = "translate(" + (s.x - dw / 2) + "px," + (s.y - dw / 2) + "px)";
      if (!SNAP) {
        var N = 26, kf = [];
        for (var i = 0; i <= N; i++) {
          var t = i / N, u = eout(t), sway = Math.sin(t * Math.PI * 2.2) * dw * .06 * (1 - u);
          kf.push({ transform: "translate(" + (s.x - dw / 2 + sway + (1 - u) * dw * .25) + "px," + (s.y - dw / 2 - (1 - u) * dw * .35) + "px) rotate(" + (rr * (1 - u)).toFixed(2) + "deg) scale(" + (1 + .38 * (1 - u)).toFixed(3) + ")", opacity: Math.min(1, t * 3.5) });
        }
        anim(disc, kf, { duration: 1300, delay: t0 + k * 220, easing: "linear", fill: "both" });
      }
      disc.style.transform = tx;
      S.discs.push(disc);
      var dish = makeDish(it, s.x, s.y, s.plate);
      S.dishes.push(dish);
      if (!SNAP) {
        var sd = dish.querySelector(".sd");
        anim(dish, [{ transform: "translate(" + dish._x + "px," + (dish._y - s.plate * .12) + "px) scale(1.16)", opacity: 0 }, { opacity: 1, offset: .35 }, { transform: "translate(" + dish._x + "px," + dish._y + "px) scale(1)", opacity: 1 }],
          { duration: 1100, delay: t0 + 900 + k * 260, easing: EXPO, fill: "both" });
        anim(sd, [{ transform: "translate(" + (s.plate * .14) + "px," + (s.plate * .2) + "px) scale(1.25)", opacity: .2 }, { transform: "translate(" + (s.plate * .02) + "px," + (s.plate * .035) + "px) scale(1.04)", opacity: 1 }],
          { duration: 1100, delay: t0 + 900 + k * 260, easing: EXPO, fill: "both" });
        if (it.steam) steam(s, t0 + 2000 + k * 260);
      }
      var lb = el("div", "lbl", worldL);
      makeLabel(lb, it, L.fontD, "wood");
      lb.style.width = s.lw + "px"; lb.style.textAlign = "center";
      lb.querySelector(".swash").style.marginInline = "auto";
      Array.prototype.forEach.call(lb.querySelectorAll(".en"), function (e) { e.style.textAlign = "center"; });
      lb.style.transform = "translate(" + (s.lx - s.lw / 2) + "px," + s.ly + "px)";
      S.labels.push(lb);
      if (!SNAP) write(lb, t0 + 1500 + k * 300);
    });
  }
  function steam(s, delay) {
    for (var k = 0; k < 3; k++) {
      var st = el("div", "steam", worldL), w = s.plate * .16, h = s.plate * .5;
      st.style.width = w + "px"; st.style.height = h + "px";
      var x = s.x - s.plate * .12 + (k - 1) * s.plate * .08, y = s.y - s.plate * .3 - h;
      anim(st, [{ transform: "translate(" + x + "px," + (y + h * .4) + "px) scaleX(.6)", opacity: 0 }, { opacity: .85, offset: .3 },
                { transform: "translate(" + (x + rnd(-10, 10)) + "px," + (y - h * .4) + "px) scaleX(1.5) rotate(" + rnd(-12, 12) + "deg)", opacity: 0 }],
        { duration: rnd(2600, 3400), delay: delay + k * 700, iterations: Infinity, easing: "ease-out", fill: "both" });
    }
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
    anim(ttl, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: SOFT, fill: "forwards" }).finished.then(function () {
      t.textContent = T.title; s.textContent = T.tagline || "";
      ttl.getAnimations().forEach(function (a) { a.cancel(); });
      anim(ttl, [{ opacity: 0, transform: "translateX(-50%) translateY(10px)" }, { opacity: 1, transform: "translateX(-50%)" }], { duration: 700, delay: delay || 0, easing: EXPO, fill: "both" });
    });
  }
  function goTable(id) {
    if (busy || id === cur) return;
    busy = true;
    var to = D.tables[tIndex(id)];
    sweepRested();
    gust(PHONE ? 4 : (L.P ? 6 : 10), []);
    setTitle(to, 1100);
    cur = id; updateUI();
    history.replaceState(null, "", "?t=" + id);
    // الأطباق تنبني من هسه (مخفية) وحركتها تبدي والكاميرا بعدها تستقر: ما يصير فراغ ولا تقطيع
    if (id === "dolci") serveDolci(1450);
    else if (!TBL.pizza.served) servePizzaPage(0, 1450);
    var backToFirst = id === "pizza" && TBL.pizza.served && TBL.pizza.page !== 0;
    moveCam(L.cam[id], 1850, 150).then(function () {
      if (backToFirst) { swapPizzaPage(0); return; }
      setTimeout(function () { busy = false; }, id === "dolci" ? 900 : 200);
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

  /* الشاشة تغيّرت (تدوير التلفون): نعيد بناء الغرفة بالحالة النهائية بلا حركة */
  var rz = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      var wasP = L.P; L = layout(); if (wasP === L.P && !SNAP) { setCam(L.cam[cur]); return; }
      var pg = TBL.pizza.page, ds = TBL.dolci.served;
      buildRoom(); setCam(L.cam[cur]);
      var keep = SNAP; SNAP = true; servePizzaPage(pg, 0); if (ds) serveDolci(0); SNAP = keep;
      var use = slotsFor(pages(D.tables[tIndex("pizza")])[pg].length);
      TBL.pizza.papers.forEach(function (p, i) { if (use.indexOf(i) < 0) { p.style.opacity = "0"; p._on = false; } });
      document.querySelectorAll(".lbl").forEach(function (lb) { lb.style.opacity = ""; });
    }, 200);
  });

  /* ---------- التشغيل ---------- */
  L = layout();
  Promise.all([
    Promise.all(LEAVES.map(loadImg)),
    fetch("assets/intro/logo.svg").then(function (r) { return r.text(); }).catch(function () { return ""; }),
    Promise.all([R + "table_rect.webp", R + "table_round.webp", R + "placemat.webp", R + L.floor.src].map(loadImg)),
    Promise.all(D.tables[0].items.slice(0, 3).map(function (it) { return loadImg(it.img); })),
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  ]).then(function (r) {
    LEAF_IMGS = LEAVES.filter(function (_, i) { return r[0][i]; });
    var m = document.getElementById("mark"); if (r[1]) m.innerHTML = r[1].replace(/<path class="la"[^>]*\/>/, "");
    buildRail();
    buildRoom();
    cur = D.tables[tIndex(qs.get("t") || "pizza")].id;
    setCam(L.cam[cur]);
    var T = D.tables[tIndex(cur)];
    ttl.querySelector(".t").textContent = T.title; ttl.querySelector(".s").textContent = T.tagline || "";
    updateUI();
    if (SNAP) return;
    var arriving = document.documentElement.classList.contains("from-intro");
    anim(ttl, [{ opacity: 0, transform: "translateX(-50%) translateY(10px)" }, { opacity: 1, transform: "translateX(-50%)" }], { duration: 800, delay: arriving ? 100 : 250, easing: EXPO, fill: "both" });
    return new Promise(function (res) { requestAnimationFrame(function () { requestAnimationFrame(res); }); }).then(function () {
      if (cur === "pizza") servePizzaPage(0, arriving ? 150 : 350); else serveDolci(300);
      // جهّز الباقي بهدوء
      setTimeout(function () { D.tables.forEach(function (t) { t.items.forEach(function (it) { loadImg(it.img); }); }); loadImg(R + "disc.webp"); }, 2500);
    });
  }).then(function () {
    if (qs.has("go") || qs.has("pg")) {                   // فحص: الانتقال أو «الجاية» مجمّدة على لحظة
      ANIMS.forEach(function (a) { try { if (a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (e) {} });
      ANIMS.length = 0;
      return new Promise(function (r) { setTimeout(r, 80); }).then(function () {
        busy = false;
        if (qs.has("go")) goTable(qs.get("go")); else nextPizzaPage();
        if (FREEZE === null) return;
        var fr = function () { ANIMS.forEach(function (a) { try { a.pause(); a.currentTime = FREEZE; } catch (e) {} }); };
        fr(); setTimeout(fr, 700); setTimeout(fr, 2300);
      });
    }
    if (FREEZE !== null) requestAnimationFrame(function () { ANIMS.forEach(function (a) { try { a.pause(); a.currentTime = FREEZE; } catch (e) {} }); });
  });
})();
