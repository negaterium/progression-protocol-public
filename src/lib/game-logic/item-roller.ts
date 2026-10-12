/**
 * Item Roller System - D&D Inspired Random Attributes
 * 
 * Generates quality rolls and bonus affixes for dropped items.
 * Consumables are excluded from variance (fixed values).
 * 
 * Quality Ranges by Rank:
 * E: 80-100%, D: 85-105%, C: 85-110%, B: 90-115%, A: 95-120%, S: 100-130%
 */

import { ItemEffect } from '@/lib/types/zod-schemas';

export type RollTier = 'COMMON' | 'SUPERIOR' | 'LEGENDARY' | 'PERFECT' | 'TRANSCENDENT' | 'COSMIC';

export interface RollResult {
    qualityPercent: number;    // 80.00 - 130.00
    rollTier: RollTier;
    bonusAffixes: string[];    // ['of_the_hunter', 'soulbound']
}

export interface BonusAffix {
    id: string;
    name: string;               // Display name
    description: string;
    effect: Partial<ItemEffect>; // Stat modifiers
    allowedSlots?: string[];    // Restrict to specific equipment slots
    minRank?: string;           // Minimum item rank (e.g., 'B')
}

// ============================================
// QUALITY ROLL RANGES
// ============================================

const QUALITY_RANGES: Record<string, { min: number, max: number }> = {
    'E': { min: 80, max: 100 },
    'D': { min: 85, max: 105 },
    'C': { min: 85, max: 110 },
    'B': { min: 90, max: 115 },
    'A': { min: 95, max: 120 },
    'S': { min: 100, max: 130 },
    'COSMIC': { min: 130, max: 160 }, // Exclusive to Cosmic boss drops
};

// ============================================
// ROLL TIER THRESHOLDS
// ============================================

function calculateRollTier(qualityPercent: number): RollTier {
    if (qualityPercent >= 130) return 'COSMIC';       // Cosmic boss drops only
    if (qualityPercent >= 125) return 'TRANSCENDENT'; // Top 1%
    if (qualityPercent >= 115) return 'PERFECT';      // Top 10%
    if (qualityPercent >= 105) return 'LEGENDARY';    // Top 30%
    if (qualityPercent >= 95) return 'SUPERIOR';      // Top 50%
    return 'COMMON';
}

// ============================================
// BONUS AFFIXES (LORE-APPROPRIATE)
// ============================================

