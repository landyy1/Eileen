'use strict';

const { route } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { userById, areFriends } = require('./users');
const { publicUser, isOnline, push } = require('../realtime');
const { HttpError, rateLimit, text, intParam, readJson } = require('../utils');

function msgView(m) {
  return { id: m.id, from: m.from, to: m.to, text: m.text, createdAt: m.createdAt, read: !!m.read, edited: !!m.edited };
}

function registerChatRoutes() {
  route('GET', '/api/chats', {}, (ctx) => {
    const me = ctx.user.id;
    const map = new Map();
    for (const f of db.friendships) {
      if (f.status !== 'accepted' || (f.from !== me && f.to !== me)) continue;
      const o = f.from === me ? f.to : f.from;
      map.set(o, { userId: o, last: null, unread: 0 });
    }
    for (const m of db.messages) {
      if (m.from !== me && m.to !== me) continue;
      const o = m.from === me ? m.to : m.from;
      let e = map.get(o);
      if (!e) {
        e = { userId: o, last: null, unread: 0 };
        map.set(o, e);
      }
      if (!e.last || m.id > e.last.id) e.last = m;
      if (m.to === me && !m.read) e.unread++;
    }
    const chats = [];
    for (const e of map.values()) {
      const other = userById(e.userId);
      if (!other || other.system) continue;
      chats.push({
        user: publicUser(other),
        last: e.last ? msgView(e.last) : null,
        unread: e.unread,
        friend: areFriends(me, e.userId),
        online: areFriends(me, e.userId) && isOnline(e.userId),
      });
    }
    chats.sort((a, b) => {
      const ta = a.last ? a.last.createdAt : 0;
      const tb = b.last ? b.last.createdAt : 0;
      if (ta !== tb) return tb - ta;
      return a.user.name.localeCompare(b.user.name);
    });
    return { chats };
  });

  route('GET', '/api/chats/:id/messages', {}, (ctx) => {
    const me = ctx.user.id;
    const otherId = intParam(ctx.params.id);
    if (!userById(otherId)) throw new HttpError(404, 'Пользователь не найден');
    const before = Number(ctx.url.searchParams.get('before')) || 0;
    let limit = parseInt(ctx.url.searchParams.get('limit') || '50', 10);
    if (!(limit >= 1)) limit = 50;
    limit = Math.min(limit, 100);
    let list = db.messages.filter((m) => (m.from === me && m.to === otherId) || (m.from === otherId && m.to === me));
    if (before) list = list.filter((m) => m.id < before);
    const hasMore = list.length > limit;
    list = list.slice(-limit);
    if (!before) {
      let changed = false;
      for (const m of db.messages) {
        if (m.from === otherId && m.to === me && !m.read) {
          m.read = true;
          changed = true;
        }
      }
      if (changed) {
        saveDb();
        push(otherId, 'read', { by: me });
      }
    }
    return { messages: list.map(msgView), hasMore };
  });

  route('POST', '/api/chats/:id/read', {}, (ctx) => {
    const me = ctx.user.id;
    const otherId = intParam(ctx.params.id);
    let changed = false;
    for (const m of db.messages) {
      if (m.from === otherId && m.to === me && !m.read) {
        m.read = true;
        changed = true;
      }
    }
    if (changed) {
      saveDb();
      push(otherId, 'read', { by: me });
    }
    return { ok: true };
  });

  route('POST', '/api/chats/:id/messages', {}, async (ctx) => {
    const me = ctx.user.id;
    const otherId = intParam(ctx.params.id);
    rateLimit('msg:' + me, 120, 60 * 1000);
    const b = await readJson(ctx.req);
    const other = userById(otherId);
    if (!other || other.system) throw new HttpError(404, 'Пользователь не найден');
    if (!areFriends(me, otherId)) throw new HttpError(403, 'Писать можно только друзьям');
    const body = text(b.text, { min: 1, max: 2000, label: 'Сообщение', multi: true });
    const m = { id: nextId(), from: me, to: otherId, text: body, createdAt: Date.now(), read: false };
    db.messages.push(m);
    saveDb();
    const view = msgView(m);
    push(otherId, 'message', { message: view });
    push(me, 'message', { message: view });
    return { message: view };
  });

  route('POST', '/api/chats/:id/typing', {}, (ctx) => {
    const me = ctx.user.id;
    const otherId = intParam(ctx.params.id);
    rateLimit('typing:' + me, 90, 60 * 1000);
    if (!areFriends(me, otherId)) throw new HttpError(403, 'Только для друзей');
    push(otherId, 'typing', { from: me });
    return { ok: true };
  });

  route('PUT', '/api/messages/:id', {}, async (ctx) => {
    rateLimit('msgedit:' + ctx.user.id, 60, 60 * 1000);
    const id = intParam(ctx.params.id);
    const m = db.messages.find((x) => x.id === id);
    if (!m) throw new HttpError(404, 'Сообщение не найдено');
    if (m.from !== ctx.user.id) throw new HttpError(403, 'Можно редактировать только свои сообщения');
    if (Date.now() - m.createdAt > 24 * 3600 * 1000) throw new HttpError(403, 'Сообщение можно редактировать в течение суток');
    const b = await readJson(ctx.req);
    m.text = text(b.text, { min: 1, max: 2000, label: 'Сообщение', multi: true });
    m.edited = true;
    saveDb();
    const view = msgView(m);
    push(m.to, 'message_edited', { message: view });
    push(m.from, 'message_edited', { message: view });
    return { message: view };
  });

  route('DELETE', '/api/messages/:id', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const m = db.messages.find((x) => x.id === id);
    if (!m) throw new HttpError(404, 'Сообщение не найдено');
    if (m.from !== ctx.user.id) throw new HttpError(403, 'Можно удалять только свои сообщения');
    db.messages = db.messages.filter((x) => x !== m);
    saveDb();
    push(m.to, 'message_deleted', { id, from: m.from });
    push(m.from, 'message_deleted', { id, from: m.from });
    return { ok: true };
  });
}

module.exports = {
  registerChatRoutes,
  msgView,
};
