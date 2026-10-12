// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ default: { query: vi.fn(), queryOne: vi.fn() } }));
import { calculateBossCombatRound, type BossCombatInput } from "./boss-combat";

afterEach(() => vi.restoreAllMocks());
describe("Boss equipment aggregation", () => {
    it("adds overlapping equipment attributes regardless of item order", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const gear = [
            { effect: { str: 5 }, type: "ARMOR", slot: "BODY" },
            { effect: { strength: 7 }, type: "ARMOR", slot: "HEAD" },
        ];
        const input: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 10 },
            equipmentList: gear, equipment: gear.map(g => g.effect), hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };
        const first = await calculateBossCombatRound(input);
        const reversed = await calculateBossCombatRound({ ...input, equipmentList: [...gear].reverse() });
        expect(first.damageDealt).toBe(16);
        expect(reversed.damageDealt).toBe(first.damageDealt);
    });

    it("applies Stealth skill evasion from the active status effect", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.1);
        const input: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 10 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [],
            activeEffects: [{
                name: "Stealth",
                type: "STEALTH",
                description: "Evade Boss (40%), Crit Rate +25%",
                duration: 3,
                modifiers: { boss_evasion: 0.40 },
            }],
            isStunned: false, maxPlayerHp: 260,
        };

        const result = await calculateBossCombatRound(input);

        expect(result.stealthActive).toBe(true);
        expect(result.evaded).toBe(true);
        expect(result.playerDamage).toBe(0);
    });

    it("uses effective stats so passive skill imprints affect boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 10 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const base = await calculateBossCombatRound(baseInput);
        const skilled = await calculateBossCombatRound({
            ...baseInput,
            effectiveStats: { strength: 110, agility: 110, intelligence: 110, vitality: 110, perception: 110, charisma: 10, focus: 10, willpower: 10, luck: 10 },
        });

        expect(skilled.damageDealt).toBeGreaterThan(base.damageDealt);
    });

    it("applies passive skill combat modifiers to critical-hit rolls", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.01);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutCriticalStrike = await calculateBossCombatRound(baseInput);
        const withCriticalStrike = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { crit_chance: 0.02 },
        });

        expect(withoutCriticalStrike.isCrit).toBe(false);
        expect(withCriticalStrike.isCrit).toBe(true);
    });

    it("applies Iron Body reduction to incoming boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutIronBody = await calculateBossCombatRound(baseInput);
        const withIronBody = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { damage_reduction_percent: 0.03 },
        });

        expect(withIronBody.playerDamage).toBeLessThan(withoutIronBody.playerDamage!);
        expect(withIronBody.mitigatedPercent).toBeCloseTo(3);
    });

    it("diverts incoming boss damage through Mana Shield before health", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            currentPlayerMana: 100,
        };

        const withoutManaShield = await calculateBossCombatRound(baseInput);
        const withManaShield = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { mana_shield_percent: 0.05 },
        });

        expect(withManaShield.playerManaDamage).toBeGreaterThan(0);
        expect(withManaShield.playerDamage).toBeLessThan(withoutManaShield.playerDamage!);
        expect(withManaShield.playerManaDamage).toBeLessThanOrEqual(100);
        expect(withManaShield.manaShieldShattered).toBe(false);
    });

    it("limits Mana Shield absorption to available mana and reports a shatter", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const input: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            currentPlayerMana: 1, skillModifiers: { mana_shield_percent: 0.50 },
        };

        const result = await calculateBossCombatRound(input);

        expect(result.playerManaDamage).toBe(1);
        expect(result.manaShieldShattered).toBe(true);
        expect(result.playerDamage).toBeGreaterThan(0);
    });

    it("lets Iron Will resist boss status effects without reducing damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.01);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: {
                id: "encounter", boss_id: "boss", boss_name: "Frost Wolf", boss_rank: "E",
                current_hp: 100000, max_hp: 100000, intel: { abilities: ["Frost Bite"] }, damage_type: "PHYSICAL"
            },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutIronWill = await calculateBossCombatRound(baseInput);
        const withIronWill = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { status_resistance_percent: 0.50 },
        });

        expect(withoutIronWill.statusApplied?.type).toBe("FREEZE");
        expect(withIronWill.statusApplied).toBeUndefined();
        expect(withIronWill.statusResisted).toBe(true);
        expect(withIronWill.playerDamage).toBe(withoutIronWill.playerDamage);
    });

    it("keeps explicitly unresistable Reality Fracture effects intact", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.01);
        const result = await calculateBossCombatRound({
            userId: "player", questId: "quest", questDifficulty: "COSMIC",
            activeEncounter: {
                id: "encounter", boss_id: "boss", boss_name: "Cosmic Horror", boss_rank: "COSMIC",
                current_hp: 100000, max_hp: 100000, intel: { abilities: ["Reality Collapse"] }, damage_type: "PHYSICAL"
            },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1000, hunterRank: "COSMIC", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            skillModifiers: { status_resistance_percent: 0.50 },
        });

        expect(result.statusApplied?.type).toBe("REALITY_FRACTURE");
        expect(result.statusResisted).toBeUndefined();
    });

    it("applies Iron Fist to unarmed boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 10 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutIronFist = await calculateBossCombatRound(baseInput);
        const withIronFist = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { unarmed_damage_percent: 0.50 },
        });

        expect(withIronFist.damageDealt).toBeGreaterThan(withoutIronFist.damageDealt);
    });

    it("carries dagger identity into the Dagger Mastery damage path", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 20, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [{ effect: { damage_min: 10, damage_max: 20 }, type: "WEAPON", slot: "MAIN_HAND", item_name: "Dagger" }],
            equipment: [{ damage_min: 10, damage_max: 20 }], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const base = await calculateBossCombatRound(baseInput);
        const mastered = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { dagger_damage_percent: 0.20 },
        });

        expect(mastered.damageDealt).toBeGreaterThan(base.damageDealt);
    });

    it("lets Entangling Roots bind a non-cosmic boss for one counter-attack", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.01);
        const result = await calculateBossCombatRound({
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            skillModifiers: { boss_root_chance: 0.50 },
        });

        expect(result.bossRooted).toBe(true);
        expect(result.damageDealt).toBeGreaterThan(0);
        expect(result.playerDamage).toBeUndefined();
    });

    it("keeps Entangling Roots outside the cosmic boss boundary", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.01);
        const result = await calculateBossCombatRound({
            userId: "player", questId: "quest", questDifficulty: "COSMIC",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Cosmic Horror", boss_rank: "COSMIC", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1000, hunterRank: "COSMIC", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            skillModifiers: { boss_root_chance: 0.50 },
        });

        expect(result.bossRooted).toBe(false);
        expect(result.playerDamage).toBeGreaterThan(0);
    });

    it("applies Domain of the Monarch to passive shadow-army damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "Necromancer",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 100, shadowStorageLimit: 200,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const base = await calculateBossCombatRound(baseInput);
        const domain = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { shadow_army_damage_percent: 0.50 },
        });

        expect(base.summonDamage).toBeGreaterThan(0);
        expect(domain.summonDamage).toBe(Math.floor(base.summonDamage * 1.5));
        expect(domain.damageDealt).toBeGreaterThan(base.damageDealt);
    });

    it("applies Shadow Step evasion through the boss attack roll", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.10);
        const result = await calculateBossCombatRound({
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            skillModifiers: { boss_evasion: 0.50 },
        });

        expect(result.stealthActive).toBe(true);
        expect(result.evaded).toBe(true);
        expect(result.playerDamage).toBe(0);
    });

    it("applies Fireball to magic-archetype boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 10 },
            equipmentList: [], equipment: [], hunterClass: "Mage",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutFireball = await calculateBossCombatRound(baseInput);
        const withFireball = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { damage_magic_percent: 0.50 },
        });

        expect(withFireball.damageDealt).toBeGreaterThan(withoutFireball.damageDealt);
    });

    it("applies Curse of Agony current-HP pressure to boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 0, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutCurse = await calculateBossCombatRound(baseInput);
        const withCurse = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { curse_pressure_percent: 0.05 },
        });

        expect(withCurse.damageDealt).toBeGreaterThan(withoutCurse.damageDealt);
        expect(withCurse.damageDealt - withoutCurse.damageDealt).toBeGreaterThanOrEqual(2500);
    });

    it("returns bounded Life Drain healing from direct boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 10, willpower: 10, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutLifeDrain = await calculateBossCombatRound(baseInput);
        const withLifeDrain = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { life_drain_percent: 0.20 },
        });

        expect(withoutLifeDrain.playerHealing).toBe(0);
        expect(withLifeDrain.playerHealing).toBeGreaterThan(0);
        expect(withLifeDrain.playerHealing).toBeLessThanOrEqual(Math.floor(withLifeDrain.damageDealt * 0.20));
    });

    it("applies Holy Light to direct Life Drain healing without changing damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 10, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
            skillModifiers: { life_drain_percent: 0.20 },
        };

        const lifeDrain = await calculateBossCombatRound(baseInput);
        const withHolyLight = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { life_drain_percent: 0.20, healing_received_percent: 0.50 },
        });

        expect(withHolyLight.damageDealt).toBe(lifeDrain.damageDealt);
        expect(withHolyLight.playerHealing).toBe(Math.floor(withHolyLight.damageDealt * 0.20 * 1.5));
    });

    it("applies Taunt defense modifiers to incoming boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 100, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutTaunt = await calculateBossCombatRound(baseInput);
        const withTaunt = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { defense_percent: 0.50 },
        });

        expect(withTaunt.playerDamage).toBeLessThan(withoutTaunt.playerDamage!);
    });

    it("applies Quicksilver attack speed to the second-strike roll", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.01);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutQuicksilver = await calculateBossCombatRound(baseInput);
        const withQuicksilver = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { attack_speed_percent: 0.50 },
        });

        expect(withoutQuicksilver.doubleStrike).toBe(false);
        expect(withQuicksilver.doubleStrike).toBe(true);
        expect(withQuicksilver.damageDealt).toBeGreaterThan(withoutQuicksilver.damageDealt);
    });

    it("applies Iron Skin armor modifiers to incoming boss damage", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const baseInput: BossCombatInput = {
            userId: "player", questId: "quest", questDifficulty: "E",
            activeEncounter: { id: "encounter", boss_id: "boss", boss_name: "Wolf", boss_rank: "E", current_hp: 100000, max_hp: 100000, intel: {}, damage_type: "PHYSICAL" },
            rawStats: { strength: 0, agility: 0, intelligence: 0, vitality: 100, perception: 0, charisma: 0, focus: 0, willpower: 0, luck: 0 },
            equipmentList: [], equipment: [], hunterClass: "NONE",
            hunterLevel: 1, hunterRank: "E", shadowInfantryCount: 0, shadowStorageLimit: 0,
            statusEffects: [], titleModifiers: [], activeEffects: [], isStunned: false, maxPlayerHp: 260,
        };

        const withoutIronSkin = await calculateBossCombatRound(baseInput);
        const withIronSkin = await calculateBossCombatRound({
            ...baseInput,
            skillModifiers: { armor_percent: 0.30 },
        });

        expect(withIronSkin.playerDamage).toBeLessThan(withoutIronSkin.playerDamage!);
    });
});
