/* Vellour — messenger chat on the site: global IRC + private messages, photos, GIFs, files, voice, stickers.
   profile.js owns the tab and the friends list and calls window.VellourChat.open() / .setFriends(). */
(function () {
  const { api, store, toast } = window.Vellour;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MB = 1024 * 1024;
  const LIMIT = { image: 6 * MB, gif: 8 * MB, sticker: 1 * MB, voice: 2.5 * MB, file: 25 * MB };

  let me = '', friends = [], withLogin = null, after = 0, timer = null;
  const convs = new Map();          // '' = IRC, else friend login lower-case -> Map(id -> msg)
  const done = new Set();           // conversations whose whole history is loaded
  let packs = [], packSel = 0, rec = null;

  const key = m => !m.to ? '' : (m.from.toLowerCase() === me ? m.to : m.from).toLowerCase();
  const cur = () => (withLogin || '').toLowerCase();
  const fmtSize = b => b < 1024 ? b + ' Б' : b < MB ? Math.round(b / 1024) + ' КБ' : (b / MB).toFixed(1) + ' МБ';
  const fmtDur = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+/g, u => { const clean = u.replace(/[.,!?)]+$/, ''); return '<a href="' + clean + '" target="_blank" rel="noopener noreferrer nofollow">' + clean + '</a>' + u.slice(clean.length); });

  function ingest(list) {
    for (const m of list) {
      const k = key(m);
      if (!convs.has(k)) convs.set(k, new Map());
      convs.get(k).set(m.id, m);
      if (m.id > after) after = m.id;
    }
  }

  // ------------------------------------------------------------------ render

  function media(m) {
    const md = m.media;
    if (!md) return m.kind === 'text' ? '' : '<div class="ch-gone">Вложение удалено</div>';
    if (m.kind === 'image' || m.kind === 'gif') {
      const ratio = md.w && md.h ? md.w / md.h : 1.4;
      const w = Math.round(Math.min(320, 220 * ratio, Math.max(md.w || 320, 140)));   // tiny GIFs get scaled up
      return '<img class="ch-img" loading="lazy" src="' + md.url + '" data-full="' + md.url + '" style="width:' + w + 'px;aspect-ratio:' + ratio + '" alt="">';
    }
    if (m.kind === 'sticker') return '<img class="ch-sticker" loading="lazy" src="' + md.url + '" data-pack="' + (m.sticker && m.sticker.pack || '') + '" alt="стикер" title="Нажми, чтобы добавить набор">';
    if (m.kind === 'voice') return '<div class="ch-voice"><audio controls preload="none" src="' + md.url + '"></audio><span>' + fmtDur(md.dur) + '</span></div>';
    return '<a class="ch-file" href="' + md.url + '" download="' + esc(md.name) + '"><i>⇩</i><span><b>' + esc(md.name) + '</b><small>' + fmtSize(md.size) + '</small></span></a>';
  }

  function paint() {
    const log = $('#ch-log');
    if (!log) return;
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
    const rows = [...(convs.get(cur()) || new Map()).values()].sort((a, b) => a.id - b.id);
    let prev = null;
    log.innerHTML = rows.map(m => {
      const mine = m.from.toLowerCase() === me;
      const head = !prev || prev.from !== m.from || m.at - prev.at > 300000;
      prev = m;
      const time = new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return '<div class="ch-msg' + (mine ? ' me' : '') + (head ? ' head' : '') + '" data-id="' + m.id + '">'
        + (head ? '<div class="ch-who">' + (mine ? '' : '<b data-chatwith="' + esc(m.from) + '">' + esc(m.from) + '</b>') + '<time>' + time + '</time></div>' : '')
        + media(m)
        + (m.text && m.kind !== 'sticker' ? '<div class="ch-bubble">' + linkify(m.text) + '</div>' : '')
        + (mine ? '<button class="ch-del" data-del="' + m.id + '" title="Удалить">×</button>' : '')
        + '</div>';
    }).join('') || '<p class="p-sub ch-empty">' + (withLogin ? 'Напиши первым 👋' : 'Тут пока тихо') + '<br><small>Фото, GIF и файлы — кнопкой 📎, Ctrl+V или перетащи сюда</small></p>';
    if (stick) log.scrollTop = log.scrollHeight;
  }

  function paintSide() {
    const side = $('#ch-side');
    if (!side) return;
    side.innerHTML = '<button data-chat="" class="' + (!withLogin ? 'on' : '') + '"># Общий</button>'
      + friends.map(f => '<button data-chat="' + esc(f.login) + '" class="' + (withLogin === f.login ? 'on' : '') + '"><i class="' + (f.online ? 'on' : '') + '"></i>' + esc(f.login) + '</button>').join('');
  }

  // ------------------------------------------------------------------ network

  async function poll() {
    const r = await api('/api/chat/since', { after });
    if (r.ok && r.messages.length) { ingest(r.messages); paint(); }
  }

  async function history() {
    const k = cur();
    if (done.has(k)) return;
    const list = convs.get(k);
    const before = list && list.size ? Math.min(...list.keys()) : 0;
    const r = await api('/api/chat/history', { with: withLogin || undefined, before: before || undefined });
    if (!r.ok) return;
    if (r.messages.length < 40) done.add(k);
    const log = $('#ch-log'), h = log.scrollHeight;
    ingest(r.messages);
    const first = !before;
    paint();
    if (first) log.scrollTop = log.scrollHeight; else log.scrollTop += log.scrollHeight - h;
  }

  async function send(body) {
    const r = await api('/api/chat/send', { ...body, to: withLogin || undefined });
    if (!r.ok) { toast(r.error, true); return false; }
    poll();
    return true;
  }

  async function upload(kind, blob, name) {
    if (blob.size > LIMIT[kind]) { toast('Слишком большой файл: ' + fmtSize(blob.size) + ' (можно до ' + fmtSize(LIMIT[kind]) + ')', true); return null; }
    status('Загружаю ' + name + '…');
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: blob,
        headers: { Authorization: 'Bearer ' + store.get('vellour_token'), 'X-Kind': kind, 'X-Name': encodeURIComponent(name) } });
      const r = await res.json().catch(() => ({ ok: false, error: 'Ошибка сервера' }));
      status('');
      if (!r.ok) { toast(r.error, true); return null; }
      return r.media;
    } catch (e) {
      status('');
      toast('Не загрузилось', true);
      return null;
    }
  }

  function status(t) { const el = $('#ch-status'); if (el) { el.textContent = t; el.hidden = !t; } }

  // pictures the game can't decode (WebP) or that are too big become PNG/JPEG first
  async function prepareImage(file) {
    const type = file.type;
    if (type === 'image/gif') return { blob: file, kind: 'gif', name: file.name };
    if ((type === 'image/png' || type === 'image/jpeg') && file.size <= LIMIT.image) return { blob: file, kind: 'image', name: file.name };
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const png = type !== 'image/jpeg' && c.width * c.height < 1_500_000;
    const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.88));
    return { blob, kind: 'image', name: file.name.replace(/\.[^.]+$/, '') + (png ? '.png' : '.jpg') };
  }

  async function sendFiles(files) {
    const caption = $('#ch-text').value.trim();
    let first = true;
    for (const f of files) {
      let item = { blob: f, kind: 'file', name: f.name || 'file' };
      if (/^image\/(png|jpeg|webp|gif|bmp)$/.test(f.type)) {
        try { item = await prepareImage(f); } catch { /* send as a file */ }
      } else if (/\.wav$/i.test(f.name)) item.kind = 'voice';
      let md = await upload(item.kind, item.blob, item.name);
      if (!md && item.kind === 'voice') md = await upload('file', item.blob, item.name);
      if (!md) continue;
      if (await send({ media: md.id, text: first ? caption : undefined }) && first) $('#ch-text').value = '';
      first = false;
    }
  }

  // ------------------------------------------------------------------ voice: record -> 16 kHz mono PCM WAV (what the game plays)

  function wav(samples, rate) {
    const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  async function toggleRecord() {
    const btn = $('#ch-mic');
    if (rec) { rec.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('Нет доступа к микрофону', true); }
    const chunks = [], mr = new MediaRecorder(stream);
    const started = Date.now();
    rec = mr;
    btn.classList.add('rec');
    const tick = setInterval(() => { btn.dataset.t = fmtDur(Date.now() - started); if (Date.now() - started > 60000) mr.stop(); }, 250);
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = async () => {
      clearInterval(tick); rec = null; btn.classList.remove('rec'); delete btn.dataset.t;
      stream.getTracks().forEach(t => t.stop());
      if (Date.now() - started < 700) return toast('Слишком коротко', true);
      try {
        const raw = await new Blob(chunks).arrayBuffer();
        const decoded = await new AudioContext().decodeAudioData(raw);
        const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
        const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
        const out = await off.startRendering();
        const md = await upload('voice', wav(out.getChannelData(0), 16000), 'voice.wav');
        if (md) send({ media: md.id });
      } catch { toast('Не получилось обработать запись', true); }
    };
    mr.start();
  }

  // ------------------------------------------------------------------ stickers

  async function loadPacks() {
    const r = await api('/api/stickers/mine');
    if (r.ok) packs = r.packs;
    paintStickers();
  }

  function paintStickers() {
    const box = $('#ch-stickers');
    if (!box || box.hidden) return;
    const pack = packs.find(p => p.id === packSel) || packs[0];
    if (pack) packSel = pack.id;
    box.innerHTML = '<div class="st-tabs">' + packs.map(p => '<button data-pack-tab="' + p.id + '" class="' + (pack && p.id === pack.id ? 'on' : '') + '">' + esc(p.name) + '</button>').join('')
      + '<button data-st-new title="Новый набор">＋</button></div>'
      + (pack ? '<div class="st-grid">' + pack.stickers.map(s => '<button data-st="' + s.id + '"><img loading="lazy" src="' + s.media.url + '" alt="">'
          + (pack.mine ? '<i data-st-rm="' + s.id + '" title="Убрать">×</i>' : '') + '</button>').join('')
        + (pack.mine ? '<label class="st-add" title="Добавить стикер (PNG/JPEG/GIF до 1 МБ)">＋<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden data-st-file></label>' : '') + '</div>'
        + '<div class="st-foot"><span>' + (pack.mine ? 'Твой набор · id ' + pack.id : 'Набор от ' + esc(pack.owner)) + '</span>'
        + '<button data-st-drop="' + pack.id + '">' + (pack.mine ? 'Удалить набор' : 'Убрать набор') + '</button></div>'
        : '<p class="p-sub">Наборов пока нет. Создай свой кнопкой ＋ или нажми на чужой стикер в чате.</p>');
  }

  async function stickerFile(file, packId) {
    let blob = file, name = file.name;
    if (file.type !== 'image/gif') {      // resize to <= 512 px PNG
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      blob = await new Promise(r => c.toBlob(r, 'image/png')); name = name.replace(/\.[^.]+$/, '') + '.png';
    }
    const md = await upload('sticker', blob, name);
    if (!md) return;
    const r = await api('/api/stickers/add', { pack: packId, media: md.id });
    if (!r.ok) toast(r.error, true);
  }

  // ------------------------------------------------------------------ wiring

  function wire() {
    const log = $('#ch-log');
    $('#ch-side').addEventListener('click', e => {
      const b = e.target.closest('[data-chat]'); if (!b) return;
      withLogin = b.dataset.chat || null; paintSide(); paint(); history();
    });
    $('#ch-send').addEventListener('submit', async e => {
      e.preventDefault();
      const text = $('#ch-text').value.trim();
      if (!text) return;
      if (await send({ text })) $('#ch-text').value = '';
    });
    $('#ch-file').addEventListener('change', e => { sendFiles([...e.target.files]); e.target.value = ''; });
    $('#ch-mic').addEventListener('click', toggleRecord);
    $('#ch-text').addEventListener('paste', e => {
      const files = [...(e.clipboardData || {}).files || []];
      if (files.length) { e.preventDefault(); sendFiles(files); }
    });
    log.addEventListener('dragover', e => { e.preventDefault(); log.classList.add('drop'); });
    log.addEventListener('dragleave', () => log.classList.remove('drop'));
    log.addEventListener('drop', e => { e.preventDefault(); log.classList.remove('drop'); sendFiles([...e.dataTransfer.files]); });
    log.addEventListener('scroll', () => { if (log.scrollTop < 30) history(); });
    log.addEventListener('click', async e => {
      const img = e.target.closest('.ch-img');
      if (img) { const lb = $('#ch-lightbox'); lb.innerHTML = '<img src="' + img.dataset.full + '" alt=""><a href="' + img.dataset.full + '" target="_blank" rel="noopener">Открыть оригинал</a>'; lb.hidden = false; return; }
      const st = e.target.closest('.ch-sticker');
      if (st && st.dataset.pack) {
        const id = Number(st.dataset.pack);
        if (packs.some(p => p.id === id)) return;
        const r = await api('/api/stickers/pack', { id });
        if (r.ok && confirm('Добавить набор «' + r.pack.name + '» от ' + r.pack.owner + ' (' + r.pack.stickers.length + ' шт.)?')) {
          const ok = await api('/api/stickers/install', { id });
          if (ok.ok) { toast('Набор добавлен'); loadPacks(); } else toast(ok.error, true);
        }
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del && confirm('Удалить сообщение?')) {
        const r = await api('/api/chat/delete', { id: Number(del.dataset.del) });
        if (!r.ok) return toast(r.error, true);
        for (const c of convs.values()) c.delete(Number(del.dataset.del));
        paint();
      }
    });
    $('#ch-lightbox').addEventListener('click', e => { if (e.target.tagName !== 'A') e.currentTarget.hidden = true; });
    $('#ch-st-btn').addEventListener('click', () => { const b = $('#ch-stickers'); b.hidden = !b.hidden; if (!b.hidden) loadPacks(); });
    $('#ch-stickers').addEventListener('click', async e => {
      const t = e.target;
      if (t.dataset.packTab) { packSel = Number(t.dataset.packTab); return paintStickers(); }
      if ('stNew' in t.dataset) {
        const name = prompt('Название нового набора стикеров');
        if (!name) return;
        const r = await api('/api/stickers/pack/create', { name });
        if (!r.ok) return toast(r.error, true);
        packSel = r.id; return loadPacks();
      }
      if (t.dataset.stRm) { e.stopPropagation(); const r = await api('/api/stickers/remove', { id: Number(t.dataset.stRm) }); if (!r.ok) toast(r.error, true); return loadPacks(); }
      if (t.dataset.stDrop) {
        const pack = packs.find(p => p.id === Number(t.dataset.stDrop));
        if (pack.mine && !confirm('Удалить набор «' + pack.name + '» целиком?')) return;
        const r = await api(pack.mine ? '/api/stickers/pack/delete' : '/api/stickers/uninstall', { id: pack.id });
        if (!r.ok) toast(r.error, true);
        packSel = 0; return loadPacks();
      }
      const st = t.closest('[data-st]');
      if (st) send({ sticker: Number(st.dataset.st) });
    });
    $('#ch-stickers').addEventListener('change', async e => {
      if (!('stFile' in e.target.dataset)) return;
      for (const f of e.target.files) await stickerFile(f, packSel);
      loadPacks();
    });
  }

  let wired = false;
  window.VellourChat = {
    setFriends(list) { friends = list || []; paintSide(); },
    open(login, myName) {
      me = String(myName || '').toLowerCase();
      if (!wired) { wire(); wired = true; }
      if (login !== undefined) withLogin = login || null;
      paintSide(); paint();
      history();
      if (!timer) { poll(); timer = setInterval(() => { if (!document.hidden && !$('#t-chat').hidden) poll(); }, 3000); }
    },
  };
})();
