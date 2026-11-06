import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(requireAdmin);

const imageUrlSchema = z.string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true;

    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return (
        value.startsWith('/') &&
        !value.startsWith('//') &&
        !value.split('/').includes('..')
      );
    }
  }, 'Invalid image URL');

const packageSchema = z.object({
  name_en: z.string().trim().min(1).max(150),
  name_bn: z.string().trim().max(150).optional().nullable(),
  category: z.enum([
    'diamonds',
    'weekly',
    'monthly',
    'levelup'
  ]).default('diamonds'),
  diamonds: z.number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
    .nullable(),
  price: z.number().finite().nonnegative().max(10000000),
  image_url: imageUrlSchema.optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional()
}).strict().superRefine((data, ctx) => {
  if (
    data.category === 'diamonds' &&
    (data.diamonds == null || data.diamonds <= 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['diamonds'],
      message: 'Diamond amount is required'
    });
  }
});

// LIST PACKAGES
router.get(
  '/',
  requirePermission('packages:view'),
  async (_req, res) => {
    try {
      const result = await query(
        `SELECT id, name_bn, name_en, category,
                diamonds, price, image_url,
                sort_order, is_active, created_at
         FROM diamond_packages
         ORDER BY sort_order ASC, id ASC`
      );

      return res.json({
        success: true,
        packages: result.rows
      });
    } catch (error) {
      console.error('Admin packages error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Could not load packages'
      });
    }
  }
);

// CREATE PACKAGE
router.post(
  '/',
  requirePermission('packages:manage'),
  async (req, res) => {
    try {
      const parsed = packageSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message ||
            'Invalid package information'
        });
      }

      const {
        name_en,
        name_bn,
        category,
        diamonds,
        price,
        image_url,
        sort_order
      } = parsed.data;

      const result = await query(
        `INSERT INTO diamond_packages
         (name_en, name_bn, category, diamonds,
          price, image_url, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name_en, name_bn, category,
                   diamonds, price, image_url,
                   sort_order, is_active, created_at`,
        [
          name_en,
          name_bn || null,
          category,
          diamonds ?? null,
          price,
          image_url || null,
          sort_order ?? 0
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Package created',
        package: result.rows[0]
      });
    } catch (error) {
      console.error('Create package error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Could not create package'
      });
    }
  }
);

// EDIT PACKAGE
router.patch(
  '/:id',
  requirePermission('packages:manage'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid package ID'
        });
      }

      const parsed = packageSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message ||
            'Invalid package information'
        });
      }

      const {
        name_en,
        name_bn,
        category,
        diamonds,
        price,
        image_url,
        sort_order
      } = parsed.data;

      const result = await query(
        `UPDATE diamond_packages
         SET name_en = $1,
             name_bn = $2,
             category = $3,
             diamonds = $4,
             price = $5,
             image_url = $6,
             sort_order = $7
         WHERE id = $8
         RETURNING id, name_en, name_bn, category,
                   diamonds, price, image_url,
                   sort_order, is_active, created_at`,
        [
          name_en,
          name_bn || null,
          category,
          diamonds ?? null,
          price,
          image_url || null,
          sort_order ?? 0,
          id
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Package not found'
        });
      }

      return res.json({
        success: true,
        message: 'Package updated successfully',
        package: result.rows[0]
      });
    } catch (error) {
      console.error('Edit package error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Could not update package'
      });
    }
  }
);

// ACTIVATE / DEACTIVATE
router.patch(
  '/:id/status',
  requirePermission('packages:manage'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const parsed = z.object({
        is_active: z.boolean()
      }).strict().safeParse(req.body);

      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid package ID'
        });
      }

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'is_active must be true or false'
        });
      }

      const result = await query(
        `UPDATE diamond_packages
         SET is_active = $1
         WHERE id = $2
         RETURNING id, name_en, name_bn, category,
                   diamonds, price, is_active`,
        [parsed.data.is_active, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Package not found'
        });
      }

      return res.json({
        success: true,
        message: 'Package status updated',
        package: result.rows[0]
      });
    } catch (error) {
      console.error('Update package status error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Could not update package status'
      });
    }
  }
);

export default router;