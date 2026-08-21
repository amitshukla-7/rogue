import { Pool } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { SEED_STUDENTS, SEED_POSTS, SEED_COMMENTS, SEED_FOLLOWS } from './seedData.js';

dotenv.config();

let pool: Pool | null = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 150, // Significantly increased from default 10 to handle 1000+ concurrent active users
    connectionTimeoutMillis: 10000, // Timeout after 10s instead of hanging indefinitely
    idleTimeoutMillis: 30000,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

// Memory database initialized with 20 dummy accounts
export const mockDb = {
  users: [] as any[],
  interests: [
    { id: 1, name: 'Coding', category: 'Tech' },
    { id: 2, name: 'Music', category: 'Arts' },
    { id: 3, name: 'Photography', category: 'Arts' },
    { id: 4, name: 'Football', category: 'Sports' },
    { id: 5, name: 'Anime', category: 'Entertainment' },
    { id: 6, name: 'Hackathons', category: 'Tech' },
    { id: 7, name: 'Gaming', category: 'Tech' }
  ] as any[],
  user_interests: [] as any[],
  prompts: [] as any[],
  swipes: [] as any[],
  matches: [] as any[],
  messages: [] as any[],
  rooms: [
    { id: 'lounge-general', name: 'Campus Lounge', type: 'interest', is_official: true, is_private: false, member_count: 24, category: 'General', created_by: 'system', created_at: new Date().toISOString() },
    { id: 'lounge-tech', name: 'Tech & Coding', type: 'interest', is_official: true, is_private: false, member_count: 14, category: 'Tech', created_by: 'system', created_at: new Date().toISOString() },
    { id: 'lounge-gaming', name: 'Gaming & Esports', type: 'interest', is_official: true, is_private: false, member_count: 11, category: 'Gaming', created_by: 'system', created_at: new Date().toISOString() },
    { id: 'lounge-latenight', name: 'Late Night Vibe', type: 'interest', is_official: true, is_private: false, member_count: 9, category: 'Social', created_by: 'system', created_at: new Date().toISOString() },
    { id: 'lounge-anime', name: 'Anime & Binge', type: 'interest', is_official: true, is_private: false, member_count: 16, category: 'Entertainment', created_by: 'system', created_at: new Date().toISOString() },
    { id: 'squad-1', name: 'CS301 Project Squad', type: 'plan', is_official: false, is_private: true, member_count: 6, invite_code: 'PROJECT301', category: 'Academic', created_by: 'student-demo-2', created_at: new Date().toISOString() },
    { id: 'squad-2', name: 'Weekend Trip Squad', type: 'plan', is_official: false, is_private: true, member_count: 5, invite_code: 'TRIP2026', category: 'Plans', created_by: 'student-demo-3', created_at: new Date().toISOString() }
  ] as any[],
  room_members: [] as any[],
  room_messages: [] as any[],
  college_email_otps: [] as any[],
  reports: [] as any[],
  blocks: [] as any[],
  posts: [] as any[],
  post_comments: [] as any[],
  post_votes: [] as any[],
  follows: [] as any[],
  admin_actions: [] as any[],
  appeals: [] as any[],
  warnings: [] as any[],
  feedback: [] as any[],
  flash_hangouts: [] as any[]
};

const STORAGE_FILE = path.join(process.cwd(), 'data_store.json');

export const saveMockDbStore = () => {
  try {
    const data = {
      posts: mockDb.posts,
      post_comments: mockDb.post_comments,
      post_votes: mockDb.post_votes,
      users: mockDb.users.filter((u: any) => u.id !== 'admin-super-1')
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save data_store.json:', err);
  }
};

export const loadMockDbStore = () => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.posts) && data.posts.length > 0) {
        const existingIds = new Set(mockDb.posts.map(p => p.id));
        for (const p of data.posts) {
          if (!existingIds.has(p.id)) mockDb.posts.push(p);
        }
      }
      if (Array.isArray(data.post_comments) && data.post_comments.length > 0) {
        const existingCommentIds = new Set(mockDb.post_comments.map(c => c.id));
        for (const c of data.post_comments) {
          if (!existingCommentIds.has(c.id)) mockDb.post_comments.push(c);
        }
      }
      if (Array.isArray(data.post_votes)) {
        mockDb.post_votes = data.post_votes;
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        const existingUserIds = new Set(mockDb.users.map(u => u.id));
        for (const u of data.users) {
          if (!existingUserIds.has(u.id)) mockDb.users.push(u);
        }
      }
      console.log(`💾 Disk Store loaded: ${mockDb.post_comments.length} comments & ${mockDb.posts.length} posts retained across restarts!`);
    }
  } catch (err) {
    console.error('Failed to load data_store.json:', err);
  }
};

