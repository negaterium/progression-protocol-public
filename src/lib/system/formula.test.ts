import { expect, test, describe } from 'vitest'
import {
    calculateXpForLevel,
    calculateLevelFromXp,
    calculateRank,
    calculateGlobalRewardMultiplier,
    calculateScaledQuestReward,
    DAILY_ALL_CLEAR_TARGET,
    DAILY_ALL_CLEAR_XP,
    DAILY_ALL_CLEAR_GOLD
} from './formula'
import { calculateLevel, getXpRequiredForLevel } from './leveling';
import { getLevelProgress, getNextLevelXp } from './formula';

describe('Game Formulas', () => {
    describe('XP Curve', () => {
        test('Compatibility helpers agree with the award engine through endgame and prestige reset', () => {
            for (const level of [1, 2, 15, 100, 154, 155, 200, 999]) {
                const threshold = getXpRequiredForLevel(level);
                expect(calculateXpForLevel(level)).toBe(threshold);
                expect(calculateLevelFromXp(threshold)).toBe(calculateLevel(threshold).level);
                expect(getNextLevelXp(level)).toBe(getXpRequiredForLevel(level + 1));
            }
            expect(calculateLevelFromXp(9810976)).toBe(154);
            const midpoint = (getXpRequiredForLevel(154) + getXpRequiredForLevel(155)) / 2;
            expect(getLevelProgress(midpoint, 154)).toBeCloseTo(50);
        });

        test('Level 1 requires 0 XP', () => {
            expect(calculateXpForLevel(1)).toBe(0);
        });

        test('Level 10 uses the current progression curve (53,100 XP)', () => {
            const xp = calculateXpForLevel(10);
            expect(xp).toBe(53100);
        });

        test('Level calculated from XP matches inverse', () => {
            const xp = calculateXpForLevel(50);
            const level = calculateLevelFromXp(xp);
            expect(level).toBe(50);
        });

        test('calculateLevelFromXp handles 0 XP', () => {
            expect(calculateLevelFromXp(0)).toBe(1);
        });
    });

    describe('Rank Calculation', () => {
        test('E-Rank: Levels 1-10', () => {
            expect(calculateRank(1)).toBe('E-RANK');
            expect(calculateRank(10)).toBe('E-RANK');
        });

        test('D-Rank: Levels 11-20', () => {
            expect(calculateRank(11)).toBe('D-RANK');
            expect(calculateRank(20)).toBe('D-RANK');
        });

        test('S-Rank: Levels 91+', () => {
            expect(calculateRank(90)).toBe('A-RANK'); // Boundary check
            expect(calculateRank(91)).toBe('S-RANK');
            expect(calculateRank(100)).toBe('S-RANK');
        });
    });

    describe('Global Reward Multiplier', () => {
        // Formula: 1 + (Level / 50)
        test('Level 1: 1.02x Base', () => {
            expect(calculateGlobalRewardMultiplier(1)).toBe(1.02);
        });

        test('Level 20: 1.4x Reward', () => {
            expect(calculateGlobalRewardMultiplier(20)).toBe(1.4);
        });

        test('Level 100: 3.0x Reward', () => {
            expect(calculateGlobalRewardMultiplier(100)).toBe(3.0);
        });

        test('Level 300: Soft-Capped ~5.40x Reward', () => {
            expect(calculateGlobalRewardMultiplier(300)).toBeCloseTo(5.40, 2);
        });

        test('Level 0 Safety Check', () => {
            expect(calculateGlobalRewardMultiplier(0)).toBe(1);
        });
    });

    describe('Daily All-Clear System Bounty', () => {
        test('Constants match 9-quest target, 10k XP, and 5k Gold', () => {
            expect(DAILY_ALL_CLEAR_TARGET).toBe(9);
            expect(DAILY_ALL_CLEAR_XP).toBe(10000);
            expect(DAILY_ALL_CLEAR_GOLD).toBe(5000);
        });

        test('calculateScaledQuestReward applies 1.5x streak multiplier at exactly 9 completions', () => {
            const rewardBeforeStreak = calculateScaledQuestReward(100, 100, 50, 100, undefined, null, 8);
            const rewardAtStreak = calculateScaledQuestReward(100, 100, 50, 100, undefined, null, 9);
            // At level 100, multiplier is 3.0x -> base scaled is 300 XP
            expect(rewardBeforeStreak.finalXp).toBe(300);
            expect(rewardAtStreak.finalXp).toBe(450); // 300 * 1.5
        });
    });
});
