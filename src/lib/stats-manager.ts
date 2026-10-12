import { type ItemEffect } from "@/lib/types/zod-schemas";
import { calculateBloodlustBonuses, calculateCriticalStrikeBonuses, calculateCurseOfAgonyBonuses, calculateDaggerMasteryBonuses, calculateDomainOfTheMonarchBonuses, calculateEntanglingRootsBonuses, calculateFireballBonuses, calculateFocusBonuses, calculateHolyLightBonuses, calculateIronBodyBonuses, calculateIronFistBonuses, calculateIronSkinBonuses, calculateIronWillBonuses, calculateLifeDrainBonuses, calculateLongevityBonuses, calculateManaShieldBonuses, calculateMeditationBonuses, calculatePurificationBonuses, calculateQuicksilverBonuses, calculateShadowStepBonuses, calculateTauntBonuses } from "@/lib/system/skill-effects";

export const CLASS_MODIFIERS: Record<string, any> = {
    'Fighter': {
        stats: { strength: 1.15, vitality: 1.10 },
        manaMult: 1.0,
        hpMult: 1.1,
        defenseMult: 1.1,
        damageMult: 1.2, // Physical
        archetype: 'POWER'
    },
    'Mage': {
        stats: { intelligence: 1.25, vitality: 0.9 },
        manaMult: 1.5,
        hpMult: 0.9,
        defenseMult: 0.8,
        damageMult: 1.3, // Magic Amp
        archetype: 'MAGIC'
    },
    'Tank': {
        stats: { strength: 1.1, vitality: 1.3 },
        manaMult: 0.8,
        hpMult: 1.3,
        defenseMult: 1.5,
        damageMult: 0.8, // Mitigation focus
        archetype: 'POWER'
    },
    'Assassin': {
        stats: { agility: 1.25, vitality: 0.9 },
        manaMult: 1.0,
        hpMult: 0.9,
        defenseMult: 0.9,
        damageMult: 1.2, // Speed
        critMod: 1.5, // 50% extra crit damage
        archetype: 'SPEED'
    },
    'Warlock': {
        stats: { intelligence: 1.15 },
        manaMult: 1.3,
        hpMult: 1.0,
        defenseMult: 1.0,
        damageMult: 1.15, // Hybrid/Dark
        archetype: 'MAGIC'
    },
    'Healer': {
        stats: { intelligence: 1.15, vitality: 1.15 },
        manaMult: 1.4,
        hpMult: 1.15,
        defenseMult: 1.0,
        regenMult: 1.5,
        archetype: 'MAGIC'
    },
    'Ranger': {
        stats: { perception: 1.2, agility: 1.1 },
        manaMult: 1.0,
        hpMult: 1.0,
        defenseMult: 1.0,
        damageMult: 1.2, // Ranged
        archetype: 'SPEED'
    },
    'Necromancer': {
        stats: { intelligence: 1.20, vitality: 1.10 },
        manaMult: 2.0, // Legendary Mana Pool
        hpMult: 1.1,
        defenseMult: 1.0,
        damageMult: 1.25, // Monarch's Authority
        archetype: 'MAGIC'
    },
    'NONE': {
        stats: {},
        manaMult: 1.0,
        hpMult: 1.0,
        defenseMult: 1.0,
        damageMult: 1.0,
        archetype: 'POWER'
    }
};

export class StatsManager {
    static calculateMaxHP(vitality: number, strength: number, level: number, modifiers: Record<string, number> = {}, hunterClass: string = 'NONE', prestige: number = 0): number {
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];

        // 1. Stats are already final
        const modVit = vitality;
        const modStr = strength;

        // 2. Base Calculation
        let hp = 100 + (modVit * 10) + (modStr * 5) + (level * 10);

        // 3. Apply Class Multiplier
        hp *= (classMod.hpMult || 1.0);

        // 4. Apply Prestige Multiplier (Acausal Growth)
        if (prestige > 0) {
            hp *= Math.pow(2, prestige); // HP doubles per prestige
        }

        // 5. Apply HP Modifiers
        const hpFlat = modifiers['hp_flat'] || 0;
        const hpPercent = modifiers['hp_percent'] || 0;

