import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: join(currentDir, '../../env')
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing from server/env');
}

const useSSL = process.env.DB_SSL === 'true';

export const pool = new pg.Pool({
  connectionString: databaseUrl,

  // Connection limits
  max: 10,
  min: 0,

  // Timeout protection
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  query_timeout: 15000,

  // SSL is enabled only when DB_SSL=true
  ssl: useSSL
    ? { rejectUnauthorized: true }
    : false
});

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error.message);
});

export const query = (text, params) => {
  return pool.query(text, params);
};