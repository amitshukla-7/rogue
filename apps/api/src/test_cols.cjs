const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const pCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts'");
    console.log('posts columns:', pCols.rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}

run();
