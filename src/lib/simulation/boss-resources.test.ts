// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BossResourceReplay, type ResourceConfig } from './boss-resources';
import type { BossCombatResult } from '../game-logic/boss-combat';

const config: ResourceConfig = { maxHp: 1000, maxMana: 1000, combatHpLimit: 1000, statusHpBase: 1000,
    hunterClass: 'NONE', level: 1, modifiers: {}, manaModifiers: {}, potions: false, measuredFrom: 0 };
const hit = (extra: Partial<BossCombatResult> = {}): BossCombatResult => ({ currentHp: 100, maxHp: 100,
    damageDealt: 0, isCrit: false, doubleStrike: false, stealthActive: false, isArmySiege: false, summonDamage: 0,
    armyCapacityRatio: 0, ...extra });
describe('Resource replay', () => {
    it('preserves the live one-HP attack floor instead of inventing encounter deaths', () => {
        const state = new BossResourceReplay(config);
        state.hp = 10;
        state.beforeEvent({ at: 0, difficulty: 'E', xp: 1, manaCost: 0 });
        state.applyRound(hit({ playerDamage: 100 }));
        expect(state.hp).toBe(1);
        expect(state.metrics.attackFloorHits).toBe(1);
    });
    it('replays the legacy raw-vitality clamp and exposes the discarded health', () => {
        const state = new BossResourceReplay({ ...config, combatHpLimit: 100 });
        state.beforeEvent({ at: 0, difficulty: 'E', xp: 1, manaCost: 0 });
        state.applyRound(hit({ playerDamage: 10 }));
        expect(state.hp).toBe(100);
        expect(state.metrics.clampLoss).toBe(890);
    });
    it('rolls back fatal status consumption, then allows recovery over time', () => {
        const state = new BossResourceReplay(config);
        state.hp = 1;
        state.effects = [{ name: 'Burn', type: 'BURN', description: '', duration: 2, damagePercent: 0.08 }];
        expect(state.beforeEvent({ at: 0, difficulty: 'E', xp: 1, manaCost: 0 })).toBe(false);
        expect(state.effects[0].duration).toBe(2);
        expect(state.beforeEvent({ at: 3_600_000 * 2, difficulty: 'E', xp: 1, manaCost: 0 })).toBe(true);
        expect(state.effects[0].duration).toBe(1);
    });
    it('blocks unaffordable quests but permits delegated completion', () => {
        const state = new BossResourceReplay(config);
        state.mana = 0;
        expect(state.beforeEvent({ at: 0, difficulty: 'E', xp: 1, manaCost: 10 })).toBe(false);
        expect(state.beforeEvent({ at: 0, difficulty: 'E', xp: 1, manaCost: 10, delegated: true })).toBe(true);
    });
    it('charges replacement potion cost instead of assuming free recovery', () => {
        const state = new BossResourceReplay({ ...config, potions: true });
        state.mana = 0;
        expect(state.beforeEvent({ at: 0, difficulty: 'E', xp: 1, manaCost: 100 })).toBe(true);
        expect(state.metrics.manaPotions).toBe(1);
        expect(state.metrics.potionGold).toBe(3500);
    });
});
