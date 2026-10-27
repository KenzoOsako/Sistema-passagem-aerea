import test from 'node:test';
import assert from 'node:assert/strict';
import { startAlertSession, readAlertStream } from './alertSession.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const options = extras => ({ apiUrl: 'https://synthetic.invalid', token: 'synthetic-token',
  onAlerts() {}, onAlert() {}, onUnauthorized() {}, retryMs: 5, ...extras });
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('no network connection before login', async () => {
  let calls = 0;
  const stop = startAlertSession(options({ token: '', fetchImpl: () => { calls++; } }));
  await tick(); stop(); assert.equal(calls, 0);
});

test('owned requests carry bearer headers, never URL credentials; logout cancels the reader', async () => {
  const calls = [], events = [];
  let streamController, cancelled = false;
  const stop = startAlertSession(options({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/alerts')) return json([]);
      return new Response(new ReadableStream({ start(c) { streamController = c; }, cancel() { cancelled = true; } }), {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }, onAlert: event => events.push(event),
  }));
  await tick();
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(call.url.includes('synthetic-token'), false);
  }
  streamController.enqueue(new TextEncoder().encode('data: {"type":"ALERT","alertId":1}\n\n'));
  await tick(); assert.equal(events.length, 1);
  stop(); await tick(); assert.equal(cancelled, true);
  assert.equal(calls.length, 2);
});

test('logout/account switch ignores a pending response from the old account', async () => {
  let release;
  const alerts = [];
  const stop = startAlertSession(options({ fetchImpl: () => new Promise(resolve => { release = resolve; }),
    onAlerts: data => alerts.push(data) }));
  stop(); release(json([{ id: 'old-account' }]));
  await tick(); assert.deepEqual(alerts, []);
});

test('authentication rejection stops reconnect and notifies once', async () => {
  for (const status of [401, 403]) {
    let calls = 0, unauthorized = 0;
    const stop = startAlertSession(options({ fetchImpl: async () => { calls++; return new Response('', { status }); },
      onUnauthorized: () => unauthorized++ }));
    await tick(); await tick(); stop();
    assert.equal(calls, 1); assert.equal(unauthorized, 1);
  }
});

test('transient failures reconnect; logout cancels a pending retry', async () => {
  let calls = 0, unauthorized = 0;
  const stop = startAlertSession(options({ fetchImpl: async () => { calls++; return new Response('', { status: 503 }); },
    onUnauthorized: () => unauthorized++ }));
  await tick(); assert.ok(calls > 1); assert.equal(unauthorized, 0);
  stop(); const stoppedAt = calls; await tick(); assert.equal(calls, stoppedAt);
});

test('parser preserves split Unicode, CRLF, multiline data and ignores keepalives/malformed events', async () => {
  const bytes = new TextEncoder().encode(': keepalive\r\n\r\ndata: invalid\r\n\r\ndata: {"type":"ALERT",\r\ndata: "label":"São Paulo"}\r\n\r\n');
  const events = [];
  const body = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  await readAlertStream(body, new AbortController().signal, event => events.push(event));
  assert.deepEqual(events, [{ type: 'ALERT', label: 'São Paulo' }]);
});

test('a stale unauthorized result cannot log out the replacement session', async () => {
  let release, unauthorized = 0;
  const stop = startAlertSession(options({ fetchImpl: () => new Promise(resolve => { release = resolve; }),
    onUnauthorized: () => unauthorized++ }));
  stop(); release(new Response('', { status: 403 })); await tick();
  assert.equal(unauthorized, 0);
});
