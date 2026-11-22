'use strict';

const fs = require('fs');
const path = require('path');
const { route, getToken } = require('../router');
const { db, saveDb, UPLOAD_DIR } = require('../db');
const { selfUser } = require('./auth');
const { publicUser, relation, isOnline, findFriendship } = require('../realtime');
const { bad, HttpError, rateLimit, text, intParam, readJson, parseTheme, hashPassword, checkPassword, sha } = require('../utils');

const UPLOAD_URL_RE = /^\/uploads\/([a-f0-9]{24})\.(jpg|png|webp|gif|mp4|webm|mov)$/;

function checkUploadUrl(u, kinds) {
  const m = UPLOAD_URL_RE.exec(u);
  if (!m) throw bad('Неверная ссылка на файл');
  const ext = m[2];
  const kind = ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : 'image';
  if (!kinds.includes(kind)) throw bad('Неверный тип файла');
  if (!fs.existsSync(path.join(UPLOAD_DIR, m[1] + '.' + ext))) throw bad('Файл не найден на сервере');
  return u;
}

function userById(id) {
  return db.users.find((u) => u.id === id) || null;
}

function areFriends(a, b) {
  const f = findFriendship(a, b);
  return !!f && f.status === 'accepted';
}

function presenceFor(me, u) {
  if (!areFriends(me, u.id)) return {};
  return { online: isOnline(u.id), lastSeen: u.lastSeen || 0 };
}

function registerUserRoutes(postViewFn) {
  route('GET', '/api/me', {}, (ctx) => ({ user: selfUser(ctx.user) }));

  route('PUT', '/api/me', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const u = ctx.user;
    if (b.name !== undefined) u.name = text(b.name, { min: 1, max: 40, label: 'Имя' });
    if (b.bio !== undefined) u.bio = text(b.bio, { max: 200, label: 'О себе', multi: true });
    if (b.statusEmoji !== undefined) u.statusEmoji = text(b.statusEmoji, { max: 8, label: 'Смайл статуса' });
    if (b.statusText !== undefined) u.statusText = text(b.statusText, { max: 60, label: 'Текст статуса' });
    if (b.color !== undefined) {
      if (typeof b.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(b.color)) throw bad('Неверный цвет');
      u.color = b.color.toLowerCase();
    }
    if (b.avatar !== undefined) {
      u.avatar = b.avatar === '' ? '' : checkUploadUrl(String(b.avatar), ['image']);
    }
    if (b.theme !== undefined) {
      u.theme = b.theme === null ? null : parseTheme(b.theme);
    }
    if (b.diaryUrl !== undefined) {
      const d = text(b.diaryUrl, { max: 300, label: 'Ссылка на дневник' });
      if (d !== '') {
        let parsed;
        try {
          parsed = new URL(d);
        } catch (_) {
          throw bad('Ссылка на дневник: неверный адрес');
        }
        if (parsed.protocol !== 'https:') throw bad('Ссылка на дневник должна начинаться с https://');
      }
      u.diaryUrl = d;
    }
    saveDb();
    return { user: selfUser(u) };
  });

  route('POST', '/api/me/password', {}, async (ctx) => {
    rateLimit('pw:' + ctx.user.id, 10, 3600 * 1000);
    const b = await readJson(ctx.req);
    const oldPw = typeof b.oldPassword === 'string' ? b.oldPassword : '';
    const newPw = typeof b.newPassword === 'string' ? b.newPassword : '';
    if (newPw.length < 6 || newPw.length > 100) throw bad('Новый пароль: от 6 до 100 символов');
    if (!(await checkPassword(oldPw, ctx.user.passHash))) throw new HttpError(403, 'Старый пароль указан неверно');
    ctx.user.passHash = await hashPassword(newPw);
    const cur = sha(getToken(ctx.req, ctx.url));
    db.sessions = db.sessions.filter((s) => s.userId !== ctx.user.id || s.hash === cur);
    saveDb();
    return { ok: true };
  });

  route('GET', '/api/users', {}, (ctx) => {
    const q = String(ctx.url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 40);
    const me = ctx.user.id;
    let list = db.users.filter((u) => u.id !== me && !u.system);
    if (q) list = list.filter((u) => u.username.includes(q) || u.name.toLowerCase().includes(q));
    else list = list.slice().sort((a, b) => b.createdAt - a.createdAt);
    return { users: list.slice(0, 20).map((u) => Object.assign(publicUser(u), { relation: relation(me, u.id) })) };
  });

  route('GET', '/api/users/:id', {}, (ctx) => {
    const u = userById(intParam(ctx.params.id));
    if (!u || u.system) throw new HttpError(404, 'Пользователь не найден');
    return { user: Object.assign(publicUser(u), presenceFor(ctx.user.id, u)), relation: u.id === ctx.user.id ? 'self' : relation(ctx.user.id, u.id) };
  });

  route('GET', '/api/u/:username', {}, (ctx) => {
    const name = String(ctx.params.username || '').toLowerCase();
    const u = db.users.find((x) => x.username === name && !x.system);
    if (!u) throw new HttpError(404, 'Пользователь @' + name.slice(0, 20) + ' не найден');
    return { user: publicUser(u), relation: u.id === ctx.user.id ? 'self' : relation(ctx.user.id, u.id) };
  });

  route('GET', '/api/users/:id/posts', {}, (ctx) => {
    const u = userById(intParam(ctx.params.id));
    if (!u || u.system) throw new HttpError(404, 'Пользователь не найден');
    const mine = db.posts.filter((p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    return {
      posts: mine.slice(0, 30).map((p) => postViewFn(p, ctx.user.id)),
      count: mine.length,
      likes: mine.reduce((n, p) => n + p.likes.length, 0),
      friends: db.friendships.filter((f) => f.status === 'accepted' && (f.from === u.id || f.to === u.id)).length,
    };
  });

  route('GET', '/api/search', {}, (ctx) => {
    rateLimit('search:' + ctx.user.id, 90, 60 * 1000);
    const q = String(ctx.url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 40);
    if (q.length < 2) return { users: [], posts: [] };
    const users = db.users
      .filter((u) => !u.system && (u.username.toLowerCase().includes(q) || String(u.name).toLowerCase().includes(q)))
      .slice(0, 10).map(publicUser);
    const posts = db.posts
      .filter((p) => String(p.caption || '').toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30).map((p) => postViewFn(p, ctx.user.id)).filter(Boolean);
    return { users, posts };
  });
}

module.exports = {
  registerUserRoutes,
  checkUploadUrl,
  userById,
  areFriends,
};
