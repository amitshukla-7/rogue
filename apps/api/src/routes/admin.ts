import { Router, Response } from 'express';
import crypto from 'crypto';
import { query, mockDb } from '../db/index.js';
import { authenticateToken, blockBanned, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

const isUuid = (str: string | null | undefined) =>
  !!str && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

// Protect ALL admin routes with authenticateToken, blockBanned, and requireAdmin
router.use(authenticateToken, blockBanned, requireAdmin);

// Helper to get admin user details from req or mockDb
const getAdminDetails = (req: AuthRequest) => {
  const adminId = req.user?.id || 'admin-super-1';
  const mockAdmin = mockDb.users.find((u) => u.id === adminId || u.email === 'amitkumarshukla296@gmail.com');
  return {
    id: adminId,
    name: mockAdmin ? mockAdmin.name : 'Amit Shukla'
  };
};

// 1. GET /api/admin/feed - Initial load of platform-wide content (last 50 items)
router.get('/feed', async (req: AuthRequest, res: Response) => {
  try {
    let posts: any[] = [];
    let roomMessages: any[] = [];

    if (process.env.DATABASE_URL) {
      try {
        const postsRes = await query(`
          SELECT p.id, 'post' as type, p.author_id, u.name as real_author_name, u.handle as author_handle,
                 u.photos as author_photos, p.title, p.content, NULL as room_name, p.media_url, (COALESCE(to_jsonb(p)->>'is_anonymous', 'false'))::boolean as is_anonymous, p.created_at
          FROM posts p
          LEFT JOIN users u ON p.author_id::text = u.id::text
          ORDER BY p.created_at DESC LIMIT 50
        `);
        posts = postsRes.rows.map((p) => ({
          ...p,
          author_name: p.is_anonymous ? `${p.real_author_name || 'Student'} (Posted Anonymously 🕵️)` : (p.real_author_name || 'Student'),
          author_photo: p.author_photos && p.author_photos.length > 0 ? p.author_photos[0] : null
        }));
      } catch (e) {
        console.warn('Admin feed posts query warning:', e);
        posts = [];
      }

      try {
        const msgsRes = await query(`
          SELECT rm.id, 'room_message' as type, rm.sender_id as author_id, u.name as author_name, u.handle as author_handle,
                 u.photos as sender_photos, NULL as title, rm.content, r.name as room_name, NULL as media_url, 
                 (COALESCE(to_jsonb(rm)->>'sent_at', to_jsonb(rm)->>'created_at', NOW()::text)) as created_at
          FROM room_messages rm
          LEFT JOIN rooms r ON rm.room_id::text = r.id::text
          LEFT JOIN users u ON rm.sender_id::text = u.id::text
          LIMIT 50
        `);
        roomMessages = msgsRes.rows.map((m) => ({
          ...m,
          author_photo: m.sender_photos && m.sender_photos.length > 0 ? m.sender_photos[0] : null
        }));
      } catch (e) {
        console.warn('Admin feed room_messages query warning:', e);
        roomMessages = [];
      }
    } else {
      posts = mockDb.posts.map((p) => {
        const author = mockDb.users.find((u) => u.id === p.author_id);
        const realName = author ? author.name : 'Student';
        return {
          id: p.id,
          type: 'post',
          author_id: p.author_id,
          author_name: p.is_anonymous ? `${realName} (Posted Anonymously 🕵️)` : realName,
          author_handle: author ? author.handle || 'student' : 'student',
          author_photo: author && author.photos ? author.photos[0] : null,
          title: p.title,
          content: p.content,
          room_name: null,
          media_url: p.media_url || null,
          created_at: p.created_at
        };
      });

      roomMessages = mockDb.room_messages.map((m) => {
        const sender = mockDb.users.find((u) => u.id === m.sender_id);
        const room = mockDb.rooms.find((r) => r.id === m.room_id);
        return {
          id: m.id,
          type: 'room_message',
          author_id: m.sender_id,
          author_name: m.sender_name || (sender ? sender.name : 'Student'),
          author_handle: sender ? sender.handle || 'student' : 'student',
          author_photo: m.sender_photo || (sender && sender.photos ? sender.photos[0] : null),
          title: null,
          content: m.content,
          room_id: m.room_id,
          room_name: room ? room.name : 'General Room',
          media_url: null,
          created_at: m.sent_at
        };
      });
    }

    const feed = [...posts, ...roomMessages]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    return res.status(200).json(feed);
  } catch (err: any) {
    console.error('Fetch admin feed error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper to create and issue official admin warnings to users
const createAdminWarning = async (
  req: AuthRequest, 
  targetUserId: string | null | undefined, 
  contentType: 'post' | 'room_message' | 'room', 
  itemTitle: string, 
  reason: string
) => {
  if (!targetUserId) return;
  const admin = getAdminDetails(req);
  const typeLabel = contentType === 'room' ? 'room' : (contentType === 'post' ? 'post' : 'room message');
  const warningMsg = `⚠️ OFFICIAL MODERATION WARNING: Your ${typeLabel} ("${itemTitle}") was removed by Platform Administration. Reason: "${reason || 'Violation of Community Guidelines'}". Note: Continued violations will result in immediate account suspension & ban.`;

  const warningId = crypto.randomUUID();
  const warning = {
    id: warningId,
    user_id: targetUserId,
    admin_id: admin.id,
    content_type: contentType,
    item_title: itemTitle,
    reason: reason || 'Violation of Community Guidelines',
    warning_message: warningMsg,
    created_at: new Date().toISOString(),
    read: false
  };

  try {
    if (process.env.DATABASE_URL) {
      const validAdminId = isUuid(admin.id) ? admin.id : 'b97ae6d7-cfa7-41cc-b1df-2445389e7680';
      if (isUuid(targetUserId)) {
        await query(
          'INSERT INTO warnings (id, user_id, admin_id, content_type, item_title, warning_message, reason, created_at, read) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [warning.id, warning.user_id, validAdminId, warning.content_type, warning.item_title, warning.warning_message, warning.reason, warning.created_at, false]
        );
      }
    } else {
      mockDb.warnings.unshift(warning);
    }

    const io = req.app.get('io');
    if (io) {
      io.to('user:' + targetUserId).emit('user:warning', warning);
    }
  } catch (err) {
    console.error('Create admin warning error:', err);
  }
};

// 2. POST /api/admin/posts/:id/remove - Remove a post platform-wide and issue warning to author
router.post('/posts/:id/remove', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin = getAdminDetails(req);

  try {
    let authorId: string | null = null;
    let targetLabel = 'Post #' + id;

    if (process.env.DATABASE_URL) {
      const pRes = await query('SELECT author_id, title, content FROM posts WHERE id = $1', [id]);
      if (pRes.rows.length > 0) {
        authorId = pRes.rows[0].author_id;
        targetLabel = pRes.rows[0].title || pRes.rows[0].content.substring(0, 30);
      }
      await query('DELETE FROM posts WHERE id = $1', [id]);
      await query(
        'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, admin.name, 'remove_post', id, targetLabel, reason || 'Content policy violation']
      );
    } else {
      const post = mockDb.posts.find((p) => p.id === id);
      if (post) {
        authorId = post.author_id;
        targetLabel = post.title || post.content.substring(0, 30);
      }
      mockDb.posts = mockDb.posts.filter((p) => p.id !== id);

      const action = {
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'remove_post',
        target_id: id,
        target_label: targetLabel,
        reason: reason || 'Content policy violation',
        created_at: new Date().toISOString()
      };
      mockDb.admin_actions.unshift(action);
    }

    // Issue warning to post author
    if (authorId) {
      await createAdminWarning(req, authorId, 'post', targetLabel, reason || 'Violation of Community Guidelines');
    }

    // Broadcast over sockets so content disappears live for everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('content:removed', { type: 'post', id });
    }

    return res.status(200).json({ success: true, message: 'Post removed successfully & warning sent to user' });
  } catch (err: any) {
    console.error('Remove post error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. POST /api/admin/room-messages/:id/remove - Remove a room message platform-wide and issue warning
router.post('/room-messages/:id/remove', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin = getAdminDetails(req);

  try {
    let senderId: string | null = null;
    let targetLabel = 'Message #' + id;
    let roomId = null;

    if (process.env.DATABASE_URL) {
      const mRes = await query('SELECT sender_id, content, room_id FROM room_messages WHERE id = $1', [id]);
      if (mRes.rows.length > 0) {
        senderId = mRes.rows[0].sender_id;
        targetLabel = mRes.rows[0].content.substring(0, 30);
        roomId = mRes.rows[0].room_id;
      }
      await query('DELETE FROM room_messages WHERE id = $1', [id]);
      await query(
        'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, admin.name, 'remove_room_message', id, targetLabel, reason || 'Room rules violation']
      );
    } else {
      const msg = mockDb.room_messages.find((m) => m.id === id);
      if (msg) {
        senderId = msg.sender_id;
        targetLabel = msg.content.substring(0, 30);
        roomId = msg.room_id;
      }
      mockDb.room_messages = mockDb.room_messages.filter((m) => m.id !== id);

      const action = {
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'remove_room_message',
        target_id: id,
        target_label: targetLabel,
        reason: reason || 'Room rules violation',
        created_at: new Date().toISOString()
      };
      mockDb.admin_actions.unshift(action);
    }

    // Issue warning to message sender
    if (senderId) {
      await createAdminWarning(req, senderId, 'room_message', targetLabel, reason || 'Inappropriate room message');
    }

    // Broadcast over sockets so content disappears live for everyone
    const io = req.app.get('io');
    if (io) {
      io.emit('content:removed', { type: 'room_message', id, roomId });
    }

    return res.status(200).json({ success: true, message: 'Room message removed successfully & warning sent' });
  } catch (err: any) {
    console.error('Remove room message error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3b. GET /api/admin/rooms - Fetch all platform rooms for moderation monitoring
router.get('/rooms', async (req: AuthRequest, res: Response) => {
  try {
    let rooms: any[] = [];
    if (process.env.DATABASE_URL) {
      const result = await query(`
        SELECT r.*, 
               u.name as creator_name, u.handle as creator_handle,
               (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) as member_count,
               (SELECT COUNT(*) FROM room_messages rmsg WHERE rmsg.room_id = r.id) as message_count
        FROM rooms r
        LEFT JOIN users u ON r.created_by = u.id
        ORDER BY r.created_at DESC
      `);
      rooms = result.rows;
    } else {
      rooms = mockDb.rooms.map((r) => {
        const creator = mockDb.users.find((u) => u.id === r.created_by);
        const members = mockDb.room_members.filter((m) => m.room_id === r.id);
        const messages = mockDb.room_messages.filter((m) => m.room_id === r.id);
        return {
          id: r.id,
          name: r.name,
          type: r.type || 'interest',
          created_by: r.created_by,
          creator_name: creator ? creator.name : 'System / Admin',
          creator_handle: creator ? creator.handle || 'system' : 'system',
          member_count: members.length,
          message_count: messages.length,
          expires_at: r.expires_at || null,
          created_at: r.created_at
        };
      });
    }

    return res.status(200).json(rooms);
  } catch (err: any) {
    console.error('Fetch admin rooms error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3c. POST /api/admin/rooms/:id/delete - Ban and delete an inappropriate room immediately
router.post('/rooms/:id/delete', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin = getAdminDetails(req);

  try {
    let roomName = 'Room #' + id;
    let createdBy: string | null = null;

    let creatorName = '';
    if (process.env.DATABASE_URL) {
      const rRes = await query('SELECT r.name, r.created_by, u.name as creator_name FROM rooms r LEFT JOIN users u ON r.created_by = u.id WHERE r.id = $1', [id]);
      if (rRes.rows.length > 0) {
        roomName = rRes.rows[0].name;
        createdBy = rRes.rows[0].created_by;
        creatorName = rRes.rows[0].creator_name || '';
      }
      await query('DELETE FROM rooms WHERE id = $1', [id]);
      await query('DELETE FROM room_messages WHERE room_id = $1', [id]);
      await query('DELETE FROM room_members WHERE room_id = $1', [id]);
      const targetLabelWithCreator = creatorName ? `Room "${roomName}" (Created by ${creatorName})` : `Room "${roomName}"`;
      await query(
        'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, admin.name, 'delete_room', id, targetLabelWithCreator, reason || 'Inappropriate or harmful room']
      );
    } else {
      const room = mockDb.rooms.find((r) => r.id === id);
      if (room) {
        roomName = room.name;
        createdBy = room.created_by;
        const creator = mockDb.users.find((u) => u.id === room.created_by);
        creatorName = creator ? creator.name : '';
      }
      mockDb.rooms = mockDb.rooms.filter((r) => r.id !== id);
      mockDb.room_messages = mockDb.room_messages.filter((m) => m.room_id !== id);
      mockDb.room_members = mockDb.room_members.filter((m) => m.room_id !== id);

      const targetLabelWithCreator = creatorName ? `Room "${roomName}" (Created by ${creatorName})` : `Room "${roomName}"`;
      mockDb.admin_actions.unshift({
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'delete_room',
        target_id: id,
        target_label: targetLabelWithCreator,
        reason: reason || 'Inappropriate or harmful room',
        created_at: new Date().toISOString()
      });
    }

    // Send official moderation warning to creator if created by a user
    if (createdBy) {
      await createAdminWarning(req, createdBy, 'room', roomName, reason || 'Created an inappropriate room violating community safety policies');
    }

    // Broadcast room termination to all clients over sockets
    const io = req.app.get('io');
    if (io) {
      io.emit('room:deleted', { roomId: id, roomName, reason: reason || 'Terminated by platform administration' });
      io.emit('content:removed', { type: 'room', id });
    }

    return res.status(200).json({ success: true, message: `Room "${roomName}" banned & deleted successfully` });
  } catch (err: any) {
    console.error('Delete room error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. GET /api/admin/reports - Fetch all user reports
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    let reports: any[] = [];

    if (process.env.DATABASE_URL) {
      const result = await query(`
        SELECT r.*, 
               u1.name as reporter_name, 
               u2.name as reported_user_name,
               u2.is_banned as reported_user_banned
        FROM reports r
        LEFT JOIN users u1 ON r.reporter_id = u1.id
        LEFT JOIN users u2 ON r.reported_user_id = u2.id
        ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
      `);
      reports = result.rows;
    } else {
      reports = mockDb.reports.map((r) => {
        const reporter = mockDb.users.find((u) => u.id === r.reporter_id);
        const reported = mockDb.users.find((u) => u.id === r.reported_user_id);
        return {
          ...r,
          reporter_name: reporter ? reporter.name : 'Student',
          reported_user_name: reported ? reported.name : 'Reported User',
          reported_user_banned: reported ? !!reported.is_banned : false
        };
      }).sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return res.status(200).json(reports);
  } catch (err: any) {
    console.error('Fetch admin reports error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. PUT /api/admin/reports/:id - Review / Action / Resolve report status
router.put('/reports/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const admin = getAdminDetails(req);

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    if (process.env.DATABASE_URL) {
      await query('UPDATE reports SET status = $1 WHERE id = $2', [status, id]);
      await query(
        'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, admin.name, 'update_report', id, `Report #${id}`, `Updated report status to ${status}`]
      );
    } else {
      const report = mockDb.reports.find((r) => r.id === id);
      if (report) {
        report.status = status;
      }
      mockDb.admin_actions.unshift({
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'update_report',
        target_id: id,
        target_label: `Report #${id}`,
        reason: `Updated status to ${status}`,
        created_at: new Date().toISOString()
      });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Update report status error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. GET /api/admin/users - List & Search platform users
router.get('/users', async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').toLowerCase().trim();

  try {
    let usersList: any[] = [];

    if (process.env.DATABASE_URL) {
      const sql = q 
        ? 'SELECT id, name, email, handle, year, branch, photos, college_verified, is_admin, is_banned, ban_reason, created_at, ROW_NUMBER() OVER (ORDER BY created_at ASC) as signup_number FROM users WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(handle) LIKE $1 ORDER BY created_at ASC'
        : 'SELECT id, name, email, handle, year, branch, photos, college_verified, is_admin, is_banned, ban_reason, created_at, ROW_NUMBER() OVER (ORDER BY created_at ASC) as signup_number FROM users ORDER BY created_at ASC';
      const params = q ? [`%${q}%`] : [];
      const result = await query(sql, params);
      usersList = result.rows.map((u) => ({
        ...u,
        signup_number: parseInt(u.signup_number || 1),
        is_founding_member: parseInt(u.signup_number || 1000) <= 100
      }));
    } else {
      const sortedUsers = [...mockDb.users].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      usersList = sortedUsers.filter((u) => {
        if (!q) return true;
        return (
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.handle && u.handle.toLowerCase().includes(q))
        );
      }).map((u, idx) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        handle: u.handle,
        year: u.year,
        branch: u.branch,
        photos: u.photos,
        college_verified: u.college_verified,
        is_admin: !!u.is_admin,
        is_banned: !!u.is_banned,
        ban_reason: u.ban_reason || null,
        created_at: u.created_at,
        signup_number: idx + 1,
        is_founding_member: (idx + 1) <= 100
      }));
    }

    return res.status(200).json(usersList);
  } catch (err: any) {
    console.error('Fetch admin users error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7. POST /api/admin/users/:id/ban - Ban user
router.post('/users/:id/ban', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin = getAdminDetails(req);

  try {
    let targetName = 'User ' + id;

    if (process.env.DATABASE_URL) {
      const uRes = await query('SELECT name FROM users WHERE id = $1', [id]);
      if (uRes.rows.length > 0) targetName = uRes.rows[0].name;

      await query('UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2', [reason || 'Banned by admin', id]);
      await query(
        'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, admin.name, 'ban_user', id, targetName, reason || 'Severe policy violation']
      );
    } else {
      const user = mockDb.users.find((u) => u.id === id);
      if (user) {
        user.is_banned = true;
        user.ban_reason = reason || 'Banned by admin';
        targetName = user.name;
      }
      mockDb.admin_actions.unshift({
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'ban_user',
        target_id: id,
        target_label: targetName,
        reason: reason || 'Severe policy violation',
        created_at: new Date().toISOString()
      });
    }

    return res.status(200).json({ success: true, message: `User ${targetName} banned successfully` });
  } catch (err: any) {
    console.error('Ban user error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 8. POST /api/admin/users/:id/unban - Unban user
router.post('/users/:id/unban', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const admin = getAdminDetails(req);

  try {
    let targetName = 'User ' + id;

    if (process.env.DATABASE_URL) {
      const uRes = await query('SELECT name FROM users WHERE id = $1', [id]);
      if (uRes.rows.length > 0) targetName = uRes.rows[0].name;

      await query('UPDATE users SET is_banned = false, ban_reason = NULL WHERE id = $1', [id]);
      await query(
        'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [admin.id, admin.name, 'unban_user', id, targetName, 'Account unbanned by admin review']
      );
    } else {
      const user = mockDb.users.find((u) => u.id === id);
      if (user) {
        user.is_banned = false;
        user.ban_reason = null;
        targetName = user.name;
      }
      mockDb.admin_actions.unshift({
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'unban_user',
        target_id: id,
        target_label: targetName,
        reason: 'Account unbanned by admin review',
        created_at: new Date().toISOString()
      });
    }

    return res.status(200).json({ success: true, message: `User ${targetName} unbanned successfully` });
  } catch (err: any) {
    console.error('Unban user error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. GET /api/admin/actions - Fetch admin audit log trail
router.get('/actions', async (req: AuthRequest, res: Response) => {
  try {
    let actions: any[] = [];

    if (process.env.DATABASE_URL) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS admin_actions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            admin_id TEXT,
            admin_name TEXT,
            action_type TEXT NOT NULL,
            target_id TEXT,
            target_label TEXT,
            reason TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
          );
        `);
        const result = await query('SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 100');
        actions = result.rows;
      } catch (dbErr) {
        console.warn('DB admin_actions query error:', dbErr);
        actions = mockDb.admin_actions || [];
      }
    } else {
      actions = mockDb.admin_actions || [];
    }

    return res.status(200).json(actions);
  } catch (err: any) {
    console.error('Fetch admin actions error:', err);
    return res.status(200).json(mockDb.admin_actions || []);
  }
});

// 10. GET /api/admin/appeals - Fetch ban review appeals
router.get('/appeals', async (req: AuthRequest, res: Response) => {
  try {
    let appeals: any[] = [];
    if (process.env.DATABASE_URL) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS appeals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT,
            user_name TEXT,
            user_email TEXT,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT now()
          );
        `);
        const result = await query('SELECT * FROM appeals ORDER BY created_at DESC');
        appeals = result.rows;
      } catch (dbErr) {
        console.warn('DB appeals query error:', dbErr);
        appeals = mockDb.appeals || [];
      }
    } else {
      appeals = mockDb.appeals || [];
    }
    return res.status(200).json(appeals);
  } catch (err: any) {
    console.error('Fetch admin appeals error:', err);
    return res.status(200).json(mockDb.appeals || []);
  }
});

// 11. PUT /api/admin/appeals/:id - Review appeal (approve/reject)
router.put('/appeals/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, unban } = req.body;
  const admin = getAdminDetails(req);

  try {
    let appeal: any = null;
    if (process.env.DATABASE_URL) {
      try {
        const result = await query('UPDATE appeals SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        appeal = result.rows[0];
      } catch (e) {}
    } else {
      appeal = mockDb.appeals.find((a: any) => a.id === id);
      if (appeal) appeal.status = status;
    }

    if (appeal && unban) {
      // Automatically unban user
      const targetUserId = appeal.user_id;
      if (process.env.DATABASE_URL) {
        try {
          await query('UPDATE users SET is_banned = false, ban_reason = NULL WHERE id::text = $1', [targetUserId]);
          await query(
            'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
            [admin.id, admin.name, 'review_appeal', appeal.user_id, appeal.user_name, 'Approved appeal and unbanned user']
          );
        } catch (e) {}
      } else {
        const u = mockDb.users.find((usr: any) => usr.id === targetUserId);
        if (u) {
          u.is_banned = false;
          u.ban_reason = null;
        }
        mockDb.admin_actions.unshift({
          id: 'act-' + Date.now(),
          admin_id: admin.id,
          admin_name: admin.name,
          action_type: 'review_appeal',
          target_id: appeal.user_id,
          target_label: appeal.user_name,
          reason: `Approved appeal and unbanned user`,
          created_at: new Date().toISOString()
        });
      }
    }

    return res.status(200).json({ success: true, appeal });
  } catch (err: any) {
    console.error('Update appeal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 12. GET /api/admin/feedback - Fetch user feedback & suggestions
router.get('/feedback', async (req: AuthRequest, res: Response) => {
  try {
    let feedbackList: any[] = [];
    if (process.env.DATABASE_URL) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT,
            user_name TEXT,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'feedback',
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT now()
          );
        `);
        const result = await query('SELECT * FROM feedback ORDER BY created_at DESC');
        feedbackList = result.rows;
      } catch (dbErr) {
        console.warn('DB feedback query error:', dbErr);
        feedbackList = mockDb.feedback || [];
      }
    } else {
      feedbackList = mockDb.feedback || [];
    }
    return res.status(200).json(feedbackList);
  } catch (err: any) {
    console.error('Fetch admin feedback error:', err);
    return res.status(200).json(mockDb.feedback || []);
  }
});

// 13. PUT /api/admin/feedback/:id - Update feedback status (reviewed, resolved)
router.put('/feedback/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    if (process.env.DATABASE_URL) {
      await query('UPDATE feedback SET status = $1 WHERE id = $2', [status, id]);
    } else {
      const item = mockDb.feedback.find((f: any) => f.id === id);
      if (item) item.status = status;
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Update feedback status error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 14. POST /api/admin/broadcast - Broadcast message to all platform users
router.post('/broadcast', async (req: AuthRequest, res: Response) => {
  const { title, message, urgency } = req.body;
  const admin = getAdminDetails(req);

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Broadcast message content is required' });
  }

  const broadcastTitle = title && title.trim() ? title.trim() : '📢 Campus Announcement';
  const broadcastMsg = message.trim();
  const broadcastId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    let targetUserIds: string[] = [];

    if (process.env.DATABASE_URL) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS warnings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT,
            admin_id TEXT,
            content_type TEXT NOT NULL,
            item_title TEXT,
            reason TEXT NOT NULL,
            warning_message TEXT NOT NULL,
            read BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now()
          );
        `);

        // Insert global broadcast row
        await query(
          'INSERT INTO warnings (id, user_id, admin_id, content_type, item_title, warning_message, reason, created_at, read) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [crypto.randomUUID(), 'GLOBAL', admin.id, 'broadcast', broadcastTitle, broadcastMsg, 'Official Campus Broadcast', createdAt, false]
        );
      } catch (dbErr) {
        console.warn('DB broadcast insert error:', dbErr);
      }

      try {
        await query(
          'INSERT INTO admin_actions (admin_id, admin_name, action_type, target_id, target_label, reason) VALUES ($1, $2, $3, $4, $5, $6)',
          [admin.id, admin.name, 'broadcast_message', broadcastId, broadcastTitle, broadcastMsg.substring(0, 50)]
        );
      } catch (e) {}
    } else {
      mockDb.warnings.unshift({
        id: crypto.randomUUID(),
        user_id: 'GLOBAL',
        admin_id: admin.id,
        content_type: 'broadcast',
        item_title: broadcastTitle,
        warning_message: broadcastMsg,
        reason: 'Official Campus Broadcast',
        created_at: createdAt,
        read: false
      });

      mockDb.admin_actions.unshift({
        id: 'act-' + Date.now(),
        admin_id: admin.id,
        admin_name: admin.name,
        action_type: 'broadcast_message',
        target_id: broadcastId,
        target_label: broadcastTitle,
        reason: broadcastMsg.substring(0, 50),
        created_at: createdAt
      });
    }

    // Broadcast real-time Socket.IO notification to all connected users
    const io = req.app.get('io');
    if (io) {
      io.emit('broadcast:announcement', {
        id: broadcastId,
        title: broadcastTitle,
        message: broadcastMsg,
        urgency: urgency || 'normal',
        created_at: createdAt
      });
    }

    return res.status(200).json({
      success: true,
      message: `Broadcast successfully sent to all ${targetUserIds.length} users!`,
      recipient_count: targetUserIds.length
    });
  } catch (err: any) {
    console.error('Broadcast message error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 15. GET /api/admin/pre-registrations - List all pre-registered students & waitlist positions
router.get('/pre-registrations', async (req: AuthRequest, res: Response) => {
  try {
    let preRegistrations: any[] = [];

    if (process.env.DATABASE_URL) {
      try {
        await query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT;
        `);
      } catch (e) {
        // columns already exist
      }

      const result = await query(`
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.handle,
          u.google_id, 
          u.college_verified, 
          u.is_banned, 
          u.is_admin, 
          u.created_at, 
          u.photos,
          u.referred_by,
          u.ref_code,
          (
            SELECT COUNT(*)::int 
            FROM users r 
            WHERE LOWER(r.referred_by) = LOWER(u.email) 
               OR (u.ref_code IS NOT NULL AND LOWER(r.referred_by) = LOWER(u.ref_code))
          ) AS referral_count
        FROM users u 
        ORDER BY created_at ASC
      `);
      preRegistrations = result.rows;
    } else {
      preRegistrations = mockDb.users.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    // Attach signup index position and Founding Member badge rank & referral stats
    const preRegList = preRegistrations.map((u, index) => {
      const position = index + 1;
      const isFounder = position <= 100;
      const cleanEmail = u.email || '';
      const generatedCode = u.ref_code || `ROGUE-${cleanEmail.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

      return {
        id: u.id,
        name: u.name || 'Anonymous Student',
        email: u.email,
        handle: u.handle || null,
        google_id: u.google_id || null,
        college_verified: !!u.college_verified,
        is_admin: !!u.is_admin,
        is_banned: !!u.is_banned,
        created_at: u.created_at,
        photos: u.photos || [],
        position: position,
        founder_badge: isFounder ? `Founder #${String(position).padStart(3, '0')}` : null,
        ref_code: generatedCode,
        referred_by: u.referred_by || 'Direct / Organic',
        referral_count: parseInt(u.referral_count || '0', 10)
      };
    });

    return res.status(200).json(preRegList);
  } catch (err: any) {
    console.error('Fetch pre-registrations error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 16. GET /api/admin/poster-events — Rogue Teaser: who downloaded / shared a poster
router.get('/poster-events', async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json([]);
    }

    await query(`
      CREATE TABLE IF NOT EXISTS poster_events (
        id          SERIAL PRIMARY KEY,
        email       TEXT NOT NULL,
        action      TEXT NOT NULL,
        poster_theme TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await query(`
      SELECT
        pe.id,
        pe.email,
        u.name,
        u.handle,
        pe.action,
        pe.poster_theme,
        pe.created_at
      FROM poster_events pe
      LEFT JOIN users u ON LOWER(u.email) = LOWER(pe.email)
      ORDER BY pe.created_at DESC
      LIMIT 500
    `);

    return res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('Fetch poster-events error:', err);
    return res.status(200).json([]);
  }
});

export default router;
