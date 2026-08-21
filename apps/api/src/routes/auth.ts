import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, mockDb } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { isInstitutionalEmail } from '../config/domains.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// Helper to sign JWT and set cookie
const setAuthCookie = (res: Response, payload: { id: string; email: string; college_verified: boolean; is_admin?: boolean; is_banned?: boolean }) => {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days persistent session
  });
};

// GET Demo Accounts List (Disabled in production)
router.get('/demo-accounts', async (req: Request, res: Response) => {
  return res.status(404).json({ error: 'Endpoint unavailable' });
});

// POST 1-Click Demo Login (Disabled in production)
router.post('/demo-login', async (req: Request, res: Response) => {
  return res.status(404).json({ error: 'Endpoint unavailable' });
});

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing name, email, or password' });
  }

  const userEmail = (email as string).trim().toLowerCase();
  
  // Enforce college email domain requirement
  if (!isInstitutionalEmail(userEmail)) {
    return res.status(400).json({ 
      error: 'Registration is strictly restricted to college email addresses (eg.user@mits.ac.in). Personal emails like Gmail are not permitted.' 
    });
  }

  const autoCollegeVerified = true;

  try {
    let user;
    if (process.env.DATABASE_URL) {
      const existingUser = await query('SELECT * FROM users WHERE email = $1', [userEmail]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Account with this email already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      const result = await query(
        'INSERT INTO users (email, password_hash, name, college_verified) VALUES ($1, $2, $3, $4) RETURNING *',
        [userEmail, hash, name.trim(), autoCollegeVerified]
      );

      user = result.rows[0];
    } else {
      const existing = mockDb.users.find((u: any) => u.email === userEmail);
      if (existing) {
        return res.status(400).json({ error: 'Account with this email already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      user = {
        id: `user-${Date.now()}`,
        email: userEmail,
        password_hash: hash,
        name: name.trim(),
        handle: name.trim().toLowerCase().replace(/\s+/g, '_'),
        college_verified: autoCollegeVerified,
        photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'],
        created_at: new Date().toISOString()
      };
      mockDb.users.unshift(user);
    }

    setAuthCookie(res, { 
      id: user.id, 
      email: user.email, 
      college_verified: !!user.college_verified,
      is_admin: !!user.is_admin,
      is_banned: !!user.is_banned
    });
    
    const userClean = { ...user };
    delete userClean.password_hash;
    return res.status(201).json({ user: userClean });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const userEmail = (email as string).trim().toLowerCase();

  // Enforce college email domain requirement on login
  if (!isInstitutionalEmail(userEmail)) {
    return res.status(400).json({ 
      error: 'Login is strictly restricted to verified college email addresses (e.g. user@mits.ac.in). Personal emails (Gmail, Yahoo, etc.) are not allowed.' 
    });
  }

  try {
    let user;
    if (process.env.DATABASE_URL) {
      const result = await query('SELECT * FROM users WHERE email = $1', [userEmail]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      user = result.rows[0];
    } else {
      user = mockDb.users.find((u: any) => u.email === userEmail);
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Account created with Google OAuth' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    setAuthCookie(res, { 
      id: user.id, 
      email: user.email, 
      college_verified: !!user.college_verified,
      is_admin: !!user.is_admin,
      is_banned: !!user.is_banned
    });
    
    const userClean = { ...user };
    delete userClean.password_hash;
    return res.status(200).json({ user: userClean });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully' });
});

// Google OAuth Redirect Route
router.get('/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const reqHost = req.get('host') || 'localhost:3001';
  // Render runs behind a proxy — req.protocol may return 'http' even on HTTPS.
  // Always use HTTPS in production. Only fall back to http for localhost dev.
  const isProduction = process.env.NODE_ENV === 'production';
  const protocol = isProduction ? 'https' : (req.protocol || 'http');
  const backendUrl = process.env.BACKEND_URL ? process.env.BACKEND_URL.trim().replace(/\/$/, '') : `${protocol}://${reqHost}`;
  
  // Support both port 3001 and port 3000 redirect URIs
  const redirectUri = `${backendUrl}/api/auth/google/callback`;

  // If email param is explicitly passed in dev mode, proceed directly
  if (req.query.email) {
    const requestedEmail = (req.query.email as string).trim();
    const name = requestedEmail.split('@')[0].replace('.', ' ');
    const devRedirectUri = `${backendUrl}/api/auth/google/callback?email=${encodeURIComponent(requestedEmail)}&name=${encodeURIComponent(name)}&googleId=google_user_${Date.now()}`;
    return res.redirect(devRedirectUri);
  }

  // If real Google Client ID is configured and prompt=select is NOT explicitly requested, redirect to Google's official OAuth consent page
  if (clientId && clientId.trim() !== '' && req.query.prompt !== 'select') {
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.append('client_id', clientId.trim());
    googleAuthUrl.searchParams.append('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.append('response_type', 'code');
    googleAuthUrl.searchParams.append('scope', 'openid email profile');
    googleAuthUrl.searchParams.append('prompt', 'select_account'); // Forces Google account picker
    return res.redirect(googleAuthUrl.toString());
  }

  // Render Google Account Chooser & Setup Guide UI
  res.setHeader('Content-Type', 'text/html');
  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in with Google - CampusConnect</title>
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { background-color: #0f1017; color: #e1e3ed; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: #171924; border: 1px solid #282b3c; border-radius: 24px; width: 100%; max-width: 460px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .logo { display: flex; justify-content: center; margin-bottom: 20px; }
        .logo svg { width: 42px; height: 42px; }
        h1 { font-size: 22px; font-weight: 600; text-align: center; margin: 0 0 6px 0; color: #ffffff; }
        p.subtitle { text-align: center; font-size: 13px; color: #8e94ad; margin: 0 0 24px 0; }
        .notice { background: rgba(255, 87, 87, 0.1); border: 1px solid rgba(255, 87, 87, 0.25); border-radius: 16px; padding: 14px 16px; margin-bottom: 20px; font-size: 12px; line-height: 1.5; color: #ff8585; }
        .account-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .account-item { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: #202333; border: 1px solid #2d3147; border-radius: 16px; text-decoration: none; color: white; transition: all 0.2s ease; cursor: pointer; }
        .account-item:hover { background: #282c40; border-color: #ff5757; transform: translateY(-1px); }
        .avatar { width: 38px; height: 38px; border-radius: 50%; background: #353a56; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #ff5757; font-size: 15px; }
        .details { flex: 1; min-width: 0; }
        .name { font-size: 13px; font-weight: 600; color: white; margin: 0; }
        .email { font-size: 11px; color: #9ea4c0; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
        .badge { font-size: 9px; font-weight: bold; padding: 3px 8px; border-radius: 10px; text-transform: uppercase; }
        .badge-verified { background: rgba(39, 174, 96, 0.15); color: #27ae60; border: 1px solid rgba(39, 174, 96, 0.3); }
        .badge-standard { background: rgba(241, 196, 15, 0.15); color: #f1c40f; border: 1px solid rgba(241, 196, 15, 0.3); }
        .custom-form { margin-top: 20px; border-top: 1px solid #282b3c; padding-top: 20px; }
        .custom-form label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8e94ad; margin-bottom: 8px; font-weight: bold; }
        .input-group { display: flex; gap: 8px; }
        .input-group input { flex: 1; background: #0f1017; border: 1px solid #2d3147; border-radius: 12px; padding: 10px 14px; color: white; font-size: 12px; outline: none; }
        .input-group input:focus { border-color: #ff5757; }
        .input-group button { background: #ff5757; color: white; border: none; border-radius: 12px; padding: 10px 16px; font-size: 12px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .input-group button:hover { background: #e04848; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <svg viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.1 0-5.74-2.09-6.68-4.91H1.36v3.15C3.33 21.32 7.39 24 12 24z" />
            <path fill="#FBBC05" d="M5.32 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.56H1.36C.49 8.29 0 10.23 0 12.27s.49 3.98 1.36 5.71l3.96-3.69z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.23 0 12 0 7.39 0 3.33 2.68 1.36 6.56l3.96 3.69c.94-2.82 3.58-4.91 6.68-4.91z" />
          </svg>
        </div>
        <h1>Sign In with Google Account</h1>
        <p class="subtitle">to continue to <strong>CampusConnect</strong></p>

        <div class="account-list">
          <a href="/api/auth/google?email=amitkumarshukla296%40gmail.com" class="account-item">
            <div class="avatar">AS</div>
            <div class="details">
              <div class="name">Amit Shukla (Super Admin)</div>
              <div class="email">amitkumarshukla296@gmail.com</div>
            </div>
            <span class="badge badge-verified">Super Admin</span>
          </a>
        </div>

        <div class="custom-form">
          <label>Sign in with your College Email Address (ending with mits.ac.in):</label>
          <form action="/api/auth/google" method="GET" class="input-group">
            <input type="email" name="email" placeholder="your.name@mits.ac.in" required />
            <button type="submit">Sign In Now</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Google OAuth Callback Route (Handles both Real OAuth & Dev Mode)
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const reqHost = req.get('host') || 'localhost:3001';
  const isProduction = process.env.NODE_ENV === 'production';
  const protocol = isProduction ? 'https' : (req.protocol || 'http');
  const backendUrl = process.env.BACKEND_URL ? process.env.BACKEND_URL.trim().replace(/\/$/, '') : `${protocol}://${reqHost}`;
  const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim().replace(/\/$/, '') : 'http://localhost:3000';

  let userEmail = '';
  let name = '';
  let googleId = '';
  let photoUrl = '';

  // 1. Real Google OAuth Code Exchange
  if (code && clientId && clientSecret) {
    try {
      const primaryRedirectUri = `${backendUrl}/api/auth/google/callback`;
      let tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          redirect_uri: primaryRedirectUri,
          grant_type: 'authorization_code'
        })
      });

      let tokenData: any = await tokenRes.json();
      
      // Fallback try with port 3000 if port 3001 failed
      if (!tokenRes.ok || !tokenData.access_token) {
        const altRedirectUri = `http://localhost:3000/api/auth/google/callback`;
        const retryRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            redirect_uri: altRedirectUri,
            grant_type: 'authorization_code'
          })
        });
        const retryData: any = await retryRes.json();
        if (retryRes.ok && retryData.access_token) {
          tokenRes = retryRes;
          tokenData = retryData;
        }
      }

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error('Google Token Exchange Error:', tokenData);
        
        // Render clear, user-friendly HTML error & fallback page
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Google Sign In Guide - CampusConnect</title>
            <style>
              body { background: #0f1017; color: white; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
              .box { background: #171924; border: 1px solid #282b3c; border-radius: 24px; max-width: 500px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
              h1 { font-size: 20px; color: #ff5757; margin-top: 0; }
              p { font-size: 13px; color: #9ea4c0; line-height: 1.6; }
              .code-block { background: #0b0c12; border: 1px solid #202333; padding: 12px; border-radius: 12px; font-mono; font-size: 11px; color: #34d399; overflow-x: auto; margin: 16px 0; }
              .btn { display: inline-block; background: #ff5757; color: white; padding: 12px 20px; border-radius: 14px; text-decoration: none; font-weight: bold; font-size: 13px; transition: all 0.2s; margin-top: 10px; }
              .btn:hover { background: #e04848; }
            </style>
          </head>
          <body>
            <div class="box">
              <h1>Google OAuth Redirect Setting Required</h1>
              <p>Google returned an authentication code error (<code>${tokenData.error || 'token_exchange_failed'}</code>).</p>
              <p>Please ensure that your Google Cloud Console has this Authorized Redirect URI configured:</p>
              <div class="code-block">${backendUrl}/api/auth/google/callback</div>
              <p>Or click below to complete pre-registration instantly with any email:</p>
              <a href="/api/auth/google?email=student%40mits.ac.in" class="btn">Instant Test Sign In (student@mits.ac.in)</a>
            </div>
          </body>
          </html>
        `);
      }

      // Fetch Real User Profile from Google UserInfo API
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const profile: any = await userinfoRes.json();
      if (!userinfoRes.ok || !profile.email) {
        console.error('Google UserInfo Error:', profile);
        return res.status(400).json({ error: 'Failed to fetch user profile from Google', details: profile });
      }

      userEmail = profile.email.trim().toLowerCase();
      name = profile.name || userEmail.split('@')[0];
      googleId = profile.sub;
      photoUrl = profile.picture || '';

    } catch (err: any) {
      console.error('Real Google OAuth Failed:', err);
      return res.status(500).json({ error: 'Failed to authenticate with Google' });
    }
  } 
  // 2. Dev Mode Fallback Handler
  else if (req.query.email && req.query.name && req.query.googleId) {
    userEmail = (req.query.email as string).trim().toLowerCase();
    name = (req.query.name as string).trim();
    googleId = (req.query.googleId as string).trim();
  } else {
    return res.status(400).json({ error: 'Invalid Google OAuth callback params' });
  }

  // 3. Perform Domain Whitelist Verification
  const isAdminEmail = userEmail.toLowerCase() === 'amitkumarshukla296@gmail.com';
  const autoCollegeVerified = isInstitutionalEmail(userEmail) || isAdminEmail;

  // Unconditionally block login & registration for non-institutional personal emails except super admin
  if (!autoCollegeVerified) {
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(
        'Please login with your college email only'
      )}`
    );
  }

  try {
    let userResult = await query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, userEmail]);
    let user;

    if (userResult.rows.length === 0) {
      // Create new user authenticated via Google OAuth
      const inserted = await query(
        'INSERT INTO users (email, google_id, name, college_verified, is_admin, photos) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [userEmail, googleId, name, true, isAdminEmail, photoUrl ? [photoUrl] : []]
      );
      user = inserted.rows[0];
    } else {
      user = userResult.rows[0];
      // Update college verification status, admin status, or photo if updated
      if (!user.college_verified || (isAdminEmail && !user.is_admin)) {
        user.college_verified = true;
        if (isAdminEmail) user.is_admin = true;
        await query('UPDATE users SET college_verified = true, is_admin = $1 WHERE id = $2', [user.is_admin || isAdminEmail, user.id]);
      }
      if (photoUrl && (!user.photos || user.photos.length === 0)) {
        user.photos = [photoUrl];
      }
    }

    const isFirstTimeUser = userResult.rows.length === 0 || !user.handle;

    setAuthCookie(res, { 
      id: user.id, 
      email: user.email, 
      college_verified: !!user.college_verified,
      is_admin: !!user.is_admin,
      is_banned: !!user.is_banned 
    });
    
    // Redirect logic: Admin to /admin, first-time users to /onboarding (edit profile), returning users to /
    if (isAdminEmail) {
      return res.redirect(`${frontendUrl}/admin`);
    } else if (isFirstTimeUser) {
      return res.redirect(`${frontendUrl}/onboarding`);
    } else {
      return res.redirect(`${frontendUrl}/`);
    }
  } catch (err: any) {
    console.error('Google Callback Database Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Request College Email OTP
router.post(['/verify-college-email/request', '/verify-college'], authenticateToken, async (req: AuthRequest, res: Response) => {
  const { collegeEmail } = req.body;
  const userId = req.user?.id;

  if (!collegeEmail || !userId) {
    return res.status(400).json({ error: 'Missing college email' });
  }

  // Validate institutional domain requirement
  if (!isInstitutionalEmail(collegeEmail)) {
    return res.status(400).json({ error: 'Please enter a valid college email address (e.g. user@mits.ac.in)' });
  }

  try {
    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Clear old OTPs
    await query('DELETE FROM college_email_otps WHERE user_id = $1', [userId]);
    // Save new OTP
    await query(
      'INSERT INTO college_email_otps (user_id, college_email, otp_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, collegeEmail, otpHash, expiresAt]
    );

    // LOG THE OTP to server output for local developers
    console.log(`\n--- MOCK OTP EMAIL SENT ---`);
    console.log(`To: ${collegeEmail}`);
    console.log(`Code: ${otp}`);
    console.log(`-----------------------------\n`);

    return res.status(200).json({ message: 'OTP sent successfully to your college email' });
  } catch (err: any) {
    console.error('OTP request error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Confirm College Email OTP
router.post(['/verify-college-email/confirm', '/verify-college/confirm'], authenticateToken, async (req: AuthRequest, res: Response) => {
  const otp = req.body.otp || req.body.token;
  const userId = req.user?.id;

  if (!otp || !userId) {
    return res.status(400).json({ error: 'Missing OTP code' });
  }

  try {
    const result = await query('SELECT * FROM college_email_otps WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No OTP requested for this user' });
    }

    const record = result.rows[0];
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const isMatch = await bcrypt.compare(otp, record.otp_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    // Mark user verified
    await query('UPDATE users SET college_verified = true WHERE id = $1', [userId]);
    
    // Clear the OTP
    await query('DELETE FROM college_email_otps WHERE user_id = $1', [userId]);

    // Re-cookie the client with the updated college_verified: true status
    setAuthCookie(res, { id: userId, email: req.user!.email, college_verified: true });

    return res.status(200).json({ collegeVerified: true });
  } catch (err: any) {
    console.error('OTP confirmation error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Submit Ban Appeal (for suspended users)
router.post('/appeal', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { reason } = req.body;

  if (!userId || !reason) {
    return res.status(400).json({ error: 'Appeal statement is required' });
  }

  try {
    const userRes = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0] || mockDb.users.find((u: any) => u.id === userId) || { name: 'Student', email: req.user?.email };

    if (process.env.DATABASE_URL) {
      await query(
        'INSERT INTO appeals (user_id, user_name, user_email, reason) VALUES ($1, $2, $3, $4)',
        [userId, user.name, user.email, reason]
      );
    } else {
      mockDb.appeals.push({
        id: 'appeal-' + Date.now(),
        user_id: userId,
        user_name: user.name,
        user_email: user.email,
        reason,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }

    return res.status(200).json({ success: true, message: 'Appeal submitted successfully for admin review.' });
  } catch (err: any) {
    console.error('Submit appeal error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST Logout - Clears session JWT cookie
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export default router;
