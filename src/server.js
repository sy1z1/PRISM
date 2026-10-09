import express from 'express';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

import identityRoutes from './modules/identity/identity.routes.js';
import sitesRoutes from './modules/sites/sites.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/identity', identityRoutes);
app.use('/api/sites', sitesRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});