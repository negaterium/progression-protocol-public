import { z } from 'zod';

export const ItemEffectSchema = z.object({
    heal_hp: z.number().optional(),
    heal_hp_percent: z.number().optional(),
    heal_mana: z.number().optional(),
    heal_mana_percent: z.number().optional(),
    cure_status: z.boolean().optional(),
    cure_disease: z.boolean().optional(),
    strength: z.number().optional(),
    agility: z.number().optional(),
    intelligence: z.number().optional(),
    vitality: z.number().optional(),
    perception: z.number().optional(),
    xp: z.number().optional(),
    unlocks_dungeon: z.string().optional(),
    level_required: z.number().optional(),
    hp_flat: z.number().optional(),
    hp_percent: z.number().optional(),
    mana_flat: z.number().optional(),
    mana_percent: z.number().optional(),

    // Utility Stats
    charisma: z.number().optional(),
    focus: z.number().optional(),
    willpower: z.number().optional(),
    luck: z.number().optional(),

    // Combat Stats
    damage_min: z.number().optional(),
    damage_max: z.number().optional(),
    magic_amp: z.number().optional(), // multiplier (e.g. 0.5 for 50%)
    crit_chance: z.number().optional(),
    stealth: z.boolean().optional(),
    element: z.string().optional(),
    xp_multiplier: z.number().optional(),
    xp_boost_int: z.number().optional(),
    gold_bonus: z.number().optional(),
    armor_penetration: z.number().optional(),
    attack_speed: z.number().optional(),
    mana_regen: z.number().optional(),
    void_strike: z.boolean().optional(),
    true_sight: z.boolean().optional(),
    hover: z.boolean().optional(),
    necromancy: z.boolean().optional(),
    respec: z.boolean().optional(),
    streak_restore: z.boolean().optional(),

    // Base Stat Modifiers (Explicit)
    attack: z.number().optional(),
    attack_percent: z.number().optional(),
    defense: z.number().optional(),
    defense_percent: z.number().optional(),

    apply_status_effects: z.array(z.string()).optional(),

    // ============================================
    // COSMIC AFFIX EFFECTS (Post-999 / Cosmic Tier)
    // ============================================
    cosmic_resist: z.boolean().optional(),         // Immune to REALITY_FRACTURE & COSMIC_DREAD
    entropy_convert: z.number().optional(),        // % of ENTROPY DoT converted to healing
    cosmic_damage_bonus: z.number().optional(),    // % bonus damage vs COSMIC-rank bosses

    // Direct Cosmic Essence grant (COSMIC consumables only)
    cosmic_essence: z.number().optional(),         // Directly grants N Cosmic Essence on use
});

export type ItemEffect = z.infer<typeof ItemEffectSchema>;

export const BossIntelSchema = z.object({
    weakness: z.string().optional().default("Unknown"),
    resistances: z.array(z.string()).optional().default([]),
    abilities: z.array(z.string()).optional().default([]),
    strategy: z.string().optional().default("No strategy available."),
    lore: z.string().optional().default("No lore available."),
});

export type BossIntel = z.infer<typeof BossIntelSchema>;

export const SkillRewardsSchema = z.record(z.string(), z.number());
export type SkillRewards = z.infer<typeof SkillRewardsSchema>;

export const TitleModifiersSchema = z.object({
    strength_percent: z.number().optional(),
    agility_percent: z.number().optional(),
    intelligence_percent: z.number().optional(),
    vitality_percent: z.number().optional(),
    perception_percent: z.number().optional(),
    xp_gain_percent: z.number().optional(),
    gold_gain_percent: z.number().optional(),
    mana_efficiency: z.number().optional(),
});

export type TitleModifiers = z.infer<typeof TitleModifiersSchema>;

// Loot Table Schema for future DB integration
export const LootEntrySchema = z.object({
    itemName: z.string(),
    quantity: z.number().min(1),
    chance: z.number().min(0).max(1),
});

export const LootTableSchema = z.array(LootEntrySchema);

export type LootTable = z.infer<typeof LootTableSchema>;
