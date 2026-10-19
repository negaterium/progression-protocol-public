// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyDamagePolicy, DAY_MS, seededRandom, simulateBossBalance, type BalancePolicy, type SimulationInput } from './boss-balance';

const policy: BalancePolicy = { name: 'baseline', cooldowns: { 'S+': 14 }, rewardScale: {}, damageScale: 1, totalDamageCaps: {} };
function input(): SimulationInput {
    return {
        bosses: [{ id: 'boss', name: 'Boss', rank: 'S+', phase: 4, required_level: 125, max_hp: 100, defeated: true }],
        events: Array.from({ length: 28 }, (_, day) => ({ at: day * DAY_MS + 3600000, difficulty: 'E', xp: 0 })),
        days: 28, warmupDays: 0, level: 158,
        hpForBoss: () => 100, rewardForBoss: () => ({ xp: 100, gold: 200, loot: 1 }),
        round: async () => ({ damage: 100, incomingHpFraction: 0 }),
    };
}
describe('Offline boss balance simulator', () => {
    it('compares shorter rotations without increasing their long-term reward budget', async () => {
        const baseline = await simulateBossBalance(input(), policy);
        const candidate = await simulateBossBalance(input(), { ...policy, cooldowns: { 'S+': 7 }, rewardScale: { 'S+': 0.5 } });
        expect(baseline.kills).toBe(2);
        expect(candidate.kills).toBe(4);
        expect(candidate.bossXp).toBe(baseline.bossXp);
        expect(candidate.gold).toBe(baseline.gold);
        expect(candidate.expectedLootUnits).toBe(baseline.expectedLootUnits);
        expect(candidate.expectedShadowUpgrades).toBe(baseline.expectedShadowUpgrades);
    });
    it('keeps first clears full and level-locked bosses unavailable', async () => {
        const fixture = input();
        fixture.bosses[0].defeated = false;
        fixture.events = fixture.events.slice(0, 1);
        const candidate = { ...policy, rewardScale: { 'S+': 0.5 } };
        expect((await simulateBossBalance(fixture, candidate)).bossXp).toBe(100);
        fixture.level = 124;
        expect((await simulateBossBalance(fixture, candidate)).kills).toBe(0);
    });
    it('uses encounter start for cooldowns even when a fight spans days', async () => {
        const fixture = input();
        fixture.round = async () => ({ damage: 50, incomingHpFraction: 0 });
        const result = await simulateBossBalance(fixture, { ...policy, cooldowns: { 'S+': 2 } });
        expect(result.kills).toBe(14);
        expect(result.meanFightRounds).toBe(2);
    });
    it('counts inactive days separately and excludes warmup rewards', async () => {
        const fixture = input();
        fixture.warmupDays = 14;
        const result = await simulateBossBalance(fixture, policy);
        expect(result.kills).toBe(1);
        expect(result.activeDays).toBe(14);
        expect(result.idleQuests).toBe(13);
    });
    it('applies the experimental ceiling to the total outgoing hit', () => {
        expect(applyDamagePolicy(90, 100, 'E', { ...policy, totalDamageCaps: { E: 0.08 } })).toBe(8);
        expect(applyDamagePolicy(10, 100, 'E', { ...policy, damageScale: 0.5 })).toBe(5);
    });
    it('keeps seeded runs reproducible', () => {
        const a = seededRandom(42), b = seededRandom(42);
        expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
    });
    it('preserves initial cooldowns and rejects malformed event timestamps', async () => {
        const fixture = input();
        fixture.initialReadyAt = { boss: 28 * DAY_MS };
        expect((await simulateBossBalance(fixture, policy)).kills).toBe(0);
        fixture.events[0].at = -1;
        await expect(simulateBossBalance(fixture, policy)).rejects.toThrow('Event outside horizon');
    });
    it('enforces phase sequence independently of input order', async () => {
        const fixture = input();
        fixture.bosses = [
            { ...fixture.bosses[0], id: 'later', name: 'Later', required_level: 130, defeated: false },
            { ...fixture.bosses[0], id: 'earlier', name: 'Earlier', defeated: false },
        ];
        fixture.events = fixture.events.slice(0, 2);
        const result = await simulateBossBalance(fixture, policy);
        expect(result.byBoss).toEqual({ Earlier: 1, Later: 1 });
    });
    it('fails instead of silently projecting malformed combat results', async () => {
        const fixture = input();
        fixture.round = async () => ({ damage: NaN, incomingHpFraction: 0 });
        await expect(simulateBossBalance(fixture, policy)).rejects.toThrow('Invalid combat damage');
    });
});
