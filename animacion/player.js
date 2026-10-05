(function () {
  'use strict';

  // ====== Guion del recorrido ======
  // kind: 'scrollz' (scroll vertical + leve zoom-out), 'panx' (zoom + barrido
  // horizontal izq→der), 'zoomout' (estático con zoom-out, para el cierre).
  var PAGES = ['/', '/writeups/', '/herramientas/', '/roadmap/'];
  var PLAN = [
    { page: 0, kind: 'scrollz', dur: 7.5 },   // Inicio
    { trans: 'rgbpush' },
    { page: 1, kind: 'scrollz', dur: 7.0 },   // Write-ups
    { trans: 'pixel' },
    { page: 2, kind: 'panx', dur: 6.0 },      // Herramientas (barrido horizontal)
    { trans: 'scanwipe' },
    { page: 3, kind: 'scrollz', dur: 6.5 },   // Roadmap
    { trans: 'zoomflash' },
    { page: 0, kind: 'zoomout', dur: 3.2 }    // Cierre: Inicio zoom-out y corta
  ];
  var INTRO = 2.0, OUTRO = 1.9, TRANS = 0.55;

  // ====== iframes ======
  var frames = document.getElementById('frames');
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
        st.textContent = '::-webkit-scrollbar{width:0;height:0}html{scrollbar-width:none}html,body{scroll-behavior:auto !important}';
        d.head.appendChild(st);
      } catch (e) {}
      f._scroller = detectScroller(f);
      setTimeout(function () { f._scroller = detectScroller(f); }, 400);
      setTimeout(function () { f._scroller = detectScroller(f); }, 1300);
    });
    frames.appendChild(f);
    return f;
  });

  // ====== segmentos ======
  var segs = [], TOTAL = 0;
  (function build() {
    var t = 0;
    segs.push({ type: 'intro', page: 0, start: 0, end: INTRO }); t = INTRO;
    PLAN.forEach(function (it) {
      if (it.trans) { segs.push({ type: 'trans', eff: it.trans, start: t, end: t + TRANS }); t += TRANS; }
      else { segs.push({ type: 'page', page: it.page, kind: it.kind, start: t, end: t + it.dur }); t += it.dur; }
    });
    var lastPage = 0;
    for (var i = segs.length - 1; i >= 0; i--) { if (segs[i].type === 'page') { lastPage = segs[i].page; break; } }
    segs.push({ type: 'outro', page: lastPage, start: t, end: t + OUTRO }); t += OUTRO;
    // emparejar from/to en las transiciones
    for (var j = 0; j < segs.length; j++) {
      if (segs[j].type !== 'trans') continue;
      for (var a = j - 1; a >= 0; a--) if (segs[a].type === 'page') { segs[j].from = segs[a].page; segs[j].fromKind = segs[a].kind; break; }
      for (var b = j + 1; b < segs.length; b++) if (segs[b].type === 'page') { segs[j].to = segs[b].page; segs[j].toKind = segs[b].kind; break; }
    }
    TOTAL = t;
  })();

  // ====== scroll + transform de los iframes ======
  function detectScroller(f) {
    try {
      var d = f.contentDocument; if (!d) return null;
      var best = null, bestMax = 2, cands = [d.scrollingElement, d.documentElement, d.body];
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
      var max = Math.max(0, el.scrollHeight - el.clientHeight), y = Math.round(p * max);
      el.scrollTop = y;
      if (f.contentWindow) { try { f.contentWindow.scrollTo(0, y); } catch (e2) {} }
    } catch (e) {}
  }
  function easeIO(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function applyPage(f, kind, k) {
    var W = f.clientWidth || frames.clientWidth, s, tx = 0, origin = '50% 40%';
    if (kind === 'panx') {
      setScroll(f, 0.08); s = 1.22; origin = 'left center'; tx = -k * (s - 1) * W;
    } else if (kind === 'zoomout') {
      setScroll(f, 0); s = 1.16 - 0.16 * easeOut(Math.min(1, k)); origin = '50% 28%';
    } else { // scrollz
      setScroll(f, k); s = 1.08 - 0.08 * easeIO(k); origin = '50% 42%';
    }
    f.style.transformOrigin = origin;
    f.style.transform = 'translateX(' + tx.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
  }

  var activeIdx = 0;
  function setActive(i) {
    if (i === activeIdx) { return; }
    iframes[activeIdx].classList.remove('is-active');
    iframes[i].classList.add('is-active');
    activeIdx = i;
  }

  // ====== canvas ciber ======
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
  var COLORS = ['#9fef00', '#9fef00', '#2ee6d6', '#ff3ea5', '#ffffff'];
  var N = 230, P = [];
  for (var pi = 0; pi < N; pi++) {
    P.push({
      x: hash(pi * 1.7), y: hash(pi * 3.3 + 1), sp: 0.07 + hash(pi * 5.1) * 0.6,
      col: COLORS[Math.floor(hash(pi * 9.2) * COLORS.length)],
      ang: hash(pi * 2.4) * Math.PI * 2, ch: (pi % 11 === 0 ? '1' : pi % 6 === 0 ? '0' : pi % 3 === 0 ? '·' : '+')
    });
  }
  function rain(t, e) {
    if (e <= 0.02) return;
    ctx.save(); ctx.shadowBlur = 8;
    for (var i = 0; i < N; i++) {
      var p = P[i];
      ctx.globalAlpha = e * (0.3 + 0.7 * hash(i * 2.1 + Math.floor(t * 9)));
      ctx.fillStyle = p.col; ctx.shadowColor = p.col;
      ctx.font = (10 + Math.floor(p.sp * 12)) + 'px monospace';
      ctx.fillText(p.ch, p.x * CW, frac(p.y + t * p.sp) * CH);
    }
    ctx.restore();
  }
  function burst(t, e) {   // chispas radiando desde el centro (en el destello)
    if (e <= 0.02) return;
    ctx.save(); ctx.shadowBlur = 12;
    var cx = CW / 2, cy = CH / 2, R = Math.max(CW, CH) * 0.7;
    for (var i = 0; i < N; i++) {
      var p = P[i], d = e * R * (0.2 + hash(i * 1.3));
      var x = cx + Math.cos(p.ang) * d, y = cy + Math.sin(p.ang) * d;
      ctx.globalAlpha = e * 0.9 * (1 - e * 0.3);
      ctx.fillStyle = p.col; ctx.shadowColor = p.col;
      ctx.fillRect(x, y, 2.5, 2.5);
    }
    ctx.restore();
  }
  function scan(e) {
    if (e <= 0.02) return;
    ctx.globalAlpha = e * 0.14; ctx.fillStyle = '#000';
    for (var y = 0; y < CH; y += 3) ctx.fillRect(0, y, CW, 1);
    ctx.globalAlpha = 1;
  }
  function chroma(t, e) {
    if (e <= 0.02) return;
    var slices = Math.floor(3 + e * 7);
    for (var s = 0; s < slices; s++) {
      var seed = s * 7.7 + Math.floor(t * 14);
      var sy = hash(seed) * CH, sh = 4 + hash(seed + 1) * 18, dx = (hash(seed + 2) - 0.5) * 70 * e;
      ctx.globalAlpha = e * 0.25;
      ctx.fillStyle = 'rgba(255,0,110,0.7)'; ctx.fillRect(dx, sy, CW, sh);
      ctx.fillStyle = 'rgba(0,230,255,0.7)'; ctx.fillRect(-dx, sy + 2, CW, sh);
    }
    ctx.globalAlpha = 1;
  }
  // Intro/outro: TV encendiéndose con color, bloom y chispas.  r: 0 negro → 1 visible
  function cyberTV(t, r) {
    r = Math.max(0, Math.min(1, r));
    var e = Math.sin(r * Math.PI);                 // energía (pico en el medio)
    if (r <= 0.5) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CW, CH);
      var hh = r / 0.5, bandH = Math.max(2, hh * CH), y = (CH - bandH) / 2;
      var g = ctx.createLinearGradient(0, y, 0, y + bandH);
      g.addColorStop(0, 'rgba(159,239,0,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.98)'); g.addColorStop(1, 'rgba(46,230,214,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y, CW, bandH);
      ctx.fillStyle = 'rgba(159,239,0,' + (0.85 * (1 - hh)) + ')'; ctx.fillRect(0, CH / 2 - 2, CW, 4);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - (r - 0.5) / 0.5) + ')'; ctx.fillRect(0, 0, CW, CH);
    }
    // bloom radial (destello de encendido)
    var bl = Math.max(0, 1 - Math.abs(r - 0.42) / 0.3);
    if (bl > 0.02) {
      var rad = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, Math.max(CW, CH) * 0.6);
      rad.addColorStop(0, 'rgba(159,239,0,' + (0.55 * bl) + ')');
      rad.addColorStop(0.5, 'rgba(46,230,214,' + (0.25 * bl) + ')');
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rad; ctx.fillRect(0, 0, CW, CH);
    }
    burst(t, e * Math.max(0, 1 - Math.abs(r - 0.45) / 0.45));
    rain(t, e); chroma(t, e); scan(e);
  }

  // ====== transiciones (breves, distintas, tapan el cambio en el medio) ======
  function cover(c, color) { ctx.globalAlpha = Math.min(1, c * 1.7); ctx.fillStyle = color; ctx.fillRect(0, 0, CW, CH); ctx.globalAlpha = 1; }
  function transition(eff, t, k) {
    var c = 1 - Math.abs(2 * k - 1);               // 0 → 1 → 0 (tapa del todo en el medio)
    if (eff === 'rgbpush') {
      cover(c, '#05070a'); chroma(t, 0.6 + c * 0.4);
      var bx = k * CW;                              // barra que cruza
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#9fef00'; ctx.fillRect(bx - 4, 0, 8, CH); ctx.globalAlpha = 1;
    } else if (eff === 'pixel') {
      cover(c * 0.4, '#05070a');
      var g = 26, cols = Math.ceil(CW / g), rows = Math.ceil(CH / g);
      for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) {
        if (hash(xx * 3.1 + yy * 7.7) < c) {
          ctx.globalAlpha = 0.9; ctx.fillStyle = (hash(xx + yy * 2) < 0.5) ? '#0b0f14' : '#132018';
          ctx.fillRect(xx * g, yy * g, g + 1, g + 1);
        }
      }
      ctx.globalAlpha = 1;
    } else if (eff === 'scanwipe') {
      var yline = k * CH;
      ctx.globalAlpha = Math.min(1, c * 1.7); ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, CW, yline);               // barrido descendente
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2ee6d6'; ctx.shadowBlur = 16; ctx.shadowColor = '#2ee6d6';
      ctx.fillRect(0, yline - 3, CW, 6); ctx.shadowBlur = 0;
      rain(t, c);
    } else { // zoomflash
      var rad = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, Math.max(CW, CH) * (0.2 + c));
      rad.addColorStop(0, 'rgba(255,255,255,' + c + ')');
      rad.addColorStop(0.6, 'rgba(159,239,0,' + (c * 0.5) + ')');
      rad.addColorStop(1, 'rgba(5,7,10,' + (c * 0.9) + ')');
      ctx.fillStyle = rad; ctx.fillRect(0, 0, CW, CH);
      burst(t, c);
    }
  }

  // ====== render determinista ======
  function clearCanvas() { if (!CW) sizeCanvas(); ctx.clearRect(0, 0, CW, CH); }
  function segAt(t) { for (var i = 0; i < segs.length; i++) if (t < segs[i].end) return segs[i]; return segs[segs.length - 1]; }
  function render(t) {
    t = Math.max(0, Math.min(TOTAL, t));
    var s = segAt(t), k = (t - s.start) / (s.end - s.start);
    clearCanvas();
    if (s.type === 'intro') {
      setActive(s.page); applyPage(iframes[s.page], 'scrollz', 0); cyberTV(t, k);
    } else if (s.type === 'outro') {
      setActive(s.page); cyberTV(t, 1 - k);
    } else if (s.type === 'page') {
      setActive(s.page); applyPage(iframes[s.page], s.kind, k);
    } else { // trans: tapa el cambio; cambia de página en el medio
      if (k < 0.5) { setActive(s.from); applyPage(iframes[s.from], s.fromKind, 1); }
      else { setActive(s.to); applyPage(iframes[s.to], s.toKind, 0); }
      transition(s.eff, t, k);
    }
    updateBar(t);
  }

  // ====== barra / tiempo ======
  var tlFill = document.getElementById('tl-fill'), tlHead = document.getElementById('tl-head'), timeEl = document.getElementById('time');
  function fmt(s) { s = Math.max(0, s); var m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + (ss < 10 ? '0' : '') + ss; }
  function updateBar(t) {
    var p = TOTAL ? (t / TOTAL) : 0;
    tlFill.style.width = (p * 100) + '%'; tlHead.style.left = (p * 100) + '%';
    timeEl.textContent = fmt(t) + ' / ' + fmt(TOTAL);
  }

  // ====== reproducción ======
  var cur = 0, playing = false, last = 0, loop = false;
  var playBtn = document.getElementById('play'), pauseBtn = document.getElementById('pause'),
    loopBtn = document.getElementById('loop'), hint = document.getElementById('hint');
  function syncButtons() { playBtn.classList.toggle('is-on', playing); pauseBtn.classList.toggle('is-on', !playing); }
  function play() { if (playing) return; if (cur >= TOTAL) cur = 0; playing = true; last = performance.now(); hint.classList.add('hide'); syncButtons(); requestAnimationFrame(frame); }
  function pause() { playing = false; syncButtons(); }
  function toggle() { if (playing) pause(); else play(); }
  function seek(t) { cur = Math.max(0, Math.min(TOTAL, t)); render(cur); }
  function frame(now) {
    if (!playing) return;
    var dt = (now - last) / 1000; last = now; cur += dt;
    if (cur >= TOTAL) { if (loop) { cur -= TOTAL; } else { cur = TOTAL; render(cur); pause(); return; } }
    render(cur); requestAnimationFrame(frame);
  }
  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);
  loopBtn.addEventListener('click', function () {
    loop = !loop;
    loopBtn.classList.toggle('loop-on', loop); loopBtn.classList.toggle('loop-off', !loop);
    loopBtn.setAttribute('aria-pressed', loop ? 'true' : 'false');
  });

  var tl = document.getElementById('timeline');
  function seekFromEvent(e) {
    var r = tl.getBoundingClientRect(), cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX) || 0;
    seek(Math.max(0, Math.min(1, (cx - r.left) / r.width)) * TOTAL);
  }
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
    accum += 5;
    seekArrow.textContent = dir > 0 ? '⏩' : '⏪';
    seekNum.textContent = accum + 's';
    seekOv.classList.remove('hide');
    clearTimeout(accumTimer);
    accumTimer = setTimeout(function () { seekOv.classList.add('hide'); accum = 0; accumDir = 0; }, 200);
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); doSeek(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); doSeek(-1); }
  });
  window.addEventListener('resize', function () { sizeCanvas(); render(cur); });
  window.addEventListener('load', function () { sizeCanvas(); render(cur); });

  sizeCanvas(); syncButtons(); render(0);
})();
