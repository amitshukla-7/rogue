import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireCollegeVerified, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/weekly-match - Get current weekly blind peer sync preview
router.get('/weekly-match', async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      featureName: 'Weekly Campus Blind Sync',
      schedule: 'Every Sunday at 12:00 AM',
      description: 'Automatically pairs you with 1 student from your university who shares 2+ common interests.',
      sampleMatch: {
        matchName: 'Ananya Roy',
        college: 'MITS Gwalior',
        matchedInterests: ['Coding', 'Hackathons'],
        matchScore: '94% Compatibility',
        syncTime: 'Next Sunday, 12:00 AM'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET discover feed - Strictly locked until platform reaches 1,000 registered users
router.get('/discover', async (req: Request, res: Response) => {
  try {
    let studentCount = 124;
    try {
      const countRes = await query('SELECT count(*) FROM users');
      if (countRes.rows?.[0]?.count) {
        studentCount = parseInt(countRes.rows[0].count, 10);
      }
    } catch (e) {
      studentCount = 124;
    }

    // Always enforce locked state with 1000 user milestone
    return res.status(200).json({
      locked: true,
      requiredUsers: 1000,
      currentUsers: Math.min(studentCount, 999), // locked until 1000 reached
      message: 'Discover feature is locked until Rogue reaches 1,000 registered campus users.',
      candidates: []
    });
  } catch (err: any) {
    return res.status(200).json({
      locked: true,
      requiredUsers: 1000,
      currentUsers: 124,
      message: 'Discover feature is locked until Rogue reaches 1,000 registered campus users.',
      candidates: []
    });
  }
});

// POST swipe action
router.post('/swipes', authenticateToken, async (req: AuthRequest, res: Response) => {
  const fromUserId = req.user?.id;
  const { toUserId, action } = req.body; // 'like' or 'pass'

  if (!toUserId || !action) {
    return res.status(400).json({ error: 'Missing toUserId or action' });
  }

  try {
    // Record swipe
    await query('INSERT INTO swipes (from_user_id, to_user_id, action) VALUES ($1, $2, $3)', [fromUserId, toUserId, action]);

    if (action === 'like') {
      // Check if candidate also liked the user
      const checkLike = await query('SELECT * FROM swipes WHERE from_user_id::text = $1 AND to_user_id::text = $2 AND action = $3', [toUserId, fromUserId, 'like']);
      
      if (checkLike.rows.length > 0) {
        // Create match
        const matchResult = await query('INSERT INTO matches (user_a_id, user_b_id) VALUES ($1, $2)', [fromUserId, toUserId]);
        const match = matchResult.rows[0];
        return res.status(200).json({ matched: true, matchId: match?.id });
      }
    }

    return res.status(200).json({ matched: false });
  } catch (err: any) {
    console.error('Swipe action error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET current user's direct matches / DMs with populated user profiles
router.get('/matches', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const matchesResult = await query(
      `SELECT m.*, 
              u.id as peer_id, u.name as peer_name, u.handle as peer_handle, 
              u.photos as peer_photos, u.branch as peer_branch, u.year as peer_year, 
              u.college_verified as peer_verified
       FROM matches m
       JOIN users u ON (CASE WHEN m.user_a_id::text = $1 THEN m.user_b_id::text ELSE m.user_a_id::text END) = u.id::text
       WHERE m.user_a_id::text = $1 OR m.user_b_id::text = $1
       ORDER BY m.matched_at DESC`,
      [userId]
    );

    const formatted = matchesResult.rows.map(row => ({
      id: row.id,
      user_a_id: row.user_a_id,
      user_b_id: row.user_b_id,
      matched_at: row.matched_at,
      other_user: {
        id: row.peer_id,
        name: row.peer_name,
        handle: row.peer_handle || row.peer_name?.toLowerCase().replace(/\s+/g, '_'),
        photos: row.peer_photos || [],
        branch: row.peer_branch || 'Campus Student',
        year: row.peer_year || '',
        college_verified: row.peer_verified ?? true
      }
    }));

    return res.status(200).json(formatted);
  } catch (err: any) {
    console.error('Fetch matches error:', err);
    return res.status(200).json([]);
  }
});

// GET 1:1 messages history for a match (requires college verification)
router.get('/messages/:matchId', authenticateToken, requireCollegeVerified, async (req: AuthRequest, res: Response) => {
  const { matchId } = req.params;
  try {
    const messagesResult = await query('SELECT * FROM messages WHERE match_id::text = $1', [matchId]);
    return res.status(200).json(messagesResult.rows);
  } catch (err: any) {
    console.error('Fetch match messages error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/messages/:messageId - Delete own message
router.delete('/messages/:messageId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  try {
    const msgRes = await query('SELECT * FROM messages WHERE id::text = $1', [messageId]);
    if (msgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const msg = msgRes.rows[0];
    const isAdmin = req.user?.is_admin || req.user?.email === 'amitkumarshukla296@gmail.com';
    if (msg.sender_id?.toString() !== userId?.toString() && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    await query('DELETE FROM messages WHERE id::text = $1', [messageId]);
    return res.status(200).json({ success: true, messageId });
  } catch (err: any) {
    console.error('Delete message error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
