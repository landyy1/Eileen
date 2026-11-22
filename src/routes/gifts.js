'use strict';

const { route } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { userById, areFriends } = require('./users');
const { publicUser, notify } = require('../realtime');
const { bad, HttpError, intParam, readJson, text } = require('../utils');
const { addXp } = require('./level');

const AVAILABLE_GIFTS = [
  { id: 'gift_box', icon: '🎁', name: 'Подарочный бокс' },
  { id: 'crown', icon: '👑', name: 'Золотая Корона' },
  { id: 'pizza', icon: '🍕', name: 'Вкусная Пицца' },
  { id: 'rocket', icon: '🚀', name: 'Космическая Ракета' },
  { id: 'diamond', icon: '💎', name: 'Драгоценный Алмаз' },
  { id: 'trophy', icon: '🏆', name: 'Кубок Победителя' },
  { id: 'heart', icon: '💖', name: 'Пламенное Сердце' },
  { id: 'star', icon: '⭐', name: 'Сияющая Звезда' },
];

function registerGiftRoutes() {
  db.userGifts = db.userGifts || [];

  // Каталог доступных подарков
  route('GET', '/api/gifts', {}, () => {
    return { gifts: AVAILABLE_GIFTS };
  });

  // Отправить подарок другу
  route('POST', '/api/gifts/send', {}, async (ctx) => {
    const b = await readJson(ctx.req);
    const me = ctx.user.id;
    const toUserId = intParam(b.toUserId);
    const giftId = String(b.giftId || '').trim();
    const giftInfo = AVAILABLE_GIFTS.find((g) => g.id === giftId);

    if (!giftInfo) throw bad('Неверный идентификатор подарка');
    const recipient = userById(toUserId);
    if (!recipient || recipient.system) throw new HttpError(404, 'Пользователь не найден');
    if (recipient.id === me) throw bad('Нельзя подарить подарок самому себе');

    const msg = text(b.message, { max: 100, label: 'Пожелание к подарку' });

    db.userGifts = db.userGifts || [];
    const giftItem = {
      id: nextId(),
      fromUserId: me,
      toUserId,
      giftId: giftInfo.id,
      icon: giftInfo.icon,
      name: giftInfo.name,
      message: msg,
      createdAt: Date.now(),
    };
    db.userGifts.push(giftItem);
    saveDb();

    // Уведомление и опыт
    notify(toUserId, 'system', me, {
      text: `Вам подарили ${giftInfo.icon} ${giftInfo.name}!${msg ? ` ("${msg}")` : ''}`,
    });
    addXp(me, 25);

    return { ok: true, gift: giftItem };
  });

  // Получить витрину подарков пользователя
  route('GET', '/api/users/:id/gifts', {}, (ctx) => {
    const userId = intParam(ctx.params.id);
    const u = userById(userId);
    if (!u || u.system) throw new HttpError(404, 'Пользователь не найден');

    db.userGifts = db.userGifts || [];
    const received = db.userGifts
      .filter((g) => g.toUserId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((g) => {
        const sender = userById(g.fromUserId);
        return {
          id: g.id,
          icon: g.icon,
          name: g.name,
          message: g.message,
          createdAt: g.createdAt,
          fromUser: sender ? publicUser(sender) : null,
        };
      });

    return { gifts: received };
  });
}

module.exports = {
  registerGiftRoutes,
};
