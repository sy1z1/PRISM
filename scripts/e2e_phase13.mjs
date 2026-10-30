// Live Phase 1-3 verification. Requires a running backend and E2E_* env vars.
// Usage:
//   $env:E2E_SA_EMAIL='...'; $env:E2E_SA_PASSWORD='...'; ...
//   node --env-file=.env scripts/e2e_phase13.mjs

import pg from 'pg';

const { Client } = pg;

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const SA_EMAIL = process.env.E2E_SA_EMAIL;
const SA_PASSWORD = process.env.E2E_SA_PASSWORD;
const SUP_EMAIL = process.env.E2E_SUP_EMAIL;
const SUP_PASSWORD = process.env.E2E_SUP_PASSWORD;

if (!SA_EMAIL || !SA_PASSWORD || !SUP_EMAIL || !SUP_PASSWORD) {
  console.error('Missing E2E_SA_EMAIL / E2E_SA_PASSWORD / E2E_SUP_EMAIL / E2E_SUP_PASSWORD.');
  process.exit(2);
}

let failures = 0;
const check = (condition, label, detail = '') => {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` :: ${detail}` : ''}`);
  }
};

const request = async (path, { token, method = 'GET', body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined)
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, json, headers: response.headers };
};

const login = async (email, password) => {
  const result = await request('/api/identity/login', {
    method: 'POST',
    body: { email, password }
  });
  return result;
};

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64'
);

const run = async () => {
  const health = await request('/healthz');
  check(health.status === 200, 'healthz 200', String(health.status));

  const saLogin = await login(SA_EMAIL, SA_PASSWORD);
  check(saLogin.status === 200 && Boolean(saLogin.json?.token), 'superadmin login', String(saLogin.status));
  const sa = saLogin.json?.token;

  const supLogin = await login(SUP_EMAIL, SUP_PASSWORD);
  check(supLogin.status === 200 && Boolean(supLogin.json?.token), 'supervisor login', String(supLogin.status));
  const sup = supLogin.json?.token;

  const saQueue = await request('/api/tickets/queue?status=PENDING_VERIFICATION&limit=50', { token: sa });
  check(saQueue.status === 200, 'management queue 200 (superadmin)', String(saQueue.status));
  check(typeof saQueue.json?.total === 'number', 'management queue total present');
  const pending = saQueue.json?.tickets || [];
  check(pending.length > 0, 'management queue returns pending tickets', String(pending.length));

  const supQueue = await request('/api/tickets/queue?limit=50', { token: sup });
  check(supQueue.status === 200, 'supervisor queue 200', String(supQueue.status));
  const supTickets = supQueue.json?.tickets || [];
  check(supTickets.length > 0, 'supervisor queue has tickets', String(supTickets.length));
  check(
    supTickets.every((ticket) => Boolean(ticket.organization_id && ticket.organization_name)),
    'supervisor queue includes organization context'
  );

  const target = pending.find((ticket) => ticket.ticket_number === 'TIX-10002') || pending[0];
  check(Boolean(target), 'target ticket found');
  if (!target) return;

  const detail = await request(`/api/tickets/${target.id}`, { token: sup });
  check(detail.status === 200, 'ticket detail 200', String(detail.status));
  check(Boolean(detail.json?.organization_name), 'ticket detail includes organization_name');
  check('acknowledged_by_email' in (detail.json || {}), 'ticket detail includes acknowledged_by_email');
  check('completed_by_email' in (detail.json || {}), 'ticket detail includes completed_by_email');
  const mediaUrl = detail.json?.media?.[0]?.media_url;

  const legacy = await fetch(`${BASE}/uploads/tickets/does-not-exist.png`);
  check(legacy.status === 404, 'legacy /uploads is not served', String(legacy.status));

  if (mediaUrl) {
    const anonFile = await fetch(`${BASE}${mediaUrl}`);
    check(anonFile.status === 404 || anonFile.status === 401, 'legacy media URL is not public', String(anonFile.status));

    const filePath = mediaUrl.replace('/uploads/', '/api/files/');
    const authFile = await fetch(`${BASE}${filePath}`, {
      headers: { Authorization: `Bearer ${sup}` }
    });
    check(authFile.status === 200, 'authenticated /api/files serves media', String(authFile.status));
    check(
      (authFile.headers.get('cache-control') || '').includes('no-store'),
      'media response is private/no-store'
    );
  }

  // D3: AFTER evidence mandatory.
  if (target.status === 'PENDING_VERIFICATION') {
    const reject = await request(`/api/tickets/${target.id}/verify`, {
      token: sa,
      method: 'PATCH',
      body: { approved: false, rejectionReason: 'phase13 e2e reset' }
    });
    check(reject.status === 200, 'superadmin rejects pending ticket to IN_PROGRESS', String(reject.status));
  }

  const noFile = await request(`/api/tickets/${target.id}/resolve`, {
    token: sup,
    method: 'PATCH',
    body: { resolutionNotes: 'missing evidence test' }
  });
  check(noFile.status === 400 && noFile.json?.error === 'AFTER_EVIDENCE_REQUIRED', 'resolve without file -> 400 AFTER_EVIDENCE_REQUIRED', `${noFile.status} ${noFile.json?.error}`);

  const badForm = new FormData();
  badForm.append('resolutionNotes', 'invalid file test');
  badForm.append('ticketMedia', new Blob([Buffer.from('not an image')], { type: 'image/png' }), 'bad.png');
  const badFile = await request(`/api/tickets/${target.id}/resolve`, {
    token: sup,
    method: 'PATCH',
    form: badForm
  });
  check(badFile.status === 400 && badFile.json?.error === 'INVALID_IMAGE_FILE', 'resolve with invalid image -> 400 INVALID_IMAGE_FILE', `${badFile.status} ${badFile.json?.error}`);

  const goodForm = new FormData();
  goodForm.append('resolutionNotes', 'phase13 e2e completion');
  goodForm.append('ticketMedia', new Blob([png], { type: 'image/png' }), 'after.png');
  const resolved = await request(`/api/tickets/${target.id}/resolve`, {
    token: sup,
    method: 'PATCH',
    form: goodForm
  });
  check(resolved.status === 200, 'resolve with valid AFTER image -> 200', `${resolved.status} ${resolved.json?.error || ''}`);
  check(resolved.json?.afterMedia?.evidence_stage === 'AFTER', 'AFTER media recorded');

  const approved = await request(`/api/tickets/${target.id}/verify`, {
    token: sa,
    method: 'PATCH',
    body: { approved: true }
  });
  check(approved.status === 200, 'superadmin approves completed ticket', `${approved.status} ${approved.json?.error || ''}`);

  // D1: supervisor access requires an ACTIVE organization link to the group.
  if (process.env.E2E_ORG_ID) {
    const groupId = '82e9bb96-f1ce-4e66-bb87-91c969a72bef';
    const db = new Client({
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT
    });
    await db.connect();
    const baselineQueue = await request('/api/tickets/queue?limit=50', { token: sup });
    const baselineTotal = baselineQueue.json?.total || 0;
    try {
      await db.query(
        `UPDATE organization_maintenance_groups SET status = 'INACTIVE'
         WHERE organization_id = $1 AND group_id = $2;`,
        [process.env.E2E_ORG_ID, groupId]
      );

      const blockedQueue = await request('/api/tickets/queue?limit=50', { token: sup });
      check(
        blockedQueue.status === 200 && blockedQueue.json?.total === 0,
        'inactive org link hides supervisor queue',
        `${blockedQueue.status} total=${blockedQueue.json?.total}`
      );

      const blockedDetail = await request(`/api/tickets/${target.id}`, { token: sup });
      check(blockedDetail.status === 403, 'inactive org link blocks ticket detail', String(blockedDetail.status));
    } finally {
      await db.query(
        `UPDATE organization_maintenance_groups SET status = 'ACTIVE'
         WHERE organization_id = $1 AND group_id = $2;`,
        [process.env.E2E_ORG_ID, groupId]
      );
      await db.end();
    }

    const restoredQueue = await request('/api/tickets/queue?limit=50', { token: sup });
    check(
      restoredQueue.status === 200 && (restoredQueue.json?.total || 0) === baselineTotal,
      'restored ACTIVE link returns supervisor queue',
      `${restoredQueue.status} total=${restoredQueue.json?.total} baseline=${baselineTotal}`
    );
  }

  const malformed = await fetch(`${BASE}/api/identity/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json'
  });
  const malformedBody = await malformed.text();
  check(malformed.status === 400 && malformedBody.includes('INVALID_JSON'), 'malformed JSON -> 400 INVALID_JSON', `${malformed.status}`);
  check(!malformedBody.includes('at '), 'malformed JSON response has no stack trace');

  // BE-01 provisioning + password policy (SuperAdmin only).
  const shortPassword = await request('/api/identity/provision', {
    token: sa,
    method: 'POST',
    body: { email: `phase13.short.${Date.now()}@example.test`, password: 'short', role: 'Data Entry', organizationId: process.env.E2E_ORG_ID }
  });
  check(shortPassword.status === 400 && shortPassword.json?.error === 'PASSWORD_TOO_SHORT', 'short password rejected', `${shortPassword.status} ${shortPassword.json?.error}`);

  const noRole = await request('/api/identity/provision', {
    token: sa,
    method: 'POST',
    body: { email: `phase13.norole.${Date.now()}@example.test`, password: 'Phase13Test#2026' }
  });
  check(noRole.status === 400, 'provision without role rejected', String(noRole.status));

  const email = `phase13.${Date.now()}@example.test`;
  const provisioned = await request('/api/identity/provision', {
    token: sa,
    method: 'POST',
    body: { email, password: 'Phase13Test#2026', role: 'Council Admin', organizationId: process.env.E2E_ORG_ID }
  });
  check(provisioned.status === 201 && Boolean(provisioned.json?.user?.id), 'provision Council Admin succeeds', `${provisioned.status} ${provisioned.json?.error || ''}`);
  const newUserId = provisioned.json?.user?.id;

  const newLogin = await login(email, 'Phase13Test#2026');
  check(newLogin.status === 200, 'provisioned user can log in', String(newLogin.status));

  if (newUserId) {
    const disabled = await request(`/api/identity/users/${newUserId}`, {
      token: sa,
      method: 'PATCH',
      body: { accStatus: 'Disabled' }
    });
    check(disabled.status === 200, 'deactivate user', String(disabled.status));

    const disabledLogin = await login(email, 'Phase13Test#2026');
    check(disabledLogin.status === 403, 'disabled user cannot log in', String(disabledLogin.status));
  }

  // Rate limiting last (it pollutes the in-memory limiter).
  const fake = `phase13.ratelimit.${Date.now()}@example.test`;
  let lastStatus = 0;
  for (let i = 0; i < 6; i += 1) {
    const attempt = await login(fake, 'WrongPassword#2026');
    lastStatus = attempt.status;
  }
  check(lastStatus === 429, 'login rate limit returns 429', String(lastStatus));

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
};

run().catch((error) => {
  console.error('E2E crashed:', error);
  process.exitCode = 1;
});
