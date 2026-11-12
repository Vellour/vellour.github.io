/* Vellour — personal account: overview, 2FA, password, PC binding, email & Telegram links */
(function () {
  const { api, store, toast, otp } = window.Vellour;
  const $ = s => document.querySelector(s);
  let user = null;
  let tgPoll = null;

  if (!store.get('vellour_token')) { location.replace('/login'); return; }

  const fmtDate = ms => ms ? new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const msg = (id, text, ok = false) => { const el = $(id); el.textContent = text || ''; el.classList.toggle('ok', ok); };

  async function load() {
    const res = await api('/api/me');
    if (!res.ok) { store.set('vellour_token', null); location.replace('/login'); return null; }
    user = res.user;
    render(res.config || {});
    return user;
  }

  function render(cfg) {
    $('#loading').hidden = true;
    $('#shell').hidden = false;
    $('#u-login').textContent = user.login;
    $('#u-letter').textContent = user.login[0].toUpperCase();
    $('#u-role').textContent = user.role;
    $('#o-name').textContent = user.login;
    $('#admin-link').hidden = !['Owner', 'Admin'].includes(user.role);
    $('#o-role').textContent = user.role && user.role !== 'User' ? user.role : 'Игрок';
    $('#o-created').textContent = fmtDate(user.createdAt);
    $('#o-last').textContent = fmtDate(user.lastLogin);

    $('#c-contact').classList.toggle('done', !!(user.email || user.telegram));
    $('#c-both').classList.toggle('done', !!(user.email && user.telegram));
    $('#c-2fa').classList.toggle('done', user.twoFactor);
    $('#c-pc').classList.toggle('done', !!user.hwid);
    $('#c-pc-text').textContent = user.hwid ? `Привязан ПК ${user.hwid.slice(0, 8)}…` : 'Войди через лаунчер, чтобы привязать компьютер';

    // 2FA
    $('#tfa-pill').textContent = user.twoFactor ? 'Включена' : 'Выключена';
    $('#tfa-pill').classList.toggle('ok', user.twoFactor);
    $('#tfa-off').hidden = user.twoFactor;
    $('#tfa-on').hidden = !user.twoFactor;
    document.querySelectorAll('.need-2fa').forEach(el => { el.hidden = !user.twoFactor; });

    // PC binding
    const resetAt = user.hwidResetAvailableAt || 0;
    $('#hw-pill').textContent = user.hwid ? 'Привязан' : 'Не привязан';
    $('#hw-pill').classList.toggle('ok', !!user.hwid);
    $('#hw-btn').disabled = !user.hwid || resetAt > Date.now();
    if (resetAt > Date.now()) msg('#hw-msg', `Следующий сброс доступен ${fmtDate(resetAt)}`);

    // links
    // email linking is offered only while email sending is connected
    $('#em-state').closest('.link-card').hidden = cfg.email === false && !user.email;
    $('#em-state').textContent = user.email ? `Привязана: ${user.email}` : 'Не привязана';
    $('#em-state').classList.toggle('linked', !!user.email);
    $('#em-btn').textContent = user.email ? 'Сменить почту' : 'Отправить код';
    $('#em-remove').hidden = !user.email;
    $('#tg-state').textContent = user.telegram ? `Привязан: ${user.telegram}` : (cfg.telegram === false ? 'Бот ещё не настроен администратором' : 'Не привязан');
    $('#tg-state').classList.toggle('linked', !!user.telegram);
    $('#tg-link').hidden = !!user.telegram;
    $('#tg-link').disabled = cfg.telegram === false;
    $('#tg-remove').hidden = !user.telegram;
  }

  /* ---------- tabs ---------- */
  function tab(name) {
    document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== 't-' + name; });
    document.querySelectorAll('.p-nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0 });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (b) tab(b.dataset.tab);
  });

  /* ---------- confirm dialog with password ---------- */
  function confirmPassword(title, text) {
    return new Promise(resolve => {
      const d = $('#confirm');
      $('#cf-title').textContent = title;
      $('#cf-text').textContent = text;
      $('#cf-pass').value = '';
      msg('#cf-msg', '');
      d.showModal();
      $('#cf-pass').focus();
      d.addEventListener('close', () => resolve(d.returnValue === 'ok' ? $('#cf-pass').value : null), { once: true });
    });
  }

  /* ---------- 2FA ---------- */
  const tfaCode = otp($('#tfa-code'), async code => {
    const res = await api('/api/2fa/enable', { code });
    if (!res.ok) { msg('#tfa-msg', res.error); tfaCode.clear(); return; }
    toast('Двухфакторная защита включена');
    $('#tfa-setup').hidden = true;
    $('#tfa-start').hidden = false;
    load();
  });
  $('#tfa-start').addEventListener('click', async () => {
    const res = await api('/api/2fa/setup');
    if (!res.ok) return toast(res.error, true);
    $('#tfa-start').hidden = true;
    $('#tfa-setup').hidden = false;
    $('#tfa-secret').textContent = res.secret.replace(/(.{4})/g, '$1 ').trim();
    const box = $('#tfa-qr');
    box.innerHTML = '';
    if (window.QRCode) new window.QRCode(box, { text: res.url, width: 168, height: 168, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    else box.textContent = 'QR не загрузился — введи ключ вручную';
    tfaCode.focus();
  });
  $('#tfa-copy').addEventListener('click', () => {
    navigator.clipboard.writeText($('#tfa-secret').textContent.replace(/\s/g, '')).then(() => toast('Ключ скопирован'));
  });
  const tfaOff = otp($('#tfa-off-code'), async code => {
    const res = await api('/api/2fa/disable', { code });
    if (!res.ok) { msg('#tfa-off-msg', res.error); tfaOff.clear(); return; }
    toast('2FA выключена');
    load();
  });

  /* ---------- password ---------- */
  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/api/password', { password: $('#pw-old').value, newPassword: $('#pw-new').value, totp: $('#pw-totp').value.trim() });
    if (!res.ok) return msg('#pw-msg', res.error);
    msg('#pw-msg', 'Пароль изменён. Остальные устройства вышли из аккаунта.', true);
    e.target.reset();
  });

  /* ---------- PC binding ---------- */
  $('#hw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/api/hwid/reset', { password: $('#hw-pass').value, totp: $('#hw-totp').value.trim() });
    if (!res.ok) return msg('#hw-msg', res.error);
    e.target.reset();
    toast('Привязка сброшена — войди в лаунчер на новом ПК');
    await load();
    msg('#hw-msg', 'Готово. Следующий вход в лаунчер привяжет новый компьютер.', true);
  });

  $('#logout-all').addEventListener('click', async () => {
    await api('/api/logout-all');
    store.set('vellour_token', null);
    location.replace('/login');
  });
  $('#logout').addEventListener('click', async () => {
    await api('/api/logout');
    store.set('vellour_token', null);
    location.replace('/');
  });

  /* ---------- email ---------- */
  const emCode = otp($('#em-code'), async code => {
    const res = await api('/api/email/confirm', { code });
    if (!res.ok) { msg('#em-msg', res.error); emCode.clear(); return; }
    $('#em-code-box').hidden = true;
    $('#em-input').value = '';
    msg('#em-msg', 'Почта привязана', true);
    load();
  });
  $('#em-form').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/api/email/start', { email: $('#em-input').value.trim() });
    if (!res.ok) return msg('#em-msg', res.error);
    $('#em-code-box').hidden = false;
    msg('#em-msg', res.dev ? 'Тестовый режим, код: ' + res.dev : `Код отправлен на ${res.email}`, true);
    emCode.focus();
  });
  $('#em-remove').addEventListener('click', async () => {
    const pass = await confirmPassword('Отвязать почту?', 'Восстанавливать пароль можно будет только через Telegram.');
    if (pass == null) return;
    const res = await api('/api/email/remove', { password: pass });
    res.ok ? (toast('Почта отвязана'), load()) : toast(res.error, true);
  });

  /* ---------- telegram ---------- */
  $('#tg-link').addEventListener('click', async () => {
    const res = await api('/api/telegram/start');
    if (!res.ok) return msg('#tg-msg', res.error);
    window.open(res.link, '_blank', 'noopener');
    $('#tg-wait').hidden = false;
    clearInterval(tgPoll);
    let tries = 0;
    tgPoll = setInterval(async () => {
      if (++tries > 120) { clearInterval(tgPoll); $('#tg-wait').hidden = true; return; }
      const me = await api('/api/me');
      if (me.ok && me.user.telegram) {
        clearInterval(tgPoll);
        $('#tg-wait').hidden = true;
        toast('Telegram привязан');
        load();
      }
    }, 2500);
  });
  $('#tg-remove').addEventListener('click', async () => {
    const pass = await confirmPassword('Отвязать Telegram?', 'Уведомления о безопасности перестанут приходить в Telegram.');
    if (pass == null) return;
    const res = await api('/api/telegram/remove', { password: pass });
    res.ok ? (toast('Telegram отвязан'), load()) : toast(res.error, true);
  });

  /* ---------- services that support the project: supporter heart, own tag, own idea ---------- */
  let svcState = null;
  let svcPoll = null;

  function paintTagPreview() {
    const text = $('#tag-text').value.trim() || 'Надпись';
    const hex = $('#tag-color').value.replace('#', '').trim();
    const color = /^[0-9a-fA-F]{6}$/.test(hex) ? '#' + hex : '#ffc98a';
    $('#tag-preview').innerHTML = '<span class="nick">' + (user ? user.login : 'Ник') + '</span><i class="chip" style="color:' + color + ';background:' + color + '24">'
      + text.replace(/[<>&]/g, '') + '</i>';
  }

  async function loadServices() {
    const [shop, mine] = await Promise.all([api('/api/shop', {}, false), api('/api/services/mine')]);
    if (!shop.ok || !mine.ok) return;
    svcState = mine;
    const credits = mine.credits || {};
    const hasTag = !!mine.tag, waiting = !!mine.pending;
    // one heart and one tag per account: once they are bought the button gives way to a note (an idea can be bought again)
    const owned = { supporter: mine.supporter, nametag: credits.tag > 0 || hasTag || waiting };
    for (const box of document.querySelectorAll('.plan-buy[data-svc]')) {
      const p = shop.products.find(x => x.id === box.dataset.svc);
      if (!p) { box.innerHTML = ''; continue; }
      box.innerHTML = owned[p.id]
        ? '<p class="muted-s">' + (p.id === 'supporter' ? 'Спасибо за поддержку! Значок уже стоит у твоего ника.'
            : hasTag ? 'Надпись уже стоит у ника, текст можно поменять ниже.' : 'Услуга куплена: текст пишется ниже.') + '</p>'
        : '<button class="buy-btn best" data-svc-product="' + p.id + '"><span>' + (p.id === 'idea' ? 'Одна идея' : 'Навсегда') + '</span><b>' + p.stars + ' ⭐</b></button>';
    }
    $('#sup-pill').textContent = mine.supporter ? 'Включён' : 'Не куплен';
    $('#sup-pill').classList.toggle('ok', mine.supporter);
    $('#tag-pill').textContent = waiting ? 'На проверке' : hasTag ? 'Включена' : credits.tag > 0 ? 'Куплена, напиши текст' : 'Не куплена';
    $('#tag-pill').classList.toggle('ok', hasTag && !waiting);
    $('#tag-form').hidden = !(credits.tag > 0 || hasTag || waiting);
    if (hasTag && !$('#tag-text').value) { $('#tag-text').value = mine.tag.text; $('#tag-color').value = mine.tag.color || ''; }
    if (waiting) msg('#tag-msg', 'Ждёт проверки владельца: «' + mine.pending.text + '»', true);
    else if (hasTag) msg('#tag-msg', 'Сейчас у ника: «' + mine.tag.text + '». Можно отправить новый текст.', true);
    else msg('#tag-msg', '');
    paintTagPreview();
    $('#idea-pill').textContent = credits.idea > 0 ? 'Куплена, опиши идею' : 'Не куплена';
    $('#idea-pill').classList.toggle('ok', credits.idea > 0);
    $('#idea-form').hidden = !(credits.idea > 0);
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-svc-product]');
    if (!b) return;
    b.disabled = true;
    const res = await api('/api/shop/invoice', { product: b.dataset.svcProduct });
    b.disabled = false;
    if (!res.ok) return toast(res.error, true);
    window.open(res.link, '_blank', 'noopener');
    const before = JSON.stringify([svcState && svcState.supporter, svcState && svcState.credits]);
    clearInterval(svcPoll);
    let tries = 0;
    svcPoll = setInterval(async () => {
      if (++tries > 90) return clearInterval(svcPoll);
      const me = await api('/api/services/mine');
      if (me.ok && JSON.stringify([me.supporter, me.credits]) !== before) {
        clearInterval(svcPoll);
        toast('Оплата прошла, спасибо за поддержку!');
        loadServices();
      }
    }, 3000);
  });
  $('#tag-text').addEventListener('input', paintTagPreview);
  $('#tag-color').addEventListener('input', paintTagPreview);
  $('#tag-form').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/api/services/tag', { text: $('#tag-text').value, color: $('#tag-color').value });
    if (!res.ok) return msg('#tag-msg', res.error);
    toast(res.message);
    loadServices();
  });
  $('#idea-text').addEventListener('input', () => { $('#idea-count').textContent = $('#idea-text').value.length + ' / 1800'; });
  $('#idea-form').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await api('/api/services/idea', { text: $('#idea-text').value });
    if (!res.ok) return msg('#idea-msg', res.error);
    msg('#idea-msg', res.message, true);
    $('#idea-text').value = '';
    loadServices();
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-tab="services"]')) loadServices(); });
  if (location.hash === '#services') loadServices();

  /* ---------- daily tasks ---------- */
  async function loadBonus() {
    const qq = await api('/api/quests');
    if (!qq.ok) return;
    const fmtQ = (q, v) => q.unit === 'sec' ? Math.floor(v / 60) + ' / ' + Math.floor(q.goal / 60) + ' мин' : v + ' / ' + q.goal;
    $('#q-box').innerHTML = qq.quests.map(q => '<div class="q-row' + (q.done ? ' done' : '') + '"><div class="q-top"><b>' + q.title + '</b><span>' + fmtQ(q, q.progress) + '</span></div><div class="q-bar"><i style="width:' + Math.round(q.progress / q.goal * 100) + '%"></i></div></div>').join('')
      + '<div class="q-reward">' + (qq.claimed ? 'Все задания дня выполнены ✓' : 'Прогресс считается в игре, через лаунчер Vellour.') + '</div>';
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-tab=bonus]'); if (b) loadBonus(); });

  /* ---------- my profile ---------- */
  const escP = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let pf = { avatar: null, banner: null };
  function paintPreview() {
    const login = $('#o-name').textContent || '';
    $('#pf-login').textContent = login;
    $('#pf-status').textContent = $('#pf-status-in').value || 'без фразы';
    $('#pf-banner').style.backgroundImage = pf.banner ? 'url(' + pf.banner + ')' : '';
    $('#pf-ava').style.backgroundImage = pf.avatar ? 'url(' + pf.avatar + ')' : '';
    $('#pf-ava').textContent = pf.avatar ? '' : login.slice(0, 1).toUpperCase();
  }
  async function loadMe() {
    const r = await api('/api/profile/get');
    if (!r.ok) return;
    const p = r.profile;
    pf = { avatar: p.avatar, banner: p.banner };
    $('#pf-status-in').value = p.status || '';
    document.querySelectorAll('[data-soc]').forEach(i => { i.value = p.socials[i.dataset.soc] || ''; });
    const link = location.origin + '/u/' + p.login;
    $('#me-link').href = link; $('#me-link').textContent = link;
    paintPreview();
  }
  /** Resizes a picked image in the browser, so the upload stays small. */
  function resize(file, w, h, cover) {
    return new Promise((ok, bad) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const k = Math.max(w / img.width, h / img.height);
        const dw = img.width * k, dh = img.height * k;
        c.getContext('2d').drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ok(c.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = bad;
      img.src = URL.createObjectURL(file);
    });
  }
  $('#pf-ava-file').addEventListener('change', async e => { if (e.target.files[0]) { pf.avatar = await resize(e.target.files[0], 160, 160); paintPreview(); } });
  $('#pf-banner-file').addEventListener('change', async e => { if (e.target.files[0]) { pf.banner = await resize(e.target.files[0], 960, 270); paintPreview(); } });
  $('#pf-clear').addEventListener('click', () => { pf = { avatar: null, banner: null }; paintPreview(); });
  $('#pf-status-in').addEventListener('input', paintPreview);
  $('#pf-form').addEventListener('submit', async e => {
    e.preventDefault();
    const socials = {};
    document.querySelectorAll('[data-soc]').forEach(i => { if (i.value.trim()) socials[i.dataset.soc] = i.value.trim(); });
    const r = await api('/api/profile/save', { status: $('#pf-status-in').value, socials, avatar: pf.avatar || '', banner: pf.banner || '' });
    r.ok ? msg('#pf-msg', 'Профиль сохранён', true) : msg('#pf-msg', r.error);
  });

  /* ---------- friends ---------- */
  const avatarBox = f => '<div class="av" style="' + (f.avatar ? 'background-image:url(' + f.avatar + ')' : '') + '">' + (f.avatar ? '' : escP(f.login.slice(0, 1).toUpperCase())) + '<i class="' + (f.online ? 'on' : '') + '"></i></div>';
  async function loadFriends() {
    const r = await api('/api/friends/list');
    if (!r.ok) return;
    $('#fr-incoming').innerHTML = r.incoming.length ? '<div class="sub-h">Заявки в друзья</div>' + r.incoming.map(f => '<div class="card fr">' + avatarBox(f)
      + '<div class="tx"><b>' + escP(f.login) + '</b></div><div class="acts"><button class="ok" data-fa="accept" data-l="' + escP(f.login) + '">Принять</button><button data-fa="remove" data-l="' + escP(f.login) + '">Отклонить</button></div></div>').join('') : '';
    $('#fr-list').innerHTML = (r.friends.length ? r.friends.map(f => '<div class="card fr">' + avatarBox(f)
      + '<div class="tx"><b>' + escP(f.login) + '</b><span>' + (f.online ? 'в игре' + (f.server ? ' · ' + escP(f.server) : '') : 'не в сети') + (f.status ? ' · ' + escP(f.status) : '') + '</span></div>'
      + '<div class="acts"><a href="/u/' + escP(f.login) + '" target="_blank">Профиль</a><button data-dm="' + escP(f.login) + '">Написать</button><button data-fa="remove" data-l="' + escP(f.login) + '">Удалить</button></div></div>').join('')
      : '<p class="p-sub">Пока никого. Добавь друга по логину.</p>')
      + (r.outgoing.length ? '<div class="sub-h">Отправленные заявки</div>' + r.outgoing.map(f => '<div class="card fr">' + avatarBox(f) + '<div class="tx"><b>' + escP(f.login) + '</b><span>ждёт ответа</span></div><div class="acts"><button data-fa="remove" data-l="' + escP(f.login) + '">Отменить</button></div></div>').join('') : '');
    chatFriends = r.friends;
    paintChatSide();
  }
  $('#fr-form').addEventListener('submit', async e => {
    e.preventDefault();
    const r = await api('/api/friends/request', { login: $('#fr-login').value.trim() });
    msg('#fr-msg', r.ok ? r.message : r.error, r.ok);
    if (r.ok) { $('#fr-login').value = ''; loadFriends(); }
  });
  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-fa]');
    if (a) { const r = await api('/api/friends/' + a.dataset.fa, { login: a.dataset.l }); r.ok ? toast(r.message) : toast(r.error, true); loadFriends(); return; }
    const dm = e.target.closest('[data-dm]');
    if (dm) { chatWith = dm.dataset.dm; tab('chat'); openChat(); }
  });

  /* ---------- chat: the messenger itself lives in chat.js ---------- */
  let chatFriends = [], chatWith;
  function paintChatSide() { if (window.VellourChat) window.VellourChat.setFriends(chatFriends); }
  function openChat() { if (window.VellourChat) window.VellourChat.open(chatWith, $('#o-name').textContent || ''); chatWith = undefined; }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'me') loadMe();
    if (b.dataset.tab === 'friends') loadFriends();
    if (b.dataset.tab === 'chat') { loadFriends(); openChat(); }
  });

  /* ---------- support ---------- */
  const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KIND = { bug: '🐞 Баг', idea: '💡 Идея', problem: '⚠️ Проблема', other: '💬 Другое' };
  const STATUS = { open: 'ждёт ответа', answered: 'есть ответ', closed: 'закрыто', pending: 'на проверке', approved: 'опубликован', rejected: 'отклонён' };
  $('#sup-text').addEventListener('input', e => { $('#sup-count').textContent = e.target.value.length + ' / 2000'; });
  async function loadSupport() {
    const r = await api('/api/support/mine');
    if (!r.ok) return;
    $('#sup-list').innerHTML = r.tickets.map(t => '<div class="card tk"><div class="tk-head"><b>#' + t.id + '</b>' + KIND[t.kind] + '<span class="st ' + t.status + '">' + STATUS[t.status] + '</span><span>' + fmtDate(t.created_at) + '</span></div>'
      + '<p>' + escH(t.text) + '</p>' + (t.reply ? '<div class="reply"><b>Ответ:</b> ' + escH(t.reply) + '</div>' : '') + '</div>').join('')
      || '<p class="p-sub">Обращений пока нет.</p>';
  }
  $('#sup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const kind = (document.querySelector('#sup-form input[name=kind]:checked') || {}).value || 'other';
    const res = await api('/api/support/create', { kind, text: $('#sup-text').value });
    if (!res.ok) return msg('#sup-msg', res.error);
    msg('#sup-msg', res.message, true);
    $('#sup-text').value = '';
    loadSupport();
  });

  /* ---------- my configs ---------- */
  $('#cfg-file').addEventListener('change', e => { const f = e.target.files[0]; $('#cfg-file-name').textContent = f ? f.name : 'Выбрать файл .vellour'; });
  let tagTimer;
  $('#cfg-tag').addEventListener('input', () => {
    const el = $('#cfg-tag');
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const state = $('#cfg-tag-state');
    clearTimeout(tagTimer);
    if (el.value.length < 3) { state.textContent = '3-4 символа, латиница и цифры, уникальный у каждого конфига'; state.className = 'muted-s'; return; }
    tagTimer = setTimeout(async () => {
      const r = await api('/api/configs/tag/check', { tag: el.value }, false);
      state.textContent = r.free ? 'Тег ' + r.tag + ' свободен' : (r.error || 'Тег занят');
      state.className = 'muted-s ' + (r.free ? 'tag-free' : 'tag-busy');
    }, 300);
  });
  async function loadMyConfigs() {
    const r = await api('/api/configs/mine');
    if (!r.ok) return;
    $('#cfg-list').innerHTML = r.configs.map(c => '<div class="card tk"><div class="tk-head"><b>' + escH(c.name) + '</b>' + (c.tag ? '<span class="cfg-tag-chip">' + escH(c.tag) + '</span>' : '') + '<span class="st ' + c.status + '">' + STATUS[c.status] + '</span><span>скачиваний: ' + c.downloads + '</span></div>'
      + (c.reason ? '<p>Причина: ' + escH(c.reason) + '</p>' : '') + '</div>').join('');
  }
  $('#cfg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = $('#cfg-file').files[0];
    if (!f) return msg('#cfg-msg', 'Выбери файл конфига');
    if (f.size > 300 * 1024) return msg('#cfg-msg', 'Файл слишком большой');
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const res = await api('/api/configs/upload', { name: $('#cfg-name').value, tag: $('#cfg-tag').value, tags: $('#cfg-tags').value, description: $('#cfg-desc').value, fileName: f.name, data: btoa(bin) });
    if (!res.ok) return msg('#cfg-msg', res.error);
    msg('#cfg-msg', res.message, true);
    e.target.reset(); $('#cfg-file-name').textContent = 'Выбрать файл .vellour';
    loadMyConfigs();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === 'support') loadSupport();
    if (b.dataset.tab === 'myconfigs') loadMyConfigs();
  });

  load().then(u => { if (u && location.hash === '#bonus') loadBonus(); if (u && location.hash === '#support') loadSupport(); if (u && location.hash === '#me') loadMe(); if (u && location.hash === '#friends') loadFriends(); if (u && location.hash === '#chat') { loadFriends(); openChat(); } if (u && location.hash === '#myconfigs') loadMyConfigs(); if (u) tab(['overview', 'me', 'friends', 'chat', 'security', 'links', 'services', 'bonus', 'support', 'myconfigs', 'download'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview'); });
})();
