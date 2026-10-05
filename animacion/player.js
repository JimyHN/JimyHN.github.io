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
        st.textContent = '::-webkit-scrollbar{width:0;height:0}html{scrollbar-width:none}';
        d.head.appendChild(st);
      } catch (e) { /* mismo origen gracias al proxy */ }
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
  function maxScroll(f) {
    try {
      var d = f.contentDocument; if (!d) return 0;
      var el = d.scrollingElement || d.documentElement || d.body;
      return Math.max(0, el.scrollHeight - f.clientHeight);
    } catch (e) { return 0; }
  }
  function setScroll(f, p) {
    try { f.contentWindow.scrollTo(0, Math.round(p * maxScroll(f))); } catch (e) { /* aún cargando */ }
  }

  // ---------- capa ciber (TV encendiéndose/apagándose + glitch) ----------
  var cyber = document.getElementById('cyber');
  function setCyber(v) {
    if (!v) { cyber.classList.add('hide'); return; }
    cyber.classList.remove('hide');
    cyber.style.setProperty('--reveal', v.reveal != null ? v.reveal : 1);
    cyber.style.setProperty('--line', v.line || 0);
    cyber.style.setProperty('--glitch', v.glitch || 0);
    cyber.style.setProperty('--black', v.black || 0);
  }
  // r: 0 = pantalla tapada (negra), 1 = abierta (blog visible)
  function tv(r) {
    r = Math.max(0, Math.min(1, r));
    var line = r < 0.35 ? (r / 0.35) : Math.max(0, 1 - (r - 0.35) / 0.35);
    return { reveal: r, line: line, glitch: Math.max(0, 1 - r) * 0.9, black: r < 0.04 ? 1 : 0 };
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
      setActive(s.page); setScroll(iframes[s.page], 0); setCyber(tv(k));
    } else if (s.type === 'outro') {
      setActive(s.page); setScroll(iframes[s.page], 1); setCyber(tv(1 - k));
    } else if (s.type === 'scroll') {
      setActive(s.page); setScroll(iframes[s.page], k); setCyber(null);
    } else { // trans: cambia de página con un destello ciber
      if (k < 0.5) { setActive(s.from); setScroll(iframes[s.from], 1); }
      else { setActive(s.to); setScroll(iframes[s.to], 0); }
      var mid = 1 - Math.abs(k - 0.5) * 2; // 0 → 1 → 0
      setCyber({ reveal: 1, line: 0, glitch: 0.5 + mid * 0.5, black: mid * 0.55 });
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
  window.addEventListener('resize', function () { render(cur); });

  // Estado inicial: segundo 0, en pausa, esperando play.
  syncButtons();
  render(0);
})();
