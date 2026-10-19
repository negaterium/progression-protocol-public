import catalogs from '../../database/seeds/catalogs.json';
import { DAY_MS, type SimulationBoss, type QuestEvent } from '../../src/lib/simulation/boss-balance';
import { getXpRequiredForLevel } from '../../src/lib/system/leveling';
import type { BossCombatInput } from '../../src/lib/game-logic/boss-combat';

export type SimulationSnapshot = {
    capturedAt: string; startXp: number; level: number; traceDays: number;
    nonBossXp: number; observedBossXp: number; observedBossKills: number;
    observedBossXpMultiplier?: number;
    resourceStats?: { maxHp: number; maxMana: number; modifiers: Record<string, number>; rawVitality: number };
    bosses: (SimulationBoss & { intel?: unknown; damage_type?: string })[];
    quests: QuestEvent[];
    combat: Omit<BossCombatInput, 'activeEncounter'>;
};

export function syntheticSnapshot(): SimulationSnapshot {
    const rawStats = { strength: 100, agility: 100, intelligence: 300, vitality: 250, perception: 100, charisma: 10, focus: 10, willpower: 10, luck: 10 };
    const gear = [{ effect: { damage_min: 2000, damage_max: 2500, intelligence: 400, magic_amp: 0.3 }, type: 'EQUIPMENT', slot: 'MAIN_HAND' }];
    return {
        capturedAt: '2026-10-19T09:00:00Z', startXp: getXpRequiredForLevel(158), level: 158, traceDays: 28,
        nonBossXp: 400_000, observedBossXp: 0, observedBossKills: 0,
        bosses: catalogs.bosses.map(b => ({ ...b, defeated: true })),
        quests: Array.from({ length: 28 * 14 }, (_, i) => ({ at: Math.floor(i / 14) * DAY_MS + (9 + (i % 14) * 0.7) * 3_600_000,
            difficulty: i % 10 === 0 ? 'S' : 'E', xp: 100, manaCost: 10 })),
        resourceStats: { maxHp: 30000, maxMana: 30000, modifiers: {}, rawVitality: 250 },
        combat: { userId: 'synthetic', questId: 'synthetic', questDifficulty: 'E', rawStats,
            effectiveStats: { ...rawStats, intelligence: 2000 }, equipmentList: gear, equipment: gear.map(e => e.effect),
            hunterClass: 'Necromancer', hunterLevel: 158, hunterRank: 'S-RANK', shadowInfantryCount: 6000, shadowStorageLimit: 10000,
            maxPlayerHp: 30000, currentPlayerMana: 30000, skillModifiers: {}, statusEffects: [], activeEffects: [], titleModifiers: [], isStunned: false },
    };
}
