
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret.length < 32) {
      return res.status(500).json({
        success: false,
        message: 'Authentication is not configured'
      });
    }

    const decoded = jwt.verify(token, jwtSecret);

    if (
      !decoded.id ||
      decoded.type !== 'admin' ||
      !['admin', 'superadmin', 'support'].includes(decoded.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const result = await query(
      `SELECT id, name, email, role
       FROM admins
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is inactive or unavailable'
      });
    }

    req.admin = result.rows[0];

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    console.error('Admin authentication error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
}
