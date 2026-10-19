// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), queryOne: vi.fn() } }));
import { calculateBossCombatRound, type BossCombatInput } from './boss-combat';
const input: BossCombatInput = {
    userId: 'player', questId: 'quest', questDifficulty: 'E', hunterClass: 'NONE', hunterLevel: 158, hunterRank: 'S-RANK',
    rawStats: { strength: 1000000, agility: 100, intelligence: 100, vitality: 100, perception: 100, charisma: 10, focus: 10, willpower: 10, luck: 10 },
    equipmentList: [], equipment: [], shadowInfantryCount: 0, shadowStorageLimit: 0,
    activeEncounter: { id: 'encounter', boss_id: 'boss', boss_name: 'Test', boss_rank: 'S+', current_hp: 200000, max_hp: 200000, intel: {}, damage_type: 'PHYSICAL' },
    statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 10000,
};
afterEach(() => vi.restoreAllMocks());
describe('Offline outgoing combat evaluation', () => {
    it('preserves the production cap when no evaluator is supplied', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        expect((await calculateBossCombatRound(input)).damageDealt).toBe(100000);
    });
    it('exposes pre-cap damage so stronger builds remain distinguishable', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const evaluate = ({ uncappedDirect }: { uncappedDirect: number }) => ({ direct: uncappedDirect / 100, summon: 0 });
        const first = await calculateBossCombatRound(input, evaluate);
        const stronger = await calculateBossCombatRound({ ...input, rawStats: { ...input.rawStats, strength: 1500000 } }, evaluate);
        expect(stronger.damageDealt).toBeGreaterThan(first.damageDealt);
    });
    it('resolves healing and retaliation from the evaluated damage', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const result = await calculateBossCombatRound({ ...input, skillModifiers: { life_drain_percent: 0.2 } }, () => ({ direct: 100, summon: 50 }));
        expect(result.damageDealt).toBe(150);
        expect(result.playerHealing).toBe(20);
        expect(result.playerDamage).toBeGreaterThan(0);
        expect(result.currentHp).toBe(199850);
    });
    it('rejects invalid evaluator output', async () => {
        await expect(calculateBossCombatRound(input, () => ({ direct: NaN, summon: 0 }))).rejects.toThrow('Invalid outgoing combat evaluation');
    });
});
