import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'node:fs/promises';

dotenv.config({
  path: new URL('../env', import.meta.url)
});

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing from server/env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

const migrationFiles = [
  'schema.sql',
  'wallet_update.sql',
  'entry_fee_update.sql',
  'mode_update.sql',
  'tournament_update.sql',
  'registration_update.sql',
  'team_members_update.sql',
  'forgot_password_update.sql',
  'user_login_history_update.sql'
];

async function migrate() {
  const client = await pool.connect();

  try {
    for (const file of migrationFiles) {
      console.log(`Applying ${file}...`);

      const filePath = new URL(`./${file}`, import.meta.url);
      const sql = await fs.readFile(filePath, 'utf8');

      if (!sql.trim()) {
        throw new Error(`${file} is empty.`);
      }

      await client.query(sql);
      console.log(`${file} applied successfully.`);
    }

    console.log('All database migrations completed.');
  } catch (error) {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();