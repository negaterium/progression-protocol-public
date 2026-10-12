export type SkillEffectType =
    | 'CRIT_BUFF'
    | 'INSTANT_XP_BUFF'
    | 'STEALTH_MODE'
    | 'DAMAGE_BUFF'
    | 'SHADOW_EXTRACTION'
    | 'INSTANT_HEAL'
    | 'MANA_RESTORATION'
    | string
    | null
    | undefined;

export type SkillRuntimeLabel =
    | 'ACTIVE EFFECT'
    | 'PASSIVE EFFECT'
    | 'STAT IMPRINT'
    | 'LORE ONLY';

/**
 * Classifies the contract a player can rely on when reading a skill card.
 * Flavor text is still useful, but it must not be mistaken for a server-side
 * trigger or an effect that has not been registered yet.
 */
export function getSkillRuntimeLabel(options: {
    hasActiveEffect: boolean;
    hasPassiveEffect: boolean;
    hasStatImprint: boolean;
}): SkillRuntimeLabel {
    if (options.hasActiveEffect) return 'ACTIVE EFFECT';
    if (options.hasPassiveEffect) return 'PASSIVE EFFECT';
    if (options.hasStatImprint) return 'STAT IMPRINT';
    return 'LORE ONLY';
}

function safeRank(level: number | null | undefined): number {
    return Math.max(1, Math.floor(Number(level) || 1));
}

/**
 * Returns the cooldown enforced by activateSkillAction.
 * Sprint is the only current skill whose cooldown changes with rank.
 */
export function calculateSkillCooldownSeconds(
    baseCooldown: number | null | undefined,
    skillLevel: number | null | undefined,
    effectType: SkillEffectType
): number {
    const cooldown = Math.max(0, Math.floor(Number(baseCooldown) || 0));
    if (effectType !== 'INSTANT_XP_BUFF' || cooldown === 0) return cooldown;

    const rank = safeRank(skillLevel);
    return Math.max(60, cooldown - ((rank - 1) * 1800));
}

export function calculateSprintMultiplier(skillLevel: number | null | undefined): number {
    return 1.20 + (safeRank(skillLevel) * 0.10);
}

export function calculateVitalStrikeBonuses(skillLevel: number | null | undefined): {
    critRatePercent: number;
    critDamageMultiplier: number;
} {
    const rank = safeRank(skillLevel);
    return {
        critRatePercent: 20 + (rank * 5),
        critDamageMultiplier: 0.5 + (rank * 0.1),
    };
}

export function calculateStealthBonuses(skillLevel: number | null | undefined): {
    evasionPercent: number;
    critRatePercent: number;
} {
    const rank = safeRank(skillLevel);
    return {
        evasionPercent: 40,
        critRatePercent: 20 + (rank * 5),
    };
}

export function calculateMutilateMultiplier(skillLevel: number | null | undefined): number {
    return 1.20 + (safeRank(skillLevel) * 0.05);
}

export function calculateRecoveryPercent(skillLevel: number | null | undefined): number {
    return Math.min(1, 0.20 * safeRank(skillLevel));
}

export function calculateDominatorsTouchBonuses(skillLevel: number | null | undefined): {
    manaRestorePercent: number;
    armorCrushPercent: number;
    telekineticPressurePercent: number;
} {
    const rank = safeRank(skillLevel);
    return {
        manaRestorePercent: 0.10 + (rank * 0.05),
        armorCrushPercent: 0.20 + (rank * 0.02),
        telekineticPressurePercent: 0.02,
    };
}

export function calculateShadowExtractionSuccessPercent(skillLevel: number | null | undefined): number {
    return Math.min(100, 50 + (safeRank(skillLevel) * 5));
}

/**
 * Critical Strike is the first lore-only passive with a registered combat
 * effect. Its Agility imprint remains separate; this bonus is an additional
 * chance to find a weak point when the damage pipeline rolls a critical hit.
 */
export function calculateCriticalStrikeBonuses(skillLevel: number | null | undefined): {
    critRatePercent: number;
} {
    return {
        critRatePercent: safeRank(skillLevel) * 2,
    };
}

