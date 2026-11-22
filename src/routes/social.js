'use strict';

const { route } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { userById } = require('./users');
const { findPost } = require('./posts');
const { publicUser, notify, push, isBlocked, hasBlocked } = require('../realtime');
const { bad, HttpError, intParam, readJson, text } = require('../utils');

function following(me, otherId) {
  return (db.follows || []).some((f) => f.userId === me && f.followingId === otherId);
}

function registerSocialRoutes(postView) {
  route('GET', '/api/users/:id/followers', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const user = userById(id);
    if (!user || user.system) throw new HttpError(404, 'Пользователь не найден');
    const followers = (db.follows || [])
      .filter((f) => f.followingId === id && !isBlocked(ctx.user.id, f.userId))
      .map((f) => userById(f.userId))
      .filter((u) => u && !u.system)
      .map(publicUser);
    return { followers, count: followers.length };
  });

  route('POST', '/api/users/:id/follow', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const target = userById(id);
    if (!target || target.system) throw new HttpError(404, 'Пользователь не найден');
    if (id === ctx.user.id) throw bad('Нельзя подписаться на себя');
    if (isBlocked(ctx.user.id, id)) throw new HttpError(403, 'Подписка недоступна');
    const list = db.follows || (db.follows = []);
    const i = list.findIndex((f) => f.userId === ctx.user.id && f.followingId === id);
    if (i >= 0) {
      list.splice(i, 1);
      saveDb();
      push(id, 'social', { type: 'unfollow', userId: ctx.user.id });
      return { following: false };
    }
    list.push({ id: nextId(), userId: ctx.user.id, followingId: id, createdAt: Date.now() });
    notify(id, 'follow', ctx.user.id);
    saveDb();
    push(id, 'social', { type: 'follow', userId: ctx.user.id });
    return { following: true };
  });

  route('GET', '/api/recommendations', {}, (ctx) => {
    const me = ctx.user.id;
    const list = db.users
      .filter((u) => u.id !== me && !u.system && !isBlocked(me, u.id) && !following(me, u.id))
      .map((u) => {
        const common = (db.follows || []).filter((f) => f.followingId === u.id && following(me, f.userId)).length;
        const posts = db.posts.filter((p) => p.userId === u.id).length;
        return { user: publicUser(u), score: common * 10 + Math.min(posts, 10), common };
      })
      .sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name))
      .slice(0, 20)
      .map(({ user, common }) => ({ user, common }));
    return { users: list };
  });

  route('GET', '/api/blocks', {}, (ctx) => {
    const users = (db.blocks || [])
      .filter((b) => b.userId === ctx.user.id)
      .map((b) => userById(b.blockedId))
      .filter((u) => u && !u.system)
      .map(publicUser);
    return { users };
  });

  route('POST', '/api/users/:id/block', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const target = userById(id);
    if (!target || target.system) throw new HttpError(404, 'Пользователь не найден');
    if (id === ctx.user.id) throw bad('Нельзя заблокировать себя');
    const list = db.blocks || (db.blocks = []);
    const i = list.findIndex((b) => b.userId === ctx.user.id && b.blockedId === id);
    if (i >= 0) {
      list.splice(i, 1);
      saveDb();
      return { blocked: false };
    }
    list.push({ id: nextId(), userId: ctx.user.id, blockedId: id, createdAt: Date.now() });
    db.friendships = db.friendships.filter((f) => f.from !== ctx.user.id || f.to !== id).filter((f) => f.from !== id || f.to !== ctx.user.id);
    db.follows = (db.follows || []).filter((f) => f.userId !== ctx.user.id || f.followingId !== id).filter((f) => f.userId !== id || f.followingId !== ctx.user.id);
    saveDb();
    push(id, 'social', { type: 'block', userId: ctx.user.id });
    return { blocked: true };
  });

  route('POST', '/api/reports', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const targetType = String(b.targetType || '');
    if (!['user', 'post'].includes(targetType)) throw bad('Неверный тип жалобы');
    const targetId = intParam(b.targetId);
    if (targetType === 'user') {
      const target = userById(targetId);
      if (!target || target.system || target.id === ctx.user.id) throw new HttpError(404, 'Пользователь не найден');
    } else {
      findPost(targetId);
    }
    const reason = text(b.reason, { min: 3, max: 500, label: 'Причина жалобы', multi: true });
    const list = db.reports || (db.reports = []);
    if (list.some((r) => r.reporterId === ctx.user.id && r.targetType === targetType && r.targetId === targetId && r.status === 'open')) {
      throw new HttpError(409, 'Жалоба уже отправлена');
    }
    list.push({ id: nextId(), reporterId: ctx.user.id, targetType, targetId, reason, status: 'open', createdAt: Date.now() });
    saveDb();
    return { ok: true };
  });

  route('POST', '/api/posts/:id/repost', {}, async (ctx) => {
    const original = findPost(intParam(ctx.params.id));
    if (isBlocked(ctx.user.id, original.userId)) throw new HttpError(403, 'Публикация недоступна');
    const b = await readJson(ctx.req);
    const caption = text(b.caption, { max: 300, label: 'Подпись', multi: true });
    const post = {
      id: nextId(),
      userId: ctx.user.id,
      kind: original.kind,
      caption,
      mediaUrl: original.mediaUrl || '',
      bg: original.bg || 0,
      repostOf: original.id,
      createdAt: Date.now(),
      likes: [],
      comments: [],
      views: 0,
      reactions: {},
    };
    db.posts.push(post);
    notify(original.userId, 'repost', ctx.user.id, { postId: original.id });
    saveDb();
    return { post: postView(post, ctx.user.id) };
  });
}

module.exports = { registerSocialRoutes, following };
