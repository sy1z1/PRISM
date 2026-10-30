import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';

const { requireAuth } = await import('../src/middlewares/auth.guard.js');

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
};

const run = async (req) => {
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

test('requireAuth rejects a missing Authorization header', async () => {
  const { res, nextCalled } = await run({ headers: {} });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth rejects a malformed token', async () => {
  const { res, nextCalled } = await run({ headers: { authorization: 'Bearer not-a-jwt' } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireAuth rejects a token that is not session-bound (no sid)', async () => {
  const token = jwt.sign(
    { userId: 'u1', email: 'user@example.test', role: 'Council Admin' },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  const { res, nextCalled } = await run({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});
