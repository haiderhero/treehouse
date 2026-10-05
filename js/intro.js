/* ============================================================
   Tree House — محرّك الانترو «من قلب الشجرة»
   ١ القلب: حلقات لوحتهم الحقيقية تكبر حلقة ورا حلقة
   ٢ اللوحة: الكاميرا ترجع، الإطار ينرسم، والشعار يطلع
   ٣ العبور: الكاميرا تدخل بالقلب، والبيت (مطفي) ينكشف من خلال الحلقات، والورق يطير
   ٤ اللافتة: الشعار يطفو وينزل على لافتة المبنى الحقيقية ويشتعل
   ٥ البيت يصحى: الجدار يدفى من اللافتة، الشرائط تمشي للأطراف، والمصابيح موجة
   المشهد كله shader واحد:
     rings_f.png  كل نقطة باللوحة تعرف رقم حلقتها من القلب
     house_*_map  كل نقطة بالبيت تعرف متى تشتغل إنارتها (ونوعها)
   ‎?at=5.2‎ يجمّد لحظة للفحص · ‎?intro=1‎ يجبره يطلع · ‎?speed=0.5‎ أبطأ
   ============================================================ */
(function () {
  "use strict";

  /* ---------- إعدادات (تنقل للإدارة لاحقاً) ---------- */
  var CFG = {
    hours: { open: 8, close: 1 },                   // ٨ صباحاً – ١ ليلاً (بغداد)
    leaves: ["storm-1", "storm-2", "storm-4", "storm-5", "storm-6"],   // storm-3 فارغة من الأصل
    fallback: "assets/house/house-8.jpg",           // لو WebGL ما موجود (فيها اللافتة الحقيقية)
    inside: { tall: "assets/menu/table-tall.jpg", wide: "assets/menu/table-wide.jpg", fx: 0.5, fy: 0.5 }, // من فتحات الحروف تبين طاولة المنيو
    next: "menu.html"
  };

  var EN = { E: 0, blur: 0, intA: 0, intAll: 0, signA: 0, intZ: 1, A: [0, 0], B: [0, 0], L: [0, 0, 1, 1] };

  /* ---------- هندسة اللوحة (بكسل اللوحة المعدّلة 2000×2681) ---------- */
  var PW = 2000, PH = 2681, FR = 24;
  var RB = [24, 24, 1976, 1684];                    // صندوق الحلقات
  var BAND = [1684, 1703];                          // خط أعلى شريط الشعار
  var LOGO = [0.07233 * PW, 0.67624 * PH, 0.92633 * PW, 0.94592 * PH];

  /* ---------- الخط الزمني (ثواني) ---------- */
  var T = {
    grow: [0.35, 2.45], plaque: [2.1, 2.95], frame: [2.15, 3.0], band: [2.5, 3.05], logoIn: [2.6, 3.3],
    portal: [3.85, 5.1], reveal: [4.85, 5.35], burst: 3.9,
    float: [3.95, 4.75], land: [4.95, 5.8], latinOut: [4.55, 5.25],
    wake: [5.7, 8.0], hero: 7.1
  };
  var END = 8.3;

  var qs = new URLSearchParams(location.search);
  var AT = qs.has("at") ? parseFloat(qs.get("at")) : null;
  var SPEED = parseFloat(qs.get("speed") || "1") || 1;
  var FORCE = qs.get("intro") === "1" || AT !== null;

  var stage = document.getElementById("stage");
  var cv = document.getElementById("gl");
  var burstCv = document.getElementById("burst");
  var signEl = document.getElementById("plaqueLogo");
  var hero = document.getElementById("hero");
  var skipBtn = document.getElementById("skip");

  /* ---------- أدوات ---------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, r) { return clamp((t - r[0]) / (r[1] - r[0]), 0, 1); }
  function eio(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eout(x) { return 1 - Math.pow(1 - x, 3); }
  function ein(x) { return x * x * x; }
  function esine(x) { return -(Math.cos(Math.PI * x) - 1) / 2; }
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.decoding = "async";
      im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { res(im); }, function () { res(im); }); };
      im.onerror = function () { rej(new Error("img " + src)); }; im.src = src;
    });
  }
  function getJSON(u) { return fetch(u).then(function (r) { return r.json(); }); }

  /* ---------- حالة الدوام (بتوقيت بغداد) ---------- */
  function status() {
    var el = document.getElementById("status"); if (!el) return;
    var d = new Date(), h = (d.getUTCHours() + 3) % 24 + d.getUTCMinutes() / 60;
    var o = CFG.hours.open, c = CFG.hours.close;
    var open = c < o ? (h >= o || h < c) : (h >= o && h < c);
    el.className = "hero-status" + (open ? "" : " closed");
    el.innerHTML = open
      ? '<span class="dot"></span><b>مفتوح الآن</b> · نستقبلكم لحد الواحدة ليلاً'
      : '<span class="dot"></span>نفتح يومياً الساعة ٨ صباحاً · الفطور بانتظاركم';
    var tg = document.querySelector(".hero-tag .in");
    if (tg) requestAnimationFrame(function () { document.querySelector(".hero-tag").style.setProperty("--tw", tg.offsetWidth + "px"); });
  }

  /* ============================================================
     WebGL
     ============================================================ */
  var VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FS = [
    "precision highp float;",
    "uniform vec2 uRes;uniform vec3 uCam;uniform vec2 uPlq;uniform vec4 uRB;uniform vec2 uCore;",
    "uniform sampler2D uF,uS,uLit,uOff,uMid,uMap;uniform vec2 uTex;uniform float uMaxF;",
    "uniform float uSeed,uGrow,uPlaque,uFrame,uBand,uPortal,uReveal,uWake,uTime,uZoom;uniform vec2 uBandY;",
    // الدخول من عين الهاء: A نقطة العين بالشاشة قبل التكبير، B وين تصير، E التكبير
    "uniform sampler2D uLS,uLH,uInt,uEye;uniform vec4 uEnt,uEnt2,uLogoR,uLogoS,uIntC,uEyeR;uniform float uSignA,uIntZ;",
    "const vec3 TERRA=vec3(.702,.329,.247);const vec3 NIGHT=vec3(.23,.085,.06);",
    "const vec3 CREAM=vec3(.945,.902,.824);const vec3 GOLD=vec3(1.,.8,.52);",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "void main(){",
    "  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);",
    "  float pxs=1./uCam.z;",
    "  vec2 q=uCam.xy+(p-.5*uRes)*pxs;",
    "  vec2 sn=p/uRes-.5;float asp=uRes.x/uRes.y;",
    // الخلفية حول اللوحة
    "  float vig=smoothstep(1.05,.1,length(sn*vec2(asp,1.)));",
    "  vec3 bg=mix(NIGHT*.55,NIGHT*1.3,vig);",
    "  vec2 dq=min(q,uPlq-q);float dIn=min(dq.x,dq.y);",
    "  float inPl=clamp(dIn/pxs+.5,0.,1.);",
    "  float sh=exp(-max(-dIn,0.)/180.)*(1.-inPl);",
    "  float lit=.9+.16*smoothstep(1.3,0.,length((q-uCore)/uPlq.y));",
    "  vec3 col=mix(TERRA*lit,mix(bg,bg*.45,sh),uPlaque*(1.-inPl));",
    // ---- الحلقات ----
    "  vec2 ruv=(q-uRB.xy)/(uRB.zw-uRB.xy);",
    "  float inR=step(0.,ruv.x)*step(ruv.x,1.)*step(0.,ruv.y)*step(ruv.y,1.);",
    "  float F=texture2D(uF,ruv).r*uMaxF;",
    "  float sd=(texture2D(uS,ruv).r*255.-128.)/127.*uTex.y*((uRB.z-uRB.x)/uTex.x)/pxs;",
    "  float ang=atan(q.y-uCore.y,q.x-uCore.x)/6.2831853+.5;",
    "  float key=F+.75*fract(ang+F*.137);",
    "  float rev=smoothstep(uGrow+.2,uGrow-.55,key);",
    "  float fr=rev*smoothstep(1.7,0.,uGrow-key);",
    "  float lineA=clamp(sd+.5+fr*1.4,0.,1.)*rev*inR;",
    "  col=mix(col,mix(CREAM,GOLD*1.12,fr),lineA);",
    "  col+=GOLD*.16*fr*inR*(1.-lineA);",
    "  float fa=fract(atan(q.y-uPlq.y*.5,q.x-uPlq.x*.5)/6.2831853+.75);",
    "  float frm=clamp((" + FR.toFixed(1) + "-dIn)/pxs+.5,0.,1.)*inPl*step(fa,uFrame);",
    "  float bl=clamp(min(q.y-uBandY.x,uBandY.y-q.y)/pxs+.5,0.,1.)*inPl*step(abs(q.x/uPlq.x-.5)*2.,uBand);",
    "  col=mix(col,CREAM,max(frm,bl));",
    "  float dc=length(q-uCore)/pxs;",
    "  col+=GOLD*uSeed*(exp(-dc*dc/180.)*1.1+exp(-dc/60.)*.25);",
    // ---- البيت: مطفي ← الجدار يدفى (R) ← كل مصباح/شريط يشتعل بوقته (B) ----
    "  vec2 puv=(p/uRes-.5)/uZoom+.5;",
    "  vec3 L=texture2D(uLit,puv).rgb;vec3 O=texture2D(uOff,puv).rgb;vec3 Mi=texture2D(uMid,puv).rgb;vec3 mp=texture2D(uMap,puv).rgb;",
    "  vec3 base=mix(O,Mi,smoothstep(mp.r,mp.r+.2,uWake));",
    "  float hasB=step(mp.b,.995);float bulb=step(.75,mp.g);",
    "  float onB=hasB*smoothstep(mp.b,mp.b+mix(.045,.02,bulb),uWake);",
    "  float dt=uWake-mp.b;",
    "  float fl=hasB*mix(.55*exp(-pow((dt-.025)/.045,2.)),exp(-pow((dt-.014)/.03,2.)),bulb);",
    "  vec3 ph=mix(base,L,onB)+max(L-base,0.)*fl*.9;",
    "  ph*=1.-.38*smoothstep(.12,.5,sn.y);",                    // تعتيم تحت حتى الكلام يبين
    // ---- العبور: البيت ينكشف من خلال الحلقات ----
    "  float por=max(smoothstep(uPortal+.15,uPortal-.5,F)*inR,uReveal);",
    "  float edge=inR*(1.-uReveal)*smoothstep(1.3,0.,abs(uPortal-F+.2));",
    "  col=mix(col,ph,por);",
    "  float glw=clamp(sd+.5,0.,1.)*edge;",
    "  col=mix(col,GOLD*1.35,glw*.85);col+=GOLD*.22*edge;",
    // ---- الدخول: الكاميرا تغطس بعين الهاء، والبيت من داخل يبين من فتحات الحروف ----
    "  if(uEnt2.x>0.){",
    "    float E=uEnt2.x;vec2 d=p-uEnt.zw;",
    "    vec3 c=vec3(0.);",
    "    for(int k=0;k<6;k++){float f=1.+uEnt2.y*float(k)/5.;vec2 pk=uEnt.xy+d/(E*f);c+=texture2D(uLit,(pk/uRes-.5)/uZoom+.5).rgb;}",
    "    c/=6.;",
    "    vec2 p0=uEnt.xy+d/E;",
    "    c*=1.-.38*smoothstep(.12,.5,p0.y/uRes.y-.5)*clamp(2.-E,0.,1.);",
    "    vec2 lu=(p0-uLogoR.xy)/uLogoR.zw*uLogoS.xy;",
    "    vec2 su=(lu+uLogoS.z)/(uLogoS.xy+2.*uLogoS.z);",
    "    float inS=step(0.,su.x)*step(su.x,1.)*step(0.,su.y)*step(su.y,1.);",
    "    float g=(texture2D(uLS,su).r*255.-128.)/127.*uLogoS.w;",
    "    float hh=(texture2D(uLH,su).r*255.-128.)/127.*uLogoS.w;",
    // حوالين عين الهاء: خريطة أدق بلا ضغط (حتى الحافة تبقى ناعمة ويا التكبير الكبير)
    "    vec2 eu=(lu-uEyeR.xy)/uEyeR.zw;",
    "    float ew=smoothstep(0.,.08,min(min(eu.x,eu.y),min(1.-eu.x,1.-eu.y)));",
    "    if(ew>0.){vec3 ev=texture2D(uEye,eu).rgb;g=mix(g,(ev.r*255.-128.)/127.*uLogoS.w,ew);hh=mix(hh,(ev.g*255.-128.)/127.*uLogoS.w,ew);}",
    "    float ppu=uLogoR.z/uLogoS.x*E;",
    "    float soft=1.+uEnt2.y*45.;",                        // الحافات تتنعّم ويا سرعة الغطسة
    "    float ink=clamp(g*ppu/soft+.5,0.,1.)*inS;float hole=clamp(hh*ppu/soft+.5,0.,1.)*inS;",
    "    float dO=max(-g,0.);",
    "    vec3 glow=(vec3(1.,.93,.78)*.5*exp(-dO/12.)+vec3(1.,.74,.43)*.4*exp(-dO/34.)+vec3(1.,.6,.3)*.25*exp(-dO/60.))*smoothstep(47.,30.,dO)*inS;",
    "    c+=glow*uSignA*(1.-ink)*(1.-hole);",
    "    vec2 ip=d/uIntZ+.5*uRes;vec3 inn=texture2D(uInt,uIntC.xy+ip/uRes*uIntC.zw).rgb;",
    "    float ia=max(hole*uEnt2.z,uEnt2.w);",
    "    c=mix(c,inn,ia);",
    "    c+=vec3(1.,.78,.5)*.35*hole*uEnt2.z*(1.-uEnt2.w)*exp(-max(hh,0.)*ppu/28.);",   // ضو دافي على حافة الفتحة من جوّه
    // وجه الحرف: أكريليك مضوي من جوّه — عنبري على الحافة، أبيض دافي بالنص
    "    vec3 face=mix(vec3(1.,.8,.55),vec3(1.,.972,.9),smoothstep(0.,16.,max(g,0.)));",
    "    face*=.94+.06*smoothstep(0.,40.,max(g,0.));",
    "    c=mix(c,face,ink*uSignA*(1.-uEnt2.w));",
    "    col=c;",
    "  }",
    "  col+=(hash(p+fract(uTime*7.3)*97.)-.5)*.03;",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  var gl, prog, U = {}, tex = {}, rings, house, logoMeta, crop, img = {}, dpr = 1, cw = 0, ch = 0, cover = null;

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function mkTex(src, nearest) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    var f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function initGL() {
    gl = cv.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: AT !== null });
    if (!gl) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["uRes", "uCam", "uPlq", "uRB", "uCore", "uF", "uS", "uLit", "uOff", "uMid", "uMap", "uTex", "uMaxF", "uSeed", "uGrow", "uPlaque",
     "uFrame", "uBand", "uPortal", "uReveal", "uWake", "uTime", "uZoom", "uBandY",
     "uLS", "uLH", "uInt", "uEye", "uEnt", "uEnt2", "uLogoR", "uLogoS", "uIntC", "uEyeR", "uSignA", "uIntZ"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  /* قصّة «cover» على مقاس الشاشة، مركزها اللافتة (نسب من صورة القصّة) */
  function coverRect() {
    var ar = cw / ch, iar = crop.size[0] / crop.size[1];
    var r = crop.rect, L = house.letters;
    var fx = ((L[0] + L[2]) / 2 - r[0]) / (r[2] - r[0]);
    var fy = 0.43;
    var sw, sh_;
    if (iar > ar) { sh_ = 1; sw = ar / iar; } else { sw = 1; sh_ = iar / ar; }
    return { x: clamp(fx - sw / 2, 0, 1 - sw), y: clamp(fy - sh_ / 2, 0, 1 - sh_), w: sw, h: sh_ };
  }
  function cropTo(im, c, maxW, smooth) {
    var sx = c.x * im.naturalWidth, sy = c.y * im.naturalHeight, sw = c.w * im.naturalWidth, shh = c.h * im.naturalHeight;
    var k = Math.min(1, maxW / sw);
    var cnv = document.createElement("canvas");
    cnv.width = Math.max(2, Math.round(sw * k)); cnv.height = Math.max(2, Math.round(shh * k));
    var x = cnv.getContext("2d");
    x.imageSmoothingEnabled = smooth; if (smooth) x.imageSmoothingQuality = "high";
    x.drawImage(im, sx, sy, sw, shh, 0, 0, cnv.width, cnv.height);
    return cnv;
  }
  function buildHouse() {
    cover = coverRect();
    ["lit", "off", "mid", "map"].forEach(function (k) { if (tex[k]) gl.deleteTexture(tex[k]); });
    tex.lit = mkTex(cropTo(img.lit, cover, cw * 1.25, true));
    tex.off = mkTex(cropTo(img.off, cover, cw * 0.7, true));
    tex.mid = mkTex(cropTo(img.mid, cover, cw * 1.1, true));
    tex.map = mkTex(cropTo(img.map, cover, 4096, false), false);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    cw = Math.round(w * dpr); ch = Math.round(h * dpr);
    cv.width = cw; cv.height = ch; burstCv.width = cw; burstCv.height = ch;
    if (gl) { gl.viewport(0, 0, cw, ch); buildHouse(); if (idle) render(END); }
  }

  /* مكان حروف اللافتة على الشاشة (بكسل CSS) حسب القصّة والتكبير */
  function signRect(zoom) {
    var r = crop.rect, L = house.letters, W = window.innerWidth, H = window.innerHeight;
    function sx(X) { var u = (X - r[0]) / (r[2] - r[0]); return (((u - cover.x) / cover.w - 0.5) * zoom + 0.5) * W; }
    function sy(Y) { var v = (Y - r[1]) / (r[3] - r[1]); return (((v - cover.y) / cover.h - 0.5) * zoom + 0.5) * H; }
    return [sx(L[0]), sy(L[1]), sx(L[2]), sy(L[3])];
  }

  /* ============================================================
     الحالة بكل لحظة
     ============================================================ */
  var CORE = [0, 0];
  function state(t) {
    var fit = Math.min(cw * 0.8 / PW, ch * 0.74 / PH);
    var mid = [lerp(CORE[0], PW / 2, 0.45), lerp(CORE[1], PH / 2, 0.3)];
    var K = [
      [0.0, CORE, 3.4, null],
      [2.3, mid, 1.45, eout],
      [3.15, [PW / 2, PH / 2], 1.0, eio],
      [3.75, [PW / 2, PH / 2], 0.97, esine],
      [5.05, CORE, 16, ein]
    ];
    var c = K[0][1], z = K[0][2];
    for (var i = 1; i < K.length; i++) {
      if (t <= K[i - 1][0]) break;
      var u = K[i][3](clamp((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]), 0, 1));
      c = [lerp(K[i - 1][1][0], K[i][1][0], u), lerp(K[i - 1][1][1], K[i][1][1], u)];
      z = Math.exp(lerp(Math.log(K[i - 1][2]), Math.log(K[i][2]), u));
    }
    return {
      cam: [c[0], c[1], fit * z],
      seed: clamp((t - 0.05) / 0.4, 0, 1) * (1 - clamp((t - 0.9) / 0.8, 0, 1)),
      grow: lerp(-0.6, rings.maxF + 1.2, esine(seg(t, T.grow))),
      plaque: eio(seg(t, T.plaque)), frame: eio(seg(t, T.frame)), band: eout(seg(t, T.band)),
      logoIn: eout(seg(t, T.logoIn)),
      portal: lerp(-0.8, 11, ein(seg(t, T.portal))), reveal: seg(t, T.reveal),
      float: eio(seg(t, T.float)), land: eio(seg(t, T.land)), latin: 1 - seg(t, T.latinOut),
      wake: seg(t, T.wake),
      zoom: lerp(1.2, 1.0, eout(clamp((t - 3.9) / 3.8, 0, 1))),
      hero: t >= T.hero
    };
  }

  /* ============================================================
     الورق: يطير من قلب الشجرة باتجاه الكاميرا
     ============================================================ */
  var sprites = [], leaves = [], burstAt = -1;
  function bakeSprites(ims) {
    sprites = ims.map(function (im) {
      var pad = 10, c = document.createElement("canvas");
      c.width = im.naturalWidth + pad * 2; c.height = im.naturalHeight + pad * 2;
      var x = c.getContext("2d");
      x.shadowColor = "rgba(20,8,2,.35)"; x.shadowBlur = 6; x.shadowOffsetY = 4;   // الظل ينرسم مرة وحدة
      x.drawImage(im, pad, pad);
      return c;
    });
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function spawnBurst(sx, sy) {
    var N = qs.get("burst") === "0" ? 0 : (cw / dpr < 700 ? 34 : 58);
    leaves = [];
    for (var i = 0; i < N; i++) {
      leaves.push({ img: sprites[i % sprites.length], x: sx, y: sy, a: rnd(0, Math.PI * 2),
        v: rnd(0.35, 1.0), delay: rnd(0, 0.35), life: rnd(0.95, 1.35),
        s0: rnd(0.12, 0.3), rot: rnd(0, 6.28), rs: rnd(-3, 3), flip: rnd(0, 6.28), fs: rnd(3, 7) });
    }
  }
  function drawBurst(t) {
    var x = burstCv.getContext("2d");
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch);
    if (!leaves.length) return;
    var R = Math.hypot(cw, ch) * 0.62, alive = 0;
    for (var i = 0; i < leaves.length; i++) {
      var L = leaves[i], age = t - burstAt - L.delay;
      if (age < 0) { alive++; continue; }
      var u = age / L.life; if (u >= 1) continue; alive++;
      var d = R * L.v * (1 - Math.pow(1 - u, 2.2));
      var px = L.x + Math.cos(L.a) * d, py = L.y + Math.sin(L.a) * d + u * u * 60 * dpr;
      var s = Math.min((L.s0 + 1.9 * u * u) * dpr, 1.7);          // ما تتكبّر أكثر من دقتها (حتى تبقى حادة)
      x.globalAlpha = Math.min(1, u * 6) * (1 - clamp((u - 0.72) / 0.28, 0, 1));
      x.setTransform(s * Math.cos(L.flip + L.fs * age), 0, 0, s, px, py);
      x.rotate(L.rot + L.rs * age);
      x.drawImage(L.img, -L.img.width / 2, -L.img.height / 2);
    }
    x.globalAlpha = 1;
    if (!alive) leaves.length = 0;
  }

  /* ============================================================
     الشعار ← اللافتة: ثلاث حالات (على اللوحة، طافي، على المبنى)
     ============================================================ */
  var litLayer, shadeEl, baseLayer, litSvg, latinEls = [];
  function rectLerp(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)]; }
  function placeSign(S, t) {
    var W = window.innerWidth, H = window.innerHeight;
    // ١ على اللوحة (نفس كاميرا المشهد)
    var A = [((LOGO[0] - S.cam[0]) * S.cam[2] + cw / 2) / dpr, ((LOGO[1] - S.cam[1]) * S.cam[2] + ch / 2) / dpr,
             ((LOGO[2] - S.cam[0]) * S.cam[2] + cw / 2) / dpr, ((LOGO[3] - S.cam[1]) * S.cam[2] + ch / 2) / dpr];
    // ٢ طافي بنص الشاشة
    var fw = Math.min(W * 0.66, 520), fh = fw * logoMeta.h / logoMeta.w, fy = H * 0.42;
    var B = [W / 2 - fw / 2, fy - fh / 2, W / 2 + fw / 2, fy + fh / 2];
    // ٣ على حروف اللافتة الحقيقية (الجزء العربي من الشعار = كل الصندوق)
    var C = signRect(S.zoom);
    var R = S.land > 0 ? rectLerp(B, C, S.land) : rectLerp(A, B, S.float);
    var k = (R[2] - R[0]) / logoMeta.w;
    signEl.style.transform = "translate(" + R[0].toFixed(2) + "px," + R[1].toFixed(2) + "px) scale(" + k.toFixed(5) + ")";
    signEl.style.opacity = Math.max(S.logoIn, 0.002).toFixed(3);   // مو صفر: الطبقة تبقى مرسومة جاهزة
    for (var i = 0; i < latinEls.length; i++) latinEls[i].style.opacity = S.latin.toFixed(3);
    shadeEl.style.opacity = (S.float * (1 - S.land)).toFixed(3);
    // حروف اللافتة قبل الاشتعال باهتة (مو مضوية)، حتى يبين الاشتعال
    baseLayer.style.opacity = (1 - 0.55 * S.land).toFixed(3);
    // الاشتعال: وميض ثم ثبات (بس opacity على طبقة فيها التوهج)
    var w = S.wake, on;
    if (w <= 0.02) on = 0;
    else if (w >= 0.15) on = 1;
    else {
      var f = Math.floor(t * 30);
      var flick = [0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1];
      on = flick[f % flick.length] * clamp((w - 0.02) / 0.13, 0.25, 1);
    }
    litLayer.style.opacity = Math.max(on, 0.002).toFixed(3);
  }

  /* اللافتة المضوية: نرسم الحروف ويا توهّجها مرة وحدة على canvas (بدل فلتر CSS يتحسب كل إطار) */
  function bakeLit() {
    var W = 1400, k = W / logoMeta.w, H = Math.round(logoMeta.h * k), P = Math.round(170 * k);
    var svg = litSvg.replace(/<path class="la"[^>]*\/>/, "").replace('fill="currentColor"', 'fill="#fff4dc"');
    return loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)).then(function (im) {
      var c = document.createElement("canvas"); c.width = W + 2 * P; c.height = H + 2 * P;
      var x = c.getContext("2d");
      [[150, "rgba(255,150,70,.55)"], [52, "rgba(255,190,110,.8)"], [10, "rgba(255,238,200,.95)"]].forEach(function (g) {
        x.shadowBlur = g[0] * k * 1.2; x.shadowColor = g[1]; x.drawImage(im, P, P, W, H);
      });
      x.shadowBlur = 0; x.drawImage(im, P, P, W, H);
      var u = logoMeta.w / W;                                    // وحدات عنصر الشعار
      c.style.cssText = "position:absolute;left:" + (-P * u) + "px;top:" + (-P * u) + "px;width:" + (c.width * u) + "px;height:" + (c.height * u) + "px";
      litLayer.appendChild(c);
    });
  }

  /* ============================================================
     الرسم
     ============================================================ */
  function render(t) {
    var S = state(t);
    gl.uniform2f(U.uRes, cw, ch);
    gl.uniform3f(U.uCam, S.cam[0], S.cam[1], S.cam[2]);
    gl.uniform2f(U.uPlq, PW, PH);
    gl.uniform4f(U.uRB, RB[0], RB[1], RB[2], RB[3]);
    gl.uniform2f(U.uCore, CORE[0], CORE[1]);
    gl.uniform2f(U.uTex, rings.w, rings.sdfRange);
    gl.uniform1f(U.uMaxF, rings.maxF);
    gl.uniform1f(U.uSeed, S.seed); gl.uniform1f(U.uGrow, S.grow);
    gl.uniform1f(U.uPlaque, S.plaque); gl.uniform1f(U.uFrame, S.frame); gl.uniform1f(U.uBand, S.band);
    gl.uniform1f(U.uPortal, S.portal); gl.uniform1f(U.uReveal, S.reveal); gl.uniform1f(U.uWake, S.wake);
    gl.uniform1f(U.uTime, t); gl.uniform1f(U.uZoom, S.zoom);
    gl.uniform2f(U.uBandY, BAND[0], BAND[1]);
    // ٨ وحدات بس مضمونة بكل الأجهزة: وقت الدخول صورة الداخل تاخذ وحدة «المطفي» (ما نحتاجه وقتها)
    var units = [["uF", EN.E > 0 && tex.eye ? "eye" : "f"], ["uS", "s"], ["uLit", "lit"], ["uOff", EN.E > 0 && tex.int ? "int" : "off"], ["uMid", "mid"], ["uMap", "map"], ["uLS", "ls"], ["uLH", "lh"]];
    for (var i = 0; i < units.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[units[i][1]]); gl.uniform1i(U[units[i][0]], i);
    }
    gl.uniform1i(U.uInt, 3); gl.uniform1i(U.uEye, 0);
    var et = logoMeta.eyeTex; gl.uniform4f(U.uEyeR, et[0], et[1], et[2], et[3]);
    gl.uniform4f(U.uEnt, EN.A[0], EN.A[1], EN.B[0], EN.B[1]);
    gl.uniform4f(U.uEnt2, EN.E, EN.blur, EN.intA, EN.intAll);
    gl.uniform4f(U.uLogoR, EN.L[0], EN.L[1], EN.L[2], EN.L[3]);
    gl.uniform4f(U.uLogoS, logoMeta.w, logoMeta.h, logoMeta.sdf.pad, logoMeta.sdf.range);
    gl.uniform4f(U.uIntC, 0, 0, 1, 1);
    gl.uniform1f(U.uSignA, EN.signA); gl.uniform1f(U.uIntZ, EN.intZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    placeSign(S, t);

    if (burstAt < 0 && t >= T.burst && t < T.burst + 1.5) {
      burstAt = t;
      spawnBurst((CORE[0] - S.cam[0]) * S.cam[2] + cw / 2, (CORE[1] - S.cam[1]) * S.cam[2] + ch / 2);
    }
    drawBurst(t);

    if (S.hero && !hero.classList.contains("on")) { hero.classList.add("on"); skipBtn.classList.add("gone"); }
  }

  var t0 = 0, tOffset = 0, idle = false;
  var scene = document.getElementById("scene");
  function loop(now) {
    var t = tOffset + (now - t0) / 1000 * SPEED;
    if (t >= END) { finish(); return; }
    render(t);
    requestAnimationFrame(loop);
  }
  /* بعد الانترو: آخر إطار ينرسم مرة وحدة ويوگف الرسم (بطارية التلفون)، والزوم البطيء CSS على كرت الشاشة */
  function finish() {
    render(END); idle = true; leaves.length = 0; drawBurst(END);
    scene.classList.add("idle");
    try { sessionStorage.setItem("th-intro", "1"); } catch (e) {}
    loadInside();                                              // داخل المكان يتحمّل بهدوء، جاهز للدخول
  }
  function skip() {
    tOffset = END; t0 = performance.now(); leaves.length = 0; burstAt = 99;
    try { sessionStorage.setItem("th-intro", "1"); } catch (e) {}
  }

  /* ============================================================
     الدخول «من عين الهاء»: الكاميرا تغطس بفتحة حرف الهاء بكلمة «هاوس»،
     والفتحات تضوي بداخل المكان، والفتحة تكبر لحد ما تصير هي الشاشة
     ============================================================ */
  var ENTER_END = 2.5, entering = false, insideP = null;
  function loadInside() {
    if (!insideP) insideP = loadImg(tall ? CFG.inside.tall : CFG.inside.wide).then(function (im) {
      var ar = cw / ch, iar = im.naturalWidth / im.naturalHeight, sw, sh_;
      if (iar > ar) { sh_ = 1; sw = ar / iar; } else { sw = 1; sh_ = iar / ar; }
      var c = { x: clamp(CFG.inside.fx - sw / 2, 0, 1 - sw), y: clamp(CFG.inside.fy - sh_ / 2, 0, 1 - sh_), w: sw, h: sh_ };
      tex.int = mkTex(cropTo(im, c, cw * 1.1, true));
    });
    return insideP;
  }
  function enterGeom() {
    var R = signRect(1.0);                                     // اللافتة بالنهاية (canvas px)
    var L = [R[0] * dpr, R[1] * dpr, (R[2] - R[0]) * dpr, (R[3] - R[1]) * dpr];
    var eye = logoMeta.eye, s0 = L[2] / logoMeta.w;
    return { L: L, A: [L[0] + eye.cx * s0, L[1] + eye.cy * (L[3] / logoMeta.h)],
             Zmax: 1.35 * Math.hypot(cw, ch) / (2 * 15 * s0) };
  }
  var lnPrev = 0, ePrev = 0;
  function enterState(e, G) {
    var u = seg(e, [0.15, 2.25]);
    var ln = Math.log(G.Zmax) * Math.pow(u, 2.4);             // تسارع: بطيء ثم يغطس
    EN.E = Math.exp(ln);
    var dt = Math.max(1e-3, e - ePrev);
    EN.blur = e > ePrev ? clamp((ln - lnPrev) / dt * 0.016, 0, 0.2) : EN.blur;
    lnPrev = ln; ePrev = e;
    var b = eio(seg(e, [0.2, 2.0]));
    EN.A = G.A; EN.B = [lerp(G.A[0], cw / 2, b), lerp(G.A[1], ch * 0.5, b)]; EN.L = G.L;
    EN.signA = seg(e, [0, 0.14]);
    EN.intA = eout(seg(e, [0.1, 0.7])) * 0.92;
    EN.intAll = seg(e, [2.18, 2.42]);
    EN.intZ = lerp(1.35, 1.0, eout(seg(e, [0.3, 2.6])));
  }
  /* الضغطة: حلقات تتوسع من الزر للبرّه (عناصر جاهزة داخل الزر: بلا قياس ولا إضافة وقت الضغط) */
  var RIPS = Array.prototype.slice.call(document.querySelectorAll("#enter .ripple"));
  function ripple() {
    RIPS.forEach(function (d, k) {
      d.animate([{ transform: "scale(.4)", opacity: .9 }, { transform: "scale(" + (5 + k * 1.6) + ")", opacity: 0 }],
        { duration: 1100 + k * 150, delay: k * 110, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
    });
    document.querySelector("#enter .e-body").animate([{ transform: "scale(1)" }, { transform: "scale(.95)", offset: .3 }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
  }
  function enter() {
    if (entering) return; entering = true;
    if (!gl) { location.href = CFG.next; return; }
    ripple();
    hero.classList.add("out"); skipBtn.classList.add("gone");
    scene.style.animationPlayState = "paused";                 // الزوم البطيء يوگف بمكانه (بلا قفزة)
    loadInside().then(function () {
      return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });   // الضغطة تاخذ إطارها أول
    }).then(function () {
      var G = enterGeom(), te = performance.now();
      lnPrev = 0; ePrev = 0;
      (function step(now) {
        var e = Math.max(0, (now - te) / 1000);
        enterState(e, G);
        render(END);
        signEl.style.opacity = (1 - EN.signA).toFixed(3);      // اللافتة تنتقل من DOM لرسم المحرك الحاد
        if (e >= ENTER_END) {
          try { sessionStorage.setItem("th-enter", "1"); } catch (err) {}
          location.href = CFG.next; return;
        }
        requestAnimationFrame(step);
      })(te);
    });
  }
  document.getElementById("enter").addEventListener("click", enter);
  skipBtn.addEventListener("click", skip);

  // المنيو: ملفات أول طاولة تنزل بهدوء وقت ما الانترو يشتغل، فـ«ادخل» يفتحها فوراً حتى بنت التلفون الضعيف
  function warmMenu() {
    try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) {}
    var M = "assets/menu/", R = M + "room/";
    // (صورة الغوص مو هنا: يحمّلها loadInside() لما تطلع الواجهة)
    [CFG.next, "css/tables.css", "js/tables-data.js", "js/tables.js",
     R + "table_rect.webp", R + "placemat.webp", R + (tall ? "floor_tall.jpg" : "floor_wide.jpg"), R + "table_round.webp",
     M + "pizza/pepperoni.webp", M + "pizza/italiano.webp", M + "pizza/veggie.webp",
     M + "pizza/bianca.webp", R + "disc.webp", M + "dolci/cookies.webp", M + "dolci/brownie.webp"
    ].forEach(function (u, i) {
      setTimeout(function () {
        fetch(u, { priority: "low" }).then(function (r) { return r.blob(); }).catch(function () {});
      }, i * 150);
    });
  }

  /* ---------- التشغيل ---------- */
  status();
  var tall = window.innerWidth / window.innerHeight < 0.9;
  Promise.all([getJSON("assets/intro/rings.json"), getJSON("assets/intro/house.json"), getJSON("assets/intro/logo.json"),
               fetch("assets/intro/logo.svg").then(function (r) { return r.text(); })])
    .then(function (j) {
      rings = j[0]; house = j[1]; logoMeta = j[2];
      var name = tall ? "tall" : "wide"; crop = house.crops[name];
      // الشعار: طبقة أساس (كريمي) + طبقة مضوية بتوهّج (تنشعل بالـ opacity بس)
      signEl.innerHTML = '<div class="s-shade"></div><div class="s-base">' + j[3] + '</div><div class="s-lit"></div>';
      litSvg = j[3];
      signEl.style.width = logoMeta.w + "px";
      litLayer = signEl.querySelector(".s-lit"); shadeEl = signEl.querySelector(".s-shade"); baseLayer = signEl.querySelector(".s-base");
      latinEls = Array.prototype.slice.call(signEl.querySelectorAll(".la"));
      return Promise.all([
        loadImg("assets/intro/rings_f.png"), loadImg("assets/intro/rings_sdf.webp"),
        loadImg("assets/intro/house_" + name + ".jpg"), loadImg("assets/intro/house_" + name + "_off.jpg"),
        loadImg("assets/intro/house_" + name + "_map.png"), loadImg("assets/intro/house_" + name + "_mid.jpg"),
        Promise.all(CFG.leaves.map(function (n) { return loadImg("assets/leaves/" + n + ".webp"); })),
        loadImg("assets/intro/logo_sdf.webp"), loadImg("assets/intro/logo_holes.webp"), loadImg("assets/intro/logo_eye.png")
      ]);
    })
    .then(function (r) {
      img = { lit: r[2], off: r[3], map: r[4], mid: r[5] };
      CORE = [RB[0] + rings.core[0] * (RB[2] - RB[0]), RB[1] + rings.core[1] * (RB[3] - RB[1])];
      bakeSprites(r[6]);
      if (!initGL()) throw new Error("no webgl");
      return bakeLit().then(function () { return r; });
    })
    .then(function (r) {
      tex.f = mkTex(r[0]); tex.s = mkTex(r[1]); tex.ls = mkTex(r[7]); tex.lh = mkTex(r[8]); tex.eye = mkTex(r[9]);
      resize();
      window.addEventListener("resize", resize);
      var seen = false; try { seen = sessionStorage.getItem("th-intro") === "1"; } catch (e) {}
      if (AT !== null) {
        stage.classList.add("ready");
        if (qs.has("en")) {                                    // فحص: لحظة من الدخول
          return loadInside().then(function () {
            var G = enterGeom(), e = parseFloat(qs.get("en"));
            for (var k = 0; k <= 8; k++) enterState(e * k / 8, G);  // حتى الضباب الشعاعي يتحسب من السرعة
            hero.classList.add("on", "out"); skipBtn.classList.add("gone"); render(END);
            signEl.style.opacity = (1 - EN.signA).toFixed(3);
          });
        }
        render(AT); if (AT >= T.hero) { hero.classList.add("on"); skipBtn.classList.add("gone"); } return;
      }
      if (seen && !FORCE) tOffset = END;
      // تسخين: أول رسمة تترجم الـ shader وترفع الصور للكرت، والشعار المضوي والكلام ينرسمون مخفيين،
      // حتى ما يصير أي تقطيع وقت ما يطلعون لأول مرة
      render(tOffset); litLayer.style.opacity = "1"; signEl.style.opacity = "0.002"; hero.classList.add("warm");
      var bx = burstCv.getContext("2d"); sprites.forEach(function (sp) { bx.drawImage(sp, 0, 0); }); bx.clearRect(0, 0, cw, ch);
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        hero.classList.remove("warm"); stage.classList.add("ready"); t0 = performance.now(); requestAnimationFrame(loop);
        setTimeout(warmMenu, 1200);
      }); });
    })
    .catch(function (err) {
      console.warn("intro fallback:", err);
      stage.classList.add("no-gl", "ready");
      document.getElementById("fallback").src = CFG.fallback;
      signEl.style.display = "none";
      hero.classList.add("on"); skipBtn.classList.add("gone");
      setTimeout(warmMenu, 600);
    });
})();
