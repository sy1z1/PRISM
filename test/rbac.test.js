import test from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../src/middlewares/rbac.guard.js';
import { ROLES } from '../src/modules/authorization/policy.js';

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

test('requireRole allows an authorized role', () => {
  const req = { user: { userId: 'u1', role: ROLES.COUNCIL_ADMIN, roles: [ROLES.COUNCIL_ADMIN] } };
  const res = makeRes();
  let nextCalled = false;

  requireRole([ROLES.COUNCIL_ADMIN])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('requireRole denies a non-authorized role with 403', () => {
  const req = { user: { userId: 'u1', role: ROLES.MAINTENANCE_WORKER, roles: [ROLES.MAINTENANCE_WORKER] } };
  const res = makeRes();
  let nextCalled = false;

  requireRole([ROLES.COUNCIL_ADMIN])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('requireRole returns 401 when no trusted actor is present', () => {
  const req = {};
  const res = makeRes();
  let nextCalled = false;

  requireRole([ROLES.COUNCIL_ADMIN])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('requireRole treats an empty allow-list as deny-by-default', () => {
  const req = { user: { userId: 'u1', role: ROLES.SUPER_ADMIN, roles: [ROLES.SUPER_ADMIN] } };
  const res = makeRes();
  let nextCalled = false;

  requireRole([])(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
