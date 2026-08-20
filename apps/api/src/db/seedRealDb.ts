import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: './apps/api/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  console.log('Connecting to Supabase PostgreSQL database...');

  const rooms = [
    { id: 'lounge-general', name: 'Campus Lounge', type: 'interest' },
    { id: 'lounge-tech', name: 'Tech & Coding', type: 'interest' },
    { id: 'lounge-gaming', name: 'Gaming & Esports', type: 'interest' },
    { id: 'lounge-latenight', name: 'Late Night Vibe', type: 'interest' },
    { id: 'lounge-anime', name: 'Anime & Binge', type: 'interest' }
  ];

  for (const r of rooms) {
    await pool.query(
      'INSERT INTO rooms (id, name, type) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [r.id, r.name, r.type]
    );
  }
  console.log('✅ Official campus rooms successfully seeded into PostgreSQL!');

  const interests = [
    { name: 'Coding', category: 'Tech' },
    { name: 'Music', category: 'Arts' },
    { name: 'Photography', category: 'Arts' },
    { name: 'Football', category: 'Sports' },
    { name: 'Anime', category: 'Entertainment' },
    { name: 'Hackathons', category: 'Tech' },
    { name: 'Gaming', category: 'Tech' }
  ];

  for (const i of interests) {
    await pool.query(
      'INSERT INTO interests (name, category) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [i.name, i.category]
    );
  }
  console.log('✅ Official interests successfully seeded into PostgreSQL!');

  await pool.end();
}

main().catch((err) => {
  console.error('Error seeding DB:', err);
  process.exit(1);
});
