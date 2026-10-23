// Connections remain private; ownership comes only from verified JWT claims.
const clients = new Set();
const validOwner = id => Number.isSafeInteger(id) && id > 0;

export function addClient(res, user) {
  if (!validOwner(user?.id) || !Number.isSafeInteger(user.exp) || user.exp <= Date.now() / 1000) {
    res.end();
    return;
  }
  const client = { res, userId: user.id, expiresAt: user.exp * 1000 };
  let expiry;
  let heartbeat;
  const cleanup = () => {
    clients.delete(client);
    clearTimeout(expiry);
    clearInterval(heartbeat);
    res.off('close', cleanup);
    res.off('error', close);
  };
  const close = () => {
    cleanup();
    res.end();
  };
  client.close = close;
  // Reschedule long lifetimes instead of overflowing Node's maximum timer delay.
  const expire = () => {
    const remaining = client.expiresAt - Date.now();
    if (remaining <= 0) return close();
    expiry = setTimeout(expire, Math.min(remaining, 2 ** 31 - 1));
    expiry.unref?.();
  };
  clients.add(client);
  res.on('close', cleanup);
  res.on('error', close);
  expire();
  heartbeat = setInterval(() => {
    if (Date.now() >= client.expiresAt || res.destroyed || res.writableEnded) return close();
    if (!res.write(': keepalive\n\n')) close();
  }, 30000);
  heartbeat.unref?.();
}

export function broadcastAlert(userId, data) {
  // Legacy alerts without an owner can still be emailed, but never reach a stream.
  if (!validOwner(userId)) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client.userId !== userId) continue;
    if (Date.now() >= client.expiresAt || client.res.destroyed || client.res.writableEnded) {
      client.close();
      continue;
    }
    if (!client.res.write(payload)) client.close();
  }
}
