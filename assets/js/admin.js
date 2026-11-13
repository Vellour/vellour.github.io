/* Vellour admin panel: stats, players, tickets, config review, tags, server rules (no plans: everything is free) */
(function () {
  const { api, store, toast } = window.Vellour;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = ms => ms ? new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  let me = null;

  if (!store.get('vellour_token')) { location.replace('/login'); return; }

  function tab(name) {
    document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== 't-' + name; });
    document.querySelectorAll('.p-nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    history.replaceState(null, '', '#' + name);
    ({ stats: loadStats, users: loadUsers, servers: loadServers, tickets: loadTickets, cfgreview: loadReviews, tags: loadTags })[name]();
  }
  document.addEventListener('click', e => { const b = e.target.closest('.p-nav [data-tab]'); if (b) tab(b.dataset.tab); });

  async function call(path, body) {
    const r = await api(path, body);
    if (!r.ok) toast(r.error || 'Ошибка', true);
    return r;
  }

  /* ---------- stats ---------- */
  async function loadStats() {
    const r = await call('/api/admin/stats');
    if (!r.ok) return;
    $('#s-users').textContent = r.users; $('#s-week').textContent = r.newWeek; $('#s-online').textContent = r.online;
    $('#s-hearts').textContent = r.supporters; $('#s-stars').textContent = `${r.stars} ⭐`; $('#s-pays').textContent = r.payments;
  }

  /* ---------- users ---------- */
  let searchTimer;
  $('#u-q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadUsers, 250); });
  async function loadUsers() {
    const r = await call('/api/admin/users', { q: $('#u-q').value });
    if (!r.ok) return;
    const owner = me.role === 'Owner';
    $('#u-list').innerHTML = r.users.map(u => {
      const touch = owner ? u.role !== 'Owner' : !['Admin', 'Owner'].includes(u.role);   // the server decides too
      return `<div class="card row-card" data-login="${esc(u.login_key)}">
        <div class="who"><b>${esc(u.login)}</b>
          ${u.role !== 'User' ? `<span class="plan-chip role">${esc(u.role)}</span>` : ''}${u.banned ? '<span class="plan-chip ban">БАН</span>' : ''}
          <div class="meta">TG ${u.tg_username ? '@' + esc(u.tg_username) : (u.tg ? 'да' : '—')} · почта ${u.email ? esc(u.email) : '—'} · 2FA ${u.totp_enabled ? 'да' : 'нет'} · ПК ${u.hwidBound ? 'привязан' : 'не привязан'}<br>
          создан ${date(u.created_at)} · вход ${date(u.last_login)}${u.banned && u.ban_reason ? ' · причина: ' + esc(u.ban_reason) : ''}</div></div>
        <div class="acts">
          <button class="mini-btn" data-act="hwid">Сброс ПК</button>
          ${touch ? `${u.tg ? '<button class="mini-btn" data-act="untg">Отвязать TG</button>' : ''}${u.email ? '<button class="mini-btn" data-act="unmail">Отвязать почту</button>' : ''}${u.totp_enabled ? '<button class="mini-btn" data-act="un2fa">Сброс 2FA</button>' : ''}<button class="mini-btn" data-act="pass">Новый пароль</button><button class="mini-btn danger" data-act="del">Удалить</button>` : ''}
          ${u.banned ? '<button class="mini-btn ok" data-act="unban">Разбан</button>' : '<button class="mini-btn danger" data-act="ban">Бан</button>'}
          ${owner && u.role !== 'Owner' ? `<select class="mini-in" data-role style="width:auto">${['User', 'Helper', 'Media', 'Admin'].map(r => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>` : ''}
        </div></div>`;
    }).join('') || '<p class="p-sub">Никого не найдено</p>';
  }
  $('#u-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('[data-login]');
    const login = card.dataset.login;
    let r;
    switch (b.dataset.act) {
      case 'hwid': r = await call('/api/admin/user/hwid', { login }); break;
      case 'untg': if (!confirm('Отвязать Telegram у ' + login + '? Его можно будет привязать к другому аккаунту.')) return; r = await call('/api/admin/user/unlink', { login, what: 'telegram' }); break;
      case 'unmail': if (!confirm('Отвязать почту у ' + login + '?')) return; r = await call('/api/admin/user/unlink', { login, what: 'email' }); break;
      case 'un2fa': if (!confirm('Выключить 2FA у ' + login + '?')) return; r = await call('/api/admin/user/unlink', { login, what: '2fa' }); break;
      case 'pass': {
        const p = prompt('Новый пароль для ' + login + ' (пусто: придумать самому). Игрока выбросит из всех сессий.', '');
        if (p === null) return;
        r = await call('/api/admin/user/password', { login, password: p });
        if (r.ok) prompt('Новый пароль для ' + login + '. Скопируй и передай игроку:', r.password);
        break;
      }
      case 'del': {
        const c = prompt('Удалить аккаунт ' + login + ' навсегда? Логин, почта и Telegram освободятся, всё остальное по нему пропадёт. Впиши логин для подтверждения:', '');
        if (c === null) return;
        r = await call('/api/admin/user/delete', { login, confirm: c });
        break;
      }
      case 'ban': { const reason = prompt('Причина бана для ' + login + ':', ''); if (reason === null) return; r = await call('/api/admin/user/ban', { login, banned: true, reason }); break; }
      case 'unban': r = await call('/api/admin/user/ban', { login, banned: false }); break;
    }
    if (r && r.ok) { toast(r.warning || 'Готово'); loadUsers(); }
  });
  $('#u-list').addEventListener('change', async e => {
    const sel = e.target.closest('[data-role]');
    if (!sel) return;
    const login = sel.closest('[data-login]').dataset.login;
    const r = await call('/api/admin/user/role', { login, role: sel.value });
    if (r.ok) { toast('Роль выдана: ' + sel.value); loadUsers(); }
  });

  /* ---------- tickets ---------- */
  const KIND = { bug: '🐞 Баг', idea: '💡 Идея', problem: '⚠️ Проблема', other: '💬 Другое' };
  let tkStatus = 'open', crStatus = 'pending';
  $('#tk-seg').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; tkStatus = b.dataset.st; $('#tk-seg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); loadTickets(); });
  async function loadTickets() {
    const r = await call('/api/admin/tickets', { status: tkStatus });
    if (!r.ok) return;
    $('#tk-list').innerHTML = r.tickets.map(t => `<div class="card row-card" data-tk="${t.id}"><div class="who" style="flex:1">
        <b>#${t.id} · ${KIND[t.kind] || t.kind}</b><span class="plan-chip">${esc(t.login)}</span><span class="plan-chip">${t.source === 'telegram' ? 'бот' : 'сайт'}</span>
        <div class="meta">${date(t.created_at)}${t.replied_by ? ' · ответил ' + esc(t.replied_by) : ''}</div>
        <div class="tk-text">${esc(t.text)}</div>${t.reply ? '<div class="meta">Ответ: ' + esc(t.reply) + '</div>' : ''}
        <div class="reply-box"><textarea class="field" placeholder="Ответ игроку"></textarea>
        <div class="acts"><button class="mini-btn ok" data-reply>Ответить</button><button class="mini-btn" data-close>Ответить и закрыть</button></div></div></div></div>`).join('')
      || '<p class="p-sub">Пусто</p>';
  }
  $('#tk-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-reply],[data-close]');
    if (!b) return;
    const card = b.closest('[data-tk]');
    const r = await call('/api/admin/ticket/reply', { id: card.dataset.tk, reply: card.querySelector('textarea').value, close: b.hasAttribute('data-close') });
    if (r.ok) { toast('Ответ отправлен'); loadTickets(); }
  });

  /* ---------- config review ---------- */
  $('#cr-seg').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; crStatus = b.dataset.st; $('#cr-seg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); loadReviews(); });
  async function loadReviews() {
    const r = await call('/api/admin/configs', { status: crStatus });
    if (!r.ok) return;
    $('#cr-list').innerHTML = r.configs.map(c => `<div class="card row-card" data-cfg="${c.id}"><div class="who">
        <b>${esc(c.name)}</b>${c.tag ? `<span class="plan-chip" style="color:#ffe08a">${esc(c.tag)}</span>` : ''}<span class="plan-chip">${esc(c.author)}</span>
        <div class="meta">${esc(c.file_name)} · ${(c.size / 1024).toFixed(1)} КБ · ${date(c.created_at)} · скачиваний ${c.downloads}${c.tags ? ' · ' + esc(c.tags) : ''}</div>
        <div class="tk-text">${esc(c.description)}</div>${c.reason ? '<div class="meta">Причина отказа: ' + esc(c.reason) + '</div>' : ''}</div>
      <div class="acts"><button class="mini-btn" data-cdl>Скачать</button>
        ${c.status !== 'approved' ? '<button class="mini-btn ok" data-approve>Одобрить</button>' : ''}
        ${c.status !== 'rejected' ? '<button class="mini-btn danger" data-reject>Отклонить</button>' : ''}
        <button class="mini-btn danger" data-cdel>Удалить</button></div></div>`).join('') || '<p class="p-sub">Пусто</p>';
  }
  $('#cr-list').addEventListener('click', async e => {
    const card = e.target.closest('[data-cfg]');
    if (!card) return;
    const id = card.dataset.cfg;
    if (e.target.closest('[data-cdl]')) {
      const r = await call('/api/admin/config/file', { id });
      if (!r.ok) return;
      const bytes = Uint8Array.from(atob(r.data), c => c.charCodeAt(0));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes]));
      a.download = r.fileName.replace(/\.enough$/i, '.vellour');
      a.click();
      return;
    }
    let r;
    if (e.target.closest('[data-approve]')) r = await call('/api/admin/config/review', { id, approve: true });
    else if (e.target.closest('[data-reject]')) { const reason = prompt('Причина отказа:', ''); if (reason === null) return; r = await call('/api/admin/config/review', { id, approve: false, reason }); }
    else if (e.target.closest('[data-cdel]')) { if (!confirm('Удалить конфиг навсегда?')) return; r = await call('/api/admin/config/delete', { id }); }
    if (r && r.ok) { toast('Готово'); loadReviews(); }
  });

  /* ---------- tags next to nicknames ---------- */
  let tagRows = [];
  async function loadTags() {
    const r = await call('/api/admin/tags');
    if (!r.ok) return;
    tagRows = r.tags;
    $('#tg-list').innerHTML = r.tags.map(t => {
      const color = /^[0-9A-Fa-f]{6}$/.test(t.color || '') ? '#' + t.color : '#ffc98a';
      return `<div class="card row-card" data-tg="${esc(t.login_key)}"><div class="who">
        <b>${esc(t.login || t.login_key)}</b>
        ${t.supporter ? '<span class="plan-chip">♥ поддержал проект</span>' : ''}
        ${t.tag ? `<span class="plan-chip" style="color:${color}">${esc(t.tag)}</span>` : ''}
        ${t.pending_tag ? `<div class="meta">Хочет надпись: <b>${esc(t.pending_tag)}</b>${t.pending_color ? ' · цвет #' + esc(t.pending_color) : ''}</div>` : ''}
        <div class="meta">изменил ${esc(t.updated_by || '—')} · ${date(t.updated_at)}</div></div>
        <div class="acts">
          ${t.pending_tag ? '<button class="mini-btn ok" data-tapprove>Одобрить</button><button class="mini-btn danger" data-treject>Отклонить</button>' : ''}
          <button class="mini-btn" data-tedit>Изменить</button>
          <button class="mini-btn" data-tsup="${t.supporter ? 0 : 1}">${t.supporter ? 'Снять ♥' : 'Дать ♥'}</button>
          ${t.tag ? '<button class="mini-btn danger" data-tdel>Убрать тег</button>' : ''}</div></div>`;
    }).join('') || '<p class="p-sub">Пока ни у кого нет тегов</p>';
  }
  $('#tg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const r = await call('/api/admin/tag/set', { login: f.login.value, tag: f.tag.value, color: f.color.value, icon: f.icon.value });
    if (r.ok) { toast('Тег записан'); f.reset(); loadTags(); }
  });
  $('#tg-list').addEventListener('click', async e => {
    const row = e.target.closest('[data-tg]');
    if (!row) return;
    const login = row.dataset.tg;
    const t = tagRows.find(x => x.login_key === login) || {};
    let r;
    if (e.target.closest('[data-tedit]')) {
      const f = $('#tg-form');
      f.login.value = t.login || login; f.tag.value = t.pending_tag || t.tag || ''; f.color.value = (t.pending_tag ? t.pending_color : t.color) || '';
      f.icon.value = t.icon || '';
      f.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (e.target.closest('[data-tapprove]')) r = await call('/api/admin/tag/approve', { login });
    else if (e.target.closest('[data-treject]')) { const reason = prompt('Почему не подходит (игрок увидит в Telegram):', ''); if (reason === null) return; r = await call('/api/admin/tag/reject', { login, reason }); }
    else if (e.target.closest('[data-tsup]')) r = await call('/api/admin/tag/supporter', { login, on: e.target.closest('[data-tsup]').dataset.tsup === '1' });
    else if (e.target.closest('[data-tdel]')) { if (!confirm('Убрать тег у ' + (t.login || login) + '?')) return; r = await call('/api/admin/tag/set', { login, tag: '' }); }
    if (r && r.ok) { toast('Готово'); loadTags(); }
  });

  /* ---------- server rules ---------- */
  $('#sr-ids').textContent = 'fast_swap, item_swap, item_scroller, macros, shift_tap, lock_slot, auto_accept, autonear, auto_respawn, auto_sprint, custom_hitbox, hit_range, target_esp, prediction, totem_tracker, free_look, zoom, fullbright, world_tweaks, shulker_preview, healing_helper, friend_marker';
  let rules = [];
  async function loadServers() {
    const r = await call('/api/admin/server-rules');
    if (!r.ok) return;
    rules = r.rules;
    $('#sr-list').innerHTML = rules.map(x => `<div class="card row-card">
      <div class="who"><b>${esc(x.title || x.pattern)}</b><span class="plan-chip">${esc(x.pattern)}</span>
        <div class="meta">выключено: ${x.modules.concat(x.tools).map(esc).join(', ') || 'ничего'}<br>${esc(x.note)}
        ${x.source ? '<br><a href="' + esc(x.source) + '" target="_blank" rel="noopener">правила сервера</a>' : ''} · изменил ${esc(x.updated_by)}${x.updated_at ? ' ' + date(x.updated_at) : ''}</div></div>
      <div class="acts"><button class="mini-btn" data-sedit="${esc(x.pattern)}">Изменить</button><button class="mini-btn danger" data-sdel="${esc(x.pattern)}">Удалить</button></div></div>`).join('')
      || '<p class="p-sub">Правил нет — на всех серверах всё включено</p>';
  }
  $('#sr-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const r = await call('/api/admin/server-rule/save', { pattern: f.pattern.value, title: f.title.value, modules: f.modules.value, tools: f.tools.value, note: f.note.value, source: f.source.value });
    if (r.ok) { toast('Правило сохранено'); f.reset(); loadServers(); }
  });
  $('#sr-list').addEventListener('click', async e => {
    const ed = e.target.closest('[data-sedit]');
    if (ed) {
      const x = rules.find(r => r.pattern === ed.dataset.sedit);
      const f = $('#sr-form');
      f.pattern.value = x.pattern; f.title.value = x.title; f.modules.value = x.modules.join(', ');
      f.tools.value = x.tools.join(', '); f.note.value = x.note; f.source.value = x.source;
      f.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const d = e.target.closest('[data-sdel]');
    if (d && confirm('Удалить правило для ' + d.dataset.sdel + '? Все модули там станут доступны.')) {
      const r = await call('/api/admin/server-rule/delete', { pattern: d.dataset.sdel });
      if (r.ok) loadServers();
    }
  });

  /* ---------- boot ---------- */
  api('/api/me').then(r => {
    if (!r.ok) { location.replace('/login'); return; }
    if (!['Owner', 'Admin'].includes(r.user.role)) { location.replace('/profile'); return; }
    me = r.user;
    $('#u-login').textContent = me.login;
    $('#u-letter').textContent = me.login[0].toUpperCase();
    $('#u-role').textContent = me.role;
    $('#loading').hidden = true;
    $('#shell').hidden = false;
    const t = location.hash.slice(1);
    tab(['stats', 'users', 'servers', 'tickets', 'cfgreview', 'tags'].includes(t) ? t : 'stats');
  });
})();
