import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireUser } from '../middleware/userAuth.js';

const router = Router();

const schema = z.object({
  tournament_id: z.coerce.number().int().positive(),
  participation_type: z.enum(['solo', 'friend_pair', 'team']).default('solo'),
  ff_ingame_name: z.string().trim().min(1).max(50).optional(),
  friend_ingame_name: z.string().trim().min(1).max(50).optional(),
  player_names: z.array(z.string().trim().min(1).max(50)).max(4).optional()
});

const duoCategories = [
  'duo_br',
  'lone_wolf',
  'lone_wolf_headshot'
];

const squadCategories = [
  'pro_league',
  'cs_4v4',
  'cs_4v4_headshot'
];

const soloCategories = [
  'solo_br',
  'survival_br'
];

// Get the logged-in player's joined matches.
router.get('/mine', requireUser, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');

  try {
    const result = await pool.query(
      `SELECT
         t.id,
         t.match_number,
         t.title_en,
         t.title_bn,
         t.category,
         t.mode,
         t.map_name,
         t.rules,
         t.prize_info,
         t.winning_prize,
         t.per_kill_prize,
         t.tutorial_video_url,
         t.entry_fee,
         t.max_players,
         t.starts_at,
         t.status,
         p.id AS participant_id,
         p.participation_type,
         p.ff_ingame_name,
         p.friend_ingame_name,
         p.status AS registration_status,
         p.created_at AS joined_at,
         CASE
           WHEN p.status = 'registered'
             AND t.room_id IS NOT NULL
             AND t.room_password IS NOT NULL
           THEN t.room_id
           ELSE NULL
         END AS room_id,
         CASE
           WHEN p.status = 'registered'
             AND t.room_id IS NOT NULL
             AND t.room_password IS NOT NULL
           THEN t.room_password
           ELSE NULL
         END AS room_password
       FROM participants p
       INNER JOIN tournaments t
         ON t.id = p.tournament_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      matches: result.rows
    });
  } catch (error) {
    console.error('Joined matches error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not load joined matches.'
    });
  }
});

// Get room credentials for one specific joined match.
router.get('/:id/room', requireUser, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');

  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid match ID.'
    });
  }

  try {
    const result = await pool.query(
      `SELECT t.room_id, t.room_password
       FROM participants p
       INNER JOIN tournaments t
         ON t.id = p.tournament_id
       WHERE p.tournament_id = $1
         AND p.user_id = $2
         AND p.status = 'registered'
         AND t.room_id IS NOT NULL
         AND t.room_password IS NOT NULL
       LIMIT 1`,
      [id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Room information is not available for this joined match.'
      });
    }

    return res.json({
      success: true,
      room: result.rows[0]
    });
  } catch (error) {
    console.error('Match room error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not load room information.'
    });
  }
});

// Register for a tournament.
router.post('/', requireUser, async (req, res) => {
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please provide valid player names and match details.'
    });
  }

  const {
    tournament_id,
    participation_type
  } = parsed.data;

  const names = (parsed.data.player_names || []).map(name => name.trim());

  if (!names.length && parsed.data.ff_ingame_name) {
    names.push(parsed.data.ff_ingame_name.trim());

    if (parsed.data.friend_ingame_name?.trim()) {
      names.push(parsed.data.friend_ingame_name.trim());
    }
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Lock the match to prevent simultaneous overbooking.
    const tournamentResult = await client.query(
      `SELECT id, category, mode, max_players, status,
              starts_at, entry_fee
       FROM tournaments
       WHERE id = $1
       FOR UPDATE`,
      [tournament_id]
    );

    if (!tournamentResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Tournament not found.'
      });
    }

    const tournament = tournamentResult.rows[0];
    const category = String(tournament.category || '').toLowerCase();

    const isDuo = duoCategories.includes(category);
    const isSquad = squadCategories.includes(category);
    const isSolo = soloCategories.includes(category);

    if (!isDuo && !isSquad && !isSolo) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Unknown tournament category.'
      });
    }

    const expectedMode = {
      solo_br: 'solo',
      survival_br: 'solo',
      duo_br: 'duo',
      lone_wolf: 'duo',
      lone_wolf_headshot: 'duo',
      pro_league: 'squad',
      cs_4v4: '4v4',
      cs_4v4_headshot: '4v4'
    }[category];

    if (tournament.mode !== expectedMode) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Tournament mode is not configured correctly.'
      });
    }

    let requiredPlayers = 1;

    if (isDuo) {
      if (participation_type === 'solo') {
        requiredPlayers = 1;
      } else if (participation_type === 'friend_pair') {
        requiredPlayers = 2;
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Choose Solo or Duo for this match.'
        });
      }
    } else if (isSquad) {
      if (participation_type !== 'team') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'This match requires a four-player team.'
        });
      }

      requiredPlayers = 4;
    } else if (participation_type !== 'solo') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This match accepts one player only.'
      });
    }

    if (names.length !== requiredPlayers) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Please provide exactly ${requiredPlayers} player name(s).`
      });
    }

    if (
      new Set(names.map(name => name.toLowerCase())).size !== names.length
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Player names must be different.'
      });
    }

    if (
      tournament.status !== 'upcoming' ||
      new Date(tournament.starts_at) <= new Date()
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This tournament is not accepting registrations.'
      });
    }

    const existing = await client.query(
      `SELECT id
       FROM participants
       WHERE tournament_id = $1
         AND user_id = $2
         AND status = 'registered'
       LIMIT 1`,
      [tournament_id, req.user.id]
    );

    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You are already registered.'
      });
    }

    const countResult = await client.query(
      `SELECT COALESCE(
         SUM(
           CASE
             WHEN participation_type = 'friend_pair' THEN 2
             WHEN participation_type = 'team' THEN 4
             ELSE 1
           END
         ), 0
       )::int AS total
       FROM participants
       WHERE tournament_id = $1
         AND status = 'registered'`,
      [tournament_id]
    );

    const occupied = countResult.rows[0].total;

    if (occupied + requiredPlayers > tournament.max_players) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Not enough tournament slots available.'
      });
    }

    // Calculate the complete fee using PostgreSQL numeric arithmetic.
    const feeResult = await client.query(
      `SELECT (entry_fee * $2::numeric)::numeric(12,2)::text AS total_fee
       FROM tournaments
       WHERE id = $1`,
      [tournament_id, requiredPlayers]
    );

    const totalFee = feeResult.rows[0].total_fee;

    // Deduct the complete fee from the captain's wallet.
    if (Number(totalFee) > 0) {
      await client.query(
        `INSERT INTO wallets (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.user.id]
      );

      const walletResult = await client.query(
        `SELECT id
         FROM wallets
         WHERE user_id = $1
         FOR UPDATE`,
        [req.user.id]
      );

      if (!walletResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          message: 'Wallet could not be found.'
        });
      }

      const wallet = walletResult.rows[0];

      const debitResult = await client.query(
        `UPDATE wallets
         SET balance = balance - $2::numeric,
             updated_at = now()
         WHERE id = $1
           AND balance >= $2::numeric
         RETURNING balance`,
        [wallet.id, totalFee]
      );

      if (!debitResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance. Please add funds first.'
        });
      }

      await client.query(
        `INSERT INTO wallet_transactions (
          wallet_id,
          user_id,
          type,
          amount,
          description,
          reference_type,
          reference_id
        )
        VALUES (
          $1, $2, 'debit', $3,
          $4, 'tournament_entry_fee', $5
        )`,
        [
          wallet.id,
          req.user.id,
          totalFee,
          `Tournament entry fee for ${requiredPlayers} player(s)`,
          tournament_id
        ]
      );
    }

    const participantType = isSquad ? 'team' : participation_type;

    const participantResult = await client.query(
      `INSERT INTO participants (
        tournament_id,
        user_id,
        ff_player_id,
        ff_ingame_name,
        friend_ingame_name,
        participation_type,
        status
      )
      VALUES ($1, $2, NULL, $3, $4, $5, 'registered')
      RETURNING id, tournament_id, user_id,
                ff_ingame_name, participation_type, status, created_at`,
      [
        tournament_id,
        req.user.id,
        names[0],
        requiredPlayers >= 2 ? names[1] : null,
        participantType
      ]
    );

    const participant = participantResult.rows[0];
    let teamId = null;
    let message = 'Tournament registration submitted.';

    // Create a fixed team for Duo Pair or four-player Squad.
    if (
      (isDuo && participation_type === 'friend_pair') ||
      isSquad
    ) {
      const teamResult = await client.query(
        `INSERT INTO tournament_teams (
          tournament_id,
          team_name,
          captain_user_id,
          participation_type,
          status
        )
        VALUES ($1, $2, $3, $4, 'confirmed')
        RETURNING id`,
        [
          tournament_id,
          names.join(' & '),
          req.user.id,
          participantType
        ]
      );

      teamId = teamResult.rows[0].id;

      await client.query(
        `UPDATE participants
         SET team_id = $1
         WHERE id = $2`,
        [teamId, participant.id]
      );

      for (let i = 0; i < names.length; i++) {
        await client.query(
          `INSERT INTO tournament_team_members (
            team_id,
            player_user_id,
            player_name,
            member_number
          )
          VALUES ($1, $2, $3, $4)`,
          [
            teamId,
            i === 0 ? req.user.id : null,
            names[i],
            i + 1
          ]
        );
      }

      message = isSquad
        ? 'Your four-player team registration is saved.'
        : 'Your Duo Friend Pair registration is saved.';
    }

    // Automatically pair two Solo participants in Duo categories.
    if (isDuo && participation_type === 'solo') {
      const waiting = await client.query(
        `SELECT id, user_id, ff_ingame_name
         FROM participants
         WHERE tournament_id = $1
           AND status = 'registered'
           AND participation_type = 'solo'
           AND team_id IS NULL
         ORDER BY created_at ASC, id ASC
         FOR UPDATE`,
        [tournament_id]
      );

      if (waiting.rows.length >= 2) {
        const first = waiting.rows[0];
        const second = waiting.rows[1];

        const teamResult = await client.query(
          `INSERT INTO tournament_teams (
            tournament_id,
            team_name,
            captain_user_id,
            participation_type,
            status
          )
          VALUES ($1, $2, $3, 'friend_pair', 'confirmed')
          RETURNING id`,
          [
            tournament_id,
            `${first.ff_ingame_name} & ${second.ff_ingame_name}`,
            first.user_id
          ]
        );

        teamId = teamResult.rows[0].id;

        await client.query(
          `UPDATE participants
           SET team_id = $1
           WHERE id = ANY($2::bigint[])`,
          [teamId, [first.id, second.id]]
        );

        for (const [i, player] of [first, second].entries()) {
          await client.query(
            `INSERT INTO tournament_team_members (
              team_id,
              player_user_id,
              player_name,
              member_number
            )
            VALUES ($1, $2, $3, $4)`,
            [
              teamId,
              player.user_id,
              player.ff_ingame_name,
              i + 1
            ]
          );
        }

        message = 'You have been automatically paired with another Solo player.';
      } else {
        message = 'Registration saved. Waiting for another Solo player to pair.';
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message,
      participant: {
        ...participant,
        team_id: teamId
      },
      required_players: requiredPlayers,
      entry_fee_charged: totalFee
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'You are already registered.'
      });
    }

    console.error('Tournament registration error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Registration could not be completed.'
    });

  } finally {
    if (client) client.release();
  }
});

export default router;