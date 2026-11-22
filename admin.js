'use strict';

const fs = require('fs');
const path = require('path');
const { route } = require('../router');
const { db, saveDb, UPLOAD_DIR } = require('../db');
const { publicUser, push, isOnline } = require('../realtime');
const { bad, HttpError, intParam, readJson } = require('../utils');

const UPLOAD_URL_RE = /^\/uploads\/([a-f0-9]{24})\.(jpg|png|webp|gif|mp4|webm|mov)$/;
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u;
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '').trim();

function hasEmoji(str) {
  return EMOJI_RE.test(String(str || ''));
}

function checkAdmin(ctx) {
  if (!ctx.user) throw new HttpError(401, 'Нужно войти в аккаунт');
  if (!ctx.user.system && !ctx.user.isAdmin) {
    throw new HttpError(403, 'Доступ запрещён: требуется пароль администратора');
  }
}

function registerAdminRoutes() {
  // Запросить / Активировать права Администратора по паролю и эмодзи в никнейме
  route('POST', '/api/admin/claim', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const password = String(b.password || '').trim();
    if (!ADMIN_SECRET) throw new HttpError(503, 'Админ-доступ не настроен на сервере');
    if (!password || password !== ADMIN_SECRET) {
      throw new HttpError(403, 'Неверный секретный пароль администратора');
    }

    ctx.user.isAdmin = true;
    saveDb();
    return { ok: true, isAdmin: true, message: 'Права Администратора успешно активированы! 👑' };
  });

  // Получить статистику системы
  route('GET', '/api/admin/stats', {}, (ctx) => {
    checkAdmin(ctx);
    const activeStreams = require('../realtime').streams.size;

    return {
      usersCount: db.users.filter((u) => !u.system).length,
      postsCount: db.posts.length,
      messagesCount: db.messages.length,
      gradesCount: db.grades.length,
      onlineCount: activeStreams,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  });

  // Получить полный список пользователей
  route('GET', '/api/admin/users', {}, (ctx) => {
    checkAdmin(ctx);
    const list = db.users
      .filter((u) => !u.system)
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        color: u.color,
        avatar: u.avatar || '',
        createdAt: u.createdAt,
        banned: !!u.banned,
        isAdmin: !!u.isAdmin,
        online: isOnline(u.id),
      }));
    return { users: list };
  });

  // Заблокировать / Разблокировать пользователя
  route('POST', '/api/admin/users/:id/ban', {}, (ctx) => {
    checkAdmin(ctx);
    const id = intParam(ctx.params.id);
    const target = db.users.find((u) => u.id === id);
    if (!target) throw new HttpError(404, 'Пользователь не найден');
    if (target.system) throw bad('Нельзя заблокировать системный аккаунт');

    target.banned = !target.banned;
    if (target.banned) {
      db.sessions = db.sessions.filter((s) => s.userId !== id);
    }
    saveDb();
    return { id: target.id, banned: target.banned };
  });

  // Полное удаление аккаунта со всем содержимым
  route('DELETE', '/api/admin/users/:id', {}, (ctx) => {
    checkAdmin(ctx);
    const id = intParam(ctx.params.id);
    const target = db.users.find((u) => u.id === id);
    if (!target) throw new HttpError(404, 'Пользователь не найден');
    if (target.system) throw bad('Нельзя удалить системный аккаунт');

    db.users = db.users.filter((u) => u.id !== id);
    db.sessions = db.sessions.filter((s) => s.userId !== id);

    const userPosts = db.posts.filter((p) => p.userId === id);
    for (const p of userPosts) {
      if (p.mediaUrl) {
        const m = UPLOAD_URL_RE.exec(p.mediaUrl);
        if (m) fs.unlink(path.join(UPLOAD_DIR, m[1] + '.' + m[2]), () => {});
      }
    }
    db.posts = db.posts.filter((p) => p.userId !== id);

    for (const p of db.posts) {
      p.likes = p.likes.filter((uid) => uid !== id);
      p.comments = p.comments.filter((c) => c.userId !== id);
    }

    db.messages = db.messages.filter((m) => m.from !== id && m.to !== id);
    db.friendships = db.friendships.filter((f) => f.from !== id && f.to !== id);
    db.notifications = db.notifications.filter((n) => n.userId !== id && n.from !== id);
    db.grades = db.grades.filter((g) => g.userId !== id);

    saveDb();
    return { ok: true, deletedId: id };
  });

  // Модерация постов
  route('DELETE', '/api/admin/posts/:id', {}, (ctx) => {
    checkAdmin(ctx);
    const id = intParam(ctx.params.id);
    const p = db.posts.find((x) => x.id === id);
    if (!p) throw new HttpError(404, 'Пост не найден');

    db.posts = db.posts.filter((x) => x !== p);
    if (p.mediaUrl) {
      const m = UPLOAD_URL_RE.exec(p.mediaUrl);
      if (m) fs.unlink(path.join(UPLOAD_DIR, m[1] + '.' + m[2]), () => {});
    }
    saveDb();
    return { ok: true, deletedPostId: id };
  });

  // Общая рассылка анонса от имени администратора
  route('POST', '/api/admin/broadcast', {}, async (ctx) => {
    checkAdmin(ctx);
    const b = await readJson(ctx.req);
    const messageText = String(b.text || '').trim();
    if (!messageText) throw bad('Текст рассылки не может быть пустым');

    for (const u of db.users) {
      if (!u.system && u.id !== ctx.user.id) {
        db.notifications.push({
          id: db.seq++,
          userId: u.id,
          type: 'system',
          from: ctx.user.id,
          text: messageText,
          createdAt: Date.now(),
          read: false,
        });
        push(u.id, 'notify', {});
      }
    }
    saveDb();
    return { ok: true, count: db.users.length - 1 };
  });

  route('GET', '/api/admin/reports', {}, (ctx) => {
    checkAdmin(ctx);
    const reports = (db.reports || []).filter((r) => r.status === 'open').map((r) => {
      const reporter = db.users.find((u) => u.id === r.reporterId);
      const target = r.targetType === 'user' ? db.users.find((u) => u.id === r.targetId) : db.posts.find((p) => p.id === r.targetId);
      return { id: r.id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, createdAt: r.createdAt, reporter: reporter ? publicUser(reporter) : null, exists: !!target };
    }).sort((a, b) => b.createdAt - a.createdAt);
    return { reports };
  });

  route('POST', '/api/admin/reports/:id', {}, async (ctx) => {
    checkAdmin(ctx);
    const id = intParam(ctx.params.id);
    const b = await readJson(ctx.req);
    const status = String(b.status || 'resolved');
    if (!['resolved', 'rejected'].includes(status)) throw bad('Неверный статус жалобы');
    const report = (db.reports || []).find((r) => r.id === id);
    if (!report) throw new HttpError(404, 'Жалоба не найдена');
    report.status = status;
    report.reviewedBy = ctx.user.id;
    report.reviewedAt = Date.now();
    saveDb();
    return { ok: true, status };
  });
}

module.exports = {
  registerAdminRoutes,
};
