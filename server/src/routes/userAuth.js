
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../config/db.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Try again later.'
  }
});

const emailLoginSchema = z.object({
  email: z.string()
    .trim()
    .email()
    .max(255)
    .transform(value => value.toLowerCase()),

  password: z.string()
    .min(1)
    .max(200)
});

const googleLoginSchema = z.object({
  credential: z.string().min(20).max(5000)
});

function createUserToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    {
      id: user.id,
      type: 'user'
    },
    secret,
    {
      expiresIn: '8h',
      algorithm: 'HS256'
    }
  );
}

// Save successful login history
async function recordLogin(userId, method) {
  await query(
    `INSERT INTO user_login_history
      (user_id, login_method)
     VALUES ($1, $2)`,
    [userId, method]
  );
}

// Email + Password Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const parsed = emailLoginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Valid email and password are required.'
      });
    }

    const { email, password } = parsed.data;

    const result = await query(
      `SELECT id, name, email, password_hash, status
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = result.rows[0];

    if (
      user.status !== 'active' ||
      !user.password_hash
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = createUserToken(user);

    await recordLogin(user.id, 'email');

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('User login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Login failed due to a server error.'
    });
  }
});

// Google Login — existing accounts only
router.post('/google', loginLimiter, async (req, res) => {
  try {
    const parsed = googleLoginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required.'
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(503).json({
        success: false,
        message: 'Google Login is not configured.'
      });
    }

    const response = await fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' +
      encodeURIComponent(parsed.data.credential)
    );

    if (!response.ok) {
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed.'
      });
    }

    const googleUser = await response.json();

    const validIssuer = [
      'accounts.google.com',
      'https://accounts.google.com'
    ].includes(googleUser.iss);

    const validAudience = googleUser.aud === clientId;

    const verifiedEmail =
      googleUser.email_verified === true ||
      googleUser.email_verified === 'true';

    if (
      !validIssuer ||
      !validAudience ||
      !verifiedEmail ||
      !googleUser.sub ||
      !googleUser.email
    ) {
      return res.status(401).json({
        success: false,
        message: 'Google account could not be verified.'
      });
    }

    const email = googleUser.email.toLowerCase();

    const result = await query(
      `SELECT id, name, email, google_sub, status
       FROM users
       WHERE email = $1 OR google_sub = $2
       LIMIT 1`,
      [email, googleUser.sub]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: 'No existing account found for this Google account.'
      });
    }

    const user = result.rows[0];

    if (
      user.status !== 'active' ||
      user.email !== email ||
      (user.google_sub && user.google_sub !== googleUser.sub)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Google login is not available for this account.'
      });
    }

    if (!user.google_sub) {
      await query(
        `UPDATE users
         SET google_sub = $1
         WHERE id = $2 AND google_sub IS NULL`,
        [googleUser.sub, user.id]
      );
    }

    const token = createUserToken(user);

    await recordLogin(user.id, 'google');

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Google login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Google login failed due to a server error.'
    });
  }
});

// Get logged-in user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      return res.status(500).json({
        success: false,
        message: 'Server authentication is not configured.'
      });
    }

    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256']
    });

    if (decoded.type !== 'user' || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user token.'
      });
    }

    const result = await query(
      `SELECT id, name, email, phone, ff_player_id,
              ff_ingame_name, language, status
       FROM users
       WHERE id = $1 AND status = 'active'
       LIMIT 1`,
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: 'User account is unavailable.'
      });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired login session.'
    });
  }
});

export default router;
