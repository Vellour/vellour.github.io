/* Vellour — login / registration (email or Telegram) / 2FA / password recovery */
(function () {
  const { api, store, otp } = window.Vellour;
  const $ = s => document.querySelector(s);
  let cfg = { email: true, telegram: true };
  let method = 'email';
  let pending = null;
  let pollTimer = null;

  if (store.get('vellour_token')) {
    api('/api/me').then(r => { if (r.ok) location.replace('/profile'); });
  }

  const busy = (form, on) => form.querySelectorAll('button[type=submit], .btn').forEach(b => { b.disabled = on; });
  const msg = (id, text, ok = false) => { const el = $(id); el.textContent = text || ''; el.classList.toggle('ok', ok); };

  function show(view) {
    clearInterval(pollTimer);
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'v-' + view; });
    const tabs = $('#tabs');
    tabs.classList.toggle('hidden', !['login', 'register'].includes(view));
    tabs.classList.toggle('reg', view === 'register');
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    document.title = ({ register: 'Регистрация', recover: 'Восстановление', email: 'Подтверждение', tg: 'Подтверждение' }[view] || 'Вход') + ' — Vellour';
    const first = document.querySelector('#v-' + view + ' input');
    if (first) setTimeout(() => first.focus(), 60);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) { e.preventDefault(); show(b.dataset.view); history.replaceState(null, '', b.dataset.view === 'register' ? '/register#register' : '/login'); }
  });

  function finish(res) {
    store.set('vellour_token', res.token);
    location.replace('/profile');
  }

  /* ---------- login (+2FA) ---------- */
  const loginTotp = otp($('#l-totp'), () => $('#v-login').requestSubmit());
  $('#v-login').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    msg('#l-msg', '');
    busy(form, true);
    const body = { login: $('#l-login').value.trim(), password: $('#l-pass').value, web: true };
    if (!$('#l-totp-box').hidden) body.totp = loginTotp.value();
    const res = await api('/api/login', body, false);
    busy(form, false);
    if (res.ok) return finish(res);
    if (res.need2fa) {
      const first = $('#l-totp-box').hidden;
      $('#l-totp-box').hidden = false;
      if (first) { loginTotp.focus(); return; }
      loginTotp.clear();
    }
    msg('#l-msg', res.error);
  });

  /* ---------- registration ---------- */
  function setMethod(m) {
    method = m;
    document.querySelectorAll('#r-method button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $('#r-email-box').hidden = m !== 'email';
    $('#r-tg-hint').hidden = m !== 'telegram';
  }
  document.querySelectorAll('#r-method button').forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    setMethod(b.dataset.m);
  }));

  api('/api/config', {}, false).then(r => {
    if (!r.ok) return;
    cfg = r;
    const emailBtn = $('#r-method [data-m=email]');
    const tgBtn = $('#r-method [data-m=telegram]');
    emailBtn.disabled = !cfg.email; tgBtn.disabled = !cfg.telegram;
    emailBtn.title = cfg.email ? '' : 'Скоро'; tgBtn.title = cfg.telegram ? '' : 'Скоро';
    if (!cfg.email && cfg.telegram) {
      // only Telegram is connected: no choice to show
      setMethod('telegram');
      $('#r-method').hidden = true;
      $('#r-method').previousElementSibling.hidden = true;
    }
    if (!cfg.email && !cfg.telegram) msg('#r-msg', 'Регистрация временно недоступна — администратор ещё не подключил почту и Telegram');
  });

  $('#v-register').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    msg('#r-msg', '');
    const login = $('#r-login').value.trim();
    const password = $('#r-pass').value;
    if (!/^[A-Za-z0-9_]{3,16}$/.test(login)) return msg('#r-msg', 'Логин: 3–16 символов, латиница, цифры и _');
    if (password.length < 6) return msg('#r-msg', 'Пароль — минимум 6 символов');
    if (password !== $('#r-pass2').value) return msg('#r-msg', 'Пароли не совпадают');
    busy(form, true);
    const res = await api('/api/register/start', { login, password, method, email: $('#r-email').value.trim(), web: true }, false);
    busy(form, false);
    if (!res.ok) return msg('#r-msg', res.error);
    pending = res.pending;
    if (res.method === 'email') {
      $('#e-to').textContent = res.email;
      show('email');
      emailCode.clear();
      if (res.dev) msg('#e-msg', 'Тестовый режим, код: ' + res.dev, true);
    } else {
      $('#tg-open').href = res.link;
      $('#tg-status').textContent = 'Ждём подтверждения…';
      document.querySelector('.waiting').classList.remove('done');
      show('tg');
      pollTimer = setInterval(pollTelegram, 2500);
    }
  });

  const emailCode = otp($('#e-code'), () => $('#v-email').requestSubmit());
  $('#v-email').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    busy(form, true);
    const res = await api('/api/register/confirm', { pending, code: emailCode.value(), web: true }, false);
    busy(form, false);
    if (res.ok) return finish(res);
    msg('#e-msg', res.error);
    emailCode.clear();
  });

  async function pollTelegram() {
    const res = await api('/api/register/confirm', { pending, web: true }, false);
    if (res.ok) {
      clearInterval(pollTimer);
      document.querySelector('.waiting').classList.add('done');
      $('#tg-status').textContent = 'Готово! Входим…';
      setTimeout(() => finish(res), 600);
    } else if (!res.waiting) {
      clearInterval(pollTimer);
      msg('#t-msg', res.error);
    }
  }

  /* ---------- recovery ---------- */
  const recoverCode = otp($('#rc-code'));
  let recoverStep = 1;
  $('#v-recover').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const login = $('#rc-login').value.trim();
    busy(form, true);
    if (recoverStep === 1) {
      const res = await api('/api/recover/start', { login }, false);
      busy(form, false);
      if (!res.ok) return msg('#rc-msg', res.error);
      recoverStep = 2;
      $('#rc-step2').hidden = false;
      $('#rc-btn').textContent = 'Сменить пароль';
      msg('#rc-msg', res.dev ? 'Тестовый режим, код: ' + res.dev : (res.via && res.via.length ? 'Код отправлен: ' + res.via.join(', ') : res.message), true);
      recoverCode.focus();
      return;
    }
    const res = await api('/api/recover/confirm', { login, code: recoverCode.value(), password: $('#rc-pass').value }, false);
    busy(form, false);
    if (!res.ok) return msg('#rc-msg', res.error);
    msg('#rc-msg', res.message, true);
    recoverStep = 1;
    setTimeout(() => { show('login'); $('#l-login').value = login; $('#l-pass').focus(); }, 1200);
  });

  show(location.hash === '#register' || location.pathname === '/register' ? 'register' : 'login');
})();
