import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config({ path: new URL('../env', import.meta.url) });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create the first admin account
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured.');
    }

    if (adminPassword.length < 12) {
      throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['Super Admin', adminEmail.toLowerCase(), passwordHash, 'superadmin']
    );

    // Default settings with valid JSON format
    const settings = [
      ['site_name', JSON.stringify('MEHRAB GAMING BD')],
      ['currency', JSON.stringify('BDT')],
      ['maintenance_mode', JSON.stringify('false')]
    ];

    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }

    // Default diamond packages
    const packages = [
      ['25 Diamonds', '25 ডায়মন্ড', 25, 25, 1],
      ['50 Diamonds', '50 ডায়মন্ড', 50, 45, 2],
      ['115 Diamonds', '115 ডায়মন্ড', 115, 90, 3],
      ['240 Diamonds', '240 ডায়মন্ড', 240, 180, 4],
      ['610 Diamonds', '610 ডায়মন্ড', 610, 450, 5]
    ];

    for (const item of packages) {
      await client.query(
        `INSERT INTO diamond_packages
          (name_en, name_bn, diamonds, price, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, false)
         ON CONFLICT DO NOTHING`,
        item
      );
    }

    await client.query('COMMIT');
    console.log('Database seed completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
