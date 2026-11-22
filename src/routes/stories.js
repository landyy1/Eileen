'use strict';

const { route } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { checkUploadUrl, userById, areFriends } = require('./users');
const { publicUser } = require('../realtime');
const { bad, HttpError, intParam, readJson } = require('../utils');

const DAY_MS = 24 * 3600 * 1000;

function registerStoryRoutes() {
  db.stories = db.stories || [];

  route('GET', '/api/stories', {}, (ctx) => {
    const me = ctx.user.id;
    const now = Date.now();
    db.stories = (db.stories || []).filter((s) => now - s.createdAt < DAY_MS);

    const active = db.stories.filter((s) => s.userId === me || areFriends(me, s.userId));

    const map = new Map();
    for (const s of active) {
      const u = userById(s.userId);
      if (!u || u.system) continue;
      let userGroup = map.get(s.userId);
      if (!userGroup) {
        userGroup = { user: publicUser(u), items: [] };
        map.set(s.userId, userGroup);
      }
      userGroup.items.push({
        id: s.id,
        mediaUrl: s.mediaUrl,
        kind: s.kind || 'image',
        caption: s.caption || '',
        createdAt: s.createdAt,
        views: (s.views || []).length,
        viewed: (s.views || []).includes(me),
      });
    }

    return { stories: [...map.values()] };
  });

  route('POST', '/api/stories', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const mediaUrl = checkUploadUrl(String(b.mediaUrl || ''), ['image', 'video']);
    const ext = mediaUrl.split('.').pop();
    const kind = ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : 'image';
    const caption = String(b.caption || '').trim().slice(0, 100);

    db.stories = db.stories || [];
    const story = {
      id: nextId(),
      userId: ctx.user.id,
      mediaUrl,
      kind,
      caption,
      createdAt: Date.now(),
      views: [],
    };
    db.stories.push(story);
    saveDb();

    return { story };
  });

  route('POST', '/api/stories/:id/view', {}, (ctx) => {
    db.stories = db.stories || [];
    const s = db.stories.find((x) => x.id === intParam(ctx.params.id));
    if (!s) throw new HttpError(404, 'История не найдена');
    s.views = s.views || [];
    if (!s.views.includes(ctx.user.id)) {
      s.views.push(ctx.user.id);
      saveDb();
    }
    return { ok: true };
  });
}

module.exports = {
  registerStoryRoutes,
};
