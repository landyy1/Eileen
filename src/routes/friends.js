'use strict';

const { route } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { userById } = require('./users');
const { publicUser, findFriendship, relation, push, notify } = require('../realtime');
const { bad, HttpError, intParam, readJson } = require('../utils');

function registerFriendRoutes() {
  route('GET', '/api/friends', {}, (ctx) => {
    const me = ctx.user.id;
    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const f of db.friendships) {
      if (f.from !== me && f.to !== me) continue;
      const other = userById(f.from === me ? f.to : f.from);
      if (!other) continue;
      if (f.status === 'accepted') friends.push(publicUser(other));
      else if (f.to === me) incoming.push(publicUser(other));
      else outgoing.push(publicUser(other));
    }
    friends.sort((a, b) => a.name.localeCompare(b.name));
    return { friends, incoming, outgoing };
  });

  route('POST', '/api/friends/request', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const me = ctx.user.id;
    const other = userById(intParam(b.userId));
    if (!other || other.system) throw new HttpError(404, 'Пользователь не найден');
    if (other.id === me) throw bad('Нельзя добавить самого себя');
    const f = findFriendship(me, other.id);
    if (f) {
      if (f.status === 'accepted') throw new HttpError(409, 'Вы уже друзья');
      if (f.from === me) throw new HttpError(409, 'Заявка уже отправлена');
      f.status = 'accepted';
      f.createdAt = Date.now();
      notify(other.id, 'friend_accept', me);
    } else {
      db.friendships.push({ id: nextId(), from: me, to: other.id, status: 'pending', createdAt: Date.now() });
      notify(other.id, 'friend_request', me);
    }
    saveDb();
    push(other.id, 'friends', {});
    push(me, 'friends', {});
    return { relation: relation(me, other.id) };
  });

  route('POST', '/api/friends/respond', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const me = ctx.user.id;
    const otherId = intParam(b.userId);
    const f = db.friendships.find((x) => x.from === otherId && x.to === me && x.status === 'pending');
    if (!f) throw new HttpError(404, 'Заявка не найдена');
    if (b.accept === true) {
      f.status = 'accepted';
      f.createdAt = Date.now();
      notify(otherId, 'friend_accept', me);
    } else {
      db.friendships = db.friendships.filter((x) => x !== f);
    }
    saveDb();
    push(otherId, 'friends', {});
    push(me, 'friends', {});
    return { relation: relation(me, otherId) };
  });

  route('DELETE', '/api/friends/:id', {}, (ctx) => {
    const me = ctx.user.id;
    const otherId = intParam(ctx.params.id);
    const f = findFriendship(me, otherId);
    if (!f) throw new HttpError(404, 'Связь не найдена');
    db.friendships = db.friendships.filter((x) => x !== f);
    saveDb();
    push(otherId, 'friends', {});
    push(me, 'friends', {});
    return { ok: true };
  });
}

module.exports = {
  registerFriendRoutes,
};
