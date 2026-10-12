import { describe, expect, test } from 'vitest';
import {
    calculateDominatorsTouchBonuses,
    calculateBloodlustBonuses,
    calculateCriticalStrikeBonuses,
    calculateIronBodyBonuses,
    calculateIronFistBonuses,
    calculateIronSkinBonuses,
    calculateIronWillBonuses,
    calculateLifeDrainBonuses,
    calculateLongevityBonuses,
    calculateHolyLightBonuses,
    calculatePurificationBonuses,
    cleansePurifiableStatusEffects,
    applyHealingReceivedBonus,
    calculateFireballBonuses,
    calculateFocusBonuses,
    calculateCurseOfAgonyBonuses,
    calculateDaggerMasteryBonuses,
    calculateEntanglingRootsBonuses,
    calculateDomainOfTheMonarchBonuses,
    calculateShadowStepBonuses,
    calculateManaShieldBonuses,
    calculateMeditationBonuses,
    calculateQuicksilverBonuses,
    calculateTauntBonuses,
    calculateMutilateMultiplier,
    calculateRecoveryPercent,
    calculateSkillCooldownSeconds,
    calculateQuestManaEfficiency,
    calculateShadowExtractionSuccessPercent,
    calculateSprintMultiplier,
    calculateStealthBonuses,
    calculateVitalStrikeBonuses,
    getActiveSkillEffectSummary,
    getPassiveSkillEffectSummary,
    getSkillRuntimeLabel,
    getSkillStatScalingSummary,
} from './skill-effects';

