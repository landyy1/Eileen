'use strict';

const crypto = require('crypto');

// Автоматически доверяем reverse-proxy на Render.com, Cloudflare и при явном флаге
const TRUST_PROXY =
  process.env.TRUST_PROXY === '1' ||
  process.env.TRUST_PROXY === 'true' ||
  Boolean(process.env.RENDER) ||
  process.env.NODE_ENV === 'production';

class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}
const bad = (m) => new HttpError(400, m);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function text(v, { min = 0, max, label, multi = false }) {
  if (v == null) v = '';
  if (typeof v !== 'string') throw bad(`${label}: неверный формат`);
  let s = multi
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    : v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/ {2,}/g, ' ');
  s = s.trim().normalize('NFC');
  const len = [...s].length;
  if (len < min) throw bad(min === 1 ? `${label}: не может быть пустым` : `${label}: минимум ${min} символов`);
  if (max !== undefined && len > max) throw bad(`${label}: максимум ${max} символов`);
  return s;
}

function intParam(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad('Неверный идентификатор');
  return n;
}

function cleanIp(ip) {
  if (typeof ip !== 'string') return 'unknown';
  ip = ip.trim();
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf && typeof cf === 'string') return cleanIp(cf);
    const xr = req.headers['x-real-ip'];
    if (xr && typeof xr === 'string') return cleanIp(xr);
    const xf = req.headers['x-forwarded-for'];
    if (xf && typeof xf === 'string') {
      const first = xf.split(',')[0].trim();
      if (first) return cleanIp(first);
    }
  }
  const raw = req.socket && req.socket.remoteAddress;
  return raw ? cleanIp(raw) : 'unknown';
}

const hits = new Map();
const MAX_RATE_LIMIT_KEYS = 10000;

function cleanupRateLimit(now = Date.now()) {
  for (const [k, e] of hits) {
    if (e.reset < now) hits.delete(k);
  }
}

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let e = hits.get(key);
  if (!e || e.reset < now) {
    if (hits.size >= MAX_RATE_LIMIT_KEYS) {
      cleanupRateLimit(now);
      if (hits.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = hits.keys().next().value;
        if (oldestKey) hits.delete(oldestKey);
      }
    }
    e = { n: 0, reset: now + windowMs };
    hits.set(key, e);
  }
  e.n++;
  if (e.n > max) {
    const retrySec = Math.max(1, Math.ceil((e.reset - now) / 1000));
    const err = new HttpError(429, 'Слишком много попыток. Подождите несколько минут и попробуйте снова.');
    err.retryAfter = retrySec;
    throw err;
  }
}

setInterval(() => {
  cleanupRateLimit();
}, 60000).unref();

const scrypt = (pw, salt) =>
  new Promise((resolve, reject) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? reject(e) : resolve(k))));

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt);
  return salt.toString('hex') + ':' + key.toString('hex');
}

async function checkPassword(pw, stored) {
  if (typeof stored !== 'string') return false;
  const [s, k] = stored.split(':');
  if (!s || !k) return false;
  try {
    const salt = Buffer.from(s, 'hex');
    const kb = Buffer.from(k, 'hex');
    const key = await scrypt(pw, salt);
    return kb.length === key.length && crypto.timingSafeEqual(kb, key);
  } catch (_) {
    return false;
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function parseTheme(t) {
  if (t === null || typeof t !== 'object' || Array.isArray(t)) throw bad('Тема: неверный формат');
  const out = {};
  for (const k of ['accent', 'accent2', 'bg', 'panel', 'text']) {
    if (typeof t[k] !== 'string' || !HEX_RE.test(t[k])) throw bad('Тема: неверный цвет (' + k + ')');
    out[k] = t[k].toLowerCase();
  }
  for (const k of ['rainbow', 'glass', 'aurora', 'compact']) out[k] = t[k] === true;
  out.anim = t.anim !== false;
  const num = (k, min, max, def) => {
    const v = t[k] === undefined ? def : Number(t[k]);
    if (!Number.isFinite(v) || v < min || v > max) throw bad(`Тема: «${k}» должно быть от ${min} до ${max}`);
    return Math.round(v);
  };
  out.speed = num('speed', 1, 100, 40);
  out.glow = num('glow', 0, 40, 0);
  out.radius = num('radius', 0, 28, 14);
  out.blur = num('blur', 0, 40, 16);
  out.panelAlpha = num('panelAlpha', 30, 100, 100);
  out.scale = num('scale', 80, 125, 100);
  out.preset = typeof t.preset === 'string' ? t.preset.replace(/[^\p{L}\p{N} _()-]/gu, '').slice(0, 30) : '';
  out.fontFamily = typeof t.fontFamily === 'string' ? t.fontFamily.replace(/[^\p{L}\p{N} _(),"-]/gu, '').slice(0, 80) : 'system';
  return out;
}

const CSP =
  "default-src 'self' capacitor: http: https: data: blob:; " +
  "img-src 'self' data: blob: https:; " +
  "media-src 'self' blob: data: https:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; " +
  "connect-src 'self' capacitor: http: https: ws: wss: blob: data:; " +
  "font-src 'self' data:; " +
  "worker-src 'self' blob:; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

function baseHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': CSP,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
    ...extra,
  };
}

function send(res, status, body, extra = {}) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    ...baseHeaders(),
    ...extra,
  });
  res.end(data);
}

function sendStatusText(res, status, msg, extra = {}) {
  const data = Buffer.from(msg);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': data.length,
    ...baseHeaders(),
    ...extra,
  });
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) {
        done = true;
        reject(new HttpError(413, 'Слишком большой запрос'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!done) resolve(Buffer.concat(chunks));
    });
    req.on('error', (e) => {
      if (!done) reject(e);
    });
  });
}

function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const clean = {};
  for (const k of Object.keys(obj)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    clean[k] = sanitizeObject(obj[k]);
  }
  return clean;
}

async function readJson(req, limit = 200 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  let v;
  try {
    v = JSON.parse(buf.toString('utf8'));
  } catch (_) {
    throw bad('Неверный формат данных (JSON)');
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw bad('Неверный формат данных');
  return sanitizeObject(v);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

module.exports = {
  HttpError,
  bad,
  sha,
  text,
  intParam,
  clientIp,
  rateLimit,
  hashPassword,
  checkPassword,
  parseTheme,
  baseHeaders,
  send,
  sendStatusText,
  readBody,
  readJson,
  MIME,
};
