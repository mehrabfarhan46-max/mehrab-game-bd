import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import { query, pool } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { writeAuditLog } from '../middleware/audit.js';

const router = Router();

router.use(requireAdmin);

const idSchema = z.coerce.number().int().positive().safe();

const orderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'processing',
    'completed',
    'rejected',
    'refunded'
  ])
});

const tournamentCategories = [
  'solo_br',
  'duo_br',
  'pro_league',
  'lone_wolf',
  'lone_wolf_headshot',
  'survival_br',
  'cs_4v4',
  'cs_4v4_headshot'
];

const tournamentSchema = z.object({
  title_en: z.string().trim().min(1).max(150),
  title_bn: z.string().trim().max(150).nullable().optional(),
  category: z.enum(tournamentCategories),
  mode: z.enum(['solo', 'duo', 'squad', '4v4']),
  starts_at: z.string().datetime({ offset: true }),
  max_players: z.coerce.number().int().min(1).max(1000),
  entry_fee: z.coerce.number().min(0).max(10000000).default(0),
  prize_info: z.string().trim().max(2000).nullable().optional(),
  rules: z.string().trim().max(5000).nullable().optional(),
  map_name: z.string().trim().max(100).nullable().optional(),
  per_kill_prize: z.coerce.number().min(0).max(10000000).optional(),
  winning_prize: z.coerce.number().min(0).max(10000000).optional(),
  tutorial_video_url: z.string().trim().max(1000).nullable().optional()
}).superRefine((data, ctx) => {
  const expectedMode = {
    solo_br: 'solo',
    survival_br: 'solo',
    duo_br: 'duo',
    lone_wolf: 'duo',
    lone_wolf_headshot: 'duo',
    pro_league: 'squad',
    cs_4v4: '4v4',
    cs_4v4_headshot: '4v4'
  }[data.category];

  if (data.mode !== expectedMode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mode'],
      message: `Selected category requires ${expectedMode} mode.`
    });
  }
});

const tournamentStatusSchema = z.object({
  status: z.enum([
    'draft',
    'upcoming',
    'live',
    'completed',
    'cancelled'
  ])
});

const roomSchema = z.object({
  room_id: z.string().trim().min(1).max(100),
  room_password: z.string().trim().min(1).max(100)
});

// Admin Profile
router.get('/me', requirePermission('dashboard:view'), (req, res) => {
  return res.json({ success: true, admin: req.admin });
});

// Dashboard Statistics
router.get('/dashboard', requirePermission('dashboard:view'), async (_req, res) => {
  try {
    const [orders, tournaments, packages] = await Promise.all([
      query('SELECT COUNT(*)::int AS total FROM orders'),
      query('SELECT COUNT(*)::int AS total FROM tournaments'),
      query('SELECT COUNT(*)::int AS total FROM diamond_packages')
    ]);

    return res.json({
      success: true,
      dashboard: {
        totalOrders: orders.rows[0].total,
        totalTournaments: tournaments.rows[0].total,
        totalPackages: packages.rows[0].total
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load dashboard.' });
  }
});

// Audit Logs
router.get('/audit-logs', requirePermission('dashboard:view'), async (_req, res) => {
  try {
    const result = await query(
      `SELECT audit_logs.id, audit_logs.admin_id, admins.name AS admin_name,
              audit_logs.action, audit_logs.entity, audit_logs.entity_id,
              audit_logs.details, audit_logs.created_at
       FROM audit_logs
       LEFT JOIN admins ON admins.id = audit_logs.admin_id
       ORDER BY audit_logs.created_at DESC
       LIMIT 100`
    );
    return res.json({ success: true, logs: result.rows });
  } catch (error) {
    console.error('Audit logs error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load audit logs.' });
  }
});

// Orders List
router.get('/orders', requirePermission('orders:view'), async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
    return res.json({ success: true, orders: result.rows });
  } catch (error) {
    console.error('Orders error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load orders.' });
  }
});

// Order Status Update
router.patch('/orders/:id/status', requirePermission('orders:update'), async (req, res) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    const body = orderStatusSchema.safeParse(req.body);

    if (!id.success || !body.success) {
      return res.status(400).json({ success: false, message: 'Invalid order ID or status.' });
    }

    const result = await query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
      [body.data.status, id.data]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    await writeAuditLog({
      req,
      action: 'order_status_updated',
      entity: 'order',
      entityId: id.data,
      details: { newStatus: body.data.status }
    });

    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error('Order status error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not update order status.' });
  }
});

