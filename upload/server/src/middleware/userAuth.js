import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export async function requireUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token || token.length > 4096) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login session.'
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

    if (
      decoded.type !== 'user' ||
      !decoded.id ||
      !Number.isSafeInteger(Number(decoded.id)) ||
      Number(decoded.id) <= 0
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user session.'
      });
    }

    const result = await query(
      `SELECT id, name, email, status
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

    req.user = result.rows[0];

    return next();

  } catch (error) {
    if (error.name !== 'JsonWebTokenError' &&
        error.name !== 'TokenExpiredError') {
      console.error('User authentication error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Authentication service error.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired login session.'
    });
  }
}