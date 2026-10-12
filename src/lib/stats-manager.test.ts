import { expect, test, describe } from 'vitest'
import { StatsManager } from './stats-manager'

describe('StatsManager', () => {
    describe('Max HP Calculation', () => {
        test('Base Calculation (Level 1, Base Stats)', () => {
            const hp = StatsManager.calculateMaxHP(10, 10, 1, {});
            expect(hp).toBe(260);
        });

        test('Apply Percentage Modifier (Buff)', () => {
            const hp = StatsManager.calculateMaxHP(10, 10, 1, { hp_percent: 0.1 });
            // Let stats-manager calculate base (260 for Level 1, Vit 10, Str 10)
            // Final: 260 * (1 + 0.1) = 286
            expect(hp).toBe(286);
        });

        test('Apply Stat Modifiers (Equipment/Buffs)', () => {
            // StatsManager.calculateMaxHP takes FINAL stats.
            // If vitality is boosted by 50%, the CALLER (StatsManager.calculateEffectiveStats) handles it.
            // This test should verify that if we pass vitality=15 (original 10 * 1.5), we get expected HP.
            const hpWithBuff = StatsManager.calculateMaxHP(15, 10, 1, {});
            // Base: 100 + (15 * 10) + (10 * 5) + (1 * 10) = 100 + 150 + 50 + 10 = 310
            expect(hpWithBuff).toBe(310);
        });
    });

    describe('Damage Calculation', () => {
        test('Critical chance stays within 0–100% after all equipment and skill bonuses', () => {
            const equipment = [{ slot: 'MAIN_HAND', type: 'WEAPON', effect: { crit_chance: 0.8, stealth: true } }];
            const high = StatsManager.calculatePlayerDamage({ agility: 500, perception: 500 }, equipment, 'NONE', { crit_chance: 0.8 });
            expect(high.critChance).toBe(1);
            expect(StatsManager.calculatePlayerDamage({ agility: 10, perception: 10 }, [], 'NONE', { crit_chance: 0.1 }).critChance).toBeCloseTo(0.14);
            expect(StatsManager.calculatePlayerDamage({}, [], 'NONE', { crit_chance: -1 }).critChance).toBe(0);
        });

        test('Unarmed Damage (Level 1)', () => {
            // Str 10, Agi 10
            // Archetype: POWER (Default for NONE)
            // Bonus: (Str 10 * 1.2) + (Agi 10 * 0.2) = 12 + 2 = 14
            // Min: 1 + 14 = 15
            // Max: 5 + 14 = 19
            const dmg = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 10 },
                []
            );
            expect(dmg.min).toBe(15);
            expect(dmg.max).toBe(19);
        });

        test('Dagger (Speed Archetype)', () => {
            // Str 10, Agi 20
            // Weapon: Dagger (Min 10, Max 20)
            // Archetype: Speed
            // Bonus: (Agi 20 * 0.8) + (Str 10 * 0.3) = 16 + 3 = 19
            // Min: 10 + 19 = 29
            // Max: 20 + 19 = 39
            const pd = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 20 },
                [{
                    slot: 'MAIN_HAND',
                    type: 'WEAPON',
                    item: { name: 'Dagger' } as any, // Needed to trigger speed archetype
                    effect: { damage_min: 10, damage_max: 20 } as any
                }]
            );
            expect(pd.min).toBe(29);
            expect(pd.max).toBe(39);
        });

        test('Dagger Mastery only increases main-hand dagger damage', () => {
            const dagger = [{
                slot: 'MAIN_HAND',
                type: 'WEAPON',
                item_name: 'Dagger',
                effect: { damage_min: 10, damage_max: 20 },
            }];
            const sword = [{
                slot: 'MAIN_HAND',
                type: 'WEAPON',
                item_name: 'Sword',
                effect: { damage_min: 10, damage_max: 20 },
            }];

            const baseDagger = StatsManager.calculatePlayerDamage({ strength: 10, agility: 20 }, dagger);
            const masteredDagger = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 20 }, dagger, 'NONE', { dagger_damage_percent: 0.20 }
            );
            const baseSword = StatsManager.calculatePlayerDamage({ strength: 10, agility: 20 }, sword);
            const masteredSword = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 20 }, sword, 'NONE', { dagger_damage_percent: 0.20 }
            );

            expect(masteredDagger.min).toBe(Math.floor(baseDagger.min * 1.20));
            expect(masteredDagger.max).toBe(Math.floor(baseDagger.max * 1.20));
            expect(masteredSword).toEqual(baseSword);
        });
    });

    describe('Modifier Aggregation', () => {
        test('Sum and Normalize', () => {
            const sources = [
                { str: 5, agi: 5 },
                { strength: 10 },
                { unknown: 'foo' }
            ];
            const result = StatsManager.aggregateModifiers(sources as any);
            expect(result.strength).toBe(15);
            expect(result.agility).toBe(5);
        });

        test('adds the Critical Strike passive effect beside its Agility imprint', () => {
            const [criticalStrike] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Critical Strike',
                    current_level: 3,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Agility: 1 },
                },
            ], 50);

            expect(criticalStrike).toMatchObject({ Agility: 70, crit_chance: 0.06 });
        });

        test('adds the Dagger Mastery effect beside its Agility imprint', () => {
            const [daggerMastery] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Dagger Mastery',
                    current_level: 4,
                    max_level: 5,
                    category: 'Passive',
                    stat_bonus: { Agility: 1 },
                },
            ], 50);

            expect(daggerMastery).toMatchObject({ Agility: 80, dagger_damage_percent: 0.20 });
        });

        test('adds the Purification effect beside its Intelligence imprint', () => {
            const [purification] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Purification',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(purification).toMatchObject({ Intelligence: 80, status_cleanse_percent: 0.40 });
        });

        test('adds the Entangling Roots control effect beside its Intelligence imprint', () => {
            const [roots] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Entangling Roots',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(roots).toMatchObject({ Intelligence: 80, boss_root_chance: 0.20 });
        });

        test('adds the Domain of the Monarch effect beside its Strength and Intelligence imprints', () => {
            const [domain] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Domain of the Monarch',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Strength: 1, Intelligence: 1 },
                },
            ], 50);

            expect(domain).toMatchObject({ Strength: 80, Intelligence: 80, shadow_army_damage_percent: 0.20 });
        });

        test('adds the Iron Body passive effect beside its Vitality imprint', () => {
            const [ironBody] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Iron Body',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Vitality: 2 },
                },
            ], 50);

            expect(ironBody).toMatchObject({ Vitality: 160, damage_reduction_percent: 0.12 });
        });

        test('adds the Mana Shield passive effect beside its Intelligence imprint', () => {
            const [manaShield] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Mana Shield',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(manaShield).toMatchObject({ Intelligence: 80, mana_shield_percent: 0.20 });
        });

        test('adds the Iron Will passive effect beside its Vitality imprint', () => {
            const [ironWill] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Iron Will',
                    current_level: 4,
                    max_level: 5,
                    category: 'Passive',
                    stat_bonus: { Vitality: 1 },
                },
            ], 50);

            expect(ironWill).toMatchObject({ Vitality: 80, status_resistance_percent: 0.20 });
        });

        test('applies Iron Fist only to unarmed damage', () => {
            const base = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 10 }, [], 'NONE', {}
            );
            const withIronFist = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 10 }, [], 'NONE', { unarmed_damage_percent: 0.50 }
            );
            const withWeaponBase = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 10 }, [{
                    slot: 'MAIN_HAND', type: 'WEAPON', effect: { damage_min: 10, damage_max: 20 }, item: { name: 'Sword' }
                }], 'NONE', {}
            );
            const withWeapon = StatsManager.calculatePlayerDamage(
                { strength: 10, agility: 10 }, [{
                    slot: 'MAIN_HAND', type: 'WEAPON', effect: { damage_min: 10, damage_max: 20 }, item: { name: 'Sword' }
                }], 'NONE', { unarmed_damage_percent: 0.50 }
            );

            expect(withIronFist.min).toBe(Math.floor(base.min * 1.5));
            expect(withIronFist.max).toBe(Math.floor(base.max * 1.5));
            expect(withWeapon).toEqual(withWeaponBase);
        });

        test('adds the Shadow Step passive effect beside its Agility imprint', () => {
            const [shadowStep] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Shadow Step',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Agility: 1 },
                },
            ], 50);

            expect(shadowStep).toMatchObject({ Agility: 80, boss_evasion: 0.20 });
        });

        test('applies Fireball only to magic-archetype damage', () => {
            const magicBase = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'Mage', {}
            );
            const magicFireball = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'Mage', { damage_magic_percent: 0.50 }
            );
            const physicalBase = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'NONE', {}
            );
            const physicalFireball = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'NONE', { damage_magic_percent: 0.50 }
            );

            expect(magicFireball.min).toBeGreaterThan(magicBase.min);
            expect(magicFireball.max).toBeGreaterThan(magicBase.max);
            expect(physicalFireball).toEqual(physicalBase);
        });

        test('applies Bloodlust only to physical-archetype damage', () => {
            const physicalBase = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'NONE', {}
            );
            const physicalBloodlust = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'NONE', { damage_physical_percent: 0.50 }
            );
            const magicBase = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'Mage', {}
            );
            const magicBloodlust = StatsManager.calculatePlayerDamage(
                { intelligence: 10, strength: 10, agility: 10 }, [], 'Mage', { damage_physical_percent: 0.50 }
            );

            expect(physicalBloodlust.min).toBeGreaterThan(physicalBase.min);
            expect(physicalBloodlust.max).toBeGreaterThan(physicalBase.max);
            expect(magicBloodlust).toEqual(magicBase);
        });

        test('adds the Curse of Agony pressure beside its Intelligence imprint', () => {
            const [curse] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Curse of Agony',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(curse).toMatchObject({ Intelligence: 80, curse_pressure_percent: 0.02 });
        });

        test('adds the Life Drain healing effect beside its Intelligence imprint', () => {
            const [lifeDrain] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Life Drain',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(lifeDrain).toMatchObject({ Intelligence: 80, life_drain_percent: 0.08 });
        });

        test('adds the Taunt defense effect beside its Vitality imprint', () => {
            const [taunt] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Taunt',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Vitality: 1 },
                },
            ], 50);

            expect(taunt).toMatchObject({ Vitality: 80, defense_percent: 0.20 });
        });

        test('adds the Quicksilver attack-speed effect beside its Agility imprint', () => {
            const [quicksilver] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Quicksilver',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Agility: 1 },
                },
            ], 50);

            expect(quicksilver).toMatchObject({ Agility: 80, attack_speed_percent: 0.20 });
        });

        test('adds the Bloodlust physical-damage effect beside its Strength imprint', () => {
            const [bloodlust] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Bloodlust',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Strength: 1 },
                },
            ], 50);

            expect(bloodlust).toMatchObject({ Strength: 80, damage_physical_percent: 0.20 });
        });

        test('adds the Iron Skin armor effect beside its Vitality imprint', () => {
            const [ironSkin] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Iron Skin',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Vitality: 1 },
                },
            ], 50);

            expect(ironSkin).toMatchObject({ Vitality: 80, armor_percent: 0.12 });
        });

        test('adds the Longevity max-HP effect beside its Vitality imprint', () => {
            const [longevity] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Longevity',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Vitality: 2 },
                },
            ], 50);

            expect(longevity).toMatchObject({ Vitality: 160, hp_percent: 0.20 });
        });

        test('adds the Holy Light healing effect beside its Intelligence imprint', () => {
            const [holyLight] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Holy Light',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(holyLight).toMatchObject({ Intelligence: 80, healing_received_percent: 0.20 });
        });

        test('adds Focus quest mana efficiency beside its Intelligence imprint', () => {
            const [focus] = StatsManager.calculateScaledSkillModifiers([
                {
                    name: 'Focus',
                    current_level: 4,
                    max_level: 10,
                    category: 'Passive',
                    stat_bonus: { Intelligence: 1 },
                },
            ], 50);

            expect(focus).toMatchObject({ Intelligence: 80, mana_cost_reduction: 0.08 });
        });
    });

    describe('Regeneration Calculation', () => {
        test('Base Regeneration (Level 1, Base Stats)', () => {
            // Level 1 Max HP: 260, Max Mana: 160
            // HP Regen: 4 + (260 * 0.05) = 4 + 13 = 17 HP/h
            // Mana Regen: 20 + (160 * 0.05) = 20 + 8 = 28 MP/h
            const rates = StatsManager.getRegenRates(260, 160);
            expect(rates.hpPerHour).toBe(17);
            expect(rates.manaPerHour).toBe(28);
        });

        test('Scaling Regeneration (Higher Stats)', () => {
            // Max HP: 1000, Max Mana: 1000
            // HP Regen: 4 + (1000 * 0.05) = 54 HP/h
            // Mana Regen: 20 + (1000 * 0.05) = 70 MP/h
            const rates = StatsManager.getRegenRates(1000, 1000);
            expect(rates.hpPerHour).toBe(54);
            expect(rates.manaPerHour).toBe(70);
        });

        test('Class Multiplier (Healer)', () => {
            // Healer has regenMult: 1.5
            // Base Stats Level 1: Max HP: 260 * 1.15 = 299, Max Mana: 160 * 1.4 = 224
            // HP Regen: (4 + (299 * 0.05)) * 1.5 = (4 + 14.95) * 1.5 = 18.95 * 1.5 = 28.425
            // Mana Regen: (20 + (224 * 0.05)) * 1.5 = (20 + 11.2) * 1.5 = 31.2 * 1.5 = 46.8
            const rates = StatsManager.getRegenRates(299, 224, 'Healer');
            expect(rates.hpPerHour).toBeCloseTo(28.425, 2);
            expect(rates.manaPerHour).toBeCloseTo(46.8, 2);
        });

        test('Meditation regeneration modifier scales both HP and MP recovery', () => {
            const base = StatsManager.getRegenRates(1000, 1000);
            const withMeditation = StatsManager.getRegenRates(1000, 1000, 'NONE', { regen_rate_percent: 0.20 });

            expect(withMeditation.hpPerHour).toBeCloseTo(base.hpPerHour * 1.2, 5);
            expect(withMeditation.manaPerHour).toBeCloseTo(base.manaPerHour * 1.2, 5);
        });

        test('Longevity increases Max HP through the shared HP formula', () => {
            const base = StatsManager.calculateMaxHP(100, 100, 50, {});
            const withLongevity = StatsManager.calculateMaxHP(100, 100, 50, { hp_percent: 0.20 });

            expect(withLongevity).toBe(Math.floor(base * 1.20));
        });
    });
});
