'use strict';

const crypto = require('crypto');
const { route, getToken } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { publicUser } = require('../realtime');
const { bad, HttpError, rateLimit, hashPassword, checkPassword, readJson, clientIp, sha } = require('../utils');

const COLORS = ['#c85f32', '#8a6f4d', '#5f8a78', '#b08a3e', '#7a6a9a', '#a0524f', '#4f7a96', '#6b7f4a'];

function selfUser(u) {
  return Object.assign(publicUser(u), { diaryUrl: u.diaryUrl || '', theme: u.theme || null, createdAt: u.createdAt });
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions.push({ hash: sha(token), userId, createdAt: Date.now() });
  const mine = db.sessions.filter((s) => s.userId === userId);
  if (mine.length > 10) {
    const drop = new Set(mine.slice(0, mine.length - 10));
    db.sessions = db.sessions.filter((s) => !drop.has(s));
  }
  return token;
}

function registerAuthRoutes() {
  route('GET', '/api/health', { auth: false }, () => ({ ok: true }));

  route('POST', '/api/register', { auth: false }, async (ctx) => {
    rateLimit('reg:' + clientIp(ctx.req), 20, 3600 * 1000);
    const b = await readJson(ctx.req);
    const username = String(b.username == null ? '' : b.username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw bad('Логин: 3–20 символов, только латинские буквы, цифры и знак _');
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 6 || password.length > 100) throw bad('Пароль: от 6 до 100 символов');
    const name = (b.name != null ? String(b.name).trim() : '') || username;

    const passHash = await hashPassword(password);
    if (db.users.some((u) => u.username === username)) throw new HttpError(409, 'Этот логин уже занят');

    const user = {
      id: nextId(),
      username,
      name,
      bio: '',
      avatar: '',
      color: COLORS[db.users.length % COLORS.length],
      diaryUrl: '',
      passHash,
      createdAt: Date.now(),
    };
    db.users.push(user);
    const token = createSession(user.id);
    saveDb();
    return { token, user: selfUser(user) };
  });

  route('POST', '/api/login', { auth: false }, async (ctx) => {
    const ip = clientIp(ctx.req);
    rateLimit('login-ip:' + ip, 30, 10 * 60 * 1000);
    const b = await readJson(ctx.req);
    const username = String(b.username == null ? '' : b.username).trim().toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    rateLimit('login-user:' + username, 10, 10 * 60 * 1000);
    const user = db.users.find((u) => u.username === username && !u.system);
    const ok = user ? await checkPassword(password, user.passHash) : false;
    if (!ok) throw new HttpError(401, 'Неверный логин или пароль');
    const token = createSession(user.id);
    saveDb();
    return { token, user: selfUser(user) };
  });

  route('POST', '/api/logout', {}, (ctx) => {
    const hash = sha(getToken(ctx.req, ctx.url));
    db.sessions = db.sessions.filter((s) => s.hash !== hash);
    saveDb();
    return { ok: true };
  });
}

module.exports = {
  registerAuthRoutes,
  selfUser,
  createSession,
};