        return Math.floor((hp + hpFlat) * (1 + hpPercent));
    }

    static calculateMaxMana(intelligence: number, level: number, modifiers: Record<string, number> = {}, hunterClass: string = 'NONE', prestige: number = 0): number {
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];

        // 1. Stats are already final
        const modInt = intelligence;

        // 2. Base Calculation
        let mana = 50 + (modInt * 10) + (level * 10);

        // 3. Apply Class Multiplier
        mana *= (classMod.manaMult || 1.0);

        // 4. Apply Prestige Multiplier
        if (prestige > 0) {
            mana *= Math.pow(2, prestige);
        }

        // 5. Apply Mana Modifiers
        const manaFlat = modifiers['mana_flat'] || 0;
        const manaPercent = modifiers['mana_percent'] || 0;

        return Math.floor((mana + manaFlat) * (1 + manaPercent));
    }

    static calculateDefense(vitality: number, modifiers: Record<string, number> = {}, hunterClass: string = 'NONE', cosmicPower: number = 0): number {
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];

        // Base Defense = Vitality * 1.2
        const baseDef = vitality * 1.2;

        // Apply Class Modifier
        const classDef = baseDef * (classMod.defenseMult || 1.0);

        // Apply Flat Modifiers (Equipment)
        const flatDef = modifiers['defense'] || 0;

        // Apply Percent Modifiers (Equipment & Titles)
        const defPercent = (modifiers['defense_percent'] || 0) + (modifiers['armor_percent'] || 0);

        // Acausal Resilience: Damage Reduction from Cosmic Power
        // Formula: Defense + (CosmicPower / 100)
        const resilience = Math.floor(Number(cosmicPower) / 100);

        return Math.floor((classDef + flatDef + resilience) * (1 + defPercent));
    }

    static aggregateModifiers(sources: Array<Record<string, unknown>>): Record<string, number> {
        const aggregated: Record<string, number> = {};

        sources.forEach(source => {
            if (!source) return;

            Object.entries(source).forEach(([key, value]) => {
                const val = Number(value);
                if (isNaN(val)) return;

                let normalizedKey = key.toLowerCase();

                if (normalizedKey === 'str') normalizedKey = 'strength';
                if (normalizedKey === 'agi') normalizedKey = 'agility';
                if (normalizedKey === 'int') normalizedKey = 'intelligence';
                if (normalizedKey === 'vit') normalizedKey = 'vitality';
                if (normalizedKey === 'per') normalizedKey = 'perception';
                if (normalizedKey === 'def') normalizedKey = 'defense';
                if (normalizedKey === 'cha') normalizedKey = 'charisma';
                if (normalizedKey === 'foc') normalizedKey = 'focus';
                if (normalizedKey === 'wil') normalizedKey = 'willpower';
                if (normalizedKey === 'luc') normalizedKey = 'luck';

                aggregated[normalizedKey] = (aggregated[normalizedKey] || 0) + val;
            });
        });

        return aggregated;
    }

    static calculateScaledSkillModifiers(userSkills: any[], userLevel: number): Record<string, number>[] {
        const modifierSources: Record<string, number>[] = [];

        userSkills.forEach((us: any) => {
            if (us.stat_bonus) {
                const scaledBonus: Record<string, number> = {};
                const skillLevel = us.current_level || 0;
                const maxLevel = us.max_level || 1;
                const category = us.category || 'Passive';
                const skillName = String(us.name || us.skill_name || '').trim().toLowerCase();

                if (skillLevel <= 0) return;

                // Tier 3: Life Skills (Capped Scaling)
                if (['Creativity', 'Productivity'].includes(category)) {
                    const cappedUserLevel = Math.min(userLevel, 50);
                    Object.entries(us.stat_bonus).forEach(([stat, val]) => {
                        scaledBonus[stat] = Math.floor(((val as number) * cappedUserLevel) + (skillLevel * 5));
                    });
                } else if (category === 'ULTIMATE') {
                    // Tier 4: Ultimate Awakening (Linear Infinite Scaling)
                    Object.entries(us.stat_bonus).forEach(([stat, val]) => {
                        scaledBonus[stat] = Math.floor((val as number) * skillLevel);
                    });
                } else {
                    // Tier 1 & 2: Combat & Traits
                    let skillMultiplier = 1.0;
                    if (maxLevel > 1 && skillLevel > 1) {
                        skillMultiplier = 1 + (skillLevel - 1) * 0.2;
                    }
                    Object.entries(us.stat_bonus).forEach(([stat, val]) => {
                        const baseValue = (val as number) * userLevel;
                        scaledBonus[stat] = Math.floor(baseValue * skillMultiplier);
                    });
                }

                if (skillName === 'dagger mastery') {
                    const { daggerDamagePercent } = calculateDaggerMasteryBonuses(skillLevel);
                    scaledBonus.dagger_damage_percent = daggerDamagePercent / 100;
                }

                // Critical Strike keeps its permanent Agility imprint and adds
                // a direct weak-point chance to the shared damage pipeline.
                if (skillName === 'critical strike') {
                    const { critRatePercent } = calculateCriticalStrikeBonuses(skillLevel);
                    scaledBonus.crit_chance = critRatePercent / 100;
                }
                if (skillName === 'iron body') {
                    const { damageReductionPercent } = calculateIronBodyBonuses(skillLevel);
                    scaledBonus.damage_reduction_percent = damageReductionPercent / 100;
                }
                if (skillName === 'mana shield') {
                    const { manaAbsorptionPercent } = calculateManaShieldBonuses(skillLevel);
                    scaledBonus.mana_shield_percent = manaAbsorptionPercent / 100;
                }
                if (skillName === 'iron will') {
                    const { statusResistancePercent } = calculateIronWillBonuses(skillLevel);
                    scaledBonus.status_resistance_percent = statusResistancePercent / 100;
                }
                if (skillName === 'iron fist') {
                    const { unarmedDamagePercent } = calculateIronFistBonuses(skillLevel);
                    scaledBonus.unarmed_damage_percent = unarmedDamagePercent / 100;
                }
                if (skillName === 'shadow step') {
                    const { evasionPercent } = calculateShadowStepBonuses(skillLevel);
                    scaledBonus.boss_evasion = evasionPercent / 100;
                }
                if (skillName === 'fireball') {
                    const { magicDamagePercent } = calculateFireballBonuses(skillLevel);
                    scaledBonus.damage_magic_percent = magicDamagePercent / 100;
                }
                if (skillName === 'curse of agony') {
                    const { currentHpPressurePercent } = calculateCurseOfAgonyBonuses(skillLevel);
                    scaledBonus.curse_pressure_percent = currentHpPressurePercent / 100;
                }
                if (skillName === 'meditation') {
                    const { regenRatePercent } = calculateMeditationBonuses(skillLevel);
                    scaledBonus.regen_rate_percent = regenRatePercent / 100;
                }
                if (skillName === 'focus') {
                    const { manaCostReductionPercent } = calculateFocusBonuses(skillLevel);
                    scaledBonus.mana_cost_reduction = manaCostReductionPercent / 100;
                }
                if (skillName === 'life drain') {
                    const { healingPercent } = calculateLifeDrainBonuses(skillLevel);
                    scaledBonus.life_drain_percent = healingPercent / 100;
                }
                if (skillName === 'taunt') {
                    const { defensePercent } = calculateTauntBonuses(skillLevel);
                    scaledBonus.defense_percent = defensePercent / 100;
                }
                if (skillName === 'quicksilver') {
                    const { attackSpeedPercent } = calculateQuicksilverBonuses(skillLevel);
                    scaledBonus.attack_speed_percent = attackSpeedPercent / 100;
                }
                if (skillName === 'bloodlust') {
                    const { physicalDamagePercent } = calculateBloodlustBonuses(skillLevel);
                    scaledBonus.damage_physical_percent = physicalDamagePercent / 100;
                }
                if (skillName === 'iron skin') {
                    const { armorPercent } = calculateIronSkinBonuses(skillLevel);
                    scaledBonus.armor_percent = armorPercent / 100;
                }
                if (skillName === 'longevity') {
                    const { maxHpPercent } = calculateLongevityBonuses(skillLevel);
                    scaledBonus.hp_percent = maxHpPercent / 100;
                }
                if (skillName === 'holy light') {
                    const { healingReceivedPercent } = calculateHolyLightBonuses(skillLevel);
                    scaledBonus.healing_received_percent = healingReceivedPercent / 100;
                }
                if (skillName === 'purification') {
                    const { statusCleansePercent } = calculatePurificationBonuses(skillLevel);
                    scaledBonus.status_cleanse_percent = statusCleansePercent / 100;
                }
                if (skillName === 'entangling roots') {
                    const { rootChancePercent } = calculateEntanglingRootsBonuses(skillLevel);
                    scaledBonus.boss_root_chance = rootChancePercent / 100;
                }
                if (skillName === 'domain of the monarch') {
                    const { shadowArmyDamagePercent } = calculateDomainOfTheMonarchBonuses(skillLevel);
                    scaledBonus.shadow_army_damage_percent = shadowArmyDamagePercent / 100;
                }

                modifierSources.push(scaledBonus);
            }
        });

        return modifierSources;
    }

    static calculateEffectiveStats(
        baseStats: Record<string, number>,
        modifiers: Record<string, number>,
        statusEffects: any[] = [],
        hunterClass: string = 'NONE',
        crystallizedStats: Record<string, number> = {}
    ): Record<string, number> {
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];
        const classStatMods = classMod.stats || {};

        // Status Effect Multipliers
        let statMultBonus = 0;
        if (Array.isArray(statusEffects)) {
            statusEffects.forEach(eff => {
                if (eff.modifiers?.stat_multiplier !== undefined) {
                    statMultBonus += (eff.modifiers.stat_multiplier - 1);
                }
            });
        }
        const finalStatMult = 1.0 + statMultBonus;

        const calculateFinal = (baseVal: number, statName: string) => {
            const floor = crystallizedStats[statName] || 0;
            const classMult = classStatMods[statName] || 1.0;
            const moddedVal = this.applyStatMod(baseVal + floor, statName, modifiers);
            return Math.floor(moddedVal * finalStatMult * classMult);
        };

        return {
            ...modifiers,
            strength: calculateFinal(baseStats.strength || 0, 'strength'),
            agility: calculateFinal(baseStats.agility || 0, 'agility'),
            intelligence: calculateFinal(baseStats.intelligence || 0, 'intelligence'),
            vitality: calculateFinal(baseStats.vitality || 0, 'vitality'),
            perception: calculateFinal(baseStats.perception || 0, 'perception'),
            charisma: calculateFinal(baseStats.charisma || 0, 'charisma'),
            focus: calculateFinal(baseStats.focus || 0, 'focus'),
            willpower: calculateFinal(baseStats.willpower || 0, 'willpower'),
            luck: calculateFinal(baseStats.luck || 0, 'luck')
        };
    }

    private static applyStatMod(baseValue: number, statName: string, modifiers: Record<string, number>): number {
        const allFlat = modifiers['all_stats_flat'] || 0;
        const allPercent = modifiers['all_stats_percent'] || 0;

        // Check both 'strength' and 'strength_flat'
        const flat = (modifiers[statName] || 0) + (modifiers[`${statName}_flat`] || 0) + allFlat;
        const percent = (modifiers[`${statName}_percent`] || 0) + allPercent;

        return (baseValue + flat) * (1 + percent);
    }

    static getRegenRates(maxHp: number, maxMana: number, hunterClass: string = 'NONE', modifiers: Record<string, number> = {}) {
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];
        const regenMult = classMod.regenMult || 1.0;

        const extraRegen = 1 + (modifiers['regen_rate_percent'] || 0);

        // Base 4 HP/h, 20 MP/h + 5% of max per hour
        const hpPerHour = (4 + (maxHp * 0.05)) * regenMult * extraRegen;
        const manaPerHour = (20 + (maxMana * 0.05)) * regenMult * extraRegen;

        return {
            hpPerHour,
            manaPerHour
        };
    }

    static calculateOfflineRegen(
        lastRegenAt: string,
        currentHp: number,
        maxHp: number,
        currentMana: number,
        maxMana: number,
        hunterClass: string = 'NONE',
        modifiers: Record<string, number> = {}
    ) {
        const last = new Date(lastRegenAt).getTime();
        const now = new Date().getTime();
        const diffHours = (now - last) / (1000 * 60 * 60);

        if (diffHours <= 0) return { newHp: currentHp, newMana: currentMana };

        const { hpPerHour, manaPerHour } = this.getRegenRates(maxHp, maxMana, hunterClass, modifiers);

        const hpRecov = Math.floor(diffHours * hpPerHour);
        const manaRecov = Math.floor(diffHours * manaPerHour);

        return {
            newHp: Math.min(maxHp, currentHp + hpRecov),
            newMana: Math.min(maxMana, currentMana + manaRecov)
        };
    }

    static calculatePlayerDamage(
        stats: Record<string, number>,
        equipment: Array<{ effect: ItemEffect | null | undefined, type: string, slot: string, item?: any }>,
        hunterClass: string = 'NONE',
        modifiers: Record<string, number> = {}
    ) {
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];

        const str = stats.strength || 0;
        const agi = stats.agility || 0;
        const int = stats.intelligence || 0;
        const per = stats.perception || 0;

        const weapon = equipment.find(e => e.slot === 'MAIN_HAND');

        let minDmg = 0;
        let maxDmg = 0;

        // Base Archetype from Class
        const classArchetype = classMod.archetype || 'POWER';
        let isMagic = classArchetype === 'MAGIC';
        let isSpeed = classArchetype === 'SPEED';

        // Weapon can override/refine archetype
        if (weapon) {
            const eff = weapon.effect || {};
            minDmg = eff.damage_min || 0;
            maxDmg = eff.damage_max || 0;

            const itemName = String((weapon as any).item?.name || (weapon as any).item_name || '').toLowerCase();

            if (eff.magic_amp || itemName.includes('staff') || itemName.includes('orb')) {
                isMagic = true;
                isSpeed = false;
            } else if (itemName.includes('dagger') || itemName.includes('rapier')) {
                isSpeed = true;
                isMagic = false;
            }
        } else {
            minDmg = 1;
            maxDmg = 5;
        }

        let damageBonus = 0;

        if (isMagic) {
            const amp = (weapon?.effect?.magic_amp || 0) + 1;
            damageBonus = (int * 1.5);
            minDmg = (minDmg + damageBonus) * amp;
            maxDmg = (maxDmg + damageBonus) * amp;
        } else if (isSpeed) {
            damageBonus = (agi * 0.8) + (str * 0.3);
            minDmg += damageBonus;
            maxDmg += damageBonus;
        } else {
            damageBonus = (str * 1.2) + (agi * 0.2);
            minDmg += damageBonus;
            maxDmg += damageBonus;
        }

        // Apply Class & Global Damage Multipliers
        const classMult = classMod.damageMult || 1.0;

        // Handle damage multiplier (from skills or buffs) safely
        let skillMult = modifiers['damage_multiplier'];
        if (skillMult === undefined || skillMult === 0) {
            skillMult = 1.0;
        }

        const attackPercent = modifiers['attack_percent'] || 0;
        const allDmgPercent = modifiers['all_damage_percent'] || 0;

        let archetypeMod = 0;
        if (isMagic) archetypeMod = modifiers['damage_magic_percent'] || 0;
        else if (isSpeed) archetypeMod = modifiers['damage_ranged_percent'] || 0;
        else archetypeMod = modifiers['damage_physical_percent'] || 0;

        const itemName = String((weapon as any)?.item?.name || (weapon as any)?.item_name || '').toLowerCase();
        const daggerBonus = itemName.includes('dagger')
            ? Math.min(0.50, Math.max(0, modifiers['dagger_damage_percent'] || 0))
            : 0;

        // Global multiplier is Class * Skill * Item Percentages * Title Percentages
        const unarmedBonus = !weapon
            ? Math.min(0.50, Math.max(0, modifiers['unarmed_damage_percent'] || 0))
            : 0;
        const globalMult = classMult * skillMult * (1 + attackPercent) * (1 + allDmgPercent) * (1 + archetypeMod) * (1 + daggerBonus) * (1 + unarmedBonus);

        minDmg *= globalMult;
        maxDmg *= globalMult;

        // Critical Calculation
        const critChanceRaw = (agi + per) / 500;
        const hasStealth = equipment.some(e => e.effect?.stealth === true);
        const stealthBonus = hasStealth ? 0.30 : 0.0;
        const critChance = Math.max(0, Math.min(1, Math.min(0.50, critChanceRaw) + (weapon?.effect?.crit_chance || 0) + stealthBonus + (modifiers['crit_chance'] || 0) + (modifiers['crit_chance_flat'] || 0)));

        // Class Crit Multiplier (Assassin) + Modifiers
        const critMultiplier = 1.5 * (classMod.critMod || 1.0) + (modifiers['crit_damage'] || 0);

        return {
            min: Math.floor(minDmg),
            max: Math.floor(maxDmg),
            critChance: critChance,
            critMultiplier: critMultiplier
        };
    }

    static calculateSecondaryStats(stats: Record<string, number>, modifiers: Record<string, number>, hunterClass: string = 'NONE') {
        const agi = stats.agility || 0;
        const per = stats.perception || 0;

        // 1. Crit Chance (Base from AGI/PER)
        const critChanceRaw = (agi + per) / 500;
        const critChance = Math.min(0.75, critChanceRaw + (modifiers['crit_chance'] || 0) + (modifiers['crit_chance_flat'] || 0));

        // 2. Dodge Chance (Base from AGI)
        const dodgeChanceRaw = (agi / 500);
        const dodgeChance = Math.min(0.50, dodgeChanceRaw + (modifiers['dodge_chance'] || 0));

        // 3. Loot Find (Base from PER)
        const lootFindRaw = (per / 200);
        const lootFind = lootFindRaw + (modifiers['loot_find'] || 0);

        // 4. Crit Multiplier (Base 1.5x)
        const classMod = CLASS_MODIFIERS[hunterClass] || CLASS_MODIFIERS['NONE'];
        const critMultiplier = 1.5 * (classMod.critMod || 1.0) + (modifiers['crit_damage'] || 0);

        return {
            critChance,
            dodgeChance,
            lootFind,
            critMultiplier
        };
    }
}
