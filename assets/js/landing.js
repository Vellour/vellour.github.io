/* Vellour landing: the before / after picture (a draggable edge, three scenes, a block-by-block dissolve between them,
   a few pixel particles on the Vellour side) and the live prices. The menu demo lives in gui-demo.js. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  const SCENES = [
    { id: 'dawn', focus: [0.5, 0.56], mods: 'Включено: Atmosphere, ColorPlus, Weather FX с лепестками', particles: 'petals',
      altA: 'Обычный Minecraft: рассвет над лесом и снежной горой', altB: 'Тот же рассвет с Vellour: лучи солнца, тёплый свет, туман и падающие лепестки' },
    { id: 'night', focus: [0.5, 0.56], mods: 'Включено: Shader Sky с северным сиянием, Weather FX со светлячками', particles: 'none',
      altA: 'Обычный Minecraft: тёмное море и берег ночью', altB: 'Тот же берег с Vellour: шейдерное северное сияние и светлячки' },
    { id: 'snow', focus: [0.5, 0.56], mods: 'Включено: Weather FX со снегом на блоках, Atmosphere, ColorPlus', particles: 'snow',
      altA: 'Обычный Minecraft: луг в сумерках и заходящее солнце', altB: 'Тот же луг с Vellour: идёт снег, земля покрыта белыми пикселями, над ней туман' },
  ];

  const cmp = $('#cmp');
  const knob = $('#cmp-knob');
  if (!cmp || !knob) return;
  const imgA = $('#img-a'), imgB = $('#img-b');
  const fxA = $('.cmp-base .fx'), fxB = $('.cmp-top .fx');
  const sky = $('.particles', cmp);

  /* ---------------- the edge ---------------- */
  let pos = 38;
  let introRaf = 0;
  function setPos(v, byUser) {
    pos = Math.max(0, Math.min(100, v));
    cmp.style.setProperty('--pos', pos.toFixed(2));
    knob.setAttribute('aria-valuenow', String(Math.round(pos)));
    cmp.classList.toggle('hide-a', pos < 16);
    cmp.classList.toggle('hide-b', pos > 84);
    if (byUser) cmp.classList.add('touched');
  }
  const stopIntro = () => cancelAnimationFrame(introRaf);

  // once, on load: the Vellour picture sweeps in from the right edge
  function intro() {
    if (reduce) { setPos(38); return; }
    const from = 101, to = 38, delay = 500, dur = 1800, t0 = performance.now();
    setPos(from);
    const tick = now => {
      const k = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
      setPos(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) introRaf = requestAnimationFrame(tick);
    };
    introRaf = requestAnimationFrame(tick);
  }

  let drag = false;
  const at = e => { const r = cmp.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
  cmp.addEventListener('pointerdown', e => {
    if (e.target.closest('a, .scene, .btn')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = true; stopIntro();
    try { cmp.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    setPos(at(e), true);
  });
  cmp.addEventListener('pointermove', e => { if (drag) setPos(at(e), true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => cmp.addEventListener(n, () => { drag = false; }));
  // the hero copy sits above the picture and lets the pointer through; clicks on the buttons still work
  knob.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 2;
    const to = { ArrowLeft: pos - step, ArrowDown: pos - step, ArrowRight: pos + step, ArrowUp: pos + step, Home: 0, End: 100 }[e.key];
    if (to === undefined) return;
    e.preventDefault(); stopIntro(); setPos(to, true);
  });

  /* ---------------- scenes ---------------- */
  const tabs = $$('.scene');
  const modsLine = $('#scene-mods');
  const cache = {};
  const load = src => cache[src] || (cache[src] = new Promise((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src;
  }));
  // a phone does not need the 1920 pixel picture: the same rule the browser applies to the first one
  const wide = innerWidth * Math.min(devicePixelRatio || 1, 2) > 1300;
  const files = s => [`/assets/img/scenes/${s.id}-a${wide ? "" : "-m"}.webp`, `/assets/img/scenes/${s.id}-b${wide ? "" : "-m"}.webp`];
  let current = 0, busy = false;

  /** Draws the new picture over the old one block by block, in the same random order on both halves of the edge. */
  function dissolve(canvases, imgs, order, cols, rows, dur, focus) {
    return new Promise(resolve => {
      const jobs = canvases.map((canvas, k) => {
        const img = imgs[k];
        const box = canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
        const cw = canvas.width, ch = canvas.height;
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);      // the same crop as object-fit: cover
        const sw = cw / scale, sh = ch / scale;
        return { ctx: canvas.getContext('2d'), img, cw, ch, scale, sw, sh, sx: (img.naturalWidth - sw) * focus[0], sy: (img.naturalHeight - sh) * focus[1] };
      });
      const total = cols * rows;
      let done = 0;
      const t0 = performance.now();
      const frame = now => {
        const k = Math.min(1, (now - t0) / dur);
        const upto = Math.floor(total * (k * k * (3 - 2 * k)));
        while (done < upto) {
          const i = order[done++], cx = i % cols, cy = (i / cols) | 0;
          for (const j of jobs) {
            const w = j.cw / cols, h = j.ch / rows;
            j.ctx.drawImage(j.img, j.sx + cx * w / j.scale, j.sy + cy * h / j.scale, w / j.scale, h / j.scale, cx * w, cy * h, w + 1, h + 1);
          }
        }
        if (k < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  async function show(n) {
    if (n === current || busy) return;
    busy = true;
    const s = SCENES[n];
    let a, b;
    try { [a, b] = await Promise.all(files(s).map(load)); } catch { busy = false; return; }
    current = n;
    tabs.forEach((t, i) => { t.classList.toggle('on', i === n); t.setAttribute('aria-selected', String(i === n)); });
    modsLine.textContent = s.mods;
    setParticles(s.particles);
    if (!reduce) {
      const cols = 36, rows = Math.max(8, Math.round(cols * cmp.clientHeight / cmp.clientWidth));
      const order = Array.from({ length: cols * rows }, (_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      await dissolve([fxA, fxB], [a, b], order, cols, rows, 750, s.focus);
    }
    imgA.removeAttribute("srcset"); imgB.removeAttribute("srcset");
    imgA.src = a.src; imgB.src = b.src; imgA.alt = s.altA; imgB.alt = s.altB;
    imgA.style.objectPosition = imgB.style.objectPosition = s.focus[0] * 100 + "% " + s.focus[1] * 100 + "%";
    await Promise.all([imgA.decode(), imgB.decode()]).catch(() => {});
    for (const c of [fxA, fxB]) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    busy = false;
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  tabs.forEach((t, i) => t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[n].focus(); show(n);
  }));
  // the other scenes are fetched once the first one is on screen
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1500));
  if (!(navigator.connection && navigator.connection.saveData)) idle(() => SCENES.slice(1).forEach(s => files(s).forEach(src => load(src).catch(() => {}))), { timeout: 4000 });

  /* ---------------- pixel particles (only on the Vellour side of the edge) ---------------- */
  const KINDS = {
    petals: { count: 46, size: [3, 5], vy: [26, 54], vx: [18, 40], sway: 18, colors: ['#ffd6e0', '#ffb7c8', '#fff0f4', '#ffe8b0'] },
    snow: { count: 90, size: [2, 4], vy: [36, 78], vx: [-6, 14], sway: 10, colors: ['#ffffff', '#eaf4ff', '#d6e8fa'] },
  };
  let kind = null, bits = [], raf = 0, visible = true, lastT = 0;
  const pctx = sky.getContext('2d');
  const rand = (a, b) => a + Math.random() * (b - a);
  function sizeSky() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    sky.width = Math.round(cmp.clientWidth * dpr); sky.height = Math.round(cmp.clientHeight * dpr);
  }
  function spawn(first) {
    const k = KINDS[kind], dpr = sky.width / cmp.clientWidth;
    return { x: rand(-40, sky.width), y: first ? rand(0, sky.height) : rand(-60, -4), s: Math.round(rand(k.size[0], k.size[1]) * dpr),
      vy: rand(k.vy[0], k.vy[1]) * dpr, vx: rand(k.vx[0], k.vx[1]) * dpr, ph: rand(0, 6.28), sw: k.sway * dpr, c: k.colors[(Math.random() * k.colors.length) | 0], a: rand(.55, .95) };
  }
  function setParticles(name) {
    kind = KINDS[name] ? name : null;
    cancelAnimationFrame(raf);
    pctx.clearRect(0, 0, sky.width, sky.height);
    if (!kind || reduce) return;
    sizeSky();
    bits = Array.from({ length: KINDS[kind].count }, () => spawn(true));
    lastT = performance.now();
    raf = requestAnimationFrame(step);
  }
  function step(now) {
    if (!kind) return;
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (visible && !document.hidden) {
      pctx.clearRect(0, 0, sky.width, sky.height);
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        b.y += b.vy * dt; b.x += (b.vx + Math.sin(now / 900 + b.ph) * b.sw) * dt;
        if (b.y > sky.height + 8 || b.x > sky.width + 40) bits[i] = spawn(false);
        const q = Math.max(2, b.s);                          // snapped to a grid of pixels like the game's own
        pctx.globalAlpha = b.a; pctx.fillStyle = b.c;
        pctx.fillRect(Math.round(b.x / q) * q, Math.round(b.y / q) * q, b.s, b.s);
      }
      pctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(step);
  }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(cmp);
  new ResizeObserver(() => { if (kind && !reduce) { sizeSky(); bits = bits.map(() => spawn(true)); } }).observe(cmp);

  intro();
  setParticles(SCENES[0].particles);
})();

/* prices: the real ones from the server */
fetch('/api/shop', { method: 'POST' }).then(r => r.json()).then(res => {
  if (!res.ok) return;
  // the real prices of the services that support the project
  for (const el of document.querySelectorAll('[data-svc-price]')) {
    const p = res.products.find(x => x.id === el.dataset.svcPrice);
    if (p) el.textContent = p.stars + ' ⭐';
  }
}).catch(() => {});

/* the version that is published right now */
fetch('/api/release', { method: 'POST' }).then(r => r.json()).then(res => {
  const el = document.getElementById('hero-fine');
  if (res.ok && res.mod && el) el.textContent = 'Версия ' + res.mod + ' для Windows 10 и 11. Minecraft 1.21.4 на Fabric, лаунчер ставит всё сам.';
}).catch(() => {});
