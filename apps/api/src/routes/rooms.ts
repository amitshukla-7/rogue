import { Router, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import { query, mockDb } from '../db/index.js';
import { authenticateToken, requireCollegeVerified, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ==========================================
// FLASH HANGOUTS API ENDPOINTS ("Who's Up For...")
// ==========================================

export const cleanupExpiredHangouts = async () => {
  const now = new Date();
  if (mockDb.flash_hangouts) {
    mockDb.flash_hangouts = mockDb.flash_hangouts.filter((h: any) => new Date(h.expires_at) > now);
  }

  if (process.env.DATABASE_URL) {
    try {
      const expiredRes = await query(
        `SELECT room_id FROM flash_hangouts WHERE expires_at <= $1 
         UNION 
         SELECT id as room_id FROM rooms WHERE type = 'flash' AND expires_at <= $1`, 
        [now.toISOString()]
      );
      const expiredRoomIds = expiredRes.rows.map((r: any) => r.room_id).filter(Boolean);

      if (expiredRoomIds.length > 0) {
        await query(
          `DELETE FROM room_message_reactions 
           WHERE message_id::text IN (
             SELECT id::text FROM room_messages WHERE room_id::text = ANY($1::text[])
           )`,
          [expiredRoomIds]
        );
        await query('DELETE FROM room_messages WHERE room_id::text = ANY($1::text[])', [expiredRoomIds]);
        await query('DELETE FROM room_members WHERE room_id::text = ANY($1::text[])', [expiredRoomIds]);
        await query('DELETE FROM flash_hangouts WHERE room_id::text = ANY($1::text[]) OR id::text = ANY($1::text[])', [expiredRoomIds]);
        await query("DELETE FROM rooms WHERE id::text = ANY($1::text[]) OR (type = 'flash' AND expires_at <= $2)", [expiredRoomIds, now.toISOString()]);

        console.log(`[Auto-Purge] Expired ${expiredRoomIds.length} flash room(s) and associated data permanently from database.`);
      }
    } catch (err) {
      console.error('Error auto-cleaning expired hangouts:', err);
    }
  }
};

// GET active flash hangouts
router.get('/hangouts', async (req: AuthRequest, res: Response) => {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev') as any;
        req.user = decoded;
      } catch (err) {}
    }

    await cleanupExpiredHangouts();
    const now = new Date();

    if (process.env.DATABASE_URL) {
      const dbHangoutsRes = await query(`
        SELECT h.*, 
               u.name as creator_name, 
               u.photos[1] as creator_photo, 
               u.year as creator_year, 
               u.branch as creator_branch
        FROM flash_hangouts h
        LEFT JOIN users u ON u.id::text = h.creator_id::text
        WHERE h.expires_at > NOW()
        ORDER BY h.created_at DESC
      `);

      const hangouts = await Promise.all(dbHangoutsRes.rows.map(async (h: any) => {
        let joinedUserIds: string[] = Array.isArray(h.joined_user_ids) ? h.joined_user_ids : [];
        
        let joinedMembers: any[] = [];
        if (joinedUserIds.length > 0) {
          const membersRes = await query(`
            SELECT id, name, photos[1] as photo, name as handle
            FROM users 
            WHERE id::text = ANY($1::text[])
          `, [joinedUserIds]);
          joinedMembers = membersRes.rows;
        }

        return {
          id: h.id,
          room_id: h.room_id,
          creator_id: h.creator_id,
          creator_name: h.creator_name || 'Student Host',
          creator_photo: h.creator_photo || null,
          creator_tag: `${h.creator_year || 'Student'} • ${h.creator_branch || 'Campus'}`,
          title: h.title,
          location: h.location,
          category: h.category,
          category_label: h.category_label,
          category_emoji: h.category_emoji,
          max_participants: h.max_participants || 4,
          joined_user_ids: joinedUserIds,
          joined_members: joinedMembers,
          expires_at: h.expires_at,
          created_at: h.created_at
        };
      }));

      return res.status(200).json(hangouts);
    }

    // Auto cleanup expired hangouts in mock DB
    if (mockDb.flash_hangouts) {
      mockDb.flash_hangouts = mockDb.flash_hangouts.filter((h: any) => new Date(h.expires_at) > now);
    }

    const activeHangouts = (mockDb.flash_hangouts || []).filter((h: any) => new Date(h.expires_at) > now);

    const enriched = activeHangouts.map((h: any) => {
      const creator = mockDb.users.find((u: any) => u.id === h.creator_id);
      const joinedUsers = (h.joined_user_ids || []).map((uid: string) => {
        const u = mockDb.users.find((user: any) => user.id === uid);
        return u ? { id: u.id, name: u.name, photo: u.photos?.[0], handle: u.handle } : { id: uid, name: 'Student', photo: null };
      });

      return {
        ...h,
        creator_name: creator ? creator.name : h.creator_name,
        creator_photo: creator && creator.photos?.[0] ? creator.photos[0] : h.creator_photo,
        joined_members: joinedUsers
      };
    });

    return res.status(200).json(enriched);
  } catch (err: any) {
    console.error('Fetch hangouts error:', err);
    return res.status(200).json([]);
  }
});

