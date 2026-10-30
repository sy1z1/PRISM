import './config/env.js';
import express from 'express';
import { validateEnv, PORT } from './config/env.js';
import { pool } from './config/db.js';
import { securityHeaders, notFoundHandler, errorHandler } from './middlewares/error-handler.js';

import identityRoutes from './modules/identity/identity.routes.js';
import sitesRoutes from './modules/sites/sites.routes.js';
import assetsRoutes from './modules/assets/assets.routes.js';
import ticketsRoutes from './modules/tickets/tickets.routes.js';
import maintenanceGroupsRoutes from './modules/maintenance-groups/maintenance-groups.routes.js';
import filesRoutes from './modules/files/files.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import { purgeOldSessions } from './modules/identity/identity.service.js';

validateEnv();

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/identity', identityRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/maintenance-groups', maintenanceGroupsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/reports', reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// D5: pause-site retention. Expired/revoked sessions are purged after 30 days.
const SESSION_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const purgeTimer = setInterval(() => {
  purgeOldSessions().catch((error) => console.error('Session purge failed:', error.message));
}, SESSION_PURGE_INTERVAL_MS);
purgeTimer.unref();

purgeOldSessions().catch((error) => console.error('Session purge failed:', error.message));

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down.`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