describe('Skill effect formulas', () => {
    test('uses the same rank-scaled cooldown as the Sprint action', () => {
        expect(calculateSkillCooldownSeconds(28_800, 1, 'INSTANT_XP_BUFF')).toBe(28_800);
        expect(calculateSkillCooldownSeconds(28_800, 5, 'INSTANT_XP_BUFF')).toBe(21_600);
        expect(calculateSkillCooldownSeconds(14_400, 5, 'DAMAGE_BUFF')).toBe(14_400);
    });

    test('matches active skill values at rank one and maximum rank', () => {
        expect(calculateSprintMultiplier(1)).toBeCloseTo(1.3);
        expect(calculateSprintMultiplier(5)).toBeCloseTo(1.7);
        expect(calculateVitalStrikeBonuses(2)).toEqual({ critRatePercent: 30, critDamageMultiplier: 0.7 });
        expect(calculateStealthBonuses(1)).toEqual({ evasionPercent: 40, critRatePercent: 25 });
        expect(calculateMutilateMultiplier(5)).toBeCloseTo(1.45);
        expect(calculateRecoveryPercent(5)).toBe(1);
        expect(calculateDominatorsTouchBonuses(3)).toEqual({
            manaRestorePercent: 0.25,
            armorCrushPercent: 0.26,
            telekineticPressurePercent: 0.02,
        });
        expect(calculateShadowExtractionSuccessPercent(1)).toBe(55);
        expect(calculateFocusBonuses(1)).toEqual({ manaCostReductionPercent: 2 });
        expect(calculateFocusBonuses(10)).toEqual({ manaCostReductionPercent: 20 });
    });

    test('renders active effect text from the same formulas', () => {
        expect(getActiveSkillEffectSummary('CRIT_BUFF', 2)).toContain('+30% Critical Rate');
        expect(getActiveSkillEffectSummary('INSTANT_HEAL', 5)).toBe('Restores 100% of Max HP instantly.');
        expect(getActiveSkillEffectSummary('MANA_RESTORATION', 1)).toContain('15% Max MP');
    });

    test('keeps quest mana efficiency aligned with the shared floor', () => {
        expect(calculateQuestManaEfficiency({ mana_cost_reduction: 0.08 })).toBeCloseTo(0.92);
        expect(calculateQuestManaEfficiency({ focus: 20, mana_cost_reduction: 0.40 })).toBe(0.5);
    });

    test('explains permanent stat scaling using character level and skill rank', () => {
        expect(getSkillStatScalingSummary({ Agility: 1 }, 3, 50, 'Passive')).toEqual([
            '+1 Agility per character level; currently +70 at Level 50, Rank 3',
        ]);
        expect(getSkillStatScalingSummary({ all_stats_flat: 1 }, 4, 50, 'ULTIMATE')).toEqual([
            '+4 All Stats at rank 4 (flat)',
        ]);
    });

    test('classifies the runtime contract shown on skill surfaces', () => {
        expect(getSkillRuntimeLabel({ hasActiveEffect: true, hasPassiveEffect: false, hasStatImprint: true })).toBe('ACTIVE EFFECT');
        expect(getSkillRuntimeLabel({ hasActiveEffect: false, hasPassiveEffect: true, hasStatImprint: true })).toBe('PASSIVE EFFECT');
        expect(getSkillRuntimeLabel({ hasActiveEffect: false, hasPassiveEffect: false, hasStatImprint: true })).toBe('STAT IMPRINT');
        expect(getSkillRuntimeLabel({ hasActiveEffect: false, hasPassiveEffect: false, hasStatImprint: false })).toBe('LORE ONLY');
    });

    test('registers Critical Strike as a rank-scaled passive combat effect', () => {
        expect(calculateCriticalStrikeBonuses(1)).toEqual({ critRatePercent: 2 });
        expect(calculateCriticalStrikeBonuses(10)).toEqual({ critRatePercent: 20 });
        expect(calculateIronBodyBonuses(1)).toEqual({ damageReductionPercent: 3 });
        expect(calculateIronBodyBonuses(20)).toEqual({ damageReductionPercent: 30 });
        expect(calculateManaShieldBonuses(1)).toEqual({ manaAbsorptionPercent: 5 });
        expect(calculateManaShieldBonuses(10)).toEqual({ manaAbsorptionPercent: 50 });
        expect(calculateIronWillBonuses(1)).toEqual({ statusResistancePercent: 5 });
        expect(calculateIronWillBonuses(10)).toEqual({ statusResistancePercent: 50 });
        expect(calculateIronFistBonuses(1)).toEqual({ unarmedDamagePercent: 10 });
        expect(calculateIronFistBonuses(10)).toEqual({ unarmedDamagePercent: 50 });
        expect(calculateShadowStepBonuses(1)).toEqual({ evasionPercent: 5 });
        expect(calculateShadowStepBonuses(10)).toEqual({ evasionPercent: 50 });
        expect(calculateFireballBonuses(1)).toEqual({ magicDamagePercent: 5 });
        expect(calculateFireballBonuses(10)).toEqual({ magicDamagePercent: 50 });
        expect(calculateCurseOfAgonyBonuses(1)).toEqual({ currentHpPressurePercent: 0.5 });
        expect(calculateCurseOfAgonyBonuses(10)).toEqual({ currentHpPressurePercent: 5 });
        expect(calculateMeditationBonuses(1)).toEqual({ regenRatePercent: 5 });
        expect(calculateMeditationBonuses(10)).toEqual({ regenRatePercent: 50 });
        expect(calculateLifeDrainBonuses(1)).toEqual({ healingPercent: 2 });
        expect(calculateLifeDrainBonuses(10)).toEqual({ healingPercent: 20 });
        expect(calculateTauntBonuses(1)).toEqual({ defensePercent: 5 });
        expect(calculateTauntBonuses(10)).toEqual({ defensePercent: 50 });
        expect(calculateQuicksilverBonuses(1)).toEqual({ attackSpeedPercent: 5 });
        expect(calculateQuicksilverBonuses(10)).toEqual({ attackSpeedPercent: 50 });
        expect(calculateBloodlustBonuses(1)).toEqual({ physicalDamagePercent: 5 });
        expect(calculateBloodlustBonuses(10)).toEqual({ physicalDamagePercent: 50 });
        expect(calculateIronSkinBonuses(1)).toEqual({ armorPercent: 3 });
        expect(calculateIronSkinBonuses(10)).toEqual({ armorPercent: 30 });
        expect(calculateLongevityBonuses(1)).toEqual({ maxHpPercent: 5 });
        expect(calculateLongevityBonuses(10)).toEqual({ maxHpPercent: 50 });
        expect(calculateHolyLightBonuses(1)).toEqual({ healingReceivedPercent: 5 });
        expect(calculateHolyLightBonuses(10)).toEqual({ healingReceivedPercent: 50 });
        expect(calculatePurificationBonuses(1)).toEqual({ statusCleansePercent: 10 });
        expect(calculatePurificationBonuses(10)).toEqual({ statusCleansePercent: 100 });
        expect(calculateDaggerMasteryBonuses(1)).toEqual({ daggerDamagePercent: 5 });
        expect(calculateDaggerMasteryBonuses(10)).toEqual({ daggerDamagePercent: 50 });
        expect(calculateEntanglingRootsBonuses(1)).toEqual({ rootChancePercent: 5 });
        expect(calculateEntanglingRootsBonuses(10)).toEqual({ rootChancePercent: 50 });
        expect(calculateDomainOfTheMonarchBonuses(1)).toEqual({ shadowArmyDamagePercent: 5 });
        expect(calculateDomainOfTheMonarchBonuses(10)).toEqual({ shadowArmyDamagePercent: 50 });
        expect(getPassiveSkillEffectSummary('Critical Strike', 4)).toBe('Passive combat effect: +8% Critical Rate.');
        expect(getPassiveSkillEffectSummary('Iron Body', 4)).toBe('Passive combat effect: +12% Boss Damage Reduction (30% cap).');
        expect(getPassiveSkillEffectSummary('Mana Shield', 4)).toBe('Passive combat effect: diverts 20% of incoming Boss Damage to MP (50% cap).');
        expect(getPassiveSkillEffectSummary('Iron Will', 4)).toBe('Passive combat effect: +20% Boss Status Resistance (50% cap).');
        expect(getPassiveSkillEffectSummary('Iron Fist', 4)).toBe('Passive combat effect: +40% Unarmed Damage (50% cap).');
        expect(getPassiveSkillEffectSummary('Shadow Step', 4)).toBe('Passive combat effect: +20% Boss Evasion (50% cap).');
        expect(getPassiveSkillEffectSummary('Fireball', 4)).toBe('Passive combat effect: +20% Magic Damage (50% cap).');
        expect(getPassiveSkillEffectSummary('Curse of Agony', 4)).toBe('Passive combat effect: adds 2% of current Boss HP as curse pressure per attack (5% cap).');
        expect(getPassiveSkillEffectSummary('Meditation', 4)).toBe('Passive recovery effect: +20% HP and MP Regeneration (50% cap).');
        expect(getPassiveSkillEffectSummary('Focus', 4)).toBe('Passive resource effect: -8% Quest Mana Cost (20% cap).');
        expect(getPassiveSkillEffectSummary('Life Drain', 4)).toBe('Passive combat effect: restores 8% of direct damage dealt as HP (20% cap).');
        expect(getPassiveSkillEffectSummary('Taunt', 4)).toBe('Passive combat effect: +20% Defense against Boss attacks (50% cap).');
        expect(getPassiveSkillEffectSummary('Quicksilver', 4)).toBe('Passive combat effect: +20% Attack Speed and second-strike chance (50% cap).');
        expect(getPassiveSkillEffectSummary('Bloodlust', 4)).toBe('Passive combat effect: +20% Physical Damage (50% cap).');
        expect(getPassiveSkillEffectSummary('Iron Skin', 4)).toBe('Passive combat effect: +12% Armor against Boss attacks (30% cap).');
        expect(getPassiveSkillEffectSummary('Longevity', 4)).toBe('Passive survival effect: +20% Max HP (50% cap).');
        expect(getPassiveSkillEffectSummary('Holy Light', 4)).toBe('Passive recovery effect: +20% direct Healing Received (50% cap).');
        expect(getPassiveSkillEffectSummary('Purification', 4)).toBe('Passive recovery effect: 40% chance at quest start to cleanse ordinary negative statuses (100% cap).');
        expect(getPassiveSkillEffectSummary('Dagger Mastery', 4)).toBe('Passive combat effect: +20% Dagger Damage (50% cap; main-hand daggers only).');
        expect(getPassiveSkillEffectSummary('Entangling Roots', 4)).toBe('Passive control effect: 20% chance per quest to root a non-cosmic Boss for one round (50% cap).');
        expect(getPassiveSkillEffectSummary('Domain of the Monarch', 4)).toBe('Passive army effect: +20% Shadow Army Damage for assigned and passive attacks (50% cap).');
        expect(applyHealingReceivedBonus(100, { healing_received_percent: 0.20 })).toBe(120);
        expect(applyHealingReceivedBonus(100, { healing_received_percent: 0.90 })).toBe(150);
    });

    test('Purification cleanses ordinary statuses while preserving cosmic and system effects', () => {
        const effects = [
            { name: 'Venom', type: 'POISON' },
            { name: 'Dread', type: 'FEAR' },
            { name: 'Reality Fracture', type: 'REALITY_FRACTURE' },
            { name: 'System Interference', type: 'SYSTEM_INTERFERENCE' },
        ];

        expect(cleansePurifiableStatusEffects(effects, { status_cleanse_percent: 0.1 }, 0.99).cleansedEffects).toEqual([]);
        const result = cleansePurifiableStatusEffects(effects, { status_cleanse_percent: 0.1 }, 0.01);
        expect(result.cleansedEffects.map(effect => effect.name)).toEqual(['Venom', 'Dread']);
        expect(result.remainingEffects.map(effect => effect.type)).toEqual(['REALITY_FRACTURE', 'SYSTEM_INTERFERENCE']);
    });
});
