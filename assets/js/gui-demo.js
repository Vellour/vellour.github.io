/* Vellour landing: a working copy of the in-game ClickGUI (modules, settings, search, binds) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- icons ---------------- */
  const ICON = {
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5L13 18a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5L18 3l3 3-3.5 3.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    folder: '<path d="M3 6.5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5"/><path d="M16 4.8a3.4 3.4 0 0 1 0 6.4M18 14.7c2 .7 3.2 2.3 3.6 4.8"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/>',
    shirt: '<path d="M8 3.5L3.5 6.5 6 10.5l2-1v11h8v-11l2 1 2.5-4L16 3.5c-.5 1.6-2 2.6-4 2.6S8.5 5.1 8 3.5z"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24">${ICON[name] || ''}</svg>`;
  $$('.gi').forEach(el => { const n = [...el.classList].find(c => c.startsWith('gi-')); if (n) el.innerHTML = svg(n.slice(3)); });
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  /* ---------------- ClickGUI demo ---------------- */
  const app = $('#gui-app');
  if (!app) return;

  const S = {
    toggle: (name, desc, value = false) => ({ type: 'toggle', name, desc, value }),
    slider: (name, desc, min, max, step, value, suffix = '') => ({ type: 'slider', name, desc, min, max, step, value, suffix }),
    select: (name, desc, options, value) => ({ type: 'select', name, desc, options, value: value ?? options[0] }),
    seg: (name, desc, options, value) => ({ type: 'seg', name, desc, options, value: value ?? options[0] }),
    color: (name, desc, value = '#3358D4') => ({ type: 'color', name, desc, value }),
    multi: (name, desc, options, value) => ({ type: 'multi', name, desc, options, value }),
  };
  const COLORS = ['#E5484D', '#F76B15', '#FFE629', '#30A46C', '#7CE2FE', '#3358D4', '#8E4EC6', '#FFFFFF'];

  const MODULES = [
    { id: 'optimization', name: 'Optimization', cat: 'client', desc: 'Ускоряет игру без потери картинки', on: true, settings: [
      S.toggle('Быстрая графика', 'Отключает AO и включает быструю графику', true),
      S.slider('Дальность чанков', 'Прорисовка, пока модуль включён', 2, 32, 1, 8, ' чанков'),
      S.toggle('Минимум частиц', 'Сокращает количество ванильных частиц', true),
      S.slider('Дальность сущностей', 'Множитель прорисовки сущностей', 10, 100, 5, 50, '%'),
    ] },
    { id: 'trails', name: 'Trails', cat: 'visual', desc: 'Красивый след за игроком при движении', on: true, settings: [
      S.select('Режим', 'Как выглядит след', ['Ленты', 'Линия', 'Частицы', 'Кометы'], 'Ленты'),
      S.slider('Длина', 'Сколько держится след', 4, 60, 1, 24, ' т.'),
      S.toggle('Свечение', 'Мягкий блум вокруг следа', true),
      S.color('Цвет', 'Основной цвет следа', '#3358D4'),
    ] },
    { id: 'notifications', name: 'Notifications', cat: 'client', desc: 'Уведомления о включении модулей', on: true, settings: [
      S.multi('Звуки', 'Настройте звуки интерфейса', ['Открытие GUI', 'Закрытие GUI', 'Включение модуля', 'Выключение модуля', 'Друг', 'Конфиг', 'Метка'], ['Открытие GUI', 'Включение модуля', 'Выключение модуля']),
      S.slider('Громкость', 'Общая громкость звуков интерфейса', 0, 100, 1, 25, '%'),
      S.seg('Положение', 'Где на экране появляются уведомления', ['Сверху', 'Снизу'], 'Сверху'),
      S.slider('Длительность', 'Сколько уведомление держится на экране', 1, 10, 1, 3, 'с'),
      S.color('Цвет обводки', 'Выберите акцентный цвет', '#3358D4'),
    ] },
    { id: 'jump_circle', name: 'JumpCircle', cat: 'visual', desc: 'Гравитационная линза при прыжке', settings: [
      S.select('Стиль', 'Форма круга', ['Линза', 'Кольцо', 'Волна']),
      S.slider('Радиус', 'Размер круга', 0.5, 3, 0.1, 1.4, ' бл.'),
      S.color('Цвет', 'Цвет кольца', '#FFFFFF'),
    ] },
    { id: 'atmosphere', name: 'Atmosphere', cat: 'visual', desc: 'Кинематографичная атмосфера', settings: [
      S.seg('Режим', 'Свет и туман зари', ['Рассвет', 'Сумерки', 'Тема'], 'Рассвет'),
      S.slider('Плотность', 'Плотность тумана', 0.05, 0.8, 0.01, 0.35),
      S.slider('Лучи света', 'Объёмные солнечные лучи', 0, 1, 0.01, 0.75),
      S.toggle('Радуга', 'Радуга после дождя', true),
    ] },
    { id: 'color_plus', name: 'ColorPlus', cat: 'visual', desc: 'Кинематографичная цветокоррекция', settings: [
      S.slider('Контраст', 'Глубина теней', 0, 2, 0.05, 1.15, 'x'),
      S.slider('Насыщенность', 'Яркость цветов', 0, 2, 0.05, 1.25, 'x'),
      S.select('Пресет', 'Готовая цветокоррекция', ['Cinematic', 'Vibrant', 'Natural', 'Sunny Field', 'Sunset', 'Frost', 'Teal-Orange', 'Vintage', 'Neon Night', 'Golden Hour', 'Noir', 'Dreamy', 'Deep Ocean', 'Autumn']),
    ] },
    { id: 'motion_blur', name: 'MotionBlur', cat: 'visual', desc: 'Размытие при движении камеры', settings: [
      S.slider('Сила', 'Длина размытия', 0, 100, 1, 40, '%'),
    ] },
    { id: 'shader_sky', name: 'Shader Sky', cat: 'visual', desc: 'Шейдерное процедурное небо', on: true, settings: [
      S.select('Режим', 'Вид шейдерного неба', ['Aurora', 'Night', 'Snow', 'Sky', 'Star', 'Glow', 'Galaxy', 'Cosmos', 'Orange Space', 'Nebula', 'Caustic', 'Clouds']),
      S.slider('Скорость облаков', 'Как быстро движется небо', 0, 3, 0.1, 1, 'x'),
    ] },
    { id: 'china_hat', name: 'ChinaHat', cat: 'visual', desc: 'Шляпа над головой', settings: [S.color('Цвет', 'Цвет шляпы', '#E5484D'), S.toggle('Градиент', 'Переливающийся цвет', true)] },
    { id: 'target_esp', name: 'Target ESP', cat: 'visual', desc: 'Подсветка цели при ударе', settings: [S.seg('Вид', 'Как подсвечивается цель', ['Кольцо', 'Ромб', 'Души']), S.color('Цвет', 'Цвет подсветки', '#FFE629')] },
    { id: 'kill_effect', name: 'Kill Effect', cat: 'visual', desc: 'Анимация горящей копии при убийстве' },
    { id: 'hit_particles', name: 'Hit Particles', cat: 'visual', desc: 'Частицы при ударе', settings: [S.slider('Количество', 'Частиц за удар', 1, 40, 1, 12)] },
    { id: 'item_physics', name: 'Item Physics', cat: 'visual', desc: 'Живые выпавшие предметы' },
    { id: 'swing', name: 'SwingAnimation', cat: 'visual', desc: 'Плавные анимации руки', settings: [S.select('Анимация', 'Стиль удара', ['Smooth', 'Exhibition', 'Swank', 'Sigma'])] },
    { id: 'view_model', name: 'View Model', cat: 'visual', desc: 'Настройка положения рук', settings: [S.slider('X', 'Сдвиг вбок', -1, 1, 0.05, 0.2), S.slider('Y', 'Сдвиг вверх', -1, 1, 0.05, -0.1)] },
    { id: 'zoom', name: 'Zoom', cat: 'visual', desc: 'Плавное приближение камеры', bind: 'C' },
    { id: 'fullbright', name: 'Fullbright', cat: 'visual', desc: 'Ночное зрение', bind: 'G' },
    { id: 'particles', name: 'Particles', cat: 'visual', desc: 'Частицы в мире' },
    { id: 'svetoch', name: 'Svetoch', cat: 'visual', desc: 'Летающие светящиеся кубы с физикой' },
    { id: 'weather_fx', name: 'Weather FX', cat: 'visual', desc: 'Снег, лепестки, светлячки, свои дождь и снегопад, снег на блоках', on: true, settings: [
      S.select('Атмосфера', 'Частицы, что падают или парят вокруг', ['Нет', 'Снег', 'Метель', 'Лепестки', 'Листопад', 'Светлячки', 'Угольки', 'Пепел', 'Пыль'], 'Снег'),
      S.select('Снег на блоках', 'Снег по пикселю ложится на блоки вокруг', ['Выкл', 'Со снегопадом', 'Всегда'], 'Со снегопадом'),
      S.slider('Скорость заноса', 'Как быстро снег заносит блоки', 0.2, 6, 0.1, 1, 'x'),
      S.toggle('Снег на стенах', 'Наметать снег и на стены, что смотрят против ветра', true),
      S.select('Молнии', 'Далёкие молнии во время грозы', ['Выкл', 'Редкие', 'Частые'], 'Редкие'),
    ] },
    { id: 'hit_ghost', name: 'HitGhost', cat: 'visual', desc: 'При ударе из игрока вылетает призрак в его скине', settings: [
      S.select('Вид', 'Скин: копия игрока; Спрайт: маленький призрак', ['Скин', 'Спрайт', 'Оба'], 'Скин'),
      S.slider('Время', 'Сколько летит призрак', 0.4, 3, 0.1, 1.4, ' с'),
      S.color('Цвет', 'Цвет призрака', '#FFFFFF'),
    ] },
    { id: 'shader_player', name: 'ShaderPlayer', cat: 'visual', desc: 'Шейдерное свечение и дым вокруг игроков', settings: [
      S.select('Стиль', 'Эффект вокруг модели', ['Свечение', 'Дым', 'Аврора', 'Электро', 'Пульс', 'Пламя', 'Голограмма', 'Иней']),
      S.slider('Интенсивность', 'Яркость эффекта', 0.2, 1.5, 0.05, 0.85),
      S.color('Цвет', 'Основной цвет', '#7CE2FE'),
    ] },
    { id: 'kill_shot', name: 'Kill Shot', cat: 'utils', desc: 'Сам делает скриншот, когда ты убил игрока или умер', settings: [
      S.toggle('Убийства', 'Скриншот, когда ты убил игрока', true),
      S.toggle('Смерть', 'Скриншот, когда ты умер', true),
      S.slider('Задержка', 'Через сколько после события снимать кадр', 0, 2, 0.1, 0.4, ' с'),
    ] },
    { id: 'session_stats', name: 'Session Stats', cat: 'utils', desc: 'Убийства, смерти, K/D, серии и время сессии' },
    { id: 'auto_sprint', name: 'Auto Sprint', cat: 'utils', desc: 'Всегда бежать', on: true },
    { id: 'auto_reconnect', name: 'AutoReconnect', cat: 'utils', desc: 'Переподключение после кика', settings: [S.slider('Задержка', 'Перед переподключением', 1, 30, 1, 5, 'с')] },
    { id: 'fast_swap', name: 'Fast Swap', cat: 'utils', desc: 'Быстрая смена предметов' },
    { id: 'item_scroller', name: 'Item Scroller', cat: 'utils', desc: 'Перенос предметов на Shift + ЛКМ' },
    { id: 'name_protect', name: 'Name Protect', cat: 'utils', desc: 'Скрывает ник', settings: [S.toggle('Скрывать друзей', 'Заменять ники друзей', false)] },
    { id: 'streamer_mode', name: 'Streamer Mode', cat: 'utils', desc: 'Скрывает координаты и номер анархии' },
    { id: 'death_cords', name: 'Death Cords', cat: 'utils', desc: 'Метка и координаты при смерти', on: true },
    { id: 'chat_helper', name: 'Chat Helper', cat: 'utils', desc: 'Склеивает повторяющиеся сообщения' },
    { id: 'emotions', name: 'Emotions', cat: 'client', desc: 'Колесо анимаций персонажа', on: true, bind: 'B' },
    { id: 'graffiti', name: 'Graffiti', cat: 'client', desc: 'Колесо граффити на блоках', on: true },
    { id: 'globals', name: 'Globals', cat: 'client', desc: 'Показывает игроков Vellour в табе и чате', on: true },
    { id: 'theme', name: 'Theme', cat: 'client', desc: 'Оформление интерфейса', settings: [S.seg('Тема', 'Цвет интерфейса', ['Тёмная', 'Стекло']), S.slider('Скругление', 'Радиус углов', 0, 20, 1, 14), S.color('Акцент', 'Цвет выделений', '#FFFFFF')] },
    { id: 'gui_size', name: 'Gui Size', cat: 'client', desc: 'Размер меню', settings: [S.slider('Масштаб', 'Размер интерфейса', 50, 150, 5, 100, '%')] },
  ];
  const CATS = [
    { id: 'all', name: 'Все', icon: 'grid' },
    { id: 'visual', name: 'Визуалы', icon: 'eye' },
    { id: 'utils', name: 'Утилиты', icon: 'tool' },
    { id: 'client', name: 'Клиент', icon: 'gear' },
  ];
  const TOOLS = [
    { id: 'configs', name: 'Конфиги', icon: 'folder' },
    { id: 'friends', name: 'Друзья', icon: 'users' },
    { id: 'waypoints', name: 'Метки', icon: 'pin' },
    { id: 'cosmetics', name: 'Косметика', icon: 'shirt' },
  ];

  const state = { view: 'all', search: '', favOnly: false, open: new Set(['notifications']), fav: new Set(), listening: null };
  const content = $('#g-content');

  function renderNav() {
    $('#g-cats').innerHTML = CATS.map(c => {
      const count = c.id === 'all' ? MODULES.length : MODULES.filter(m => m.cat === c.id).length;
      return `<button data-cat="${c.id}" class="${state.view === c.id && !state.search ? 'on' : ''}">${svgI(c.icon)}${c.name}${state.view === c.id && !state.search ? `<span class="badge">${count}</span>` : ''}</button>`;
    }).join('');
    $('#g-tools').innerHTML = TOOLS.map(t => `<button data-tool="${t.id}" class="${state.view === t.id ? 'on' : ''}">${svgI(t.icon)}${t.name}</button>`).join('');
    const cur = [...CATS, ...TOOLS].find(x => x.id === state.view) || CATS[0];
    $('#g-chip-icon').innerHTML = svg(state.search ? 'search' : cur.icon);
    $('#g-chip-title').textContent = state.search ? 'Поиск' : cur.name;
    $('#g-fav-only').classList.toggle('on', state.favOnly);
  }
  const svgI = n => `<i class="gi">${svg(n)}</i>`;

  function visibleModules() {
    const q = state.search.trim().toLowerCase();
    let list = MODULES.filter(m => q
      ? (m.name.toLowerCase().includes(q) || (m.desc || '').toLowerCase().includes(q))
      : (state.view === 'all' || m.cat === state.view));
    if (state.favOnly) list = list.filter(m => state.fav.has(m.id));
    return list.sort((a, b) => (state.fav.has(b.id) - state.fav.has(a.id)) || (b.id === 'optimization') - (a.id === 'optimization') || a.name.localeCompare(b.name));
  }

  function columns() {
    const w = content.clientWidth;
    return w < 560 ? 1 : w < 860 ? 2 : 3;
  }

  function settingHtml(m, s, i) {
    const key = `${m.id}:${i}`;
    const head = (val = '') => `<div class="st-head"><span class="st-sq"></span><span class="st-name">${s.name}</span>${val}</div>${s.desc ? `<div class="st-desc">${s.desc}</div>` : ''}`;
    switch (s.type) {
      case 'toggle':
        return `<div class="st" data-key="${key}"><div class="st-head"><span class="st-sq"></span><span class="st-name">${s.name}</span><button class="toggle ${s.value ? 'on' : ''}" data-act="set-toggle"><i></i></button></div>${s.desc ? `<div class="st-desc">${s.desc}</div>` : ''}</div>`;
      case 'slider': {
        const p = (s.value - s.min) / (s.max - s.min) * 100;
        return `<div class="st" data-key="${key}">${head(`<span class="st-val">${fmt(s)}</span>`)}<div class="st-ctl"><div class="slider" data-act="slider"><div class="fill" style="width:${p}%"></div><div class="knob" style="left:${p}%"></div></div></div></div>`;
      }
      case 'select':
        return `<div class="st" data-key="${key}">${head()}<div class="st-ctl select"><button data-act="select-open">${s.value}</button><div class="select-list">${s.options.map(o => `<button data-act="select" data-v="${o}" class="${o === s.value ? 'on' : ''}">${o}</button>`).join('')}</div></div></div>`;
      case 'seg':
        return `<div class="st" data-key="${key}">${head()}<div class="st-ctl segm">${s.options.map(o => `<button data-act="seg" data-v="${o}" class="${o === s.value ? 'on' : ''}">${o}</button>`).join('')}</div></div>`;
      case 'color':
        return `<div class="st" data-key="${key}">${head(`<span class="st-val">${s.value}</span>`)}<div class="st-ctl swatches">${COLORS.map(c => `<button data-act="color" data-v="${c}" style="background:${c}" class="${c.toLowerCase() === s.value.toLowerCase() ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div></div>`;
      case 'multi':
        return `<div class="st" data-key="${key}">${head(`<span class="st-val">${s.value.length}/${s.options.length}</span>`)}<div class="st-ctl chips">${s.options.map(o => `<button data-act="multi" data-v="${o}" class="${s.value.includes(o) ? 'on' : ''}">${o}</button>`).join('')}</div></div>`;
    }
    return '';
  }
  const fmt = s => {
    const v = s.step < 1 ? (+s.value).toFixed(s.step < 0.1 ? 2 : 1).replace('.', ',') : Math.round(s.value);
    return v + s.suffix;
  };

  function modHtml(m, i) {
    const has = m.settings && m.settings.length;
    return `<div class="mod ${m.on ? 'enabled' : ''} ${state.open.has(m.id) && has ? 'open' : ''}" data-id="${m.id}" style="animation-delay:${Math.min(i, 12) * 22}ms">
      <div class="mod-head" data-act="expand">
        <span class="mod-sq"></span><span class="mod-name" title="${m.desc || ''}">${m.name}</span>
        <button class="mod-bind ${m.bind ? 'set' : ''} ${state.listening === m.id ? 'listening' : ''}" data-act="bind">${state.listening === m.id ? '...' : (m.bind || 'None')}</button>
        <button class="mod-star ${state.fav.has(m.id) ? 'on' : ''}" data-act="fav" aria-label="В избранное">${svg('star')}</button>
        <button class="toggle ${m.on ? 'on' : ''}" data-act="toggle" aria-label="Вкл/выкл"><i></i></button>
      </div>
      ${has ? `<div class="mod-body"><div><div class="mod-settings">${m.settings.map((s, k) => settingHtml(m, s, k)).join('')}</div></div></div>` : ''}
    </div>`;
  }

  function render() {
    renderNav();
    if (TOOLS.some(t => t.id === state.view) && !state.search) return renderTool(state.view);
    const list = visibleModules();
    if (!list.length) { content.innerHTML = '<div class="g-empty">Ничего не найдено</div>'; return; }
    const n = columns();
    const cols = Array.from({ length: n }, () => []);
    list.forEach((m, i) => cols[i % n].push(modHtml(m, i)));
    content.innerHTML = `<div class="g-grid" style="grid-template-columns:repeat(${n},1fr)">${cols.map(c => `<div class="g-col">${c.join('')}</div>`).join('')}</div>`;
  }

  function renderTool(id) {
    const item = (b, span, act = 'Открыть') => `<div class="g-item"><div><b>${b}</b><br><span>${span}</span></div><button class="g-item-act" data-act="noop">${act}</button></div>`;
    const pages = {
      configs: ['Конфиги', [item('pvp-legit', 'Сохранён 2 дня назад, 41 модуль', 'Загрузить'), item('cinematic', 'Для съёмки: Atmosphere, ColorPlus, MotionBlur', 'Загрузить'), item('snowfall', 'Weather FX, снег на блоках, Shader Sky', 'Загрузить')]],
      friends: ['Друзья', [item('Shykoe', 'В сети · FunTime #14', 'Убрать'), item('Lumen', 'Был 3 часа назад', 'Убрать'), item('Kirka', 'В сети · HolyWorld', 'Убрать')]],
      waypoints: ['Метки', [item('Spawn', 'X 0 · Y 64 · Z 0 · 812m', 'Путь'), item('Base', 'X -146 · Y 80 · Z 812 · 10m', 'Путь'), item('Arena', 'X 2048 · Y 70 · Z -512', 'Путь')]],
      cosmetics: ['Косметика', [item('Крылья «Эфир»', 'Видны другим игрокам с Vellour', 'Надеть'), item('Нимб', 'Шапка · анимированная', 'Надеть'), item('Питомец «Искра»', 'Летает рядом с тобой', 'Надеть')]],
    };
    const [title, items] = pages[id];
    content.innerHTML = `<div class="g-page"><h4>${title}</h4><div class="g-list">${items.join('')}</div></div>`;
  }

  function findSetting(el) {
    const st = el.closest('.st');
    if (!st) return null;
    const [id, idx] = st.dataset.key.split(':');
    const m = MODULES.find(x => x.id === id);
    return { m, s: m.settings[+idx], st };
  }

  // ---- events ----
  app.addEventListener('click', e => {
    const nav = e.target.closest('[data-cat],[data-tool]');
    if (nav) {
      state.view = nav.dataset.cat || nav.dataset.tool;
      state.search = ''; $('#g-search').value = '';
      return render();
    }
    if (e.target.closest('[data-focus-search]')) { $('#g-search').focus(); return; }
    if (e.target.closest('#g-fav-only')) { state.favOnly = !state.favOnly; return render(); }
    if (e.target.closest('#g-reset')) {
      state.search = ''; state.favOnly = false; state.view = 'all'; $('#g-search').value = ''; state.open.clear();
      return render();
    }
    const actEl = e.target.closest('[data-act]');
    if (!actEl) { $$('.select.open', app).forEach(s => s.classList.remove('open')); return; }
    const act = actEl.dataset.act;
    const modEl = actEl.closest('.mod');
    const m = modEl && MODULES.find(x => x.id === modEl.dataset.id);

    if (act === 'toggle') { m.on = !m.on; modEl.classList.toggle('enabled', m.on); actEl.classList.toggle('on', m.on); return; }
    if (act === 'fav') { state.fav.has(m.id) ? state.fav.delete(m.id) : state.fav.add(m.id); return render(); }
    if (act === 'bind') { state.listening = state.listening === m.id ? null : m.id; return render(); }
    if (act === 'expand') {
      if (!m.settings || !m.settings.length) { m.on = !m.on; modEl.classList.toggle('enabled', m.on); modEl.querySelector('.toggle').classList.toggle('on', m.on); return; }
      state.open.has(m.id) ? state.open.delete(m.id) : state.open.add(m.id);
      modEl.classList.toggle('open', state.open.has(m.id));
      return;
    }
    const f = findSetting(actEl);
    if (!f) return;
    if (act === 'set-toggle') { f.s.value = !f.s.value; actEl.classList.toggle('on', f.s.value); }
    if (act === 'select-open') { const sel = actEl.parentElement; const was = sel.classList.contains('open'); $$('.select.open', app).forEach(s => s.classList.remove('open')); sel.classList.toggle('open', !was); }
    if (act === 'select') { f.s.value = actEl.dataset.v; f.st.outerHTML = settingHtml(f.m, f.s, f.m.settings.indexOf(f.s)); }
    if (act === 'seg' || act === 'color') { f.s.value = actEl.dataset.v; f.st.outerHTML = settingHtml(f.m, f.s, f.m.settings.indexOf(f.s)); }
    if (act === 'multi') {
      const v = actEl.dataset.v;
      f.s.value = f.s.value.includes(v) ? f.s.value.filter(x => x !== v) : [...f.s.value, v];
      f.st.outerHTML = settingHtml(f.m, f.s, f.m.settings.indexOf(f.s));
    }
  });

  // sliders
  app.addEventListener('pointerdown', e => {
    const sl = e.target.closest('[data-act="slider"]');
    if (!sl) return;
    const f = findSetting(sl);
    sl.classList.add('drag');
    sl.setPointerCapture(e.pointerId);
    const move = ev => {
      const r = sl.getBoundingClientRect();
      let p = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      let v = f.s.min + p * (f.s.max - f.s.min);
      v = Math.round(v / f.s.step) * f.s.step;
      f.s.value = +v.toFixed(4);
      p = (f.s.value - f.s.min) / (f.s.max - f.s.min) * 100;
      sl.querySelector('.fill').style.width = p + '%';
      sl.querySelector('.knob').style.left = p + '%';
      f.st.querySelector('.st-val').textContent = fmt(f.s);
    };
    move(e);
    const up = () => { sl.classList.remove('drag'); sl.removeEventListener('pointermove', move); sl.removeEventListener('pointerup', up); };
    sl.addEventListener('pointermove', move);
    sl.addEventListener('pointerup', up);
  });

  $('#g-search').addEventListener('input', e => { state.search = e.target.value; render(); });

  document.addEventListener('keydown', e => {
    if (state.listening) {
      e.preventDefault();
      const m = MODULES.find(x => x.id === state.listening);
      m.bind = ['Escape', 'Backspace', 'Delete'].includes(e.key) ? null : (e.key.length === 1 ? e.key.toUpperCase() : e.key.replace('Arrow', ''));
      state.listening = null;
      return render();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л')) {
      const r = app.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) { e.preventDefault(); $('#g-search').focus(); }
    }
  });

  let lastCols = 0;
  new ResizeObserver(() => { const n = columns(); if (n !== lastCols) { lastCols = n; render(); } }).observe(content);
  render();
})();
