import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const events = [], sent = [];
globalThis.__syntheticCron = { events, sent };
const base = new URL('..', import.meta.url);
const sources = {
  [new URL('db.js', base).href]: `
    export async function dbRun() { return { changes: 0 }; }
    export async function dbAll() { return [1, 2, null].map((owner, i) => ({
      id: i + 10, user_id: owner, email: 'synthetic@example.invalid',
      origin: 'AAA', destination: 'BBB', date: '2099-01-01', target_price: 100,
    })); }`,
  [new URL('flightSearch.js', base).href]: `export async function searchFlights() {
    return { options: [{ price: 50, flightLink: 'https://synthetic.invalid' }] }; }`,
  [new URL('sse.js', base).href]: `export function broadcastAlert(owner, data) {
    globalThis.__syntheticCron.events.push({ owner, data }); }`,
};
const hook = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'nodemailer') return { url: 'synthetic:nodemailer', shortCircuit: true };
  if (specifier === 'node-cron') return { url: 'synthetic:cron', shortCircuit: true };
  return nextResolve(specifier, context);
}, load(url, context, nextLoad) {
  let source = sources[url];
  if (url === 'synthetic:nodemailer') source = `export default {
    async createTestAccount() { return { user: 'synthetic', pass: 'synthetic' }; },
    createTransport() { return { async sendMail(mail) { globalThis.__syntheticCron.sent.push(mail); return {}; } }; },
    getTestMessageUrl() { return 'https://synthetic.invalid/email'; }
  };`;
  if (url === 'synthetic:cron') source = `export default { schedule() { throw new Error('No scheduled jobs in tests'); } };`;
  return source ? { source, format: 'module', shortCircuit: true } : nextLoad(url, context);
} });
const { checkPriceAlerts } = await import('../cron.js');
test('cron propagates database owner and alert ID without inferring legacy ownership', async () => {
  try {
    await checkPriceAlerts();
    assert.equal(sent.length, 3); // Existing legacy email behavior stays available.
    assert.deepEqual(events.map(event => event.owner), [1, 2, null]);
    assert.deepEqual(events.map(event => event.data.alertId), [10, 11, 12]);
  } finally { hook.deregister(); delete globalThis.__syntheticCron; }
});
