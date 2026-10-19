import { StatsManager } from "@/lib/stats-manager";
import { applyHealingReceivedBonus } from "@/lib/system/skill-effects";
import { calculateBossDamage, rankValue } from "@/lib/system/formula";
import { BOSS_SCALING_CAPS, BOSS_RANK_LEVEL, BOSS_BASE_ATK, BOSS_DEF, QUEST_RANK_MULT } from "@/lib/system/rank-constants";
import { BossAbilityManager, StatusEffect } from "@/lib/game-logic/boss-ability-manager";
import { CombatMechanics } from "@/lib/game-logic/combat-mechanics";
import { gameDb as db } from "@/lib/server/game-db";

export interface BossCombatInput {
    userId: string;
    questId: string;
    questDifficulty: string;
    activeEncounter: {
        id: string;
        boss_id: string;
        boss_name: string;
        current_hp: number;
        max_hp: number;
        intel: any;
        boss_rank: string;
        damage_type: string;
    };
    rawStats: {
        strength: number;
        agility: number;
        intelligence: number;
        perception: number;
        vitality: number;
        charisma: number;
        focus: number;
        willpower: number;
        luck: number;
    };
    /** Effective stats calculated by the server context, including passive skill imprints. */
    effectiveStats?: Record<string, number>;
    /** Scaled skill-only modifiers, kept separate from gear and active effects. */
    skillModifiers?: Record<string, number>;
    equipmentList: Array<{ effect: any; type: string; slot: string; item_name?: string }>;
    equipment: any[];
    hunterClass: string;
    hunterLevel: number;
    hunterRank: string;
    shadowInfantryCount: number;
    shadowStorageLimit: number;
    currentPlayerMana?: number;
    statusEffects: StatusEffect[];
    titleModifiers: Record<string, unknown>[];
    activeEffects: StatusEffect[];
    isStunned: boolean;
    maxPlayerHp: number;
}

export interface BossCombatResult {
    currentHp: number;
    maxHp: number;
    damageDealt: number;
    isCrit: boolean;
    doubleStrike: boolean;
    stealthActive: boolean;
    isArmySiege: boolean;
    summonDamage: number;
    armyCapacityRatio: number;
    playerDamage?: number;
    playerManaDamage?: number;
    playerHealing?: number;
    manaShieldShattered?: boolean;
    statusResisted?: boolean;
    bossRooted?: boolean;
    evaded?: boolean;
    damageType?: string;
    mitigatedPercent?: number;
    abilityName?: string;
    abilityDescription?: string;
    statusApplied?: any;
    victory?: boolean;
    rewards?: any;
    updatedStatusEffects?: StatusEffect[];
}

/** Optional evaluator for offline experiments. Gameplay callers use the default rules. */
export type BossOutgoingDamageResolver = (damage: {
    uncappedDirect: number;
    summon: number;
    levelMultiplier: number;
    maxHp: number;
    difficulty: string;
}) => { direct: number; summon: number };



const LORE_ATK_OVERRIDES: Array<{ match: string; atk: number }> = [
    { match: 'Igris', atk: 2500 },
    { match: 'Ant King', atk: 5000 },
    { match: 'Beru', atk: 5000 },
    { match: 'Kamish', atk: 7000 },
    { match: 'Ashborn', atk: 10000 },
    { match: 'Antares', atk: 12000 },
];

/**
 * Calculates one round of boss combat: player → boss damage, then boss → player damage.
 * All DB writes are handled by the caller. This function only reads (for S-rank min damage check)
 * and computes — keeping the logic pure and testable.
 */
