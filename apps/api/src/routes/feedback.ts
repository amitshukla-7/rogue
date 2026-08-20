import { Router, Response } from 'express';
import crypto from 'crypto';
import { query, mockDb } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

// POST /api/feedback - Submit feedback / suggestion to admin
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    let userId: string | null = null;
    let userName = req.body.name || 'Anonymous Student';
    let userEmail = req.body.email || 'student@campus.edu';

    // Check optional token if user is logged in
    let token = req.cookies?.token;
    if (!token && req.headers['authorization']) {
      token = req.headers['authorization'].split(' ')[1];
    }
    if (token) {
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) {
          userId = decoded.id || decoded.userId;
          const u = mockDb.users.find((usr: any) => usr.id === userId);
          if (u) {
            userName = u.name;
            userEmail = u.email;
          }
        }
      } catch (err) {}
    }

    const { category = 'suggestion', message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const feedbackItem = {
      id: 'fb-' + crypto.randomUUID().substring(0, 8),
      user_id: userId,
      user_name: userName.trim(),
      user_email: userEmail.trim(),
      category: category || 'suggestion',
      message: message.trim(),
      status: 'new',
      created_at: new Date().toISOString()
    };

    if (process.env.DATABASE_URL) {
      try {
        await query(
          'INSERT INTO feedback (id, user_id, user_name, user_email, category, message, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [feedbackItem.id, feedbackItem.user_id, feedbackItem.user_name, feedbackItem.user_email, feedbackItem.category, feedbackItem.message, feedbackItem.status, feedbackItem.created_at]
        );
      } catch (dbErr) {
        mockDb.feedback.unshift(feedbackItem);
      }
    } else {
      mockDb.feedback.unshift(feedbackItem);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:new_feedback', feedbackItem);
    }

    return res.status(201).json({ 
      success: true, 
      message: 'Thank you! Your feedback has been sent directly to Platform Administration.', 
      feedback: feedbackItem 
    });
  } catch (err: any) {
    console.error('Submit feedback error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
