import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, mockDb } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getFoundingBadge } from '../config/badges.js';

const router = Router();

// GET all interests
router.get('/interests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM interests');
    return res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('Fetch interests error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET current user's profile
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let user;
    let interests: any[] = [];
    let prompts: any[] = [];

    if (process.env.DATABASE_URL) {
      const userResult = await query('SELECT * FROM users WHERE id::text = $1::text', [userId.toString()]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      user = userResult.rows[0];
      delete user.password_hash;
      
      const posRes = await query('SELECT COUNT(*)::int as signup_number FROM users WHERE created_at <= $1', [user.created_at]);
      const signupNum = parseInt(posRes.rows[0]?.signup_number || '1000');
      user.signup_number = signupNum;
      user.founding_badge = getFoundingBadge(signupNum);

      try {
        const interestResult = await query(
          'SELECT i.* FROM interests i JOIN user_interests ui ON ui.interest_id::text = i.id::text WHERE ui.user_id::text = $1',
          [userId]
        );
        interests = interestResult.rows;
      } catch (e) {}

      try {
        const promptsResult = await query('SELECT * FROM prompts WHERE user_id::text = $1', [userId]);
        prompts = promptsResult.rows;
      } catch (e) {}
    }
    
    if (!user) {
      const found = mockDb.users.find((u: any) => u.id?.toString() === userId?.toString());
      if (!found) {
        return res.status(404).json({ error: 'User not found' });
      }
      user = { ...found };
      delete user.password_hash;
      user.founding_badge = getFoundingBadge(user.signup_number || 1);
    }

    if (!interests || interests.length === 0) {
      const userInterestRecords = (mockDb.user_interests || []).filter((ui: any) => ui.user_id?.toString() === userId?.toString());
      interests = userInterestRecords.map((ui: any) => (mockDb.interests || []).find((i: any) => i.id?.toString() === ui.interest_id?.toString() || i.name === ui.interest_id)).filter(Boolean);
    }
    if (!prompts || prompts.length === 0) {
      prompts = (mockDb.prompts || []).filter((p: any) => p.user_id?.toString() === userId?.toString());
    }

    user.interests = interests;
    user.prompts = prompts;

    return res.status(200).json({ user });
  } catch (err: any) {
    console.error('Fetch user me error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update basic profile details
router.put('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { name, year, branch, bio, handle } = req.body;

  if (!userId || !name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate handle format if provided
  if (handle !== undefined && handle !== null && handle !== '') {
    if (!/^[a-z0-9_.]{3,30}$/.test(handle)) {
      return res.status(400).json({ error: 'Username can only contain lowercase letters, numbers, _ and . (3-30 chars)' });
    }
  }

  try {
    let user;
    if (process.env.DATABASE_URL) {
      // Check handle uniqueness if being set
      if (handle) {
        const existing = await query('SELECT id FROM users WHERE handle = $1 AND id::text != $2::text', [handle, userId.toString()]);
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'That username is already taken' });
        }
      }
      const result = await query(
        `UPDATE users SET name = $1, year = $2, branch = $3, bio = $4${
          handle ? ', handle = $6' : ''
        } WHERE id::text = $5::text RETURNING *`,
        handle
          ? [name, year || null, branch || null, bio || null, userId.toString(), handle]
          : [name, year || null, branch || null, bio || null, userId.toString()]
      );
      user = result.rows[0];
      delete user.password_hash;
    } else {
      const found = mockDb.users.find((u: any) => u.id === userId);
      // Check handle uniqueness in mock DB
      if (handle) {
        const taken = mockDb.users.some((u: any) => u.handle === handle && u.id !== userId);
        if (taken) {
          return res.status(409).json({ error: 'That username is already taken' });
        }
      }
      if (found) {
        found.name = name;
        if (year !== undefined) found.year = year;
        if (branch !== undefined) found.branch = branch;
        user = { ...found };
        delete user.password_hash;
      }
    }

    if (Array.isArray(req.body.interests) || Array.isArray(req.body.interestIds)) {
      const items = req.body.interests || req.body.interestIds;
      if (process.env.DATABASE_URL) {
        try {
          await query('DELETE FROM user_interests WHERE user_id::text = $1', [userId]);
          for (const item of items) {
            let targetId = item;
            const existing = await query('SELECT id FROM interests WHERE id::text = $1 OR LOWER(name) = LOWER($2)', [item, item]);
            if (existing.rows.length > 0) {
              targetId = existing.rows[0].id;
            } else {
              const created = await query('INSERT INTO interests (name, category) VALUES ($1, $2) RETURNING id', [item, 'Custom']);
              targetId = created.rows[0].id;
            }
            await query('INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, targetId]);
          }
        } catch (e) {
          console.warn('Update user interests error:', e);
        }
      } else {
        mockDb.user_interests = mockDb.user_interests.filter((ui: any) => ui.user_id !== userId);
        for (const item of items) {
          let existing = mockDb.interests.find((i: any) => i.id === item || (i.name && i.name.toLowerCase() === item.toString().toLowerCase()));
          let targetId = item;
          if (existing) {
            targetId = existing.id;
          } else {
            targetId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            mockDb.interests.push({ id: targetId, name: item, category: 'Custom' });
          }
          mockDb.user_interests.push({ user_id: userId, interest_id: targetId });
        }
      }
    }

    return res.status(200).json({ user });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST upload profile photo (mocked)
router.post('/me/photos', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { photoUrl, photos: reqPhotos } = req.body || {};
    let userPhotos: string[] = [];
    if (process.env.DATABASE_URL) {
      const userResult = await query('SELECT photos FROM users WHERE id::text = $1', [userId]);
      if (userResult.rows.length > 0) {
        userPhotos = userResult.rows[0].photos || [];
      }
    } else {
      const user = mockDb.users.find((u: any) => u.id === userId);
      if (user) userPhotos = user.photos || [];
    }

    let updatedPhotos: string[];
    let finalUrl: string;

    if (Array.isArray(reqPhotos)) {
      updatedPhotos = reqPhotos;
      finalUrl = reqPhotos[0] || '';
    } else if (photoUrl) {
      updatedPhotos = [...userPhotos, photoUrl];
      finalUrl = photoUrl;
    } else {
      const photoIndex = userPhotos.length + 1;
      finalUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60&idx=${photoIndex}`;
      updatedPhotos = [...userPhotos, finalUrl];
    }

    if (process.env.DATABASE_URL) {
      await query('UPDATE users SET photos = $1 WHERE id::text = $2', [updatedPhotos, userId]);
    }
    const user = mockDb.users.find((u: any) => u.id === userId);
    if (user) user.photos = updatedPhotos;

    return res.status(200).json({ url: finalUrl, photos: updatedPhotos });
  } catch (err: any) {
    console.error('Photo upload error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update interests
router.put('/me/interests', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id || (req as any).user?.userId;
  const { interestIds } = req.body;

  if (!userId || !Array.isArray(interestIds)) {
    return res.status(400).json({ error: 'interestIds array is required' });
  }

  try {
    if (process.env.DATABASE_URL) {
      try {
        await query('DELETE FROM user_interests WHERE user_id::text = $1', [userId]);
        for (const item of interestIds) {
          let targetId = item;
          const existing = await query('SELECT id FROM interests WHERE id::text = $1 OR LOWER(name) = LOWER($2)', [item, item]);
          if (existing.rows.length > 0) {
            targetId = existing.rows[0].id;
          } else {
            const created = await query('INSERT INTO interests (name, category) VALUES ($1, $2) RETURNING id', [item, 'Custom']);
            targetId = created.rows[0].id;
          }
          await query('INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, targetId]);
        }
      } catch (e) {
        console.warn('DB update interests warning:', e);
      }
    }

    mockDb.user_interests = (mockDb.user_interests || []).filter((ui: any) => ui.user_id?.toString() !== userId?.toString());
    for (const item of interestIds) {
      let existing = (mockDb.interests || []).find((i: any) => i.id?.toString() === item?.toString() || (i.name && i.name.toLowerCase() === item.toString().toLowerCase()));
      let targetId = item;
      if (existing) {
        targetId = existing.id;
      } else {
        targetId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const newInterest = {
          id: targetId,
          name: item,
          category: 'Custom'
        };
        mockDb.interests.push(newInterest);
      }
      mockDb.user_interests.push({ user_id: userId, interest_id: targetId });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Update interests error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST add or set prompt response
router.post('/me/prompts', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { question, answer } = req.body;

  if (!userId || !question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required' });
  }

  try {
    let prompt;
    if (process.env.DATABASE_URL) {
      await query('DELETE FROM prompts WHERE user_id = $1', [userId]);
      const result = await query(
        'INSERT INTO prompts (user_id, question, answer) VALUES ($1, $2, $3) RETURNING *',
        [userId, question, answer]
      );
      prompt = result.rows[0];
    } else {
      mockDb.prompts = mockDb.prompts.filter((p: any) => p.user_id !== userId);
      prompt = { id: `p-${Date.now()}`, user_id: userId, question, answer };
      mockDb.prompts.push(prompt);
    }

    return res.status(200).json({ prompt });
  } catch (err: any) {
    console.error('Create prompt error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/users/search - Search users by name or handle
router.get('/search', async (req: any, res: Response) => {
  try {
    const q = (req.query.q as string || '').toLowerCase().trim();
    if (!q) return res.status(200).json({ users: [] });

    let users: any[] = [];
    if (process.env.DATABASE_URL) {
      const result = await query(
        'SELECT id, name, handle, photos, branch, year, bio FROM users WHERE LOWER(name) LIKE $1 OR LOWER(handle) LIKE $1 LIMIT 10',
        [`%${q}%`]
      );
      users = result.rows;
    } else {
      const matches = mockDb.users.filter((u: any) => 
        (u.name && u.name.toLowerCase().includes(q)) || 
        (u.handle && u.handle.toLowerCase().includes(q))
      ).slice(0, 10);

      users = matches.map((u: any) => ({
        id: u.id,
        name: u.name,
        handle: u.handle || u.name.toLowerCase().replace(/\s+/g, '_'),
        photos: u.photos || [],
        branch: u.branch,
        year: u.year,
        bio: u.bio
      }));
    }

    return res.status(200).json({ users });
  } catch (err: any) {
    console.error('User search error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/users/:id/profile - Get Instagram-style user profile
router.get('/:id/profile', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    
    // Auth token check from cookie or authorization header
    let token = req.cookies?.token;
    if (!token && req.headers['authorization']) {
      token = req.headers['authorization'].split(' ')[1];
    }
    let currentUserId: string | undefined;
    if (token) {
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) currentUserId = decoded.id || decoded.userId;
      } catch (err) {}
    }

    let userId = id;
    if (!userId || userId === 'me' || userId === 'undefined' || userId === 'null') {
      userId = currentUserId;
    }
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    let user: any = null;
    let interests: any[] = [];
    let prompts: any[] = [];
    let followers_count = 0;
    let following_count = 0;
    let is_following = false;
    let posts: any[] = [];

    if (process.env.DATABASE_URL) {
      let uRes;
      try {
        uRes = await query(
          'SELECT * FROM users WHERE id::text = $1 OR LOWER(handle) = LOWER($1) OR LOWER(email) = LOWER($1)',
          [userId]
        );
      } catch (e) {
        uRes = { rows: [] };
      }
      if (uRes.rows.length === 0 && currentUserId) {
        try {
          uRes = await query('SELECT * FROM users WHERE id::text = $1', [currentUserId]);
        } catch (e) {
          uRes = { rows: [] };
        }
      }
      if (uRes.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      user = uRes.rows[0];
      userId = user.id;

      try {
        const iRes = await query('SELECT i.* FROM interests i JOIN user_interests ui ON ui.interest_id::text = i.id::text WHERE ui.user_id::text = $1', [userId]);
        interests = iRes.rows;
      } catch (e) {
        interests = [];
      }

      try {
        const pRes = await query('SELECT * FROM prompts WHERE user_id::text = $1', [userId]);
        prompts = pRes.rows;
      } catch (e) {
        prompts = [];
      }

      try {
        const fCount = await query('SELECT COUNT(*) FROM follows WHERE following_id::text = $1', [userId]);
        followers_count = parseInt(fCount.rows[0]?.count || '0');
      } catch (e) {
        followers_count = 0;
      }

      try {
        const fgCount = await query('SELECT COUNT(*) FROM follows WHERE follower_id::text = $1', [userId]);
        following_count = parseInt(fgCount.rows[0]?.count || '0');
      } catch (e) {
        following_count = 0;
      }

      if (currentUserId) {
        try {
          const isF = await query('SELECT 1 FROM follows WHERE follower_id::text = $1 AND following_id::text = $2', [currentUserId, userId]);
          is_following = isF.rows.length > 0;
        } catch (e) {
          is_following = false;
        }
      }

      try {
        const postRes = await query('SELECT * FROM posts WHERE author_id::text = $1 ORDER BY created_at DESC', [userId]);
        posts = postRes.rows.map((p: any) => ({
          ...p,
          author: {
            id: user.id,
            name: user.name,
            handle: user.handle || user.name.toLowerCase().replace(/\s+/g, '_'),
            photos: user.photos || []
          },
          comment_count: 0,
          score: (p.upvotes || 0) - (p.downvotes || 0)
        }));
      } catch (e) {
        posts = [];
      }
    } else {
      user = mockDb.users.find((u: any) => u.id === userId || (u.handle && u.handle.toLowerCase() === userId.toLowerCase()) || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
      if (!user && currentUserId) {
        user = mockDb.users.find((u: any) => u.id === currentUserId);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      userId = user.id;

      const userInterestRecords = mockDb.user_interests.filter((ui: any) => ui.user_id === userId);
      interests = userInterestRecords.map((ui: any) => mockDb.interests.find((i: any) => i.id === ui.interest_id)).filter(Boolean);
      prompts = mockDb.prompts.filter((p: any) => p.user_id === userId);

      const followers = mockDb.follows.filter((f: any) => f.following_id === userId);
      const following = mockDb.follows.filter((f: any) => f.follower_id === userId);
      followers_count = followers.length;
      following_count = following.length;
      is_following = currentUserId ? mockDb.follows.some((f: any) => f.follower_id === currentUserId && f.following_id === userId) : false;

      const userPostsRaw = mockDb.posts.filter((p: any) => p.author_id === userId);
      posts = userPostsRaw.map((p: any) => {
        const comments = mockDb.post_comments.filter((c: any) => c.post_id === p.id);
        return {
          ...p,
          author: {
            id: user.id,
            name: user.name,
            handle: user.handle || user.name.toLowerCase().replace(/\s+/g, '_'),
            photos: user.photos || []
          },
          comment_count: comments.length,
          score: (p.upvotes || 0) - (p.downvotes || 0)
        };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle || user.name.toLowerCase().replace(/\s+/g, '_'),
        email: user.email,
        bio: user.bio,
        branch: user.branch,
        year: user.year,
        photos: user.photos || [],
        college_verified: user.college_verified || true,
        founding_badge: getFoundingBadge(user.signup_number || (mockDb.users.findIndex((u: any) => u.id === user.id) >= 0 ? mockDb.users.findIndex((u: any) => u.id === user.id) + 1 : 1)),
        interests,
        prompts,
        followers_count,
        following_count,
        posts_count: posts.length,
        is_following
      },
      posts
    });
  } catch (err: any) {
    console.error('Fetch profile error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/users/:id/follow - Follow user
router.post('/:id/follow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user?.id;

    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });
    if (targetUserId === currentUserId) return res.status(400).json({ error: 'Cannot follow yourself' });

    if (process.env.DATABASE_URL) {
      try {
        await query(
          'INSERT INTO follows (follower_id, following_id) VALUES ($1::text, $2::text) ON CONFLICT DO NOTHING',
          [currentUserId.toString(), targetUserId.toString()]
        );
      } catch (dbErr) {
        console.error('Follow DB error:', dbErr);
      }
    }

    if (mockDb.follows) {
      const exists = mockDb.follows.some((f: any) => f.follower_id?.toString() === currentUserId?.toString() && f.following_id?.toString() === targetUserId?.toString());
      if (!exists) {
        mockDb.follows.push({
          follower_id: currentUserId,
          following_id: targetUserId,
          created_at: new Date().toISOString()
        });
      }
    }

    let followersCount = 0;
    if (process.env.DATABASE_URL) {
      const fRes = await query('SELECT COUNT(*) FROM follows WHERE following_id::text = $1::text', [targetUserId.toString()]);
      followersCount = parseInt(fRes.rows[0]?.count || '0');
    } else {
      followersCount = (mockDb.follows || []).filter((f: any) => f.following_id?.toString() === targetUserId?.toString()).length;
    }

    return res.status(200).json({ success: true, followers_count: followersCount, is_following: true });
  } catch (err: any) {
    console.error('Follow error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/users/:id/unfollow - Unfollow user
router.post('/:id/unfollow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user?.id;

    if (!currentUserId) return res.status(401).json({ error: 'Unauthorized' });

    if (process.env.DATABASE_URL) {
      try {
        await query(
          'DELETE FROM follows WHERE follower_id::text = $1::text AND following_id::text = $2::text',
          [currentUserId.toString(), targetUserId.toString()]
        );
      } catch (dbErr) {
        console.error('Unfollow DB error:', dbErr);
      }
    }

    if (mockDb.follows) {
      mockDb.follows = mockDb.follows.filter((f: any) => !(f.follower_id?.toString() === currentUserId?.toString() && f.following_id?.toString() === targetUserId?.toString()));
    }

    let followersCount = 0;
    if (process.env.DATABASE_URL) {
      const fRes = await query('SELECT COUNT(*) FROM follows WHERE following_id::text = $1::text', [targetUserId.toString()]);
      followersCount = parseInt(fRes.rows[0]?.count || '0');
    } else {
      followersCount = (mockDb.follows || []).filter((f: any) => f.following_id?.toString() === targetUserId?.toString()).length;
    }

    return res.status(200).json({ success: true, followers_count: followersCount, is_following: false });
  } catch (err: any) {
    console.error('Unfollow error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/users/warnings - Fetch warnings & broadcast announcements for current user
router.get('/warnings', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email?.toLowerCase().trim();
  if (!userId && !userEmail) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let warnings: any[] = [];
    if (process.env.DATABASE_URL) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS warnings (
            id TEXT PRIMARY KEY,
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
        try {
          await query('ALTER TABLE warnings ALTER COLUMN user_id TYPE TEXT USING user_id::text');
          await query('ALTER TABLE warnings ALTER COLUMN id TYPE TEXT USING id::text');
        } catch (e) {}
        const result = await query(
          `SELECT * FROM warnings 
           WHERE user_id::text = $1 
              OR LOWER(user_id::text) = LOWER($2) 
              OR user_id::text = 'GLOBAL' 
              OR user_id::text = 'all'
              OR content_type = 'broadcast' 
           ORDER BY created_at DESC 
           LIMIT 50`,
          [userId?.toString() || '', userEmail || '']
        );
        warnings = result.rows;
      } catch (dbErr) {
        console.warn('DB warnings fetch warning:', dbErr);
        warnings = (mockDb.warnings || []).filter((w: any) => 
          w.user_id === userId || w.user_id === userEmail || w.user_id === 'GLOBAL' || w.user_id === 'all' || w.content_type === 'broadcast'
        );
      }
    } else {
      warnings = (mockDb.warnings || []).filter((w: any) => 
        w.user_id === userId || w.user_id === userEmail || w.user_id === 'GLOBAL' || w.user_id === 'all' || w.content_type === 'broadcast'
      );
    }
    return res.status(200).json({ warnings });
  } catch (err: any) {
    console.error('Fetch warnings error:', err);
    return res.status(200).json({ warnings: [] });
  }
});

// POST /api/users/warnings/mark-read - Mark warnings as read
router.post('/warnings/mark-read', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email?.toLowerCase().trim();
  if (!userId && !userEmail) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (process.env.DATABASE_URL) {
      try {
        await query(
          `UPDATE warnings SET read = true WHERE user_id::text = $1 OR LOWER(user_id::text) = LOWER($2) OR content_type = 'broadcast'`,
          [userId?.toString() || '', userEmail || '']
        );
      } catch (e) {}
    } else {
      mockDb.warnings.forEach((w: any) => {
        if (w.user_id === userId || w.user_id === userEmail || w.content_type === 'broadcast') w.read = true;
      });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Mark warnings read error:', err);
    return res.status(200).json({ success: true });
  }
});

export default router;

