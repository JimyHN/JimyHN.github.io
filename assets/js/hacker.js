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

  /* --- Efectos de la foto de perfil ---
     Cada efecto: anticipación → efecto → 2 s finales volviendo suavemente al origen.
     Tras cada efecto se esperan 10 s y sale otro al azar; un efecto no se repite
     hasta que hayan salido otros 3. */
  function initAvatarFx() {
    const avatar = document.querySelector('#sidebar #avatar');
    const img = avatar && avatar.querySelector('img');
    if (!img || reduceMotion || !avatar.animate) return;

    const ICON = '/assets/img/avatar-icono.png'; // calavera de icono1MB_sinfondo
    const PHOTO = img.src;
    new Image().src = ICON; // precarga
    const BASE_GLOW = '0 0 24px rgba(159, 239, 0, 0.25)';
    const P = 'perspective(700px) ';
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const play = (el, frames, opts) => el.animate(frames, { fill: 'forwards', ...opts }).finished;
    const size = () => avatar.getBoundingClientRect().width || 112;

    const fx = document.createElement('div');
    fx.className = 'hx-fx';
    fx.setAttribute('aria-hidden', 'true');
    avatar.append(fx);

    const make = (cls, parent = fx, tag = 'i') => {
      const e = document.createElement(tag);
      e.className = cls;
      parent.append(e);
      return e;
    };

    // Limpia las animaciones "forwards" de un elemento al terminar
    const reset = (...els) => els.forEach((el) => el.getAnimations().forEach((an) => an.cancel()));

    // Pulso verde de "colocado" (se desvanece solo)
    const settle = () => avatar.animate(
      [
        { boxShadow: '0 0 0 0 rgba(159, 239, 0, 0.7), ' + BASE_GLOW },
        { boxShadow: '0 0 0 16px rgba(159, 239, 0, 0), ' + BASE_GLOW }
      ],
      { duration: 1400, easing: 'ease-out' }
    ).finished;

    // Temblor previo (anticipación): se encoge y vibra cada vez más
    const tremble = (el, ms = 600, amp = 3) => play(el, [
      { transform: 'scale(1) translateX(0)' },
      { transform: `scale(0.96) translateX(${-amp * 0.4}px)`, offset: 0.25 },
      { transform: `scale(0.95) translateX(${amp * 0.7}px)`, offset: 0.5 },
      { transform: `scale(0.94) translateX(${-amp}px)`, offset: 0.75 },
      { transform: 'scale(0.93) translateX(0)' }
    ], { duration: ms, easing: 'ease-in' });

    // 1. Moneda: se eleva, anticipa, gira, frena pasándose, vuelve y cae (6,2 s)
    async function coin() {
      await play(avatar, [
        { transform: P + 'translateY(0) rotateY(0deg)', easing: 'ease-out' },
        { transform: P + 'translateY(-14px) rotateY(0deg)', offset: 0.065, easing: 'cubic-bezier(0.35, 0, 0.35, 1)' },
        { transform: P + 'translateY(-14px) rotateY(-70deg)', offset: 0.226, easing: 'cubic-bezier(0.5, 0, 1, 0.6)' },
        { transform: P + 'translateY(-14px) rotateY(990deg)', offset: 0.516, easing: 'cubic-bezier(0, 0.6, 0.4, 1)' },
        { transform: P + 'translateY(-14px) rotateY(1200deg)', offset: 0.677, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
        { transform: P + 'translateY(-14px) rotateY(1080deg)', offset: 0.871, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
        { transform: P + 'translateY(0) rotateY(1080deg)' }
      ], { duration: 6200 });
      reset(avatar);
      await settle();
    }

    // 2. Se raya, aparece el icono 3 s, se vuelve a rayar y vuelve la foto
    async function glitchSwap(src) {
      avatar.classList.add('fx-glitch');
      await wait(320);
      img.src = src;
      await wait(340);
      avatar.classList.remove('fx-glitch');
    }

    async function glitchIcon() {
      await tremble(img, 600, 3);
      await glitchSwap(ICON);
      play(img, [{ transform: 'scale(0.93)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
      await wait(3000);
      await tremble(img, 500, 3);
      await glitchSwap(PHOTO);
      // 2 s de recuperación: restos del glitch que se desvanecen
      await play(img, [
        { transform: 'scale(0.93) translateX(-2px)', filter: 'hue-rotate(70deg) saturate(2.5) contrast(1.4)' },
        { transform: 'scale(1.02) translateX(1px)', filter: 'hue-rotate(20deg) saturate(1.4)', offset: 0.35 },
        { transform: 'scale(1) translateX(0)', filter: 'hue-rotate(0deg) saturate(1) contrast(1)' }
      ], { duration: 2000, easing: 'ease-out' });
      reset(img);
    }

    // 3. Lluvia de bits que convierte la foto en 0 y 1 (≈6,5 s)
    async function bits() {
      await play(img, [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(0.95)', filter: 'brightness(0.6)' }],
        { duration: 500, easing: 'ease-in' });

      const S = size();
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = S * dpr;
      fx.append(canvas);
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const cell = 6;
      const n = Math.ceil(S / cell);
      const sample = document.createElement('canvas');
      sample.width = sample.height = n;
      const sctx = sample.getContext('2d');
      let lum = null;
      try {
        sctx.drawImage(img, 0, 0, n, n);
        const d = sctx.getImageData(0, 0, n, n).data;
        lum = [];
        for (let i = 0; i < d.length; i += 4) lum.push((d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255);
      } catch (e) { /* sin acceso a los píxeles: solo lluvia */ }

      const drops = Array.from({ length: n }, () => -Math.random() * n);
      const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      const IN = 1300, HOLD = 2700, OUT = 2000, TOTAL = IN + HOLD + OUT;
      ctx.font = `${cell + 1}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'top';
      const start = performance.now();

      await new Promise((resolve) => {
        function frame(now) {
          const t = Math.min(now - start, TOTAL);
          const k = t < IN ? ease(t / IN) : t < IN + HOLD ? 1 : 1 - ease((t - IN - HOLD) / OUT);
          img.style.opacity = String(1 - k);
          // la foto vuelve de tamaño y brillo durante los 2 s finales
          const back = t < IN + HOLD ? 0 : ease((t - IN - HOLD) / OUT);
          img.style.transform = `scale(${0.95 + 0.05 * back})`;
          img.style.filter = `brightness(${0.6 + 0.4 * back})`;

          ctx.clearRect(0, 0, S, S);
          ctx.save();
          ctx.beginPath();
          ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
          ctx.clip();
          if (lum) {
            for (let y = 0; y < n; y++) {
              for (let x = 0; x < n; x++) {
                const l = lum[y * n + x];
                ctx.fillStyle = `rgba(159, 239, 0, ${(0.15 + l * 0.85) * k})`;
                ctx.fillText(l > 0.45 ? '1' : '0', x * cell, y * cell);
              }
            }
          }
          drops.forEach((y, i) => {
            for (let j = 0; j < 6; j++) {
              ctx.fillStyle = `rgba(${j === 0 ? '230, 255, 200' : '159, 239, 0'}, ${(1 - j / 6) * k})`;
              ctx.fillText(Math.random() < 0.5 ? '0' : '1', i * cell, (y - j) * cell);
            }
            drops[i] = y > n + 6 ? -Math.random() * 8 : y + 0.5;
          });
          ctx.restore();
          if (t < TOTAL) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      reset(img);
      Object.assign(img.style, { opacity: '', transform: '', filter: '' });
      canvas.remove();
    }

    // 4. Se agrieta, estalla en pedazos y se recompone (≈4,3 s + pulso)
    async function shatter() {
      const S = size();
      const round = document.createElement('canvas');
      round.width = round.height = S * 2;
      const rctx = round.getContext('2d');
      rctx.beginPath();
      rctx.arc(S, S, S, 0, Math.PI * 2);
      rctx.clip();
      rctx.drawImage(img, 0, 0, S * 2, S * 2);
      let url;
      try { url = round.toDataURL(); } catch (e) { return; }

      // Anticipación: tiembla cada vez más fuerte con destellos
      await play(img, [
        { transform: 'translate(0, 0)', filter: 'brightness(1)' },
        { transform: 'translate(-1px, 1px)', filter: 'brightness(1.2)', offset: 0.2 },
        { transform: 'translate(2px, -1px)', filter: 'brightness(0.9)', offset: 0.4 },
        { transform: 'translate(-3px, 2px)', filter: 'brightness(1.4)', offset: 0.6 },
        { transform: 'translate(4px, -2px)', filter: 'brightness(0.9)', offset: 0.8 },
        { transform: 'translate(0, 0) scale(0.96)', filter: 'brightness(1.6)' }
      ], { duration: 700, easing: 'ease-in' });

      const G = 9;
      const t = S / G;
      const pieces = [];
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const p = make('hx-shard', fx, 'span');
          Object.assign(p.style, {
            left: x * t + 'px', top: y * t + 'px', width: t + 0.5 + 'px', height: t + 0.5 + 'px',
            backgroundImage: `url(${url})`, backgroundSize: `${S}px ${S}px`,
            backgroundPosition: `${-x * t}px ${-y * t}px`
          });
          pieces.push({ p, x: x - G / 2 + 0.5, y: y - G / 2 + 0.5 });
        }
      }
      reset(img);
      img.style.opacity = '0';
      // 0,9 s estallido · 0,5 s flotando · 2,2 s volviendo despacio
      await Promise.all(pieces.map(({ p, x, y }) => {
        const dist = 40 + Math.random() * 70;
        const len = Math.hypot(x, y) || 1;
        const dx = (x / len) * dist + (Math.random() - 0.5) * 30;
        const dy = (y / len) * dist + (Math.random() - 0.5) * 30;
        const rot = (Math.random() - 0.5) * 540;
        const out = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${0.4 + Math.random() * 0.5})`;
        const drift = `translate(${dx * 1.08}px, ${dy * 1.08 + 4}px) rotate(${rot * 1.1}deg) scale(0.6)`;
        return p.animate([
          { transform: 'scale(0.96)', opacity: 1, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
          { transform: out, opacity: 0.85, offset: 0.25, easing: 'linear' },
          { transform: drift, opacity: 0.8, offset: 0.39, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
          { transform: 'none', opacity: 1 }
        ], { duration: 3600, delay: Math.random() * 120, fill: 'forwards' }).finished;
      }));
      img.style.opacity = '';
      pieces.forEach(({ p }) => p.remove());
      await settle();
    }

    // Frena poco a poco una animación infinita (giro) mientras dura `ms`
    function slowDown(anims, ms) {
      const start = performance.now();
      return new Promise((resolve) => {
        (function step(now) {
          const k = Math.min((now - start) / ms, 1);
          anims.forEach((an) => { an.playbackRate = Math.max(0.05, 1 - k); });
          if (k < 1) requestAnimationFrame(step);
          else resolve();
        })(start);
      });
    }

    // 5. Aura de energía: inspira, estalla en energía y se apaga despacio (≈5,5 s)
    async function aura() {
      await play(avatar, [{ transform: 'scale(1)' }, { transform: 'scale(0.93)' }], { duration: 600, easing: 'ease-in-out' });
      const ring = make('hx-aura-ring');
      const orbit = make('hx-orbit');
      const dots = Array.from({ length: 6 }, (_, i) => ({ b: make('', orbit, 'b'), a: i * 60 }));

      play(avatar, [{ transform: 'scale(0.93)' }, { transform: 'scale(1.04)', offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 700, easing: 'ease-out' });
      const spins = [
        ring.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 900, iterations: Infinity }),
        orbit.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 2200, iterations: Infinity })
      ];
      play(ring, [{ opacity: 0, scale: '0.85' }, { opacity: 1, scale: '1' }], { duration: 600, easing: 'ease-out' });
      dots.forEach(({ b, a }) => play(b, [
        { transform: `rotate(${a}deg) translateX(30px)`, opacity: 0 },
        { transform: `rotate(${a}deg) translateX(74px)`, opacity: 1 }
      ], { duration: 800, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }));
      const glow = avatar.animate([
        { boxShadow: '0 0 30px 6px rgba(159, 239, 0, 0.55), 0 0 70px 14px rgba(46, 230, 214, 0.25)' },
        { boxShadow: '0 0 18px 2px rgba(159, 239, 0, 0.4), 0 0 50px 8px rgba(46, 230, 214, 0.18)' }
      ], { duration: 700, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });

      await wait(2600);

      // 2 s finales: el giro frena, el anillo y las partículas se apagan, el brillo baja
      const shadow = getComputedStyle(avatar).boxShadow;
      glow.cancel();
      await Promise.all([
        slowDown(spins, 2000),
        play(ring, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.85' }], { duration: 2000, easing: 'ease-in-out' }),
        ...dots.map(({ b, a }) => play(b, [
          { transform: `rotate(${a}deg) translateX(74px)`, opacity: 1 },
          { transform: `rotate(${a}deg) translateX(40px)`, opacity: 0 }
        ], { duration: 2000, easing: 'ease-in-out' })),
        play(avatar, [{ boxShadow: shadow }, { boxShadow: BASE_GLOW }], { duration: 2000, easing: 'ease-in-out' })
      ]);
      spins.forEach((an) => an.cancel());
      reset(avatar);
      ring.remove();
      orbit.remove();
    }

    // 6. Holograma: parpadea, se vuelve holograma con visor y se desvanece (≈6,4 s)
    async function holo() {
      const hud = make('hx-hud');
      make('hx-hud-ring');
      make('hx-hud-scan');
      fx.classList.add('is-holo');
      const D = 6400;
      // 0-0,5 s anticipación (parpadeo) · 0,5-1,1 s entra · 1,1-4,4 s holograma · 4,4-6,4 s vuelve
      const tint = 'grayscale(1) sepia(1) hue-rotate(130deg) saturate(3) brightness(1.1)';
      const none = 'grayscale(0) sepia(0) hue-rotate(0deg) saturate(1) brightness(1)';
      await Promise.all([
        play(img, [
          { filter: none, opacity: 1, transform: 'scale(1)' },
          { filter: none, opacity: 0.4, transform: 'scale(0.97)', offset: 0.03 },
          { filter: none, opacity: 1, transform: 'scale(0.97)', offset: 0.05 },
          { filter: none, opacity: 0.5, transform: 'scale(0.97)', offset: 0.078 },
          { filter: tint, opacity: 0.85, transform: 'scale(1)', offset: 0.17 },
          { filter: tint, opacity: 0.6, transform: 'scale(1)', offset: 0.35 },
          { filter: tint, opacity: 0.95, transform: 'scale(1)', offset: 0.37 },
          { filter: tint, opacity: 0.45, transform: 'scale(1)', offset: 0.39 },
          { filter: tint, opacity: 0.85, transform: 'scale(1)', offset: 0.55 },
          { filter: tint, opacity: 0.85, transform: 'scale(1)', offset: 0.6875, easing: 'ease-in-out' },
          { filter: none, opacity: 1, transform: 'scale(1)' }
        ], { duration: D }),
        play(fx, [
          { opacity: 0 }, { opacity: 0, offset: 0.078 }, { opacity: 1, offset: 0.17 },
          { opacity: 1, offset: 0.6875, easing: 'ease-in-out' }, { opacity: 0 }
        ], { duration: D }),
        play(hud, [
          { transform: 'scale(1.5) rotate(45deg)', opacity: 0 },
          { transform: 'scale(1.5) rotate(45deg)', opacity: 0, offset: 0.078, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
          { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0.2 },
          { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0.6875, easing: 'ease-in-out' },
          { transform: 'scale(1.25) rotate(-20deg)', opacity: 0 }
        ], { duration: D })
      ]);
      reset(img, fx);
      fx.classList.remove('is-holo');
      fx.innerHTML = '';
    }

    const effects = [coin, glitchIcon, bits, shatter, aura, holo];
    const recent = [];

    (async function loop() {
      await wait(4000);
      for (;;) {
        if (!document.hidden) {
          const pool = effects.map((_, i) => i).filter((i) => !recent.includes(i));
          const i = pool[Math.floor(Math.random() * pool.length)];
          recent.push(i);
          if (recent.length > 3) recent.shift();
          try { await effects[i](); } catch (e) { /* un efecto fallido no para el resto */ }
        }
        await wait(10000);
      }
    })();
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

  /* --- Frases rotatorias bajo el nombre del sidebar ---
     La frase anterior desaparece de golpe y la siguiente se escribe letra a letra (0,1 s).
     Una frase puede ser un texto o un guion de pasos (ver _data/frases.yml).
     Los 10 s hasta la siguiente cuentan desde que termina de escribirse. */
  function initSubtitle() {
    const sub = document.querySelector('#sidebar .site-subtitle');
    if (!sub) return;

    let phrases = [];
    try {
      phrases = JSON.parse(document.getElementById('hx-frases').textContent) || [];
    } catch (e) { /* sin frases: se queda el subtítulo del sitio */ }
    if (!phrases.length) phrases = [sub.textContent.trim()];

    const span = document.createElement('span');
    const cursor = caret();
    sub.textContent = '';
    sub.append(span, cursor);

    const finalText = (p) => {
      if (typeof p === 'string') return p;
      let t = [];
      (p.pasos || []).forEach((st) => {
        if (st.escribe) t = t.concat(Array.from(st.escribe));
        if (st.borra !== undefined) t = st.borra === 'todo' ? [] : t.slice(0, -st.borra);
      });
      return t.join('');
    };

    if (reduceMotion) {
      span.textContent = finalText(phrases.find((p) => typeof p === 'string') || phrases[0]);
      return;
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const chars = () => Array.from(span.textContent); // respeta los emojis
    // Mientras escribe/borra el cursor no parpadea
    const busy = (on) => cursor.classList.toggle('hx-caret-busy', on);

    async function erase(n) {
      busy(true);
      let left = n === 'todo' || n === undefined ? chars().length : n;
      while (left-- > 0 && chars().length) {
        span.textContent = chars().slice(0, -1).join('');
        await wait(55);
      }
      busy(false);
    }

    async function write(text) {
      busy(true);
      for (const ch of Array.from(text)) {
        span.textContent += ch;
        await wait(100);
      }
      busy(false);
    }

    async function glitch(ms) {
      const original = span.textContent;
      const symbols = '!<>-_\\/[]{}=+*^?#$%&@01';
      sub.classList.add('hx-sub-glitch');
      const end = Date.now() + ms;
      while (Date.now() < end) {
        span.textContent = Array.from(original)
          .map((ch) => (ch !== ' ' && Math.random() < 0.45 ? symbols[Math.floor(Math.random() * symbols.length)] : ch))
          .join('');
        await wait(60);
      }
      span.textContent = original;
      sub.classList.remove('hx-sub-glitch');
    }

    async function play(p) {
      if (typeof p === 'string') return write(p);
      for (const st of p.pasos || []) {
        if (st.escribe) await write(st.escribe);
        else if (st.borra !== undefined) await erase(st.borra);
        else if (st.espera) await wait(st.espera);
        else if (st.rayar) await glitch(st.rayar);
      }
    }

    // Aleatorio, pero una frase no puede repetirse hasta que hayan salido otras 3
    const recent = [];
    const COOLDOWN = Math.min(3, phrases.length - 1);
    function next() {
      const pool = phrases.map((_, i) => i).filter((i) => !recent.includes(i));
      const i = pool[Math.floor(Math.random() * pool.length)];
      recent.push(i);
      if (recent.length > COOLDOWN) recent.shift();
      return phrases[i];
    }

    (async function loop() {
      for (;;) {
        if (span.textContent) {
          span.textContent = ''; // la frase anterior desaparece entera de golpe
          await wait(300);
        }
        await play(next());
        await wait(10000);
      }
    })();
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

    const originals = lines.map((l) => l.textContent);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const SYM = '!<>-_\\/[]{}=+*^?#$%&@01';
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clear = () => {
      pre.className = 'hx-ascii';
      lines.forEach((l, i) => {
        l.className = 'hx-al';
        l.style.transform = '';
        l.style.color = '';
        l.style.opacity = '';
        l.textContent = originals[i];
      });
    };

    // 1. Franjas desplazadas + aberración de color
    async function tear() {
      pre.classList.add('hx-glitch');
      const strips = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < strips; i++) {
        const start = Math.floor(Math.random() * lines.length);
        const h = 1 + Math.floor(Math.random() * 3);
        const dx = (Math.random() < 0.5 ? -1 : 1) * rnd(3, 13) + 'px';
        for (let j = start; j < Math.min(start + h, lines.length); j++) {
          lines[j].style.setProperty('--dx', dx);
          lines[j].classList.add('hx-tear');
        }
      }
      await wait(rnd(140, 320));
    }

    // 2. Onda horizontal recorriendo las líneas
    async function wave() {
      const start = performance.now();
      const dur = 900;
      await new Promise((res) => {
        (function step(now) {
          const t = (now - start) / dur;
          lines.forEach((l, i) => {
            l.style.transform = 'translateX(' + Math.sin(t * Math.PI * 2 + i * 0.5) * 6 + 'px)';
            l.style.color = '#d6ff8a';
          });
          if (t < 1) requestAnimationFrame(step);
          else res();
        })(start);
      });
    }

    // 3. Ruido: cambia caracteres por símbolos y los recupera
    async function scramble() {
      const end = Date.now() + 650;
      while (Date.now() < end) {
        lines.forEach((l, i) => {
          l.textContent = originals[i].replace(/\S/g, (ch) =>
            Math.random() < 0.3 ? SYM[Math.floor(Math.random() * SYM.length)] : ch
          );
        });
        await wait(55);
      }
    }

    // 4. Aberración RGB fuerte con temblor, sin romper líneas
    async function split() {
      pre.classList.add('hx-glitch', 'hx-fx-shake');
      await wait(rnd(350, 600));
    }

    // 5. Parpadeo de señal
    async function flicker() {
      for (let i = 0; i < 6; i++) {
        pre.style.opacity = Math.random() < 0.5 ? '0.25' : '1';
        pre.style.filter = 'brightness(' + rnd(0.6, 1.8).toFixed(2) + ')';
        await wait(rnd(50, 110));
      }
      pre.style.opacity = '';
      pre.style.filter = '';
    }

    // 6. Sacudida/inclinación de toda la imagen
    async function jitter() {
      pre.classList.add('hx-glitch');
      for (let i = 0; i < 7; i++) {
        pre.style.transform =
          'translate(' + rnd(-4, 4).toFixed(1) + 'px,' + rnd(-3, 3).toFixed(1) + 'px) skewX(' + rnd(-6, 6).toFixed(1) + 'deg)';
        await wait(45);
      }
      pre.style.transform = '';
    }

    const effects = [tear, wave, scramble, split, flicker, jitter];
    const recent = [];

    (async function loop() {
      await wait(1500);
      for (;;) {
        if (!document.hidden) {
          const pool = effects.map((_, i) => i).filter((i) => !recent.includes(i));
          const i = pool[Math.floor(Math.random() * pool.length)];
          recent.push(i);
          if (recent.length > 3) recent.shift();
          try { await effects[i](); } catch (e) { /* un efecto no debe parar el resto */ }
          clear();
        }
        await wait(rnd(1600, 3200));
      }
    })();
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
      '#post-list .hx-mcard',
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

  /* --- Filtros de máquinas (dificultad + SO + plataforma) y botón de búsqueda --- */
  const normalize = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Pantalla "rayada" + ventana emergente de 4 s
  function notFound(query) {
    const root = document.documentElement;
    if (!reduceMotion) {
      let overlay = document.getElementById('hx-glitch-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hx-glitch-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.append(overlay);
      }
      root.classList.remove('hx-screen-glitch');
      void root.offsetWidth;
      root.classList.add('hx-screen-glitch');
      clearTimeout(root._glitchT);
      root._glitchT = setTimeout(() => root.classList.remove('hx-screen-glitch'), 900);
    }

    let modal = document.getElementById('hx-notfound');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hx-notfound';
      modal.setAttribute('role', 'alert');
      modal.innerHTML =
        '<div class="hx-nf-box">' +
        '<i class="fas fa-skull-crossbones" aria-hidden="true"></i>' +
        '<p class="hx-nf-title">Máquina no encontrada</p>' +
        '<p class="hx-nf-sub"></p>' +
        '<span class="hx-nf-bar" aria-hidden="true"></span>' +
        '</div>';
      document.body.append(modal);
      // Un clic en cualquier parte corta la animación y cierra la ventana con un fundido
      modal.addEventListener('click', () => {
        clearTimeout(modal._t);
        clearTimeout(root._glitchT);
        root.classList.remove('hx-screen-glitch');
        modal.classList.remove('is-open');
      });
    }
    modal.querySelector('.hx-nf-sub').textContent = '"' + query + '" no está en la lista';
    clearTimeout(modal._t);
    modal.classList.remove('is-open');
    void modal.offsetWidth;
    modal.classList.add('is-open');
    modal._t = setTimeout(() => modal.classList.remove('is-open'), 4000);
  }

  function initFilterBars() {
    document.querySelectorAll('.hx-fbar').forEach((bar) => {
      const container = document.getElementById(bar.dataset.target);
      if (!container) return;
      const items = Array.from(container.querySelectorAll('[data-name]'));
      const sections = Array.from(container.querySelectorAll('section'));
      const empty = document.getElementById(bar.dataset.empty);
      const count = bar.querySelector('.hx-fbar-count b');
      const form = bar.querySelector('.hx-search');
      const input = form.querySelector('input');
      const reset = bar.querySelector('.hx-fbar-reset');
      const tagBox = document.getElementById('hx-tagfilter');
      const state = { diff: 'all', os: 'all', platform: 'all', tag: 'all' };

      function setTag(tag) {
        state.tag = tag ? tag.toLowerCase() : 'all';
        if (!tagBox) return;
        if (state.tag === 'all') { tagBox.hidden = true; tagBox.innerHTML = ''; return; }
        tagBox.hidden = false;
        tagBox.innerHTML = 'Filtrando por <b>#' + state.tag + '</b> <button type="button" class="hx-tagfilter-x">✕ quitar</button>';
        tagBox.querySelector('.hx-tagfilter-x').addEventListener('click', () => {
          setTag(null); apply();
          history.replaceState(null, '', location.pathname);
        });
      }

      function apply() {
        let visible = 0;
        items.forEach((el) => {
          const ok =
            (state.diff === 'all' || el.dataset.diff === state.diff) &&
            (state.os === 'all' || el.dataset.os === state.os) &&
            (state.platform === 'all' || el.dataset.platform === state.platform) &&
            (state.tag === 'all' || (el.dataset.tags || '').split(' ').includes(state.tag));
          el.hidden = !ok;
          if (ok) visible++;
        });
        sections.forEach((sec) => {
          sec.hidden = !sec.querySelector('[data-name]:not([hidden])');
        });
        count.textContent = visible;
        if (empty) empty.classList.toggle('is-visible', items.length > 0 && visible === 0);
        reset.hidden = state.diff === 'all' && state.os === 'all' && state.platform === 'all';
      }

      function select(group, value) {
        state[group.dataset.group] = value;
        group.querySelectorAll('.hx-opt').forEach((b) => {
          const on = b.dataset.value === value;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }

      const groups = bar.querySelectorAll('.hx-seg[data-group]');
      groups.forEach((group) => {
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.hx-opt');
          if (!btn) return;
          select(group, btn.dataset.value);
          apply();
        });
      });

      reset.addEventListener('click', () => {
        groups.forEach((g) => select(g, 'all'));
        setTag(null);
        history.replaceState(null, '', location.pathname);
        apply();
      });

      // Filtro por etiqueta desde la URL (?tag=windows), p. ej. desde el panel
      const urlTag = new URLSearchParams(location.search).get('tag');
      if (urlTag) setTag(urlTag);
      apply();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = input.value.trim();
        if (!raw) {
          input.focus();
          return;
        }
        const q = normalize(raw);
        // Primero coincidencia exacta; si no, las que contengan el texto
        let found = items.filter((el) => normalize(el.dataset.name) === q);
        if (!found.length) found = items.filter((el) => normalize(el.dataset.name).includes(q));

        if (!found.length) {
          notFound(raw);
          return;
        }

        // Si los filtros la ocultan, se quitan para poder enseñarla
        if (found.every((el) => el.hidden)) {
          groups.forEach((g) => select(g, 'all'));
          apply();
        }
        const shown = found.filter((el) => !el.hidden);
        items.forEach((el) => el.classList.remove('hx-found'));
        shown.forEach((el) => {
          void el.offsetWidth;
          el.classList.add('hx-found');
        });
        shown[0].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        setTimeout(() => shown.forEach((el) => el.classList.remove('hx-found')), 3000);
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

  /* --- Secciones plegables en los write-ups ---
     Cada h2 del post se vuelve una cabecera clicable que despliega su contenido. */
  function initPostSections() {
    const content = document.querySelector('article[data-toc] .content');
    if (!content) return;

    const heads = Array.from(content.children).filter((el) => el.tagName === 'H2');
    if (!heads.length) return;

    heads.forEach((h2) => {
      // Reúne los hermanos hasta el siguiente h2
      const body = document.createElement('div');
      body.className = 'hx-acc-body is-open';
      const inner = document.createElement('div');
      inner.className = 'hx-acc-inner';
      body.append(inner);

      let node = h2.nextElementSibling;
      while (node && node.tagName !== 'H2') {
        const next = node.nextElementSibling;
        inner.append(node);
        node = next;
      }
      h2.after(body);

      h2.classList.add('hx-acc-head', 'is-open');
      const chevron = document.createElement('i');
      chevron.className = 'fas fa-chevron-down hx-acc-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      h2.append(chevron);

      const toggle = (open) => {
        h2.classList.toggle('is-open', open);
        h2.classList.toggle('is-closed', !open);
        body.classList.toggle('is-open', open);
        body.classList.toggle('is-closed', !open);
      };

      h2.addEventListener('click', () => toggle(h2.classList.contains('is-closed')));
    });

    // Si se llega a una sección por el índice (TOC), se abre sola
    const openByHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      const h2 = document.getElementById(id);
      if (h2 && h2.classList.contains('is-closed')) h2.click();
    };
    window.addEventListener('hashchange', openByHash);
    openByHash();
  }

  /* --- Destello al pulsar botones y enlaces de acción --- */
  function initButtonAura() {
    const sel = '.hx-btn, .hx-opt, .hx-filter, .hx-tile, .hx-kv, .hx-tool-toggle, .hx-search-btn, .hx-fbar-reset, .hx-cred-flipbtn, .hx-car-btn, #sidebar .nav-link';
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest(sel);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const aura = document.createElement('span');
      aura.className = 'hx-aura-flash';
      aura.style.left = e.clientX - r.left + 'px';
      aura.style.top = e.clientY - r.top + 'px';
      const pos = getComputedStyle(btn).position;
      if (pos === 'static') btn.style.position = 'relative';
      btn.append(aura);
      aura.addEventListener('animationend', () => aura.remove());
    });
  }

  /* --- Tarjetas de credencial: giro + visor de documento --- */
  function docModal() {
    let modal = document.getElementById('hx-doc-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'hx-doc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="hx-doc-box">' +
      '<button type="button" class="hx-doc-close" aria-label="Cerrar"><i class="fas fa-xmark"></i></button>' +
      '<div class="hx-doc-content"></div>' +
      '</div>';
    document.body.append(modal);

    const close = () => {
      modal.classList.remove('is-open');
      modal.querySelector('.hx-doc-content').innerHTML = '';
      document.body.style.overflow = '';
    };
    modal.querySelector('.hx-doc-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return modal;
  }

  function openDoc(url, type, title) {
    const modal = docModal();
    const content = modal.querySelector('.hx-doc-content');
    if (type === 'img') {
      content.innerHTML = '<img src="' + url + '" alt="' + (title || 'Documento') + '">';
    } else {
      content.innerHTML = '<iframe src="' + url + '#view=FitH" title="' + (title || 'Documento') + '"></iframe>';
    }
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function initCredentials() {
    document.querySelectorAll('.hx-cred.has-doc').forEach((card) => {
      const front = card.querySelector('.hx-cred-front');
      const back = card.querySelector('.hx-cred-back');
      const doc = card.querySelector('.hx-cred-doc');

      // Clic en cualquier parte de la cara frontal -> voltea
      if (front) front.addEventListener('click', () => card.classList.add('is-flipped'));

      // En la trasera: el documento abre el visor; el resto vuelve a la cara frontal
      if (doc) {
        doc.addEventListener('click', (e) => {
          e.stopPropagation();
          openDoc(card.dataset.doc, card.dataset.doctype, card.dataset.title);
        });
      }
      if (back) back.addEventListener('click', () => card.classList.remove('is-flipped'));
    });
  }

  /* --- Carrusel de títulos --- */
  function initCarousels() {
    document.querySelectorAll('.hx-carousel-sec').forEach((sec) => {
      const car = sec.querySelector('.hx-carousel');
      const prev = sec.querySelector('.hx-car-prev');
      const next = sec.querySelector('.hx-car-next');
      if (!car) return;

      const step = () => {
        const card = car.querySelector('.hx-cred');
        return card ? card.getBoundingClientRect().width + 18 : car.clientWidth;
      };
      const update = () => {
        const max = car.scrollWidth - car.clientWidth - 2;
        if (prev) prev.disabled = car.scrollLeft <= 2;
        if (next) next.disabled = car.scrollLeft >= max;
        const hide = car.scrollWidth <= car.clientWidth + 4;
        sec.querySelector('.hx-carousel-nav').style.display = hide ? 'none' : '';
      };

      if (prev) prev.addEventListener('click', () => car.scrollBy({ left: -step(), behavior: 'smooth' }));
      if (next) next.addEventListener('click', () => car.scrollBy({ left: step(), behavior: 'smooth' }));
      car.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  }

  /* --- Acordeón de herramientas --- */
  function initTools() {
    document.querySelectorAll('.hx-tool').forEach((tool) => {
      const btn = tool.querySelector('.hx-tool-toggle');
      const body = tool.querySelector('.hx-tool-body');
      if (!btn || !body) return;
      btn.addEventListener('click', () => {
        const open = tool.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  /* --- Modal "Mostrar certificado" --- */
  function initCert() {
    let ov = null;

    function build() {
      ov = document.createElement('div');
      ov.className = 'hx-cert-ov';
      ov.innerHTML =
        '<div class="hx-cert-box" role="dialog" aria-modal="true">' +
        '<div class="hx-certmod-head"><i class="fas fa-certificate" aria-hidden="true"></i>' +
        '<span class="hx-cert-title">Certificado</span>' +
        '<button type="button" class="hx-cert-close" aria-label="Cerrar">✕</button></div>' +
        '<img class="hx-cert-img" alt="Certificado de la máquina">' +
        '<div class="hx-cert-foot">' +
        '<a class="hx-cert-link" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square" aria-hidden="true"></i> Ver en HackTheBox</a>' +
        '<small>Pulsa fuera o ✕ para cerrar</small></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => {
        if (e.target === ov || e.target.closest('.hx-cert-close')) close();
      });
    }

    function open(cert, img, name) {
      if (!ov) build();
      ov.querySelector('.hx-cert-title').textContent = name ? 'Certificado · ' + name : 'Certificado';
      const im = ov.querySelector('.hx-cert-img');
      if (img) { im.src = img; im.style.display = ''; } else { im.style.display = 'none'; }
      ov.querySelector('.hx-cert-link').href = cert || '#';
      ov.classList.add('hx-open');
      document.body.classList.add('hx-cert-locked');
    }

    function close() {
      if (ov) {
        ov.classList.remove('hx-open');
        document.body.classList.remove('hx-cert-locked');
      }
    }

    document.addEventListener('click', (e) => {
      const b = e.target.closest('.hx-wu-cert');
      if (!b) return;
      e.preventDefault();
      open(b.dataset.cert, b.dataset.img, b.dataset.name);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* --- Color por página: el menú activo tiñe la página y su título --- */
  function initPageTheme() {
    const active = document.querySelector('#sidebar .nav-item.active');
    let c = active ? getComputedStyle(active).getPropertyValue('--c').trim() : '';
    // En un write-up, prioriza el color de la máquina
    const wu = document.querySelector('.hx-wu[data-accent]');
    if (wu && wu.dataset.accent) c = wu.dataset.accent;
    if (c) document.documentElement.style.setProperty('--page', c);

    const title = document.querySelector('h1.dynamic-title');
    const navIcon = active.querySelector('.nav-link i');
    if (title && navIcon && !title.querySelector('i')) {
      const ic = document.createElement('i');
      ic.className = navIcon.className;
      ic.setAttribute('aria-hidden', 'true');
      title.prepend(ic);
    }
  }

  /* --- Edad calculada al vuelo --- */
  function initAge() {
    document.querySelectorAll('.hx-age').forEach((el) => {
      const dob = el.getAttribute('data-dob');
      if (!dob) return;
      const d = new Date(dob);
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      el.textContent = age;
    });
  }

  /* --- Efectos "ciber" del logo de HackTheBox: rotan sin repetir --- */
  function initHtbFx() {
    const logo = document.getElementById('hx-htb-logo');
    if (!logo || reduceMotion) return;
    const fx = ['a', 'b', 'c', 'd', 'e'];
    let last = logo.getAttribute('data-fx') || 'a';
    (function cycle() {
      const pool = fx.filter((f) => f !== last);
      const next = pool[Math.floor(Math.random() * pool.length)];
      last = next;
      // Reinicia la animación aunque se repita algún estado intermedio
      logo.removeAttribute('data-fx');
      void logo.offsetWidth;
      logo.setAttribute('data-fx', next);
      setTimeout(cycle, 8400);
    })();
  }

  /* --- Lightbox de las capturas del write-up --- */
  function initFigures() {
    if (!document.querySelector('.hx-fig-zoom')) return;
    let ov = null, imgEl = null, capEl = null, closing = false;

    function build() {
      ov = document.createElement('div');
      ov.className = 'hx-lb';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.innerHTML =
        '<div class="hx-lb-stage">' +
        '<button type="button" class="hx-lb-close" aria-label="Cerrar">✕</button>' +
        '<img class="hx-lb-img" alt="">' +
        '<p class="hx-lb-cap"></p>' +
        '</div>';
      document.body.appendChild(ov);
      imgEl = ov.querySelector('.hx-lb-img');
      capEl = ov.querySelector('.hx-lb-cap');
      ov.addEventListener('click', (e) => {
        if (e.target === ov || e.target.closest('.hx-lb-close')) close();
      });
    }

    function open(src, cap, accent) {
      if (!ov) build();
      imgEl.src = src;
      imgEl.alt = cap || 'Captura';
      capEl.textContent = cap || '';
      capEl.style.display = cap ? '' : 'none';
      ov.style.setProperty('--m', accent || '199 21 133');
      closing = false;
      ov.classList.remove('is-closing');
      ov.classList.add('is-open');
      imgEl.classList.remove('hx-lb-pop');
      void imgEl.offsetWidth;        // reinicia la animación de escalado
      imgEl.classList.add('hx-lb-pop');
      document.body.classList.add('hx-lb-locked');
    }

    function close() {
      if (!ov || closing) return;
      closing = true;
      const done = () => {
        ov.classList.remove('is-open', 'is-closing');
        document.body.classList.remove('hx-lb-locked');
        closing = false;
        ov.removeEventListener('animationend', done);
      };
      if (reduceMotion) { done(); return; }
      ov.classList.add('is-closing');
      ov.addEventListener('animationend', done);
      setTimeout(done, 420);         // red de seguridad
    }

    document.addEventListener('click', (e) => {
      const b = e.target.closest('.hx-fig-zoom');
      if (!b) return;
      const img = b.querySelector('img');
      if (!img) return;
      const fig = b.closest('.hx-fig');
      const cap = fig && fig.querySelector('figcaption');
      const wu = b.closest('.hx-wu');
      const accent = (wu && wu.dataset.accent) || '';
      open(img.src, cap ? cap.textContent.trim() : (img.alt || ''), accent);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* --- En un write-up, oculta el título/meta por defecto del tema (duplicado
         de nuestro encabezado con avatar + nombre). --- */
  function initHideDupHeader() {
    const wu = document.querySelector('.hx-wu');
    if (!wu) return;
    const content = wu.closest('.content') || wu.parentElement;
    if (!content) return;
    let el = content.previousElementSibling;
    while (el) {
      const prev = el.previousElementSibling;
      if (el.matches('h1, .post-meta, header, .post-desc, [data-toc-skip]')) el.style.display = 'none';
      el = prev;
    }
  }

  /* --- Dashboard de Máquinas: gráficas con cross-filter (estilo Power BI) --- */
  function initMachinesDash() {
    const root = document.getElementById('hx-maqdash');
    const dataEl = document.getElementById('hx-maq-data');
    if (!root || !dataEl) return;
    let DATA = [];
    try { DATA = JSON.parse(dataEl.textContent) || []; } catch (e) { return; }
    if (!DATA.length) return;

    const SVGNS = 'http://www.w3.org/2000/svg';
    const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const normDiff = (d) => {
      d = (d || '').toLowerCase();
      if (d === 'fácil' || d === 'facil') return 'easy';
      if (d === 'media') return 'medium';
      if (d === 'difícil' || d === 'dificil') return 'hard';
      return d;
    };
    DATA.forEach((m) => {
      m.diff = normDiff(m.diff);
      m.os = (m.os || 'otros').toLowerCase();
      m.platform = (m.platform || 'hackthebox').toLowerCase();
      m.month = (m.iso || '').slice(0, 7);
      const mm = m.month.split('-');
      m.monthLabel = mm[1] ? (MES[parseInt(mm[1], 10) - 1] + " '" + mm[0].slice(2)) : m.month;
      m.nameNorm = normalize(m.name || '');
    });

    const DIFFS = [
      { key: 'easy', label: 'Easy', color: 'var(--hx-easy)' },
      { key: 'medium', label: 'Medium', color: 'var(--hx-medium)' },
      { key: 'hard', label: 'Hard', color: 'var(--hx-hard)' },
      { key: 'insane', label: 'Insane', color: 'var(--hx-insane)' }
    ];
    const OS = [
      { key: 'linux', label: 'Linux', color: '#58c7f0' },
      { key: 'windows', label: 'Windows', color: '#4a86ff' },
      { key: 'otros', label: 'Otros', color: '#9aa6b8' }
    ].filter((c) => DATA.some((m) => m.os === c.key));
    const PLAT = [
      { key: 'hackthebox', label: 'HackTheBox', color: '#9fef00' },
      { key: 'investigacion', label: 'Investigación', color: '#e23e8e' }
    ].filter((c) => DATA.some((m) => m.platform === c.key));

    const state = { diff: new Set(), month: new Set(), os: new Set(), platform: new Set(), q: '' };
    const anyFilter = () => state.diff.size || state.month.size || state.os.size || state.platform.size || state.q;

    function matches(m, ignore) {
      if (state.q && m.nameNorm.indexOf(state.q) === -1) return false;
      const dims = ['diff', 'month', 'os', 'platform'];
      for (let i = 0; i < dims.length; i++) {
        const d = dims[i];
        if (d === ignore) continue;
        if (state[d].size && !state[d].has(m[d])) return false;
      }
      return true;
    }
    const subset = (ignore) => DATA.filter((m) => matches(m, ignore));
    const countBy = (list, dim, key) => list.reduce((n, m) => n + (m[dim] === key ? 1 : 0), 0);

    // Selección ÚNICA por dimensión: clic nuevo reemplaza, clic en el activo lo quita.
    function toggle(dim, val) { const s = state[dim]; const had = s.has(val) && s.size === 1; s.clear(); if (!had) s.add(val); render(); }

    // ----- construcción del DOM (una vez) -----
    const svg = (name, attrs) => {
      const e = document.createElementNS(SVGNS, name);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };
    const polar = (cx, cy, r, deg) => {
      const a = (deg - 90) * Math.PI / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    function arcPath(cx, cy, r, a0, a1) {
      if (a1 - a0 >= 359.999) {
        const [x0, y0] = polar(cx, cy, r, a0);
        const [xm, ym] = polar(cx, cy, r, a0 + 180);
        return `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${xm} ${ym} A ${r} ${r} 0 1 1 ${x0} ${y0}`;
      }
      const [x0, y0] = polar(cx, cy, r, a0);
      const [x1, y1] = polar(cx, cy, r, a1);
      return `M ${x0} ${y0} A ${r} ${r} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
    }

    // Donut
    const donutWrap = document.getElementById('hx-maq-donut');
    const dSvg = svg('svg', { viewBox: '0 0 120 120', class: 'hx-maq-donutsvg' });
    dSvg.appendChild(svg('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: 'var(--hx-border)', 'stroke-width': 16 }));
    const dArcs = DIFFS.map((d) => {
      const p = svg('path', { fill: 'none', stroke: d.color, 'stroke-width': 16, 'stroke-linecap': 'butt', class: 'hx-maq-arc', tabindex: 0, role: 'button' });
      p.addEventListener('click', () => toggle('diff', d.key));
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('diff', d.key); } });
      dSvg.appendChild(p);
      return p;
    });
    const dCenter = document.createElement('div');
    dCenter.className = 'hx-maq-donutc';
    donutWrap.appendChild(dSvg);
    donutWrap.appendChild(dCenter);
    const dLegend = document.createElement('ul');
    dLegend.className = 'hx-maq-legend';
    const dLegItems = DIFFS.map((d) => {
      const li = document.createElement('li');
      li.className = 'hx-maq-leg';
      li.setAttribute('tabindex', '0');
      li.innerHTML = '<span class="hx-dot" style="background:' + d.color + '"></span>' + d.label + ' <b></b>';
      li.addEventListener('click', () => toggle('diff', d.key));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') toggle('diff', d.key); });
      dLegend.appendChild(li);
      return li;
    });
    donutWrap.appendChild(dLegend);

    // Columnas dificultad
    const colsWrap = document.getElementById('hx-maq-cols');
    const cols = DIFFS.map((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hx-maq-col';
      b.innerHTML = '<span class="hx-maq-coln"></span><span class="hx-maq-colbar"><span class="hx-maq-colfill" style="background:' + d.color + '"></span></span><span class="hx-maq-collbl">' + d.label + '</span>';
      b.addEventListener('click', () => toggle('diff', d.key));
      colsWrap.appendChild(b);
      return { b, n: b.querySelector('.hx-maq-coln'), fill: b.querySelector('.hx-maq-colfill') };
    });

    // Onda: 12 meses del año seleccionado (máquinas por mes) + navegador de año
    const waveWrap = document.getElementById('hx-maq-wave');
    const WV = { w: 300, h: 92, m: 10 };
    const pad2 = (n) => (n < 10 ? '0' : '') + n;
    const monthKey = (i) => viewYear + '-' + pad2(i + 1);
    const monthlyAll = {};
    DATA.forEach((m) => { monthlyAll[m.month] = (monthlyAll[m.month] || 0) + 1; });
    const MAXMONTH = Math.max(1, ...Object.values(monthlyAll));
    const yearsData = Array.from(new Set(DATA.map((m) => parseInt(m.month.slice(0, 4), 10)))).filter(Boolean);
    let viewYear = yearsData.length ? Math.max.apply(null, yearsData) : new Date().getFullYear();

    const wSvg = svg('svg', { viewBox: `0 0 ${WV.w} ${WV.h}`, class: 'hx-maq-wavesvg' });
    const wArea = svg('path', { class: 'hx-maq-wavearea' });
    const wLine = svg('path', { class: 'hx-maq-waveline', fill: 'none' });
    wSvg.appendChild(wArea); wSvg.appendChild(wLine);
    const xAt = (i) => WV.m + i * (WV.w - 2 * WV.m) / 11;
    const bw = (WV.w - 2 * WV.m) / 11;
    const wHits = [], wDots = [];
    function pickMonth(i) { if (!monthlyAll[monthKey(i)]) return; toggle('month', monthKey(i)); }
    for (let i = 0; i < 12; i++) {
      const r = svg('rect', { x: (xAt(i) - bw / 2).toFixed(1), y: 0, width: bw.toFixed(1), height: WV.h - 14, class: 'hx-maq-wavehit', tabindex: 0, role: 'button' });
      ((idx) => {
        r.addEventListener('click', () => pickMonth(idx));
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickMonth(idx); } });
      })(i);
      wSvg.appendChild(r); wHits.push(r);
      const c = svg('circle', { r: 2.5, class: 'hx-maq-wavedot' }); wSvg.appendChild(c); wDots.push(c);
    }
    waveWrap.appendChild(wSvg);
    const wLabels = document.createElement('div');
    wLabels.className = 'hx-maq-wavex';
    MES.forEach((mm) => { const s = document.createElement('span'); s.textContent = mm; wLabels.appendChild(s); });
    waveWrap.appendChild(wLabels);
    const yearNav = document.createElement('div');
    yearNav.className = 'hx-maq-year';
    const yPrev = document.createElement('button');
    yPrev.type = 'button'; yPrev.className = 'hx-maq-yearbtn'; yPrev.setAttribute('aria-label', 'Año anterior');
    yPrev.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';
    const yLbl = document.createElement('b'); yLbl.className = 'hx-maq-yearlbl';
    const yNext = document.createElement('button');
    yNext.type = 'button'; yNext.className = 'hx-maq-yearbtn'; yNext.setAttribute('aria-label', 'Año siguiente');
    yNext.innerHTML = '<i class="fas fa-chevron-right" aria-hidden="true"></i>';
    yPrev.addEventListener('click', () => { viewYear -= 1; renderWave(); });
    yNext.addEventListener('click', () => { viewYear += 1; renderWave(); });
    yearNav.appendChild(yPrev); yearNav.appendChild(yLbl); yearNav.appendChild(yNext);
    waveWrap.appendChild(yearNav);

    function renderWave() {
      const sub = subset('month');
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const c = sub.reduce((n, m) => n + (m.month === monthKey(i) ? 1 : 0), 0);
        const y = (WV.h - 14) - (c / MAXMONTH) * (WV.h - 20);
        pts.push([xAt(i), y, c]);
      }
      const line = pts.map((p, i) => (i ? 'L' : 'M') + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      wLine.setAttribute('d', line);
      wArea.setAttribute('d', line + ' L ' + pts[11][0].toFixed(1) + ' ' + (WV.h - 14) + ' L ' + pts[0][0].toFixed(1) + ' ' + (WV.h - 14) + ' Z');
      pts.forEach((p, i) => {
        wDots[i].setAttribute('cx', p[0]); wDots[i].setAttribute('cy', p[1]);
        wDots[i].classList.toggle('hx-maq-dot0', p[2] === 0);
        dimClass(wDots[i], state.month.size > 0, state.month.has(monthKey(i)));
      });
      wHits.forEach((r, i) => {
        dimClass(r, state.month.size > 0, state.month.has(monthKey(i)));
        r.classList.toggle('hx-maq-hitempty', !monthlyAll[monthKey(i)]);
      });
      yLbl.textContent = viewYear;
    }

    // Minis (SO / plataforma)
    function buildMini(container, cats, dim) {
      return cats.map((c) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'hx-maq-minirow';
        row.innerHTML = '<span class="hx-maq-minilbl">' + c.label + '</span><span class="hx-maq-minibar"><span class="hx-maq-minifill" style="background:' + c.color + '"></span></span><b class="hx-maq-minin"></b>';
        row.addEventListener('click', () => toggle(dim, c.key));
        container.appendChild(row);
        return { cat: c, row, fill: row.querySelector('.hx-maq-minifill'), n: row.querySelector('.hx-maq-minin') };
      });
    }
    const osRows = buildMini(document.getElementById('hx-maq-os'), OS, 'os');
    const platRows = buildMini(document.getElementById('hx-maq-plat'), PLAT, 'platform');

    // Contador, lista, buscador, limpiar
    const countEl = document.getElementById('hx-maq-count');
    const countLead = document.getElementById('hx-maq-countlead');
    const listEl = document.getElementById('hx-maq-list');
    const listCount = document.getElementById('hx-maq-listcount');
    const emptyEl = document.getElementById('hx-maq-empty');
    const clearBtn = document.getElementById('hx-maq-clear');
    const searchInput = document.getElementById('hx-maq-search');
    searchInput.addEventListener('input', () => { state.q = normalize(searchInput.value.trim()); render(); });
    clearBtn.addEventListener('click', () => {
      state.diff.clear(); state.month.clear(); state.os.clear(); state.platform.clear();
      state.q = ''; searchInput.value = ''; render();
    });

    // Contador animado (una vez)
    let countShown = 0, countFirst = true;
    function setCount(n) {
      if (reduceMotion || !countFirst) { countEl.textContent = n; countShown = n; return; }
      countFirst = false;
      const from = 0, to = n, t0 = performance.now(), dur = 900;
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        countEl.textContent = v; countShown = v;
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    function dimClass(elm, hasSel, isSel) {
      elm.classList.toggle('is-sel', !!isSel);
      elm.classList.toggle('is-dim', hasSel && !isSel);
    }

    function render() {
      const all = subset(null);
      // Contador
      setCount(all.length);
      countLead.textContent = anyFilter() ? ('de ' + DATA.length + ' · filtrado') : 'máquinas resueltas';
      clearBtn.hidden = !anyFilter();

      // Donut + columnas (dimensión diff, cross-filtrada por las demás)
      const diffSub = subset('diff');
      const diffCounts = DIFFS.map((d) => countBy(diffSub, 'diff', d.key));
      const diffTotal = diffCounts.reduce((a, b) => a + b, 0);
      let acc = 0;
      DIFFS.forEach((d, i) => {
        const c = diffCounts[i];
        const a0 = diffTotal ? (acc / diffTotal) * 360 : 0;
        acc += c;
        const a1 = diffTotal ? (acc / diffTotal) * 360 : 0;
        dArcs[i].setAttribute('d', c > 0 ? arcPath(60, 60, 48, a0, a1) : '');
        dimClass(dArcs[i], state.diff.size > 0, state.diff.has(d.key));
        dLegItems[i].querySelector('b').textContent = c;
        dimClass(dLegItems[i], state.diff.size > 0, state.diff.has(d.key));
      });
      dCenter.innerHTML = '<b>' + diffTotal + '</b>';
      const colMax = Math.max(1, ...diffCounts);
      cols.forEach((col, i) => {
        col.n.textContent = diffCounts[i];
        col.fill.style.height = (diffCounts[i] / colMax * 100) + '%';
        dimClass(col.b, state.diff.size > 0, state.diff.has(DIFFS[i].key));
      });

      // Onda (12 meses del año en curso)
      renderWave();

      // Minis
      function renderMini(rows, dim) {
        const sub = subset(dim);
        const mx = Math.max(1, ...rows.map((r) => countBy(sub, dim, r.cat.key)));
        rows.forEach((r) => {
          const c = countBy(sub, dim, r.cat.key);
          r.n.textContent = c;
          r.fill.style.width = (c / mx * 100) + '%';
          dimClass(r.row, state[dim].size > 0, state[dim].has(r.cat.key));
        });
      }
      renderMini(osRows, 'os');
      renderMini(platRows, 'platform');

      // Lista (historial minimalista, más reciente primero)
      const list = all.slice().sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
      listCount.textContent = anyFilter() ? '(' + list.length + ')' : '';
      listEl.innerHTML = list.map((m) =>
        '<li><a href="' + m.url + '">' +
        '<span class="hx-dot hx-dot-' + (m.diff || 'otros') + '"></span>' +
        '<span class="hx-maq-rname">' + escapeHtml(m.name) + '</span>' +
        '<span class="hx-maq-rdate">' + m.disp + '</span></a></li>'
      ).join('');
      emptyEl.hidden = list.length > 0;
    }

    function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    render();
  }

  function init() {
    initHideDupHeader();
    initMachinesDash();
    initHtbFx();
    initPageTheme();
    initAge();
    initMatrix();
    initAvatarFx();
    initTools();
    initCredentials();
    initCarousels();
    initGlitch();
    initSubtitle();
    initTabTitle();
    initAscii();
    initTerminal();
    initReveal();
    initCardGlow();
    initProgress();
    initFilterBars();
    initPostSections();
    initButtonAura();
    initCert();
    initFigures();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
