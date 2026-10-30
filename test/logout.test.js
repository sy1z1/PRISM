import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogoutHandler } from '../src/modules/identity/identity.controller.js';

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

test('logout revokes only the server-validated current session', async () => {
  const calls = [];
  const handler = createLogoutHandler({
    revokeSession: async (args) => {
      calls.push(args);
      return { id: 'session-row' };
    }
  });

  const req = {
    user: { userId: 'user-a' },
    auth: { sessionId: 'session-a' },
    // A client-supplied id must be ignored.
    body: { sessionId: 'attacker-session' }
  };
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [{ sessionId: 'session-a', userId: 'user-a' }]);
  assert.equal('sessionId' in res.body, false);
});

test('logout reports an already-inactive session without failing', async () => {
  const handler = createLogoutHandler({ revokeSession: async () => null });
  const req = { user: { userId: 'user-a' }, auth: { sessionId: 'session-a' } };
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Session is already inactive.');
});

test('logout returns 401 when no server-validated session context exists', async () => {
  const handler = createLogoutHandler({ revokeSession: async () => ({ id: 'x' }) });
  const req = { user: { userId: 'user-a' } };
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 401);
});

test('logout returns 500 without leaking details when revocation fails', async () => {
  const handler = createLogoutHandler({
    revokeSession: async () => {
      throw new Error('database unavailable: secret detail');
    }
  });
  const req = { user: { userId: 'user-a' }, auth: { sessionId: 'session-a' } };
  const res = makeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('secret detail'), false);
});
