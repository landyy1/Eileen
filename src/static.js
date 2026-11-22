'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { bad, HttpError, MIME, baseHeaders } = require('./utils');

const GZ_CACHE = new Map();

function serveFile(req, res, baseDir, rel, immutable) {
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch (_) {
    throw bad('Неверный путь');
  }
  if (decoded.includes('\0')) throw bad('Неверный путь');
  const full = path.resolve(baseDir, decoded);
  if (full !== baseDir && !full.startsWith(baseDir + path.sep)) throw new HttpError(403, 'Доступ запрещён');
  let st;
  try {
    st = fs.statSync(full);
  } catch (_) {
    return false;
  }
  if (!st.isFile()) return false;

  const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
  const headers = Object.assign(
    {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
    baseHeaders()
  );

  if (st.size === 0) {
    headers['Content-Length'] = 0;
    res.writeHead(200, headers);
    res.end();
    return true;
  }

  // Сжатие текстовых файлов (JS/CSS/HTML/JSON)
  if (!req.headers.range && /^(text\/|application\/(javascript|json|manifest))/.test(type) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const key = full + ':' + st.mtimeMs + ':' + st.size;
    let gz = GZ_CACHE.get(key);
    if (!gz) {
      gz = zlib.gzipSync(fs.readFileSync(full), { level: 9 });
      if (GZ_CACHE.size > 50) GZ_CACHE.clear();
      GZ_CACHE.set(key, gz);
    }
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = gz.length;
    headers['Vary'] = 'Accept-Encoding';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end(); else res.end(gz);
    return true;
  }

  let start = 0;
  let end = st.size - 1;
  let status = 200;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    let ok = !!m && !(m[1] === '' && m[2] === '');
    if (ok) {
      if (m[1] === '') {
        const n = parseInt(m[2], 10);
        start = Math.max(0, st.size - n);
      } else {
        start = parseInt(m[1], 10);
        if (m[2] !== '') end = Math.min(parseInt(m[2], 10), st.size - 1);
      }
      if (start > end || start >= st.size) ok = false;
    }
    if (!ok) {
      res.writeHead(416, Object.assign({ 'Content-Range': `bytes */${st.size}` }, baseHeaders()));
      res.end();
      return true;
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(full, { start, end })
    .on('error', () => res.destroy())
    .pipe(res);
  return true;
}

module.exports = {
  serveFile,
};
