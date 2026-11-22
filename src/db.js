'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SESSION_TTL = 90 * 24 * 3600 * 1000; // 90 дней

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

let db = {
  seq: 1,
  users: [],
  sessions: [],
  friendships: [],
  messages: [],
  posts: [],
  grades: [],
  notifications: [],
};

function createBackup() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(BACKUP_DIR, `db-${dateStr}.json`);
    fs.copyFileSync(DB_FILE, backupPath);

    // Удаляем старые бэкапы (оставляем только 24 самых свежих)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('db-') && f.endsWith('.json'))
      .map((f) => path.join(BACKUP_DIR, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

    if (files.length > 24) {
      for (const oldFile of files.slice(24)) {
        try { fs.unlinkSync(oldFile); } catch (_) {}
      }
    }
  } catch (e) {
    console.error('Ошибка создания бэкапа:', e.message);
  }
}

function loadDb() {
  let raw;
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('\nОШИБКА: файл базы данных повреждён: ' + DB_FILE);
    console.error('Сделайте его копию и удалите/исправьте файл, потом запустите снова.\n');
    process.exit(1);
  }
  db = Object.assign(db, parsed);
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => now - s.createdAt < SESSION_TTL);

  // Создаем бэкап при успешной загрузке
  createBackup();
}

let saveTimer = null;
function writeDbNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

function saveDb() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeDbNow();
    } catch (e) {
      console.error('Не удалось сохранить базу данных:', e.message);
    }
  }, 200);
}

function flushDb() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    writeDbNow();
  } catch (e) {
    console.error('Не удалось сохранить базу данных:', e.message);
  }
}

const nextId = () => db.seq++;

function ensureSeed() {
  for (const u of db.users) {
    if (u.system && u.username === 'dostar') {
      u.username = 'eileen';
      u.name = 'Eileen';
      saveDb();
    }
  }
  if (db.posts.length > 0) return;
  let sys = db.users.find((u) => u.system);
  if (!sys) {
    sys = {
      id: nextId(),
      username: 'eileen',
      name: 'Eileen',
      bio: 'Команда приложения',
      avatar: '',
      color: '#c85f32',
      diaryUrl: '',
      passHash: 'x:x',
      system: true,
      createdAt: Date.now(),
    };
    db.users.push(sys);
  }
  const samples = [
    ['Добро пожаловать в Eileen.\nЛента бесконечная — просто листайте вверх.', 0],
    ['Добавляй друзей во вкладке «Друзья» и переписывайся с ними в «Чатах» 💬', 1],
    ['Во вкладке «Оценки» можно вести свой дневник и считать средний балл 📚', 2],
    ['Нажми «+» и опубликуй своё видео, фото или текст ✨', 3],
  ];
  const now = Date.now();
  samples.forEach(([caption, bg], i) => {
    db.posts.push({ id: nextId(), userId: sys.id, kind: 'text', caption, mediaUrl: '', bg, createdAt: now - i * 1000, likes: [], comments: [] });
  });
  saveDb();
}

// Запускаем бэкап каждые 60 минут
setInterval(() => createBackup(), 60 * 60 * 1000).unref();

module.exports = {
  db,
  loadDb,
  saveDb,
  flushDb,
  nextId,
  ensureSeed,
  DATA_DIR,
  UPLOAD_DIR,
  BACKUP_DIR,
  DB_FILE,
  SESSION_TTL,
};
