'use strict';

const { db, saveDb, nextId } = require('./db');

const streams = new Map(); // userId -> Set<res>

function push(userId, event, data) {
  const set = streams.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const r of set) {
    try {
      r.write(payload);
    } catch (_) {
      /* соединение закрыто */
    }
  }
}

const presenceOn = new Set();
const offlineTimers = new Map();
const isOnline = (id) => presenceOn.has(id);

function broadcastPresence(userId, online) {
  for (const f of db.friendships) {
    if (f.status !== 'accepted') continue;
    if (f.from === userId) push(f.to, 'presence', { id: userId, online });
    else if (f.to === userId) push(f.from, 'presence', { id: userId, online });
  }
}

function userConnected(userId) {
  const t = offlineTimers.get(userId);
  if (t) {
    clearTimeout(t);
    offlineTimers.delete(userId);
  }
  if (!presenceOn.has(userId)) {
    presenceOn.add(userId);
    broadcastPresence(userId, true);
  }
}

function userDisconnected(userId) {
  const t = setTimeout(() => {
    offlineTimers.delete(userId);
    if (streams.has(userId)) return;
    presenceOn.delete(userId);
    const u = db.users.find((x) => x.id === userId);
    if (u) {
      u.lastSeen = Date.now();
      saveDb();
    }
    broadcastPresence(userId, false);
  }, 8000);
  if (t.unref) t.unref();
  offlineTimers.set(userId, t);
}

function notify(userId, type, fromId, extra) {
  if (!userId || userId === fromId) return;
  if (type === 'like' && db.notifications.some((n) => n.userId === userId && n.type === 'like' && n.from === fromId && n.postId === extra.postId)) return;
  db.notifications.push(Object.assign({ id: nextId(), userId, type, from: fromId, createdAt: Date.now(), read: false }, extra || {}));
  const mine = db.notifications.filter((n) => n.userId === userId);
  if (mine.length > 200) {
    const drop = new Set(mine.slice(0, mine.length - 200));
    db.notifications = db.notifications.filter((n) => !drop.has(n));
  }
  push(userId, 'notify', {});
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    bio: u.bio || '',
    avatar: u.avatar || '',
    color: u.color || '#c85f32',
    statusEmoji: u.statusEmoji || '',
    statusText: u.statusText || '',
  };
}

function findFriendship(a, b) {
  return db.friendships.find((f) => (f.from === a && f.to === b) || (f.from === b && f.to === a));
}

function isBlocked(a, b) {
  return (db.blocks || []).some((x) => (x.userId === a && x.blockedId === b) || (x.userId === b && x.blockedId === a));
}

function hasBlocked(me, otherId) {
  return (db.blocks || []).some((x) => x.userId === me && x.blockedId === otherId);
}

function relation(me, otherId) {
  const f = findFriendship(me, otherId);
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friend';
  return f.from === me ? 'outgoing' : 'incoming';
}

function notifView(n, me) {
  const from = db.users.find((u) => u.id === n.from);
  if (!from || from.system) return null;
  let post = null;
  if (n.postId) {
    const p = db.posts.find((x) => x.id === n.postId);
    if (!p) return null;
    post = { id: p.id, kind: p.kind, mediaUrl: p.mediaUrl || '', bg: p.bg || 0, caption: String(p.caption || '').slice(0, 80) };
  }
  return {
    id: n.id,
    type: n.type,
    user: publicUser(from),
    text: n.text || '',
    post,
    relation: n.type === 'friend_request' ? relation(me, n.from) : undefined,
    createdAt: n.createdAt,
    read: !!n.read,
  };
}

module.exports = {
  streams,
  push,
  isOnline,
  userConnected,
  userDisconnected,
  notify,
  notifView,
  publicUser,
  findFriendship,
  isBlocked,
  hasBlocked,
  relation,
};
