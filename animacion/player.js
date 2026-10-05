(function () {
  'use strict';

  // ============================================================
  //  GUION (recorrido determinista = función del tiempo)
  //
  //  Principio general: las transiciones SOLAPAN el movimiento.
  //  Cada página ya se está moviendo cuando se quita el fundido de
  //  entrada, y el fundido de salida empieza ANTES de que la página
  //  termine su movimiento (sigue moviéndose tapada por el negro).
  //
  //  0) Fundido DE negro: aparece el Inicio y hace zoom-out (empieza
  //     a la vez que el fundido). Antes de acabar el zoom ya funde a negro.
  //  1) Write-ups: scroll hacia abajo por las máquinas (rápido).
  //  2) Writeup de Dolibarr: scroll hacia abajo por el writeup.
  //  3) Roadmap: scroll hacia abajo; al pasar las "easy" empieza el
  //     fundido y sigue bajando tapado por el negro.
  //  4) Inicio otra vez (zoom-out) y a negro.
  // ============================================================
  var PAGES = ['/', '/writeups/', '/posts/dolibarr/', '/roadmap/'];
  // páginas que se muestran SIN columnas laterales (solo el contenido)
  var HIDE_CHROME = { 1: true, 2: true, 3: true };

  var PLAN = [
    { page: 0, kind: 'zoomout', dur: 3.2 },               // Inicio (zoom-out) → antes a Write-ups
    { trans: 'fade', dur: 0.9 },
    { page: 1, kind: 'scroll',  dur: 5.5, fadeAt: 0.72 }, // Write-ups (transición antes)
    { trans: 'fade', dur: 0.9 },
    { page: 2, kind: 'scroll',  dur: 13,  fadeAt: 0.80, speedFrom: 3 }, // Dolibarr (misma velocidad que el roadmap)
    { trans: 'fade', dur: 0.9 },
    { page: 3, kind: 'scroll',  dur: 11, fadeAt: 0.55 },  // Roadmap (scroll, funde tras las easy)
    { trans: 'fade', dur: 0.9 },
    { page: 0, kind: 'zoomout', dur: 5 }                  // Inicio otra vez → negro
  ];
  var INTRO = 1.2;   // fundido de entrada (de negro al Inicio)
  var OUTRO = 1.8;   // fundido de salida final (a negro)
  var HOME_ZOOM_SPAN = 6.5; // el zoom-out del Inicio avanza a ESTE ritmo (lento),
                            // independiente de la duración del tramo → la transición
                            // entra antes y el zoom-out NO llega a terminar.

  // ====== iframes (altura completa → movimiento por transform, GPU) ======
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
        var css = 'html{scroll-behavior:auto!important;overflow:hidden!important}::-webkit-scrollbar{width:0;height:0}';
        if (HIDE_CHROME[i]) {
          // Ocultar columnas laterales / barra superior → solo el contenido.
          css += '#sidebar,#topbar-wrapper,#panel-wrapper,#back-to-top,#notification,#mask,#search-result-wrapper{display:none!important}'
               + '#main-wrapper{margin-left:0!important;width:100%!important}'
               + '#main-wrapper>.container{max-width:100%!important}'
               + '#main-wrapper>.container>.row>main{flex:0 0 100%!important;max-width:100%!important}'
               + 'body{background:#05070a!important}';
        }
        var st = d.createElement('style');
        st.textContent = css;
        d.head.appendChild(st);
      } catch (e) {}
      measure(f);
      setTimeout(function () { measure(f); }, 450);
      setTimeout(function () { measure(f); render(cur); }, 1400);
    });
    frames.appendChild(f);
    return f;
  });

  // ====== segmentos ======
  var segs = [], TOTAL = 0;
  (function build() {
    var t = 0;
    PLAN.forEach(function (it) {
      if (it.trans) { segs.push({ type: 'trans', eff: it.trans, dur: it.dur, start: t, end: t + it.dur }); t += it.dur; }
      else { segs.push({ type: 'page', page: it.page, kind: it.kind, fadeAt: it.fadeAt, start: t, end: t + it.dur }); t += it.dur; }
    });
    TOTAL = t;
    // exit = cuánto sigue moviéndose la página DESPUÉS de su fin (tapada por el
    // negro): la duración de su transición de salida, o el OUTRO si es la última.
    for (var j = 0; j < segs.length; j++) {
      var s = segs[j]; if (s.type !== 'page') continue;
      var post = segs[j + 1] && segs[j + 1].type === 'trans' ? segs[j + 1] : null;
      s.exit = post ? post.dur : OUTRO;
    }
    // enlaces de cada transición con la página saliente / entrante
    for (var m = 0; m < segs.length; m++) {
      if (segs[m].type !== 'trans') continue;
      for (var a = m - 1; a >= 0; a--) if (segs[a].type === 'page') { segs[m].fromSeg = segs[a]; break; }
      for (var b = m + 1; b < segs.length; b++) if (segs[b].type === 'page') { segs[m].toSeg = segs[b]; break; }
    }
  })();
  // Índice de tramos de scroll por página (para copiar velocidad entre páginas).
  var pageScrollSeg = {};
  segs.forEach(function (s) { if (s.type === 'page' && s.kind === 'scroll') pageScrollSeg[s.page] = s; });

  // ====== easings ======
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeIO(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

  // ====== transform por página (en función del tiempo absoluto) ======
  function applyPage(f, seg, t) {
    var H = frames.clientHeight, ch = f._h || H;
    var elapsed = Math.max(0, t - seg.start);     // puede exceder su dur (sigue tras el fin)
    var dur = seg.end - seg.start;
    var s = 1, ty = 0, oy = '0%';
    if (seg.kind === 'zoomout') {
      // Zoom-out a ritmo fijo y lento (HOME_ZOOM_SPAN), independiente de la
      // duración del tramo: la transición entra antes y el zoom NO termina.
      oy = '35%';
      var q = clamp(elapsed / HOME_ZOOM_SPAN, 0, 1);
      s = 1.12 - 0.12 * easeOut(q);                // 1.12 → 1.0
      ty = -0.03 * Math.max(0, s * ch - H);
    } else { // scroll vertical a velocidad constante (ya se mueve al quitar el fundido)
      oy = '0%';
      var D = Math.max(0, ch - H);
      var v;
      if (seg.speedFrom != null && pageScrollSeg[seg.speedFrom]) {
        // Copia la velocidad (px/s) de otra página de scroll, medida en tiempo real.
        var rs = pageScrollSeg[seg.speedFrom];
        var rf = iframes[rs.page], rD = Math.max(0, (rf._h || H) - H), rdur = rs.end - rs.start;
        var rfade = rs.fadeAt || 0.7;
        v = rdur > 0 ? (rfade * rD / rdur) : 0;
      } else {
        var fadeAt = seg.fadeAt || 0.7;            // fracción recorrida cuando empieza la salida
        v = dur > 0 ? (fadeAt * D / dur) : 0;      // sigue a la misma velocidad durante el fundido
      }
      ty = -Math.min(D, v * elapsed);
    }
    f.style.transformOrigin = '50% ' + oy;
    f.style.transform = 'translate(0px,' + ty.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
  }

  var activeIdx = 0;
  function setActive(i) {
    if (i === activeIdx) return;
    iframes[activeIdx].classList.remove('is-active');
    iframes[i].classList.add('is-active');
    activeIdx = i;
  }

  // ====== capa negra (canvas): intro, outro y transiciones ======
  var canvas = document.getElementById('cy-canvas');
  var ctx = canvas.getContext('2d');
  var CW = 0, CH = 0;
  function sizeCanvas() { var r = canvas.getBoundingClientRect(); CW = canvas.width = Math.max(1, Math.round(r.width)); CH = canvas.height = Math.max(1, Math.round(r.height)); }

  function overlayAlpha(t, s, k) {
    var a = 0;
    if (s.type === 'trans') { var c = 1 - Math.abs(2 * k - 1); a = Math.min(1, c * c * (3 - 2 * c) * 1.12); } // fundido suave (curva eased, no lineal)
    if (t < INTRO) a = Math.max(a, 1 - easeIO(t / INTRO));                    // fundido de entrada
    if (t > TOTAL - OUTRO) a = Math.max(a, easeIO((t - (TOTAL - OUTRO)) / OUTRO)); // fundido final
    return a;
  }
  function paintBlack(a) {
    if (a <= 0.002) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CW, CH);
    ctx.globalAlpha = 1;
  }

  // ====== render ======
  function render(t) {
    t = clamp(t, 0, TOTAL);
    var s = segAt(t), k = (t - s.start) / (s.end - s.start);
    if (!CW) sizeCanvas();
    ctx.clearRect(0, 0, CW, CH);
    if (s.type === 'page') {
      setActive(s.page);
      applyPage(iframes[s.page], s, t);
    } else { // transición: la saliente sigue su movimiento; a mitad se cambia a la entrante
      if (k < 0.5) { setActive(s.fromSeg.page); applyPage(iframes[s.fromSeg.page], s.fromSeg, t); }
      else { setActive(s.toSeg.page); applyPage(iframes[s.toSeg.page], s.toSeg, t); }
    }
    paintBlack(overlayAlpha(t, s, k));
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
  function seek(t) { cur = clamp(t, 0, TOTAL); render(cur); }
  function frame(now) { if (!playing) return; var dt = (now - last) / 1000; last = now; cur += dt; if (cur >= TOTAL) { if (loop) cur -= TOTAL; else { cur = TOTAL; render(cur); pause(); return; } } render(cur); requestAnimationFrame(frame); }
  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);
  loopBtn.addEventListener('click', function () { loop = !loop; loopBtn.classList.toggle('loop-on', loop); loopBtn.classList.toggle('loop-off', !loop); loopBtn.setAttribute('aria-pressed', loop ? 'true' : 'false'); });

  var tl = document.getElementById('timeline');
  function seekFromEvent(e) { var r = tl.getBoundingClientRect(), cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0].clientX) || 0; seek(clamp((cx - r.left) / r.width, 0, 1) * TOTAL); }
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
