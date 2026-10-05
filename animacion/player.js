(function () {
  'use strict';

  // Páginas del recorrido (rutas del blog, servidas por el proxy local → mismo origen)
  var PAGES = [
    { src: '/', label: 'Inicio' },
    { src: '/writeups/', label: 'Write-ups' },
    { src: '/herramientas/', label: 'Herramientas' },
    { src: '/roadmap/', label: 'Roadmap' }
  ];
  // Duraciones (segundos). Ajustables a gusto.
  var DUR = { intro: 1.6, scroll: 7, trans: 0.8, outro: 1.6 };

  // ---------- iframes ----------
  var frames = document.getElementById('frames');
  var iframes = PAGES.map(function (p, i) {
    var f = document.createElement('iframe');
    f.src = p.src;
    f.setAttribute('tabindex', '-1');
    f.setAttribute('aria-hidden', 'true');
    if (i === 0) f.classList.add('is-active');
    f.addEventListener('load', function () {
      try {
        var d = f.contentDocument;
        var st = d.createElement('style');
        st.textContent = '::-webkit-scrollbar{width:0;height:0}html{scrollbar-width:none}html,body{scroll-behavior:auto !important}';
        d.head.appendChild(st);
      } catch (e) { /* mismo origen gracias al proxy */ }
      f._scroller = detectScroller(f);
      setTimeout(function () { f._scroller = detectScroller(f); }, 400);
      setTimeout(function () { f._scroller = detectScroller(f); }, 1300);
    });
    frames.appendChild(f);
    return f;
  });

  // ---------- línea de tiempo (segmentos) ----------
  var segs = [];
  var TOTAL = 0;
  (function build() {
    var t = 0;
    segs.push({ type: 'intro', start: 0, end: DUR.intro, page: 0 }); t = DUR.intro;
    for (var i = 0; i < PAGES.length; i++) {
      segs.push({ type: 'scroll', start: t, end: t + DUR.scroll, page: i }); t += DUR.scroll;
      if (i < PAGES.length - 1) { segs.push({ type: 'trans', start: t, end: t + DUR.trans, from: i, to: i + 1 }); t += DUR.trans; }
    }
    segs.push({ type: 'outro', start: t, end: t + DUR.outro, page: PAGES.length - 1 }); t += DUR.outro;
    TOTAL = t;
  })();

  // ---------- scroll de iframes ----------
  // Chirpy puede scrollear en el documento o en un contenedor interno: elegimos
  // el elemento con mayor (scrollHeight - clientHeight).
  function detectScroller(f) {
    try {
      var d = f.contentDocument; if (!d) return null;
      var best = null, bestMax = 2;
      var cands = [d.scrollingElement, d.documentElement, d.body];
      var nodes = d.querySelectorAll('div,main,section,article');
      for (var i = 0; i < nodes.length && i < 500; i++) cands.push(nodes[i]);
      for (var j = 0; j < cands.length; j++) {
        var el = cands[j]; if (!el) continue;
        var m = el.scrollHeight - el.clientHeight;
        if (m > bestMax) { bestMax = m; best = el; }
      }
      return best || d.scrollingElement || d.documentElement;
    } catch (e) { return null; }
  }
  function setScroll(f, p) {
    try {
      var el = f._scroller || (f.contentDocument && (f.contentDocument.scrollingElement || f.contentDocument.documentElement));
      if (!el) return;
      var max = Math.max(0, el.scrollHeight - el.clientHeight);
      var y = Math.round(p * max);
      el.scrollTop = y;
      if (f.contentWindow) { try { f.contentWindow.scrollTo(0, y); } catch (e2) {} }
    } catch (e) { /* aún cargando */ }
  }

  // ---------- capa ciber (canvas): TV encendiéndose + partículas de lluvia digital ----------
  var canvas = document.getElementById('cy-canvas');
  var ctx = canvas.getContext('2d');
  var CW = 0, CH = 0;
  function sizeCanvas() {
    var r = canvas.getBoundingClientRect();
    CW = canvas.width = Math.max(1, Math.round(r.width));
    CH = canvas.height = Math.max(1, Math.round(r.height));
  }
  function frac(x) { return x - Math.floor(x); }
  function hash(n) { return frac(Math.sin(n) * 43758.5453); }
  var N = 150, P = [];
  for (var pi = 0; pi < N; pi++) {
    P.push({ x: hash(pi * 1.7), y: hash(pi * 3.3 + 1), sp: 0.08 + hash(pi * 5.1) * 0.5,
      ch: (pi % 9 === 0 ? '1' : pi % 5 === 0 ? '0' : pi % 3 === 0 ? '·' : '+') });
  }
  function drawParticles(t, e) {
    if (e <= 0.02) return;
    ctx.fillStyle = '#9fef00';
    for (var i = 0; i < N; i++) {
      var p = P[i];
      ctx.globalAlpha = e * (0.35 + 0.65 * hash(i * 2.1 + Math.floor(t * 8)));
      ctx.font = (9 + Math.floor(p.sp * 10)) + 'px monospace';
      ctx.fillText(p.ch, p.x * CW, frac(p.y + t * p.sp) * CH);
    }
    ctx.globalAlpha = 1;
  }
  function drawTV(r) {
    r = Math.max(0, Math.min(1, r));
    if (r <= 0.5) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH);
      var hh = r / 0.5;
      var bandH = Math.max(2, hh * CH), y = (CH - bandH) / 2;
      var g = ctx.createLinearGradient(0, y, 0, y + bandH);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.96)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y, CW, bandH);
      ctx.fillStyle = 'rgba(159,239,0,' + (0.7 * (1 - hh)) + ')';
      ctx.fillRect(0, CH / 2 - 1.5, CW, 3);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - (r - 0.5) / 0.5) + ')';
      ctx.fillRect(0, 0, CW, CH);
    }
  }
  function drawFX(t, e) {
    if (e <= 0.02) return;
    ctx.globalAlpha = e * 0.16; ctx.fillStyle = '#000';
    for (var y = 0; y < CH; y += 3) ctx.fillRect(0, y, CW, 1);
    ctx.globalAlpha = 1;
    var slices = Math.floor(3 + e * 6);
    for (var s = 0; s < slices; s++) {
      var seed = s * 7.7 + Math.floor(t * 12);
      var sy = hash(seed) * CH, sh = 4 + hash(seed + 1) * 16, dx = (hash(seed + 2) - 0.5) * 50 * e;
      ctx.globalAlpha = e * 0.22;
      ctx.fillStyle = 'rgba(255,0,90,0.65)'; ctx.fillRect(dx, sy, CW, sh);
      ctx.fillStyle = 'rgba(0,220,255,0.65)'; ctx.fillRect(-dx, sy + 2, CW, sh);
    }
    ctx.globalAlpha = 1;
  }
  function renderCyber(t, state) {
    if (!CW) sizeCanvas();
    ctx.clearRect(0, 0, CW, CH);
    if (!state) return;              // sin efecto: lienzo transparente, se ve el blog
    if (state.kind === 'tv') {
      drawTV(state.r);
      var e = Math.sin(Math.max(0, Math.min(1, state.r)) * Math.PI);
      drawParticles(t, e); drawFX(t, e);
    } else {                         // transición entre páginas
      ctx.fillStyle = 'rgba(6,8,12,' + (state.mid * 0.5) + ')'; ctx.fillRect(0, 0, CW, CH);
      drawParticles(t, state.mid); drawFX(t, state.mid);
    }
  }

  var activeIdx = 0;
  function setActive(i) {
    if (i === activeIdx) return;
    iframes[activeIdx].classList.remove('is-active');
    iframes[i].classList.add('is-active');
    activeIdx = i;
  }

  // ---------- render determinista: estado = f(t) ----------
  function segAt(t) {
    for (var i = 0; i < segs.length; i++) { if (t < segs[i].end) return segs[i]; }
    return segs[segs.length - 1];
  }
  function render(t) {
    t = Math.max(0, Math.min(TOTAL, t));
    var s = segAt(t), k = (t - s.start) / (s.end - s.start);
    if (s.type === 'intro') {
      setActive(s.page); setScroll(iframes[s.page], 0); renderCyber(t, { kind: 'tv', r: k });
    } else if (s.type === 'outro') {
      setActive(s.page); setScroll(iframes[s.page], 1); renderCyber(t, { kind: 'tv', r: 1 - k });
    } else if (s.type === 'scroll') {
      setActive(s.page); setScroll(iframes[s.page], k); renderCyber(t, null);
    } else { // trans: cambia de página con un destello ciber
      if (k < 0.5) { setActive(s.from); setScroll(iframes[s.from], 1); }
      else { setActive(s.to); setScroll(iframes[s.to], 0); }
      var mid = 1 - Math.abs(k - 0.5) * 2; // 0 → 1 → 0
      renderCyber(t, { kind: 'trans', mid: mid });
    }
    updateBar(t);
  }

  // ---------- barra / tiempo ----------
  var tlFill = document.getElementById('tl-fill');
  var tlHead = document.getElementById('tl-head');
  var timeEl = document.getElementById('time');
  function fmt(s) { s = Math.max(0, s); var m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + (ss < 10 ? '0' : '') + ss; }
  function updateBar(t) {
    var p = TOTAL ? (t / TOTAL) : 0;
    tlFill.style.width = (p * 100) + '%';
    tlHead.style.left = (p * 100) + '%';
    timeEl.textContent = fmt(t) + ' / ' + fmt(TOTAL);
  }

  // ---------- reproducción ----------
  var cur = 0, playing = false, last = 0, loop = false;
  var playBtn = document.getElementById('play');
  var pauseBtn = document.getElementById('pause');
  var loopBtn = document.getElementById('loop');
  var hint = document.getElementById('hint');

  function syncButtons() {
    playBtn.classList.toggle('is-on', playing);
    pauseBtn.classList.toggle('is-on', !playing);
  }
  function play() {
    if (playing) return;
    if (cur >= TOTAL) cur = 0;
    playing = true; last = performance.now(); hint.classList.add('hide'); syncButtons();
    requestAnimationFrame(frame);
  }
  function pause() { playing = false; syncButtons(); }
  function toggle() { if (playing) { pause(); } else { play(); } }
  function seek(t) { cur = Math.max(0, Math.min(TOTAL, t)); render(cur); }

  function frame(now) {
    if (!playing) return;
    var dt = (now - last) / 1000; last = now;
    cur += dt;
    if (cur >= TOTAL) {
      if (loop) { cur = cur - TOTAL; }
      else { cur = TOTAL; render(cur); pause(); return; }
    }
    render(cur);
    requestAnimationFrame(frame);
  }

  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);
  loopBtn.addEventListener('click', function () {
    loop = !loop;
    loopBtn.classList.toggle('loop-on', loop);
    loopBtn.classList.toggle('loop-off', !loop);
    loopBtn.setAttribute('aria-pressed', loop ? 'true' : 'false');
  });

  // timeline: clic/arrastre para ir a ese momento
  var tl = document.getElementById('timeline');
  function seekFromEvent(e) {
    var r = tl.getBoundingClientRect();
    var cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX) || 0;
    seek(Math.max(0, Math.min(1, (cx - r.left) / r.width)) * TOTAL);
  }
  var scrubbing = false;
  tl.addEventListener('pointerdown', function (e) { scrubbing = true; try { tl.setPointerCapture(e.pointerId); } catch (x) {} seekFromEvent(e); });
  tl.addEventListener('pointermove', function (e) { if (scrubbing) seekFromEvent(e); });
  window.addEventListener('pointerup', function () { scrubbing = false; });

  // ---------- salto ±5s con overlay acumulable ----------
  var seekOv = document.getElementById('seek');
  var seekArrow = seekOv.querySelector('.seek-arrow');
  var seekNum = seekOv.querySelector('.seek-num');
  var accum = 0, accumDir = 0, accumTimer = null;
  function doSeek(dir) {
    seek(cur + dir * 5);
    if (accumDir !== dir) { accum = 0; accumDir = dir; }
    accum += 5;
    seekArrow.textContent = dir > 0 ? '⏩' : '⏪'; // ⏩ / ⏪
    seekNum.textContent = accum + 's';
    seekOv.classList.remove('hide');
    clearTimeout(accumTimer);
    accumTimer = setTimeout(function () { seekOv.classList.add('hide'); accum = 0; accumDir = 0; }, 200);
  }

  // ---------- teclado ----------
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); doSeek(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); doSeek(-1); }
  });
  window.addEventListener('resize', function () { sizeCanvas(); render(cur); });
  window.addEventListener('load', function () { sizeCanvas(); render(cur); });

  // Estado inicial: segundo 0, en pausa, esperando play.
  sizeCanvas();
  syncButtons();
  render(0);
})();
