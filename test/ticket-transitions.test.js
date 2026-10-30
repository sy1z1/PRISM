import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKET_STATUS,
  TRANSITIONS,
  canTransition,
  isTerminalStatus
} from '../src/modules/tickets/ticket-transitions.js';

test('happy-path lifecycle transitions are allowed', () => {
  assert.equal(canTransition(TICKET_STATUS.ASSIGNED, TICKET_STATUS.ACKNOWLEDGED), true);
  assert.equal(canTransition(TICKET_STATUS.ACKNOWLEDGED, TICKET_STATUS.IN_PROGRESS), true);
  assert.equal(canTransition(TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.PENDING_VERIFICATION), true);
  assert.equal(canTransition(TICKET_STATUS.PENDING_VERIFICATION, TICKET_STATUS.APPROVED), true);
  assert.equal(canTransition(TICKET_STATUS.PENDING_VERIFICATION, TICKET_STATUS.IN_PROGRESS), true);
});

test('terminal and reopen transitions', () => {
  assert.equal(canTransition(TICKET_STATUS.APPROVED, TICKET_STATUS.ASSIGNED), true);
  assert.equal(canTransition(TICKET_STATUS.CANCELLED, TICKET_STATUS.ASSIGNED), true);
  assert.equal(canTransition(TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CANCELLED), true);
  assert.equal(canTransition(TICKET_STATUS.PENDING_VERIFICATION, TICKET_STATUS.CANCELLED), true);
});

test('invalid transitions are rejected', () => {
  assert.equal(canTransition(TICKET_STATUS.OPEN, TICKET_STATUS.APPROVED), false);
  assert.equal(canTransition(TICKET_STATUS.ASSIGNED, TICKET_STATUS.IN_PROGRESS), false);
  assert.equal(canTransition(TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.APPROVED), false);
  assert.equal(canTransition(TICKET_STATUS.APPROVED, TICKET_STATUS.ACKNOWLEDGED), false);
  assert.equal(canTransition('UNKNOWN', TICKET_STATUS.ASSIGNED), false);
});

test('terminal status helper', () => {
  assert.equal(isTerminalStatus(TICKET_STATUS.APPROVED), true);
  assert.equal(isTerminalStatus(TICKET_STATUS.CANCELLED), true);
  assert.equal(isTerminalStatus(TICKET_STATUS.PENDING_VERIFICATION), false);
});

test('transition table contains no duplicate targets per source', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    assert.equal(new Set(targets).size, targets.length, `duplicate target for ${from}`);
  }
});
