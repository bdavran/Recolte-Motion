/* =========================================================================
   Récolte: one continuous world, driven by a single unbroken clip.

   The page is a tall track with one pinned stage (as on pear.no). Scroll
   position along the track, measured in viewport-heights, decides:
     - which second of the café walk-through is on screen (one pace for the
       whole film, slower than feels necessary, lerped playhead);
     - how much the footage blurs and dims behind content (depth of field);
     - how far the footage has dissolved, in halftone cells, into linen paper;
     - which chapter is on stage. Chapters never scroll past; they arrive.
   The scrollcraft engine is not mounted on this page: its worldflight mode
   crossfades separate clips, and this film is one clip with a WebGL dissolve.
   ========================================================================= */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var clamp01 = function (v) { return clamp(v, 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
  var easeInOut = function (x) { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  var root = document.documentElement;
  // The system may ask for reduced motion (Windows: Animation effects off). The film is
  // scroll-driven, never autonomous, so the visitor can opt in; the choice is remembered.
  var sysReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionPref = null;
  try { motionPref = localStorage.getItem('recolte-motion'); } catch (e) {}
  // The film and the full flow play by default (the film only moves when the visitor
  // scrolls). The 'Reduce motion' toggle turns them off and is remembered.
  var reduce = motionPref === 'reduced';
  var calm = false;   // the full flow (inertia, cursor, text blur) for everyone; the toggle turns motion off
  root.classList.toggle('is-reduced', reduce || calm);
  root.classList.toggle('sys-reduce', sysReduce);
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce && !calm;
  $$('[data-motion]').forEach(function (b) {
    b.setAttribute('aria-pressed', reduce ? 'false' : 'true');
    b.textContent = reduce ? b.getAttribute('data-on') : b.getAttribute('data-off');
    b.addEventListener('click', function () {
      try { localStorage.setItem('recolte-motion', reduce ? 'full' : 'reduced'); } catch (e) {}
      location.reload();
    });
  });
  var small = matchMedia('(max-width: 860px)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;

  var isTR = (root.getAttribute('lang') || '').slice(0, 2) === 'tr';
  var L = isTR ? {
    phases: ['Şarj', 'Dönüş noktası', 'Kuruma', 'Sararma', 'Maillard', 'İlk çatlama', 'Gelişim', 'Boşaltma'],
    pause: 'Duraklat', again: 'Yeniden demle', along: 'Birlikte demle',
    notesOpen: 'Notları kapat', notes: 'Tadım notları', add: 'Sepete ekle', added: 'Eklendi',
    fewer: 'Bir azalt', more: 'Bir artır', soundOn: 'Ses açık', soundOff: 'Ses kapalı'
  } : {
    phases: ['Charge', 'Turning point', 'Drying', 'Yellowing', 'Maillard', 'First crack', 'Development', 'Drop'],
    pause: 'Pause', again: 'Brew again', along: 'Brew along',
    notesOpen: 'Close notes', notes: 'Cupping notes', add: 'Add to bag', added: 'Added',
    fewer: 'One fewer', more: 'One more', soundOn: 'Sound on', soundOff: 'Sound off'
  };

  /* ---------------------------------------------------------------------
     0. The track. One pace for the whole film; one paper interlude where
        the footage has dissolved away and the clock can stop unseen.
     --------------------------------------------------------------------- */
  var DUR = 25.04;
  var PACE = 1.1;                 // viewport-heights of scroll per second of film
  var PAPER_IN = 18.7, PAPER_OUT = 21.9, PAPER_T = PAPER_IN / PACE;   // 17.0 s
  var END = PAPER_OUT + (DUR - PAPER_T) * PACE;                        // ~30.7 vh
  function filmTime(v) {
    if (v <= PAPER_IN) return clamp(v / PACE, 0, DUR);
    if (v <= PAPER_OUT) return PAPER_T;
    return clamp(PAPER_T + (v - PAPER_OUT) / PACE, 0, DUR);
  }
  // keyframed effects, piecewise linear over track position
  var FX = {
    blur: [[0, 0], [7.3, 0], [8.2, 9], [11.9, 9], [12.7, 0], [22.5, 0], [23.1, 5], [25.8, 5], [26.3, 0]],
    dim: [[0, 0], [7.3, 0], [8.2, 0.4], [11.9, 0.4], [12.7, 0], [12.9, 0], [13.3, 0.12], [18.2, 0.12], [18.6, 0], [22.4, 0], [23.0, 0.48], [25.8, 0.48], [26.3, 0], [26.8, 0], [27.6, 0.3], [99, 0.3]],
    dis: [[0, 0], [18.25, 0], [18.75, 1], [21.85, 1], [22.35, 0], [99, 0]]
  };
  function fx(keys, v) {
    if (v <= keys[0][0]) return keys[0][1];
    for (var i = 0; i < keys.length - 1; i++) {
      if (v <= keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], smooth((v - keys[i][0]) / (keys[i + 1][0] - keys[i][0])));
    }
    return keys[keys.length - 1][1];
  }

  var world = $('[data-world]');
  var pin = $('.world__pin');
  var win = $('[data-arch]');
  var slot = $('[data-arch-slot]');
  var hero = $('[data-hero]');
  var light = $('.world__light');
  var canvas = $('[data-gl]');
  var video = $('[data-film]');
  var tcEl = $('[data-tc]');
  var stillsWrap = $('.world__stills');
  var paperEl = $('.world__paper');
  var VH = innerHeight, VW = innerWidth, worldTop = 0;
  var slotBox = { t: 0, r: 0, b: 0, l: 0, w: 1 };

  var chapters = $$('[data-win]').map(function (el) {
    var w = el.getAttribute('data-win').split(/\s+/).map(parseFloat);
    return { el: el, a: w[0], b: w[1], c: w[2], d: w[3], shade: (el.getAttribute('data-shade') || '').split(/\s+/).filter(Boolean), o: -1, hot: null, big: el.matches('.ch--origins, .ch--club, .ch--brew, .ch--visit') };
  });
  var shades = {};
  $$('[data-shade-layer]').forEach(function (el) { shades[el.getAttribute('data-shade-layer')] = el; });

  // where each chapter is fully on stage: the target for in-page links
  var GO = { film: 0 };
  chapters.forEach(function (c) { if (c.el.id) GO[c.el.id] = c.b + 0.05; });

  function measure() {
    var w = innerWidth, h = innerHeight;
    // a phone's toolbar resizes the viewport; only a real resize re-rulers the track
    if (w !== VW || Math.abs(h - VH) > 150 || !world.style.height) { VW = w; VH = h; }
    world.style.height = Math.round((END + 1) * VH) + 'px';
    worldTop = world.getBoundingClientRect().top + scrollY;
    var s = slot.getBoundingClientRect(), st = pin.getBoundingClientRect();
    slotBox = { t: s.top - st.top, l: s.left - st.left, r: st.right - s.right, b: st.bottom - s.bottom, w: s.width };
    railOverflow = rail ? Math.max(0, rail.scrollWidth - pin.clientWidth) : 0;
    layoutDirty = true;
    if (gl) sizeCanvas();
  }

  /* ---------------------------------------------------------------------
     1. The film: a hidden <video> decoded into a WebGL texture
     --------------------------------------------------------------------- */
  var gl = null, glp = null, tex = null, U = {};
  var texSize = [0, 0], dirty = true;
  var stills = $$('img', stillsWrap).map(function (img) { return { img: img, at: parseFloat(img.getAttribute('data-at')), on: false }; });
  var still = null;
  var film = { ready: false, primed: false, painted: false, cur: 0, target: 0, lastUp: -1 };
  var layoutDirty = true;

  var VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uTexSize; uniform vec2 uFocus;',
    'uniform float uZoom; uniform float uBlur; uniform float uDim; uniform float uDis; uniform float uTime; uniform float uGrain; uniform float uDpr;',
    'uniform vec3 uPaper;',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'vec2 cover(vec2 uv, out vec2 s){',
    '  float ra = uRes.x / uRes.y; float rt = uTexSize.x / uTexSize.y;',
    '  s = ra > rt ? vec2(1.0, rt / ra) : vec2(ra / rt, 1.0);',
    '  s /= uZoom;',
    '  return (vec2(1.0) - s) * uFocus + uv * s;',
    '}',
    'void main(){',
    '  vec2 s; vec2 uv = cover(vUv, s);',
    '  vec3 col;',
    '  if (uBlur < 0.05) { col = texture2D(uTex, uv).rgb; }',
    '  else {',
    '    vec3 acc = vec3(0.0);',
    '    vec2 rad = uBlur * uDpr / uRes * s;',
    '    for (int i = 0; i < 8; i++) {',
    '      float fi = float(i); float r = sqrt((fi + 0.5) / 8.0); float a = fi * 2.39996;',
    '      acc += texture2D(uTex, uv + vec2(cos(a), sin(a)) * r * rad).rgb;',
    '    }',
    '    col = acc / 8.0;',
    '  }',
    '  col *= 1.0 - uDim;',
    '  if (uDis > 0.001) {',
    '    float cellPx = 9.0 * uDpr;',
    '    vec2 cell = floor(gl_FragCoord.xy / cellPx);',
    '    vec2 cp = fract(gl_FragCoord.xy / cellPx) - 0.5;',
    '    vec2 c = (cell * cellPx + 0.5 * cellPx) / uRes - 0.5; c.x *= uRes.x / uRes.y;',
    '    float d = length(c) / (0.5 * length(vec2(uRes.x / uRes.y, 1.0)));',
    '    float field = d * 0.7 + hash(cell) * 0.3;',
    '    float t = uDis * 1.2 - 0.1;',
    '    float k = clamp((t - field) / 0.18 + 0.5, 0.0, 1.0);',
    '    float m = k >= 0.999 ? 1.0 : step(length(cp), k * 0.72);',
    '    col = mix(col, uPaper, m);',
    '  }',
    '  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function initGL() {
    if (reduce || !canvas) return false;
    try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return false;
    var sh = function (type, src) {
      var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; }
      return o;
    };
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { gl = null; return false; }
    glp = gl.createProgram(); gl.attachShader(glp, vs); gl.attachShader(glp, fs); gl.linkProgram(glp);
    if (!gl.getProgramParameter(glp, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(glp);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(glp, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uTex', 'uRes', 'uTexSize', 'uFocus', 'uZoom', 'uBlur', 'uDim', 'uDis', 'uTime', 'uGrain', 'uDpr', 'uPaper'].forEach(function (n) { U[n] = gl.getUniformLocation(glp, n); });
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([34, 27, 21]));
    gl.uniform1i(U.uTex, 0);
    gl.uniform3f(U.uPaper, 240 / 255, 233 / 255, 223 / 255);
    gl.uniform2f(U.uFocus, 0.46, 0.5);
    gl.uniform2f(U.uTexSize, 16, 9);
    gl.uniform1f(U.uGrain, 0.028);
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.classList.add('no-gl'); gl = null; });
    sizeCanvas();
    return true;
  }
  function sizeCanvas() {
    var scale = Math.min(window.devicePixelRatio || 1, 1.5,
      Math.sqrt(1920 * 1080 / Math.max(1, pin.clientWidth * pin.clientHeight)));
    var w = Math.max(1, Math.round(pin.clientWidth * scale)), h = Math.max(1, Math.round(pin.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uDpr, scale);
    dirty = true;
  }
  function upload(src, w, h) {
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (w && h && (w !== texSize[0] || h !== texSize[1])) { texSize = [w, h]; gl.uniform2f(U.uTexSize, w, h); }
      dirty = true;
      return true;
    } catch (e) { return false; }
  }

  function loadFilm() {
    if (reduce || !video) return;
    var src = (small || coarse) ? video.getAttribute('data-src-mobile') : video.getAttribute('data-src');
    fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (blob) {
      video.addEventListener('loadedmetadata', function () {
        film.ready = true;
        prime();
        try { video.currentTime = Math.max(film.cur, 0.001); } catch (e) {}
      }, { once: true });
      video.addEventListener('seeked', function () { film.painted = true; dirty = true; film.lastUp = -1; });
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.src = URL.createObjectURL(blob);
    }).catch(function () { /* stills carry the film */ });
  }
  // iOS keeps a seeked-but-never-played video blank; one muted play primes the decoder
  function prime() {
    if (film.primed || !film.ready) return;
    var p = video.play();
    if (p && p.then) p.then(function () { video.pause(); film.primed = true; }).catch(function () {});
    else { video.pause(); film.primed = true; }
  }
  ['touchstart', 'pointerdown', 'keydown', 'wheel'].forEach(function (ev) { addEventListener(ev, prime, { passive: true, once: false }); });

  function pickStill(t) {
    var pick = stills[0];
    stills.forEach(function (s) { if (t >= s.at) pick = s; });
    return pick;
  }

  function filmFrame(v) {
    // playhead: scroll writes a target, the frame loop walks toward it
    film.target = filmTime(v);
    film.cur = reduce ? film.target : lerp(film.cur, film.target, 0.14);
    if (Math.abs(film.cur - film.target) < 0.0005) film.cur = film.target;
    // Once the clip has painted it owns the texture for good. During a seek the decoder
    // drops to HAVE_METADATA for a moment; falling back to a still there flashed a frame
    // from a different second at every scene boundary. Hold the last real frame instead.
    if (gl) {
      if (film.painted) {
        if (video.readyState >= 2 && !video.seeking && video.currentTime !== film.lastUp) {
          if (upload(video, video.videoWidth, video.videoHeight)) film.lastUp = video.currentTime;
        }
      } else {
        var s = pickStill(film.cur);
        if (s !== still && s.img.complete && s.img.naturalWidth) {
          if (upload(s.img, s.img.naturalWidth, s.img.naturalHeight)) still = s;
        }
      }
    } else {
      var p = pickStill(film.cur);
      stills.forEach(function (s) {
        var on = s === p;
        if (on !== s.on) { s.on = on; s.img.style.opacity = on ? '1' : '0'; }
      });
    }
    // Present the completed seek before starting another one. Setting currentTime
    // immediately makes the decoder unavailable for the next texture upload.
    // Both encodes are 24 fps. Seek to a frame centre so rounding in the
    // media clock cannot land just before the intended frame boundary.
    if (film.ready && !video.seeking) {
      var frameIndex = Math.min(Math.floor(film.cur * 24), Math.ceil(DUR * 24) - 1);
      var seekTime = Math.min((frameIndex + 0.5) / 24, video.duration - 0.001);
      if (Math.floor(video.currentTime * 24) !== frameIndex) {
        try { video.currentTime = seekTime; } catch (e) {}
      }
    }
    return film.cur;
  }

  /* ---------------------------------------------------------------------
     2. The threshold: an arch on linen that opens to the full frame
     --------------------------------------------------------------------- */
  var heroGone = false;
  function archFrame(v) {
    var e = clamp01(v / (small ? 0.85 : 1.0));
    var ee = easeInOut(e), k = 1 - ee;
    var t = slotBox.t * k, r = slotBox.r * k, b = slotBox.b * k, l = slotBox.l * k;
    var curW = VW - r - l;
    var rad = Math.max(0, (Math.min(slotBox.w, curW) / 2) * Math.pow(k, 0.85));
    win.style.setProperty('--arch', ee >= 0.999 ? 'inset(0)' : 'inset(' + t.toFixed(1) + 'px ' + r.toFixed(1) + 'px ' + b.toFixed(1) + 'px ' + l.toFixed(1) + 'px round ' + rad.toFixed(1) + 'px ' + rad.toFixed(1) + 'px 0 0)');
    var ho = 1 - clamp01(e * 1.7);
    hero.style.setProperty('--hero-o', ho.toFixed(3));
    hero.style.setProperty('--hero-y', (-60 * e).toFixed(1) + 'px');
    if (!reduce && !calm) hero.style.setProperty('--hero-b', (e * 7).toFixed(2) + 'px');
    var gone = ho < 0.04;
    if (gone !== heroGone) { heroGone = gone; hero.inert = gone; hero.classList.toggle('is-gone', gone); }
    if (light) light.style.setProperty('--light-o', (0.85 * (1 - ee)).toFixed(3));
    return { e: e, ee: ee, zoom: reduce ? 1 : 1 + 0.14 * k };
  }

  /* ---------------------------------------------------------------------
     3. Chapters arrive inside the stage: blur to sharp, no block scrolls
     --------------------------------------------------------------------- */
  function chapterFrame(v) {
    var sh = {};
    chapters.forEach(function (c) {
      var inn = c.b > c.a ? smooth((v - c.a) / (c.b - c.a)) : (v >= c.a ? 1 : 0);
      var out = c.d > c.c ? smooth((v - c.c) / (c.d - c.c)) : (v >= c.c ? 1 : 0);
      var o = inn * (1 - out);
      c.shade.forEach(function (n) { sh[n] = Math.max(sh[n] || 0, o); });
      if (Math.abs(o - c.o) < 0.002) return;
      c.o = o;
      c.el.style.opacity = o.toFixed(3);
      if (!reduce && !calm) {
        // big interactive panels fade without a filter; only text chapters resolve from blur
        // copy travels at most 2vh either side: a layer over a moving world, never a second page
        var y = out > 0 ? -out * 0.02 * VH : (1 - inn) * 0.02 * VH;
        c.el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
        if (!c.big) c.el.style.filter = o > 0.995 ? 'none' : 'blur(' + ((1 - o) * 10).toFixed(2) + 'px)';
      }
      c.el.classList.toggle('is-live', o > 0.01);
      var hot = o > 0.5;
      if (hot !== c.hot) { c.hot = hot; c.el.classList.toggle('is-hot', hot); }
    });
    Object.keys(shades).forEach(function (n) { shades[n].style.opacity = (sh[n] || 0).toFixed(3); });
  }

  /* ---------------------------------------------------------------------
     4. Origins: the rail travels while the bar blurs behind it
     --------------------------------------------------------------------- */
  var rail = $('[data-rail]');
  var railWin = rail ? $('#origins') : null;
  var railRange = railWin ? railWin.getAttribute('data-rail-range').split(/\s+/).map(parseFloat) : [0, 1];
  var railX = -1, railOverflow = 0;
  function railFrame(v) {
    if (!rail) return;
    var p = smooth((v - railRange[0]) / (railRange[1] - railRange[0]));
    var x = Math.round(-railOverflow * p * 10) / 10;
    if (x !== railX) { railX = x; rail.style.transform = 'translate3d(' + x + 'px,0,0)'; }
  }

  /* ---------------------------------------------------------------------
     5. Signature move: the roast instrument
     --------------------------------------------------------------------- */
  var roast = $('[data-roast]');
  var BT = function (m) { return 68 + 132 * Math.exp(-3 * m) + 179 * (1 - Math.exp(-0.15 * m)); };
  var R = { W: 240, H: 84, M: 10.5, T0: 60, T1: 230 };
  var rx = function (m) { return (m / R.M) * R.W; };
  var ry = function (T) { return R.H - ((T - R.T0) / (R.T1 - R.T0)) * R.H; };
  var phases = [0, 0.8, 1.8, 4.5, 6.5, 8.5, 9.25, 10].map(function (m, i) { return [m, L.phases[i]]; });
  var marks = $$('[data-roast-marks] a');
  var navLinks = $$('.bar__nav a');
  var rEls = roast && { bt: $('[data-roast-bt]', roast), time: $('[data-roast-time]', roast), phase: $('[data-roast-phase]', roast), clip: $('[data-roast-clip]', roast), head: $('[data-roast-head]', roast) };
  var lastRoast = { bt: '', time: '', phase: '', now: -1 };
  var anchors = marks.map(function (a) {
    var id = a.getAttribute('data-target'), el = document.getElementById(id);
    return { m: parseFloat(a.getAttribute('data-mark')), v: id === 'film' ? 0 : (el ? parseFloat(el.getAttribute('data-win').split(/\s+/)[0]) : 0), id: id };
  });
  if (roast) {
    var d = '';
    for (var i = 0; i <= 120; i++) { var mm0 = (i / 120) * R.M; d += (i ? 'L' : 'M') + rx(mm0).toFixed(2) + ' ' + ry(BT(mm0)).toFixed(2); }
    $('[data-roast-ghost]', roast).setAttribute('d', d);
    $('[data-roast-live]', roast).setAttribute('d', d);
    marks.forEach(function (a) {
      var mm = parseFloat(a.getAttribute('data-mark'));
      a.parentNode.style.setProperty('--x', (rx(mm) / R.W).toFixed(4));
      a.parentNode.style.setProperty('--y', (ry(BT(mm)) / R.H).toFixed(4));
    });
    if (small) roast.addEventListener('click', function () { openSheet(menuDlg); });
  }
  function roastFrame(v) {
    if (!roast) return;
    var m = 0, now = 0, last = anchors.length - 1;
    if (v >= anchors[last].v) { m = anchors[last].m; now = last; }
    else {
      for (var i = 0; i < last; i++) {
        if (v >= anchors[i].v && v < anchors[i + 1].v) { m = lerp(anchors[i].m, anchors[i + 1].m, (v - anchors[i].v) / (anchors[i + 1].v - anchors[i].v)); now = i; break; }
      }
    }
    var T = BT(m);
    rEls.clip.setAttribute('width', rx(m).toFixed(2));
    rEls.head.setAttribute('cx', rx(m).toFixed(2));
    rEls.head.setAttribute('cy', ry(T).toFixed(2));
    var bt = T.toFixed(1);
    if (bt !== lastRoast.bt) { rEls.bt.textContent = bt; lastRoast.bt = bt; }
    var secs = Math.round(m * 60), tt = ('0' + Math.floor(secs / 60)).slice(-2) + ':' + ('0' + (secs % 60)).slice(-2);
    if (tt !== lastRoast.time) { rEls.time.textContent = tt; lastRoast.time = tt; }
    var ph = phases[0][1];
    phases.forEach(function (p) { if (m >= p[0] - 0.001) ph = p[1]; });
    if (ph !== lastRoast.phase) { rEls.phase.textContent = ph; lastRoast.phase = ph; }
    if (now !== lastRoast.now) {
      lastRoast.now = now;
      marks.forEach(function (a, j) {
        a.classList.toggle('is-past', j < now);
        a.classList.toggle('is-now', j === now);
        if (j === now) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      navLinks.forEach(function (a) {
        if (a.getAttribute('href') === '#' + anchors[now].id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
  }

  /* ---------------------------------------------------------------------
     6. Brew guide: the track (or real time) runs the recipe
     --------------------------------------------------------------------- */
  var RECIPES_EN = {
    v60: { total: 180,
      rows: [['coffee', '15 g, medium-fine'], ['water', '250 g at 93 °C'], ['ratio', '1 : 16.7'], ['time', 'about 3:00']],
      keys: [[0, 0], [10, 45], [45, 45], [70, 150], [75, 150], [100, 250], [180, 250]],
      steps: [[0, 'Bloom with 45 g. Swirl so every ground is wet.'], [45, 'Pour in slow circles to 150 g.'], [75, 'Pour to 250 g, staying off the paper.'], [105, 'One gentle swirl to flatten the bed.'], [180, 'Drawdown ends near 3:00. Taste it warm, then cooler.']],
      pair: 'Try it with <b>Rwanda Red Bourbon</b>: tangerine and green tea open up in a light cone.' },
    chemex: { total: 240,
      rows: [['coffee', '30 g, medium-coarse'], ['water', '500 g at 94 °C'], ['ratio', '1 : 16.7'], ['time', 'about 4:00']],
      keys: [[0, 0], [12, 60], [45, 60], [80, 250], [90, 250], [125, 400], [135, 400], [160, 500], [240, 500]],
      steps: [[0, 'Rinse the paper, then bloom with 60 g.'], [45, 'Pour to 250 g, centre outwards.'], [90, 'Pour to 400 g and let it settle.'], [135, 'Finish at 500 g.'], [240, 'Drawdown ends near 4:00. Lift the filter and swirl.']],
      pair: 'Try it with <b>Colombia Supremo Medellín</b>: the thick paper keeps green apple bright and clean.' },
    espresso: { total: 30,
      rows: [['dose', '18 g, fine'], ['yield', '36 g'], ['ratio', '1 : 2'], ['water', '93 °C, 27 to 30 s']],
      keys: [[0, 0], [6, 0], [28, 36], [30, 36]],
      steps: [[0, 'Level, tamp and start the shot.'], [6, 'First drops, the colour of honey.'], [16, 'A steady stream, tiger-striped.'], [28, 'Stop at 36 g. Stir the crema in.']],
      pair: 'Try it with <b>Ember Africa Pasific</b>: cocoa and nuts, made for the classic double.' }
  };
  var RECIPES_TR = {
    v60: { total: 180,
      rows: [['kahve', '15 g, orta-ince'], ['su', '250 g, 93 °C'], ['oran', '1 : 16.7'], ['süre', 'yaklaşık 3:00']],
      keys: RECIPES_EN.v60.keys,
      steps: [[0, '45 g ile demlendirin. Tüm telve ıslansın diye hafifçe çevirin.'], [45, 'Yavaş dairelerle 150 g\'a kadar dökün.'], [75, 'Kâğıda değdirmeden 250 g\'a tamamlayın.'], [105, 'Yatağı düzlemek için bir kez nazikçe çevirin.'], [180, 'Süzülme 3:00 civarında biter. Önce sıcak, sonra ılık tadın.']],
      pair: '<b>Rwanda Red Bourbon</b> ile deneyin: mandalina ve yeşil çay açık bir konide öne çıkar.' },
    chemex: { total: 240,
      rows: [['kahve', '30 g, orta-kalın'], ['su', '500 g, 94 °C'], ['oran', '1 : 16.7'], ['süre', 'yaklaşık 4:00']],
      keys: RECIPES_EN.chemex.keys,
      steps: [[0, 'Kâğıdı ıslatın, ardından 60 g ile demlendirin.'], [45, 'Merkezden dışa doğru 250 g\'a dökün.'], [90, '400 g\'a dökün ve oturmasını bekleyin.'], [135, '500 g\'da bitirin.'], [240, 'Süzülme 4:00 civarında biter. Filtreyi kaldırıp çevirin.']],
      pair: '<b>Colombia Supremo Medellín</b> ile deneyin: kalın kâğıt yeşil elmayı canlı ve berrak tutar.' },
    espresso: { total: 30,
      rows: [['doz', '18 g, ince'], ['verim', '36 g'], ['oran', '1 : 2'], ['su', '93 °C, 27-30 sn']],
      keys: RECIPES_EN.espresso.keys,
      steps: [[0, 'Düzleyin, tamp edin ve shot\'u başlatın.'], [6, 'İlk damlalar, bal renginde.'], [16, 'Kaplan çizgili, düzenli bir akış.'], [28, '36 g\'da durdurun. Kremayı karıştırın.']],
      pair: '<b>Ember Africa Pasific</b> ile deneyin: kakao ve kuruyemiş, klasik double için.' }
  };
  var RECIPES = isTR ? RECIPES_TR : RECIPES_EN;
  var brewEl = $('#brew');
  var brewRange = brewEl ? brewEl.getAttribute('data-brew-range').split(/\s+/).map(parseFloat) : [0, 1];
  var brew = { key: 'v60', t: -1, playing: false, manual: false, start: 0, lastG: '', lastC: '', lastStep: -2 };
  var bEls = brewEl && {
    grams: $('[data-brew-grams]'), clock: $('[data-brew-clock]'), target: $('[data-brew-target]'), fill: $('[data-brew-fill]'),
    recipe: $('[data-brew-recipe]'), steps: $('[data-brew-steps]'), pair: $('[data-brew-pair]'), play: $('[data-brew-play]')
  };
  var tabs = $$('.brew__tabs [role="tab"]');
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function gramsAt(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 0; i < keys.length - 1; i++) if (t <= keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], (t - keys[i][0]) / Math.max(keys[i + 1][0] - keys[i][0], 0.001));
    return keys[keys.length - 1][1];
  }
  function renderRecipe() {
    var r = RECIPES[brew.key];
    bEls.recipe.innerHTML = r.rows.map(function (row) { return '<dt>' + row[0] + '</dt><dd>' + row[1] + '</dd>'; }).join('');
    bEls.steps.innerHTML = r.steps.map(function (s) { return '<li><time>' + mmss(s[0]) + '</time><span>' + s[1] + '</span></li>'; }).join('');
    bEls.pair.innerHTML = r.pair;
    bEls.target.textContent = '/ ' + mmss(r.total);
    brew.lastStep = -2; brew.lastG = ''; brew.lastC = ''; brew.t = -1;
  }
  function setPlaying(on) {
    var r = RECIPES[brew.key];
    brew.playing = on;
    bEls.play.setAttribute('aria-pressed', on ? 'true' : 'false');
    bEls.play.textContent = on ? L.pause : (brew.t >= r.total ? L.again : L.along);
    if (on) brew.start = performance.now() - Math.max(0, brew.t >= r.total ? 0 : brew.t) * 1000;
  }
  function brewFrame(v) {
    if (!brewEl) return;
    var r = RECIPES[brew.key], t;
    if (brew.playing) {
      t = (performance.now() - brew.start) / 1000;
      if (t >= r.total) { t = r.total; brew.t = t; setPlaying(false); }
    } else if (brew.manual) t = brew.t;
    else t = clamp01((v - brewRange[0]) / (brewRange[1] - brewRange[0])) * r.total;
    if (Math.abs(t - brew.t) < 0.01 && brew.lastG !== '') return;
    brew.t = t;
    var g = Math.round(gramsAt(r.keys, t)) + '';
    if (g !== brew.lastG) { bEls.grams.textContent = g; brew.lastG = g; }
    var c = mmss(t);
    if (c !== brew.lastC) { bEls.clock.textContent = c; brew.lastC = c; }
    bEls.fill.style.setProperty('--brew-p', (t / r.total).toFixed(4));
    var idx = -1;
    r.steps.forEach(function (s, i) { if (t >= s[0] - 0.01) idx = i; });
    if (idx !== brew.lastStep) {
      brew.lastStep = idx;
      $$('li', bEls.steps).forEach(function (li, i) { li.classList.toggle('is-done', i < idx); li.classList.toggle('is-now', i === idx); });
    }
  }
  function selectTab(i) {
    tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.tabIndex = j === i ? 0 : -1; });
    brew.key = tabs[i].getAttribute('data-method');
    setPlaying(false); brew.manual = false; renderRecipe(); bEls.play.textContent = L.along;
  }
  if (brewEl) {
    renderRecipe();
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectTab(i); });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          selectTab(n); tabs[n].focus();
        }
      });
    });
    bEls.play.addEventListener('click', function () {
      if (brew.playing) { setPlaying(false); brew.manual = true; return; }
      if (brew.t >= RECIPES[brew.key].total) brew.t = 0;
      brew.manual = true; setPlaying(true);
    });
    var handBack = function () { if (brew.manual && !brew.playing) brew.manual = false; };
    addEventListener('wheel', handBack, { passive: true });
    addEventListener('touchmove', handBack, { passive: true });
  }

  /* ---------------------------------------------------------------------
     7. Origins labels, bag, dialogs, in-page navigation
     --------------------------------------------------------------------- */
  $$('.bean__open').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var bean = btn.closest('.bean'), panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? L.notesOpen : L.notes;
      panel.hidden = !open; bean.classList.toggle('is-open', open);
    });
  });
  var bag = load();
  var bagDlg = $('[data-bag]'), menuDlg = $('[data-menu]');
  function load() { try { return JSON.parse(localStorage.getItem('recolte-bag') || '[]') || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem('recolte-bag', JSON.stringify(bag)); } catch (e) {} }
  var tl = function (n) { try { return '₺' + n.toLocaleString('tr-TR'); } catch (e) { return '₺' + n; } };
  function renderBag() {
    $('[data-bag-count]').textContent = bag.reduce(function (s, i) { return s + i.qty; }, 0);
    var list = $('[data-bag-list]'); list.innerHTML = '';
    bag.forEach(function (item, idx) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="bag__name"></span><span class="meta bag__line"></span><span class="meta">250 g</span>' +
        '<span class="bag__qty"><button type="button" data-q="-1" aria-label="' + L.fewer + '">-</button><span class="meta" aria-live="polite"></span><button type="button" data-q="1" aria-label="' + L.more + '">+</button></span>';
      li.querySelector('.bag__name').textContent = item.name;
      li.querySelector('.bag__line').textContent = tl(item.price * item.qty);
      li.querySelector('.bag__qty .meta').textContent = item.qty;
      $$('button', li).forEach(function (b) {
        b.addEventListener('click', function () { item.qty += parseInt(b.getAttribute('data-q'), 10); if (item.qty <= 0) bag.splice(idx, 1); save(); renderBag(); });
      });
      list.appendChild(li);
    });
    $('[data-bag-empty]').hidden = bag.length > 0;
    $('[data-bag-total]').textContent = tl(bag.reduce(function (s, i) { return s + i.qty * i.price; }, 0));
  }
  $$('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var data = JSON.parse(btn.getAttribute('data-add'));
      var hit = bag.filter(function (i) { return i.id === data.id; })[0];
      if (hit) hit.qty += 1; else bag.push({ id: data.id, name: data.name, price: data.price, qty: 1 });
      save(); renderBag();
      btn.textContent = L.added; btn.classList.add('is-added');
      clearTimeout(btn._t); btn._t = setTimeout(function () { btn.textContent = L.add; btn.classList.remove('is-added'); }, 1600);
    });
  });
  renderBag();

  var lenis = null;
  function openSheet(dlg) { if (!dlg || dlg.open) return; dlg.showModal(); if (lenis) lenis.stop(); }
  [bagDlg, menuDlg].forEach(function (dlg) {
    if (!dlg) return;
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $$('[data-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  });
  $('[data-bag-open]').addEventListener('click', function () { openSheet(bagDlg); });
  $('[data-menu-open]').addEventListener('click', function () { openSheet(menuDlg); });

  function goTo(id) {
    if (!(id in GO)) return false;
    var y = worldTop + GO[id] * VH;
    if (lenis) lenis.scrollTo(y, { duration: 2.2, easing: function (x) { return 1 - Math.pow(1 - x, 4); } });
    else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    var target = document.getElementById(id);
    if (target && id !== 'film') {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      setTimeout(function () { target.focus({ preventScroll: true }); }, reduce ? 50 : 1400);
    }
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!(id in GO)) return;
    e.preventDefault();
    [bagDlg, menuDlg].forEach(function (dd) { if (dd && dd.open) dd.close(); });
    goTo(id);
    history.replaceState(null, '', '#' + id);
  });

  /* ---------------------------------------------------------------------
     8. Subscription configurator
     --------------------------------------------------------------------- */
  var club = $('[data-club]');
  if (club) {
    var grindTouched = false;
    var defaults = { filter: 'v60', espresso: 'espresso', both: 'whole' };
    club.grind.addEventListener('change', function () { grindTouched = true; });
    var update = function (e) {
      var f = club, method = f.method.value, bags = parseInt(f.bags.value, 10), every = parseInt(f.every.value, 10);
      if (e && e.target && e.target.name === 'method' && !grindTouched) f.grind.value = defaults[method];
      var g = bags * 250, dose = method === 'filter' ? 15 : method === 'espresso' ? 18 : 16.5;
      var cups = Math.floor(g / dose), monthly = every === 2 ? g * 2 : g, s, math;
      if (isTR) {
        var cTR = { 1: 'bir paket', 2: 'iki paket', 3: 'üç paket' };
        var mTR = { filter: 'filtre kavrum', espresso: 'espresso kavrum', both: 'filtre ve espresso kavrum' };
        var gTR = { whole: 'çekirdek halinde', v60: 'V60 için öğütülmüş', chemex: 'Chemex için öğütülmüş', espresso: 'espresso için öğütülmüş', press: 'French press için öğütülmüş' };
        var nf = function (n) { return n.toLocaleString('tr-TR'); };
        s = (every === 2 ? 'İki haftada bir' : 'Ayda bir') + ', ' + gTR[f.grind.value] + ' ' + cTR[bags] + ' ' + mTR[method] + (f.surprise.checked ? ', sürpriz harman da dahil.' : '.');
        math = 'Her teslimatta ' + nf(g) + ' g, ' + nf(dose) + ' g ile yaklaşık ' + cups + (method === 'espresso' ? ' double' : ' fincan') + '. Ayda ' + nf(monthly) + ' g.';
      } else {
        var words = { 1: 'One bag', 2: 'Two bags', 3: 'Three bags' };
        var mEN = { filter: 'filter roasts', espresso: 'espresso roasts', both: 'filter and espresso roasts' };
        var gEN = { whole: 'as whole beans', v60: 'ground for V60', chemex: 'ground for Chemex', espresso: 'ground for espresso', press: 'ground for French press' };
        s = words[bags] + ' of ' + mEN[method] + ' ' + (every === 2 ? 'every two weeks' : 'every month') + ', ' + gEN[f.grind.value] + (f.surprise.checked ? ', with the surprise blend.' : '.');
        math = g.toLocaleString('en-US') + ' g per delivery, about ' + cups + (method === 'espresso' ? ' doubles' : ' cups') + ' at ' + dose + ' g. ' + monthly.toLocaleString('en-US') + ' g a month.';
      }
      $('[data-club-sentence]').textContent = s;
      $('[data-club-math]').textContent = math;
    };
    club.addEventListener('change', update);
    update();
  }

  /* ---------------------------------------------------------------------
     9. Cursor and magnetism (fine pointers, motion allowed)
     --------------------------------------------------------------------- */
  var cursor = $('.cursor'), ring = $('.cursor__ring'), dot = $('.cursor__dot');
  var ptr = { x: -100, y: -100, rx: -100, ry: -100, seen: false };
  var magnets = $$('[data-magnetic]').concat(marks).map(function (el) { return { el: el, x: 0, y: 0 }; });
  if (fine) {
    root.classList.add('has-cursor');
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      if (!ptr.seen) { ptr.seen = true; ptr.rx = ptr.x; ptr.ry = ptr.y; }
      var hot = e.target.closest && e.target.closest('a, button, label, select, [role="tab"], .bean');
      cursor.classList.toggle('is-hot', !!hot); cursor.classList.remove('is-off');
    }, { passive: true });
    addEventListener('pointerdown', function () { cursor.classList.add('is-down'); });
    addEventListener('pointerup', function () { cursor.classList.remove('is-down'); });
    document.addEventListener('mouseleave', function () { cursor.classList.add('is-off'); });
  }
  function pointerFrame() {
    if (!fine || !ptr.seen) return;
    ptr.rx = lerp(ptr.rx, ptr.x, 0.2); ptr.ry = lerp(ptr.ry, ptr.y, 0.2);
    dot.style.transform = 'translate3d(' + ptr.x + 'px,' + ptr.y + 'px,0)';
    ring.style.transform = 'translate3d(' + ptr.rx.toFixed(1) + 'px,' + ptr.ry.toFixed(1) + 'px,0)';
    magnets.forEach(function (m) {
      var r = m.el.getBoundingClientRect();
      if (!r.width) return;
      var cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y, dx = ptr.x - cx, dy = ptr.y - cy;
      var reach = Math.max(r.width, r.height) * 0.5 + 44, dist = Math.hypot(dx, dy), tx = 0, ty = 0;
      if (dist < reach) { var f = (1 - dist / reach) * 0.42; tx = dx * f; ty = dy * f; }
      m.x = lerp(m.x, tx, 0.18); m.y = lerp(m.y, ty, 0.18);
      if (Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && tx === 0) { if (m.el.style.transform) m.el.style.transform = ''; m.x = 0; m.y = 0; return; }
      m.el.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,' + m.y.toFixed(2) + 'px,0)';
    });
  }

  /* ---------------------------------------------------------------------
     10. Ambient café sound (opt-in, generated, never autoplayed)
     --------------------------------------------------------------------- */
  var soundBtns = $$('[data-sound]'), audio = null;
  function buildAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC(), master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    var sr = ctx.sampleRate, len = sr * 6;
    var bBuf = ctx.createBuffer(2, len, sr);
    for (var c = 0; c < 2; c++) { var ch = bBuf.getChannelData(c), last = 0; for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.2; } }
    var room = ctx.createBufferSource(); room.buffer = bBuf; room.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    var roomG = ctx.createGain(); roomG.gain.value = 0.5;
    room.connect(lp).connect(roomG).connect(master); room.start();
    var wBuf = ctx.createBuffer(1, len, sr), wc = wBuf.getChannelData(0);
    for (var j = 0; j < len; j++) wc[j] = Math.random() * 2 - 1;
    var mur = ctx.createBufferSource(); mur.buffer = wBuf; mur.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.8;
    var murG = ctx.createGain(); murG.gain.value = 0.05;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    var lfoG = ctx.createGain(); lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(murG.gain); lfo.start();
    mur.connect(bp).connect(murG).connect(master); mur.start();
    function clink() {
      if (!audio || !audio.on) return;
      var now = ctx.currentTime, f = 2100 + Math.random() * 1500;
      var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, out = ctx.createGain(); out.gain.value = 0.5 + Math.random() * 0.5;
      if (pan) { pan.pan.value = Math.random() * 1.2 - 0.6; out.connect(pan).connect(master); } else out.connect(master);
      [[1, 0.035, 0.55], [2.76, 0.014, 0.28], [5.4, 0.006, 0.14]].forEach(function (p) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
        g.gain.setValueAtTime(p[1], now); g.gain.exponentialRampToValueAtTime(0.0001, now + p[2]);
        o.connect(g).connect(out); o.start(now); o.stop(now + p[2] + 0.05);
      });
      audio.timer = setTimeout(clink, 1800 + Math.random() * 5200);
    }
    return { ctx: ctx, master: master, on: false, timer: 0, clink: clink };
  }
  function setSound(on) {
    if (!audio) audio = buildAudio();
    if (!audio) return;
    var ctx = audio.ctx, now = ctx.currentTime;
    audio.on = on;
    soundBtns.forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); $('[data-sound-label]', b).textContent = on ? L.soundOn : L.soundOff; });
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setValueAtTime(Math.max(audio.master.gain.value, 0.0001), now);
    if (on) { ctx.resume(); audio.master.gain.exponentialRampToValueAtTime(0.6, now + 1.6); clearTimeout(audio.timer); audio.timer = setTimeout(audio.clink, 900); }
    else { audio.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6); clearTimeout(audio.timer); setTimeout(function () { if (!audio.on) ctx.suspend(); }, 700); }
  }
  soundBtns.forEach(function (b) { b.addEventListener('click', function () { setSound(!(audio && audio.on)); }); });
  document.addEventListener('visibilitychange', function () {
    if (!audio || !audio.on) return;
    if (document.hidden) audio.ctx.suspend(); else audio.ctx.resume();
  });

  /* ---------------------------------------------------------------------
     11. Mount and the one loop
     --------------------------------------------------------------------- */
  if (!initGL()) root.classList.add('no-gl');
  if (fine && window.Lenis) { lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.85 }); root.classList.add('lenis'); }
  measure();
  loadFilm();

  var grain = $('.sc-grain'), lastY = -1, vel = 0, lastVelText = '', lastBar = '', lastTc = '', time0 = performance.now();
  var lastV = -1, arch;
  function frame(now) {
    if (lenis) lenis.raf(now);
    var y = scrollY;
    var v = Math.max(0, (y - worldTop) / VH);
    var sceneChanged = layoutDirty || v !== lastV;
    if (sceneChanged) arch = archFrame(v);
    var t = filmFrame(v);
    var blur = reduce ? 0 : fx(FX.blur, v), dim = fx(FX.dim, v), dis = fx(FX.dis, v);
    if (gl && (sceneChanged || dirty)) {
      dirty = false;
      gl.uniform1f(U.uZoom, arch.zoom);
      gl.uniform1f(U.uBlur, blur);
      gl.uniform1f(U.uDim, dim);
      gl.uniform1f(U.uDis, dis);
      gl.uniform1f(U.uTime, ((now - time0) / 1000) % 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (!gl) {
      paperEl.style.opacity = dis.toFixed(3);
      stillsWrap.style.filter = dim > 0.01 ? 'brightness(' + (1 - dim).toFixed(3) + ')' : '';
    }
    if (sceneChanged) {
      chapterFrame(v);
      railFrame(v);
      roastFrame(v);
      lastV = v;
      layoutDirty = false;
    }
    brewFrame(v);
    pointerFrame();

    var tc = (t < 10 ? '0' : '') + Math.floor(t) + '.' + Math.floor((t % 1) * 10);
    if (tc !== lastTc && tcEl) { tcEl.textContent = '00:' + tc; lastTc = tc; }
    pin.style.setProperty('--code-o', arch.ee > 0.96 && (v < 7.3 || (v > 12.8 && v < 18.2)) ? '1' : '0');
    var bar = (arch.ee < 0.55 || dis > 0.5) ? 'light' : 'dark';
    if (bar !== lastBar) { lastBar = bar; root.setAttribute('data-bar', bar); }

    vel = lerp(vel, clamp01(Math.abs(y - (lastY < 0 ? y : lastY)) / 60), 0.12); lastY = y;
    var vt = reduce ? '0' : vel.toFixed(2);
    if (vt !== lastVelText && grain) { grain.style.setProperty('--vel', vt); lastVelText = vt; }
    requestAnimationFrame(frame);
  }
  var rt = 0;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if (location.hash && location.hash.slice(1) in GO) setTimeout(function () { goTo(location.hash.slice(1)); }, 300);
  requestAnimationFrame(frame);
})();