// Seed function to load initial clean database state
export const seedMockDatabase = () => {
  mockDb.users = [];
  mockDb.user_interests = [];
  mockDb.prompts = [];
  mockDb.matches = [];
  mockDb.messages = [];
  mockDb.posts = [];
  mockDb.post_comments = [];
  mockDb.post_votes = [];
  mockDb.follows = [];
  mockDb.room_members = [];
  mockDb.room_messages = [];
  mockDb.reports = [];
  mockDb.admin_actions = [];
  mockDb.feedback = [];
  mockDb.flash_hangouts = [];

  // Seed Super Admin Account fallback (if DB connection drops)
  mockDb.users.push({
    id: 'admin-super-1',
    email: 'amitkumarshukla296@gmail.com',
    name: 'Amit Shukla',
    handle: 'amit_admin',
    year: 'Super Admin',
    branch: 'Admin',
    bio: 'Rogue Super Admin Account',
    photos: [],
    college_verified: true,
    email_verified: true,
    is_admin: true,
    is_banned: false,
    ban_reason: null,
    swipe_mode: 'swipe',
    read_receipts_enabled: true,
    created_at: new Date().toISOString()
  });

  // Restore stored comments & posts from disk
  loadMockDbStore();

  console.log(`✅ Production DB initialized with ${mockDb.post_comments.length} stored comments & ${mockDb.posts.length} posts!`);
};


// Run initial seed
seedMockDatabase();

