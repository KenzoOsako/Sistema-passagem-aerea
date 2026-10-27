import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import jwt from 'jsonwebtoken';

const secret = 'synthetic-test-key-only-'.repeat(3);
process.env.JWT_SECRET = secret;
const { generateToken, authenticateToken } = await import('../auth.js');
function authenticate(header) {
  const req = { headers: { authorization: header } };
  const result = {};
  const res = { status(code) { result.status = code; return this; }, json() {} };
  authenticateToken(req, res, () => { result.user = req.user; });
  return result;
}

test('missing, empty, short and padded signing keys fail closed on import', () => {
  for (const key of [undefined, '', ' ', 'short', ` ${secret}`, `${secret} `]) {
    const env = { ...process.env, DOTENV_CONFIG_PATH: '/nonexistent/synthetic.env' };
    if (key === undefined) delete env.JWT_SECRET;
    else env.JWT_SECRET = key;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import './auth.js'"], {
      cwd: new URL('..', import.meta.url), env, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Configure JWT_SECRET/);
  }
});

test('generated sessions preserve numeric identity and bearer case compatibility', () => {
  const token = generateToken({ id: 1, username: 'synthetic' });
  assert.equal(authenticate(`Bearer ${token}`).user.id, 1);
  assert.equal(authenticate(`bearer ${token}`).user.id, 1);
});

test('wrong signature, expired token and alternate algorithm cannot authenticate', () => {
  for (const token of [
    jwt.sign({ id: 1 }, 'different-synthetic-key', { expiresIn: '1h' }),
    jwt.sign({ id: 1 }, secret, { expiresIn: -1 }),
    jwt.sign({ id: 1 }, secret, { algorithm: 'HS384', expiresIn: '1h' }),
    'not.a.token',
  ]) assert.equal(authenticate(`Bearer ${token}`).status, 403);
});

test('missing and malformed identity or lifetime never reaches an owned handler', () => {
  for (const id of [undefined, null, '1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const token = jwt.sign({ id }, secret, { expiresIn: '1h' });
    assert.equal(authenticate(`Bearer ${token}`).status, 403);
    assert.throws(() => generateToken({ id }));
  }
  assert.equal(authenticate(`Bearer ${jwt.sign({ id: 1 }, secret)}`).status, 403);
});

test('bearer parser rejects extra tokens and alternate schemes', () => {
  const token = generateToken({ id: 1 });
  for (const header of [undefined, '', token, `Basic ${token}`, `Bearer ${token} extra`, `Bearer  ${token}`]) {
    assert.equal(authenticate(header).status, 401);
  }
});
