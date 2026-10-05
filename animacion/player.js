(function () {
  'use strict';

  // ====== Guion ======
  var PAGES = ['/', '/writeups/', '/herramientas/', '/roadmap/'];
  var PLAN = [
    { page: 0, kind: 'scrollz', dur: 7.5 },   // Inicio
    { trans: 'swipe' },
    { page: 1, kind: 'scrollz', dur: 7.0 },   // Write-ups
    { trans: 'fade' },
    { page: 2, kind: 'panx', dur: 6.0 },      // Herramientas (barrido horizontal)
    { trans: 'flash' },
    { page: 3, kind: 'scrollz', dur: 6.5 },   // Roadmap
    { trans: 'dip' },
    { page: 0, kind: 'zoomout', dur: 3.2 }    // Cierre: Inicio zoom-out y corta
  ];
  var INTRO = 2.2, OUTRO = 2.0, TRANS = 0.5;
  var LEAD = 0.1;   // la página siguiente empieza a moverse al 90% de la transición

  // ====== iframes (a altura completa → scroll por transform, GPU) ======
  var frames = document.getElementById('frames');
  function measure(f) {
    try {
      var d = f.contentDocument; if (!d) return;
      var h = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
      if (h > 120) { f._h = h; f.style.height = h + 'px'; }
    } catch (e) {}
  }
  var iframes = PAGES.map(function (src, i) {
    var f = document.createElement('iframe');
    f.src = src;
    f.setAttribute('tabindex', '-1');
    f.setAttribute('aria-hidden', 'true');
    if (i === 0) f.classList.add('is-active');
    f.addEventListener('load', function () {
      try {
        var d = f.contentDocument;
        var st = d.createElement('style');
        st.textContent = 'html{scroll-behavior:auto!important;overflow:hidden!important}::-webkit-scrollbar{width:0;height:0}';
        d.head.appendChild(st);
      } catch (e) {}
      measure(f);
      setTimeout(function () { measure(f); }, 450);
      setTimeout(function () { measure(f); render(cur); }, 1400);
    });
    frames.appendChild(f);
    return f;
  });

  // ====== segmentos + ventanas de movimiento ======
  var segs = [], TOTAL = 0;
  (function build() {
    var t = 0;
    segs.push({ type: 'intro', page: 0, start: 0, end: INTRO }); t = INTRO;
    PLAN.forEach(function (it) {
      if (it.trans) { segs.push({ type: 'trans', eff: it.trans, start: t, end: t + TRANS }); t += TRANS; }
      else { segs.push({ type: 'page', page: it.page, kind: it.kind, start: t, end: t + it.dur }); t += it.dur; }
    });
    var lastPage = 0;
    for (var i = segs.length - 1; i >= 0; i--) if (segs[i].type === 'page') { lastPage = segs[i].page; break; }
    segs.push({ type: 'outro', page: lastPage, start: t, end: t + OUTRO }); t += OUTRO;
    TOTAL = t;
    // ventanas de movimiento: cada página empieza LEAD*TRANS antes (durante el final
    // de su transición de entrada) y termina TRANS después (sigue moviéndose durante
    // su transición de salida) → movimiento continuo sin parones.
    for (var j = 0; j < segs.length; j++) {
      var s = segs[j]; if (s.type !== 'page') continue;
      var pre = segs[j - 1] && segs[j - 1].type === 'trans';
      var post = segs[j + 1] && segs[j + 1].type === 'trans';
      s.m0 = s.start - (pre ? LEAD * TRANS : 0);
      s.m1 = s.end + (post ? TRANS : 0);
    }
    for (var m = 0; m < segs.length; m++) {
      if (segs[m].type !== 'trans') continue;
      for (var a = m - 1; a >= 0; a--) if (segs[a].type === 'page') { segs[m].fromSeg = segs[a]; break; }
      for (var b = m + 1; b < segs.length; b++) if (segs[b].type === 'page') { segs[m].toSeg = segs[b]; break; }
    }
  })();
  function pkOf(seg, t) { return Math.max(0, Math.min(1, (t - seg.m0) / (seg.m1 - seg.m0))); }

  // ====== transform por página ======
  function easeIO(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function applyPage(f, kind, p) {
    var W = frames.clientWidth, H = frames.clientHeight, ch = f._h || H, s, tx = 0, ty = 0, origin = '50% 0%';
    if (kind === 'panx') {
      s = 1.22; origin = '0% 0%'; tx = -p * (s - 1) * W; ty = -0.05 * Math.max(0, s * ch - H);
    } else if (kind === 'zoomout') {
      s = 1.16 - 0.16 * easeOut(Math.min(1, p)); origin = '50% 0%'; ty = 0;
    } else { // scrollz: scroll vertical (GPU) + leve zoom-out
      s = 1.08 - 0.08 * easeIO(p); origin = '50% 0%'; ty = -p * Math.max(0, s * ch - H);
    }
    f.style.transformOrigin = origin;
    f.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
  }

  var activeIdx = 0;
  function setActive(i) {
    if (i === activeIdx) return;
    iframes[activeIdx].classList.remove('is-active');
    iframes[i].classList.add('is-active');
    activeIdx = i;
  }

  // ====== canvas ciber ======
  var canvas = document.getElementById('cy-canvas');
  var ctx = canvas.getContext('2d');
  var CW = 0, CH = 0;
  function sizeCanvas() { var r = canvas.getBoundingClientRect(); CW = canvas.width = Math.max(1, Math.round(r.width)); CH = canvas.height = Math.max(1, Math.round(r.height)); }
  function frac(x) { return x - Math.floor(x); }
  function hash(n) { return frac(Math.sin(n) * 43758.5453); }

  // textura de estática (TV) precalculada
  var nC = document.createElement('canvas'); nC.width = nC.height = 180;
  (function () { var nx = nC.getContext('2d'); var img = nx.createImageData(180, 180); for (var i = 0; i < img.data.length; i += 4) { var v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } nx.putImageData(img, 0, 0); })();
  function noise(t, a) { if (a <= 0.02) return; ctx.globalAlpha = a * 0.6; var ox = (hash(Math.floor(t * 30)) * 50) | 0, oy = (hash(Math.floor(t * 30) + 9) * 50) | 0; ctx.drawImage(nC, -ox, -oy, CW + 50, CH + 50); ctx.globalAlpha = 1; }

  var COLORS = ['#9fef00', '#9fef00', '#2ee6d6', '#ff3ea5', '#ffffff'];
  var N = 170, P = [];
  for (var pi = 0; pi < N; pi++) P.push({ x: hash(pi * 1.7), y: hash(pi * 3.3 + 1), sp: 0.07 + hash(pi * 5.1) * 0.6, col: COLORS[Math.floor(hash(pi * 9.2) * COLORS.length)], ang: hash(pi * 2.4) * 6.283, ch: (pi % 11 === 0 ? '1' : pi % 6 === 0 ? '0' : pi % 3 === 0 ? '·' : '+') });
  function rain(t, e) {
    if (e <= 0.02) return; ctx.save(); ctx.shadowBlur = 8;
    for (var i = 0; i < N; i++) { var p = P[i]; ctx.globalAlpha = e * (0.3 + 0.7 * hash(i * 2.1 + Math.floor(t * 9))); ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.font = (10 + Math.floor(p.sp * 12)) + 'px monospace'; ctx.fillText(p.ch, p.x * CW, frac(p.y + t * p.sp) * CH); }
    ctx.restore();
  }
  function burst(t, e) {
    if (e <= 0.02) return; ctx.save(); ctx.shadowBlur = 12; var cx = CW / 2, cy = CH / 2, R = Math.max(CW, CH) * 0.7;
    for (var i = 0; i < N; i++) { var p = P[i], d = e * R * (0.2 + hash(i * 1.3)); ctx.globalAlpha = e * 0.9; ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.fillRect(cx + Math.cos(p.ang) * d, cy + Math.sin(p.ang) * d, 2.6, 2.6); }
    ctx.restore();
  }
  function scan(e) { if (e <= 0.02) return; ctx.globalAlpha = e * 0.14; ctx.fillStyle = '#000'; for (var y = 0; y < CH; y += 3) ctx.fillRect(0, y, CW, 1); ctx.globalAlpha = 1; }
  function chroma(t, e) {
    if (e <= 0.02) return; var slices = Math.floor(3 + e * 7);
    for (var s = 0; s < slices; s++) { var sd = s * 7.7 + Math.floor(t * 14); var sy = hash(sd) * CH, sh = 4 + hash(sd + 1) * 18, dx = (hash(sd + 2) - 0.5) * 70 * e; ctx.globalAlpha = e * 0.25; ctx.fillStyle = 'rgba(255,0,110,0.7)'; ctx.fillRect(dx, sy, CW, sh); ctx.fillStyle = 'rgba(0,230,255,0.7)'; ctx.fillRect(-dx, sy + 2, CW, sh); }
    ctx.globalAlpha = 1;
  }
  function vignette(a) { if (a <= 0.02) return; var g = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.35, CW / 2, CH / 2, Math.max(CW, CH) * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + a + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH); }

  function cyberTV(t, r) {
    r = Math.max(0, Math.min(1, r)); var e = Math.sin(r * Math.PI);
    // base: negro → banda de luz que se abre → flash → revela
    if (r <= 0.5) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH);
      var hh = r / 0.5, bandH = Math.max(2, hh * hh * CH), y = (CH - bandH) / 2;
      var gr = ctx.createLinearGradient(0, y, 0, y + bandH);
      gr.addColorStop(0, 'rgba(159,239,0,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.98)'); gr.addColorStop(1, 'rgba(46,230,214,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, y, CW, bandH);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - hh)) + ')'; ctx.fillRect(0, CH / 2 - 2, CW, 4);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.pow(1 - (r - 0.5) / 0.5, 1.3) + ')'; ctx.fillRect(0, 0, CW, CH);
    }
    noise(t, Math.max(0, (0.5 - r) / 0.5));         // estática de TV (fuerte cerrado)
    // bloom radial (destello de encendido)
    var bl = Math.max(0, 1 - Math.abs(r - 0.42) / 0.3);
    if (bl > 0.02) { var rad = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, Math.max(CW, CH) * 0.65); rad.addColorStop(0, 'rgba(159,239,0,' + (0.6 * bl) + ')'); rad.addColorStop(0.5, 'rgba(46,230,214,' + (0.28 * bl) + ')'); rad.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rad; ctx.fillRect(0, 0, CW, CH); }
    burst(t, e * Math.max(0, 1 - Math.abs(r - 0.45) / 0.45));
    rain(t, e); chroma(t, e); scan(e); vignette(e * 0.55);
  }

  // ====== transiciones (simples, tapan el cambio en el medio) ======
  function transition(eff, t, k) {
    var c = 1 - Math.abs(2 * k - 1), W = CW, H = CH;
    if (eff === 'fade') {
      ctx.globalAlpha = Math.min(1, c * 1.7); ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    } else if (eff === 'flash') {
      ctx.globalAlpha = Math.min(1, c * 1.7); ctx.fillStyle = '#eef6ff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    } else if (eff === 'dip') {
      ctx.globalAlpha = Math.min(1, c * 1.7); ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; chroma(t, c * 0.5);
    } else { // swipe: barra negra cruza (cubre a la mitad) con filo brillante
      ctx.fillStyle = '#04060a';
      if (k < 0.5) { var w = 2 * k * W; ctx.fillRect(0, 0, w, H); edge(w, H); }
      else { var x = (2 * k - 1) * W; ctx.fillRect(x, 0, W - x, H); edge(x, H); }
    }
  }
  function edge(x, H) { ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = '#9fef00'; ctx.fillStyle = '#9fef00'; ctx.fillRect(x - 2, 0, 3, H); ctx.restore(); }

  // ====== render ======
  function render(t) {
    t = Math.max(0, Math.min(TOTAL, t));
    var s = segAt(t), k = (t - s.start) / (s.end - s.start);
    if (!CW) sizeCanvas();
    ctx.clearRect(0, 0, CW, CH);
    if (s.type === 'intro') { setActive(s.page); applyPage(iframes[s.page], 'scrollz', 0); cyberTV(t, k); }
    else if (s.type === 'outro') { setActive(s.page); applyPage(iframes[s.page], 'zoomout', 1); cyberTV(t, 1 - k); }
    else if (s.type === 'page') { setActive(s.page); applyPage(iframes[s.page], s.kind, pkOf(s, t)); }
    else { // trans: from sigue moviéndose; to arranca durante el final (LEAD)
      if (k < 0.5) { setActive(s.fromSeg.page); applyPage(iframes[s.fromSeg.page], s.fromSeg.kind, pkOf(s.fromSeg, t)); }
      else { setActive(s.toSeg.page); applyPage(iframes[s.toSeg.page], s.toSeg.kind, pkOf(s.toSeg, t)); }
      transition(s.eff, t, k);
    }
    updateBar(t);
  }
  function segAt(t) { for (var i = 0; i < segs.length; i++) if (t < segs[i].end) return segs[i]; return segs[segs.length - 1]; }

  // ====== barra / tiempo ======
  var tlFill = document.getElementById('tl-fill'), tlHead = document.getElementById('tl-head'), timeEl = document.getElementById('time');
  function fmt(s) { s = Math.max(0, s); var m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + (ss < 10 ? '0' : '') + ss; }
  function updateBar(t) { var p = TOTAL ? (t / TOTAL) : 0; tlFill.style.width = (p * 100) + '%'; tlHead.style.left = (p * 100) + '%'; timeEl.textContent = fmt(t) + ' / ' + fmt(TOTAL); }

  // ====== reproducción ======
  var cur = 0, playing = false, last = 0, loop = false;
  var playBtn = document.getElementById('play'), pauseBtn = document.getElementById('pause'), loopBtn = document.getElementById('loop'), hint = document.getElementById('hint');
  function syncButtons() { playBtn.classList.toggle('is-on', playing); pauseBtn.classList.toggle('is-on', !playing); }
  function play() { if (playing) return; if (cur >= TOTAL) cur = 0; playing = true; last = performance.now(); hint.classList.add('hide'); syncButtons(); requestAnimationFrame(frame); }
  function pause() { playing = false; syncButtons(); }
  function toggle() { if (playing) pause(); else play(); }
  function seek(t) { cur = Math.max(0, Math.min(TOTAL, t)); render(cur); }
  function frame(now) { if (!playing) return; var dt = (now - last) / 1000; last = now; cur += dt; if (cur >= TOTAL) { if (loop) cur -= TOTAL; else { cur = TOTAL; render(cur); pause(); return; } } render(cur); requestAnimationFrame(frame); }
  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);
  loopBtn.addEventListener('click', function () { loop = !loop; loopBtn.classList.toggle('loop-on', loop); loopBtn.classList.toggle('loop-off', !loop); loopBtn.setAttribute('aria-pressed', loop ? 'true' : 'false'); });

  var tl = document.getElementById('timeline');
  function seekFromEvent(e) { var r = tl.getBoundingClientRect(), cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX) || 0; seek(Math.max(0, Math.min(1, (cx - r.left) / r.width)) * TOTAL); }
  var scrubbing = false;
  tl.addEventListener('pointerdown', function (e) { scrubbing = true; try { tl.setPointerCapture(e.pointerId); } catch (x) {} seekFromEvent(e); });
  tl.addEventListener('pointermove', function (e) { if (scrubbing) seekFromEvent(e); });
  window.addEventListener('pointerup', function () { scrubbing = false; });

  // ====== salto ±5s ======
  var seekOv = document.getElementById('seek'), seekArrow = seekOv.querySelector('.seek-arrow'), seekNum = seekOv.querySelector('.seek-num');
  var accum = 0, accumDir = 0, accumTimer = null;
  function doSeek(dir) {
    seek(cur + dir * 5);
    if (accumDir !== dir) { accum = 0; accumDir = dir; }
    accum += 5; seekArrow.textContent = dir > 0 ? '⏩' : '⏪'; seekNum.textContent = accum + 's';
    seekOv.classList.remove('hide'); clearTimeout(accumTimer);
    accumTimer = setTimeout(function () { seekOv.classList.add('hide'); accum = 0; accumDir = 0; }, 200);
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); doSeek(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); doSeek(-1); }
  });
  window.addEventListener('resize', function () { sizeCanvas(); render(cur); });
  window.addEventListener('load', function () { sizeCanvas(); iframes.forEach(measure); render(cur); });

  sizeCanvas(); syncButtons(); render(0);
})();
