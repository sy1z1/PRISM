import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Absolute backend root, independent of the process working directory.
export const BACKEND_ROOT = path.resolve(here, '../..');
export const UPLOADS_ROOT = path.resolve(BACKEND_ROOT, 'uploads');
