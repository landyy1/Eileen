'use strict';

const { route } = require('../router');
const { streams, userConnected, userDisconnected } = require('../realtime');
const { baseHeaders } = require('../utils');

function registerStreamRoute() {
  route('GET', '/api/stream', { raw: true }, (ctx) => {
    const { req, res, user } = ctx;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...baseHeaders(),
    });
    res.write('retry: 3000\n\n');
    res.write('event: hello\ndata: {}\n\n');
    let set = streams.get(user.id);
    if (!set) {
      set = new Set();
      streams.set(user.id, set);
    }
    set.add(res);
    userConnected(user.id);
    const hb = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (_) {
        /* закрыто */
      }
    }, 25000);
    res.on('close', () => {
      clearInterval(hb);
      set.delete(res);
      if (set.size === 0) {
        streams.delete(user.id);
        userDisconnected(user.id);
      }
    });
    void req;
  });
}

module.exports = {
  registerStreamRoute,
};
