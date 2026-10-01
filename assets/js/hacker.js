/* Animaciones del tema "hacker": matrix, glitch, tecleo, revelado y filtros */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Lluvia "Matrix" en el fondo del sidebar --- */
  function initMatrix() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || reduceMotion) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'hx-matrix';
    canvas.setAttribute('aria-hidden', 'true');
    sidebar.prepend(canvas);

    const ctx = canvas.getContext('2d');
    const chars = 'アカサタナハマヤラワ0123456789ABCDEF<>/$#{}[];:';
    const size = 14;
    let columns = [];
    let width = 0;
    let height = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = sidebar.clientWidth;
      height = sidebar.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Array.from({ length: Math.ceil(width / size) }, () => Math.random() * -50);
    }

    let last = 0;
    function draw(t) {
      requestAnimationFrame(draw);
      if (t - last < 55 || document.hidden) return;
      last = t;

      ctx.fillStyle = 'rgba(7, 10, 15, 0.18)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = size + 'px "JetBrains Mono", monospace';

      columns.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() > 0.96 ? '#e8ffd0' : '#9fef00';
        ctx.fillText(ch, i * size, y * size);
        columns[i] = y * size > height && Math.random() > 0.975 ? 0 : y + 1;
      });
    }

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(draw);
  }

  /* --- Glitch periódico en el título --- */
  function initGlitch() {
    const sidebarTitle = document.querySelector('#sidebar .site-title');
    if (sidebarTitle) sidebarTitle.setAttribute('data-text', sidebarTitle.textContent.trim());
    if (reduceMotion) return;

    document.querySelectorAll('#sidebar .site-title, .hx-rm-title').forEach((title) => {
      setInterval(() => {
        title.classList.add('hx-glitching');
        setTimeout(() => title.classList.remove('hx-glitching'), 650);
      }, 7000);
    });
  }

  /* --- Escribe un texto carácter a carácter --- */
  function typeText(el, text, speed) {
    return new Promise((resolve) => {
      let i = 0;
      el.textContent = '';
      (function step() {
        if (i <= text.length) {
          el.textContent = text.slice(0, i++);
          setTimeout(step, speed + Math.random() * speed);
        } else {
          resolve();
        }
      })();
    });
  }

  function caret() {
    const c = document.createElement('span');
    c.className = 'hx-caret';
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  /* --- Subtítulo del sidebar tecleado --- */
  function initSubtitle() {
    const sub = document.querySelector('#sidebar .site-subtitle');
    if (!sub) return;
    const text = sub.textContent.trim();
    sub.setAttribute('aria-label', text);

    const span = document.createElement('span');
    span.textContent = text;
    sub.textContent = '';
    sub.append(span, caret());

    if (!reduceMotion) typeText(span, text, 35);
  }

  /* --- ASCII de la portada: una línea por span para animar la onda --- */
  function initAscii() {
    const pre = document.querySelector('.hx-ascii');
    if (!pre) return;
    const lines = pre.textContent.replace(/\n+$/, '').split('\n');
    pre.textContent = '';
    lines.forEach((line, i) => {
      const span = document.createElement('span');
      span.className = 'hx-al';
      span.style.setProperty('--i', i);
      span.textContent = line || ' ';
      pre.append(span);
    });
  }

  /* --- Terminal de la portada --- */
  async function initTerminal() {
    const term = document.querySelector('.hx-term-body');
    if (!term) return;

    const steps = Array.from(term.querySelectorAll('.hx-step'));
    const end = caret();

    if (reduceMotion) {
      steps[steps.length - 1].querySelector('.hx-out').append(end);
      return;
    }

    steps.forEach((s) => s.classList.add('hx-pending'));

    for (const step of steps) {
      const cmd = step.querySelector('.hx-cmd');
      const text = cmd.textContent;
      step.classList.remove('hx-pending');
      step.classList.add('hx-typing');
      cmd.after(end);
      await typeText(cmd, text, 45);
      await new Promise((r) => setTimeout(r, 250));
      step.classList.remove('hx-typing');
    }

    const prompt = document.createElement('div');
    prompt.className = 'hx-step';
    prompt.innerHTML = term.querySelector('.hx-prompt').outerHTML + ' ';
    prompt.append(end);
    term.append(prompt);
  }

  /* --- Revelado de elementos al hacer scroll --- */
  function initReveal() {
    const selectors = [
      '#post-list .card-wrapper',
      '.hx-card',
      '.hx-hero',
      '#archives li',
      '.categories',
      '#tags > div',
      '.content > h2',
      '.content > div.highlighter-rouge',
      '.content > table',
      '.hx-rm-hero',
      '.hx-rm-platform',
      '.post-preview'
    ];
    const items = document.querySelectorAll(selectors.join(','));
    if (!('IntersectionObserver' in window) || reduceMotion) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('hx-in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -40px 0px' }
    );

    // Retraso escalonado entre hermanos
    items.forEach((el) => {
      const siblings = Array.from(el.parentElement.children);
      const idx = Math.min(siblings.indexOf(el), 8);
      el.style.setProperty('--hx-delay', idx * 0.07 + 's');
      el.classList.add('hx-reveal');
      io.observe(el);
    });
  }

  /* --- Brillo que sigue al ratón en las tarjetas --- */
  function initCardGlow() {
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.hx-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - r.left + 'px');
      card.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  }

  /* --- Barra de progreso de lectura --- */
  function initProgress() {
    const bar = document.createElement('div');
    bar.id = 'hx-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.append(bar);

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = max > 0 ? (window.scrollY / max) * 100 + '%' : '0';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* --- Filtros de la sección Write-ups --- */
  function initFilters() {
    document.querySelectorAll('.hx-filters').forEach((group) => {
      const grid = document.getElementById(group.dataset.target);
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll('[data-keys]'));
      const empty = document.getElementById(group.dataset.empty);

      group.addEventListener('click', (e) => {
        const btn = e.target.closest('.hx-filter');
        if (!btn) return;

        group.querySelectorAll('.hx-filter').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });

        const f = btn.dataset.filter;
        let visible = 0;
        cards.forEach((card) => {
          const keys = (card.dataset.keys || '').toLowerCase().split(' ');
          const show = f === 'all' || keys.includes(f);
          card.hidden = !show;
          if (show) visible++;
        });
        if (empty) empty.classList.toggle('is-visible', cards.length > 0 && visible === 0);
      });
    });
  }

  function init() {
    initMatrix();
    initGlitch();
    initSubtitle();
    initAscii();
    initTerminal();
    initReveal();
    initCardGlow();
    initProgress();
    initFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
