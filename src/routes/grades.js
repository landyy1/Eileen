'use strict';

const { route } = require('../router');
const { db, saveDb, nextId } = require('../db');
const { bad, HttpError, text, intParam, readJson } = require('../utils');

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseGrade(raw, prefix) {
  const p = prefix || '';
  if (raw === null || typeof raw !== 'object') throw bad(p + 'неверный формат');
  const subject = text(raw.subject, { min: 1, max: 60, label: p + 'Предмет' });
  const max = raw.max === undefined || raw.max === null || raw.max === '' ? 5 : Number(raw.max);
  if (!Number.isFinite(max) || max <= 0 || max > 1000) throw bad(p + 'максимальный балл должен быть числом от 1 до 1000');
  const score = typeof raw.score === 'string' ? Number(raw.score.replace(',', '.')) : Number(raw.score);
  if (raw.score === '' || raw.score === null || raw.score === undefined || !Number.isFinite(score)) throw bad(p + 'оценка должна быть числом');
  if (score < 0 || score > max) throw bad(p + 'оценка должна быть от 0 до ' + max);
  const date = raw.date === undefined || raw.date === '' ? new Date().toISOString().slice(0, 10) : raw.date;
  if (!validDate(date)) throw bad(p + 'дата должна быть в формате ГГГГ-ММ-ДД');
  const note = text(raw.note, { max: 120, label: p + 'Заметка' });
  return { subject, score: Math.round(score * 100) / 100, max, date, note };
}

function registerGradeRoutes() {
  route('GET', '/api/grades', {}, (ctx) => {
    const list = db.grades
      .filter((g) => g.userId === ctx.user.id)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
      .map((g) => ({ id: g.id, subject: g.subject, score: g.score, max: g.max, date: g.date, note: g.note }));
    return { grades: list };
  });

  route('POST', '/api/grades', {}, async (ctx) => {
    const b = await readJson(ctx.req, 1024 * 1024);
    const rawItems = Array.isArray(b.items) ? b.items : [b];
    if (rawItems.length === 0) throw bad('Нет данных');
    if (rawItems.length > 500) throw bad('За один раз можно добавить не больше 500 оценок');
    const parsed = rawItems.map((r, i) => parseGrade(r, rawItems.length > 1 ? `Строка ${i + 1}: ` : ''));
    const mine = db.grades.filter((g) => g.userId === ctx.user.id).length;
    if (mine + parsed.length > 5000) throw bad('Слишком много оценок (максимум 5000)');
    const created = parsed.map((g) => {
      const row = Object.assign({ id: nextId(), userId: ctx.user.id }, g);
      db.grades.push(row);
      return { id: row.id, subject: row.subject, score: row.score, max: row.max, date: row.date, note: row.note };
    });
    saveDb();
    return { grades: created };
  });

  route('DELETE', '/api/grades/:id', {}, (ctx) => {
    const id = intParam(ctx.params.id);
    const g = db.grades.find((x) => x.id === id && x.userId === ctx.user.id);
    if (!g) throw new HttpError(404, 'Оценка не найдена');
    db.grades = db.grades.filter((x) => x !== g);
    saveDb();
    return { ok: true };
  });
}

module.exports = {
  registerGradeRoutes,
};
