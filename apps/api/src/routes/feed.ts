import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { mockDb, query, saveMockDbStore } from '../db/index.js';
import { getFoundingBadge } from '../config/badges.js';

const router = express.Router();

// Helper to format post with author and vote info
function enrichPost(post: any, currentUserId?: string) {
  let isAdmin = false;
  if (currentUserId) {
    const currentUserObj = mockDb.users.find((u: any) => u.id?.toString() === currentUserId.toString());
    if (currentUserObj && currentUserObj.is_admin) {
      isAdmin = true;
    }
  }

  // Author priority:
  // 1. Existing post.author object (pre-joined or passed in)
  // 2. Lookup in mockDb.users
  // 3. Extracted fields from SQL JOIN (post.author_name, etc.)
  let raw = post.author;

  if (!raw || !raw.name || raw.name === 'Campus Student') {
    const foundInMock = mockDb.users.find((u: any) => u.id?.toString() === post.author_id?.toString());
    if (foundInMock) {
      raw = foundInMock;
    } else if (post.author_name) {
      raw = {
        id: post.author_id,
        name: post.author_name,
        handle: post.author_handle || post.author_name.toLowerCase().replace(/\s+/g, '_'),
        photos: post.author_photos || [],
        branch: post.author_branch || 'Student',
        year: post.author_year || '',
        college_verified: post.author_verified ?? true
      };
    }
  }

  if (!raw) {
    raw = {
      id: post.author_id,
      name: 'Campus Student',
      handle: 'student',
      photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'],
      branch: 'CSE',
      year: '2nd Year',
      college_verified: true
    };
  }

  let author;
  if (post.is_anonymous && !isAdmin) {
    author = {
      id: 'anonymous',
      name: 'Anonymous Student 🕵️',
      handle: 'anonymous',
      photos: ['https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&auto=format&fit=crop&q=80'],
      branch: 'Incognito',
      year: 'Campus',
      college_verified: true
    };
  } else {
    author = {
      id: raw.id || post.author_id,
      name: post.is_anonymous ? `${raw.name} (Posted Anonymously 🕵️)` : raw.name,
      handle: raw.handle || (raw.name ? raw.name.toLowerCase().replace(/\s+/g, '_') : 'student'),
      photos: raw.photos || [],
      branch: raw.branch || 'Student',
      year: raw.year || '',
      college_verified: raw.college_verified ?? true,
      is_banned: !!raw.is_banned,
      founding_badge: raw.founding_badge || getFoundingBadge(raw.signup_number || 1)
    };
  }

  let comments = mockDb.post_comments.filter((c: any) => c.post_id === post.id);
  if (post.db_comments && Array.isArray(post.db_comments)) {
    const existingIds = new Set(post.db_comments.map((c: any) => c.id));
    const mockComments = comments.filter((c: any) => !existingIds.has(c.id));
    comments = [...post.db_comments, ...mockComments];
  }
  const upvotes = Math.max(0, post.upvotes || 0);
  const downvotes = Math.max(0, post.downvotes || 0);
  const score = Math.max(0, upvotes - downvotes);

  let user_vote: 'up' | 'down' | null = null;
  if (currentUserId) {
    const v = mockDb.post_votes.find((v: any) => v.post_id === post.id && v.user_id === currentUserId);
    if (v) user_vote = v.vote;
  }

  let poll: any = null;
  if (post.poll) {
    try {
      poll = typeof post.poll === 'string' ? JSON.parse(post.poll) : { ...post.poll };
    } catch (e) {
      poll = null;
    }
  }
  if (poll) {
    if (!poll.votes_by_user) poll.votes_by_user = {};
    if (currentUserId) {
      poll.user_voted_option_id = poll.votes_by_user[currentUserId] || null;
    }
    if (Array.isArray(poll.options)) {
      if (Object.keys(poll.votes_by_user).length > 0) {
        const counts: Record<string, number> = {};
        Object.values(poll.votes_by_user).forEach((optId: any) => {
          counts[optId] = (counts[optId] || 0) + 1;
        });
        poll.options.forEach((o: any) => {
          o.votes = counts[o.id] || 0;
        });
      }
      poll.total_votes = poll.options.reduce((acc: number, o: any) => acc + (o.votes || 0), 0);
    }
  }

  const enrichedComments = comments.map((c: any) => {
    const commentAuthor = c.author || mockDb.users.find((u: any) => u.id === c.author_id) || {
      id: c.author_id,
      name: 'Student',
      handle: 'student',
      photos: []
    };
    return {
      ...c,
      author: {
        id: commentAuthor.id,
        name: commentAuthor.name,
        handle: commentAuthor.handle || (commentAuthor.name ? commentAuthor.name.toLowerCase().replace(/\s+/g, '_') : 'student'),
        photos: commentAuthor.photos || []
      }
    };
  }).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    ...post,
    author,
    upvotes,
    downvotes,
    score,
    user_vote,
    poll,
    comments: enrichedComments,
    comment_count: enrichedComments.length
  };
}

