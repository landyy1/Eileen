'use strict';

const fs = require('fs');
const path = require('path');
const { route } = require('../router');
const { db, saveDb, nextId, UPLOAD_DIR } = require('../db');
const { userById } = require('./users');
const { publicUser } = require('../realtime');
const { bad, HttpError, intParam, readJson, text } = require('../utils');

const SOUNDCLOUD_RE = /^https?:\/\/(www\.)?(soundcloud\.com|on\.soundcloud\.com)\/[\w-]+/i;

function trackView(t, meId) {
  const author = userById(t.userId);
  t.likes = t.likes || [];
  t.listens = t.listens || 0;
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    coverUrl: t.coverUrl || '',
    audioUrl: t.audioUrl,
    isSoundCloud: !!t.isSoundCloud,
    embedUrl: t.isSoundCloud ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(t.audioUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=true&show_user=true&show_reposts=false&show_teaser=false` : null,
    duration: t.duration || 0,
    genre: t.genre || 'Разное',
    user: author ? publicUser(author) : null,
    createdAt: t.createdAt,
    likesCount: t.likes.length,
    liked: t.likes.includes(meId),
    listens: t.listens,
  };
}

function registerMusicRoutes() {
  db.tracks = db.tracks || [];

  if (db.tracks.length === 0) {
    const sys = db.users.find((u) => u.system);
    if (sys) {
      db.tracks.push({
        id: nextId(),
        userId: sys.id,
        title: 'Eileen Theme (Chillhop Remix)',
        artist: 'Eileen Sound',
        coverUrl: '',
        audioUrl: '',
        duration: 145,
        genre: 'Lo-Fi',
        createdAt: Date.now(),
        likes: [],
        listens: 124,
      });
      saveDb();
    }
  }

  route('GET', '/api/music/tracks', {}, (ctx) => {
    const q = String(ctx.url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 40);
    let list = db.tracks.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (q) {
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.genre && t.genre.toLowerCase().includes(q)));
    }
    return { tracks: list.map((t) => trackView(t, ctx.user.id)) };
  });

  route('GET', '/api/music/my', {}, (ctx) => {
    const me = ctx.user.id;
    const list = db.tracks
      .filter((t) => t.userId === me || (t.likes || []).includes(me))
      .sort((a, b) => b.createdAt - a.createdAt);
    return { tracks: list.map((t) => trackView(t, ctx.user.id)) };
  });

  // Импорт трека с SoundCloud
  route('POST', '/api/music/soundcloud', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const url = String(b.url || '').trim();
    if (!SOUNDCLOUD_RE.test(url)) {
      throw bad('Укажите корректную ссылку на трек SoundCloud (например: https://soundcloud.com/artist/track)');
    }
    const title = text(b.title, { min: 1, max: 80, label: 'Название трека' }) || 'SoundCloud Track';
    const artist = text(b.artist, { max: 60, label: 'Исполнитель' }) || 'SoundCloud Artist';

    const track = {
      id: nextId(),
      userId: ctx.user.id,
      title,
      artist,
      coverUrl: '',
      audioUrl: url,
      isSoundCloud: true,
      duration: 0,
      genre: 'SoundCloud',
      createdAt: Date.now(),
      likes: [],
      listens: 0,
    };
    db.tracks.push(track);
    saveDb();

    return { track: trackView(track, ctx.user.id) };
  });

  // Загрузка локального аудиофайла
  route('POST', '/api/music/tracks', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const title = text(b.title, { min: 1, max: 60, label: 'Название трека' });
    const artist = text(b.artist, { min: 1, max: 60, label: 'Исполнитель' }) || ctx.user.name;
    const audioUrl = String(b.audioUrl || '').trim();
    if (!audioUrl || !audioUrl.startsWith('/uploads/')) throw bad('Укажите загруженный аудиофайл');

    const coverUrl = String(b.coverUrl || '').trim();
    const genre = String(b.genre || 'Разное').trim().slice(0, 30);
    const duration = Math.max(0, Math.min(3600, Number(b.duration || 0)));

    const track = {
      id: nextId(),
      userId: ctx.user.id,
      title,
      artist,
      coverUrl,
      audioUrl,
      duration,
      genre,
      createdAt: Date.now(),
      likes: [],
      listens: 0,
    };
    db.tracks.push(track);
    saveDb();

    return { track: trackView(track, ctx.user.id) };
  });

  route('POST', '/api/music/tracks/:id/like', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const t = db.tracks.find((x) => x.id === id);
    if (!t) throw new HttpError(404, 'Трек не найден');

    t.likes = t.likes || [];
    const idx = t.likes.indexOf(ctx.user.id);
    if (idx >= 0) t.likes.splice(idx, 1);
    else t.likes.push(ctx.user.id);

    saveDb();
    return { liked: idx < 0, likesCount: t.likes.length };
  });

  route('POST', '/api/music/tracks/:id/listen', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const t = db.tracks.find((x) => x.id === id);
    if (!t) throw new HttpError(404, 'Трек не найден');

    t.listens = (t.listens || 0) + 1;
    saveDb();
    return { listens: t.listens };
  });

  route('DELETE', '/api/music/tracks/:id', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const t = db.tracks.find((x) => x.id === id);
    if (!t) throw new HttpError(404, 'Трек не найден');
    if (t.userId !== ctx.user.id && !ctx.user.isAdmin && !ctx.user.system) {
      throw new HttpError(403, 'Можно удалять только свои треки');
    }

    db.tracks = db.tracks.filter((x) => x !== t);
    saveDb();
    return { ok: true, deletedId: id };
  });
}

module.exports = {
  registerMusicRoutes,
};
