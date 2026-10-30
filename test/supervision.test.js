import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  canReadTicket,
  isSelfVerification
} from '../src/modules/authorization/policy.js';

test('management reads only within its own organization', () => {
  const management = { role: ROLES.COUNCIL_ADMIN, roles: [ROLES.COUNCIL_ADMIN], organizationId: 'org-a' };
  const ticket = { organizationId: 'org-a', maintenanceGroupId: 'group-1' };
  assert.equal(canReadTicket(management, ticket, []), true);
  assert.equal(canReadTicket(management, { ...ticket, organizationId: 'org-b' }, []), false);
});

test('non-management reads require active supervision of the ticket group', () => {
  const supervisor = { role: ROLES.MAINTENANCE_WORKER, roles: [ROLES.MAINTENANCE_WORKER], organizationId: 'org-a' };
  const ticket = { organizationId: 'org-a', maintenanceGroupId: 'group-1' };
  assert.equal(canReadTicket(supervisor, ticket, ['group-1']), true);
  assert.equal(canReadTicket(supervisor, ticket, ['group-2']), false);
  assert.equal(canReadTicket(supervisor, { ...ticket, maintenanceGroupId: null }, ['group-1']), false);
});

test('self-verification detects reporter, assignee, acknowledger, completer, prior verifier', () => {
  const actor = 'user-1';

  assert.equal(isSelfVerification(actor, { reportedBy: actor }), true);
  assert.equal(isSelfVerification(actor, { assigneeIds: [actor] }), true);
  assert.equal(isSelfVerification(actor, { acknowledgedBy: actor }), true);
  assert.equal(isSelfVerification(actor, { completedBy: actor }), true);
  assert.equal(isSelfVerification(actor, { verifiedBy: actor }), true);
  assert.equal(isSelfVerification(actor, {
    reportedBy: 'user-2',
    assigneeIds: ['user-3'],
    acknowledgedBy: 'user-4',
    completedBy: 'user-5',
    verifiedBy: 'user-6'
  }), false);
});

test('a distinct verifier is allowed', () => {
  assert.equal(isSelfVerification('verifier-1', {
    reportedBy: 'reporter',
    assigneeIds: ['worker'],
    acknowledgedBy: 'supervisor-a',
    completedBy: 'supervisor-b'
  }), false);
});