export const query = async (sql: string, params: any[] = []): Promise<{ rows: any[] }> => {
  if (pool) {
    const res = await pool.query(sql, params);
    return res;
  }

  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  const lowerSql = cleanSql.toLowerCase();

  // SELECT * FROM interests
  if (lowerSql.startsWith('select * from interests') || lowerSql.startsWith('select id, name, category from interests')) {
    return { rows: mockDb.interests };
  }

  // SELECT * FROM users WHERE google_id = $1 OR email = $2
  if (lowerSql.includes('from users') && (lowerSql.includes('google_id =') || lowerSql.includes('or email ='))) {
    const googleId = params[0];
    const email = params[1] || params[0];
    const user = mockDb.users.find(u => (u.google_id && u.google_id === googleId) || u.email === email || (u.google_id && u.google_id === email));
    return { rows: user ? [JSON.parse(JSON.stringify(user))] : [] };
  }

  // SELECT * FROM users WHERE email = $1
  if (lowerSql.startsWith('select * from users where email =')) {
    const email = params[0];
    const user = mockDb.users.find(u => u.email === email);
    return { rows: user ? [JSON.parse(JSON.stringify(user))] : [] };
  }

  // SELECT * FROM users WHERE id = $1
  if (lowerSql.includes('from users where id')) {
    const id = params[0];
    const user = mockDb.users.find(u => u.id === id);
    return { rows: user ? [JSON.parse(JSON.stringify(user))] : [] };
  }

  // INSERT INTO users
  if (lowerSql.startsWith('insert into users')) {
    const columnsMatch = cleanSql.match(/\(([^)]+)\)/);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(c => c.trim().toLowerCase());
      const newUser: any = {
        id: crypto.randomUUID(),
        photos: [],
        email_verified: false,
        college_verified: true,
        swipe_mode: 'swipe',
        read_receipts_enabled: true,
        created_at: new Date().toISOString()
      };
      
      columns.forEach((col, idx) => {
        newUser[col] = params[idx];
      });

      if (!newUser.id) newUser.id = crypto.randomUUID();

      mockDb.users.push(newUser);
      return { rows: [JSON.parse(JSON.stringify(newUser))] };
    }
  }

  // UPDATE users
  if (lowerSql.startsWith('update users set')) {
    const id = params[params.length - 1];
    const user = mockDb.users.find(u => u.id === id);
    if (user) {
      const setClause = cleanSql.match(/set\s+(.+?)\s+where/i);
      if (setClause) {
        const assignments = setClause[1].split(',').map(a => a.trim());
        assignments.forEach((assign) => {
          const parts = assign.split('=');
          const colName = parts[0].trim().toLowerCase();
          const paramPlaceholder = parts[1].trim();
          let val: any;
          if (paramPlaceholder.toLowerCase() === 'true') {
            val = true;
          } else if (paramPlaceholder.toLowerCase() === 'false') {
            val = false;
          } else if (paramPlaceholder.toLowerCase() === 'null') {
            val = null;
          } else if (paramPlaceholder.startsWith('$')) {
            const paramIdx = parseInt(paramPlaceholder.replace('$', '')) - 1;
            val = params[paramIdx];
          } else {
            val = paramPlaceholder.replace(/^['"]|['"]$/g, '');
          }
          user[colName] = val;
        });
      }
      return { rows: [JSON.parse(JSON.stringify(user))] };
    }
    return { rows: [] };
  }

  // SELECT i.* FROM interests i JOIN user_interests ui ON ui.interest_id = i.id WHERE ui.user_id = $1
  if (lowerSql.includes('from interests i join user_interests ui')) {
    const userId = params[0];
    const userInterestRecords = mockDb.user_interests.filter(ui => ui.user_id === userId);
    const userInterests = userInterestRecords.map(ui => mockDb.interests.find(i => i.id === ui.interest_id)).filter(Boolean);
    return { rows: JSON.parse(JSON.stringify(userInterests)) };
  }

  // SELECT * FROM user_interests WHERE user_id = $1
  if (lowerSql.startsWith('select * from user_interests where user_id =')) {
    const userId = params[0];
    const userInterests = mockDb.user_interests.filter(ui => ui.user_id === userId);
    return { rows: JSON.parse(JSON.stringify(userInterests)) };
  }

  // DELETE FROM user_interests WHERE user_id = $1
  if (lowerSql.startsWith('delete from user_interests where user_id =')) {
    const userId = params[0];
    mockDb.user_interests = mockDb.user_interests.filter(ui => ui.user_id !== userId);
    return { rows: [] };
  }

  // INSERT INTO user_interests
  if (lowerSql.startsWith('insert into user_interests')) {
    const user_id = params[0];
    const interest_id = params[1];
    const newUI = { user_id, interest_id };
    mockDb.user_interests.push(newUI);
    return { rows: [newUI] };
  }

  // SELECT * FROM prompts WHERE user_id = $1
  if (lowerSql.startsWith('select * from prompts where user_id =')) {
    const userId = params[0];
    return { rows: JSON.parse(JSON.stringify(mockDb.prompts.filter(p => p.user_id === userId))) };
  }

  // INSERT INTO prompts
  if (lowerSql.startsWith('insert into prompts')) {
    const newPrompt = {
      id: crypto.randomUUID(),
      user_id: params[0],
      question: params[1],
      answer: params[2]
    };
    mockDb.prompts.push(newPrompt);
    return { rows: [newPrompt] };
  }

  // DELETE FROM prompts WHERE user_id = $1
  if (lowerSql.startsWith('delete from prompts where user_id =')) {
    const userId = params[0];
    mockDb.prompts = mockDb.prompts.filter(p => p.user_id !== userId);
    return { rows: [] };
  }

  // SELECT * FROM swipes WHERE from_user_id
  if (lowerSql.includes('from swipes where from_user_id')) {
    const userId = params[0];
    return { rows: JSON.parse(JSON.stringify(mockDb.swipes.filter(s => s.from_user_id === userId))) };
  }

  // INSERT INTO swipes
  if (lowerSql.startsWith('insert into swipes')) {
    const newSwipe = {
      id: crypto.randomUUID(),
      from_user_id: params[0],
      to_user_id: params[1],
      action: params[2],
      created_at: new Date().toISOString()
    };
    mockDb.swipes.push(newSwipe);
    return { rows: [newSwipe] };
  }

  // SELECT * FROM matches
  if (lowerSql.includes('from matches where user_a_id') || lowerSql.includes('select * from matches')) {
    const userId = params[0];
    const matches = mockDb.matches.filter(m => m.user_a_id === userId || m.user_b_id === userId);
    return { rows: JSON.parse(JSON.stringify(matches)) };
  }

  // INSERT INTO matches
  if (lowerSql.startsWith('insert into matches')) {
    const newMatch = {
      id: crypto.randomUUID(),
      user_a_id: params[0],
      user_b_id: params[1],
      matched_at: new Date().toISOString()
    };
    mockDb.matches.push(newMatch);
    return { rows: [newMatch] };
  }

  // SELECT * FROM messages WHERE match_id
  if (lowerSql.includes('from messages where match_id')) {
    const matchId = params[0];
    const msgs = mockDb.messages.filter(m => m.match_id === matchId).sort((a,b) => a.sent_at.localeCompare(b.sent_at));
    return { rows: JSON.parse(JSON.stringify(msgs)) };
  }

  // INSERT INTO messages
  if (lowerSql.startsWith('insert into messages')) {
    const newMsg = {
      id: crypto.randomUUID(),
      match_id: params[0],
      sender_id: params[1],
      content: params[2],
      sent_at: new Date().toISOString(),
      read_at: null
    };
    mockDb.messages.push(newMsg);
    return { rows: [newMsg] };
  }

  // SELECT * FROM room_messages
  if (lowerSql.includes('from room_messages where room_id') || lowerSql.includes('select * from room_messages')) {
    const roomId = params[0];
    const msgs = mockDb.room_messages.filter(m => m.room_id === roomId);
    return { rows: JSON.parse(JSON.stringify(msgs)) };
  }

  // SELECT * FROM rooms WHERE id = $1
  if (lowerSql.startsWith('select * from rooms where id =')) {
    const id = params[0];
    const room = mockDb.rooms.find(r => r.id === id);
    return { rows: room ? [JSON.parse(JSON.stringify(room))] : [] };
  }

  // SELECT * FROM rooms
  if (lowerSql.startsWith('select * from rooms') || lowerSql.startsWith('select r.*')) {
    const activeRooms = mockDb.rooms.filter(r => !r.expires_at || new Date(r.expires_at) > new Date());
    return { rows: JSON.parse(JSON.stringify(activeRooms)) };
  }

  // INSERT INTO rooms
  if (lowerSql.startsWith('insert into rooms')) {
    const inviteCode = 'SQUAD-' + Math.floor(1000 + Math.random() * 9000);
    const newRoom = {
      id: crypto.randomUUID(),
      name: params[0],
      type: params[1],
      interest_id: params[2] || null,
      created_by: params[3] || null,
      expires_at: params[4] || null,
      is_official: false,
      is_private: true,
      invite_code: inviteCode,
      created_at: new Date().toISOString()
    };
    mockDb.rooms.push(newRoom);
    return { rows: [newRoom] };
  }

  // SELECT * FROM room_members
  if (lowerSql.includes('from room_members where room_id')) {
    const roomId = params[0];
    return { rows: JSON.parse(JSON.stringify(mockDb.room_members.filter(m => m.room_id === roomId))) };
  }

  // INSERT INTO room_members
  if (lowerSql.startsWith('insert into room_members')) {
    const room_id = params[0];
    const user_id = params[1];
    const newMember = { room_id, user_id, joined_at: new Date().toISOString() };
    mockDb.room_members.push(newMember);
    return { rows: [newMember] };
  }

  // DELETE FROM room_members WHERE room_id = $1 AND user_id = $2
  if (lowerSql.startsWith('delete from room_members where room_id =')) {
    const room_id = params[0];
    const user_id = params[1];
    mockDb.room_members = mockDb.room_members.filter(m => !(m.room_id === room_id && m.user_id === user_id));
    return { rows: [] };
  }

  // INSERT INTO room_messages
  if (lowerSql.startsWith('insert into room_messages')) {
    const room_id = params[0];
    const sender_id = params[1];
    const content = params[2];
    
    const sender = mockDb.users.find(u => u.id === sender_id);
    const newMsg = {
      id: crypto.randomUUID(),
      room_id,
      sender_id,
      sender_name: sender ? sender.name : 'Unknown User',
      sender_handle: sender ? sender.handle || 'user' : 'user',
      sender_photo: sender && sender.photos && sender.photos[0] ? sender.photos[0] : null,
      content,
      sent_at: new Date().toISOString()
    };
    mockDb.room_messages.push(newMsg);

    // Memory cap: Keep max 50 recent messages per room to handle high load without DB bloat
    const roomMsgs = mockDb.room_messages.filter(m => m.room_id === room_id);
    if (roomMsgs.length > 50) {
      const toRemove = roomMsgs.slice(0, roomMsgs.length - 50);
      const removeIds = new Set(toRemove.map(m => m.id));
      mockDb.room_messages = mockDb.room_messages.filter(m => !removeIds.has(m.id));
    }

    return { rows: [newMsg] };
  }

  // college_email_otps
  if (lowerSql.startsWith('insert into college_email_otps')) {
    const newOtp = {
      id: crypto.randomUUID(),
      user_id: params[0],
      college_email: params[1],
      otp_hash: params[2],
      expires_at: params[3],
      created_at: new Date().toISOString()
    };
    mockDb.college_email_otps.push(newOtp);
    return { rows: [newOtp] };
  }

  if (lowerSql.startsWith('select * from college_email_otps where user_id =')) {
    const userId = params[0];
    const otps = mockDb.college_email_otps.filter(o => o.user_id === userId);
    return { rows: JSON.parse(JSON.stringify(otps)) };
  }

  if (lowerSql.startsWith('delete from college_email_otps where user_id =')) {
    const userId = params[0];
    mockDb.college_email_otps = mockDb.college_email_otps.filter(o => o.user_id !== userId);
    return { rows: [] };
  }

  // reports
  if (lowerSql.startsWith('insert into reports')) {
    const newReport = {
      id: crypto.randomUUID(),
      reporter_id: params[0],
      reported_user_id: params[1],
      reason: params[2],
      context: params[3] || null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    mockDb.reports.push(newReport);
    return { rows: [newReport] };
  }

  if (lowerSql.startsWith('select * from reports')) {
    return { rows: JSON.parse(JSON.stringify(mockDb.reports)) };
  }

  if (lowerSql.startsWith('update reports set status =')) {
    const status = params[0];
    const id = params[1];
    const report = mockDb.reports.find(r => r.id === id);
    if (report) {
      report.status = status;
      return { rows: [JSON.parse(JSON.stringify(report))] };
    }
    return { rows: [] };
  }

  // blocks
  if (lowerSql.startsWith('insert into blocks')) {
    const newBlock = {
      blocker_id: params[0],
      blocked_id: params[1],
      created_at: new Date().toISOString()
    };
    mockDb.blocks.push(newBlock);
    return { rows: [newBlock] };
  }

  if (lowerSql.startsWith('select * from blocks where blocker_id =')) {
    const blockerId = params[0];
    return { rows: JSON.parse(JSON.stringify(mockDb.blocks.filter(b => b.blocker_id === blockerId))) };
  }

  // admin_actions
  if (lowerSql.startsWith('insert into admin_actions')) {
    const newAction = {
      id: crypto.randomUUID(),
      admin_id: params[0],
      admin_name: params[1],
      action_type: params[2],
      target_id: params[3],
      target_label: params[4] || null,
      reason: params[5] || null,
      created_at: new Date().toISOString()
    };
    mockDb.admin_actions.push(newAction);
    return { rows: [newAction] };
  }

  if (lowerSql.startsWith('select * from admin_actions')) {
    const actions = mockDb.admin_actions.slice().sort((a,b) => b.created_at.localeCompare(a.created_at));
    return { rows: JSON.parse(JSON.stringify(actions)) };
  }

  // DELETE posts
  if (lowerSql.startsWith('delete from posts where id =')) {
    const postId = params[0];
    mockDb.posts = mockDb.posts.filter(p => p.id !== postId);
    return { rows: [] };
  }

  // DELETE room_messages
  if (lowerSql.startsWith('delete from room_messages where id =')) {
    const msgId = params[0];
    mockDb.room_messages = mockDb.room_messages.filter(m => m.id !== msgId);
    return { rows: [] };
  }

  // SELECT ALL users (for admin users list)
  if (lowerSql.includes('from users') && !lowerSql.includes('where id =') && !lowerSql.includes('where email =') && !lowerSql.includes('where google_id =')) {
    return { rows: JSON.parse(JSON.stringify(mockDb.users)) };
  }

  // appeals
  if (lowerSql.startsWith('insert into appeals')) {
    const newAppeal = {
      id: crypto.randomUUID(),
      user_id: params[0],
      user_name: params[1],
      user_email: params[2],
      reason: params[3],
      status: 'pending',
      created_at: new Date().toISOString()
    };
    mockDb.appeals.push(newAppeal);
    return { rows: [newAppeal] };
  }

  if (lowerSql.startsWith('select * from appeals')) {
    return { rows: JSON.parse(JSON.stringify(mockDb.appeals)) };
  }

  if (lowerSql.startsWith('update appeals set status =')) {
    const status = params[0];
    const id = params[1];
    const app = mockDb.appeals.find(a => a.id === id);
    if (app) app.status = status;
    return { rows: [JSON.parse(JSON.stringify(app || {}))] };
  }

  // DELETE FROM rooms WHERE id = $1
  if (lowerSql.startsWith('delete from rooms where id =')) {
    const roomId = params[0];
    mockDb.rooms = mockDb.rooms.filter(r => r.id !== roomId);
    mockDb.room_messages = mockDb.room_messages.filter(m => m.room_id !== roomId);
    mockDb.room_members = mockDb.room_members.filter(m => m.room_id !== roomId);
    return { rows: [] };
  }

  // warnings queries
  if (lowerSql.startsWith('insert into warnings')) {
    const newWarn = {
      id: params[0],
      user_id: params[1],
      admin_id: params[2],
      content_type: params[3],
      warning_message: params[4],
      reason: params[5],
      created_at: params[6] || new Date().toISOString(),
      read: params[7] || false
    };
    mockDb.warnings.unshift(newWarn);
    return { rows: [newWarn] };
  }

  if (lowerSql.startsWith('select * from warnings where user_id =')) {
    const userId = params[0];
    const userWarnings = mockDb.warnings.filter(w => w.user_id === userId);
    return { rows: JSON.parse(JSON.stringify(userWarnings)) };
  }

  if (lowerSql.startsWith('update warnings set read = true where user_id =')) {
    const userId = params[0];
    mockDb.warnings.forEach(w => {
      if (w.user_id === userId) w.read = true;
    });
    return { rows: [] };
  }

  // post_comments / comments query handlers
  if (lowerSql.startsWith('insert into post_comments') || lowerSql.startsWith('insert into comments')) {
    const commentId = params[0];
    const postId = params[1];
    const authorId = params[2];
    const content = params[3];
    const createdAt = params[4] || new Date().toISOString();

    const existingIdx = mockDb.post_comments.findIndex(c => c.id === commentId);
    const commentObj = {
      id: commentId,
      post_id: postId,
      author_id: authorId,
      content,
      created_at: createdAt
    };
    if (existingIdx !== -1) {
      mockDb.post_comments[existingIdx] = commentObj;
    } else {
      mockDb.post_comments.push(commentObj);
    }
    saveMockDbStore();
    return { rows: [commentObj] };
  }

  if (lowerSql.includes('from post_comments') || lowerSql.includes('from comments')) {
    const postId = params[0];
    let matched = mockDb.post_comments;
    if (postId) {
      matched = mockDb.post_comments.filter(c => c.post_id?.toString() === postId.toString());
    }
    return { rows: JSON.parse(JSON.stringify(matched)) };
  }

  if (lowerSql.startsWith('delete from post_comments') || lowerSql.startsWith('delete from comments')) {
    const commentId = params[0];
    mockDb.post_comments = mockDb.post_comments.filter(c => c.id !== commentId);
    saveMockDbStore();
    return { rows: [] };
  }

  return { rows: [] };
};