export async function calculateBossCombatRound(
    input: BossCombatInput,
    resolveOutgoingDamage?: BossOutgoingDamageResolver
): Promise<BossCombatResult> {
    const {
        userId, questId, questDifficulty, activeEncounter,
        rawStats, equipmentList, equipment, hunterClass,
        hunterLevel, hunterRank, shadowInfantryCount, shadowStorageLimit,
        currentPlayerMana,
        activeEffects, isStunned, maxPlayerHp, titleModifiers, skillModifiers
    } = input;

    const bossRank = activeEncounter.boss_rank;
    const modifierSources: Record<string, unknown>[] = [
        ...equipmentList.map(e => e.effect).filter(Boolean),
        skillModifiers || {},
        ...activeEffects.map(e => (e as any).modifiers || {}),
        ...titleModifiers,
    ];
    const modifiers = StatsManager.aggregateModifiers(modifierSources);
    const skillEvasion = Math.max(0, Number(modifiers['boss_evasion']) || 0);

    // --- PLAYER → BOSS DAMAGE ---
    const effStats = input.effectiveStats || StatsManager.calculateEffectiveStats(
        rawStats,
        StatsManager.aggregateModifiers(equipmentList.map(item => item.effect).filter(Boolean)),
        activeEffects,
        hunterClass
    );
    const dmgProfile = StatsManager.calculatePlayerDamage(effStats, equipmentList, hunterClass, modifiers);
    const range = dmgProfile.max - dmgProfile.min;
    let baseDamage = dmgProfile.min + Math.floor(Math.random() * (range + 1));

    const equipmentAttackSpeed = equipment.reduce((max: number, e: any) => Math.max(max, e.attack_speed || 1.0), 1.0);
    const attackSpeedPercent = Math.min(0.50, Math.max(0, Number(modifiers['attack_speed_percent']) || 0));
    const atkSpeed = equipmentAttackSpeed * (1 + attackSpeedPercent);
    const doubleStrike = atkSpeed > 1.0 && Math.random() < (atkSpeed - 1.0);
    if (doubleStrike) baseDamage *= 2;

    const isCrit = Math.random() < dmgProfile.critChance;
    if (isCrit) baseDamage = Math.floor(baseDamage * dmgProfile.critMultiplier);

    // Elemental
    const bossIntel = activeEncounter.intel as any || {};
    const bossWeakness = bossIntel.weakness || "";
    const bossResistances: string[] = bossIntel.resistances || [];
    let elementMult = 1.0;
    equipment.forEach((e: any) => {
        if (!e.element) return;
        if (bossWeakness.toUpperCase() === e.element.toUpperCase()) elementMult *= 1.5;
        if (bossResistances.some((r: string) => r.toUpperCase() === e.element.toUpperCase())) elementMult *= 0.5;
    });

    // Armor
    let armorPen = equipment.reduce((sum: number, e: any) => sum + (e.armor_penetration || 0), 0);
    armorPen += ((modifiers['pen_physical_percent'] as number || 0)) * 100;
    const rawDef = BOSS_DEF[bossRank] || 0;
    const domArmorCrush = (modifiers['armor_crush'] as number) || 0;
    const crushedDef = Math.floor(rawDef * (1 - domArmorCrush));
    const effectiveDef = Math.max(0, crushedDef - armorPen);
    const mitigationFactor = 100 / (100 + effectiveDef);
    let actualDealt = Math.max(1, Math.floor(baseDamage * elementMult * mitigationFactor));

    // Modifiers
    const damageVsDragon = (modifiers['damage_vs_dragon_percent'] as number) || 0;
    if (damageVsDragon > 0 && (activeEncounter.boss_name.toLowerCase().includes('kamish') || activeEncounter.boss_name.toLowerCase().includes('dragon'))) {
        actualDealt = Math.floor(actualDealt * (1 + damageVsDragon));
    }
    const domCrushPercent = (modifiers['telekinetic_pressure'] as number) || 0;
    if (domCrushPercent > 0) {
        actualDealt += Math.floor(activeEncounter.current_hp * domCrushPercent);
    }
    const cursePressurePercent = Math.min(
        0.05,
        Math.max(0, Number(modifiers['curse_pressure_percent']) || 0)
    );
    if (cursePressurePercent > 0) {
        actualDealt += Math.floor(activeEncounter.current_hp * cursePressurePercent);
    }
    if (equipment.some((e: any) => e.void_strike) && Math.random() < 0.05) {
        actualDealt += Math.floor(activeEncounter.max_hp * 0.10);
    }
    if (isStunned) actualDealt = 0;

    // Quest rank multiplier
    let rankMultiplier = QUEST_RANK_MULT[questDifficulty] || 1.0;

    // Hunter authority bonus
    const playerRankValue = rankValue(hunterRank);
    if (playerRankValue >= 4 && ['E', 'D', 'C'].includes(questDifficulty)) rankMultiplier *= 1.5;
    else if (playerRankValue >= 3 && ['E', 'D'].includes(questDifficulty)) rankMultiplier *= 1.2;

    // Level gap
    const bossLevelEstimate = BOSS_RANK_LEVEL[bossRank] || 10;
    const levelGap = hunterLevel - bossLevelEstimate;
    let levelMult = 1.0;
    if (levelGap > 0) {
        let effectiveGap = levelGap;
        if (bossRank === 'S') effectiveGap = Math.min(levelGap, 50);
        else if (bossRank === 'S+') effectiveGap = Math.min(levelGap, 25);
        else if (bossRank === 'XX') effectiveGap = Math.min(levelGap, 10);
        else if (bossRank === 'COSMIC') effectiveGap = 0;
        levelMult = 1 + (effectiveGap * 0.25);
    }

    actualDealt = Math.floor(actualDealt * rankMultiplier * levelMult);
    const uncappedDirect = actualDealt;

    // Damage cap
    const LOSS_LIMIT: Record<string, number> = {
        'S': 0.50, 'S+': 0.50, 'XX': 0.50, 'COSMIC': 0.10
    };
    let lossLimit = LOSS_LIMIT[bossRank] || 0.20;
    if (levelGap >= 50 && !['S', 'S+', 'XX', 'COSMIC'].includes(bossRank)) lossLimit = 1.0;
    const maxAllowedDamage = Math.floor(activeEncounter.max_hp * lossLimit);
    if (actualDealt > maxAllowedDamage && !equipment.some((e: any) => e.void_strike)) {
        actualDealt = maxAllowedDamage;
    }

    // Life Drain heals from the player's direct attack after encounter scaling
    // and safety caps, before any separate shadow-army damage is added.
    let directDamageDealt = actualDealt;
    const lifeDrainPercent = Math.min(
        0.20,
        Math.max(0, Number(modifiers['life_drain_percent']) || 0)
    );
    let playerHealing = applyHealingReceivedBonus(directDamageDealt * lifeDrainPercent, modifiers);

    // Shadow army damage
    let summonDamage = 0;
    let isArmySiege = false;
    let assignedCount = 0;
    let armyCapacityRatio = 0;
    const shadowArmyDamagePercent = Math.min(
        0.50,
        Math.max(0, Number(modifiers['shadow_army_damage_percent']) || 0)
    );
    if (hunterClass.toLowerCase() === 'necromancer') {
        const assignment = await db.queryOne<{ shadow_count: number }>(
            "SELECT shadow_count FROM shadow_assignments WHERE user_id = $1 AND quest_id = $2 AND expires_at > NOW()",
            [userId, questId]
        );
        const storageLimit = shadowStorageLimit || (200 + (hunterLevel * 10));
        armyCapacityRatio = Math.min(1.0, shadowInfantryCount / storageLimit);

        if (assignment) {
            isArmySiege = true;
            assignedCount = assignment.shadow_count;
            const assignmentRatio = Math.min(1.0, assignedCount / storageLimit);
            const siegeLevelMult = Math.min(levelMult, 2.5);
            summonDamage = Math.floor(activeEncounter.max_hp * 0.10 * assignmentRatio * siegeLevelMult);
        } else {
            const passiveLevelMult = Math.min(levelMult, 1.5);
            summonDamage = Math.floor(activeEncounter.max_hp * 0.008 * armyCapacityRatio * passiveLevelMult);
        }
        summonDamage = Math.floor(summonDamage * (1 + shadowArmyDamagePercent));
        actualDealt += summonDamage;
    }

    if (resolveOutgoingDamage) {
        const resolved = resolveOutgoingDamage({ uncappedDirect, summon: summonDamage, levelMultiplier: levelMult,
            maxHp: activeEncounter.max_hp, difficulty: questDifficulty });
        if (![resolved.direct, resolved.summon].every(value => Number.isFinite(value) && value >= 0)) {
            throw new Error('Invalid outgoing combat evaluation');
        }
        directDamageDealt = Math.floor(resolved.direct);
        summonDamage = Math.floor(resolved.summon);
        actualDealt = directDamageDealt + summonDamage;
        playerHealing = applyHealingReceivedBonus(directDamageDealt * lifeDrainPercent, modifiers);
    }

    const newBossHp = Math.max(0, activeEncounter.current_hp - actualDealt);
    const cleanBossRank = bossRank.replace('-RANK', '').trim().toUpperCase();
    const rootChance = Math.min(
        0.50,
        Math.max(0, Number(modifiers['boss_root_chance']) || 0)
    );
    const bossRooted = newBossHp > 0
        && !isStunned
        && cleanBossRank !== 'COSMIC'
        && rootChance > 0
        && Math.random() < rootChance;

    const result: BossCombatResult = {
        currentHp: newBossHp,
        maxHp: activeEncounter.max_hp,
        damageDealt: actualDealt,
        isCrit,
        doubleStrike,
        stealthActive: equipment.some((e: any) => e.stealth === true) || skillEvasion > 0,
        isArmySiege,
        summonDamage,
        armyCapacityRatio,
        playerHealing,
        bossRooted,
    };

    // --- BOSS → PLAYER DAMAGE (only if boss still alive) ---
    if (newBossHp > 0 && !bossRooted) {
        let baseAtk = BOSS_BASE_ATK[bossRank] || 100;

        // Lore overrides
        for (const override of LORE_ATK_OVERRIDES) {
            if (activeEncounter.boss_name.includes(override.match)) {
                baseAtk = override.atk;
                break;
            }
        }

        // --- BOSS ATTACK SCALING ---
        // Boss damage scales dynamically with player level matching the boss max HP scaling logic.
        const linearMult = 1 + (hunterLevel / 20);
        const cap = BOSS_SCALING_CAPS[cleanBossRank] || 50;
        let attackMult = Math.min(linearMult, cap);

        // Double boss attack if player is post-cap (Level 999+) and boss is not COSMIC
        if (hunterLevel >= 999 && cleanBossRank !== 'COSMIC') {
            attackMult = attackMult * 2;
        }

        baseAtk = Math.floor(baseAtk * attackMult);

        const updatedEffects = [...activeEffects];
        let abilityUsed: any = null;
        if (BossAbilityManager.shouldTriggerAbility(bossRank)) {
            const abilities = activeEncounter.intel?.abilities || [];
            const pickedAbility = BossAbilityManager.selectAbility(abilities);
            if (pickedAbility) {
                abilityUsed = BossAbilityManager.parseAbility(pickedAbility, bossRank);
                baseAtk = Math.floor(baseAtk * abilityUsed.damageMult);
                const statusResistancePercent = Math.min(
                    0.50,
                    Math.max(0, Number(modifiers['status_resistance_percent']) || 0)
                );
                const statusIsUnresistable = abilityUsed.statusEffect?.type === 'REALITY_FRACTURE';
                const statusResisted = Boolean(
                    abilityUsed.statusEffect
                    && !statusIsUnresistable
                    && statusResistancePercent > 0
                    && Math.random() < statusResistancePercent
                );
                if (statusResisted) {
                    result.statusResisted = true;
                } else if (abilityUsed.statusEffect) {
                    updatedEffects.push(abilityUsed.statusEffect);
                    result.updatedStatusEffects = updatedEffects;
                }
            }
        }

        // Player defense
        const defenseStats = input.effectiveStats || effStats;
        let totalDefense = StatsManager.calculateDefense(defenseStats.vitality, modifiers, hunterClass);
        if (bossRank === 'S') totalDefense = Math.floor(totalDefense * 0.70);
        if (bossRank === 'S+' || bossRank === 'XX') totalDefense = Math.floor(totalDefense * 0.50);
        if (abilityUsed?.isUltimate) totalDefense = Math.floor(totalDefense * 0.50);

        const variance = (Math.random() * 0.4) + 0.8;
        let finalBossDmg = calculateBossDamage(baseAtk, totalDefense, variance);

        // S-rank guaranteed minimum
        if (['S', 'S+', 'XX', 'COSMIC'].includes(bossRank)) {
            const baseMin = bossRank === 'COSMIC' ? 0.10 : 0.05;
            const ultMin = bossRank === 'COSMIC' ? 0.25 : 0.15;
            const minPercent = abilityUsed?.isUltimate ? ultMin : baseMin;
            const minDmg = Math.floor(maxPlayerHp * minPercent);
            if (finalBossDmg < minDmg) finalBossDmg = minDmg;
        }

        const elementalResult = CombatMechanics.calculateElementalMitigation(
            finalBossDmg,
            activeEncounter.damage_type || 'PHYSICAL',
            equipmentList
        );
        finalBossDmg = elementalResult.finalDamage;

        const damageCap = Math.floor(maxPlayerHp * 0.25);
        if (finalBossDmg > damageCap) finalBossDmg = damageCap;

        // Passive survival modules and defensive gear share one bounded
        // reduction contract. Apply it after the safety cap so a defensive
        // skill still reduces a capped boss strike. Keep the cap below total
        // immunity so boss encounters remain meaningful at every rank.
        const damageReductionPercent = Math.min(
            0.75,
            Math.max(0, Number(modifiers['damage_reduction_percent']) || 0)
        );
        finalBossDmg = Math.max(1, Math.floor(finalBossDmg * (1 - damageReductionPercent)));

        const manaShieldPercent = Math.min(
            0.50,
            Math.max(0, Number(modifiers['mana_shield_percent']) || 0)
        );
        const requestedManaAbsorption = Math.floor(finalBossDmg * manaShieldPercent);
        const availableMana = Math.max(0, Math.floor(Number(currentPlayerMana) || 0));
        const playerManaDamage = Math.min(requestedManaAbsorption, availableMana);
        const playerDamageAfterShield = finalBossDmg - playerManaDamage;

        // Evasion
        const hasEquipmentStealth = equipment.some((e: any) => e.stealth === true);
        const hasHover = equipment.some((e: any) => e.hover);
        let evasionChance = skillEvasion;
        if (hasEquipmentStealth) evasionChance += 0.40;
        if (hasHover) evasionChance += 0.15;
        evasionChance = Math.min(1, evasionChance);
        const didEvade = evasionChance > 0 && Math.random() < evasionChance;

        result.playerDamage = didEvade ? 0 : playerDamageAfterShield;
        result.playerManaDamage = didEvade ? 0 : playerManaDamage;
        result.manaShieldShattered = !didEvade && requestedManaAbsorption > availableMana && manaShieldPercent > 0;
        result.evaded = didEvade;
        result.damageType = activeEncounter.damage_type || 'PHYSICAL';
        result.mitigatedPercent = (1 - ((1 - (elementalResult.mitigationPercent / 100)) * (1 - damageReductionPercent))) * 100;
        if (abilityUsed) {
            result.abilityName = abilityUsed.abilityName;
            result.abilityDescription = abilityUsed.description;
            result.statusApplied = result.statusResisted ? undefined : abilityUsed.statusEffect;
        }
    }

    return result;
}