export function calculateDaggerMasteryBonuses(skillLevel: number | null | undefined): {
    daggerDamagePercent: number;
} {
    return {
        daggerDamagePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateIronBodyBonuses(skillLevel: number | null | undefined): {
    damageReductionPercent: number;
} {
    return {
        damageReductionPercent: Math.min(30, safeRank(skillLevel) * 3),
    };
}

export function calculateManaShieldBonuses(skillLevel: number | null | undefined): {
    manaAbsorptionPercent: number;
} {
    return {
        manaAbsorptionPercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateIronWillBonuses(skillLevel: number | null | undefined): {
    statusResistancePercent: number;
} {
    return {
        statusResistancePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateIronFistBonuses(skillLevel: number | null | undefined): {
    unarmedDamagePercent: number;
} {
    return {
        unarmedDamagePercent: Math.min(50, safeRank(skillLevel) * 10),
    };
}

export function calculateShadowStepBonuses(skillLevel: number | null | undefined): {
    evasionPercent: number;
} {
    return {
        evasionPercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateFireballBonuses(skillLevel: number | null | undefined): {
    magicDamagePercent: number;
} {
    return {
        magicDamagePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateCurseOfAgonyBonuses(skillLevel: number | null | undefined): {
    currentHpPressurePercent: number;
} {
    return {
        currentHpPressurePercent: Math.min(5, safeRank(skillLevel) * 0.5),
    };
}

export function calculateMeditationBonuses(skillLevel: number | null | undefined): {
    regenRatePercent: number;
} {
    return {
        regenRatePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateFocusBonuses(skillLevel: number | null | undefined): {
    manaCostReductionPercent: number;
} {
    return {
        manaCostReductionPercent: Math.min(20, safeRank(skillLevel) * 2),
    };
}

export function calculateLifeDrainBonuses(skillLevel: number | null | undefined): {
    healingPercent: number;
} {
    return {
        healingPercent: Math.min(20, safeRank(skillLevel) * 2),
    };
}

export function calculateTauntBonuses(skillLevel: number | null | undefined): {
    defensePercent: number;
} {
    return {
        defensePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateQuicksilverBonuses(skillLevel: number | null | undefined): {
    attackSpeedPercent: number;
} {
    return {
        attackSpeedPercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateBloodlustBonuses(skillLevel: number | null | undefined): {
    physicalDamagePercent: number;
} {
    return {
        physicalDamagePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateIronSkinBonuses(skillLevel: number | null | undefined): {
    armorPercent: number;
} {
    return {
        armorPercent: Math.min(30, safeRank(skillLevel) * 3),
    };
}

export function calculateLongevityBonuses(skillLevel: number | null | undefined): {
    maxHpPercent: number;
} {
    return {
        maxHpPercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateHolyLightBonuses(skillLevel: number | null | undefined): {
    healingReceivedPercent: number;
} {
    return {
        healingReceivedPercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculatePurificationBonuses(skillLevel: number | null | undefined): {
    statusCleansePercent: number;
} {
    return {
        statusCleansePercent: Math.min(100, safeRank(skillLevel) * 10),
    };
}

export function calculateEntanglingRootsBonuses(skillLevel: number | null | undefined): {
    rootChancePercent: number;
} {
    return {
        rootChancePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

export function calculateDomainOfTheMonarchBonuses(skillLevel: number | null | undefined): {
    shadowArmyDamagePercent: number;
} {
    return {
        shadowArmyDamagePercent: Math.min(50, safeRank(skillLevel) * 5),
    };
}

const PURIFIABLE_STATUS_TYPES = new Set([
    'MIASMA', 'EXHAUSTION', 'CURSE', 'POISON', 'LETHARGY',
    'FEAR', 'BURN', 'BLEED', 'STUN', 'FREEZE',
]);

/**
 * Resolve Purification's quest-start saving throw against ordinary status
 * effects. Cosmic or system-level effects are deliberately outside this list.
 */
export function cleansePurifiableStatusEffects<T extends { type?: string }>(
    effects: T[],
    modifiers: Record<string, number> = {},
    roll = Math.random()
): { remainingEffects: T[]; cleansedEffects: T[] } {
    const cleanseChance = Math.min(1, Math.max(0, Number(modifiers['status_cleanse_percent']) || 0));
    const purifiable = effects.filter(effect => PURIFIABLE_STATUS_TYPES.has(String(effect.type || '').toUpperCase()));

    if (purifiable.length === 0 || cleanseChance <= 0 || roll >= cleanseChance) {
        return { remainingEffects: effects, cleansedEffects: [] };
    }

    return {
        remainingEffects: effects.filter(effect => !PURIFIABLE_STATUS_TYPES.has(String(effect.type || '').toUpperCase())),
        cleansedEffects: purifiable,
    };
}

export function applyHealingReceivedBonus(
    baseHealing: number | null | undefined,
    modifiers: Record<string, number> = {}
): number {
    const healingReceivedPercent = Math.min(
        0.50,
        Math.max(0, Number(modifiers['healing_received_percent']) || 0)
    );
    return Math.floor(Math.max(0, Number(baseHealing) || 0) * (1 + healingReceivedPercent));
}

/**
 * Quest mana efficiency is shared by the transaction and its client preview.
 * Focus and explicit mana-reduction modifiers combine, but the existing system
 * never allows a quest to cost less than half its scaled mana price.
 */
export function calculateQuestManaEfficiency(modifiers: Record<string, number> = {}): number {
    const focusBonus = Number(modifiers['focus']) || 0;
    const extraManaReduction = Number(modifiers['mana_cost_reduction']) || 0;
    return Math.max(0.5, 1 - (focusBonus / 100) - extraManaReduction);
}

export function getPassiveSkillEffectSummary(
    skillName: string | null | undefined,
    skillLevel: number | null | undefined
): string | null {
    switch (skillName?.trim().toLowerCase()) {
        case 'dagger mastery': {
            const { daggerDamagePercent } = calculateDaggerMasteryBonuses(skillLevel);
            return `Passive combat effect: +${daggerDamagePercent}% Dagger Damage (50% cap; main-hand daggers only).`;
        }
        case 'critical strike': {
            const { critRatePercent } = calculateCriticalStrikeBonuses(skillLevel);
            return `Passive combat effect: +${critRatePercent}% Critical Rate.`;
        }
        case 'iron body': {
            const { damageReductionPercent } = calculateIronBodyBonuses(skillLevel);
            return `Passive combat effect: +${damageReductionPercent}% Boss Damage Reduction (30% cap).`;
        }
        case 'mana shield': {
            const { manaAbsorptionPercent } = calculateManaShieldBonuses(skillLevel);
            return `Passive combat effect: diverts ${manaAbsorptionPercent}% of incoming Boss Damage to MP (50% cap).`;
        }
        case 'iron will': {
            const { statusResistancePercent } = calculateIronWillBonuses(skillLevel);
            return `Passive combat effect: +${statusResistancePercent}% Boss Status Resistance (50% cap).`;
        }
        case 'iron fist': {
            const { unarmedDamagePercent } = calculateIronFistBonuses(skillLevel);
            return `Passive combat effect: +${unarmedDamagePercent}% Unarmed Damage (50% cap).`;
        }
        case 'shadow step': {
            const { evasionPercent } = calculateShadowStepBonuses(skillLevel);
            return `Passive combat effect: +${evasionPercent}% Boss Evasion (50% cap).`;
        }
        case 'fireball': {
            const { magicDamagePercent } = calculateFireballBonuses(skillLevel);
            return `Passive combat effect: +${magicDamagePercent}% Magic Damage (50% cap).`;
        }
        case 'curse of agony': {
            const { currentHpPressurePercent } = calculateCurseOfAgonyBonuses(skillLevel);
            return `Passive combat effect: adds ${currentHpPressurePercent}% of current Boss HP as curse pressure per attack (5% cap).`;
        }
        case 'meditation': {
            const { regenRatePercent } = calculateMeditationBonuses(skillLevel);
            return `Passive recovery effect: +${regenRatePercent}% HP and MP Regeneration (50% cap).`;
        }
        case 'focus': {
            const { manaCostReductionPercent } = calculateFocusBonuses(skillLevel);
            return `Passive resource effect: -${manaCostReductionPercent}% Quest Mana Cost (20% cap).`;
        }
        case 'life drain': {
            const { healingPercent } = calculateLifeDrainBonuses(skillLevel);
            return `Passive combat effect: restores ${healingPercent}% of direct damage dealt as HP (20% cap).`;
        }
        case 'taunt': {
            const { defensePercent } = calculateTauntBonuses(skillLevel);
            return `Passive combat effect: +${defensePercent}% Defense against Boss attacks (50% cap).`;
        }
        case 'quicksilver': {
            const { attackSpeedPercent } = calculateQuicksilverBonuses(skillLevel);
            return `Passive combat effect: +${attackSpeedPercent}% Attack Speed and second-strike chance (50% cap).`;
        }
        case 'bloodlust': {
            const { physicalDamagePercent } = calculateBloodlustBonuses(skillLevel);
            return `Passive combat effect: +${physicalDamagePercent}% Physical Damage (50% cap).`;
        }
        case 'iron skin': {
            const { armorPercent } = calculateIronSkinBonuses(skillLevel);
            return `Passive combat effect: +${armorPercent}% Armor against Boss attacks (30% cap).`;
        }
        case 'longevity': {
            const { maxHpPercent } = calculateLongevityBonuses(skillLevel);
            return `Passive survival effect: +${maxHpPercent}% Max HP (50% cap).`;
        }
        case 'holy light': {
            const { healingReceivedPercent } = calculateHolyLightBonuses(skillLevel);
            return `Passive recovery effect: +${healingReceivedPercent}% direct Healing Received (50% cap).`;
        }
        case 'purification': {
            const { statusCleansePercent } = calculatePurificationBonuses(skillLevel);
            return `Passive recovery effect: ${statusCleansePercent}% chance at quest start to cleanse ordinary negative statuses (100% cap).`;
        }
        case 'entangling roots': {
            const { rootChancePercent } = calculateEntanglingRootsBonuses(skillLevel);
            return `Passive control effect: ${rootChancePercent}% chance per quest to root a non-cosmic Boss for one round (50% cap).`;
        }
        case 'domain of the monarch': {
            const { shadowArmyDamagePercent } = calculateDomainOfTheMonarchBonuses(skillLevel);
            return `Passive army effect: +${shadowArmyDamagePercent}% Shadow Army Damage for assigned and passive attacks (50% cap).`;
        }
        default:
            return null;
    }
}

/**
 * Human-readable effect text used by the Skills detail panel. These strings are
 * generated from the same values used by the action handlers so the UI cannot
 * drift into describing a different rank formula.
 */
export function getActiveSkillEffectSummary(
    effectType: SkillEffectType,
    skillLevel: number | null | undefined
): string | null {
    switch (effectType) {
        case 'CRIT_BUFF': {
            const { critRatePercent, critDamageMultiplier } = calculateVitalStrikeBonuses(skillLevel);
            return `+${critRatePercent}% Critical Rate and +${critDamageMultiplier.toFixed(1)}x Critical Damage for 5 Quests.`;
        }
        case 'INSTANT_XP_BUFF':
            return `${calculateSprintMultiplier(skillLevel).toFixed(2)}x XP Gain for 5 Quests.`;
        case 'STEALTH_MODE': {
            const { evasionPercent, critRatePercent } = calculateStealthBonuses(skillLevel);
            return `+${evasionPercent}% Boss Evasion and +${critRatePercent}% Critical Rate for 3 Quests.`;
        }
        case 'DAMAGE_BUFF':
            return `${calculateMutilateMultiplier(skillLevel).toFixed(2)}x Global Damage for 3 Quests.`;
        case 'SHADOW_EXTRACTION':
            return `${calculateShadowExtractionSuccessPercent(skillLevel)}% base extraction chance; Necromancers are guaranteed.`;
        case 'INSTANT_HEAL':
            return `Restores ${Math.round(calculateRecoveryPercent(skillLevel) * 100)}% of Max HP instantly.`;
        case 'MANA_RESTORATION': {
            const { manaRestorePercent, armorCrushPercent } = calculateDominatorsTouchBonuses(skillLevel);
            return `Restores ${Math.round(manaRestorePercent * 100)}% Max MP and applies ${Math.round(armorCrushPercent * 100)}% Boss Defense Crush plus 2% current Boss HP pressure for 2 Quests.`;
        }
        default:
            return null;
    }
}

export function getSkillStatScalingSummary(
    statBonus: Record<string, number> | null | undefined,
    skillLevel: number | null | undefined,
    playerLevel: number | null | undefined,
    category: string | null | undefined
): string[] {
    if (!statBonus || Object.keys(statBonus).length === 0) return [];

    const level = Math.max(1, Math.floor(Number(playerLevel) || 1));
    const rank = safeRank(skillLevel);

    return Object.entries(statBonus).map(([stat, value]) => {
        const base = Number(value) || 0;
        if (category === 'ULTIMATE' || stat.toLowerCase() === 'all_stats_flat') {
            const current = Math.floor(base * rank);
            return `+${current} All Stats at rank ${rank} (flat)`;
        }

        const current = Math.floor(base * level * (1 + ((rank - 1) * 0.2)));
        return `+${base} ${stat} per character level; currently +${current} at Level ${level}, Rank ${rank}`;
    });
}
