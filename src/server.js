import express from 'express';
import 'dotenv/config';
import identifyRoutes from './modules/identity/identity.routes.js';

const app = express();
app.use(express.json());
app.use('/api/identity', identifyRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});