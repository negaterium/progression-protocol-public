
import { BossAbilityManager } from "./boss-ability-manager";

export interface IntelMetadata {
    title: string;
    description: string;
    stats?: string[];
    flavor?: string;
}

export const RESISTANCE_METADATA: Record<string, IntelMetadata> = {
    'FIRE': {
        title: 'Fire Resistance',
        description: 'Hardened against heat and combustion. Drastically reduces fire damage.',
        stats: ['Effect: 50% Damage Reduction (0.5x)', 'Classification: Elemental Resistance']
    },
    'ICE': {
        title: 'Ice Resistance',
        description: 'Deep-freeze insulation. Mitigates frost spells and freezing effects.',
        stats: ['Effect: 50% Damage Reduction (0.5x)', 'Classification: Elemental Resistance']
    },
    'DARKNESS': {
        title: 'Darkness Resistance',
        description: 'Shadow-attuned biology. Absorbs necrotic and void energy.',
        stats: ['Effect: 50% Damage Reduction (0.5x)', 'Classification: Elemental Resistance']
    },
    'PHYSICAL': {
        title: 'Physical Resistance',
        description: 'Reinforced skeletal structure or exo-suit. High baseline mitigation.',
        stats: ['Effect: Rank-Based Multiplier', 'Classification: Armor Plating']
    },
    'MAGIC': {
        title: 'Magic Resistance',
        description: 'Arcane-dampening field. Diffuses pure magical energy.',
        stats: ['Effect: 50% Damage Reduction (0.5x)', 'Classification: Spell Shield']
    },
    'POISON': {
        title: 'Poison Resistance',
        description: 'Advanced toxin filtration system. Immune to venomous status effects.',
        stats: ['Effect: Immunity to DoT Effects', 'Classification: Toxin Buffer']
    },
    'LIGHTNING': {
        title: 'Lightning Resistance',
        description: 'Grounded electrical conductive channels. Prevents paralysis.',
        stats: ['Effect: 50% Damage Reduction (0.5x)', 'Classification: Conductive Grounding']
    },
    'COLD': {
        title: 'Cold Resistance',
        description: 'Cryo-stable physiology. Prevents slowing from sub-zero effects.',
        stats: ['Effect: 50% Damage Reduction (0.5x)', 'Classification: Thermal Homeostasis']
    },
    'TIME_SLOW': {
        title: 'Temporal Anchor',
        description: 'Immunity to time-altering effects and speed reduction debuffs.',
        stats: ['Effect: Full Immunity to Time-Slow', 'Classification: Chrono-Stability']
    },
    'DEATH': {
        title: 'Death Immunity',
        description: 'Transcends mortality. Cannot be executed or insta-killed.',
        stats: ['Effect: Full Immunity to Executions', 'Classification: Soul-Bound']
    },
    'REALITY_WARP': {
        title: 'Reality Anchor',
        description: 'Resistance to distortion, confusion, and spatial manipulation.',
        stats: ['Effect: Full Immunity to Reality Distortion', 'Classification: Reality Stability']
    }
};

/**
 * Hydrates ability tooltip info by running the ability through the BossAbilityManager logic
 * to extract its actual mechanical multipliers and status effects.
 */
export function getAbilityIntel(abilityName: string, rank: string): IntelMetadata {
    const mech = BossAbilityManager.parseAbility(abilityName, rank);

    const stats: string[] = [];
    stats.push(`Damage: ${mech.damageMult.toFixed(1)}x`);

    if (mech.isUltimate) stats.push('Classification: ULTIMATE');
    if (mech.statusEffect) {
        stats.push(`Effect: ${mech.statusEffect.name}`);
        stats.push(`Duration: ${mech.statusEffect.duration} turns`);
        if (mech.statusEffect.damagePercent) {
            stats.push(`DoT: ${Math.round(mech.statusEffect.damagePercent * 100)}% Max HP`);
        }
    }

    return {
        title: abilityName.toUpperCase(),
        description: mech.statusEffect?.description || mech.description || 'A dangerous combat move.',
        stats,
        flavor: 'System Analysis Complete.'
    };
}

export function getResistanceIntel(resName: string): IntelMetadata {
    const cleanName = resName.split('(')[0].trim().toUpperCase();

    // Check if it's explicitly a weakness (usually used in boss.intel.weakness)
    // If the input matches a resistance but we're in a "Weakness" context, we might want to override.
    // However, the current UI mostly passes the element name.

    const base = RESISTANCE_METADATA[cleanName];
    if (base) return base;

    // Fallback for elements not explicitly in mapping but found in game logic
    return {
        title: `${resName.charAt(0).toUpperCase()}${resName.slice(1).toLowerCase()} Property`,
        description: 'Standard technical property for this entity.',
        stats: ['Effect: 50% Damage Variance', 'Classification: System Intel']
    };
}

/**
 * Specifically for weaknesses, which deal BONUS damage
 */
export function getWeaknessIntel(element: string): IntelMetadata {
    const cleanName = element.toUpperCase();
    return {
        title: `${cleanName} VULNERABILITY`,
        description: `This entity is critically weak to ${cleanName.toLowerCase()} energy. Attacks of this element deal massive bonus damage.`,
        stats: ['Effect: +50% Damage Taken (1.5x)', 'Classification: Critical Weakness'],
        flavor: 'Vulnerability detected. Overwrite base mitigation?'
    };
}
