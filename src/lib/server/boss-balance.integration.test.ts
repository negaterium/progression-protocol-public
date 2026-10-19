// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/achievement-manager', () => ({ AchievementManager: class { async checkAchievements() { return { unlocked: [], totalXp: 0 }; } } }));
import db from '../db';
import { startBossBattle } from './boss-battle';
import { awardBossRewards } from './boss-rewards';
import { completeQuest } from './quest-completion';
import { recalculateAndClampPlayerStats } from './user-stats';
import { getBossBountySummary } from './boss-bounty';
import { getXpRequiredForLevel } from '../system/leveling';
import { calculateGlobalRewardMultiplier } from '../system/formula';
import { BOSS_RANK_REWARDS } from '../game-logic/boss-balance-policy';
import { restoreSave } from './save-restoration';

const target = process.env.BOSS_BALANCE_TEST_DATABASE;
if (target && (!(target.startsWith('codex_boss_balance_') || target === 'sls_package_test') || target !== process.env.POSTGRES_DATABASE || process.env.POSTGRES_HOST !== '127.0.0.1')) {
    throw new Error('Integration tests require an explicitly named disposable loopback database');
}

describe.skipIf(!target)('Boss balance on disposable PostgreSQL', () => {
    beforeAll(async () => expect((await db.queryOne<{ name: string }>('SELECT current_database() AS name'))?.name).toBe(target));
    afterAll(async () => { await db.end(); });

    async function fixture() {
        const user = { id: randomUUID(), username: `fixture-${randomUUID().slice(0, 8)}` };
        await db.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [user.id, user.username, `disabled-fixture-${randomUUID()}`]);
        await db.query(`INSERT INTO profiles (id, username, level, current_xp, next_level_xp, hunter_class, current_hp, current_mana)
            VALUES ($1, $2, 158, $3, $4, 'Fighter', 100, 100)`, [user.id, user.username, getXpRequiredForLevel(158), getXpRequiredForLevel(159)]);
        await db.query('INSERT INTO hunter_stats (user_id, strength, intelligence, agility, vitality, perception) VALUES ($1, 100, 300, 100, 245, 100)', [user.id]);
        await db.query(`INSERT INTO active_encounters (user_id, boss_id, current_hp, max_hp, status, created_at, last_updated, completed_at, rewarded_at)
            SELECT $1, id, 0, max_hp, 'DEFEATED', now()-interval '40 days', now()-interval '39 days', now()-interval '39 days', now()-interval '39 days'
            FROM bosses WHERE phase IN (3,4) AND required_level <= 158`, [user.id]);
        const boss = await db.queryOne<{ id: string; rank: string }>('SELECT id, rank FROM bosses WHERE name = $1', ['Yogumunt (Monarch of Transfiguration)']);
        if (!boss) throw new Error('Missing test catalog boss');
        await db.query(`INSERT INTO inventory (user_id, item_id, quantity) SELECT $1, id, 1 FROM items WHERE name = $2`, [user.id, 'Instant Dungeon Key (S+-Rank)']);
        const questId = randomUUID();
        await db.query(`INSERT INTO quests (id, user_id, title, type, difficulty, frequency, xp_reward, gold_reward, mana_cost, skill_rewards)
            VALUES ($1, $2, 'Integration quest', 'CUSTOM', 'E', 'Once', 100, 0, 0, '{}')`, [questId, user.id]);
        const stats = await recalculateAndClampPlayerStats(user.id);
        await db.query('UPDATE profiles SET current_hp=$2, current_mana=$3 WHERE id=$1', [user.id, stats.maxHp, stats.maxMana]);
        return { user, boss, questId, maxHp: stats.maxHp };
    }

    it('snapshots repeat eligibility, consumes one key, and credits a quest only once under concurrency', async () => {
        const f = await fixture();
        const opened = await startBossBattle(f.user, f.boss.id);
        expect(opened.encounter.balance_version).toBe(2);
        expect(opened.encounter.is_first_clear).toBe(false);
        const results = await Promise.allSettled([completeQuest(f.user, f.questId), completeQuest(f.user, f.questId)]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        const ledger = await db.queryOne<{ opportunity_units: number }>('SELECT opportunity_units FROM boss_bounty_ledgers WHERE user_id=$1', [f.user.id]);
        expect(ledger?.opportunity_units).toBe(750000);
        expect((await db.queryOne<{ count: string }>('SELECT count(*) FROM boss_bounty_events WHERE user_id=$1', [f.user.id]))?.count).toBe('1');
        expect((await db.queryOne<{ current_hp: number }>('SELECT current_hp FROM profiles WHERE id=$1', [f.user.id]))!.current_hp).toBeGreaterThan(2550);
    });

    it('releases banked XP exactly once under simultaneous victory claims', async () => {
        const f = await fixture();
        const { encounter } = await startBossBattle(f.user, f.boss.id);
        await completeQuest(f.user, f.questId);
        const pending = (await getBossBountySummary(f.user.id, 158)).pendingXp;
        expect(pending).toBeGreaterThan(0);
        const before = (await db.queryOne<{ current_xp: number }>('SELECT current_xp FROM profiles WHERE id=$1', [f.user.id]))!.current_xp;
        await db.query('UPDATE active_encounters SET current_hp=0 WHERE id=$1', [encounter.id]);
        const results = await Promise.allSettled([awardBossRewards(f.user, f.boss.id, encounter.id), awardBossRewards(f.user, f.boss.id, encounter.id)]);
        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
        const after = await db.queryOne<{ current_xp: number }>('SELECT current_xp FROM profiles WHERE id=$1', [f.user.id]);
        expect(after!.current_xp - before).toBe(pending);
        expect((await getBossBountySummary(f.user.id, 158)).pendingXp).toBe(0);
        const completed = await db.queryOne<{ rewarded_at: Date; completed_at: Date }>('SELECT completed_at, rewarded_at FROM active_encounters WHERE id=$1', [encounter.id]);
        expect(completed?.completed_at).toBeInstanceOf(Date);
        expect(completed?.rewarded_at).toBeInstanceOf(Date);
    });

    it('rolls the quest, combat HP, event, and wallet back when the final XP write fails', async () => {
        const f = await fixture();
        const { encounter } = await startBossBattle(f.user, f.boss.id);
        await db.query(`CREATE FUNCTION public.boss_test_fail_xp() RETURNS trigger LANGUAGE plpgsql AS $body$
            BEGIN IF NEW.current_xp <> OLD.current_xp THEN RAISE EXCEPTION 'Injected XP failure'; END IF; RETURN NEW; END $body$`);
        await db.query('CREATE TRIGGER boss_test_fail_xp BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.boss_test_fail_xp()');
        try {
            await expect(completeQuest(f.user, f.questId)).rejects.toThrow();
            expect(await db.queryOne('SELECT * FROM user_quests WHERE user_id=$1 AND quest_id=$2', [f.user.id, f.questId])).toBeNull();
            expect(await db.queryOne('SELECT * FROM boss_bounty_ledgers WHERE user_id=$1', [f.user.id])).toBeNull();
            expect(await db.queryOne('SELECT * FROM boss_bounty_events WHERE user_id=$1', [f.user.id])).toBeNull();
            expect((await db.queryOne<{ current_hp: number }>('SELECT current_hp FROM active_encounters WHERE id=$1', [encounter.id]))?.current_hp).toBe(encounter.max_hp);
        } finally {
            await db.query('DROP TRIGGER boss_test_fail_xp ON profiles');
            await db.query('DROP FUNCTION public.boss_test_fail_xp()');
        }
        expect((await completeQuest(f.user, f.questId)).success).toBe(true);
    });

    it('preserves full rewards for a legacy active encounter', async () => {
        const f = await fixture();
        const row = await db.queryOne<{ id: string }>(`INSERT INTO active_encounters (user_id, boss_id, current_hp, max_hp, status)
            VALUES ($1,$2,0,100,'ACTIVE') RETURNING id`, [f.user.id, f.boss.id]);
        const result = await awardBossRewards(f.user, f.boss.id, row!.id);
        expect(result.xp).toBe(Math.floor(BOSS_RANK_REWARDS['S+'].xp * calculateGlobalRewardMultiplier(158)));
        expect(result.gold).toBe(Math.floor(BOSS_RANK_REWARDS['S+'].gold * calculateGlobalRewardMultiplier(158)));
    });

    it('keeps first-clear rewards full without earning the repeat participation fund', async () => {
        const f = await fixture();
        await db.query("DELETE FROM active_encounters WHERE user_id=$1 AND boss_id=$2 AND status='DEFEATED'", [f.user.id, f.boss.id]);
        const { encounter } = await startBossBattle(f.user, f.boss.id);
        expect(encounter.is_first_clear).toBe(true);
        await db.query('UPDATE active_encounters SET current_hp=1 WHERE id=$1', [encounter.id]);
        const result = await completeQuest(f.user, f.questId);
        expect(result.bossDamage.victory).toBe(true);
        expect(result.bossDamage.rewards.xp).toBe(Math.floor(10000 * calculateGlobalRewardMultiplier(158)));
        expect(await db.queryOne('SELECT * FROM boss_bounty_ledgers WHERE user_id=$1', [f.user.id])).toBeNull();
    });

    it('round-trips pending XP and idempotency events through a save restoration', async () => {
        const f = await fixture();
        await startBossBattle(f.user, f.boss.id);
        await completeQuest(f.user, f.questId);
        const queries = {
            profiles: 'SELECT * FROM profiles WHERE id=$1', hunter_stats: 'SELECT * FROM hunter_stats WHERE user_id=$1',
            quests: 'SELECT * FROM quests WHERE user_id=$1', user_quests: 'SELECT * FROM user_quests WHERE user_id=$1',
            quest_logs: 'SELECT * FROM quest_logs WHERE user_id=$1', inventory: 'SELECT * FROM inventory WHERE user_id=$1',
            active_encounters: 'SELECT * FROM active_encounters WHERE user_id=$1',
            boss_bounty_ledgers: 'SELECT * FROM boss_bounty_ledgers WHERE user_id=$1', boss_bounty_events: 'SELECT * FROM boss_bounty_events WHERE user_id=$1',
        };
        const save: Record<string, unknown[]> = {};
        for (const [key, sql] of Object.entries(queries)) save[key] = (await db.query(sql, [f.user.id])).rows;
        const pending = (await getBossBountySummary(f.user.id, 158)).pendingXp;
        await db.query('UPDATE boss_bounty_ledgers SET banked_micros=0 WHERE user_id=$1', [f.user.id]);
        await restoreSave(f.user.id, save);
        expect((await getBossBountySummary(f.user.id, 158)).pendingXp).toBe(pending);
        expect((await db.queryOne<{ count: string }>('SELECT count(*) FROM boss_bounty_events WHERE user_id=$1', [f.user.id]))?.count).toBe('1');
        await expect(completeQuest(f.user, f.questId)).rejects.toThrow('already completed');
    });

    it('restores encounter records from saves created before the new columns existed', async () => {
        const f = await fixture();
        const profiles = (await db.query('SELECT * FROM profiles WHERE id=$1', [f.user.id])).rows;
        const stats = (await db.query('SELECT * FROM hunter_stats WHERE user_id=$1', [f.user.id])).rows;
        const encounters = (await db.query('SELECT * FROM active_encounters WHERE user_id=$1', [f.user.id])).rows.map(row => {
            const copy = { ...row }; delete copy.balance_version; delete copy.is_first_clear; delete copy.completed_at; delete copy.rewarded_at;
            return copy;
        });
        await restoreSave(f.user.id, { profiles, hunter_stats: stats, active_encounters: encounters });
        const versions = (await db.query<{ balance_version: number }>('SELECT balance_version FROM active_encounters WHERE user_id=$1', [f.user.id])).rows;
        expect(versions.length).toBeGreaterThan(0);
        expect(versions.every(row => row.balance_version === 1)).toBe(true);
    });
});
