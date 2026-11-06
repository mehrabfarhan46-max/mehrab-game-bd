
import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

const PUBLIC_SETTING_KEYS = Object.freeze([
  'site_name',
  'site_logo',
  'site_description',
  'support_email',
  'support_phone',
  'facebook_url',
  'youtube_url',
  'telegram_url',
  'maintenance_mode'
]);

router.use((_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=15');
  next();
});

// Get active diamond and membership packages
router.get('/packages', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name_bn, name_en, category,
              diamonds, price, image_url
       FROM diamond_packages
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC
       LIMIT 200`
    );

    return res.json({
      success: true,
      packages: result.rows
    });
  } catch (error) {
    console.error('Public packages error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not load packages.'
    });
  }
});

// Get active products
router.get('/products', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name_bn, name_en, description,
              image_url, price
       FROM products
       WHERE is_active = TRUE
       ORDER BY id DESC
       LIMIT 200`
    );

    return res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    console.error('Public products error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not load products.'
    });
  }
});

// Get active like services
router.get('/likes', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name_bn, name_en, platform, quantity, price
       FROM like_services
       WHERE is_active = TRUE
       ORDER BY id ASC
       LIMIT 200`
    );

    return res.json({
      success: true,
      likes: result.rows
    });
  } catch (error) {
    console.error('Public likes error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not load like services.'
    });
  }
});

// Get public tournaments / matches
router.get('/tournaments', async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         id,
         match_number,
         title_bn,
         title_en,
         category,
         mode,
         map_name,
         rules,
         prize_info,
         winning_prize,
         per_kill_prize,
         tutorial_video_url,
         entry_fee,
         max_players,
         starts_at,
         status,
         banner_url
       FROM tournaments
       WHERE status IN ('upcoming', 'live', 'completed')
       ORDER BY starts_at ASC
       LIMIT 200`
    );

    return res.json({
      success: true,
      tournaments: result.rows
    });
  } catch (error) {
    console.error('Public tournaments error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not load tournaments.'
    });
  }
});

// Get public participant names and occupied player slots for one match.
// Never return account details or room credentials here.
router.get('/tournaments/:id/participants', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=5');

  const matchId = Number(req.params.id);

  if (!Number.isSafeInteger(matchId) || matchId < 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid match ID.'
    });
  }

  try {
    const matchResult = await query(
      `SELECT id, max_players
       FROM tournaments
       WHERE id = $1
         AND status IN ('upcoming', 'live', 'completed')
       LIMIT 1`,
      [matchId]
    );

    if (!matchResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Match not found.'
      });
    }

    // Team members are listed once, even if multiple participants
    // are connected to the same team.
    const namesResult = await query(
      `SELECT player_name
       FROM (
         SELECT
           ttm.player_name,
           ttm.member_number
         FROM tournament_teams tt
         JOIN tournament_team_members ttm
           ON ttm.team_id = tt.id
         WHERE tt.tournament_id = $1
           AND EXISTS (
             SELECT 1
             FROM participants p
             WHERE p.team_id = tt.id
               AND p.status = 'registered'
           )

         UNION ALL

         SELECT
           p.ff_ingame_name AS player_name,
           1 AS member_number
         FROM participants p
         WHERE p.tournament_id = $1
           AND p.status = 'registered'
           AND p.team_id IS NULL
       ) AS registered_players
       WHERE player_name IS NOT NULL
         AND length(trim(player_name)) > 0
       ORDER BY member_number ASC, player_name ASC`,
      [matchId]
    );

    const players = namesResult.rows.map(row => row.player_name);

    return res.json({
      success: true,
      match_id: matchId,
      players,
      joined_players: players.length,
      max_players: matchResult.rows[0].max_players
    });
  } catch (error) {
    console.error('Public participants error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not load match participants.'
    });
  }
});

// Get approved public settings
router.get('/settings', async (_req, res) => {
  try {
    const result = await query(
      `SELECT key, value
       FROM settings
       WHERE key = ANY($1::text[])
       ORDER BY key ASC`,
      [PUBLIC_SETTING_KEYS]
    );

    const settings = {};

    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    return res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Public settings error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Could not load settings.'
    });
  }
});

export default router;
