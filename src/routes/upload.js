'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');
const { route } = require('../router');
const { UPLOAD_DIR } = require('../db');
const { bad, HttpError, rateLimit, send } = require('../utils');

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;

const UPLOAD_TYPES = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
};

function checkMagic(file, ext) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(16);
  let n = 0;
  try {
    n = fs.readSync(fd, b, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (n < 12) return false;
  switch (ext) {
    case 'jpg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'png':
      return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'gif':
      return b.subarray(0, 3).toString('latin1') === 'GIF';
    case 'webp':
      return b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'mp4':
    case 'mov':
      return b.subarray(4, 8).toString('latin1') === 'ftyp' || ['moov', 'mdat', 'free', 'wide', 'skip', 'pnot'].includes(b.subarray(4, 8).toString('latin1'));
    case 'webm':
      return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    default:
      return false;
  }
}

function registerUploadRoutes() {
  route('POST', '/api/upload', { raw: true }, async (ctx) => {
    rateLimit('upload:' + ctx.user.id, 60, 3600 * 1000);
    const type = String(ctx.req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const info = UPLOAD_TYPES[type];
    if (!info) throw bad('Неподдерживаемый формат файла. Разрешены: jpg, png, webp, gif, mp4, webm, mov');
    const limit = info.kind === 'video' ? MAX_VIDEO : MAX_IMAGE;
    const declared = Number(ctx.req.headers['content-length'] || 0);
    if (declared > limit) throw new HttpError(413, `Файл слишком большой (максимум ${limit / 1024 / 1024} МБ)`);

    const name = crypto.randomBytes(12).toString('hex') + '.' + info.ext;
    const full = path.join(UPLOAD_DIR, name);
    let size = 0;
    const counter = new Transform({
      transform(chunk, _enc, cb) {
        size += chunk.length;
        if (size > limit) cb(new HttpError(413, `Файл слишком большой (максимум ${limit / 1024 / 1024} МБ)`));
        else cb(null, chunk);
      },
    });
    try {
      await pipeline(ctx.req, counter, fs.createWriteStream(full));
    } catch (e) {
      fs.unlink(full, () => {});
      throw e instanceof HttpError ? e : bad('Загрузка прервана, попробуйте ещё раз');
    }
    if (size === 0 || !checkMagic(full, info.ext)) {
      fs.unlink(full, () => {});
      throw bad('Файл повреждён или не соответствует своему формату');
    }
    send(ctx.res, 200, { url: '/uploads/' + name, kind: info.kind });
  });
}

module.exports = {
  registerUploadRoutes,
};
