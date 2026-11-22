(() => {
  'use strict';

  /* ================================================================== */
  /* Общие помощники                                                    */
  /* ================================================================== */

  const app = document.getElementById('app');

  const BGS = [
    ['#c85f32', '#8b5cf6'], ['#ff5d8f', '#ff9a5d'], ['#22c1c3', '#3b82f6'], ['#f59e0b', '#ef4444'],
    ['#10b981', '#06b6d4'], ['#a855f7', '#ec4899'], ['#0ea5e9', '#6366f1'], ['#84cc16', '#16a34a'],
  ];
  const COLORS = ['#c85f32', '#8a6f4d', '#5f8a78', '#b08a3e', '#7a6a9a', '#a0524f', '#4f7a96', '#6b7f4a'];

  const ICONS = {
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    back: '<polyline points="15 18 9 12 15 6"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  };

  const state = {
    token: null,
    me: null,
    chats: [],
    unread: 0,
    requests: 0,
    notifs: 0,
    stream: null,
    muted: true,
  };

  function safeGet(k) {
    try { return localStorage.getItem(k); } catch (_) { return null; }
  }
  function safeSet(k, v) {
    try { localStorage.setItem(k, v); } catch (_) { /* приватный режим */ }
  }
  function safeRemove(k) {
    try { localStorage.removeItem(k); } catch (_) { /* ничего */ }
  }
  state.token = safeGet('dostar_token');

  // Создание элементов. Весь текст вставляется как текст (а не HTML) — это защищает от XSS.
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in el && k !== 'list' && k !== 'form') {
          try { el[k] = v; } catch (_) { el.setAttribute(k, v); }
        } else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function icon(name) {
    const s = document.createElement('span');
    s.className = 'icon';
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    return s;
  }

  function avatar(u, size) {
    const el = h('div', {
      class: 'avatar',
      style: { width: size + 'px', height: size + 'px', background: u.color || '#c85f32', fontSize: Math.round(size * 0.42) + 'px' },
    });
    if (u.avatar) el.append(h('img', { src: u.avatar, alt: '', loading: 'lazy' }));
    else el.append(document.createTextNode([...(u.name || u.username || '?')][0] || '?'));
    return el;
  }

  // #теги и @упоминания становятся кнопками
  function rich(txt) {
    txt = String(txt == null ? '' : txt);
    const out = [];
    const re = /(#[\p{L}\p{N}_]{2,30}|@[a-z0-9_]{3,20})/gu;
    let last = 0;
    let m;
    while ((m = re.exec(txt))) {
      if (m.index > last) out.push(txt.slice(last, m.index));
      const tok = m[0];
      out.push(h('button', { type: 'button', class: 'tag', onclick: (e) => { e.stopPropagation(); if (tok[0] === '#') openSearch(tok); else openMention(tok.slice(1)); } }, tok));
      last = m.index + tok.length;
    }
    if (last < txt.length) out.push(txt.slice(last));
    return out;
  }
  async function openMention(name) {
    try {
      const d = await api('/api/u/' + encodeURIComponent(name));
      openProfile(d.user.id);
    } catch (e) { toast(e.message, true); }
  }
  const gradOf = (bg) => { const pair = BGS[(bg || 0) % BGS.length]; return 'linear-gradient(135deg, ' + pair[0] + ', ' + pair[1] + ')'; };

  const spinnerScreen = () => h('div', { class: 'center-screen' }, h('div', { class: 'spinner' }));

  let toastTimer = null;
  /* ---------------- уведомления о сообщениях ---------------- */
  const notifySupported = () => 'Notification' in window;
  const notifyOn = () => {
    try { return notifySupported() && Notification.permission === 'granted' && localStorage.getItem('dostar_notify') === '1'; } catch (_) { return false; }
  };
  function notifyMessage(m) {
    if (!state.me || m.from === state.me.id || !document.hidden || !notifyOn()) return;
    try {
      const n = new Notification('Новое сообщение', { body: String(m.text || '').slice(0, 120), tag: 'eileen-chat-' + m.from, icon: '/icons/icon-192.png' });
      n.onclick = () => { window.focus(); location.hash = '#/chats/' + m.from; n.close(); };
    } catch (_) { /* браузер не разрешил — молча пропускаем */ }
  }
  window.addEventListener('offline', () => toast('Нет подключения к интернету', true));
  window.addEventListener('online', () => toast('Подключение восстановлено'));
  function toast(msg, isErr) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' error' : '');
    t.hidden = true;
    void t.offsetWidth;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  function fmtClock(ts) {
    const d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toDateString() === new Date().toDateString() ? fmtClock(ts) : pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1);
  }
  function dayLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Сегодня';
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Вчера';
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  function fmtSeen(ts) {
    const lbl = dayLabel(ts).toLowerCase();
    return lbl === 'сегодня' || lbl === 'вчера' ? lbl + ' в ' + fmtClock(ts) : lbl;
  }
  function fmtCount(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return String(n);
  }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ---------------- запросы к серверу ---------------- */

  async function api(path, opts) {
    opts = opts || {};
    const headers = {};
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    let body = opts.body;
    if (body !== undefined && typeof body !== 'string') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    let res;
    try {
      res = await fetch(path, { method: opts.method || 'GET', headers, body });
    } catch (_) {
      throw new Error('Нет соединения с сервером');
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* пустой ответ */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Ошибка ' + res.status);
      err.status = res.status;
      if (res.status === 401 && state.token) logout(true);
      throw err;
    }
    return data;
  }

  const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
  function guessType(f) {
    const t = (f.type || '').toLowerCase();
    if (OK_TYPES.includes(t)) return t;
    const m = /\.([a-z0-9]+)$/i.exec(f.name || '');
    return m ? EXT_TYPES[m[1].toLowerCase()] || '' : '';
  }

  function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const type = guessType(file);
      if (!type) { reject(new Error('Неподдерживаемый формат файла')); return; }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
      xhr.setRequestHeader('Content-Type', type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let d = null;
        try { d = JSON.parse(xhr.responseText); } catch (_) { /* ничего */ }
        if (xhr.status >= 200 && xhr.status < 300 && d && d.url) resolve(d);
        else reject(new Error((d && d.error) || 'Не удалось загрузить файл'));
      };
      xhr.onerror = () => reject(new Error('Нет соединения с сервером'));
      xhr.send(file);
    });
  }

  /* ---------------- всплывающее окно ---------------- */

  function openSheet(title, body, footer) {
    const prevFocus = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    let closing = false;
    function close() {
      if (closing) return;
      closing = true;
      backdrop.classList.add('closing');
      const done = () => backdrop.remove();
      if (document.documentElement.classList.contains('no-anim')) done(); else setTimeout(done, 220);
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (_) { /* ничего */ } }
    }
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'sheet-head' },
        h('h3', {}, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Закрыть', onclick: close }, icon('x'))),
      h('div', { class: 'sheet-body' }, body),
      footer || null);
    const backdrop = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, sheet);
    document.body.append(backdrop);
    document.addEventListener('keydown', onKey);
    return { close, sheet };
  }

  /* ---------------- поиск и закладки ---------------- */
  function postGrid(posts) {
    return h('div', { class: 'pf-grid' }, posts.map((p) => {
      let inner;
      if (p.kind === 'video') inner = h('video', { src: p.mediaUrl + '#t=0.1', muted: '', preload: 'metadata', playsinline: '' });
      else if (p.kind === 'image') inner = h('img', { src: p.mediaUrl, alt: '', loading: 'lazy' });
      else inner = h('div', { class: 'pf-text' }, p.caption);
      const cell = h('div', { class: 'pf-cell clickable', role: 'button', tabindex: '0', title: '@' + p.user.username + (p.caption ? ': ' + p.caption : ''), onclick: () => openPost(p), onkeydown: (e) => { if (e.key === 'Enter') openPost(p); } }, inner, h('span', { class: 'pf-likes' }, '♥ ' + fmtCount(p.likes)));
      if (p.kind !== 'text' && p.caption) cell.append(h('span', { class: 'pf-cap' }, p.caption));
      return cell;
    }));
  }

  function openBookmarks() {
    const body = h('div', {}, h('div', { class: 'empty' }, 'Загрузка…'));
    openSheet('Закладки', body);
    api('/api/bookmarks').then((d) => {
      body.replaceChildren(d.posts.length ? postGrid(d.posts) : h('div', { class: 'empty' }, 'Здесь пока ничего нет. Сохраняйте посты кнопкой-закладкой в ленте.'));
    }).catch((e) => body.replaceChildren(h('div', { class: 'empty' }, e.message)));
  }

  function openSearch(initial) {
    const out = h('div', {}, h('div', { class: 'empty' }, 'Ищи людей по имени и посты по словам или #хэштегам'));
    const input = h('input', { type: 'search', placeholder: 'Поиск…', maxlength: '40', autocomplete: 'off', style: { width: '100%', marginBottom: '12px' } });
    const sh = openSheet('Поиск', h('div', {}, input, out));
    let timer = null;
    let seq = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      timer = setTimeout(async () => {
        if (q.length < 2) { out.replaceChildren(h('div', { class: 'empty' }, 'Введи минимум 2 символа')); return; }
        const my = ++seq;
        try {
          const d = await api('/api/search?q=' + encodeURIComponent(q));
          if (my !== seq) return;
          const people = d.users.map((u) => h('div', { class: 'row' },
            h('button', { type: 'button', style: { display: 'flex', background: 'none', border: 0, padding: 0, cursor: 'pointer' }, onclick: () => openProfile(u.id) }, avatar(u, 42)),
            h('div', { class: 'meta' }, h('div', { class: 'title' }, u.name), h('div', { class: 'sub' }, '@' + u.username))));
          out.replaceChildren(...[
            people.length ? h('div', { class: 'list' }, people) : null,
            d.posts.length ? postGrid(d.posts) : null,
            !people.length && !d.posts.length ? h('div', { class: 'empty' }, 'Ничего не найдено') : null].filter(Boolean));
        } catch (e) { out.replaceChildren(h('div', { class: 'empty' }, e.message)); }
      }, 300);
    });
    setTimeout(() => input.focus(), 60);
    const fire = (q) => { input.value = q; input.dispatchEvent(new Event('input')); };
    if (initial) fire(initial);
    else api('/api/trending').then((d) => {
      if (input.value || !d.tags.length) return;
      out.replaceChildren(h('div', { class: 'section-title' }, 'Популярные теги'),
        h('div', { class: 'chips' }, d.tags.map((t) => h('button', { type: 'button', class: 'chip', onclick: () => fire(t.tag) }, t.tag + ' · ' + t.count))));
    }).catch(() => {});
    return sh;
  }

  /* ---------------- профиль человека ---------------- */
  async function openProfile(uid) {
    if (uid === state.me.id) {
      document.querySelectorAll('.backdrop').forEach((b) => b.remove());
      location.hash = '#/profile';
      return;
    }
    const body = h('div', {}, h('div', { class: 'empty' }, 'Загрузка…'));
    const sh = openSheet('Профиль', body);
    try {
      const [u, pr] = await Promise.all([api('/api/users/' + uid), api('/api/users/' + uid + '/posts')]);
      const stat = (n, label) => h('div', { class: 'pf-stat' }, h('b', {}, fmtCount(n)), h('span', {}, label));
      const reload = () => { sh.close(); openProfile(uid); refreshCounts(); };
      const go = (fn, okMsg) => async () => { try { await fn(); if (okMsg) toast(okMsg); reload(); } catch (e) { toast(e.message, true); } };
      const actions = h('div', { class: 'pf-btns' });
      if (u.relation === 'none') actions.append(h('button', { class: 'btn primary', type: 'button', onclick: go(() => api('/api/friends/request', { method: 'POST', body: { userId: uid } }), 'Заявка отправлена') }, 'Добавить в друзья'));
      else if (u.relation === 'outgoing') actions.append(h('button', { class: 'btn', type: 'button', disabled: true }, 'Заявка отправлена'));
      else if (u.relation === 'incoming') actions.append(h('button', { class: 'btn primary', type: 'button', onclick: go(() => api('/api/friends/respond', { method: 'POST', body: { userId: uid, accept: true } }), 'Теперь вы друзья') }, 'Принять заявку'));
      else if (u.relation === 'friend') actions.append(h('a', { class: 'btn primary', href: '#/chats/' + uid, onclick: () => sh.close() }, 'Написать'));
      const us = u.user;
      const status = us.online ? h('div', { class: 'presence online' }, '● в сети') : us.lastSeen ? h('div', { class: 'presence' }, 'был(а) в сети ' + fmtSeen(us.lastSeen)) : null;
      body.replaceChildren(
        h('div', { class: 'pf-head' },
          avatar(us, 84),
          h('div', { class: 'pf-name' }, us.name),
          h('div', { class: 'time' }, '@' + us.username),
          status,
          us.bio ? h('div', { class: 'pf-bio' }, rich(us.bio)) : null,
          h('div', { class: 'pf-stats' }, stat(pr.count, 'постов'), stat(pr.likes, 'лайков'), stat(pr.friends, 'друзей')),
          actions),
        pr.posts.length ? postGrid(pr.posts) : h('div', { class: 'empty' }, 'Постов пока нет'));
    } catch (e) {
      body.replaceChildren(h('div', { class: 'empty' }, e.message));
    }
  }

  /* ================================================================== */
  /* Каркас приложения и навигация                                      */
  /* ================================================================== */

  /* ================================================================== */
  /* Оформление: движок тем (цвета, радуга, неон, стекло…)              */
  /* ================================================================== */

  const DEFAULT_THEME = {
    preset: 'Стандарт', accent: '#c85f32', accent2: '#a8482a', bg: '#151412', panel: '#1e1c1a', text: '#f2ede6',
    rainbow: false, speed: 40, glow: 0, radius: 10, glass: false, blur: 16, panelAlpha: 100, aurora: false, anim: true, compact: false, scale: 100,
  };
  const PRESETS = [
    { name: 'Стандарт', t: {} },
    { name: 'Неон', t: { accent: '#00f0ff', accent2: '#ff00e6', bg: '#0a0a12', panel: '#12121c', text: '#eaffff', glow: 14, aurora: true } },
    { name: 'Радуга', t: { rainbow: true, speed: 45, bg: '#0b0b10', panel: '#14141c', glow: 10 } },
    { name: 'Сакура', t: { accent: '#ff7eb6', accent2: '#c58bff', bg: '#170d16', panel: '#221321', text: '#ffeef8', glow: 8, radius: 18, aurora: true } },
    { name: 'Матрица', t: { accent: '#00ff66', accent2: '#00c853', bg: '#020a04', panel: '#07140a', text: '#c8ffd9', glow: 12, radius: 3 } },
    { name: 'Кровь', t: { accent: '#ff2d4a', accent2: '#ff7a00', bg: '#120808', panel: '#1d0e0e', text: '#ffeaea', glow: 10, radius: 6 } },
    { name: 'Океан', t: { accent: '#00c6ff', accent2: '#0072ff', bg: '#07121c', panel: '#0d1c2b', text: '#e8f6ff', glow: 6 } },
    { name: 'Закат', t: { accent: '#ff9a3c', accent2: '#ff3c6e', bg: '#14090d', panel: '#1f0f15', text: '#fff0e8', glow: 6, aurora: true } },
    { name: 'Лёд (стекло)', t: { accent: '#7fdbff', accent2: '#b388ff', bg: '#0a1020', panel: '#121a30', text: '#eef6ff', glass: true, blur: 18, panelAlpha: 55, aurora: true, glow: 6, radius: 20 } },
    { name: 'AMOLED', t: { accent: '#8ab4ff', accent2: '#ff8ab4', bg: '#000000', panel: '#0b0b0b', text: '#ffffff' } },
    { name: 'Светлая', t: { accent: '#4f6bff', accent2: '#ff4d88', bg: '#f3f5fa', panel: '#ffffff', text: '#14171f' } },
  ];

  let theme = Object.assign({}, DEFAULT_THEME);
  let rainbowTimer = null;
  let rainbowHue = 0;
  let themeSaveTimer = null;

  function sanitizeTheme(t) {
    const out = Object.assign({}, DEFAULT_THEME);
    if (!t || typeof t !== 'object') return out;
    for (const k of ['accent', 'accent2', 'bg', 'panel', 'text']) {
      if (typeof t[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(t[k])) out[k] = t[k].toLowerCase();
    }
    for (const k of ['rainbow', 'glass', 'aurora', 'compact']) out[k] = t[k] === true;
    out.anim = t.anim !== false;
    const clamp = (k, min, max) => {
      const v = Number(t[k]);
      if (t[k] !== undefined && t[k] !== null && Number.isFinite(v)) out[k] = Math.min(max, Math.max(min, Math.round(v)));
    };
    clamp('speed', 1, 100);
    clamp('glow', 0, 40);
    clamp('radius', 0, 28);
    clamp('blur', 0, 40);
    clamp('panelAlpha', 30, 100);
    clamp('scale', 80, 125);
    out.preset = typeof t.preset === 'string' ? t.preset.slice(0, 30) : '';
    return out;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  }
  function mixHex(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function luminance(hex) {
    const c = hexToRgb(hex);
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  }
  function rgbaStr(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function hslToHex(hh, ss, ll) {
    const s = ss / 100;
    const l = ll / 100;
    const k = (n) => (n + hh / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
  }

  function applyColors(accent, accent2) {
    const st = document.documentElement.style;
    st.setProperty('--accent', accent);
    st.setProperty('--accent2', accent2);
    st.setProperty('--accent-a', rgbaStr(accent, 0.28));
    st.setProperty('--accent2-a', rgbaStr(accent2, 0.22));
    st.setProperty('--on-accent', luminance(mixHex(accent, accent2, 0.5)) > 0.6 ? '#0b0b10' : '#ffffff');
  }

  function stopRainbow() {
    if (rainbowTimer) { clearInterval(rainbowTimer); rainbowTimer = null; }
  }
  function startRainbow() {
    stopRainbow();
    const step = () => {
      rainbowHue = (rainbowHue + 0.5 + (theme.speed / 100) * 4) % 360;
      applyColors(hslToHex(rainbowHue, 90, 62), hslToHex((rainbowHue + 70) % 360, 90, 62));
    };
    step();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) rainbowTimer = setInterval(() => { if (!document.hidden) step(); }, 50);
  }

  function applyTheme(t) {
    theme = t;
    const root = document.documentElement;
    const st = root.style;
    const toward = luminance(t.bg) > 0.5 ? '#000000' : '#ffffff';
    const alpha = t.panelAlpha / 100;
    st.setProperty('--bg', t.bg);
    st.setProperty('--panel', rgbaStr(t.panel, alpha));
    st.setProperty('--panel2', rgbaStr(mixHex(t.panel, toward, 0.07), Math.max(0.7, alpha)));
    st.setProperty('--line', mixHex(t.panel, toward, 0.16));
    st.setProperty('--text', t.text);
    st.setProperty('--muted', mixHex(t.text, t.bg, 0.5));
    st.setProperty('--glow', String(t.glow));
    st.setProperty('--rs', String(t.radius / 14));
    st.setProperty('--fs', String(t.scale / 100));
    st.setProperty('--blur', t.blur + 'px');
    root.classList.toggle('glass', t.glass);
    root.classList.toggle('aurora', t.aurora);
    root.classList.toggle('no-anim', !t.anim);
    root.classList.toggle('compact', t.compact);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
    if (t.rainbow) startRainbow();
    else { stopRainbow(); applyColors(t.accent, t.accent2); }
  }

  function saveTheme() {
    safeSet('dostar_theme', JSON.stringify(theme));
    if (!state.me) return;
    clearTimeout(themeSaveTimer);
    themeSaveTimer = setTimeout(async () => {
      try {
        const r = await api('/api/me', { method: 'PUT', body: { theme } });
        if (state.me) state.me.theme = r.user.theme;
      } catch (_) { /* сохранится в следующий раз */ }
    }, 700);
  }
  function setTheme(next) {
    applyTheme(sanitizeTheme(next));
    saveTheme();
  }
  function patchTheme(p) {
    setTheme(Object.assign({}, theme, p, { preset: '' }));
  }
  function loadLocalTheme() {
    try {
      const raw = safeGet('dostar_theme');
      if (raw) theme = sanitizeTheme(JSON.parse(raw));
    } catch (_) { theme = Object.assign({}, DEFAULT_THEME); }
    applyTheme(theme);
  }
  // Тема, сохранённая в аккаунте, подтягивается на любом устройстве после входа.
  function syncThemeFromMe() {
    if (state.me && state.me.theme) {
      applyTheme(sanitizeTheme(state.me.theme));
      safeSet('dostar_theme', JSON.stringify(theme));
    }
  }

  let shell = null;
  let current = null; // текущий экран: {el, destroy, onMessage, onFriends, onChats}

  function buildShell() {
    if (shell && shell.root.isConnected) return;
    const host = h('div', { class: 'main' });
    const items = [['feed', 'Лента', 'home'], ['chats', 'Чаты', 'chat'], ['friends', 'Друзья', 'users'], ['grades', 'Оценки', 'book'], ['activity', 'Активность', 'bell'], ['profile', 'Профиль', 'user']];
    const links = {};
    const badges = {};
    const nav = h('nav', { class: 'nav' },
      h('div', { class: 'brand' }, 'Eileen'),
      items.map(([key, label, ic]) => {
        const badge = h('span', { class: 'badge', hidden: true });
        badges[key] = badge;
        const a = h('a', { href: '#/' + key }, icon(ic), h('span', {}, label), badge);
        links[key] = a;
        return a;
      }),
      h('a', { href: '#', class: 'nav-extra', onclick: (e) => { e.preventDefault(); openSearch(); } }, icon('search'), h('span', {}, 'Поиск')),
      h('a', { href: '#', class: 'nav-extra', onclick: (e) => { e.preventDefault(); openBookmarks(); } }, icon('bookmark'), h('span', {}, 'Закладки')));
    const root = h('div', { class: 'shell' }, nav, host);
    app.replaceChildren(root);
    shell = { root, host, links, badges };
    updateBadges();
  }

  function updateBadges() {
    if (shell) {
      const set = (key, n) => {
        shell.badges[key].hidden = !n;
        shell.badges[key].textContent = n > 99 ? '99+' : String(n);
      };
      set('chats', state.unread);
      set('friends', state.requests);
      set('activity', state.notifs);
    }
    document.title = state.unread ? '(' + state.unread + ') Eileen' : 'Eileen';
  }

  function mount(view) {
    if (current && current.destroy) {
      try { current.destroy(); } catch (e) { console.error(e); }
    }
    current = view;
    shell.host.replaceChildren(view.el);
  }

  function route() {
    if (!state.me) { renderAuth(); return; }
    buildShell();
    const parts = (location.hash.replace(/^#/, '') || '/feed').split('/').filter(Boolean);
    const name = parts[0];
    const navName = name === 'theme' ? 'profile' : name;
    for (const k of Object.keys(shell.links)) shell.links[k].classList.toggle('active', k === navName);
    let view;
    switch (name) {
      case 'feed': view = viewFeed(); break;
      case 'chats': {
        const id = parts[1] ? Number(parts[1]) : null;
        if (parts[1] && !Number.isInteger(id)) { location.replace('#/chats'); return; }
        view = viewChats(id);
        break;
      }
      case 'friends': view = viewFriends(); break;
      case 'grades': view = viewGrades(); break;
      case 'activity': view = viewActivity(); break;
      case 'profile': view = viewProfile(); break;
      case 'theme': view = viewTheme(); break;
      default: location.replace('#/feed'); return;
    }
    mount(view);
  }

  /* ---------------- счётчики и события в реальном времени ---------------- */

  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshCounts, 250);
  }
  async function refreshCounts() {
    if (!state.me) return;
    try {
      const [c, f, n] = await Promise.all([api('/api/chats'), api('/api/friends'), api('/api/notifications?limit=0')]);
      state.notifs = n.unread;
      state.chats = c.chats;
      state.unread = c.chats.reduce((s, x) => s + x.unread, 0);
      state.requests = f.incoming.length;
      updateBadges();
      if (current && current.onChats) current.onChats();
    } catch (_) { /* тихо: следующая попытка будет позже */ }
  }

  function closeStream() {
    if (state.stream) { state.stream.close(); state.stream = null; }
  }
  function connectStream() {
    closeStream();
    if (!state.token || typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/stream?token=' + encodeURIComponent(state.token));
    es.addEventListener('message', (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch (_) { return; }
      if (data && data.message && current && current.onMessage) current.onMessage(data.message);
      if (data && data.message) notifyMessage(data.message);
      scheduleRefresh();
    });
    es.addEventListener('typing', (ev) => {
      try { const d = JSON.parse(ev.data); if (current && current.onTyping) current.onTyping(d.from); } catch (_) {}
    });
    es.addEventListener('message_deleted', (ev) => {
      try { const d = JSON.parse(ev.data); if (current && current.onMessageDeleted) current.onMessageDeleted(d.id); } catch (_) {}
      scheduleRefresh();
    });
    es.addEventListener('message_edited', (ev) => {
      try { const d = JSON.parse(ev.data); if (d.message && current && current.onMessageEdited) current.onMessageEdited(d.message); } catch (_) {}
      scheduleRefresh();
    });
    es.addEventListener('notify', () => {
      if (current && current.onNotify) current.onNotify();
      scheduleRefresh();
    });
    es.addEventListener('read', (ev) => {
      try { const d = JSON.parse(ev.data); if (current && current.onRead) current.onRead(d.by); } catch (_) {}
    });
    es.addEventListener('presence', (ev) => {
      try {
        const d = JSON.parse(ev.data);
        const c = state.chats.find((x) => x.user.id === d.id);
        if (c) c.online = d.online;
        if (current && current.onPresence) current.onPresence(d.id, d.online);
        if (current && current.onChats) current.onChats();
      } catch (_) {}
    });
    es.addEventListener('friends', () => {
      if (current && current.onFriends) current.onFriends();
      scheduleRefresh();
    });
    state.stream = es;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh();
  });

  /* ---------------- вход / выход ---------------- */

  function startSession() {
    syncThemeFromMe();
    connectStream();
    refreshCounts();
    route();
  }

  async function logout(silent) {
    if (!silent) { try { await api('/api/logout', { method: 'POST' }); } catch (_) { /* ничего */ } }
    state.token = null;
    state.me = null;
    state.chats = [];
    state.unread = 0;
    state.requests = 0;
    state.notifs = 0;
    safeRemove('dostar_token');
    closeStream();
    if (current && current.destroy) { try { current.destroy(); } catch (_) { /* ничего */ } }
    current = null;
    shell = null;
    history.replaceState(null, '', location.pathname);
    document.title = 'Eileen';
    route();
  }

  function renderAuth() {
    let mode = 'login';
    const err = h('div', { class: 'form-error', role: 'alert' });
    const nameI = h('input', { type: 'text', placeholder: 'Как тебя зовут', maxlength: '40', autocomplete: 'name' });
    const userI = h('input', { type: 'text', placeholder: 'например: aidar_01', maxlength: '20', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off' });
    const passI = h('input', { type: 'password', placeholder: 'не короче 6 символов', maxlength: '100', autocomplete: 'current-password' });
    const nameField = h('div', { class: 'field', hidden: true }, h('label', {}, 'Имя'), nameI);
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, 'Войти');
    const tLogin = h('button', { type: 'button', class: 'active', onclick: () => setMode('login') }, 'Вход');
    const tReg = h('button', { type: 'button', onclick: () => setMode('register') }, 'Регистрация');
    function setMode(m) {
      mode = m;
      tLogin.classList.toggle('active', m === 'login');
      tReg.classList.toggle('active', m === 'register');
      nameField.hidden = m === 'login';
      submit.textContent = m === 'login' ? 'Войти' : 'Создать аккаунт';
      passI.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      err.textContent = '';
    }
    const form = h('form', {
      class: 'auth-card',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        try {
          const d = await api('/api/' + mode, { method: 'POST', body: { username: userI.value, password: passI.value, name: nameI.value } });
          state.token = d.token;
          safeSet('dostar_token', d.token);
          state.me = d.user;
          history.replaceState(null, '', '#/feed');
          startSession();
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          submit.disabled = false;
        }
      },
    },
      h('h1', { class: 'logo' }, 'Eileen'),
      h('div', { class: 'hint' }, 'Общайся с друзьями, смотри ленту и следи за оценками'),
      h('div', { class: 'tabs' }, tLogin, tReg),
      nameField,
      h('div', { class: 'field' }, h('label', {}, 'Логин'), userI),
      h('div', { class: 'field' }, h('label', {}, 'Пароль'), passI),
      err,
      submit);
    app.replaceChildren(h('div', { class: 'auth' }, form));
  }

  /* ================================================================== */
  /* Экран: ЛЕНТА                                                       */
  /* ================================================================== */

  function viewFeed() {
    const feedEl = h('div', { class: 'feed' });
    const fab = h('button', { class: 'fab', type: 'button', 'aria-label': 'Создать пост', onclick: () => openCreatePost() }, icon('plus'));
    let scope = safeGet('eileen_scope') === 'friends' ? 'friends' : 'all';
    const tabAll = h('button', { type: 'button', class: 'ft' + (scope === 'all' ? ' active' : ''), onclick: () => setScope('all') }, 'Для вас');
    const tabFr = h('button', { type: 'button', class: 'ft' + (scope === 'friends' ? ' active' : ''), onclick: () => setScope('friends') }, 'Друзья');
    const tabs = h('div', { class: 'feed-tabs', role: 'tablist' }, tabAll, tabFr);
    const searchBtn = h('button', { class: 'fab fab-left', type: 'button', 'aria-label': 'Поиск', onclick: () => openSearch() }, icon('search'));
    const el = h('div', { class: 'feed-wrap' }, feedEl, tabs, searchBtn, fab);
    const posts = [];
    let cursor = 0;
    let loading = false;
    let destroyed = false;
    let gen = 0;

    // Подгружаем видео только рядом с экраном и выгружаем далёкие — экономим память и трафик.
    const nearObs = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const v = en.target.querySelector('video');
        if (!v) continue;
        if (en.isIntersecting) {
          if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
        } else if (v.getAttribute('src')) {
          v.pause();
          v.removeAttribute('src');
          v.load();
        }
      }
    }, { root: feedEl, rootMargin: '150% 0px' });

    // Играет только то видео, которое сейчас на экране.
    const playObs = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const v = en.target.querySelector('video');
        const idx = Number(en.target.dataset.idx);
        if (en.isIntersecting && en.intersectionRatio >= 0.6) {
          if (v) {
            if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
            v.muted = state.muted;
            const pr = v.play();
            if (pr && pr.catch) pr.catch(() => {});
          }
          if (idx >= posts.length - 3) loadMore();
        } else if (v) {
          v.pause();
        }
      }
    }, { root: feedEl, threshold: [0, 0.6, 1] });

    function buildPost(p, idx) {
      const inner = h('div', { class: 'post-inner' });
      let video = null;
      if (p.kind === 'video') {
        video = h('video', { class: 'post-media', loop: true, preload: 'metadata' });
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.muted = state.muted;
        video.dataset.src = p.mediaUrl;
        inner.append(video);
      } else if (p.kind === 'image') {
        inner.append(h('img', { class: 'post-media', src: p.mediaUrl, alt: '', loading: 'lazy' }));
      } else {
        const pair = BGS[p.bg % BGS.length];
        inner.append(h('div', { class: 'post-text', style: { background: 'linear-gradient(135deg, ' + pair[0] + ', ' + pair[1] + ')' } }, h('span', {}, rich(p.caption))));
      }
      const flag = h('div', { class: 'pause-flag' }, '❚❚');
      inner.append(flag);
      if (video) {
        video.addEventListener('click', () => {
          if (video.paused) {
            const pr = video.play();
            if (pr && pr.catch) pr.catch(() => {});
          } else {
            video.pause();
            flag.classList.add('show');
            setTimeout(() => flag.classList.remove('show'), 500);
          }
        });
      }
      if (p.kind !== 'text') inner.append(h('div', { class: 'post-shade' }));

      const who = h('button', { class: 'who', type: 'button', onclick: () => openUserCard(p.user.id) }, '@' + p.user.username);
      inner.append(h('div', { class: 'post-info' }, who, p.kind !== 'text' && p.caption ? h('div', { class: 'cap' }, rich(p.caption)) : null));

      const likeCount = h('span', {}, fmtCount(p.likes));
      const likeBtn = h('button', { type: 'button', class: p.liked ? 'liked' : '', 'aria-label': 'Нравится' }, icon('heart'), likeCount);
      likeBtn.addEventListener('click', async () => {
        const was = likeBtn.classList.contains('liked');
        likeBtn.classList.toggle('liked', !was);
        try {
          const r = await api('/api/posts/' + p.id + '/like', { method: 'POST' });
          p.liked = r.liked;
          p.likes = r.likes;
          likeBtn.classList.toggle('liked', r.liked);
          likeCount.textContent = fmtCount(r.likes);
        } catch (e) {
          likeBtn.classList.toggle('liked', was);
          toast(e.message, true);
        }
      });

      // двойной тап по посту = лайк с сердечком
      let lastTap = 0;
      inner.addEventListener('click', (ev) => {
        if (ev.target.closest('button, a')) return;
        const now = Date.now();
        if (now - lastTap < 320) {
          lastTap = 0;
          const r = inner.getBoundingClientRect();
          const burst = h('div', { class: 'heart-burst', style: { left: (ev.clientX - r.left) + 'px', top: (ev.clientY - r.top) + 'px' } }, '♥');
          inner.append(burst);
          setTimeout(() => burst.remove(), 800);
          if (!likeBtn.classList.contains('liked')) likeBtn.click();
        } else lastTap = now;
      });

      const cmtCount = h('span', {}, fmtCount(p.comments));
      const cmtBtn = h('button', { type: 'button', 'aria-label': 'Комментарии' }, icon('chat'), cmtCount);
      cmtBtn.addEventListener('click', () => openComments(p, (n) => { p.comments = n; cmtCount.textContent = fmtCount(n); }));

      const rail = h('div', { class: 'rail' },
        h('button', { type: 'button', 'aria-label': 'Профиль автора', onclick: () => openUserCard(p.user.id) }, avatar(p.user, 46)),
        likeBtn, cmtBtn);
      const saveBtn = h('button', { type: 'button', class: p.saved ? 'liked' : '', 'aria-label': 'В закладки' }, icon('bookmark'));
      saveBtn.addEventListener('click', async () => {
        try {
          const r = await api('/api/posts/' + p.id + '/bookmark', { method: 'POST' });
          p.saved = r.saved;
          saveBtn.classList.toggle('liked', r.saved);
          toast(r.saved ? 'Сохранено в закладки' : 'Убрано из закладок');
        } catch (e) { toast(e.message, true); }
      });
      rail.append(saveBtn);
      if (p.user.id === state.me.id) {
        rail.append(h('button', { type: 'button', 'aria-label': 'Изменить подпись', onclick: async () => {
          const t = prompt('Подпись к посту', p.caption || '');
          if (t === null || t.trim() === (p.caption || '')) return;
          try {
            const r = await api('/api/posts/' + p.id, { method: 'PUT', body: { caption: t.trim() } });
            p.caption = r.post.caption;
            let el = inner.querySelector('.post-text > span, .cap');
            if (!el && p.caption) { el = h('div', { class: 'cap' }); inner.querySelector('.post-info').append(el); }
            if (el) { el.replaceChildren(...rich(p.caption)); if (!p.caption) el.remove(); }
            toast('Подпись обновлена');
          } catch (e) { toast(e.message, true); }
        } }, '✎'));
      }

      if (video) {
        const muteBtn = h('button', { type: 'button', 'aria-label': 'Звук' }, icon(state.muted ? 'mute' : 'volume'));
        muteBtn.addEventListener('click', () => {
          state.muted = !state.muted;
          feedEl.querySelectorAll('video').forEach((v) => { v.muted = state.muted; });
          feedEl.querySelectorAll('.rail .mute-btn').forEach((b) => b.replaceChildren(icon(state.muted ? 'mute' : 'volume')));
        });
        muteBtn.classList.add('mute-btn');
        rail.append(muteBtn);
      }
      if (p.user.id === state.me.id) {
        rail.append(h('button', {
          type: 'button', 'aria-label': 'Удалить пост',
          onclick: async () => {
            if (!confirm('Удалить этот пост?')) return;
            try {
              await api('/api/posts/' + p.id, { method: 'DELETE' });
              node.remove();
              toast('Пост удалён');
            } catch (e) { toast(e.message, true); }
          },
        }, icon('trash')));
      }
      inner.append(rail);
      const node = h('article', { class: 'post', 'data-idx': String(idx) }, inner);
      return node;
    }

    function showEmpty() {
      const friends = scope === 'friends';
      el.append(h('div', { class: 'empty-feed' },
        h('div', { style: { fontSize: '48px' } }, friends ? '👥' : '🎬'),
        h('div', {}, friends ? 'У тебя и твоих друзей пока нет постов. Добавь друзей или опубликуй что-нибудь!' : 'В ленте пока пусто. Опубликуй первый пост!'),
        friends ? h('a', { class: 'btn', href: '#/friends' }, 'Найти друзей') : null,
        h('button', { class: 'btn primary', type: 'button', onclick: () => openCreatePost() }, 'Создать пост')));
    }

    function setScope(next) {
      if (next === scope) return;
      scope = next;
      safeSet('eileen_scope', scope);
      tabAll.classList.toggle('active', scope === 'all');
      tabFr.classList.toggle('active', scope === 'friends');
      gen++;
      playObs.disconnect();
      nearObs.disconnect();
      feedEl.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
      feedEl.replaceChildren();
      el.querySelectorAll('.empty-feed').forEach((x) => x.remove());
      posts.length = 0;
      cursor = 0;
      loading = false;
      loadMore();
    }

    async function loadMore() {
      if (loading || destroyed) return;
      loading = true;
      const g = gen;
      try {
        const d = await api('/api/feed?limit=5&cursor=' + cursor + (scope === 'friends' ? '&scope=friends' : ''));
        if (destroyed || g !== gen) return;
        cursor = d.next;
        if (!d.items.length && posts.length === 0) { showEmpty(); return; }
        for (const item of d.items) {
          const node = buildPost(item, posts.length);
          posts.push({ data: item, el: node });
          feedEl.append(node);
          playObs.observe(node);
          nearObs.observe(node);
        }
      } catch (e) {
        if (!destroyed && g === gen) toast(e.message, true);
      } finally {
        if (g === gen) loading = false;
      }
    }

    loadMore();
    return {
      el,
      destroy() {
        destroyed = true;
        playObs.disconnect();
        nearObs.disconnect();
        feedEl.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
      },
    };
  }

  /* ---------------- комментарии ---------------- */

  function commentEl(c, p, onDel) {
    const row = h('div', { class: 'comment' },
      h('button', { type: 'button', 'aria-label': 'Профиль', style: { background: 'none', border: 0, padding: 0, cursor: 'pointer', height: '36px' }, onclick: () => openProfile(c.user.id) }, avatar(c.user, 36)),
      h('div', { style: { flex: '1', minWidth: '0' } }, h('div', { class: 'c-name' }, c.user.name, ' ', h('span', { class: 'time' }, fmtTime(c.createdAt))), h('div', { class: 'c-text' }, rich(c.text))));
    if (c.user.id === state.me.id || p.userId === state.me.id || (p.user && p.user.id === state.me.id)) {
      row.append(h('button', {
        class: 'btn ghost small del-btn', type: 'button', 'aria-label': 'Удалить комментарий', title: 'Удалить',
        onclick: async () => {
          if (!confirm('Удалить комментарий?')) return;
          try {
            const r = await api('/api/posts/' + p.id + '/comments/' + c.id, { method: 'DELETE' });
            row.remove();
            onDel(r.count);
          } catch (err) { toast(err.message, true); }
        },
      }, '✕'));
    }
    return row;
  }

  // список комментариев + форма: используется и в окне комментариев, и в просмотре поста
  function commentsBlock(p, onCount) {
    const list = h('div', {}, h('div', { class: 'empty' }, 'Загрузка…'));
    const input = h('input', { type: 'text', placeholder: 'Добавить комментарий…', maxlength: '300' });
    const form = h('form', {
      class: 'comment-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const t = input.value.trim();
        if (!t) return;
        input.disabled = true;
        try {
          const r = await api('/api/posts/' + p.id + '/comments', { method: 'POST', body: { text: t } });
          input.value = '';
          if (list.querySelector('.empty')) list.replaceChildren();
          list.append(commentEl(r.comment, p, onCount));
          onCount(r.count);
        } catch (err) {
          toast(err.message, true);
        } finally {
          input.disabled = false;
          input.focus();
        }
      },
    }, input, h('button', { class: 'btn primary', type: 'submit', 'aria-label': 'Отправить' }, icon('send')));
    async function load() {
      try {
        const d = await api('/api/posts/' + p.id + '/comments');
        list.replaceChildren();
        if (!d.comments.length) list.append(h('div', { class: 'empty' }, 'Комментариев пока нет'));
        d.comments.forEach((c) => list.append(commentEl(c, p, onCount)));
      } catch (e) {
        list.replaceChildren(h('div', { class: 'empty' }, e.message));
      }
    }
    return { list, form, load };
  }

  function openComments(p, onCount) {
    const cb = commentsBlock(p, onCount);
    openSheet('Комментарии', cb.list, cb.form);
    return cb.load();
  }

  /* ---------------- просмотр одного поста ---------------- */

  function openPost(p) {
    let media;
    if (p.kind === 'video') media = h('video', { class: 'pv-media', src: p.mediaUrl, controls: true, playsinline: '', preload: 'metadata' });
    else if (p.kind === 'image') media = h('img', { class: 'pv-media', src: p.mediaUrl, alt: '' });
    else media = h('div', { class: 'pv-text', style: { background: gradOf(p.bg) } }, h('span', {}, rich(p.caption)));

    const likeCount = h('span', {}, fmtCount(p.likes));
    const likeBtn = h('button', { type: 'button', class: 'pv-act' + (p.liked ? ' liked' : ''), 'aria-label': 'Нравится' }, icon('heart'), likeCount);
    likeBtn.addEventListener('click', async () => {
      try {
        const r = await api('/api/posts/' + p.id + '/like', { method: 'POST' });
        p.liked = r.liked; p.likes = r.likes;
        likeBtn.classList.toggle('liked', r.liked);
        likeCount.textContent = fmtCount(r.likes);
      } catch (e) { toast(e.message, true); }
    });
    const saveBtn = h('button', { type: 'button', class: 'pv-act' + (p.saved ? ' liked' : ''), 'aria-label': 'В закладки' }, icon('bookmark'));
    saveBtn.addEventListener('click', async () => {
      try {
        const r = await api('/api/posts/' + p.id + '/bookmark', { method: 'POST' });
        p.saved = r.saved;
        saveBtn.classList.toggle('liked', r.saved);
        toast(r.saved ? 'Сохранено в закладки' : 'Убрано из закладок');
      } catch (e) { toast(e.message, true); }
    });
    const cmtCount = h('span', {}, fmtCount(p.comments));
    const cb = commentsBlock(p, (n) => { p.comments = n; cmtCount.textContent = fmtCount(n); });

    const author = h('button', { class: 'pv-author', type: 'button', onclick: () => { sh.close(); openUserCard(p.user.id); } },
      avatar(p.user, 38),
      h('div', {}, h('b', {}, p.user.name), h('div', { class: 'time' }, '@' + p.user.username + ' · ' + fmtTime(p.createdAt))));
    const body = h('div', {},
      media, author,
      p.kind !== 'text' && p.caption ? h('div', { class: 'pv-cap' }, rich(p.caption)) : null,
      h('div', { class: 'pv-actions' }, likeBtn, h('span', { class: 'pv-act static' }, icon('chat'), cmtCount), saveBtn),
      h('div', { class: 'section-title' }, 'Комментарии'), cb.list);
    const sh = openSheet('Пост', body, cb.form);
    cb.load();
  }

  /* ---------------- карточка пользователя ---------------- */

  function openUserCard(userId) {
    if (userId === state.me.id) {
      document.querySelectorAll('.backdrop').forEach((b) => b.remove());
      location.hash = '#/profile';
      return;
    }
    return openProfile(userId);
  }

  /* ---------------- создание поста ---------------- */

  function openCreatePost() {
    let mode = 'video';
    let file = null;
    let bg = 0;
    let busy = false;

    const fileInput = h('input', { type: 'file', accept: 'video/*' });
    const caption = h('textarea', { maxlength: '300', placeholder: 'Подпись (необязательно)' });
    const errBox = h('div', { class: 'form-error' });
    const bar = h('div', {});
    const progWrap = h('div', { class: 'progress', hidden: true }, bar);
    const fileField = h('div', { class: 'field' }, h('label', {}, 'Файл'), fileInput, h('div', { class: 'hint' }, 'Видео — до 80 МБ, фото — до 8 МБ'));
    const swatchBox = h('div', { class: 'swatches', hidden: true });
    BGS.forEach((pair, i) => {
      const b = h('button', {
        type: 'button', class: 'swatch' + (i === 0 ? ' active' : ''), 'aria-label': 'Фон ' + (i + 1),
        style: { background: 'linear-gradient(135deg, ' + pair[0] + ', ' + pair[1] + ')' },
        onclick: () => { bg = i; swatchBox.querySelectorAll('.swatch').forEach((x, j) => x.classList.toggle('active', j === i)); },
      });
      swatchBox.append(b);
    });

    const tabBtns = {};
    const tabs = h('div', { class: 'tabs' });
    [['video', 'Видео'], ['image', 'Фото'], ['text', 'Текст']].forEach(([k, label]) => {
      tabBtns[k] = h('button', { type: 'button', class: k === mode ? 'active' : '', onclick: () => setMode(k) }, label);
      tabs.append(tabBtns[k]);
    });
    function setMode(m) {
      mode = m;
      for (const k of Object.keys(tabBtns)) tabBtns[k].classList.toggle('active', k === m);
      fileInput.value = '';
      file = null;
      fileInput.accept = m === 'video' ? 'video/*' : 'image/*';
      fileField.hidden = m === 'text';
      swatchBox.hidden = m !== 'text';
      caption.placeholder = m === 'text' ? 'Что хочешь рассказать?' : 'Подпись (необязательно)';
      errBox.textContent = '';
    }

    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      errBox.textContent = '';
      file = null;
      if (!f) return;
      const type = guessType(f);
      if (!type || (mode === 'video') !== type.startsWith('video/')) {
        errBox.textContent = mode === 'video' ? 'Выбери видео (mp4, webm или mov)' : 'Выбери фото (jpg, png, webp или gif)';
        fileInput.value = '';
        return;
      }
      const max = type.startsWith('video/') ? 80 : 8;
      if (f.size > max * 1048576) {
        errBox.textContent = 'Файл слишком большой (максимум ' + max + ' МБ)';
        fileInput.value = '';
        return;
      }
      file = f;
    });

    const publish = h('button', { class: 'btn primary block', type: 'button' }, 'Опубликовать');
    publish.addEventListener('click', async () => {
      if (busy) return;
      errBox.textContent = '';
      try {
        let payload;
        if (mode === 'text') {
          const t = caption.value.trim();
          if (!t) throw new Error('Напиши текст поста');
          payload = { kind: 'text', caption: t, bg };
        } else {
          if (!file) throw new Error(mode === 'video' ? 'Сначала выбери видео' : 'Сначала выбери фото');
          busy = true;
          publish.disabled = true;
          progWrap.hidden = false;
          const up = await uploadFile(file, (f) => { bar.style.width = Math.round(f * 100) + '%'; });
          payload = { kind: mode, mediaUrl: up.url, caption: caption.value.trim() };
        }
        busy = true;
        publish.disabled = true;
        await api('/api/posts', { method: 'POST', body: payload });
        s.close();
        toast('Пост опубликован');
        route();
      } catch (e) {
        errBox.textContent = e.message;
      } finally {
        busy = false;
        publish.disabled = false;
        progWrap.hidden = true;
      }
    });

    const body = h('div', {}, tabs, fileField, swatchBox, h('div', { class: 'field' }, caption), progWrap, errBox, publish);
    const s = openSheet('Новый пост', body);
  }

  /* ================================================================== */
  /* Экран: ЧАТЫ                                                        */
  /* ================================================================== */

  function viewChats(openId) {
    const wrap = h('div', { class: 'chats' + (openId ? ' has-open' : '') });
    const listEl = h('div', { class: 'chat-list' });
    const pane = h('div', { class: 'chat-pane' });
    wrap.append(listEl, pane);
    let destroyed = false;
    let convo = null; // {uid, onMessage}

    function chatRow(c) {
      return h('a', { class: 'row chat-row' + (c.user.id === openId ? ' active' : ''), href: '#/chats/' + c.user.id },
        h('div', { class: 'av-wrap' }, avatar(c.user, 48), c.online ? h('span', { class: 'dot-online', title: 'в сети' }) : null),
        h('div', { class: 'meta' },
          h('div', { class: 'title' }, c.user.name),
          h('div', { class: 'sub' }, c.last ? (c.last.from === state.me.id ? 'Вы: ' : '') + c.last.text.replace(/\s+/g, ' ') : 'Нет сообщений')),
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' } },
          c.last ? h('span', { class: 'time' }, fmtTime(c.last.createdAt)) : null,
          c.unread ? h('span', { class: 'unread' }, String(c.unread)) : null));
    }

    function renderList() {
      if (destroyed) return;
      listEl.replaceChildren(h('div', { class: 'page' },
        h('h2', {}, 'Чаты'),
        state.chats.length
          ? h('div', { class: 'list' }, state.chats.map(chatRow))
          : h('div', { class: 'empty' }, 'Писать можно друзьям. ', h('a', { href: '#/friends' }, 'Найти друзей'))));
    }

    async function openConvo(uid) {
      pane.replaceChildren(spinnerScreen());
      let user = (state.chats.find((c) => c.user.id === uid) || {}).user;
      if (!user) {
        try {
          user = (await api('/api/users/' + uid)).user;
        } catch (e) {
          pane.replaceChildren(h('div', { class: 'center-screen' }, e.message, h('a', { href: '#/chats' }, 'К списку чатов')));
          return;
        }
      }
      if (destroyed) return;

      let msgs = [];
      let hasMore = false;
      const msgsEl = h('div', { class: 'chat-msgs' });
      const ta = h('textarea', { rows: '1', placeholder: 'Сообщение…', maxlength: '2000' });
      const sendBtn = h('button', { class: 'btn primary', type: 'submit', 'aria-label': 'Отправить' }, icon('send'));
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

      function autosize() {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
      }
      function renderMsgs() {
        const nodes = [];
        if (hasMore) nodes.push(h('button', { class: 'btn ghost small', type: 'button', style: { alignSelf: 'center' }, onclick: loadOlder }, 'Показать более ранние'));
        let day = '';
        for (const m of msgs) {
          const d = new Date(m.createdAt).toDateString();
          if (d !== day) { day = d; nodes.push(h('div', { class: 'day-sep' }, dayLabel(m.createdAt))); }
          const bub = h('div', { class: 'bubble' + (m.from === state.me.id ? ' mine' : '') + (m.id === freshId ? ' pop' : '') }, m.text, h('span', { class: 't' }, (m.edited ? 'изм. ' : '') + fmtClock(m.createdAt), m.from === state.me.id ? h('span', { class: 'tick' + (m.read ? ' read' : '') }, m.read ? ' ✓✓' : ' ✓') : null));
          if (m.from === state.me.id) {
            bub.append(h('button', { class: 'msg-del msg-edit', type: 'button', 'aria-label': 'Изменить сообщение', title: 'Изменить', onclick: async () => {
              const t = prompt('Изменить сообщение', m.text);
              if (t === null || !t.trim() || t.trim() === m.text) return;
              try { await api('/api/messages/' + m.id, { method: 'PUT', body: { text: t.trim() } }); } catch (err) { toast(err.message, true); }
            } }, '✎'));
            bub.append(h('button', { class: 'msg-del', type: 'button', 'aria-label': 'Удалить сообщение', title: 'Удалить', onclick: async () => {
              if (!confirm('Удалить сообщение у всех?')) return;
              try { await api('/api/messages/' + m.id, { method: 'DELETE' }); } catch (err) { toast(err.message, true); }
            } }, '✕'));
          }
          nodes.push(bub);
        }
        msgsEl.replaceChildren(...nodes);
      }
      let freshId = null;
      function toBottom(smooth) { msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }
      function addMsg(m) {
        if (msgs.some((x) => x.id === m.id)) return;
        msgs.push(m);
        msgs.sort((a, b) => a.id - b.id);
        freshId = m.id;
        renderMsgs();
        freshId = null;
        toBottom(true);
      }
      async function loadOlder() {
        if (!msgs.length) return;
        try {
          const d = await api('/api/chats/' + uid + '/messages?before=' + msgs[0].id);
          const prev = msgsEl.scrollHeight;
          msgs = d.messages.concat(msgs);
          hasMore = d.hasMore;
          renderMsgs();
          msgsEl.scrollTop = msgsEl.scrollHeight - prev;
        } catch (e) { toast(e.message, true); }
      }

      const form = h('form', {
        class: 'chat-form',
        onsubmit: async (e) => {
          e.preventDefault();
          const t = ta.value.trim();
          if (!t || sendBtn.disabled) return;
          sendBtn.disabled = true;
          try {
            const r = await api('/api/chats/' + uid + '/messages', { method: 'POST', body: { text: t } });
            ta.value = '';
            autosize();
            addMsg(r.message);
          } catch (err) {
            toast(err.message, true);
          } finally {
            sendBtn.disabled = false;
            ta.focus();
          }
        },
      }, ta, sendBtn);
      ta.addEventListener('input', autosize);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !coarse) {
          e.preventDefault();
          sendBtn.click();
        }
      });

      const hintEl = h('div', { class: 'hint' }, '@' + user.username);
      const pres = { online: !!(state.chats.find((c) => c.user.id === uid) || {}).online, lastSeen: 0 };
      const showStatus = () => {
        hintEl.textContent = pres.online ? 'в сети' : pres.lastSeen ? 'был(а) в сети ' + fmtSeen(pres.lastSeen) : '@' + user.username;
        hintEl.classList.toggle('online', pres.online);
      };
      showStatus();
      api('/api/users/' + uid).then((d) => { pres.online = !!d.user.online; pres.lastSeen = d.user.lastSeen || 0; showStatus(); }).catch(() => {});
      let typingTimer = null;
      let lastTypingSent = 0;
      ta.addEventListener('input', () => {
        const now = Date.now();
        if (!ta.value.trim() || now - lastTypingSent < 2500) return;
        lastTypingSent = now;
        api('/api/chats/' + uid + '/typing', { method: 'POST' }).catch(() => {});
      });

      pane.replaceChildren(
        h('div', { class: 'chat-head' },
          h('a', { class: 'icon-btn back-btn', href: '#/chats', 'aria-label': 'Назад' }, icon('back')),
          avatar(user, 38),
          h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: '700' } }, user.name), hintEl)),
        msgsEl, form);

      convo = {
        uid,
        onTyping() {
          hintEl.textContent = 'печатает…';
          hintEl.classList.add('typing');
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => { showStatus(); hintEl.classList.remove('typing'); }, 4000);
        },
        onRead(by) {
          if (by !== uid) return;
          let ch = false;
          for (const m of msgs) if (m.from !== uid && !m.read) { m.read = true; ch = true; }
          if (ch) renderMsgs();
        },
        onPresence(id, on) {
          if (id !== uid) return;
          pres.online = on;
          if (!on) pres.lastSeen = Date.now();
          showStatus();
        },
        onMessageEdited(m) {
          const i = msgs.findIndex((x) => x.id === m.id);
          if (i >= 0) { msgs[i] = m; renderMsgs(); }
        },
        onMessageDeleted(id) {
          const i = msgs.findIndex((x) => x.id === id);
          if (i >= 0) { msgs.splice(i, 1); renderMsgs(); }
        },
        onMessage(m) {
          if (m.from !== uid && m.to !== uid) return;
          addMsg(m);
          if (m.from === uid) api('/api/chats/' + uid + '/read', { method: 'POST' }).then(scheduleRefresh, () => {});
        },
      };

      try {
        const d = await api('/api/chats/' + uid + '/messages');
        if (destroyed) return;
        msgs = d.messages;
        hasMore = d.hasMore;
        renderMsgs();
        toBottom();
        scheduleRefresh();
      } catch (e) {
        msgsEl.replaceChildren(h('div', { class: 'empty' }, e.message));
      }
    }

    renderList();
    if (!state.chats.length) refreshCounts();
    if (openId) openConvo(openId);
    else pane.append(h('div', { class: 'chat-empty' }, 'Выбери чат слева'));

    return {
      el: wrap,
      destroy() { destroyed = true; convo = null; },
      onChats: renderList,
      onMessage(m) { if (convo) convo.onMessage(m); },
      onTyping(from) { if (convo && convo.uid === from) convo.onTyping(); },
      onRead(by) { if (convo && convo.onRead) convo.onRead(by); },
      onPresence(id, on) { if (convo && convo.onPresence) convo.onPresence(id, on); },
      onMessageEdited(m) { if (convo && convo.onMessageEdited) convo.onMessageEdited(m); },
      onMessageDeleted(id) { if (convo && convo.onMessageDeleted) convo.onMessageDeleted(id); },
    };
  }

  /* ================================================================== */
  /* Экран: АКТИВНОСТЬ (лайки, комментарии, заявки)                     */
  /* ================================================================== */

  function viewActivity() {
    const page = h('div', { class: 'page' });
    const el = h('div', { class: 'view' }, page);
    const listEl = h('div');
    page.append(h('h2', {}, 'Активность'), listEl);
    let destroyed = false;
    const TEXT = { like: 'оценил(а) твой пост', comment: 'прокомментировал(а):', friend_request: 'хочет добавить тебя в друзья', friend_accept: 'теперь твой друг' };

    function thumb(n) {
      const p = n.post;
      if (!p) return null;
      if (p.kind === 'image') return h('img', { class: 'nt-thumb', src: p.mediaUrl, alt: '', loading: 'lazy' });
      if (p.kind === 'video') return h('div', { class: 'nt-thumb nt-video' }, '▶');
      return h('div', { class: 'nt-thumb', style: { background: gradOf(p.bg) } });
    }
    async function respond(n, accept) {
      try { await api('/api/friends/respond', { method: 'POST', body: { userId: n.user.id, accept } }); } catch (e) { toast(e.message, true); }
      load();
      scheduleRefresh();
    }
    function row(n) {
      const openIt = () => {
        if (!n.post) return;
        api('/api/posts/' + n.post.id).then((d) => openPost(d.post)).catch((e) => toast(e.message, true));
      };
      const line = h('div', { class: 'nt-line' }, h('b', {}, n.user.name), ' ', TEXT[n.type] || '',
        n.type === 'comment' ? h('span', { class: 'nt-quote' }, ' «' + n.text + '»') : null,
        ' ', h('span', { class: 'time' }, fmtTime(n.createdAt)));
      const actions = n.type === 'friend_request' && n.relation === 'incoming'
        ? h('div', { class: 'pf-btns', style: { justifyContent: 'flex-start', marginTop: '8px' } },
          h('button', { class: 'btn small primary', type: 'button', onclick: () => respond(n, true) }, 'Принять'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => respond(n, false) }, 'Отклонить'))
        : n.type === 'friend_request' && n.relation === 'friend' ? h('div', { class: 'hint' }, 'Вы друзья') : null;
      return h('div', { class: 'row nt-row' + (n.read ? '' : ' unread-row') },
        h('button', { type: 'button', class: 'plain', 'aria-label': 'Профиль', onclick: () => openProfile(n.user.id) }, avatar(n.user, 46)),
        h('div', { class: 'meta nt-main' + (n.post ? ' clickable' : ''), onclick: openIt }, line, actions),
        n.post ? h('div', { class: 'clickable', onclick: openIt }, thumb(n)) : null);
    }
    function render(items) {
      if (destroyed) return;
      if (!items.length) {
        listEl.replaceChildren(h('div', { class: 'empty' }, h('div', { style: { fontSize: '44px' } }, '🔔'), 'Пока тихо. Когда кто-то оценит или прокомментирует твой пост, ты увидишь это здесь.'));
        return;
      }
      const fresh = items.filter((n) => !n.read);
      const old = items.filter((n) => n.read);
      listEl.replaceChildren(...[
        fresh.length ? h('div', { class: 'section-title' }, 'Новые') : null,
        fresh.length ? h('div', { class: 'list' }, fresh.map(row)) : null,
        old.length ? h('div', { class: 'section-title' }, fresh.length ? 'Раньше' : 'Все уведомления') : null,
        old.length ? h('div', { class: 'list' }, old.map(row)) : null].filter(Boolean));
    }
    async function load() {
      try {
        const d = await api('/api/notifications');
        if (destroyed) return;
        render(d.items);
        if (d.unread) {
          await api('/api/notifications/read', { method: 'POST' });
          state.notifs = 0;
          updateBadges();
        }
      } catch (e) { if (!destroyed) toast(e.message, true); }
    }
    load();
    return { el, destroy() { destroyed = true; }, onNotify() { load(); }, onFriends() { load(); } };
  }

  /* ================================================================== */
  /* Экран: ДРУЗЬЯ                                                      */
  /* ================================================================== */

  function viewFriends() {
    const page = h('div', { class: 'page' });
    const el = h('div', { class: 'view' }, page);
    const search = h('input', { type: 'search', placeholder: 'Найти людей по имени или логину', maxlength: '40' });
    const resultsEl = h('div');
    const reqEl = h('div');
    const friendsEl = h('div');
    page.append(h('h2', {}, 'Друзья'), search, resultsEl, reqEl, friendsEl);

    let data = { friends: [], incoming: [], outgoing: [] };
    let found = [];
    let q = '';
    let timer = null;
    let destroyed = false;

    async function act(fn) {
      try { await fn(); } catch (e) { toast(e.message, true); }
      await Promise.all([loadFriends(), loadSearch()]);
      scheduleRefresh();
    }
    const request = (id) => act(() => api('/api/friends/request', { method: 'POST', body: { userId: id } }));
    const respond = (id, accept) => act(() => api('/api/friends/respond', { method: 'POST', body: { userId: id, accept } }));
    const unfriend = (id) => act(() => api('/api/friends/' + id, { method: 'DELETE' }));

    function userRow(u, actions) {
      return h('div', { class: 'row' },
        h('button', { type: 'button', 'aria-label': 'Профиль ' + u.name, style: { display: 'flex', background: 'none', border: 0, padding: 0, cursor: 'pointer' }, onclick: () => openProfile(u.id) }, avatar(u, 46)),
        h('div', { class: 'meta' }, h('div', { class: 'title' }, u.name), h('div', { class: 'sub' }, '@' + u.username)),
        h('div', { class: 'actions' }, actions));
    }
    const msgBtn = (u) => h('a', { class: 'btn small primary', href: '#/chats/' + u.id }, 'Написать');

    function renderResults() {
      if (destroyed) return;
      const rows = found.map((u) => {
        let btn;
        if (u.relation === 'none') btn = h('button', { class: 'btn small primary', type: 'button', onclick: () => request(u.id) }, 'Добавить');
        else if (u.relation === 'outgoing') btn = h('button', { class: 'btn small', type: 'button', disabled: true }, 'Отправлено');
        else if (u.relation === 'incoming') btn = h('button', { class: 'btn small primary', type: 'button', onclick: () => respond(u.id, true) }, 'Принять');
        else btn = msgBtn(u);
        return userRow(u, btn);
      });
      resultsEl.replaceChildren(
        h('div', { class: 'section-title' }, q ? 'Результаты поиска' : 'Новые пользователи'),
        rows.length ? h('div', { class: 'list' }, rows) : h('div', { class: 'empty' }, q ? 'Никого не нашли' : 'Пока никого нет — позови друзей зарегистрироваться!'));
    }

    function renderLists() {
      if (destroyed) return;
      const req = [];
      if (data.incoming.length) {
        req.push(h('div', { class: 'section-title' }, 'Заявки в друзья'));
        req.push(h('div', { class: 'list' }, data.incoming.map((u) => userRow(u, [
          h('button', { class: 'btn small primary', type: 'button', onclick: () => respond(u.id, true) }, 'Принять'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => respond(u.id, false) }, 'Отклонить'),
        ]))));
      }
      if (data.outgoing.length) {
        req.push(h('div', { class: 'section-title' }, 'Ждут ответа'));
        req.push(h('div', { class: 'list' }, data.outgoing.map((u) => userRow(u,
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => unfriend(u.id) }, 'Отменить')))));
      }
      reqEl.replaceChildren(...req);
      friendsEl.replaceChildren(
        h('div', { class: 'section-title' }, 'Мои друзья (' + data.friends.length + ')'),
        data.friends.length
          ? h('div', { class: 'list' }, data.friends.map((u) => userRow(u, [
            msgBtn(u),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Удалить из друзей', onclick: () => { if (confirm('Удалить ' + u.name + ' из друзей?')) unfriend(u.id); } }, icon('x')),
          ])))
          : h('div', { class: 'empty' }, 'Пока нет друзей. Найди кого-нибудь через поиск выше 👆'));
    }

    async function loadFriends() {
      try { data = await api('/api/friends'); } catch (e) { if (!destroyed) toast(e.message, true); }
      renderLists();
    }
    async function loadSearch() {
      const my = q;
      try {
        const d = await api('/api/users?q=' + encodeURIComponent(q));
        if (my !== q || destroyed) return;
        found = d.users;
      } catch (e) {
        if (!destroyed) toast(e.message, true);
      }
      renderResults();
    }

    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { q = search.value.trim(); loadSearch(); }, 300);
    });

    loadFriends();
    loadSearch();
    return {
      el,
      destroy() { destroyed = true; clearTimeout(timer); },
      onFriends() { loadFriends(); loadSearch(); },
    };
  }

  /* ================================================================== */
  /* Экран: ОЦЕНКИ                                                      */
  /* ================================================================== */

  function normDate(s) {
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
    if (m) return m[3] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[1]));
    return '';
  }

  // Формат строки: предмет;оценка;максимум;дата;заметка  (максимум, дата и заметка — необязательно)
  function parseGradesText(txt) {
    const rows = [];
    const lines = txt.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const sep = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
      const cells = line.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''));
      const score = parseFloat((cells[1] || '').replace(',', '.'));
      // первая строка пропускается, только если это явный заголовок («предмет;оценка;…»)
      if (i === 0 && !Number.isFinite(score) && /оценк|балл|score|grade|mark/i.test(cells[1] || '')) return;
      if (!cells[0]) throw new Error('Строка ' + (i + 1) + ': нет названия предмета');
      if (!Number.isFinite(score)) throw new Error('Строка ' + (i + 1) + ': оценка должна быть числом');
      const max = cells[2] ? parseFloat(cells[2].replace(',', '.')) : 5;
      if (!Number.isFinite(max) || max <= 0) throw new Error('Строка ' + (i + 1) + ': неверный максимальный балл');
      const date = cells[3] ? normDate(cells[3]) : todayStr();
      if (!date) throw new Error('Строка ' + (i + 1) + ': дата должна быть ГГГГ-ММ-ДД или ДД.ММ.ГГГГ');
      rows.push({ subject: cells[0], score, max, date, note: cells[4] || '' });
    });
    if (!rows.length) throw new Error('Не нашли ни одной оценки');
    return rows;
  }

  function viewGrades() {
    const page = h('div', { class: 'page' });
    const el = h('div', { class: 'view' }, page);
    let grades = [];
    let destroyed = false;
    const open = new Set();
    const summaryEl = h('div');
    const listEl = h('div');
    const pct = (g) => (g.score / g.max) * 100;
    const five = (p) => (p / 20).toFixed(2);

    function render() {
      if (destroyed) return;
      if (!grades.length) {
        summaryEl.replaceChildren(h('div', { class: 'card empty' }, 'Оценок пока нет. Добавь первую ниже ⬇'));
        listEl.replaceChildren();
        return;
      }
      const bySub = new Map();
      for (const g of grades) {
        if (!bySub.has(g.subject)) bySub.set(g.subject, []);
        bySub.get(g.subject).push(g);
      }
      const subs = [...bySub.entries()]
        .map(([name, arr]) => ({ name, arr, avg: arr.reduce((s, g) => s + pct(g), 0) / arr.length }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      const overall = subs.reduce((s, x) => s + x.avg, 0) / subs.length;

      summaryEl.replaceChildren(h('div', { class: 'card summary' },
        h('div', {}, h('div', { class: 'big' }, five(overall)), h('div', { class: 'hint' }, 'средний балл (из 5)')),
        h('div', {}, h('div', { class: 'big' }, Math.round(overall) + '%'), h('div', { class: 'hint' }, 'в процентах')),
        h('div', {}, h('div', { class: 'big' }, String(grades.length)), h('div', { class: 'hint' }, 'оценок'))));

      listEl.replaceChildren(...subs.map((s) => {
        const isOpen = open.has(s.name);
        const head = h('button', {
          class: 'subj-head', type: 'button',
          onclick: () => { if (open.has(s.name)) open.delete(s.name); else open.add(s.name); render(); },
        },
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { style: { fontWeight: '700' } }, s.name),
            h('div', { class: 'bar' }, h('div', { style: { width: Math.max(2, Math.min(100, s.avg)) + '%' } }))),
          h('div', { style: { textAlign: 'right' } }, h('div', { style: { fontWeight: '800', fontSize: '18px' } }, five(s.avg)), h('div', { class: 'hint' }, s.arr.length + ' шт.')));
        const rows = isOpen ? h('div', {}, s.arr.map((g) => h('div', { class: 'grade-row' },
          h('div', { class: 'sc' }, String(g.score) + '/' + String(g.max)),
          h('div', { class: 'hint' }, g.date.split('-').reverse().join('.')),
          h('div', { class: 'nt' }, g.note),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Удалить оценку', onclick: async () => {
            if (!confirm('Удалить эту оценку?')) return;
            try {
              await api('/api/grades/' + g.id, { method: 'DELETE' });
              grades = grades.filter((x) => x.id !== g.id);
              render();
            } catch (e) { toast(e.message, true); }
          } }, icon('trash'))))) : null;
        return h('div', { class: 'subj' }, head, rows);
      }));
      datalist.replaceChildren(...subs.map((s) => h('option', { value: s.name })));
    }

    async function load() {
      try {
        const d = await api('/api/grades');
        grades = d.grades;
      } catch (e) { if (!destroyed) toast(e.message, true); }
      render();
    }

    /* ----- ссылка на дневник ----- */
    const diaryCard = h('div', { class: 'card' });
    if (state.me.diaryUrl) {
      diaryCard.append(
        h('a', { class: 'btn primary block', href: state.me.diaryUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Открыть мой электронный дневник'),
        h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Автоматическая загрузка оценок из школьного дневника пока не подключена: добавляй оценки вручную или импортируй таблицей — ниже.'));
    } else {
      diaryCard.append(
        h('div', {}, 'Сюда можно добавить ссылку на твой электронный дневник (Билим Лэнд / БилимКласс), чтобы открывать его одной кнопкой.'),
        h('a', { class: 'btn small', href: '#/profile', style: { marginTop: '8px' } }, 'Указать ссылку в профиле'),
        h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Автоматическая загрузка оценок из школьного дневника пока не подключена: добавляй оценки вручную или импортируй таблицей.'));
    }

    /* ----- форма добавления ----- */
    const datalist = h('datalist', { id: 'subjects-list' });
    const subjI = h('input', { type: 'text', list: 'subjects-list', placeholder: 'Например: Алгебра', maxlength: '60' });
    const scoreI = h('input', { type: 'text', inputMode: 'decimal', placeholder: '5', maxlength: '8' });
    const maxS = h('select', {}, [5, 10, 12, 20, 100].map((n) => h('option', { value: String(n) }, 'из ' + n)));
    const dateI = h('input', { type: 'date', value: todayStr() });
    const noteI = h('input', { type: 'text', placeholder: 'Заметка (необязательно): контрольная, СОР…', maxlength: '120' });
    const addErr = h('div', { class: 'form-error' });
    const addForm = h('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        addErr.textContent = '';
        try {
          await api('/api/grades', { method: 'POST', body: { subject: subjI.value, score: scoreI.value, max: Number(maxS.value), date: dateI.value, note: noteI.value } });
          scoreI.value = '';
          noteI.value = '';
          toast('Оценка добавлена');
          await load();
        } catch (ex) { addErr.textContent = ex.message; }
      },
    },
      h('h3', { style: { marginTop: '0' } }, 'Добавить оценку'),
      h('div', { class: 'field' }, h('label', {}, 'Предмет'), subjI, datalist),
      h('div', { class: 'grid2' },
        h('div', { class: 'field' }, h('label', {}, 'Оценка'), scoreI),
        h('div', { class: 'field' }, h('label', {}, 'Шкала'), maxS)),
      h('div', { class: 'field' }, h('label', {}, 'Дата'), dateI),
      h('div', { class: 'field' }, noteI),
      addErr,
      h('button', { class: 'btn primary block', type: 'submit' }, 'Добавить'));

    /* ----- импорт ----- */
    const impText = h('textarea', { placeholder: 'Алгебра;5;5;12.09.2026;контрольная\nФизика;4\nИстория;85;100;2026-10-01', style: { minHeight: '110px' } });
    const impFile = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain' });
    const impErr = h('div', { class: 'form-error' });
    impFile.addEventListener('change', () => {
      const f = impFile.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) { impErr.textContent = 'Файл слишком большой (максимум 1 МБ)'; return; }
      const r = new FileReader();
      r.onload = () => { impText.value = String(r.result || ''); impErr.textContent = ''; };
      r.onerror = () => { impErr.textContent = 'Не удалось прочитать файл'; };
      r.readAsText(f);
    });
    const impBtn = h('button', { class: 'btn block', type: 'button' }, 'Импортировать');
    impBtn.addEventListener('click', async () => {
      impErr.textContent = '';
      try {
        const items = parseGradesText(impText.value);
        impBtn.disabled = true;
        await api('/api/grades', { method: 'POST', body: { items } });
        impText.value = '';
        impFile.value = '';
        toast('Добавлено оценок: ' + items.length);
        await load();
      } catch (ex) { impErr.textContent = ex.message; } finally { impBtn.disabled = false; }
    });
    const impCard = h('div', { class: 'card' },
      h('h3', { style: { marginTop: '0' } }, 'Импорт из таблицы'),
      h('div', { class: 'hint', style: { marginBottom: '8px' } }, 'Каждая строка: предмет;оценка;шкала;дата;заметка. Шкала, дата и заметка необязательны (по умолчанию «из 5» и сегодняшний день). Можно вставить текст или выбрать файл .csv / .txt. Разделитель — точка с запятой, табуляция или запятая.'),
      impFile, h('div', { class: 'field', style: { marginTop: '10px' } }, impText), impErr, impBtn);

    page.append(h('h2', {}, 'Оценки'), diaryCard, summaryEl, listEl, h('div', { style: { height: '12px' } }), addForm, impCard);
    load();
    return { el, destroy() { destroyed = true; } };
  }

  /* ================================================================== */
  /* Экран: ПРОФИЛЬ                                                     */
  /* ================================================================== */

  /* ================================================================== */
  /* Экран: ОФОРМЛЕНИЕ (панели в стиле ClickGUI)                        */
  /* ================================================================== */

  function viewTheme() {
    const page = h('div', { class: 'page' });
    const el = h('div', { class: 'view' }, page);
    const closed = new Set(['code']);
    let codeOut = null;

    function change(p) {
      patchTheme(p);
      if (codeOut) codeOut.value = JSON.stringify(theme);
    }

    function slider(label, key, min, max, unit) {
      const out = h('output', {}, theme[key] + unit);
      const inp = h('input', { type: 'range', min: String(min), max: String(max), step: '1', value: String(theme[key]) });
      inp.addEventListener('input', () => {
        out.textContent = inp.value + unit;
        change({ [key]: Number(inp.value) });
      });
      return h('div', { class: 'slider-row' }, h('label', {}, label), inp, out);
    }

    // «Модуль» как в чит-клиентах: название + переключатель, при включении раскрываются настройки
    function mod(name, desc, isOn, toggle, settings) {
      const wrap = h('div', { class: 'cg-mod' + (isOn ? ' on' : '') });
      wrap.append(h('button', {
        class: 'cg-row', type: 'button', 'aria-pressed': String(isOn),
        onclick: () => { toggle(); render(); },
      }, h('div', {}, h('div', { class: 'name' }, name), h('div', { class: 'desc' }, desc)), h('span', { class: 'switch' })));
      if (isOn && settings && settings.length) wrap.append(h('div', { class: 'cg-settings' }, settings));
      return wrap;
    }

    function panel(id, title, children) {
      const isClosed = closed.has(id);
      return h('div', { class: 'cg-panel' },
        h('button', {
          class: 'cg-head', type: 'button',
          onclick: () => { if (closed.has(id)) closed.delete(id); else closed.add(id); render(); },
        }, h('span', {}, title), h('span', {}, isClosed ? '▸' : '▾')),
        isClosed ? null : h('div', { class: 'cg-body' }, children));
    }

    function colorRow(label, key) {
      const pick = h('input', { type: 'color', value: theme[key], 'aria-label': label });
      const hex = h('input', { type: 'text', value: theme[key], maxlength: '7', 'aria-label': label + ' (код цвета)' });
      pick.addEventListener('input', () => { hex.value = pick.value; change({ [key]: pick.value }); });
      hex.addEventListener('change', () => {
        let v = hex.value.trim();
        if (/^[0-9a-fA-F]{6}$/.test(v)) v = '#' + v;
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) { hex.value = theme[key]; toast('Цвет должен быть вида #ff00aa', true); return; }
        pick.value = v;
        change({ [key]: v });
      });
      return h('div', { class: 'color-row' }, h('label', {}, label), pick, hex);
    }

    function presetsGrid() {
      return h('div', { class: 'presets' }, PRESETS.map((p) => {
        const t = Object.assign({}, DEFAULT_THEME, p.t, { preset: p.name });
        const bar = t.rainbow
          ? 'linear-gradient(90deg, #ff4d4d, #ffb84d, #f2ff4d, #4dff88, #4dc3ff, #b84dff)'
          : 'linear-gradient(90deg, ' + t.accent + ', ' + t.accent2 + ')';
        return h('button', {
          type: 'button', class: 'preset' + (theme.preset === p.name ? ' active' : ''),
          onclick: () => { setTheme(t); render(); },
        },
        h('div', { class: 'pv', style: { background: t.bg } },
          h('i', { style: { background: bar } }),
          h('b', { style: { background: t.panel } })),
        h('div', { class: 'pn' }, p.name));
      }));
    }

    function randomTheme() {
      const hu = Math.floor(Math.random() * 360);
      const dark = Math.random() > 0.15;
      return Object.assign({}, DEFAULT_THEME, {
        preset: '',
        accent: hslToHex(hu, 90, 60),
        accent2: hslToHex((hu + 40 + Math.floor(Math.random() * 120)) % 360, 90, 62),
        bg: hslToHex(hu, 30, dark ? 6 : 96),
        panel: hslToHex(hu, 25, dark ? 10 : 100),
        text: dark ? '#f2f4f8' : '#14171f',
        glow: dark ? Math.floor(Math.random() * 16) : 0,
        radius: Math.floor(Math.random() * 24),
        aurora: Math.random() > 0.5,
      });
    }

    function codePanel() {
      codeOut = h('textarea', { readonly: true, rows: '3' });
      codeOut.value = JSON.stringify(theme);
      const inp = h('textarea', { placeholder: 'Вставь сюда код темы друга и нажми «Применить»' });
      return h('div', { class: 'code-box' },
        h('div', { class: 'hint' }, 'Твой код темы — отправь другу, и у него будет такое же оформление:'),
        codeOut,
        h('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try { await navigator.clipboard.writeText(codeOut.value); toast('Код скопирован'); } catch (_) { codeOut.select(); toast('Выдели код и скопируй вручную'); }
          },
        }, 'Копировать код'),
        inp,
        h('button', {
          class: 'btn small primary', type: 'button',
          onclick: () => {
            try {
              const t = JSON.parse(inp.value);
              if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('bad');
              setTheme(Object.assign({}, DEFAULT_THEME, t));
              toast('Тема применена');
              render();
            } catch (_) { toast('Не получилось прочитать код темы', true); }
          },
        }, 'Применить'));
    }

    function render() {
      const keep = el.scrollTop;
      codeOut = null;
      page.replaceChildren(
        h('div', { class: 'theme-top' },
          h('a', { class: 'btn small', href: '#/profile' }, '← Профиль'),
          h('button', { class: 'btn small', type: 'button', onclick: () => { setTheme(randomTheme()); render(); } }, '🎲 Случайная'),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { setTheme(DEFAULT_THEME); render(); } }, 'Сбросить')),
        h('h2', {}, 'Оформление'),
        panel('presets', 'Темы', [presetsGrid()]),
        panel('colors', 'Цвета', [
          colorRow('Акцент 1', 'accent'), colorRow('Акцент 2', 'accent2'),
          colorRow('Фон', 'bg'), colorRow('Панели', 'panel'), colorRow('Текст', 'text'),
        ]),
        panel('fx', 'Эффекты', [
          mod('Радуга', 'Цвета плавно переливаются', theme.rainbow, () => change({ rainbow: !theme.rainbow }), [slider('Скорость', 'speed', 1, 100, '')]),
          mod('Неоновое свечение', 'Подсветка кнопок и панелей', theme.glow > 0, () => change({ glow: theme.glow > 0 ? 0 : 14 }), [slider('Сила', 'glow', 1, 40, ' px')]),
          mod('Стекло', 'Размытие и прозрачные панели', theme.glass,
            () => change({ glass: !theme.glass, panelAlpha: !theme.glass ? Math.min(theme.panelAlpha, 60) : 100 }),
            [slider('Размытие', 'blur', 0, 40, ' px'), slider('Прозрачность', 'panelAlpha', 30, 100, '%')]),
          mod('Аврора-фон', 'Цветное свечение на фоне', theme.aurora, () => change({ aurora: !theme.aurora }), null),
          mod('Анимации', 'Плавные переходы', theme.anim, () => change({ anim: !theme.anim }), null),
          mod('Уведомления', 'О новых сообщениях, пока вкладка скрыта', notifyOn(), () => {
            if (!notifySupported()) { toast('Этот браузер не поддерживает уведомления', true); return; }
            if (notifyOn()) { localStorage.setItem('dostar_notify', '0'); return; }
            Notification.requestPermission().then((p) => {
              if (p === 'granted') { localStorage.setItem('dostar_notify', '1'); render(); } else toast('Уведомления не разрешены в браузере', true);
            });
          }, null),
          mod('Компактный режим', 'Меньше отступов', theme.compact, () => change({ compact: !theme.compact }), null),
        ]),
        panel('ui', 'Интерфейс', [slider('Скругление', 'radius', 0, 28, ' px'), slider('Размер текста', 'scale', 80, 125, '%')]),
        panel('code', 'Код темы', [codePanel()]));
      el.scrollTop = keep;
    }

    render();
    return { el, destroy() { codeOut = null; } };
  }

  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    if (current && current.onInstallable) current.onInstallable();
  });

  function viewProfile() {
    const page = h('div', { class: 'page' });
    const el = h('div', { class: 'view' }, page);
    let color = state.me.color;

    const avatarBox = h('div');
    function drawAvatar() { avatarBox.replaceChildren(avatar(Object.assign({}, state.me, { color }), 96)); }
    drawAvatar();

    const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
    photoInput.addEventListener('change', async () => {
      const f = photoInput.files[0];
      photoInput.value = '';
      if (!f) return;
      const t = guessType(f);
      if (!t || !t.startsWith('image/')) { toast('Выбери фото (jpg, png, webp или gif)', true); return; }
      if (f.size > 8 * 1048576) { toast('Фото слишком большое (максимум 8 МБ)', true); return; }
      try {
        const up = await uploadFile(f);
        const r = await api('/api/me', { method: 'PUT', body: { avatar: up.url } });
        state.me = r.user;
        drawAvatar();
        toast('Фото обновлено');
      } catch (e) { toast(e.message, true); }
    });

    const nameI = h('input', { type: 'text', value: state.me.name, maxlength: '40' });
    const bioI = h('textarea', { maxlength: '200', placeholder: 'Расскажи о себе' });
    bioI.value = state.me.bio || '';
    const diaryI = h('input', { type: 'url', value: state.me.diaryUrl || '', placeholder: 'https://…', maxlength: '300' });
    const swatches = h('div', { class: 'swatches' });
    COLORS.forEach((c, i) => {
      swatches.append(h('button', {
        type: 'button', class: 'swatch' + (c === color ? ' active' : ''), 'aria-label': 'Цвет ' + (i + 1), style: { background: c }, 'data-c': c,
        onclick: () => {
          color = c;
          swatches.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x.getAttribute('data-c') === c));
          drawAvatar();
        },
      }));
    });

    const saveErr = h('div', { class: 'form-error' });
    const saveBtn = h('button', { class: 'btn primary block', type: 'submit' }, 'Сохранить');
    const form = h('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        saveErr.textContent = '';
        saveBtn.disabled = true;
        try {
          const r = await api('/api/me', { method: 'PUT', body: { name: nameI.value, bio: bioI.value, color, diaryUrl: diaryI.value } });
          state.me = r.user;
          drawAvatar();
          nameEl.textContent = state.me.name;
          bioEl.replaceChildren(...rich(state.me.bio || ''));
          toast('Профиль сохранён');
        } catch (ex) { saveErr.textContent = ex.message; } finally { saveBtn.disabled = false; }
      },
    },
      h('div', { class: 'field' }, h('label', {}, 'Имя'), nameI),
      h('div', { class: 'field' }, h('label', {}, 'О себе'), bioI),
      h('div', { class: 'field' }, h('label', {}, 'Цвет профиля'), swatches),
      h('div', { class: 'field' }, h('label', {}, 'Ссылка на электронный дневник (необязательно)'), diaryI),
      saveErr, saveBtn);

    const oldI = h('input', { type: 'password', autocomplete: 'current-password', maxlength: '100' });
    const newI = h('input', { type: 'password', autocomplete: 'new-password', maxlength: '100', placeholder: 'не короче 6 символов' });
    const pwErr = h('div', { class: 'form-error' });
    const pwForm = h('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        pwErr.textContent = '';
        try {
          await api('/api/me/password', { method: 'POST', body: { oldPassword: oldI.value, newPassword: newI.value } });
          oldI.value = '';
          newI.value = '';
          toast('Пароль изменён');
        } catch (ex) { pwErr.textContent = ex.message; }
      },
    },
      h('h3', { style: { marginTop: '0' } }, 'Смена пароля'),
      h('div', { class: 'field' }, h('label', {}, 'Старый пароль'), oldI),
      h('div', { class: 'field' }, h('label', {}, 'Новый пароль'), newI),
      pwErr, h('button', { class: 'btn block', type: 'submit' }, 'Изменить пароль'));

    const installBtn = h('button', { class: 'btn primary block', type: 'button', hidden: !installEvent }, 'Установить приложение');
    installBtn.addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch (_) { /* ничего */ }
      installEvent = null;
      installBtn.hidden = true;
    });
    const installCard = h('div', { class: 'card' },
      h('h3', { style: { marginTop: '0' } }, 'Установка на устройство'),
      installBtn,
      h('div', { class: 'hint', style: { marginTop: '8px' } },
        'iPhone / iPad (Safari): кнопка «Поделиться» → «На экран Домой». Android (Chrome): меню ⋮ → «Установить приложение». Компьютер (Chrome / Edge): значок установки в адресной строке.'));

    const logoutBtn = h('button', { class: 'btn danger block', type: 'button', onclick: () => logout(false) }, 'Выйти из аккаунта');

    const photoRow = h('div', { class: 'card' },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        h('b', { style: { flex: '1' } }, 'Фото профиля'),
        h('button', { class: 'btn small', type: 'button', onclick: () => photoInput.click() }, 'Сменить фото'),
        state.me.avatar ? h('button', { class: 'btn small ghost', type: 'button', onclick: async () => {
          try { const r = await api('/api/me', { method: 'PUT', body: { avatar: '' } }); state.me = r.user; route(); } catch (e) { toast(e.message, true); }
        } }, 'Убрать') : null,
        photoInput));

    const nPosts = h('b', {}, '–');
    const nLikes = h('b', {}, '–');
    const nFriends = h('b', {}, '–');
    const nameEl = h('div', { class: 'pf-name' }, state.me.name);
    const bioEl = h('div', { class: 'pf-bio' }, rich(state.me.bio || ''));
    const content = h('div');
    let tab = 'posts';
    const tabBtns = {};
    const tabsEl = h('div', { class: 'tabs' });
    [['posts', 'Посты'], ['saved', 'Закладки'], ['settings', 'Настройки']].forEach(([k, label]) => {
      tabBtns[k] = h('button', { type: 'button', class: k === tab ? 'active' : '', onclick: () => setTab(k) }, label);
      tabsEl.append(tabBtns[k]);
    });
    const stat = (b, label) => h('div', { class: 'pf-stat' }, b, h('span', {}, label));
    const head = h('div', { class: 'pf-head' },
      avatarBox, nameEl, h('div', { class: 'time' }, '@' + state.me.username), bioEl,
      h('div', { class: 'pf-stats' }, stat(nPosts, 'постов'), stat(nLikes, 'лайков'), stat(nFriends, 'друзей')),
      h('div', { class: 'pf-btns' },
        h('button', { class: 'btn small', type: 'button', onclick: () => setTab('settings') }, 'Редактировать'),
        h('a', { class: 'btn small primary', href: '#/theme' }, '🎨 Оформление')));

    async function loadGrid(t) {
      content.replaceChildren(h('div', { class: 'empty' }, 'Загрузка…'));
      try {
        const d = t === 'posts' ? await api('/api/users/' + state.me.id + '/posts') : await api('/api/bookmarks');
        if (t === 'posts') { nPosts.textContent = fmtCount(d.count); nLikes.textContent = fmtCount(d.likes); nFriends.textContent = fmtCount(d.friends); }
        if (tab !== t) return;
        content.replaceChildren(d.posts.length ? postGrid(d.posts)
          : h('div', { class: 'empty' }, t === 'posts' ? 'Ты ещё ничего не публиковал. Нажми «+» в ленте.' : 'Здесь пока ничего нет. Сохраняй посты кнопкой-закладкой.'));
      } catch (e) { if (tab === t) content.replaceChildren(h('div', { class: 'empty' }, e.message)); }
    }
    function setTab(t) {
      tab = t;
      for (const k of Object.keys(tabBtns)) tabBtns[k].classList.toggle('active', k === t);
      if (t === 'settings') content.replaceChildren(photoRow, form, installCard, pwForm, logoutBtn);
      else loadGrid(t);
    }

    page.append(head, tabsEl, content);
    setTab('posts');

    return { el, onInstallable() { installBtn.hidden = false; } };
  }

  /* ================================================================== */
  /* Запуск                                                             */
  /* ================================================================== */

  function showOffline(message) {
    app.replaceChildren(h('div', { class: 'center-screen' },
      h('div', { style: { fontSize: '40px' } }, '📡'),
      h('div', {}, message || 'Не удаётся подключиться к серверу'),
      h('button', { class: 'btn primary', type: 'button', onclick: boot }, 'Повторить')));
  }

  async function boot() {
    app.replaceChildren(spinnerScreen());
    if (!state.token) { route(); return; }
    try {
      const d = await api('/api/me');
      state.me = d.user;
      startSession();
    } catch (e) {
      if (e.status === 401) return; // api() уже выполнил выход и показал форму входа
      showOffline(e.message);
    }
  }

  window.addEventListener('hashchange', route);
  loadLocalTheme();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }

  boot();
})();