// POST create a flash hangout (micro-request)
router.post('/hangouts', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { title, location, category, durationMinutes, maxParticipants } = req.body;
  const userId = req.user?.id;

  if (!userId || !title || !location) {
    return res.status(400).json({ error: 'Title and location are required' });
  }

  try {
    const user = mockDb.users.find((u: any) => u.id === userId) || req.user;
    const duration = parseInt(durationMinutes) || 120;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    const roomId = 'flash-room-' + Date.now();
    const hangoutId = 'hangout-' + Date.now();

    const categoryEmojiMap: Record<string, { emoji: string; label: string }> = {
      study: { emoji: '📚', label: 'Study & Library' },
      food: { emoji: '🍔', label: 'Food & Canteen' },
      sports: { emoji: '🏸', label: 'Sports & Games' },
      coffee: { emoji: '☕', label: 'Coffee & Chill' },
      gaming: { emoji: '🎮', label: 'Gaming & Esports' },
      other: { emoji: '✨', label: 'Campus Meetup' }
    };

    const catKey = (category || 'other').toLowerCase();
    const catInfo = categoryEmojiMap[catKey] || categoryEmojiMap.other;

    const roomObj = {
      id: roomId,
      name: title.trim().slice(0, 35),
      type: 'flash',
      is_official: true,
      is_private: false,
      member_count: 1,
      created_by: userId,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    // DB Persistence
    if (process.env.DATABASE_URL) {
      try {
        await query(
          'INSERT INTO rooms (id, name, type, created_by, expires_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [roomId, title.trim().slice(0, 35), 'flash', userId, expiresAt]
        );
        await query(
          'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [roomId, userId]
        );
        await query(
          `INSERT INTO flash_hangouts (id, room_id, creator_id, title, location, category, category_label, category_emoji, max_participants, joined_user_ids, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
          [hangoutId, roomId, userId, title.trim(), location.trim(), catKey, catInfo.label, catInfo.emoji, parseInt(maxParticipants) || 4, [userId], expiresAt]
        );
      } catch (dbErr) {
        console.error('Database save error for flash room:', dbErr);
      }
    }

    // Fallback/sync in memory
    mockDb.rooms.push(roomObj);
    mockDb.room_members.push({ room_id: roomId, user_id: userId, joined_at: new Date().toISOString() });

    const newHangout = {
      id: hangoutId,
      room_id: roomId,
      creator_id: userId,
      creator_name: user ? user.name : 'Student Host',
      creator_handle: user ? user.handle || 'student' : 'student',
      creator_photo: user && user.photos ? user.photos[0] : null,
      creator_tag: `${user?.year || 'Student'} • ${user?.branch || 'Campus'}`,
      category: catKey,
      category_label: catInfo.label,
      category_emoji: catInfo.emoji,
      title: title.trim(),
      location: location.trim(),
      max_participants: parseInt(maxParticipants) || 4,
      joined_user_ids: [userId],
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    if (!mockDb.flash_hangouts) mockDb.flash_hangouts = [];
    mockDb.flash_hangouts.unshift(newHangout);

    return res.status(201).json(newHangout);
  } catch (err: any) {
    console.error('Create hangout error:', err);
    return res.status(500).json({ error: 'Failed to create hangout' });
  }
});

// POST join a flash hangout
router.post('/hangouts/:id/join', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let hangout: any = null;

    if (process.env.DATABASE_URL) {
      const dbHangoutRes = await query('SELECT * FROM flash_hangouts WHERE id = $1 OR room_id = $1', [id]);
      if (dbHangoutRes.rows.length > 0) {
        hangout = dbHangoutRes.rows[0];
      }
    }

    if (!hangout) {
      hangout = (mockDb.flash_hangouts || []).find((h: any) => h.id === id || h.room_id === id);
    }

    if (!hangout) {
      return res.status(404).json({ error: 'Hangout not found or expired' });
    }

    if (new Date(hangout.expires_at) <= new Date()) {
      return res.status(400).json({ error: 'This hangout has expired' });
    }

    let joinedUserIds: string[] = Array.isArray(hangout.joined_user_ids) ? hangout.joined_user_ids : [];

    if (!joinedUserIds.includes(userId)) {
      if (joinedUserIds.length >= (hangout.max_participants || 4)) {
        return res.status(400).json({ error: 'Hangout is already full!' });
      }
      joinedUserIds.push(userId);
    }

    if (process.env.DATABASE_URL) {
      try {
        await query('UPDATE flash_hangouts SET joined_user_ids = $1 WHERE id = $2', [joinedUserIds, hangout.id]);
        await query('INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [hangout.room_id, userId]);
      } catch (dbErr) {
        console.error('Join DB error:', dbErr);
      }
    }

    const mockH = (mockDb.flash_hangouts || []).find((h: any) => h.id === id || h.room_id === id);
    if (mockH && !mockH.joined_user_ids.includes(userId)) {
      mockH.joined_user_ids.push(userId);
    }
    const roomMemberExists = (mockDb.room_members || []).some((m: any) => m.room_id === hangout.room_id && m.user_id === userId);
    if (!roomMemberExists) {
      mockDb.room_members.push({ room_id: hangout.room_id, user_id: userId, joined_at: new Date().toISOString() });
    }

    return res.status(200).json({ success: true, room_id: hangout.room_id });
  } catch (err: any) {
    console.error('Join hangout error:', err);
    return res.status(500).json({ error: 'Failed to join hangout' });
  }
});

// DELETE a flash hangout & its room (Creator or Admin only)
router.delete('/hangouts/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || (req as any).user?.userId;

  try {
    let hangout: any = null;

    if (process.env.DATABASE_URL) {
      const dbH = await query('SELECT * FROM flash_hangouts WHERE id = $1 OR room_id = $1', [id]);
      if (dbH.rows.length > 0) hangout = dbH.rows[0];
    }

    if (!hangout) {
      hangout = (mockDb.flash_hangouts || []).find((h: any) => h.id === id || h.room_id === id);
    }

    const roomId = hangout ? hangout.room_id : id;
    const isOwner = hangout ? (hangout.creator_id?.toString() === userId?.toString()) : true;
    const isAdmin = req.user?.email === 'admin@campusconnect.com';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the creator can delete this meetup' });
    }

    mockDb.flash_hangouts = (mockDb.flash_hangouts || []).filter((h: any) => h.id !== id && h.room_id !== id);
    mockDb.rooms = (mockDb.rooms || []).filter((r: any) => r.id !== roomId && r.id !== id);
    mockDb.room_members = (mockDb.room_members || []).filter((m: any) => m.room_id !== roomId && m.room_id !== id);
    mockDb.room_messages = (mockDb.room_messages || []).filter((m: any) => m.room_id !== roomId && m.room_id !== id);

    if (process.env.DATABASE_URL) {
      try {
        await query('DELETE FROM flash_hangouts WHERE id = $1 OR room_id = $1', [id]);
        await query('DELETE FROM room_messages WHERE room_id = $1', [roomId]);
        await query('DELETE FROM room_members WHERE room_id = $1', [roomId]);
        await query('DELETE FROM rooms WHERE id = $1', [roomId]);
      } catch (dbErr) {
        console.warn('DB delete room error:', dbErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Flash meetup deleted successfully' });
  } catch (err: any) {
    console.error('Delete hangout error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET active rooms sorted by recent activity (Filtered by visibility and squad membership)
router.get('/', async (req: AuthRequest, res: Response) => {
  let token = req.cookies?.token;
  if (!token && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev') as any;
      req.user = decoded;
    } catch (err) {}
  }

  const currentUserId = req.user?.id;
  const now = new Date();

  // Automatic deletion of expired rooms & hangouts
  if (process.env.DATABASE_URL) {
    try {
      await query('DELETE FROM room_messages WHERE room_id IN (SELECT id FROM rooms WHERE expires_at IS NOT NULL AND expires_at <= NOW())');
      await query('DELETE FROM room_members WHERE room_id IN (SELECT id FROM rooms WHERE expires_at IS NOT NULL AND expires_at <= NOW())');
      await query('DELETE FROM rooms WHERE expires_at IS NOT NULL AND expires_at <= NOW()');
    } catch (cleanErr) {}
  }
  if (mockDb.rooms) {
    mockDb.rooms = mockDb.rooms.filter((r: any) => !r.expires_at || new Date(r.expires_at) > now);
  }
  if (mockDb.flash_hangouts) {
    mockDb.flash_hangouts = mockDb.flash_hangouts.filter((h: any) => !h.expires_at || new Date(h.expires_at) > now);
  }

  try {
    let rooms: any[] = [];
    if (process.env.DATABASE_URL) {
      try {
        const roomsResult = await query('SELECT * FROM rooms WHERE expires_at IS NULL OR expires_at > NOW()');
        rooms = roomsResult.rows || [];
      } catch (dbErr) {
        rooms = [];
      }
    }

    if (!rooms || rooms.length === 0) {
      rooms = (mockDb.rooms || []).filter((r: any) => !r.expires_at || new Date(r.expires_at) > now);
    }

    const enhancedRooms = [];
    for (const r of rooms) {
      let members: any[] = [];
      try {
        const membersResult = await query('SELECT * FROM room_members WHERE room_id::text = $1::text', [r.id.toString()]);
        members = membersResult.rows || [];
      } catch (e) {
        members = (mockDb.room_members || []).filter((m: any) => m.room_id === r.id);
      }

      const memberUserIds = members.map((m: any) => m.user_id?.toString());
      
      const PERMANENT_LOUNGES = ['lounge-general', 'lounge-tech', 'lounge-gaming', 'lounge-latenight', 'lounge-anime'];
      const isPermanentLounge = PERMANENT_LOUNGES.includes(r.id) || (r.is_official && r.id.startsWith('lounge-'));
      const isMember = currentUserId ? (memberUserIds.includes(currentUserId.toString()) || r.created_by?.toString() === currentUserId.toString()) : false;

      // Visibility: Only show permanent lounges and rooms the current user created or joined
      if (!isPermanentLounge && !isMember) {
        continue;
      }

      let lastMsg = null;
      try {
        const lastMsgResult = await query('SELECT * FROM room_messages WHERE room_id::text = $1::text ORDER BY sent_at DESC LIMIT 1', [r.id.toString()]);
        lastMsg = lastMsgResult.rows[0] || null;
      } catch (e) {
        const roomMsgs = (mockDb.room_messages || []).filter((m: any) => m.room_id === r.id);
        lastMsg = roomMsgs[roomMsgs.length - 1] || null;
      }
      
      enhancedRooms.push({
        ...r,
        member_count: members.length || 1,
        last_message: lastMsg
      });
    }

    enhancedRooms.sort((a, b) => {
      const timeA = a.last_message ? new Date(a.last_message.sent_at).getTime() : new Date(a.created_at || Date.now()).getTime();
      const timeB = b.last_message ? new Date(b.last_message.sent_at).getTime() : new Date(b.created_at || Date.now()).getTime();
      return timeB - timeA;
    });

    return res.status(200).json(enhancedRooms);
  } catch (err: any) {
    console.error('Fetch rooms error:', err);
    return res.status(200).json(mockDb.rooms || []);
  }
});

// GET public, no-auth preview of a room (for invite links)
router.get('/:id/preview', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    let room: any = null;
    try {
      const roomsResult = await query('SELECT * FROM rooms WHERE id = $1', [id]);
      room = roomsResult.rows[0];
    } catch (e) {}

    if (!room) {
      room = (mockDb.rooms || []).find((r: any) => r.id === id);
    }

    if (!room) {
      room = mockDb.rooms[0] || { id, name: 'Campus Lounge ☕', is_official: true };
    }

    let memberCount = 1;
    try {
      const membersResult = await query('SELECT * FROM room_members WHERE room_id = $1', [id]);
      memberCount = membersResult.rows.length || 1;
    } catch (e) {
      memberCount = (mockDb.room_members || []).filter((m: any) => m.room_id === id).length || 1;
    }

    let lastMsg = null;
    try {
      const lastMsgResult = await query('SELECT * FROM room_messages WHERE room_id = $1 ORDER BY sent_at DESC LIMIT 1', [id]);
      lastMsg = lastMsgResult.rows[0] || null;
    } catch (e) {}

    return res.status(200).json({
      ...room,
      member_count: memberCount,
      last_message: lastMsg
    });
  } catch (err: any) {
    console.error('Room preview error:', err);
    const fallbackRoom = (mockDb.rooms || []).find((r: any) => r.id === id) || mockDb.rooms[0];
    return res.status(200).json({
      ...fallbackRoom,
      member_count: 1
    });
  }
});

// POST create a room (requires college verification)
router.post('/', authenticateToken, requireCollegeVerified, async (req: AuthRequest, res: Response) => {
  const { name, type, interestId, expiresInHours } = req.body;
  const userId = req.user?.id;

  if (!name || !type || !userId) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    let expiresAt = null;
    if (type === 'plan' && expiresInHours) {
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    }

    const roomResult = await query(
      'INSERT INTO rooms (name, type, interest_id, created_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [name, type, interestId || null, userId, expiresAt]
    );
    const room = roomResult.rows[0];

    // Auto join the creator
    await query('INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)', [room.id, userId]);

    return res.status(201).json(room);
  } catch (err: any) {
    console.error('Create room error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST join a private squad room by squad invite code
router.post('/join-by-code', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!code || !code.trim()) return res.status(400).json({ error: 'Squad code is required' });

  try {
    const cleanCode = code.trim().toUpperCase();
    const roomMatch = mockDb.rooms.find(
      (r: any) => r.invite_code && r.invite_code.toUpperCase() === cleanCode
    );

    if (!roomMatch) {
      return res.status(404).json({ error: 'Invalid Squad Code. Room not found or closed.' });
    }

    // Auto join
    const memberCheck = await query('SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2', [roomMatch.id, userId]);
    if (memberCheck.rows.length === 0) {
      await query('INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)', [roomMatch.id, userId]);
    }

    return res.status(200).json({ success: true, room: roomMatch });
  } catch (err: any) {
    console.error('Join by code error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST join a room
router.post('/:id/join', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Check if room is a Flash Hangout with member limits
    let hangout: any = null;
    if (process.env.DATABASE_URL) {
      try {
        const hRes = await query('SELECT * FROM flash_hangouts WHERE room_id::text = $1::text OR id::text = $1::text', [id]);
        if (hRes.rows.length > 0) hangout = hRes.rows[0];
      } catch (e) {}
    }
    if (!hangout) {
      hangout = (mockDb.flash_hangouts || []).find((h: any) => h.room_id === id || h.id === id);
    }

    if (hangout) {
      const maxParticipants = hangout.max_participants || 4;
      let joinedUserIds: string[] = Array.isArray(hangout.joined_user_ids) ? hangout.joined_user_ids : [];
      
      if (!joinedUserIds.includes(userId)) {
        if (joinedUserIds.length >= maxParticipants) {
          return res.status(403).json({ error: 'This Flash Meetup room is already full!' });
        }
        joinedUserIds.push(userId);

        if (process.env.DATABASE_URL) {
          try {
            await query('UPDATE flash_hangouts SET joined_user_ids = $1 WHERE id::text = $2::text', [joinedUserIds, hangout.id]);
          } catch (e) {}
        }
        const mockH = (mockDb.flash_hangouts || []).find((h: any) => h.id === hangout.id);
        if (mockH && !mockH.joined_user_ids.includes(userId)) {
          mockH.joined_user_ids.push(userId);
        }
      }
    }

    const memberExists = (mockDb.room_members || []).some((m: any) => m.room_id === id && m.user_id === userId);
    if (!memberExists) {
      mockDb.room_members.push({ room_id: id, user_id: userId, joined_at: new Date().toISOString() });
    }

    try {
      await query('INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userId]);
    } catch (dbErr) {}

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Join room error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET room active members list
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    let members: any[] = [];
    if (process.env.DATABASE_URL) {
      try {
        const dbMembers = await query(
          `SELECT u.id, u.name, u.handle, u.photos, u.branch, u.year, u.college_verified
           FROM room_members rm
           JOIN users u ON (rm.user_id::text = u.id::text OR LOWER(rm.user_id::text) = LOWER(u.email::text))
           WHERE rm.room_id::text = $1::text`,
          [id.toString()]
        );
        if (dbMembers.rows && dbMembers.rows.length > 0) {
          members = dbMembers.rows.map(u => ({
            id: u.id,
            name: (u.name || 'Campus Student').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}]/gu, '').trim(),
            handle: u.handle || (u.name ? u.name.toLowerCase().replace(/\s+/g, '_') : 'student'),
            photos: u.photos || [],
            branch: u.branch || 'Student',
            year: u.year || '',
            college_verified: u.college_verified ?? true
          }));
        }

        if (members.length === 0) {
          const hRes = await query('SELECT * FROM flash_hangouts WHERE room_id::text = $1::text OR id::text = $1::text', [id.toString()]);
          if (hRes.rows.length > 0) {
            const hangout = hRes.rows[0];
            const joinedUserIds: string[] = Array.isArray(hangout.joined_user_ids) ? hangout.joined_user_ids : [];
            if (joinedUserIds.length > 0) {
              const uRes = await query(
                'SELECT id, name, handle, photos, branch, year, college_verified FROM users WHERE id::text = ANY($1::text[])',
                [joinedUserIds.map(uid => uid.toString())]
              );
              if (uRes.rows.length > 0) {
                members = uRes.rows.map(u => ({
                  id: u.id,
                  name: (u.name || 'Campus Student').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}]/gu, '').trim(),
                  handle: u.handle || (u.name ? u.name.toLowerCase().replace(/\s+/g, '_') : 'student'),
                  photos: u.photos || [],
                  branch: u.branch || 'Student',
                  year: u.year || '',
                  college_verified: u.college_verified ?? true
                }));
              }
            }
          }
        }
      } catch (e) {
        console.error('Fetch room members error:', e);
      }
    }

    if (members.length === 0) {
      const memberRows = (mockDb.room_members || []).filter((rm: any) => rm.room_id === id);
      members = memberRows.map((rm: any) => {
        const u = mockDb.users.find((user: any) => user.id === rm.user_id);
        if (u) {
          return {
            id: u.id,
            name: (u.name || 'Campus Student').replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}]/gu, '').trim(),
            handle: u.handle,
            photos: u.photos,
            branch: u.branch,
            year: u.year,
            college_verified: u.college_verified
          };
        }
        return { id: rm.user_id, name: 'Student', handle: 'student', photos: [] };
      });
    }

    return res.status(200).json(members);
  } catch (err: any) {
    console.error('Fetch room members error:', err);
    return res.status(200).json([]);
  }
});

// POST leave a room
router.post('/:id/leave', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (process.env.DATABASE_URL) {
      try {
        await query('DELETE FROM room_members WHERE room_id::text = $1::text AND user_id::text = $2::text', [id, userId.toString()]);
        
        // Remove user from flash_hangouts joined_user_ids list to free up a seat!
        const hRes = await query('SELECT * FROM flash_hangouts WHERE room_id::text = $1::text OR id::text = $1::text', [id]);
        if (hRes.rows.length > 0) {
          const hangout = hRes.rows[0];
          let joinedUserIds: string[] = Array.isArray(hangout.joined_user_ids) ? hangout.joined_user_ids : [];
          joinedUserIds = joinedUserIds.filter((uid: string) => uid?.toString() !== userId?.toString());
          await query('UPDATE flash_hangouts SET joined_user_ids = $1 WHERE id::text = $2::text', [joinedUserIds, hangout.id]);
        }
      } catch (dbErr) {
        console.error('Leave room DB error:', dbErr);
      }
    }

    if (mockDb.room_members) {
      mockDb.room_members = mockDb.room_members.filter((m: any) => !(m.room_id === id && m.user_id?.toString() === userId?.toString()));
    }
    if (mockDb.flash_hangouts) {
      const mockH = mockDb.flash_hangouts.find((h: any) => h.room_id === id || h.id === id);
      if (mockH && Array.isArray(mockH.joined_user_ids)) {
        mockH.joined_user_ids = mockH.joined_user_ids.filter((uid: string) => uid?.toString() !== userId?.toString());
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Leave room error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE / POST close a room — Completely purges room & all message history (ephemeral)
const closeRoomHandler = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const roomRes = await query('SELECT * FROM rooms WHERE id::text = $1::text', [id]);
    if (roomRes.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = roomRes.rows[0];

    // Creator or Admin can close room
    const isCreator = room.created_by?.toString() === userId?.toString();
    const isAdmin = req.user?.is_admin || req.user?.email === 'admin@campusconnect.com';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the room creator or admin can close this room' });
    }

    // 1. Purge reactions
    await query('DELETE FROM room_message_reactions WHERE message_id::text IN (SELECT id::text FROM room_messages WHERE room_id::text = $1::text)', [id]);
    // 2. Purge room messages
    await query('DELETE FROM room_messages WHERE room_id::text = $1::text', [id]);
    // 3. Purge room members
    await query('DELETE FROM room_members WHERE room_id::text = $1::text', [id]);
    // 4. Delete flash hangout card & room
    await query('DELETE FROM flash_hangouts WHERE room_id::text = $1::text OR id::text = $1::text', [id]);
    await query('DELETE FROM rooms WHERE id::text = $1::text', [id]);

    if (mockDb.rooms) mockDb.rooms = mockDb.rooms.filter((r: any) => r.id !== id);
    if (mockDb.flash_hangouts) mockDb.flash_hangouts = mockDb.flash_hangouts.filter((h: any) => h.room_id !== id && h.id !== id);
    if (mockDb.room_members) mockDb.room_members = mockDb.room_members.filter((m: any) => m.room_id !== id);

    return res.status(200).json({ 
      success: true, 
      message: 'Room closed and message history permanently purged.' 
    });
  } catch (err: any) {
    console.error('Close room error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

router.delete('/:id', authenticateToken, closeRoomHandler);
router.post('/:id/close', authenticateToken, closeRoomHandler);

// POST send a message in a room
router.post('/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content, replyToId, replyToName, replyToContent } = req.body;
  const userId = req.user?.id || (req as any).user?.userId;

  if (!userId || !content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    let rawMessage: any = null;
    let sender: any = null;

    if (process.env.DATABASE_URL) {
      try {
        const result = await query(
          'INSERT INTO room_messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
          [id, userId, content.trim()]
        );
        if (result.rows.length > 0) rawMessage = result.rows[0];

        const senderRes = await query('SELECT name, handle, photos FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1)', [userId]);
        if (senderRes.rows.length > 0) sender = senderRes.rows[0];
      } catch (dbErr) {
        console.warn('DB room message error:', dbErr);
      }
    }

    if (!sender) {
      sender = mockDb.users.find((u: any) => u.id?.toString() === userId?.toString() || u.email === req.user?.email);
    }

    const senderName = sender?.name || (req.user as any)?.name || req.user?.email?.split('@')[0] || 'Student';
    const senderHandle = sender?.handle || (senderName ? senderName.toLowerCase().replace(/\s+/g, '_') : 'student');
    const senderPhoto = sender?.photos && sender.photos[0] ? sender.photos[0] : null;

    const message = {
      id: rawMessage?.id || `msg-${Date.now()}`,
      room_id: id,
      sender_id: userId,
      content: content.trim(),
      sent_at: rawMessage?.sent_at || new Date().toISOString(),
      sender_name: senderName,
      sender_handle: senderHandle,
      sender_photo: senderPhoto,
      reply_to_id: replyToId || null,
      reply_to_name: replyToName || null,
      reply_to_content: replyToContent || null
    };

    if (!mockDb.room_messages) mockDb.room_messages = [];
    mockDb.room_messages.push(message);

    return res.status(201).json(message);
  } catch (err: any) {
    console.error('Post room message error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET room message history
router.get('/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    let messages: any[] = [];
    if (process.env.DATABASE_URL) {
      try {
        const messagesResult = await query(`
          SELECT m.*, u.name as user_name, u.handle as user_handle, u.photos as user_photos, u.is_banned
          FROM room_messages m
          LEFT JOIN users u ON (m.sender_id::text = u.id::text OR LOWER(m.sender_id::text) = LOWER(u.email::text))
          WHERE m.room_id::text = $1::text
          ORDER BY m.sent_at ASC
        `, [id]);
        if (messagesResult.rows.length > 0) {
          messages = messagesResult.rows.map(m => ({
            id: m.id,
            room_id: m.room_id,
            sender_id: m.sender_id,
            content: m.content,
            sent_at: m.sent_at,
            sender_name: m.user_name || m.sender_name || 'Student',
            sender_handle: m.user_handle || m.sender_handle || 'student',
            sender_photo: m.user_photos && m.user_photos[0] ? m.user_photos[0] : m.sender_photo,
            sender_banned: !!m.is_banned
          }));

          const msgIds = messages.map(m => m.id);
          const reactionsRes = await query(`
            SELECT message_id, emoji, array_agg(user_id) as user_ids
            FROM room_message_reactions
            WHERE message_id::text = ANY($1::text[])
            GROUP BY message_id, emoji
          `, [msgIds]);

          const rxMap: Record<string, Record<string, string[]>> = {};
          reactionsRes.rows.forEach((row: any) => {
            if (!rxMap[row.message_id]) rxMap[row.message_id] = {};
            rxMap[row.message_id][row.emoji] = row.user_ids || [];
          });

          messages = messages.map(m => ({
            ...m,
            reactions: rxMap[m.id] || {}
          }));
        }
      } catch (e) {}
    }

    if (messages.length === 0) {
      const mockMsgs = (mockDb.room_messages || []).filter((m: any) => m.room_id === id);
      messages = mockMsgs.map((msg: any) => {
        const sender = mockDb.users.find((u: any) => u.id === msg.sender_id);
        return {
          ...msg,
          sender_name: sender ? sender.name : (msg.sender_name || 'Student'),
          sender_handle: sender ? sender.handle : (msg.sender_handle || 'student'),
          sender_photo: sender && sender.photos && sender.photos[0] ? sender.photos[0] : msg.sender_photo,
          sender_banned: sender ? !!sender.is_banned : false,
          reactions: msg.reactions || {}
        };
      });
    }

    return res.status(200).json(messages);
  } catch (err: any) {
    console.error('Fetch room messages error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/rooms/:id/messages/:messageId - Delete a message from a room chat
router.delete('/:id/messages/:messageId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id: roomId, messageId } = req.params;
  const userId = req.user?.id || (req as any).user?.userId;

  try {
    const msgIdx = (mockDb.room_messages || []).findIndex((m: any) => m.id === messageId && m.room_id === roomId);
    const msg = msgIdx !== -1 ? mockDb.room_messages[msgIdx] : null;

    let dbMsg: any = null;
    if (!msg && process.env.DATABASE_URL) {
      try {
        const dbRes = await query('SELECT * FROM room_messages WHERE id::text = $1 AND room_id = $2', [messageId, roomId]);
        if (dbRes.rows.length > 0) dbMsg = dbRes.rows[0];
      } catch (e) {}
    }

    const targetMsg = msg || dbMsg;
    if (!targetMsg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check ownership or room host or admin
    const isSender = targetMsg.sender_id?.toString() === userId?.toString();
    const room = (mockDb.rooms || []).find((r: any) => r.id === roomId);
    const isRoomHost = room && room.created_by?.toString() === userId?.toString();
    const isAdmin = req.user?.is_admin || req.user?.email === 'admin@campusconnect.com' || req.user?.email === 'amitkumarshukla296@gmail.com';

    if (!isSender && !isRoomHost && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    if (msgIdx !== -1) {
      mockDb.room_messages.splice(msgIdx, 1);
    }

    if (process.env.DATABASE_URL) {
      try {
        await query('DELETE FROM room_messages WHERE id::text = $1', [messageId]);
      } catch (e) {}
    }

    // Broadcast real-time deletion via socket if available
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('room:message:deleted', { roomId, messageId });
    }

    return res.status(200).json({ success: true, messageId });
  } catch (err: any) {
    console.error('Delete room message error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
