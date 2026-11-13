/* Vellour — shared site helpers: API calls, web session, nav, toasts, scroll reveal */
(function () {
  // Link to the launcher download (upload VellourLauncher.exe to Yandex Disk / Google Drive / GitHub and paste the link here)
  const DOWNLOAD_URL = 'https://github.com/Vellour/VellourVisuals/releases/latest/download/VellourLauncher.exe';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  async function api(path, body = {}, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    const token = store.get('vellour_token');
    if (auth && token) headers.Authorization = 'Bearer ' + token;
    try {
      const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({ ok: false, error: 'Ошибка сервера' }));
      if (res.status === 401 && auth) { store.set('vellour_token', null); data.unauthorized = true; }
      return data;
    } catch {
      return { ok: false, error: 'Нет соединения с сервером' };
    }
  }

  let toastTimer;
  function toast(text, bad = false) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = text;
    el.classList.toggle('bad', bad);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function initNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const burger = nav.querySelector('.nav-burger');
    if (burger) burger.addEventListener('click', () => nav.classList.toggle('open'));
    nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
    // logged in -> show profile instead of login/register
    const right = nav.querySelector('.nav-right');
    if (right && store.get('vellour_token')) {
      right.innerHTML = '<a class="btn btn-white" href="/profile">Профиль <span class="arrow">→</span></a>';
    }
  }

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    items.forEach(i => io.observe(i));
  }

  function initDownloads() {
    document.querySelectorAll('[data-download]').forEach(a => {
      if (DOWNLOAD_URL) { a.href = DOWNLOAD_URL; a.target = '_blank'; a.rel = 'noopener'; }
      else a.addEventListener('click', e => { e.preventDefault(); toast('Ссылка на скачивание скоро появится'); });
    });
  }

  /** Six single-digit inputs with paste / backspace / arrows. onComplete fires when all are filled. */
  function otp(container, onComplete) {
    container.innerHTML = '';
    const cells = [];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('input');
      c.className = 'field';
      c.inputMode = 'numeric';
      c.autocomplete = i === 0 ? 'one-time-code' : 'off';
      c.maxLength = 6;
      c.setAttribute('aria-label', `Цифра ${i + 1}`);
      container.appendChild(c);
      cells.push(c);
    }
    const value = () => cells.map(c => c.value).join('');
    const fill = (from, digits) => {
      digits.split('').forEach((d, k) => { if (cells[from + k]) cells[from + k].value = d; });
      const next = Math.min(5, from + digits.length);
      cells[next].focus();
      if (value().length === 6 && onComplete) onComplete(value());
    };
    cells.forEach((c, i) => {
      c.addEventListener('input', () => {
        const digits = c.value.replace(/\D/g, '');
        c.value = '';
        if (digits) fill(i, digits.slice(0, 6 - i));
      });
      c.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !c.value && i > 0) { cells[i - 1].value = ''; cells[i - 1].focus(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' && i > 0) cells[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 5) cells[i + 1].focus();
      });
      c.addEventListener('paste', e => {
        const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        if (digits) { e.preventDefault(); fill(0, digits); }
      });
    });
    return { value, clear() { cells.forEach(c => { c.value = ''; }); cells[0].focus(); }, focus() { cells[0].focus(); } };
  }

  document.addEventListener('DOMContentLoaded', () => { initNav(); initReveal(); initDownloads(); });
  window.Vellour = { api, store, toast, otp, DOWNLOAD_URL };
})();
