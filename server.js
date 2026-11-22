'use strict';
/*
 * Eileen — надёжный и модульный сервер социальной сети.
 * Работает на чистом Node.js (версия 18 или новее).
 *
 * Архитектура:
 *  - src/db.js: Безопасная СУБД с автоматическими бэкапами
 *  - src/utils.js: Защита (rate limit, scrypt, CSP, обработка ошибок)
 *  - src/realtime.js: Живой поток событий SSE и онлайн-статусы
 *  - src/routes/: Маршруты API (auth, users, friends, chats, posts, upload, grades)
 *  - src/static.js: Отдача файлов и сжатие Gzip
 */

const http = require('http');
const path = require('path');
const os = require('os');

const { loadDb, ensureSeed, flushDb, UPLOAD_DIR } = require('./src/db');
const { handleApi } = require('./src/router');
const { HttpError, send, sendStatusText } = require('./src/utils');
const { serveFile } = require('./src/static');

const { registerAuthRoutes } = require('./src/routes/auth');
const { registerUserRoutes } = require('./src/routes/users');
const { registerFriendRoutes } = require('./src/routes/friends');
const { registerChatRoutes } = require('./src/routes/chats');
const { registerPostRoutes, postView } = require('./src/routes/posts');
const { registerUploadRoutes } = require('./src/routes/upload');
const { registerGradeRoutes } = require('./src/routes/grades');
const { registerStreamRoute } = require('./src/routes/stream');
const { registerStoryRoutes } = require('./src/routes/stories');
const { registerAdminRoutes } = require('./src/routes/admin');
const { registerMusicRoutes } = require('./src/routes/music');
const { registerLevelRoutes } = require('./src/routes/level');
const { registerGiftRoutes } = require('./src/routes/gifts');
const { registerSocialRoutes } = require('./src/routes/social');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.resolve(__dirname, 'public');

// Инициализация базы данных
loadDb();
ensureSeed();

// Регистрация маршрутов API
registerAuthRoutes();
registerUserRoutes(postView);
registerFriendRoutes();
registerChatRoutes();
registerPostRoutes();
registerUploadRoutes();
registerGradeRoutes();
registerStreamRoute();
registerStoryRoutes();
registerAdminRoutes();
registerMusicRoutes();
registerLevelRoutes();
registerGiftRoutes();
registerSocialRoutes(postView);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...baseHeaders(), 'Access-Control-Max-Age': '86400' });
      res.end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Метод не поддерживается');
    if (p.startsWith('/uploads/')) {
      if (!serveFile(req, res, UPLOAD_DIR, p.slice('/uploads/'.length), true)) throw new HttpError(404, 'Файл не найден');
      return;
    }
    const rel = p === '/' ? 'index.html' : p.slice(1);
    if (serveFile(req, res, PUBLIC_DIR, rel, false)) return;
    if (!path.extname(rel)) {
      if (serveFile(req, res, PUBLIC_DIR, 'index.html', false)) return;
    }
    throw new HttpError(404, 'Страница не найдена');
  } catch (e) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (e instanceof HttpError) {
      const extra = {};
      if (e.status === 413) extra.Connection = 'close';
      if (e.retryAfter) extra['Retry-After'] = String(e.retryAfter);
      if (req.url && req.url.startsWith('/api/')) send(res, e.status, { error: e.message }, extra);
      else sendStatusText(res, e.status, e.message, extra);
    } else if (e instanceof URIError) {
      send(res, 400, { error: 'Неверный адрес' });
    } else {
      console.error(e);
      send(res, 500, { error: 'Внутренняя ошибка сервера' });
    }
  }
});

server.requestTimeout = 15 * 60 * 1000;
server.headersTimeout = 60 * 1000;

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nОШИБКА: порт ${PORT} уже занят. Закройте другую программу или запустите на другом порту:`);
    console.error(`  PORT=3001 node server.js   (Mac/Linux)\n  $env:PORT=3001; node server.js   (Windows PowerShell)\n`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('\n  Eileen запущен ✔ (модульный сервер с авто-бэкапами)');
  console.log(`  Открой в браузере на этом компьютере:  http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  С телефона в той же Wi-Fi сети:        http://${n.address}:${PORT}`);
    }
  }
  console.log('  Остановить: нажми Ctrl+C\n');
});

function shutdown() {
  flushDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Необработанная ошибка процесса:', err);
  flushDb();
});
process.on('unhandledRejection', (reason) => {
  console.error('Необработанный Promise rejection:', reason);
});
process.on('exit', () => {
  try {
    flushDb();
  } catch (_) {}
});

module.exports = { server };
