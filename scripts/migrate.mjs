import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, '../SQL/migrations');
const LOCK_ID = 727274;

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1);', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum text
      );
    `);
    await client.query(
      'ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum text;'
    );

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const { rows } = await client.query('SELECT version, checksum FROM public.schema_migrations;');
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));

    let appliedCount = 0;

    for (const file of files) {
      const version = path.basename(file, '.sql');
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const sum = checksum(sql);

      if (applied.has(version)) {
        const stored = applied.get(version);
        if (stored && stored !== sum) {
          throw new Error(`Checksum mismatch for already-applied migration ${version}`);
        }
        if (!stored) {
          await client.query(
            'UPDATE public.schema_migrations SET checksum = $1 WHERE version = $2;',
            [sum, version]
          );
        }
        continue;
      }

      console.log(`Applying ${version}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (version, checksum) VALUES ($1, $2);',
          [version, sum]
        );
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${version} failed: ${error.message}`);
      }
    }

    console.log(`Migrations complete. Applied ${appliedCount} new migration(s).`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1);', [LOCK_ID]).catch(() => {});
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
