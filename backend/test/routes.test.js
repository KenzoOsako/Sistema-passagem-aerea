import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'synthetic-route-secret-'.repeat(3);
// Use the real schema and SQL with an in-memory database, never a developer database.
const hook = registerHooks({ load(url, context, nextLoad) {
  if (url === new URL('../db.js', import.meta.url).href) {
    return { format: 'module', shortCircuit: true, source: readFileSync(new URL(url), 'utf8')
      .replace("path.resolve(__dirname, 'database.sqlite')", "':memory:'") };
  }
  if (url === new URL('../cron.js', import.meta.url).href) {
    return { format: 'module', shortCircuit: true,
      source: "export function startCron() { throw new Error('Scheduler must not start in route tests'); }" };
  }
  if (url === new URL('../flightSearch.js', import.meta.url).href) {
    return { format: 'module', shortCircuit: true,
      source: "export function searchFlights() { throw new Error('No providers in route tests'); }" };
  }
  return nextLoad(url, context);
} });
const { app } = await import('../index.js');
const { default: db } = await import('../db.js');
const { broadcastAlert } = await import('../sse.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test('real registration, login, owned CRUD and authenticated stream admission', async () => {
  const request = (path, token, options = {}) => fetch(`${base}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const createUser = async username => {
    const res = await request('/api/register', '', { method: 'POST', body: JSON.stringify({ username, password: 'synthetic-password-only' }) });
    assert.equal(res.status, 200); return (await res.json()).token;
  };
  try {
    assert.equal((await request('/api/health')).status, 200);
    const a = await createUser('synthetic-a'), b = await createUser('synthetic-b');
    const login = await request('/api/login', '', { method: 'POST', body: JSON.stringify({ username: 'synthetic-a', password: 'synthetic-password-only' }) });
    assert.equal(login.status, 200); assert.ok((await login.json()).token);
    for (const path of ['/api/alerts', '/api/stream']) {
      assert.equal((await request(path)).status, 401);
      const forged = jwt.sign({ id: 1 }, 'wrong-synthetic-key', { expiresIn: '1h' });
      assert.equal((await request(path, forged)).status, 403);
    }
    const created = await request('/api/alerts', a, { method: 'POST', body: JSON.stringify({ email: 'synthetic@example.invalid', origin: 'AAA', destination: 'BBB', date: '2099-01-01', targetPrice: 100 }) });
    assert.equal(created.status, 200); const { id } = await created.json();
    assert.equal((await (await request('/api/alerts', a)).json()).length, 1);
    assert.deepEqual(await (await request('/api/alerts', b)).json(), []);
    await request(`/api/alerts/${id}`, b, { method: 'DELETE' });
    assert.equal((await (await request('/api/alerts', a)).json()).length, 1);
    const abort = new AbortController();
    const stream = await request('/api/stream', a, { signal: abort.signal });
    assert.equal(stream.status, 200); assert.match(stream.headers.get('content-type'), /text\/event-stream/);
    const reader = stream.body.getReader();
    broadcastAlert(1, { type: 'ALERT', alertId: id });
    const event = await reader.read();
    assert.match(new TextDecoder().decode(event.value), /"alertId"/);
    abort.abort(); await reader.cancel().catch(() => {});
    await request(`/api/alerts/${id}`, a, { method: 'DELETE' });
    assert.deepEqual(await (await request('/api/alerts', a)).json(), []);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));
    hook.deregister();
  }
});
