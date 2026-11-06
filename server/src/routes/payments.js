import { Router } from 'express';
import { z } from 'zod';

import { query } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { writeAuditLog } from '../middleware/audit.js';

const router = Router();

router.use(requireAdmin);

const idSchema = z.coerce.number().int().positive().safe();

const statusSchema = z.object({
  status: z.enum(['verified', 'failed'])
});

// View sandbox payments
router.get(
  '/',
  requirePermission('payments:view'),
  async (_req, res) => {
    try {
      const result = await query(
        `SELECT
           p.id,
           p.order_id,
           p.user_id,
           p.method,
           p.amount,
           p.mode,
           p.status,
           p.created_at,
           p.verified_at,
           a.name AS verified_by_name
         FROM payments p
         LEFT JOIN admins a ON a.id = p.verified_by
         WHERE p.mode = 'sandbox'
         ORDER BY p.created_at DESC
         LIMIT 100`
      );

      return res.json({
        success: true,
        payments: result.rows
      });
    } catch (error) {
      console.error('Sandbox payments error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Could not load sandbox payments.'
      });
    }
  }
);

// Update sandbox payment status
router.patch(
  '/:id/status',
  requirePermission('payments:manage'),
  async (req, res) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      const body = statusSchema.safeParse(req.body);

      if (!id.success || !body.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment ID or status.'
        });
      }

      const result = await query(
        `UPDATE payments
         SET status = $1,
             verified_by = $2,
             verified_at = NOW()
         WHERE id = $3
           AND mode = 'sandbox'
           AND status = 'pending'
         RETURNING id, order_id, status, mode`,
        [
          body.data.status,
          req.admin.id,
          id.data
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pending sandbox payment not found.'
        });
      }

      await writeAuditLog({
        req,
        action: 'sandbox_payment_status_updated',
        entity: 'payment',
        entityId: id.data,
        details: {
          newStatus: body.data.status
        }
      });

      return res.json({
        success: true,
        payment: result.rows[0]
      });
    } catch (error) {
      console.error('Sandbox payment update error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Could not update sandbox payment.'
      });
    }
  }
);

export default router;