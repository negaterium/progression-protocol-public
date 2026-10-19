import { describe, expect, it } from 'vitest';
import { BOUNTY_UNITS, earnBossBounty, projectBossBounty, releaseBossBounty, type BossBountyLedger } from './boss-bounty';
import { getBossRepeatRewardScale, isBossBountyEligible, resolveBalancedBossDamage } from './boss-balance-policy';
import { CombatXpBudget } from '../simulation/combat-xp-budget';
const initial = (): BossBountyLedger => ({ day: '2026-10-19', opportunityUnits: BOUNTY_UNITS, bankedMicros: 0, remainderMicros: 0 });

describe('Production earned boss XP credits', () => {
    it('splits earned credits, bounds earning opportunity, and pays the bank exactly once', () => {
        let ledger = initial(), granted = 0;
        for (let i = 0; i < 20; i++) {
            const result = earnBossBounty(ledger, '2026-10-19', 100, 'E');
            ledger = result.ledger; granted += result.xp;
        }
        expect(granted).toBe(50);
        expect(ledger.bankedMicros).toBe(50 * BOUNTY_UNITS);
        const victory = releaseBossBounty(ledger);
        expect(victory.xp).toBe(50);
        expect(releaseBossBounty(victory.ledger).xp).toBe(0);
    });
    it('carries at most two days of unused opportunity without awarding idle XP', () => {
        const ledger = projectBossBounty(initial(), '2026-10-29');
        expect(ledger.opportunityUnits).toBe(2 * BOUNTY_UNITS);
        expect(ledger.bankedMicros).toBe(0);
    });
    it('preserves fractional credit across many small participation awards', () => {
        let ledger = initial(), total = 0;
        for (let day = 19; day < 29; day++) {
            const date = `2026-10-${day}`;
            const earned = earnBossBounty(ledger, date, 1, 'S');
            const released = releaseBossBounty(earned.ledger);
            ledger = released.ledger; total += earned.xp + released.xp;
        }
        expect(total).toBe(10);
    });
    it('preserves previously banked XP when the current allowance decreases', () => {
        const ledger = { ...initial(), bankedMicros: 1000 * BOUNTY_UNITS };
        const result = earnBossBounty(ledger, '2026-10-19', 10, 'E');
        expect(result.ledger.bankedMicros).toBe(ledger.bankedMicros);
    });
    it('does not refill opportunity when the clock moves backwards', () => {
        const ledger = { ...initial(), opportunityUnits: 0 };
        expect(projectBossBounty(ledger, '2026-10-18').opportunityUnits).toBe(0);
    });
    it('does not credit unknown quest ranks or a zero allowance', () => {
        expect(earnBossBounty(initial(), '2026-10-19', 100, 'unknown').earnedMicros).toBe(0);
        expect(earnBossBounty(initial(), '2026-10-19', 0, 'E').earnedMicros).toBe(0);
    });
    it('keeps progression rewards bounded across shortened rank rotations', () => {
        expect(getBossRepeatRewardScale('S')).toBe(3 / 7);
        expect(getBossRepeatRewardScale('S+')).toBe(0.5);
        expect(getBossRepeatRewardScale('XX')).toBe(14 / 30);
        expect(getBossRepeatRewardScale('COSMIC')).toBe(1);
        expect(isBossBountyEligible({ rank: 'XX', phase: 5 })).toBe(false);
        expect(isBossBountyEligible({ rank: 'S+', phase: 4 })).toBe(true);
    });
    it('retains build differences and bounds direct plus army bursts smoothly', () => {
        const evaluate = (direct: number) => resolveBalancedBossDamage({ uncappedDirect: direct, summon: 1000, levelMultiplier: 7.25, maxHp: 250000, difficulty: 'E' });
        const weak = evaluate(100000), strong = evaluate(200000);
        expect(strong.direct + strong.summon).toBeGreaterThan(weak.direct + weak.summon);
        expect(strong.direct + strong.summon).toBeLessThan(250000 * 0.18);
    });
    it('matches the calibrated simulation with integer credits across clustered activity', () => {
        let ledger = initial(), awarded = 0;
        const simulation = new CombatXpBudget(23985.73, 0);
        for (let day = 0; day < 28; day++) {
            const count = day % 3 === 0 ? 1 : 18;
            for (let quest = 0; quest < count; quest++) {
                const difficulty = quest % 7 === 0 ? 'S' : 'E';
                const victory = quest % 10 === 0;
                const date = new Date(Date.UTC(2026, 9, 19 + day)).toISOString().slice(0, 10);
                const earned = earnBossBounty(ledger, date, 23985.73, difficulty);
                ledger = earned.ledger; awarded += earned.xp;
                if (victory) { const released = releaseBossBounty(ledger); ledger = released.ledger; awarded += released.xp; }
                simulation.combat(day * 86400000 + quest, difficulty, victory);
            }
        }
        expect(Math.abs(awarded - simulation.grantedXp)).toBeLessThan(1);
    });
});
