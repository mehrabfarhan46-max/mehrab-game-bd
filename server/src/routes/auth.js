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

const loginSchema = z.object({
  email: z.string()
    .trim()
    .email()
    .max(255)
    .transform(value => value.toLowerCase()),

  password: z.string()
    .min(1)
    .max(200)
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Valid email and password are required.'
      });
    }

    const { email, password } = parsed.data;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret.length < 32) {
      return res.status(500).json({
        success: false,
        message: 'Server authentication is not configured.'
      });
    }

    const result = await query(
      `SELECT id, name, email, password_hash, role
       FROM admins
       WHERE email = $1 AND is_active = TRUE
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const admin = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        role: admin.role,
        type: 'admin'
      },
      jwtSecret,
      {
        expiresIn: '8h',
        algorithm: 'HS256'
      }
    );

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Login failed due to a server error.'
    });
  }
});

export default router;