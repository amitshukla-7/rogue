import { Router, Response } from 'express';
import { query } from '../db/index.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST file a report
router.post('/reports', authenticateToken, async (req: AuthRequest, res: Response) => {
  const reporterId = req.user?.id;
  const { reportedUserId, reason, context } = req.body;

  if (!reporterId || !reportedUserId || !reason) {
    return res.status(400).json({ error: 'Missing reportedUserId or reason' });
  }

  try {
    const result = await query(
      'INSERT INTO reports (reporter_id, reported_user_id, reason, context) VALUES ($1, $2, $3, $4)',
      [reporterId, reportedUserId, reason, context || null]
    );
    const newReport = result.rows[0];

    // Emit to admin socket room
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('admin:new_report', {
        ...newReport,
        reporter_name: req.user?.email || 'Student',
        reported_user_name: 'Reported User',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }

    return res.status(201).json(newReport);
  } catch (err: any) {
    console.error('File report error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST block a user
router.post('/blocks', authenticateToken, async (req: AuthRequest, res: Response) => {
  const blockerId = req.user?.id;
  const { blockedUserId } = req.body;

  if (!blockerId || !blockedUserId) {
    return res.status(400).json({ error: 'Missing blockedUserId' });
  }

  try {
    const result = await query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)',
      [blockerId, blockedUserId]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Block user error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET admin reports queue (Super Admin Only)
router.get('/admin/reports', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM reports ORDER BY created_at DESC');
    return res.status(200).json(result.rows);
  } catch (err: any) {
    console.error('Fetch reports error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT review admin report (Super Admin Only)
router.put('/admin/reports/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // 'resolved' or other

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    // In our mock DB or actual DB, update the status
    // Note: our mockDb queries handles UPDATE by modifying records matching ID
    const result = await query(
      'UPDATE reports SET status = $1 WHERE id = $2',
      [status, id]
    );
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Update report error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
