import { Router } from 'express';
import { query } from '../config/db.js';
import { requireUser } from '../middleware/userAuth.js';

const router = Router();

router.use(requireUser);

// Get wallet balance
router.get('/', async (req, res) => {
  try {
    await query(
      `INSERT INTO wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [req.user.id]
    );

    const result = await query(
      `SELECT id, balance, created_at, updated_at
       FROM wallets
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    return res.json({
      success: true,
      wallet: result.rows[0]
    });

  } catch (error) {
    console.error('Wallet fetch error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not load wallet.'
    });
  }
});

// Get wallet transaction history
router.get('/transactions', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, amount, description,
              reference_type, reference_id, created_at
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json({
      success: true,
      transactions: result.rows
    });

  } catch (error) {
    console.error('Wallet history error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not load wallet history.'
    });
  }
});

export default router;