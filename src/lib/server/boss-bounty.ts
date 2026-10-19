import { gameDb as db, withGameTransaction } from './game-db';
import { BOSS_RANK_REWARDS, LEGACY_BOSS_COOLDOWNS, isBossBountyEligible } from '../game-logic/boss-balance-policy';
import { BOUNTY_RATE, BOUNTY_UNITS, earnBossBounty, releaseBossBounty, projectBossBounty, type BossBountyLedger } from '../game-logic/boss-bounty';
import { calculateGlobalRewardMultiplier, isPostCap } from '../system/formula';

export interface BossBountySummary { dailyXp: number; pendingXp: number; availableDays: number; timezone: 'UTC' }
type LedgerRow = { earning_day: string | Date; opportunity_units: number; banked_micros: string | number; remainder_micros: number };
function toLedger(row: LedgerRow): BossBountyLedger {
    return { day: typeof row.earning_day === 'string' ? row.earning_day.slice(0, 10) : row.earning_day.toISOString().slice(0, 10),
        opportunityUnits: Number(row.opportunity_units), bankedMicros: Number(row.banked_micros), remainderMicros: Number(row.remainder_micros) };
}

async function loadAllowance(userId: string, level: number) {
    const { rows } = await db.query<{ rank: string; phase: number }>(`
        SELECT b.rank, b.phase FROM bosses b
        WHERE b.phase IN (3, 4) AND COALESCE(b.required_level, 0) <= $2
          AND EXISTS (SELECT 1 FROM active_encounters ae WHERE ae.user_id = $1 AND ae.boss_id = b.id AND ae.status = 'DEFEATED')
    `, [userId, level]);
    const base = rows.filter(isBossBountyEligible).reduce((sum, b) => sum + (BOSS_RANK_REWARDS[b.rank]?.xp || 0) / (LEGACY_BOSS_COOLDOWNS[b.rank] || 1), 0);
    return base * calculateGlobalRewardMultiplier(level) * BOUNTY_RATE * (isPostCap(level) ? 2 : 1);
}

async function saveLedger(userId: string, ledger: BossBountyLedger) {
    await db.query(`UPDATE boss_bounty_ledgers SET earning_day = $2, opportunity_units = $3,
        banked_micros = $4, remainder_micros = $5, updated_at = clock_timestamp() WHERE user_id = $1`,
    [userId, ledger.day, ledger.opportunityUnits, ledger.bankedMicros, ledger.remainderMicros]);
}

async function lockedLedger(userId: string, day: string) {
    await db.query(`INSERT INTO boss_bounty_ledgers (user_id, earning_day) VALUES ($1, $2)
        ON CONFLICT (user_id) DO NOTHING`, [userId, day]);
    const row = await db.queryOne<LedgerRow>('SELECT earning_day::text, opportunity_units, banked_micros, remainder_micros FROM boss_bounty_ledgers WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!row) throw new Error('Boss bounty ledger unavailable');
    return toLedger(row);
}

export async function getBossBountySummary(userId: string, level: number): Promise<BossBountySummary> {
    const [dailyXp, row, clock] = await Promise.all([
        loadAllowance(userId, level),
        db.queryOne<LedgerRow>('SELECT earning_day::text, opportunity_units, banked_micros, remainder_micros FROM boss_bounty_ledgers WHERE user_id = $1', [userId]),
        db.queryOne<{ day: string }>("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date::text AS day"),
    ]);
    const day = clock?.day || new Date().toISOString().slice(0, 10);
    const ledger = row ? projectBossBounty(toLedger(row), day) : { day, opportunityUnits: BOUNTY_UNITS, bankedMicros: 0, remainderMicros: 0 };
    return { dailyXp: Math.floor(dailyXp), pendingXp: Math.floor((ledger.bankedMicros + ledger.remainderMicros) / BOUNTY_UNITS), availableDays: ledger.opportunityUnits / BOUNTY_UNITS, timezone: 'UTC' };
}

/** Credits are returned as base XP, then awarded once by the parent quest action. */
export async function creditBossParticipation(userId: string, input: { encounterId: string; bossId: string; questId: string; completedAt: Date; difficulty: string; level: number }) {
    return withGameTransaction(userId, async () => {
        const source = `quest:${input.questId}:${input.completedAt.toISOString()}`;
        const event = await db.queryOne<{ id: number }>(`INSERT INTO boss_bounty_events (user_id, source_key, encounter_id, quest_id, kind)
            VALUES ($1, $2, $3, $4, 'PARTICIPATION') ON CONFLICT (user_id, source_key) DO NOTHING RETURNING id`,
        [userId, source, input.encounterId, input.questId]);
        if (!event) return { xp: 0, pendingXp: 0 };
        const clock = await db.queryOne<{ day: string }>("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date::text AS day");
        if (!clock) throw new Error('Boss bounty clock unavailable');
        const ledger = await lockedLedger(userId, clock.day);
        const dailyXp = await loadAllowance(userId, input.level);
        const result = earnBossBounty(ledger, clock.day, dailyXp, input.difficulty);
        await saveLedger(userId, result.ledger);
        await db.query('UPDATE boss_bounty_events SET xp_base = $2, earned_micros = $3 WHERE id = $1', [event.id, result.xp, result.earnedMicros]);
        return { xp: result.xp, pendingXp: Math.floor(result.ledger.bankedMicros / BOUNTY_UNITS) };
    });
}

/** The caller must first lock and validate the unclaimed zero-HP encounter. */
export async function withdrawBossBounty(userId: string, encounterId: string) {
    return withGameTransaction(userId, async () => {
        const event = await db.queryOne<{ id: number }>(`INSERT INTO boss_bounty_events (user_id, source_key, encounter_id, kind)
            VALUES ($1, $2, $3, 'VICTORY') ON CONFLICT (user_id, source_key) DO NOTHING RETURNING id`,
        [userId, `victory:${encounterId}`, encounterId]);
        if (!event) return 0;
        const row = await db.queryOne<LedgerRow>('SELECT earning_day::text, opportunity_units, banked_micros, remainder_micros FROM boss_bounty_ledgers WHERE user_id = $1 FOR UPDATE', [userId]);
        if (!row) return 0;
        const result = releaseBossBounty(toLedger(row));
        await saveLedger(userId, result.ledger);
        await db.query('UPDATE boss_bounty_events SET xp_base = $2 WHERE id = $1', [event.id, result.xp]);
        return result.xp;
    });
}
