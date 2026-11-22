'use strict';

const { db, SESSION_TTL } = require('./db');
const { HttpError, sha, send } = require('./utils');

const routes = [];

function route(method, pattern, opts, handler) {
  if (typeof opts === 'function') {
    handler = opts;
    opts = {};
  }
  const keys = [];
  const re = new RegExp(
    '^' +
      pattern.replace(/:([a-zA-Z]+)/g, (_, k) => {
        keys.push(k);
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method, re, keys, auth: opts.auth !== false, raw: !!opts.raw, handler });
}

function getToken(req, url) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return url.searchParams.get('token') || '';
}

function userById(id) {
  return db.users.find((u) => u.id === id) || null;
}

function authUser(req, url) {
  const t = getToken(req, url);
  if (!t) return null;
  const hash = sha(t);
  const s = db.sessions.find((x) => x.hash === hash);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) return null;
  return userById(s.userId);
}

async function handleApi(req, res, url) {
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  let matched = null;
  let pathMatched = false;
  for (const r of routes) {
    const m = r.re.exec(url.pathname);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    matched = { r, m };
    break;
  }
  if (!matched) throw pathMatched ? new HttpError(405, 'Метод не поддерживается') : new HttpError(404, 'Не найдено');

  const params = {};
  matched.r.keys.forEach((k, i) => {
    params[k] = decodeURIComponent(matched.m[i + 1]);
  });

  let user = null;
  if (matched.r.auth) {
    user = authUser(req, url);
    if (!user) throw new HttpError(401, 'Нужно войти в аккаунт');
  }
  const ctx = { req, res, url, user, params };
  const result = await matched.r.handler(ctx);
  if (!matched.r.raw && !res.headersSent) send(res, 200, result === undefined ? { ok: true } : result);
}

module.exports = {
  route,
  routes,
  getToken,
  authUser,
  handleApi,
};
