'use strict';

const { route } = require('../router');
const { db, saveDb } = require('../db');
const { notify } = require('../realtime');
const { intParam } = require('../utils');

function calculateLevel(xp) {
  xp = Math.max(0, Number(xp || 0));
  // Формула уровня: Level = floor(sqrt(xp / 20)) + 1
  const level = Math.floor(Math.sqrt(xp / 20)) + 1;
  const currentLevelMinXp = (level - 1) * (level - 1) * 20;
  const nextLevelMinXp = level * level * 20;
  const reqXp = nextLevelMinXp - currentLevelMinXp;
  const progXp = xp - currentLevelMinXp;
  const progressPercent = Math.min(100, Math.floor((progXp / reqXp) * 100));

  let rankTitle = 'Новичок 🐣';
  if (level >= 25) rankTitle = 'Мифический 🌌';
  else if (level >= 15) rankTitle = 'Легенда 👑';
  else if (level >= 10) rankTitle = 'Мастер ⚡';
  else if (level >= 5) rankTitle = 'Активист 🔥';
  else if (level >= 2) rankTitle = 'Участник ⭐';

  const badges = [];
  if (xp >= 10) badges.push({ id: 'first_step', icon: '🚀', title: 'Первые шаги' });
  if (xp >= 100) badges.push({ id: 'communicator', icon: '💬', title: 'Общительный' });
  if (xp >= 300) badges.push({ id: 'creator', icon: '🎨', title: 'Творец' });
  if (xp >= 600) badges.push({ id: 'music_lover', icon: '🎵', title: 'Меломан' });
  if (xp >= 1000) badges.push({ id: 'legend', icon: '👑', title: 'Легенда Eileen' });

  return {
    xp,
    level,
    progressPercent,
    currentLevelMinXp,
    nextLevelMinXp,
    rankTitle,
    badges,
  };
}

function addXp(userId, amount) {
  const u = db.users.find((x) => x.id === userId);
  if (!u || u.system) return;

  const oldLevel = calculateLevel(u.xp || 0).level;
  u.xp = (u.xp || 0) + amount;
  const newLevelInfo = calculateLevel(u.xp);

  if (newLevelInfo.level > oldLevel) {
    notify(userId, 'system', userId, {
      text: `🎉 Поздравляем! Вы достигли ${newLevelInfo.level} уровня (${newLevelInfo.rankTitle})!`,
    });
  }
  saveDb();
}

function registerLevelRoutes() {
  // Получить уровни и достижения пользователя
  route('GET', '/api/users/:id/level', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const u = db.users.find((x) => x.id === id);
    if (!u) throw new (require('../utils').HttpError)(404, 'Пользователь не найден');

    return { userLevel: calculateLevel(u.xp || 0) };
  });

  // Доска лидеров (Top XP)
  route('GET', '/api/leaderboard', {}, () => {
    const top = db.users
      .filter((u) => !u.system)
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar || '',
        color: u.color,
        levelInfo: calculateLevel(u.xp || 0),
      }))
      .sort((a, b) => b.levelInfo.xp - a.levelInfo.xp)
      .slice(0, 20);

    return { leaderboard: top };
  });
}

module.exports = {
  calculateLevel,
  addXp,
  registerLevelRoutes,
};
