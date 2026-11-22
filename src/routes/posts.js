'use strict';

const fs = require('fs');
const path = require('path');
const { route } = require('../router');
const { db, saveDb, nextId, UPLOAD_DIR } = require('../db');
const { checkUploadUrl, userById, areFriends } = require('./users');
const { publicUser, notify, notifView } = require('../realtime');
const { bad, HttpError, rateLimit, text, intParam, readJson } = require('../utils');

const BG_COUNT = 8;
const UPLOAD_URL_RE = /^\/uploads\/([a-f0-9]{24})\.(jpg|png|webp|gif|mp4|webm|mov)$/;

function postView(p, meId) {
  const author = userById(p.userId);
  if (!author) return null;
  return {
    id: p.id,
    user: publicUser(author),
    caption: p.caption || '',
    kind: p.kind,
    mediaUrl: p.mediaUrl || '',
    bg: p.bg || 0,
    createdAt: p.createdAt,
    likes: p.likes.length,
    liked: p.likes.includes(meId),
    comments: p.comments.length,
    saved: !!((userById(meId) || {}).bookmarks || []).includes(p.id),
  };
}

function findPost(id) {
  const p = db.posts.find((x) => x.id === id);
  if (!p) throw new HttpError(404, 'Пост не найден');
  return p;
}

