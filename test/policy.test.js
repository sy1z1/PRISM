import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  canAccessOrganization,
  evaluateSession,
  getOrganizationScope,
  hasAnyRole,
  isAccountActive,
  isSelfVerification,
  resolveSingleRole,
  toActor
} from '../src/modules/authorization/policy.js';

test('isAccountActive accepts active case-insensitively and rejects others', () => {
  assert.equal(isAccountActive('Active'), true);
  assert.equal(isAccountActive(' active '), true);
  assert.equal(isAccountActive('Disabled'), false);
  assert.equal(isAccountActive(null), false);
  assert.equal(isAccountActive(undefined), false);
});

test('resolveSingleRole enforces exactly one role', () => {
  assert.deepEqual(resolveSingleRole(['Council Admin']), { ok: true, role: 'Council Admin' });
  assert.deepEqual(resolveSingleRole(['Council Admin', 'Council Admin']), {
    ok: true,
    role: 'Council Admin'
  });
  assert.deepEqual(resolveSingleRole([]), { ok: false, reason: 'NO_ROLE_ASSIGNED' });
  assert.deepEqual(resolveSingleRole(['Council Admin', 'SuperAdmin']), {
    ok: false,
    reason: 'AMBIGUOUS_ROLE'
  });
});

test('hasAnyRole is deny-by-default', () => {
  const user = { role: ROLES.COUNCIL_ADMIN, roles: [ROLES.COUNCIL_ADMIN] };
  assert.equal(hasAnyRole(user, [ROLES.COUNCIL_ADMIN]), true);
  assert.equal(hasAnyRole(user, [ROLES.SUPER_ADMIN]), false);
  assert.equal(hasAnyRole(user, []), false);
  assert.equal(hasAnyRole(null, [ROLES.COUNCIL_ADMIN]), false);
});

test('canAccessOrganization honors SuperAdmin and exact org match', () => {
  const supervisor = {
    role: ROLES.COUNCIL_ADMIN,
    roles: [ROLES.COUNCIL_ADMIN],
    organizationId: 'org-a'
  };
  assert.equal(canAccessOrganization(supervisor, 'org-a'), true);
  assert.equal(canAccessOrganization(supervisor, 'org-b'), false);
  assert.equal(canAccessOrganization(supervisor, null), false);

  const superAdmin = { role: ROLES.SUPER_ADMIN, roles: [ROLES.SUPER_ADMIN] };
  assert.equal(canAccessOrganization(superAdmin, 'org-b'), true);
  assert.equal(canAccessOrganization(superAdmin, null), true);
});

test('getOrganizationScope returns null for SuperAdmin and undefined for org-less users', () => {
  assert.equal(getOrganizationScope({ role: ROLES.SUPER_ADMIN, roles: [ROLES.SUPER_ADMIN] }), null);
  assert.equal(
    getOrganizationScope({ role: ROLES.COUNCIL_ADMIN, roles: [ROLES.COUNCIL_ADMIN], organizationId: 'org-a' }),
    'org-a'
  );
  assert.equal(
    getOrganizationScope({ role: ROLES.COUNCIL_ADMIN, roles: [ROLES.COUNCIL_ADMIN] }),
    undefined
  );
});

test('evaluateSession rejects missing, revoked, expired, and inactive sessions', () => {
  const now = new Date('2026-10-29T00:00:00Z');
  const future = new Date('2026-10-29T01:00:00Z');
  const past = new Date('2026-10-28T23:00:00Z');

  assert.equal(evaluateSession(null, now).reason, 'SESSION_NOT_FOUND');
  assert.equal(
    evaluateSession({ revoked_at: new Date(), expires_at: future, acc_status: 'Active' }, now).reason,
    'SESSION_REVOKED'
  );
  assert.equal(
    evaluateSession({ revoked_at: null, expires_at: past, acc_status: 'Active' }, now).reason,
    'SESSION_EXPIRED'
  );
  assert.equal(
    evaluateSession({ revoked_at: null, expires_at: future, acc_status: 'Disabled' }, now).reason,
    'ACCOUNT_INACTIVE'
  );
  assert.deepEqual(
    evaluateSession({ revoked_at: null, expires_at: future, acc_status: 'Active' }, now),
    { ok: true }
  );
});

test('isSelfVerification detects reporter and active assignee', () => {
  assert.equal(isSelfVerification('u1', { reportedBy: 'u1', assigneeIds: [] }), true);
  assert.equal(isSelfVerification('u1', { reportedBy: 'u2', assigneeIds: ['u1'] }), true);
  assert.equal(isSelfVerification('u1', { reportedBy: 'u2', assigneeIds: ['u3'] }), false);
  assert.equal(isSelfVerification(null, { reportedBy: null, assigneeIds: [] }), false);
});

test('toActor exposes resolved roles and organization', () => {
  const actor = toActor({
    user_id: 'u1',
    email: 'someone@example.test',
    acc_status: 'Active',
    organization_id: 'org-a',
    roles: ['Council Admin']
  });
  assert.equal(actor.userId, 'u1');
  assert.equal(actor.role, 'Council Admin');
  assert.deepEqual(actor.roles, ['Council Admin']);
  assert.equal(actor.organizationId, 'org-a');
});
