
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(requireAdmin);

const likeSchema = z.object({
  name_en: z.string().trim().min(1).max(150),
  name_bn: z.string().trim().max(150).optional().nullable(),
  platform: z.string().trim().max(100).optional().nullable(),
  quantity: z.number().int().positive().max(100000000),
  price: z.number().finite().nonnegative().max(10000000)
}).strict();

// LIST LIKES
router.get(
  '/',
  requirePermission('likes:view'),
  async (_req, res) => {
    try {
      const result = await query(
        `SELECT id, name_bn, name_en, platform,
                quantity, price, is_active, created_at
         FROM like_services
         ORDER BY id ASC`
      );

      return res.json({
        success: true,
        likes: result.rows
      });
    } catch (error) {
      console.error('Admin likes error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Could not load like services.'
      });
    }
  }
);

// CREATE LIKE PACKAGE
router.post(
  '/',
  requirePermission('likes:manage'),
  async (req, res) => {
    try {
      const parsed = likeSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message ||
            'Invalid like package information.'
        });
      }

      const {
        name_en,
        name_bn,
        platform,
        quantity,
        price
      } = parsed.data;

      const result = await query(
        `INSERT INTO like_services
         (name_en, name_bn, platform, quantity, price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name_bn, name_en, platform,
                   quantity, price, is_active, created_at`,
        [
          name_en,
          name_bn || null,
          platform || null,
          quantity,
          price
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Like package created.',
        like: result.rows[0]
      });
    } catch (error) {
      console.error('Create like error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Could not create like package.'
      });
    }
  }
);

// EDIT LIKE PACKAGE
router.patch(
  '/:id',
  requirePermission('likes:manage'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid like package ID.'
        });
      }

      const parsed = likeSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message ||
            'Invalid like package information.'
        });
      }

      const {
        name_en,
        name_bn,
        platform,
        quantity,
        price
      } = parsed.data;

      const result = await query(
        `UPDATE like_services
         SET name_en = $1,
             name_bn = $2,
             platform = $3,
             quantity = $4,
             price = $5
         WHERE id = $6
         RETURNING id, name_bn, name_en, platform,
                   quantity, price, is_active, created_at`,
        [
          name_en,
          name_bn || null,
          platform || null,
          quantity,
          price,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Like package not found.'
        });
      }

      return res.json({
        success: true,
        message: 'Like package updated.',
        like: result.rows[0]
      });
    } catch (error) {
      console.error('Edit like error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Could not update like package.'
      });
    }
  }
);

// ACTIVATE / DEACTIVATE
router.patch(
  '/:id/status',
  requirePermission('likes:manage'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const parsed = z.object({
        is_active: z.boolean()
      }).strict().safeParse(req.body);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid like package ID.'
        });
      }

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'is_active must be true or false.'
        });
      }

      const result = await query(
        `UPDATE like_services
         SET is_active = $1
         WHERE id = $2
         RETURNING id, name_en, quantity, price, is_active`,
        [parsed.data.is_active, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Like package not found.'
        });
      }

      return res.json({
        success: true,
        message: 'Like package status updated.',
        like: result.rows[0]
      });
    } catch (error) {
      console.error('Like status error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Could not update like package status.'
      });
    }
  }
);

export default router;
