// Reset teaser post for a specific email
import pg from 'pg';
const { Pool } = pg;

const EMAIL = process.argv[2] || '24ir10am4@mitsgwl.ac.in';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function resetTeaserPost() {
  try {
    console.log(`\n🔍 Looking up user: ${EMAIL}`);

    // Find user
    const userRes = await pool.query('SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)', [EMAIL]);
    if (userRes.rows.length === 0) {
      console.log(`❌ No user found with email: ${EMAIL}`);
      process.exit(0);
    }

    const user = userRes.rows[0];
    console.log(`✅ Found user: ${user.name} (id: ${user.id})`);

    // Find their posts
    const postsRes = await pool.query(
      'SELECT id, title, created_at FROM posts WHERE author_id::text = $1 ORDER BY created_at DESC',
      [user.id]
    );

    if (postsRes.rows.length === 0) {
      console.log(`ℹ️  No posts found for this user. LocalStorage flag is the only lock.`);
    } else {
      console.log(`\n📝 Found ${postsRes.rows.length} post(s):`);
      postsRes.rows.forEach((p, i) => {
        console.log(`  ${i + 1}. [${p.id}] "${p.title}" — ${new Date(p.created_at).toLocaleString()}`);
      });

      // Delete all posts for this user
      const deleteRes = await pool.query(
        'DELETE FROM posts WHERE author_id::text = $1 RETURNING id',
        [user.id]
      );
      console.log(`\n🗑️  Deleted ${deleteRes.rows.length} post(s) from database.`);
    }

    console.log(`\n✅ Database reset complete for: ${EMAIL}`);
    console.log(`\n⚠️  IMPORTANT: Also clear localStorage in the browser:`);
    console.log(`   Open teaser site → F12 → Console → paste:`);
    console.log(`   localStorage.removeItem('rogue_teaser_user_posted');`);
    console.log(`   localStorage.removeItem('rogue_teaser_post_title');`);
    console.log(`   localStorage.removeItem('rogue_teaser_post_content');`);
    console.log(`   Then refresh the page.`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

resetTeaserPost();
