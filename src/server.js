import express from 'express';
import 'dotenv/config';
import identityRoutes from './modules/identity/identity.routes.js';
import sitesRoutes from './modules/sites/sites.routes.js';

const app = express();
app.use(express.json());
app.use('/api/identity', identityRoutes);
app.use('/api/sites', sitesRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});