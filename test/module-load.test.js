import test from 'node:test';

// Smoke test: every modified/added backend module must parse and resolve its
// imports. server.js is intentionally excluded because it starts listening.
test('backend modules load without errors', async () => {
  await import('../src/middlewares/auth.guard.js');
  await import('../src/middlewares/rbac.guard.js');
  await import('../src/middlewares/upload.guard.js');
  await import('../src/modules/authorization/policy.js');
  await import('../src/modules/authorization/authorization.model.js');
  await import('../src/modules/authorization/resource-access.js');
  await import('../src/modules/identity/identity.model.js');
  await import('../src/modules/identity/identity.service.js');
  await import('../src/modules/identity/identity.controller.js');
  await import('../src/modules/identity/identity.routes.js');
  await import('../src/modules/sites/sites.model.js');
  await import('../src/modules/sites/sites.service.js');
  await import('../src/modules/sites/sites.controller.js');
  await import('../src/modules/sites/sites.routes.js');
  await import('../src/modules/assets/assets.model.js');
  await import('../src/modules/assets/assets.service.js');
  await import('../src/modules/assets/assets.controller.js');
  await import('../src/modules/assets/assets.routes.js');
  await import('../src/modules/tickets/tickets.model.js');
  await import('../src/modules/tickets/tickets.service.js');
  await import('../src/modules/tickets/tickets.controller.js');
  await import('../src/modules/tickets/tickets.routes.js');
  await import('../src/modules/tickets/ticket-transitions.js');
  await import('../src/modules/maintenance-groups/maintenance-groups.model.js');
  await import('../src/modules/maintenance-groups/maintenance-groups.service.js');
  await import('../src/modules/maintenance-groups/maintenance-groups.controller.js');
  await import('../src/modules/maintenance-groups/maintenance-groups.routes.js');
  await import('../src/modules/files/files.controller.js');
  await import('../src/modules/files/files.routes.js');
});
