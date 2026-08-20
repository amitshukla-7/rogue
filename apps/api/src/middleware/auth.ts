import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, mockDb } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    college_verified: boolean;
    is_admin?: boolean;
    is_banned?: boolean;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = req.cookies?.token;
  if (!token && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      id: string; 
      email: string; 
      college_verified: boolean;
      is_admin?: boolean;
      is_banned?: boolean;
    };

    // Invalidate old demo user tokens leftover in browser cookies from dev testing
    if (
      decoded.id?.startsWith('student-demo') ||
      decoded.id?.startsWith('admin-demo') ||
      decoded.email === 'admin@campusconnect.com' ||
      decoded.email?.includes('aarav.sharma')
    ) {
      res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' });
      return res.status(401).json({ error: 'Unauthorized: Demo session invalidated' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
  }
};

export const blockBanned = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.id) return next();
  if (req.path === '/appeal' || req.path.endsWith('/appeal')) return next();

  try {
    const userRes = await query('SELECT is_banned, ban_reason FROM users WHERE id::text = $1', [req.user.id]);
    let isBanned = false;
    let banReason = null;

    if (userRes.rows.length > 0) {
      isBanned = !!userRes.rows[0].is_banned;
      banReason = userRes.rows[0].ban_reason;
    } else {
      const mockUser = mockDb.users.find((u) => u.id === req.user?.id);
      if (mockUser) {
        isBanned = !!mockUser.is_banned;
        banReason = mockUser.ban_reason;
      }
    }

    if (isBanned) {
      return res.status(403).json({ 
        error: 'account_banned', 
        message: banReason ? `Account banned: ${banReason}` : 'Your account has been banned by an administrator.' 
      });
    }

    next();
  } catch (err) {
    next();
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.email === 'amitkumarshukla296@gmail.com') {
    return next();
  }

  try {
    const userRes = await query('SELECT is_admin, email FROM users WHERE id::text = $1', [req.user.id]);
    let isAdmin = false;

    if (userRes.rows.length > 0) {
      isAdmin = !!userRes.rows[0].is_admin || userRes.rows[0].email === 'amitkumarshukla296@gmail.com';
    } else {
      const mockUser = mockDb.users.find((u) => u.id === req.user?.id);
      if (mockUser) {
        isAdmin = !!mockUser.is_admin || mockUser.email === 'amitkumarshukla296@gmail.com';
      } else if (req.user.is_admin) {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    return next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

export const requireCollegeVerified = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  next();
};