// Tournaments List
router.get('/tournaments', requirePermission('tournaments:view'), async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM tournaments ORDER BY starts_at DESC LIMIT 200`);
    return res.json({ success: true, tournaments: result.rows });
  } catch (error) {
    console.error('Tournament list error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load tournaments.' });
  }
});

// Create Tournament
router.post('/tournaments', requirePermission('tournaments:manage'), async (req, res) => {
  try {
    const parsed = tournamentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament information.',
        errors: parsed.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    const data = parsed.data;
    const matchNumber = `MGBD-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const result = await query(
      `INSERT INTO tournaments
        (match_number, title_en, title_bn, category, mode, starts_at, max_players, entry_fee, prize_info, rules, map_name, per_kill_prize, winning_prize, tutorial_video_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'upcoming')
       RETURNING *`,
      [
        matchNumber, data.title_en, data.title_bn ?? null, data.category, data.mode,
        data.starts_at, data.max_players, data.entry_fee, data.prize_info ?? null,
        data.rules ?? null, data.map_name ?? null, data.per_kill_prize ?? 0,
        data.winning_prize ?? 0, data.tutorial_video_url ?? null
      ]
    );

    const tournament = result.rows[0];

    await writeAuditLog({
      req,
      action: 'tournament_created',
      entity: 'tournament',
      entityId: tournament.id,
      details: {
        title: tournament.title_en,
        category: tournament.category,
        matchNumber: tournament.match_number,
        entryFee: tournament.entry_fee
      }
    });

    return res.status(201).json({ success: true, tournament });
  } catch (error) {
    console.error('Tournament create error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not create tournament.' });
  }
});

// Edit Tournament
router.patch('/tournaments/:id', requirePermission('tournaments:manage'), async (req, res) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    const body = tournamentSchema.safeParse(req.body);

    if (!id.success || !body.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament information.',
        errors: body.success ? [] : body.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    const data = body.data;

    const result = await query(
      `UPDATE tournaments
       SET title_en = $1, title_bn = $2, category = $3, mode = $4, starts_at = $5,
           max_players = $6, entry_fee = $7, prize_info = $8, rules = $9, map_name = $10,
           per_kill_prize = $11, winning_prize = $12, tutorial_video_url = $13
       WHERE id = $14
       RETURNING *`,
      [
        data.title_en, data.title_bn ?? null, data.category, data.mode, data.starts_at,
        data.max_players, data.entry_fee, data.prize_info ?? null, data.rules ?? null,
        data.map_name ?? null, data.per_kill_prize ?? 0, data.winning_prize ?? 0,
        data.tutorial_video_url ?? null, id.data
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }

    await writeAuditLog({
      req,
      action: 'tournament_updated',
      entity: 'tournament',
      entityId: id.data,
      details: { title: data.title_en, category: data.category, entryFee: data.entry_fee }
    });

    return res.json({ success: true, tournament: result.rows[0] });
  } catch (error) {
    console.error('Tournament update error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not update tournament.' });
  }
});

// Delete Tournament
router.delete('/tournaments/:id', requirePermission('tournaments:manage'), async (req, res) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({ success: false, message: 'Invalid match ID.' });
    }

    const check = await query('SELECT id FROM tournaments WHERE id = $1', [id.data]);
    if (!check.rows.length) {
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }

    await query('DELETE FROM tournament_team_members WHERE team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = $1)', [id.data]);
    await query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id.data]);
    await query('DELETE FROM participants WHERE tournament_id = $1', [id.data]);
    await query('DELETE FROM tournaments WHERE id = $1', [id.data]);

    await writeAuditLog({
      req,
      action: 'tournament_deleted',
      entity: 'tournament',
      entityId: id.data,
      details: { deletedAt: new Date().toISOString() }
    });

    return res.json({ success: true, message: 'Match deleted successfully.' });
  } catch (error) {
    console.error('Delete tournament error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not delete match.' });
  }
});

// Update Tournament Status
router.patch('/tournaments/:id/status', requirePermission('tournaments:manage'), async (req, res) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    const body = tournamentStatusSchema.safeParse(req.body);

    if (!id.success || !body.success) {
      return res.status(400).json({ success: false, message: 'Invalid tournament ID or status.' });
    }

    const result = await query(
      `UPDATE tournaments SET status = $1 WHERE id = $2 RETURNING id, status`,
      [body.data.status, id.data]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }

    await writeAuditLog({
      req,
      action: 'tournament_status_updated',
      entity: 'tournament',
      entityId: id.data,
      details: { newStatus: body.data.status }
    });

    return res.json({ success: true, tournament: result.rows[0] });
  } catch (error) {
    console.error('Tournament status error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not update tournament status.' });
  }
});