export const BONUS_AFFIXES: BonusAffix[] = [
    // === COMBAT AFFIXES ===
    {
        id: 'of_the_hunter',
        name: 'of the Hunter',
        description: 'Forged for those who hunt monsters. Grants bonus XP.',
        effect: { xp_multiplier: 0.05 }, // +5% XP
        minRank: 'D',
    },
    {
        id: 'of_the_berserker',
        name: 'of the Berserker',
        description: 'Blessed with the fury of battle. Increases critical strike chance.',
        effect: { crit_chance: 0.03 }, // +3% Crit
        allowedSlots: ['WEAPON', 'HANDS'],
        minRank: 'C',
    },
    {
        id: 'of_warding',
        name: 'of Warding',
        description: 'Enchanted with protective runes. Boosts defense.',
        effect: { defense_percent: 0.05 }, // +5% Defense
        allowedSlots: ['ARMOR', 'SHIELD', 'OFFHAND'],
        minRank: 'C',
    },
    {
        id: 'of_precision',
        name: 'of Precision',
        description: 'Crafted with surgical accuracy. Ignores enemy armor.',
        effect: { armor_penetration: 10 },
        allowedSlots: ['WEAPON'],
        minRank: 'B',
    },
    {
        id: 'of_the_shadow_monarch',
        name: 'of the Shadow Monarch',
        description: 'Touched by the power of shadows. Amplifies necromantic abilities.',
        effect: { intelligence: 5, magic_amp: 0.10 }, // +5 INT, +10% Magic Amp
        minRank: 'A',
    },

    // === SURVIVAL AFFIXES ===
    {
        id: 'of_vitality',
        name: 'of Vitality',
        description: 'Imbued with life force. Increases maximum HP.',
        effect: { hp_percent: 0.10 }, // +10% HP
        minRank: 'D',
    },
    {
        id: 'of_clarity',
        name: 'of Clarity',
        description: 'Channels focused mana. Increases maximum MP.',
        effect: { mana_percent: 0.10 }, // +10% Mana
        allowedSlots: ['ACCESSORY', 'HELMET'],
        minRank: 'D',
    },
    {
        id: 'of_regeneration',
        name: 'of Regeneration',
        description: 'Blessed with restorative magic. Accelerates mana recovery.',
        effect: { mana_regen: 5 },
        minRank: 'C',
    },

    // === UTILITY AFFIXES ===
    {
        id: 'of_fortune',
        name: 'of Fortune',
        description: 'Favored by fate. Improves loot discovery.',
        effect: { luck: 10 },
        minRank: 'C',
    },
    {
        id: 'of_swiftness',
        name: 'of Swiftness',
        description: 'Lightweight and balanced. Grants agility.',
        effect: { agility: 5 },
        allowedSlots: ['FEET', 'LEGS', 'WEAPON'],
        minRank: 'B',
    },
    {
        id: 'of_the_titan',
        name: 'of the Titan',
        description: 'Forged in the image of giants. Increases raw strength.',
        effect: { strength: 5 },
        allowedSlots: ['WEAPON', 'ARMOR', 'HANDS'],
        minRank: 'B',
    },
    {
        id: 'of_kings',
        name: 'of Kings',
        description: 'Worn by rulers. Enhances charisma and negotiation.',
        effect: { charisma: 10 },
        allowedSlots: ['ACCESSORY', 'HELMET'],
        minRank: 'A',
    },

    // === LEGENDARY AFFIXES (S-Rank Only) ===
    {
        id: 'soulbound',
        name: 'Soulbound',
        description: '[Cannot be sold or traded] All stats increased by 20%. This item is bound to your soul.',
        effect: {
            attack_percent: 0.20,
            defense_percent: 0.20,
            hp_percent: 0.20,
            mana_percent: 0.20,
        },
        minRank: 'S',
    },
    {
        id: 'void_touched',
        name: 'Void-Touched',
        description: 'Corrupted by the energy of the void. Grants true damage strikes.',
        effect: { void_strike: true },
        allowedSlots: ['WEAPON'],
        minRank: 'S',
    },
    {
        id: 'eternal',
        name: 'Eternal',
        description: 'Timeless and indestructible. Grants bonus stats based on level.',
        effect: {
            strength: 3,
            agility: 3,
            intelligence: 3,
            vitality: 3,
            perception: 3,
        },
        minRank: 'S',
    },

    // === COSMIC AFFIXES (COSMIC Tier Only — Post-999 Cosmic Boss Drops) ===
    {
        id: 'of_the_cosmos',
        name: 'of the Cosmos',
        description: 'Infused with the raw energy of creation. All stats increased by 10%.',
        effect: {
            attack_percent: 0.10,
            defense_percent: 0.10,
            hp_percent: 0.10,
            mana_percent: 0.10,
        },
        minRank: 'COSMIC',
    },
    {
        id: 'reality_anchor',
        name: 'Reality Anchor',
        description: 'Tethered to the fabric of existence. Immune to Reality Fracture and Cosmic Dread.',
        effect: {
            cosmic_resist: true,
        },
        minRank: 'COSMIC',
    },
    {
        id: 'entropy_devourer',
        name: 'Entropy Devourer',
        description: 'Consumes the void itself. 50% of Entropy DoT damage is converted to healing.',
        effect: {
            entropy_convert: 0.50,
        },
        minRank: 'COSMIC',
    },
    {
        id: 'void_bound',
        name: 'Void-Bound',
        description: 'Forged in the space between worlds. Deals +30% damage to Cosmic-rank entities.',
        effect: {
            cosmic_damage_bonus: 0.30,
        },
        allowedSlots: ['WEAPON'],
        minRank: 'COSMIC',
    },
    {
        id: 'of_infinite_eyes',
        name: 'of Infinite Eyes',
        description: 'Sees beyond the veil of reality. Luck increased by 200 for loot rolls.',
        effect: {
            luck: 200,
        },
        allowedSlots: ['ACCESSORY', 'HELMET'],
        minRank: 'COSMIC',
    },
];

