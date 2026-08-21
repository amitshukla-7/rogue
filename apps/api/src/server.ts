import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { query, mockDb } from './db/index.js';

import helmet from 'helmet';
import { authRateLimiter, apiRateLimiter } from './middleware/rateLimit.js';

// Import routers
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import roomsRouter, { cleanupExpiredHangouts } from './routes/rooms.js';
import matchesRouter from './routes/matches.js';
import reportsRouter from './routes/reports.js';
import feedRouter from './routes/feed.js';
import adminRouter from './routes/admin.js';
import feedbackRouter from './routes/feedback.js';

// Import Socket initialization
import { initSockets } from './sockets/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) 
  : ['http://localhost:3000', 'http://localhost:3001'];

const corsOriginHandler = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    // In production mode, permit requests from frontend origin or fallback to allow
    callback(null, true);
  }
};

const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    credentials: true
  }
});

// Attach socket io to app instance for route access
app.set('io', io);
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(cookieParser());
app.use(express.json());

// Health Check Endpoints for cloud deployments (Render, Railway, AWS, Vercel, Fly.io)
app.get(['/health', '/api/health'], (req, res) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: process.env.DATABASE_URL ? 'postgres' : 'in-memory-mock'
  });
});

// Routes with rate limiting
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/users', apiRateLimiter, usersRouter);
app.use('/api/rooms', apiRateLimiter, roomsRouter);
app.use('/api/posts', apiRateLimiter, feedRouter);
app.use('/api/feedback', apiRateLimiter, feedbackRouter);
app.use('/api', apiRateLimiter, matchesRouter); // handles /discover, /swipes, /matches, /messages
app.use('/api', apiRateLimiter, reportsRouter); // handles /reports, /blocks, /admin/reports


// GET public statistics
app.get('/api/stats/public', async (req, res) => {
  try {
    const studentsRes = await query('SELECT count(*) FROM users');
    const roomsRes = await query('SELECT count(*) FROM rooms');
    
    // Fallbacks for mock mode
    const activeStudents = process.env.DATABASE_URL 
      ? parseInt(studentsRes.rows[0].count) 
      : mockDb.users.length;
      
    const activeRooms = process.env.DATABASE_URL 
      ? parseInt(roomsRes.rows[0].count) 
      : mockDb.rooms.length;

    return res.status(200).json({ activeStudents, activeRooms });
  } catch (err: any) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Seed & Indexing helper for database setup
const seedDatabase = async () => {
  try {
    if (process.env.DATABASE_URL) {
      // 1. Create performance indexes & flash_hangouts table
      console.log('Ensuring PostgreSQL DB performance indexes & tables...');
      await query(`
        CREATE TABLE IF NOT EXISTS flash_hangouts (
          id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          creator_id TEXT NOT NULL,
          title TEXT NOT NULL,
          location TEXT NOT NULL,
          category TEXT DEFAULT 'other',
          category_label TEXT,
          category_emoji TEXT,
          max_participants INTEGER DEFAULT 4,
          joined_user_ids TEXT[] DEFAULT '{}',
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS room_message_reactions (
          message_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          emoji TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (message_id, user_id, emoji)
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          interest_id INTEGER,
          created_by TEXT,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS room_members (
          room_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          joined_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (room_id, user_id)
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS follows (
          follower_id TEXT NOT NULL,
          following_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (follower_id, following_id)
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS user_interests (
          user_id TEXT NOT NULL,
          interest_id TEXT NOT NULL,
          PRIMARY KEY (user_id, interest_id)
        );
      `);
      try {
        const dropConstraints = [
          'ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_author_id_fkey',
          'ALTER TABLE user_interests DROP CONSTRAINT IF EXISTS user_interests_user_id_fkey',
          'ALTER TABLE user_interests DROP CONSTRAINT IF EXISTS user_interests_interest_id_fkey',
          'ALTER TABLE room_members DROP CONSTRAINT IF EXISTS room_members_user_id_fkey',
          'ALTER TABLE room_members DROP CONSTRAINT IF EXISTS room_members_room_id_fkey',
          'ALTER TABLE room_messages DROP CONSTRAINT IF EXISTS room_messages_sender_id_fkey',
          'ALTER TABLE room_messages DROP CONSTRAINT IF EXISTS room_messages_room_id_fkey',
          'ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey',
          'ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey',
          'ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_user_id_fkey'
        ];
        for (const dropSql of dropConstraints) {
          try { await query(dropSql); } catch (e) {}
        }

        await query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT \'General\'');
        await query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false');
        await query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS poll JSONB');
        
        const alterColumns = [
          'ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text',
          'ALTER TABLE posts ALTER COLUMN id TYPE TEXT USING id::text',
          'ALTER TABLE posts ALTER COLUMN author_id TYPE TEXT USING author_id::text',
          'ALTER TABLE user_interests ALTER COLUMN user_id TYPE TEXT USING user_id::text',
          'ALTER TABLE user_interests ALTER COLUMN interest_id TYPE TEXT USING interest_id::text',
          'ALTER TABLE rooms ALTER COLUMN id TYPE TEXT USING id::text',
          'ALTER TABLE rooms ALTER COLUMN created_by TYPE TEXT USING created_by::text',
          'ALTER TABLE room_members ALTER COLUMN room_id TYPE TEXT USING room_id::text',
          'ALTER TABLE room_members ALTER COLUMN user_id TYPE TEXT USING user_id::text',
          'ALTER TABLE room_messages ALTER COLUMN id TYPE TEXT USING id::text',
          'ALTER TABLE room_messages ALTER COLUMN room_id TYPE TEXT USING room_id::text',
          'ALTER TABLE room_messages ALTER COLUMN sender_id TYPE TEXT USING sender_id::text'
        ];
        for (const alterSql of alterColumns) {
          try { await query(alterSql); } catch (e) {}
        }
      } catch (altErr) {
        console.warn('Migration column type notice:', altErr);
      }

      await query('CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)');
      await query('CREATE INDEX IF NOT EXISTS idx_room_messages_room_sent ON room_messages(room_id, sent_at DESC)');
      await query('CREATE INDEX IF NOT EXISTS idx_swipes_from_to ON swipes(from_user_id, to_user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user_a_id, user_b_id)');

      // 2. Check starter interests
      const checkInterests = await query('SELECT COUNT(*) FROM interests');
      if (parseInt(checkInterests.rows[0].count) === 0) {
        console.log('Seeding postgres database interests...');
        const starterInterests = [
          ['Coding', 'Tech'],
          ['Music', 'Arts'],
          ['Photography', 'Arts'],
          ['Football', 'Sports'],
          ['Anime', 'Entertainment'],
          ['Hackathons', 'Tech'],
          ['Gaming', 'Tech']
        ];
        for (const [name, cat] of starterInterests) {
          await query('INSERT INTO interests (name, category) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, cat]);
        }
        
        await query("INSERT INTO rooms (name, type) VALUES ('General Chat', 'interest')");
        await query("INSERT INTO rooms (name, type, interest_id) VALUES ('Coding Enthusiasts', 'interest', (SELECT id FROM interests WHERE name='Coding' LIMIT 1))");
        console.log('Postgres seed completed!');
      }
    } else {
      console.log('Using in-memory mock database store. Seeded with 7 interests and 2 rooms.');
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
};

// Initialize Sockets
initSockets(io);

// Global Process Safety Handlers to prevent Node server crashes under load
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  await seedDatabase();
  await cleanupExpiredHangouts();
  setInterval(cleanupExpiredHangouts, 60 * 1000);
  console.log(`Rogue Backend listening on port ${PORT}`);
});
