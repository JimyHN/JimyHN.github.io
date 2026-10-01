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

  /* --- ASCII de la portada: efecto de imagen rayada a ráfagas --- */
  function initAscii() {
    const pre = document.querySelector('.hx-ascii');
    if (!pre) return;
    const text = pre.textContent.replace(/\n+$/, '');
    pre.dataset.text = text;
    pre.textContent = '';
    const lines = text.split('\n').map((line) => {
      const span = document.createElement('span');
      span.className = 'hx-al';
      span.textContent = line || ' ';
      pre.append(span);
      return span;
    });
    if (reduceMotion) return;

    const scan = document.createElement('span');
    scan.className = 'hx-scanline';
    scan.setAttribute('aria-hidden', 'true');
    pre.append(scan);

    function burst() {
      pre.classList.add('hx-glitch');
      // 2-4 franjas de 1-3 líneas desplazadas
      const torn = [];
      const strips = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < strips; i++) {
        const start = Math.floor(Math.random() * lines.length);
        const height = 1 + Math.floor(Math.random() * 3);
        const dx = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 10) + 'px';
        for (let j = start; j < Math.min(start + height, lines.length); j++) {
          lines[j].style.setProperty('--dx', dx);
          lines[j].classList.add('hx-tear');
          torn.push(lines[j]);
        }
      }
      setTimeout(() => {
        pre.classList.remove('hx-glitch');
        torn.forEach((l) => l.classList.remove('hx-tear'));
      }, 120 + Math.random() * 200);
      // a veces dos rayadas seguidas
      setTimeout(burst, Math.random() < 0.3 ? 250 : 1800 + Math.random() * 2600);
    }
    setTimeout(burst, 1500);
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

  /* --- Panel de filtros de máquinas: dificultad + SO + plataforma + nombre --- */
  const normalize = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function initFilterBars() {
    document.querySelectorAll('.hx-fbar').forEach((bar) => {
      const container = document.getElementById(bar.dataset.target);
      if (!container) return;
      const items = Array.from(container.querySelectorAll('[data-name]'));
      const sections = Array.from(container.querySelectorAll('section'));
      const empty = document.getElementById(bar.dataset.empty);
      const count = bar.querySelector('.hx-fbar-count b');
      const input = bar.querySelector('.hx-search input');
      const reset = bar.querySelector('.hx-fbar-reset');
      const state = { diff: 'all', os: 'all', platform: 'all', q: '' };

      function apply() {
        let visible = 0;
        items.forEach((el) => {
          const ok =
            (state.diff === 'all' || el.dataset.diff === state.diff) &&
            (state.os === 'all' || el.dataset.os === state.os) &&
            (state.platform === 'all' || el.dataset.platform === state.platform) &&
            (!state.q || normalize(el.dataset.name).includes(state.q));
          el.hidden = !ok;
          if (ok) visible++;
        });
        // Secciones del roadmap sin filas visibles se ocultan
        sections.forEach((sec) => {
          sec.hidden = !sec.querySelector('[data-name]:not([hidden])');
        });
        if (count) {
          count.textContent = visible;
          count.classList.remove('hx-bump');
          void count.offsetWidth; // reinicia la animación
          count.classList.add('hx-bump');
        }
        if (empty) empty.classList.toggle('is-visible', items.length > 0 && visible === 0);
        const dirty = state.diff !== 'all' || state.os !== 'all' || state.platform !== 'all' || state.q;
        if (reset) reset.hidden = !dirty;
      }

      function select(group, value) {
        state[group.dataset.group] = value;
        group.querySelectorAll('.hx-opt').forEach((b) => {
          const on = b.dataset.value === value;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }

      bar.querySelectorAll('.hx-seg').forEach((group) => {
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.hx-opt');
          if (!btn) return;
          select(group, btn.dataset.value);
          apply();
        });
      });

      input.addEventListener('input', () => {
        state.q = normalize(input.value.trim());
        apply();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          input.value = '';
          state.q = '';
          apply();
          input.blur();
        }
      });

      reset.addEventListener('click', () => {
        bar.querySelectorAll('.hx-seg').forEach((g) => select(g, 'all'));
        input.value = '';
        state.q = '';
        apply();
      });
    });

    // Atajo: "/" enfoca el buscador
    document.addEventListener('keydown', (e) => {
      const input = document.querySelector('.hx-fbar .hx-search input');
      if (!input || e.key !== '/' || e.ctrlKey || e.metaKey) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      e.preventDefault();
      input.focus();
    });
  }

  /* --- Nombre del sitio en la pestaña con letra monoespaciada (Unicode) ---
     El <title> del HTML se queda normal para buscadores y lectores de pantalla. */
  function toMono(text) {
    return Array.from(text)
      .map((ch) => {
        const c = ch.codePointAt(0);
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d670 + c - 65); // A-Z
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d68a + c - 97); // a-z
        return ch;
      })
      .join('');
  }

  function initTabTitle() {
    const meta = document.querySelector('meta[property="og:site_name"]');
    const name = meta ? meta.content : '';
    if (!name || !document.title.includes(name)) return;
    document.title = document.title.replace(name, toMono(name));
  }

  function init() {
    initMatrix();
    initGlitch();
    initSubtitle();
    initTabTitle();
    initAscii();
    initTerminal();
    initReveal();
    initCardGlow();
    initProgress();
    initFilterBars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
