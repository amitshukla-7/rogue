const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

dotenv.config({ path: 'apps/api/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to Supabase...');

  // Ensure handle column exists
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT');

  // 0. Ensure schema tables exist
  const schemaSql = fs.readFileSync(path.join(__dirname, '../apps/api/src/db/schema.sql'), 'utf-8');
  await pool.query(schemaSql);
  console.log('✅ PostgreSQL Schema synced with Supabase!');

  // 1. Seed Interests
  const interests = [
    ['Coding', 'Tech'],
    ['Music', 'Arts'],
    ['Photography', 'Arts'],
    ['Football', 'Sports'],
    ['Anime', 'Entertainment'],
    ['Hackathons', 'Tech'],
    ['Gaming', 'Tech']
  ];

  for (const [name, category] of interests) {
    const existing = await pool.query('SELECT id FROM interests WHERE name = $1', [name]);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO interests (name, category) VALUES ($1, $2)', [name, category]);
    }
  }

  const intCount = await pool.query('SELECT COUNT(*) FROM interests');
  console.log(`✅ Interests seeded: ${intCount.rows[0].count} entries`);

  // 2. Seed Default Public Rooms
  const defaultRooms = [
    ['General Chat', 'interest', null],
    ['Hackathon Hub', 'interest', 6],
    ['Study Group', 'interest', 1],
    ['Gaming Arena', 'interest', 7]
  ];

  for (const [name, type, interestId] of defaultRooms) {
    const existing = await pool.query('SELECT id FROM rooms WHERE name = $1', [name]);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO rooms (name, type, interest_id) VALUES ($1, $2, $3)', [name, type, interestId]);
    }
  }

  const roomCount = await pool.query('SELECT COUNT(*) FROM rooms');
  console.log(`✅ Rooms seeded: ${roomCount.rows[0].count} entries`);

  // 3. Seed Accounts
  const usersToSeed = [
    { name: 'Platform Admin', email: 'admin@campusconnect.com', google_id: 'admin_google_id', is_admin: true },
    { name: 'Amit Shukla', email: 'amit.shukla@mitsgw.ac.in', google_id: 'amit_google_id', is_admin: true },
    { name: 'Student Account', email: 'student@mits.ac.in', google_id: 'student_google_id', is_admin: false }
  ];

  for (const u of usersToSeed) {
    const check = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (check.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (name, email, google_id, college_verified, is_admin) VALUES ($1, $2, $3, true, $4)',
        [u.name, u.email, u.google_id, u.is_admin]
      );
    } else {
      await pool.query('UPDATE users SET is_admin = $1 WHERE email = $2', [u.is_admin, u.email]);
    }
  }

  const adminList = await pool.query('SELECT id, name, email, is_admin FROM users WHERE is_admin = true');
  console.log('✅ Admin users configured in Supabase:', adminList.rows);

  console.log('\n🎉 SUPABASE LIVE DATABASE IS FULLY CONFIGURED & READY!');
  await pool.end();
}

main().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