// ============================================
// CORE ROLLING FUNCTIONS
// ============================================

/**
 * Rolls item quality based on rank and luck bonus.
 * Boss drops get +10% quality floor.
 * Cosmic boss drops use the COSMIC quality range (130-160%).
 */
export function rollItemQuality(
    itemRank: string,
    luckBonus: number = 0,
    isBossDrop: boolean = false,
    isCosmicDrop: boolean = false
): RollResult {
    // Cosmic drops always use the COSMIC quality range
    const rangeKey = isCosmicDrop ? 'COSMIC' : (QUALITY_RANGES[itemRank] ? itemRank : 'E');
    const range = QUALITY_RANGES[rangeKey];

    // Base roll within rank range
    let min = range.min;
    let max = range.max;

    // Boss drop bonus: +10% to min (better floor) — only for non-cosmic
    if (isBossDrop && !isCosmicDrop) {
        min = Math.min(min + 10, max);
    }

    // Luck bonus: +0.1% per luck point (max +10% to range)
    const luckMod = Math.min(luckBonus * 0.1, 10);
    max += luckMod;

    // Roll quality
    let qualityPercent = min + Math.random() * (max - min);

    if (!isCosmicDrop) {
        // Standard special roll chances
        const roll = Math.random();

        // 1% chance: TRANSCENDENT (125-130%)
        if (roll < 0.01) {
            qualityPercent = Math.max(qualityPercent, 125 + Math.random() * 5);
        }
        // 10% chance: PERFECT (115-125%)
        else if (roll < 0.11) {
            qualityPercent = Math.max(qualityPercent, 115 + Math.random() * 10);
        }
    }

    // Round to 2 decimals
    qualityPercent = Math.round(qualityPercent * 100) / 100;

    // Determine tier
    const rollTier = calculateRollTier(qualityPercent);

    // Determine bonus affixes
    const bonusAffixes: string[] = [];

    if (isCosmicDrop) {
        // COSMIC drops: always 2 cosmic affixes + 1 standard affix
        bonusAffixes.push(...selectRandomAffixes('COSMIC', 2));
        bonusAffixes.push(...selectRandomAffixes('S', 1, bonusAffixes));
    } else {
        // TRANSCENDENT: 2 affixes guaranteed
        if (rollTier === 'TRANSCENDENT') {
            bonusAffixes.push(...selectRandomAffixes(itemRank, 2));
        }
        // PERFECT: 1 affix guaranteed + 30% for 2nd
        else if (rollTier === 'PERFECT') {
            bonusAffixes.push(...selectRandomAffixes(itemRank, 1));
            if (Math.random() < 0.30) {
                bonusAffixes.push(...selectRandomAffixes(itemRank, 1, bonusAffixes));
            }
        }
        // LEGENDARY: 20% chance for 1 affix
        else if (rollTier === 'LEGENDARY' && Math.random() < 0.20) {
            bonusAffixes.push(...selectRandomAffixes(itemRank, 1));
        }
    }

    return {
        qualityPercent,
        rollTier,
        bonusAffixes,
    };
}

/**
 * Selects random bonus affixes that are valid for the item.
 */
function selectRandomAffixes(
    itemRank: string,
    count: number,
    excludeIds: string[] = []
): string[] {
    // Filter affixes by rank requirement
    const rankValue = (r: string) => ['E', 'D', 'C', 'B', 'A', 'S'].indexOf(r);
    const validAffixes = BONUS_AFFIXES.filter(affix => {
        if (excludeIds.includes(affix.id)) return false;
        if (!affix.minRank) return true;
        return rankValue(itemRank) >= rankValue(affix.minRank);
    });

    if (validAffixes.length === 0) return [];

    // Randomly select
    const selected: string[] = [];
    const pool = [...validAffixes];

    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool[idx].id);
        pool.splice(idx, 1); // Remove to avoid duplicates
    }

    return selected;
}