function registerPostRoutes() {
  route('GET', '/api/feed', {}, (ctx) => {
    const me = ctx.user.id;
    const friendsOnly = ctx.url.searchParams.get('scope') === 'friends';
    const all = db.posts
      .filter((p) => userById(p.userId) && (!friendsOnly || p.userId === me || areFriends(me, p.userId)))
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    const total = all.length;
    if (!total) return { items: [], next: 0, total: 0 };
    let cursor = parseInt(ctx.url.searchParams.get('cursor') || '0', 10);
    if (!(cursor >= 0)) cursor = 0;
    cursor %= total;
    let limit = parseInt(ctx.url.searchParams.get('limit') || '5', 10);
    if (!(limit >= 1)) limit = 5;
    limit = Math.min(limit, 10);
    const n = Math.min(limit, total);
    const items = [];
    for (let i = 0; i < n; i++) items.push(postView(all[(cursor + i) % total], ctx.user.id));
    return { items, next: (cursor + n) % total, total };
  });

  route('POST', '/api/posts', {}, async (ctx) => {
    rateLimit('post:' + ctx.user.id, 30, 3600 * 1000);
    const b = await readJson(ctx.req);
    const kind = b.kind;
    if (!['video', 'image', 'text'].includes(kind)) throw bad('Неверный тип поста');
    const caption = text(b.caption, { min: kind === 'text' ? 1 : 0, max: 300, label: 'Подпись', multi: true });
    const p = { id: nextId(), userId: ctx.user.id, kind, caption, mediaUrl: '', bg: 0, createdAt: Date.now(), likes: [], comments: [] };
    if (kind === 'text') {
      const bg = Number(b.bg || 0);
      p.bg = Number.isInteger(bg) && bg >= 0 && bg < BG_COUNT ? bg : 0;
    } else {
      p.mediaUrl = checkUploadUrl(String(b.mediaUrl || ''), [kind]);
    }
    db.posts.push(p);
    saveDb();
    return { post: postView(p, ctx.user.id) };
  });

  route('GET', '/api/posts/:id', {}, (ctx) => {
    const p = findPost(intParam(ctx.params.id));
    const v = postView(p, ctx.user.id);
    if (!v) throw new HttpError(404, 'Пост не найден');
    return { post: v };
  });

  route('GET', '/api/trending', {}, () => {
    const counts = new Map();
    const recent = db.posts.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
    for (const p of recent) {
      for (const t of new Set((String(p.caption || '').match(/#[\p{L}\p{N}_]{2,30}/gu) || []).map((s) => s.toLowerCase()))) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([tag, count]) => ({ tag, count }));
    return { tags };
  });

  route('GET', '/api/notifications', {}, (ctx) => {
    const me = ctx.user.id;
    let limit = parseInt(ctx.url.searchParams.get('limit') || '50', 10);
    if (!(limit >= 0)) limit = 50;
    limit = Math.min(limit, 100);
    const mine = db.notifications.filter((n) => n.userId === me).sort((a, b) => b.id - a.id);
    const unread = mine.filter((n) => !n.read && notifView(n, me)).length;
    const items = limit ? mine.slice(0, limit * 2).map((n) => notifView(n, me)).filter(Boolean).slice(0, limit) : [];
    return { items, unread };
  });

  route('POST', '/api/notifications/read', {}, (ctx) => {
    let changed = false;
    for (const n of db.notifications) {
      if (n.userId === ctx.user.id && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) saveDb();
    return { ok: true };
  });

  route('DELETE', '/api/posts/:id', {}, (ctx) => {
    const p = findPost(intParam(ctx.params.id));
    if (p.userId !== ctx.user.id) throw new HttpError(403, 'Можно удалять только свои посты');
    db.posts = db.posts.filter((x) => x !== p);
    if (p.mediaUrl) {
      const m = UPLOAD_URL_RE.exec(p.mediaUrl);
      if (m) fs.unlink(path.join(UPLOAD_DIR, m[1] + '.' + m[2]), () => {});
    }
    saveDb();
    return { ok: true };
  });

  route('POST', '/api/posts/:id/bookmark', {}, (ctx) => {
    const p = findPost(intParam(ctx.params.id));
    const u = ctx.user;
    u.bookmarks = u.bookmarks || [];
    const has = u.bookmarks.includes(p.id);
    u.bookmarks = has ? u.bookmarks.filter((x) => x !== p.id) : [p.id, ...u.bookmarks].slice(0, 500);
    saveDb();
    return { saved: !has };
  });

  route('GET', '/api/bookmarks', {}, (ctx) => {
    const ids = ctx.user.bookmarks || [];
    const posts = ids.map((id) => db.posts.find((p) => p.id === id)).filter(Boolean).map((p) => postView(p, ctx.user.id)).filter(Boolean);
    return { posts };
  });

  route('PUT', '/api/posts/:id', {}, async (ctx) => {
    rateLimit('postedit:' + ctx.user.id, 60, 3600 * 1000);
    const p = findPost(intParam(ctx.params.id));
    if (p.userId !== ctx.user.id) throw new HttpError(403, 'Можно редактировать только свои посты');
    const b = await readJson(ctx.req);
    p.caption = text(b.caption, { min: p.kind === 'text' ? 1 : 0, max: 300, label: 'Подпись', multi: true });
    p.edited = true;
    saveDb();
    return { post: postView(p, ctx.user.id) };
  });

  route('POST', '/api/posts/:id/like', {}, (ctx) => {
    const p = findPost(intParam(ctx.params.id));
    const i = p.likes.indexOf(ctx.user.id);
    if (i >= 0) p.likes.splice(i, 1);
    else {
      p.likes.push(ctx.user.id);
      notify(p.userId, 'like', ctx.user.id, { postId: p.id });
    }
    saveDb();
    return { liked: i < 0, likes: p.likes.length };
  });

  route('GET', '/api/posts/:id/comments', {}, (ctx) => {
    const p = findPost(intParam(ctx.params.id));
    const list = p.comments
      .slice(-200)
      .map((c) => {
        const u = userById(c.userId);
        return u ? { id: c.id, user: publicUser(u), text: c.text, createdAt: c.createdAt } : null;
      })
      .filter(Boolean);
    return { comments: list };
  });

  route('POST', '/api/posts/:id/comments', {}, async (ctx) => {
    rateLimit('cmt:' + ctx.user.id, 60, 3600 * 1000);
    const p = findPost(intParam(ctx.params.id));
    const b = await readJson(ctx.req);
    const body = text(b.text, { min: 1, max: 300, label: 'Комментарий' });
    const c = { id: nextId(), userId: ctx.user.id, text: body, createdAt: Date.now() };
    p.comments.push(c);
    notify(p.userId, 'comment', ctx.user.id, { postId: p.id, text: body.slice(0, 120) });
    saveDb();
    return { comment: { id: c.id, user: publicUser(ctx.user), text: c.text, createdAt: c.createdAt }, count: p.comments.length };
  });

  route('DELETE', '/api/posts/:id/comments/:cid', {}, (ctx) => {
    const p = findPost(intParam(ctx.params.id));
    const cid = intParam(ctx.params.cid);
    const c = p.comments.find((x) => x.id === cid);
    if (!c) throw new HttpError(404, 'Комментарий не найден');
    if (c.userId !== ctx.user.id && p.userId !== ctx.user.id) throw new HttpError(403, 'Можно удалять свои комментарии или комментарии под своим постом');
    p.comments = p.comments.filter((x) => x !== c);
    saveDb();
    return { ok: true, count: p.comments.length };
  });
}

module.exports = {
  registerPostRoutes,
  postView,
  findPost,
};