// Admin Set Room ID & Password
router.patch('/tournaments/:id/room', requirePermission('tournaments:manage'), async (req, res) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    const body = roomSchema.safeParse(req.body);

    if (!id.success || !body.success) {
      return res.status(400).json({ success: false, message: 'Valid match ID, Room ID and Password are required.' });
    }

    const result = await query(
      `UPDATE tournaments SET room_id = $1, room_password = $2 WHERE id = $3 RETURNING id, match_number, room_id, status`,
      [body.data.room_id, body.data.room_password, id.data]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }

    await writeAuditLog({
      req,
      action: 'tournament_room_published',
      entity: 'tournament',
      entityId: id.data,
      details: { matchNumber: result.rows[0].match_number }
    });

    return res.json({ success: true, message: 'Room information saved.', tournament: result.rows[0] });
  } catch (error) {
    console.error('Room publish error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not publish room information.' });
  }
});

// Admin View Participants for a Tournament
router.get('/tournaments/:id/participants', requirePermission('tournaments:view'), async (req, res) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({ success: false, message: 'Invalid match ID.' });
    }

    const result = await query(
      `SELECT p.id, p.tournament_id, p.user_id, u.name AS user_name, u.phone AS user_phone,
              p.ff_ingame_name, p.friend_ingame_name, p.participation_type, p.status, p.created_at
       FROM participants p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.tournament_id = $1
       ORDER BY p.created_at ASC`,
      [id.data]
    );

    return res.json({ success: true, participants: result.rows });
  } catch (error) {
    console.error('Admin participants list error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load participants.' });
  }
});

// Admin Publish Results & Distribute Prizes to Wallets
router.post('/tournaments/:id/results', requirePermission('tournaments:manage'), async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const resultsSchema = z.object({
    results: z.array(z.object({
      participant_id: z.number().int().positive(),
      kills: z.coerce.number().min(0).default(0),
      is_winner: z.boolean().default(false),
      prize_amount: z.coerce.number().min(0).default(0)
    }))
  });

  const parsed = resultsSchema.safeParse(req.body);
  if (!id.success || !parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid result submission data.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const matchRes = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [id.data]);
    if (!matchRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }
    const match = matchRes.rows[0];

    for (const item of parsed.data.results) {
      const pRes = await client.query('SELECT user_id, ff_ingame_name FROM participants WHERE id = $1', [item.participant_id]);
      if (!pRes.rows.length) continue;
      const participant = pRes.rows[0];

      let totalPrize = Number(item.prize_amount || 0);
      if (item.is_winner && Number(match.winning_prize) > 0 && totalPrize === 0) {
        totalPrize += Number(match.winning_prize);
      }
      if (Number(item.kills) > 0 && Number(match.per_kill_prize) > 0 && totalPrize === 0) {
        totalPrize += Number(item.kills) * Number(match.per_kill_prize);
      }

      if (totalPrize > 0) {
        await client.query(
          `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [participant.user_id]
        );

        const wRes = await client.query(
          `UPDATE wallets SET balance = balance + $1::numeric, updated_at = NOW() WHERE user_id = $2 RETURNING id, balance`,
          [totalPrize, participant.user_id]
        );

        if (wRes.rows.length) {
          await client.query(
            `INSERT INTO wallet_transactions (
              wallet_id, user_id, type, amount, description, reference_type, reference_id
            ) VALUES ($1, $2, 'credit', $3, $4, 'tournament_prize', $5)`,
            [
              wRes.rows[0].id,
              participant.user_id,
              totalPrize,
              `Prize reward for match ${match.match_number} (${item.kills} kills${item.is_winner ? ' + Winner' : ''})`,
              match.id
            ]
          );
        }
      }
    }

    await client.query(`UPDATE tournaments SET status = 'completed' WHERE id = $1`, [id.data]);
    await client.query('COMMIT');

    await writeAuditLog({
      req,
      action: 'tournament_results_distributed',
      entity: 'tournament',
      entityId: id.data,
      details: { matchNumber: match.match_number }
    });

    return res.json({ success: true, message: 'Results published and prizes distributed successfully.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Prize distribution error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not distribute prizes.' });
  } finally {
    if (client) client.release();
  }
});

// ===============================
// USER MANAGEMENT
// ===============================

// List All Users
router.get('/users', requirePermission('users:view'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.ff_player_id, u.ff_ingame_name, u.status, u.created_at,
              COALESCE(w.balance, 0) AS wallet_balance
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({ success: false, message: 'ব্যবহারকারীদের প্রোফাইল পাওয়া যায়নি।' });
  }
});

export default router;