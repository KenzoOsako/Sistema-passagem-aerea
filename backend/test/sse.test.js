import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { addClient, broadcastAlert } from '../sse.js';

function response() {
  const res = new EventEmitter();
  res.events = [];
  res.write = data => { res.events.push(data); return true; };
  res.end = () => { res.writableEnded = true; res.emit('close'); };
  return res;
}
const user = id => ({ id, exp: Math.floor(Date.now() / 1000) + 60 });

test('events reach only the verified owner, including multiple tabs', () => {
  const a = response(), aTab = response(), b = response();
  addClient(a, user(1)); addClient(aTab, user(1)); addClient(b, user(2));
  broadcastAlert(1, { type: 'ALERT', alertId: 17 });
  assert.equal(a.events.length, 1);
  assert.equal(aTab.events.length, 1);
  assert.equal(b.events.length, 0);
  a.end(); aTab.end(); b.end();
});

test('legacy, string, missing and invalid owners never broadcast', () => {
  const a = response(); addClient(a, user(1));
  for (const owner of [undefined, null, '1', 0, -1, 1.5]) broadcastAlert(owner, { type: 'ALERT' });
  assert.deepEqual(a.events, []);
  a.end();
});

test('invalid or expired connections are rejected; disconnect removes delivery', () => {
  for (const identity of [undefined, { id: '1', exp: user(1).exp }, { id: 1 }, { id: 1, exp: 1 }]) {
    const res = response(); addClient(res, identity); assert.equal(res.writableEnded, true);
  }
  const res = response(); addClient(res, user(1)); res.end();
  broadcastAlert(1, { type: 'ALERT' }); assert.deepEqual(res.events, []);
});

test('open connections close at expiry and stop receiving events', async () => {
  const res = response();
  addClient(res, { id: 1, exp: Math.floor(Date.now() / 1000) + 1 });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(res.writableEnded, true);
  broadcastAlert(1, { type: 'ALERT' }); assert.deepEqual(res.events, []);
});

test('a slow client is closed instead of accumulating an unbounded write queue', () => {
  const res = response(); res.write = () => false;
  addClient(res, user(1)); broadcastAlert(1, { type: 'ALERT' });
  assert.equal(res.writableEnded, true);
});