/**
 * Applies quality roll to item effect stats.
 * Only affects numeric stats that scale (not booleans).
 */
export function applyQualityToEffect(
    baseEffect: ItemEffect,
    roll: RollResult,
    itemType: string,
    itemSlot: string
): ItemEffect {
    // Consumables are NOT affected by quality
    if (itemType === 'CONSUMABLE' || itemType === 'KEY') {
        return baseEffect;
    }

    const multiplier = roll.qualityPercent / 100;
    const scaledEffect: ItemEffect = { ...baseEffect };

    // Scalable numeric stats
    const scalableStats = [
        'damage_min', 'damage_max', 'attack', 'defense',
        'hp_flat', 'mana_flat', 'armor_penetration',
        'strength', 'agility', 'intelligence', 'vitality', 'perception',
        'charisma', 'focus', 'willpower', 'luck',
    ];

    scalableStats.forEach(stat => {
        const value = (baseEffect as any)[stat];
        if (typeof value === 'number' && value > 0) {
            // Use Math.round() to preserve both positive AND negative variance
            // Math.floor() was nullifying 102% on low stats (18 * 1.02 = 18.36 -> 18)
            (scaledEffect as any)[stat] = Math.round(value * multiplier);
        }
    });

    // Apply bonus affixes
    roll.bonusAffixes.forEach(affixId => {
        const affix = BONUS_AFFIXES.find(a => a.id === affixId);
        if (!affix) return;

        // Validate slot restrictions
        if (affix.allowedSlots && !affix.allowedSlots.includes(itemSlot)) {
            return; // Invalid slot, skip
        }

        // Merge affix effects
        Object.entries(affix.effect).forEach(([key, val]) => {
            const currentVal = (scaledEffect as any)[key];

            // Boolean flags: set to true
            if (typeof val === 'boolean') {
                (scaledEffect as any)[key] = val;
            }
            // Numbers: add or multiply
            else if (typeof val === 'number') {
                if (currentVal !== undefined) {
                    (scaledEffect as any)[key] = currentVal + val;
                } else {
                    (scaledEffect as any)[key] = val;
                }
            }
        });
    });

    return scaledEffect;
}

/**
 * Gets a human-readable quality description.
 */
export function getQualityDescription(tier: RollTier, percent: number): string {
    const descriptions: Record<RollTier, string[]> = {
        'COMMON': ['Worn', 'Ordinary', 'Standard'],
        'SUPERIOR': ['Fine', 'Quality', 'Enhanced'],
        'LEGENDARY': ['Masterwork', 'Heroic', 'Exceptional'],
        'PERFECT': ['Legendary', 'Mythical', 'Exalted'],
        'TRANSCENDENT': ['Transcendent', 'Divine', 'Absolute'],
        'COSMIC': ['Cosmic', 'Primordial', 'Beyond'],
    };

    const options = descriptions[tier];
    if (percent >= 150) return options[2];
    if (percent >= 140) return options[1];
    if (percent >= 125) return options[0];
    if (percent >= 110) return options[1];
    return options[0];
}

/**
 * Gets the display color for a roll tier.
 */
export function getRollTierColor(tier: RollTier): string {
    const colors: Record<RollTier, string> = {
        'COMMON': 'text-gray-400',
        'SUPERIOR': 'text-blue-400',
        'LEGENDARY': 'text-purple-400',
        'PERFECT': 'text-yellow-400',
        'TRANSCENDENT': 'text-red-400',
        'COSMIC': 'text-cyan-300',  // Ethereal cyan for cosmic items
    };
    return colors[tier];
}

/**
 * Gets affix display name with description.
 */
export function getAffixDisplay(affixId: string): { name: string, description: string } | null {
    const affix = BONUS_AFFIXES.find(a => a.id === affixId);
    if (!affix) return null;
    return { name: affix.name, description: affix.description };
}