// POST /api/posts/teaser - Public endpoint for submitting posts from Teaser website
router.post('/teaser', async (req, res) => {
  try {
    const { name, email, title, content, topic, is_anonymous, poll } = req.body;
    if (!email || (!title?.trim() && !content?.trim())) {
      return res.status(400).json({ error: 'Email, title, and post content are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = (name && name.trim()) || cleanEmail.split('@')[0];
    const cleanHandle = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');
    const postTitle = (title && title.trim()) || content.trim().slice(0, 60);
    const postContent = (content && content.trim()) || postTitle;
    const postTopic = topic || 'General';
    const isAnon = !!is_anonymous;

    // Enforce strict 1 post limit per email for all users
    let existingPostCount = 0;
    if (process.env.DATABASE_URL) {
      try {
        const countRes = await query(
          `SELECT COUNT(*) FROM posts p JOIN users u ON p.author_id::text = u.id::text WHERE LOWER(u.email) = $1`,
          [cleanEmail]
        );
        existingPostCount = parseInt(countRes.rows[0]?.count || '0', 10);
      } catch (err) {}
    } else {
      const mockUser = mockDb.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (mockUser) {
        existingPostCount = mockDb.posts.filter((p: any) => p.author_id === mockUser.id).length;
      }
    }

    if (existingPostCount >= 1) {
      return res.status(400).json({ error: 'You have already submitted your 1 teaser post! Additional posts can be created on launch day.' });
    }

    let pollData = null;
    if (poll && poll.question && Array.isArray(poll.options) && poll.options.length >= 2) {
      const duration = poll.duration || 'always';
      let expires_at: string | null = null;
      if (duration === '8h') {
        expires_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      } else if (duration === '24h') {
        expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      pollData = {
        id: `poll-${Date.now()}`,
        question: poll.question,
        duration,
        expires_at,
        options: poll.options.filter((o: any) => typeof o === 'string' ? o.trim() : o.text.trim()).map((opt: any, idx: number) => ({
          id: `opt-${idx + 1}`,
          text: typeof opt === 'string' ? opt.trim() : opt.text.trim(),
          votes: 0
        })),
        total_votes: 0,
        votes_by_user: {}
      };
    }

    // 1. Check or create user in mockDb
    let userObj = mockDb.users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
    if (!userObj) {
      userObj = {
        id: crypto.randomUUID(),
        email: cleanEmail,
        name: cleanName,
        handle: cleanHandle,
        college_verified: true,
        signup_number: mockDb.users.length + 1,
        created_at: new Date().toISOString()
      };
      mockDb.users.push(userObj);
    }

    // 2. Check or create user in PostgreSQL if DB is active
    if (process.env.DATABASE_URL) {
      try {
        const userRes = await query(
          `INSERT INTO users (id, email, name, handle, college_verified, created_at)
           VALUES ($1, $2, $3, $4, true, NOW())
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, email, name, handle`,
          [userObj.id, cleanEmail, cleanName, cleanHandle]
        );
        if (userRes.rows && userRes.rows[0]) {
          userObj.id = userRes.rows[0].id;
        }
      } catch (dbErr) {
        console.warn('Teaser user DB insert warning:', dbErr);
      }
    }

    // 3. Create post object following exact Rogue blueprint
    const newPost: any = {
      id: crypto.randomUUID(),
      author_id: userObj.id,
      title: postTitle,
      content: postContent,
      topic: postTopic,
      is_anonymous: isAnon,
      poll: pollData,
      upvotes: 0,
      downvotes: 0,
      score: 0,
      created_at: new Date().toISOString(),
      author: {
        id: userObj.id,
        name: cleanName,
        handle: cleanHandle,
        photos: [],
        branch: 'Student',
        year: '2026',
        college_verified: true
      }
    };

    mockDb.posts.unshift(newPost);

    if (process.env.DATABASE_URL) {
      try {
        await query(
          `INSERT INTO posts (id, author_id, title, content, topic, is_anonymous, poll, upvotes, downvotes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, NOW())`,
          [newPost.id, userObj.id, newPost.title, newPost.content, newPost.topic, isAnon, pollData ? JSON.stringify(pollData) : null]
        );
      } catch (dbErr) {
        console.warn('Teaser post DB insert warning:', dbErr);
      }
    }

    const io = req.app.get('io');
    if (io) {
      const socketPayload = {
        id: newPost.id,
        type: 'post',
        author_id: userObj.id,
        author_name: newPost.is_anonymous ? `${cleanName} (Posted Anonymously 🕵️)` : cleanName,
        author_handle: cleanHandle,
        author_photo: null,
        title: newPost.title,
        content: newPost.content,
        room_name: null,
        media_url: null,
        created_at: newPost.created_at
      };
      io.to('admin').emit('admin:new_content', socketPayload);
      io.emit('admin:new_content', socketPayload);
      io.emit('post:created', newPost);
    }

    return res.status(200).json({
      success: true,
      message: 'Your post is safely stored under your account. It will automatically publish live to the main campus feed the moment Rogue goes live!',
      post: enrichPost(newPost)
    });
  } catch (err: any) {
    console.error('Teaser post creation error:', err);
    return res.status(500).json({ error: 'Failed to create teaser post' });
  }
});

// GET /api/posts - Get feed posts (with sorting & topic filter)
router.get('/', async (req, res) => {
  try {
    const { sort = 'latest', topic = 'All' } = req.query as { sort?: string; topic?: string };
    
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

    let posts = [...mockDb.posts];

    if (process.env.DATABASE_URL) {
      try {
        await query(`
          DELETE FROM posts 
          WHERE poll IS NOT NULL 
            AND poll->>'expires_at' IS NOT NULL 
            AND (poll->>'expires_at')::timestamptz <= NOW()
        `);
      } catch (e) {}

      let allDbComments: any[] = [];
      try {
        const cRes = await query(`
          SELECT c.*, u.name as author_name, u.handle as author_handle, u.photos as author_photos
          FROM post_comments c
          LEFT JOIN users u ON (c.author_id::text = u.id::text OR LOWER(c.author_id::text) = LOWER(u.email::text))
        `);
        allDbComments = cRes.rows.map(r => ({
          id: r.id,
          post_id: r.post_id,
          author_id: r.author_id,
          author: {
            id: r.author_id,
            name: r.author_name || 'Student',
            handle: r.author_handle || (r.author_name ? r.author_name.toLowerCase().replace(/\s+/g, '_') : 'student'),
            photos: r.author_photos || []
          },
          content: r.content,
          created_at: r.created_at
        }));
      } catch (e) {}

      try {
        const dbRes = await query(`
          SELECT p.*, 
                 u.name as author_name, u.handle as author_handle, u.photos as author_photos, 
                 u.branch as author_branch, u.year as author_year, u.college_verified as author_verified
          FROM posts p
          LEFT JOIN users u ON (p.author_id::text = u.id::text OR LOWER(p.author_id::text) = LOWER(u.email::text))
          ORDER BY p.created_at DESC
        `);
        if (dbRes.rows && dbRes.rows.length > 0) {
          const dbPosts = dbRes.rows.map(row => {
            let parsedPoll = null;
            if (row.poll) {
              try {
                parsedPoll = typeof row.poll === 'string' ? JSON.parse(row.poll) : row.poll;
              } catch (e) {
                parsedPoll = null;
              }
            }
            return {
              id: row.id,
              author_id: row.author_id,
              title: row.title,
              content: row.content,
              topic: row.topic || 'General',
              media_url: row.media_url,
              is_anonymous: !!row.is_anonymous,
              poll: parsedPoll,
              upvotes: Math.max(0, row.upvotes || 0),
              downvotes: Math.max(0, row.downvotes || 0),
              created_at: row.created_at,
              db_comments: allDbComments.filter(c => c.post_id === row.id),
              author: {
                id: row.author_id,
                name: row.author_name || 'Student',
                handle: row.author_handle || (row.author_name ? row.author_name.toLowerCase().replace(/\s+/g, '_') : 'student'),
                photos: row.author_photos || [],
                branch: row.author_branch || 'Student',
                year: row.author_year || '',
                college_verified: row.author_verified ?? true
              }
            };
          });

          const dbIds = new Set(dbPosts.map(p => p.id));
          posts = [...dbPosts, ...posts.filter(p => !dbIds.has(p.id))];
        }
      } catch (dbErr) {
        console.warn('DB fetch posts warning:', dbErr);
      }
    }

    // Filter out any expired poll posts
    const now = Date.now();
    posts = posts.filter(p => {
      if (p.poll && p.poll.expires_at && p.poll.duration !== 'always') {
        const expTime = new Date(p.poll.expires_at).getTime();
        if (!isNaN(expTime) && expTime <= now) {
          return false;
        }
      }
      return true;
    });

    if (topic && topic !== 'All') {
      posts = posts.filter(p => p.topic?.toLowerCase() === topic.toLowerCase());
    }

    if (sort === 'trending') {
      posts.sort((a, b) => {
        const scoreA = (a.upvotes - a.downvotes) + mockDb.post_comments.filter((c: any) => c.post_id === a.id).length * 2;
        const scoreB = (b.upvotes - b.downvotes) + mockDb.post_comments.filter((c: any) => c.post_id === b.id).length * 2;
        return scoreB - scoreA;
      });
    } else if (sort === 'top') {
      posts.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    } else {
      posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const enriched = posts.map(p => enrichPost(p, currentUserId));
    return res.status(200).json({ posts: enriched });
  } catch (err: any) {
    console.error('Error fetching posts:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/posts - Create post
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, content, topic = 'General', is_anonymous, poll } = req.body;
    const userId = (req as any).user.userId || (req as any).user.id;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Fetch actual user details from DB / mockDb / req.user
    let authorObj: any = null;
    if (process.env.DATABASE_URL) {
      try {
        const userRes = await query('SELECT id, name, handle, photos, branch, year, college_verified FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1)', [userId]);
        if (userRes.rows.length > 0) {
          authorObj = userRes.rows[0];
        }
      } catch (e) {}
    }
    if (!authorObj) {
      authorObj = mockDb.users.find((u: any) => u.id?.toString() === userId?.toString() || (u.email && u.email.toLowerCase() === userId?.toString().toLowerCase()));
    }
    const authUser = (req as any).user;
    if (!authorObj && authUser) {
      authorObj = {
        id: authUser.id || authUser.userId || userId,
        name: authUser.name || authUser.email?.split('@')[0] || 'Student',
        handle: authUser.handle || authUser.email?.split('@')[0] || 'student',
        photos: authUser.photos || [],
        branch: authUser.branch || 'Student',
        year: authUser.year || '',
        college_verified: authUser.college_verified ?? true
      };
    }

    let pollData = null;
    if (poll && poll.question && Array.isArray(poll.options) && poll.options.length >= 2) {
      const duration = poll.duration || 'always';
      let expires_at: string | null = null;
      if (duration === '8h') {
        expires_at = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      } else if (duration === '24h') {
        expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      pollData = {
        id: `poll-${Date.now()}`,
        question: poll.question,
        duration,
        expires_at,
        options: poll.options.filter((o: any) => typeof o === 'string' ? o.trim() : o.text.trim()).map((opt: any, idx: number) => ({
          id: `opt-${idx + 1}`,
          text: typeof opt === 'string' ? opt.trim() : opt.text.trim(),
          votes: 0
        })),
        total_votes: 0,
        votes_by_user: {}
      };
    }

    const postId = crypto.randomUUID();
    const newPost = {
      id: postId,
      author_id: userId,
      author: authorObj ? {
        id: authorObj.id,
        name: authorObj.name,
        handle: authorObj.handle || authorObj.name?.toLowerCase().replace(/\s+/g, '_'),
        photos: authorObj.photos || [],
        branch: authorObj.branch || 'Student',
        year: authorObj.year || '',
        college_verified: authorObj.college_verified ?? true
      } : null,
      title,
      content,
      topic: topic || 'General',
      media_url: null,
      is_anonymous: !!is_anonymous,
      poll: pollData,
      poll_votes: {},
      upvotes: 0,
      downvotes: 0,
      created_at: new Date().toISOString()
    };

    mockDb.posts.unshift(newPost);

    if (process.env.DATABASE_URL) {
      try {
        await query(
          'INSERT INTO posts (id, author_id, title, content, topic, is_anonymous, poll, media_url, upvotes, downvotes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9)',
          [postId, userId, title, content, topic || 'General', !!is_anonymous, pollData ? JSON.stringify(pollData) : null, newPost.media_url, newPost.created_at]
        );
      } catch (dbErr) {
        console.warn('DB insert post error:', dbErr);
      }
    }

    const enriched = enrichPost(newPost, userId);

    const io = req.app.get('io');
    if (io) {
      const realUser = mockDb.users.find((u: any) => u.id === userId);
      const realName = realUser ? realUser.name : 'Student';
      const realHandle = realUser ? (realUser.handle || 'student') : 'student';
      const realPhoto = realUser && realUser.photos && realUser.photos[0] ? realUser.photos[0] : null;

      const socketPayload = {
        id: newPost.id,
        type: 'post',
        author_id: userId,
        author_name: newPost.is_anonymous ? `${realName} (Posted Anonymously 🕵️)` : realName,
        author_handle: realHandle,
        author_photo: realPhoto,
        title: newPost.title,
        content: newPost.content,
        room_name: null,
        media_url: newPost.media_url || null,
        created_at: newPost.created_at
      };
      io.to('admin').emit('admin:new_content', socketPayload);
      io.emit('admin:new_content', socketPayload);
    }

    return res.status(201).json({ post: enriched });
  } catch (err: any) {
    console.error('Error creating post:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/posts/:id - Get single post detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let post = mockDb.posts.find(p => p.id === id);

    if (process.env.DATABASE_URL) {
      try {
        const dbRes = await query(`
          SELECT p.*, 
                 u.name as author_name, u.handle as author_handle, u.photos as author_photos, 
                 u.branch as author_branch, u.year as author_year, u.college_verified as author_verified
          FROM posts p
          LEFT JOIN users u ON (p.author_id::text = u.id::text OR LOWER(p.author_id::text) = LOWER(u.email::text))
          WHERE p.id::text = $1
        `, [id]);
        if (dbRes.rows.length > 0) {
          const row = dbRes.rows[0];
          post = {
            ...row,
            upvotes: Math.max(0, row.upvotes || 0),
            downvotes: Math.max(0, row.downvotes || 0),
            author: {
              id: row.author_id,
              name: row.author_name || (post?.author?.name && post.author.name !== 'Campus Student' ? post.author.name : 'Student'),
              handle: row.author_handle || (row.author_name ? row.author_name.toLowerCase().replace(/\s+/g, '_') : 'student'),
              photos: row.author_photos || (post?.author?.photos || []),
              branch: row.author_branch || 'Student',
              year: row.author_year || '',
              college_verified: row.author_verified ?? true
            }
          };
        }
      } catch (e) {}
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const authHeader = req.headers['authorization'];
    let currentUserId: string | undefined;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) currentUserId = decoded.userId || decoded.id;
      } catch (err) {}
    }

    const enriched = enrichPost(post, currentUserId);
    
    let rawComments = mockDb.post_comments.filter(c => c.post_id === id);
    if (process.env.DATABASE_URL) {
      try {
        const dbComments = await query(`
          SELECT c.*, u.name as author_name, u.handle as author_handle, u.photos as author_photos
          FROM post_comments c
          LEFT JOIN users u ON (c.author_id::text = u.id::text OR LOWER(c.author_id::text) = LOWER(u.email::text))
          WHERE c.post_id::text = $1
          ORDER BY c.created_at ASC
        `, [id]);
        if (dbComments.rows.length > 0) {
          const dbC = dbComments.rows.map(r => ({
            id: r.id,
            post_id: r.post_id,
            author_id: r.author_id,
            author: {
              id: r.author_id,
              name: r.author_name || 'Student',
              handle: r.author_handle || (r.author_name ? r.author_name.toLowerCase().replace(/\s+/g, '_') : 'student'),
              photos: r.author_photos || []
            },
            content: r.content,
            created_at: r.created_at
          }));
          const existingIds = new Set(dbC.map(c => c.id));
          rawComments = [...dbC, ...rawComments.filter(c => !existingIds.has(c.id))];
        }
      } catch (e) {}
    }

    const comments = rawComments.map(c => {
      const author = c.author || mockDb.users.find(u => u.id === c.author_id) || {
        id: c.author_id,
        name: 'Student',
        handle: 'student',
        photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80']
      };
      return {
        ...c,
        author: {
          id: author.id,
          name: author.name,
          handle: author.handle || (author.name ? author.name.toLowerCase().replace(/\s+/g, '_') : 'student'),
          photos: author.photos || []
        }
      };
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return res.status(200).json({ post: { ...enriched, comments } });
  } catch (err: any) {
    console.error('Error fetching post detail:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/posts/:id/comments - Add comment
router.post('/:id/comments', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id || req.user?.userId;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    let post = mockDb.posts.find(p => p.id === id);
    if (!post && process.env.DATABASE_URL) {
      try {
        const dbRes = await query('SELECT * FROM posts WHERE id::text = $1', [id]);
        if (dbRes.rows.length > 0) {
          post = dbRes.rows[0];
        }
      } catch (e) {}
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Resolve user author details
    let authorObj: any = null;
    if (process.env.DATABASE_URL) {
      try {
        const userRes = await query('SELECT id, name, handle, photos FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1)', [userId]);
        if (userRes.rows.length > 0) authorObj = userRes.rows[0];
      } catch (e) {}
    }
    if (!authorObj) {
      authorObj = mockDb.users.find((u: any) => u.id?.toString() === userId?.toString() || (u.email && u.email.toLowerCase() === userId?.toString().toLowerCase()));
    }
    if (!authorObj && req.user) {
      authorObj = {
        id: req.user.id || req.user.userId || userId,
        name: req.user.name || req.user.email?.split('@')[0] || 'Student',
        handle: req.user.handle || req.user.email?.split('@')[0] || 'student',
        photos: req.user.photos || []
      };
    }

    const commentId = `comment-${Date.now()}`;
    const newComment = {
      id: commentId,
      post_id: id,
      author_id: userId,
      author: {
        id: userId,
        name: authorObj ? authorObj.name : 'Student',
        handle: authorObj ? (authorObj.handle || authorObj.name?.toLowerCase().replace(/\s+/g, '_')) : 'student',
        photos: authorObj ? authorObj.photos : []
      },
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    mockDb.post_comments.push(newComment);
    saveMockDbStore();

    if (process.env.DATABASE_URL) {
      try {
        await query(
          'INSERT INTO post_comments (id, post_id, author_id, content, created_at) VALUES ($1, $2, $3, $4, $5)',
          [commentId, id, userId, content.trim(), newComment.created_at]
        );
      } catch (dbErr) {
        try {
          await query(
            'INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES ($1, $2, $3, $4, $5)',
            [commentId, id, userId, content.trim(), newComment.created_at]
          );
        } catch (e2) {}
      }
    }

    // Emit real-time notification to post author (skip if commenting on own post)
    const postAuthorId = post.author_id?.toString();
    if (postAuthorId && postAuthorId !== userId?.toString()) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${postAuthorId}`).emit('notification:comment', {
          commentId,
          postId: id,
          postTitle: post.title || 'your post',
          commenterName: newComment.author.name,
          commenterHandle: newComment.author.handle,
          commenterPhoto: newComment.author.photos?.[0] || null,
          content: content.trim(),
          sentAt: newComment.created_at
        });
      }
    }

    return res.status(201).json({ comment: newComment });
  } catch (err: any) {
    console.error('Error adding comment:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/posts/:id/comments/:commentId - Delete a comment
router.delete('/:id/comments/:commentId', authenticateToken, async (req: any, res: any) => {
  try {
    const { id: postId, commentId } = req.params;
    const userId = req.user?.id || req.user?.userId;

    // Find comment in mockDb
    const commentIdx = mockDb.post_comments.findIndex((c: any) => c.id === commentId && c.post_id === postId);
    const comment = commentIdx !== -1 ? mockDb.post_comments[commentIdx] : null;

    // Find the post to check ownership
    let post: any = mockDb.posts.find((p: any) => p.id === postId);
    if (!post && process.env.DATABASE_URL) {
      try {
        const dbRes = await query('SELECT * FROM posts WHERE id::text = $1', [postId]);
        if (dbRes.rows.length > 0) post = dbRes.rows[0];
      } catch (e) {}
    }

    // Check from DB if comment not in mockDb
    let dbComment: any = null;
    if (!comment && process.env.DATABASE_URL) {
      try {
        const dbRes = await query('SELECT * FROM post_comments WHERE id::text = $1 AND post_id::text = $2', [commentId, postId]);
        if (dbRes.rows.length > 0) dbComment = dbRes.rows[0];
      } catch (e) {}
    }

    const resolvedComment = comment || dbComment;
    if (!resolvedComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const userEmail = req.user?.email?.toLowerCase().trim();
    const commentAuthorId = resolvedComment.author_id?.toString().toLowerCase();
    const postAuthorId = post?.author_id?.toString().toLowerCase();
    const userIdStr = userId?.toString().toLowerCase();

    const isCommentAuthor = !!(
      (commentAuthorId && userIdStr && commentAuthorId === userIdStr) ||
      (commentAuthorId && userEmail && commentAuthorId === userEmail)
    );
    const isPostOwner = !!(
      (postAuthorId && userIdStr && postAuthorId === userIdStr) ||
      (postAuthorId && userEmail && postAuthorId === userEmail)
    );
    const isAdmin = req.user?.is_admin || userEmail === 'admin@campusconnect.com' || userEmail === '24ir10am4@mitsgwl.ac.in' || userEmail === '24ir10am4@mitsgwl.in' || userEmail === 'amitkumarshukla296@gmail.com';

    if (!isCommentAuthor && !isPostOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Remove from mockDb
    if (commentIdx !== -1) {
      mockDb.post_comments.splice(commentIdx, 1);
      saveMockDbStore();
    }

    // Remove from DB
    if (process.env.DATABASE_URL) {
      try {
        await query('DELETE FROM post_comments WHERE id::text = $1', [commentId]);
      } catch (e) {
        try {
          await query('DELETE FROM comments WHERE id::text = $1', [commentId]);
        } catch (e2) {}
      }
    }

    return res.status(200).json({ success: true, commentId });
  } catch (err: any) {
    console.error('Error deleting comment:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/posts/:id/vote - Upvote / Downvote
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body as { vote: 'up' | 'down' | 'none' };
    const userId = (req as any).user?.id || (req as any).user?.userId;

    let post = mockDb.posts.find(p => p.id === id);
    if (process.env.DATABASE_URL) {
      try {
        const dbRes = await query(`
          SELECT p.*, 
                 u.name as author_name, u.handle as author_handle, u.photos as author_photos, 
                 u.branch as author_branch, u.year as author_year, u.college_verified as author_verified
          FROM posts p
          LEFT JOIN users u ON (p.author_id::text = u.id::text OR LOWER(p.author_id::text) = LOWER(u.email::text))
          WHERE p.id::text = $1
        `, [id]);
        if (dbRes.rows.length > 0) {
          const row = dbRes.rows[0];
          let parsedPoll = null;
          if (row.poll) {
            try {
              parsedPoll = typeof row.poll === 'string' ? JSON.parse(row.poll) : row.poll;
            } catch (e) {}
          }
          post = {
            ...row,
            poll: parsedPoll,
            upvotes: Math.max(0, row.upvotes || 0),
            downvotes: Math.max(0, row.downvotes || 0),
            author: {
              id: row.author_id,
              name: row.author_name || (post?.author?.name && post.author.name !== 'Campus Student' ? post.author.name : 'Student'),
              handle: row.author_handle || (row.author_name ? row.author_name.toLowerCase().replace(/\s+/g, '_') : 'student'),
              photos: row.author_photos || (post?.author?.photos || []),
              branch: row.author_branch || 'Student',
              year: row.author_year || '',
              college_verified: row.author_verified ?? true
            }
          };
        }
      } catch (e) {}
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    let existingVoteIndex = mockDb.post_votes.findIndex(v => v.post_id === id && v.user_id === userId);
    const existingVote = existingVoteIndex !== -1 ? mockDb.post_votes[existingVoteIndex] : null;

    if (existingVote) {
      if (existingVote.vote === 'up') post.upvotes = Math.max(0, post.upvotes - 1);
      if (existingVote.vote === 'down') post.downvotes = Math.max(0, post.downvotes - 1);
    }

    if (vote === 'none' || (existingVote && existingVote.vote === vote)) {
      if (existingVoteIndex !== -1) mockDb.post_votes.splice(existingVoteIndex, 1);
    } else {
      if (vote === 'up') post.upvotes = (post.upvotes || 0) + 1;
      if (vote === 'down') post.downvotes = (post.downvotes || 0) + 1;

      if (existingVoteIndex !== -1) {
        mockDb.post_votes[existingVoteIndex].vote = vote;
      } else {
        mockDb.post_votes.push({
          id: crypto.randomUUID(),
          post_id: id,
          user_id: userId,
          vote
        });
      }
    }

    if (process.env.DATABASE_URL) {
      try {
        await query('UPDATE posts SET upvotes = $1, downvotes = $2 WHERE id::text = $3', [post.upvotes || 0, post.downvotes || 0, id]);
      } catch (dbErr) {}
    }

    const enriched = enrichPost(post, userId);
    return res.status(200).json({ post: enriched });
  } catch (err: any) {
    console.error('Error voting on post:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// NOTE: Duplicate POST /:id/comments route removed — handled above at line 536 with full DB persistence.

// POST /api/posts/:id/poll/vote - Vote on poll option
router.post('/:id/poll/vote', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { option_id } = req.body;
    const userId = req.user?.id || req.user?.userId;

    let post: any = mockDb.posts.find((p: any) => p.id === id);

    if (process.env.DATABASE_URL) {
      try {
        const dbRes = await query(`
          SELECT p.*, 
                 u.name as author_name, u.handle as author_handle, u.photos as author_photos, 
                 u.branch as author_branch, u.year as author_year, u.college_verified as author_verified
          FROM posts p
          LEFT JOIN users u ON (p.author_id::text = u.id::text OR LOWER(p.author_id::text) = LOWER(u.email::text))
          WHERE p.id::text = $1
        `, [id]);
        if (dbRes.rows.length > 0) {
          const row = dbRes.rows[0];
          let parsedPoll = null;
          if (row.poll) {
            try {
              parsedPoll = typeof row.poll === 'string' ? JSON.parse(row.poll) : row.poll;
            } catch (e) {}
          }
          post = {
            ...row,
            poll: parsedPoll,
            upvotes: Math.max(0, row.upvotes || 0),
            downvotes: Math.max(0, row.downvotes || 0),
            author: {
              id: row.author_id,
              name: row.author_name || 'Student',
              handle: row.author_handle || (row.author_name ? row.author_name.toLowerCase().replace(/\s+/g, '_') : 'student'),
              photos: row.author_photos || [],
              branch: row.author_branch || 'Student',
              year: row.author_year || '',
              college_verified: row.author_verified ?? true
            }
          };
        }
      } catch (e) {}
    }

    if (!post || !post.poll) {
      return res.status(404).json({ error: 'Poll not found on this post' });
    }

    if (typeof post.poll === 'string') {
      try {
        post.poll = JSON.parse(post.poll);
      } catch (e) {}
    }

    if (!post.poll.votes_by_user) {
      post.poll.votes_by_user = {};
    }

    const prevOptionId = post.poll.votes_by_user[userId];
    if (prevOptionId === option_id) {
      // Toggle off vote if clicking the same option again
      delete post.poll.votes_by_user[userId];
    } else {
      // Enforce 1 option vote per user
      post.poll.votes_by_user[userId] = option_id;
    }

    // Re-tally vote counts for each option based on unique user votes map
    const counts: Record<string, number> = {};
    Object.values(post.poll.votes_by_user).forEach((optId: any) => {
      counts[optId] = (counts[optId] || 0) + 1;
    });

    if (Array.isArray(post.poll.options)) {
      post.poll.options.forEach((o: any) => {
        o.votes = counts[o.id] || 0;
      });
    }

    const total_votes = Object.keys(post.poll.votes_by_user).length;
    post.poll.total_votes = total_votes;
    post.poll.user_voted_option_id = post.poll.votes_by_user[userId] || null;

    if (process.env.DATABASE_URL) {
      try {
        await query(
          'UPDATE posts SET poll = $1 WHERE id::text = $2',
          [JSON.stringify(post.poll), id]
        );
      } catch (dbErr) {
        console.warn('DB poll update warning:', dbErr);
      }
    }

    const enriched = enrichPost(post, userId);
    return res.status(200).json({ post: enriched });
  } catch (err: any) {
    console.error('Error voting on poll:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/posts/:id - Delete a post
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    let post: any = mockDb.posts.find(p => p.id === id);
    if (!post && process.env.DATABASE_URL) {
      try {
        const dbRes = await query('SELECT * FROM posts WHERE id::text = $1', [id]);
        if (dbRes.rows.length > 0) {
          post = dbRes.rows[0];
        }
      } catch (e) {}
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userEmail = req.user?.email?.toLowerCase().trim();
    let isUserAdmin = req.user?.is_admin || userEmail === 'admin@campusconnect.com' || userEmail === '24ir10am4@mitsgwl.ac.in' || userEmail === '24ir10am4@mitsgwl.in' || userEmail === 'amitkumarshukla296@gmail.com';

    if (process.env.DATABASE_URL) {
      try {
        const uRes = await query('SELECT id, email, is_admin FROM users WHERE id::text = $1 OR LOWER(email) = $1', [userId?.toString() || '', userEmail || '']);
        if (uRes.rows.length > 0 && uRes.rows[0].is_admin) {
          isUserAdmin = true;
        }
      } catch (e) {}
    }

    const postAuthorIdStr = post.author_id?.toString().toLowerCase();
    const userIdStr = userId?.toString().toLowerCase();

    const isOwner = !!(
      (postAuthorIdStr && userIdStr && postAuthorIdStr === userIdStr) ||
      (postAuthorIdStr && userEmail && postAuthorIdStr === userEmail) ||
      (post.created_by?.toString().toLowerCase() === userIdStr) ||
      (post.created_by?.toString().toLowerCase() === userEmail)
    );

    if (!isOwner && !isUserAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    mockDb.posts = mockDb.posts.filter(p => p.id !== id);
    mockDb.post_comments = mockDb.post_comments.filter(c => c.post_id !== id);
    mockDb.post_votes = mockDb.post_votes.filter(v => v.post_id !== id);

    if (process.env.DATABASE_URL) {
      try {
        await query('DELETE FROM posts WHERE id::text = $1', [id]);
      } catch (dbErr) {
        console.warn('DB delete post error:', dbErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting post:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
