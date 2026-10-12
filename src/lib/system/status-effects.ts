export type StatusEffectType = 'BUFF' | 'STEALTH' | 'MIASMA' | 'EXHAUSTION' | 'CURSE' | 'POISON' | 'LETHARGY' | 'FOCUS' | 'BURN' | 'BLEED' | 'STUN' | 'FREEZE' | 'FEAR' | 'SHIELD' | 'REGEN' | 'SYSTEM_INTERFERENCE' | 'REALITY_FRACTURE' | 'COSMIC_DREAD' | 'ENTROPY';

export interface StatusEffect {
    type: StatusEffectType;
    name: string;
    description: string;
    modifiers?: {
        xp_gain_multiplier?: number;
        gold_gain_multiplier?: number;
        stat_multiplier?: number; // Multiplier for ALL physical/magic stats
        mana_regen_multiplier?: number;
        focus_multiplier?: number; // Custom multiplier for INT/PER if needed
        crit_chance?: number;
        crit_damage?: number;
        damage_multiplier?: number;
        boss_evasion?: number;
        armor_crush?: number;
        telekinetic_pressure?: number;
    };
    duration_hours?: number; // Real-time duration
    applied_at?: string; // ISO String (for real-time calculation)

    // Combat Specific
    duration?: number; // Duration measured by durationType
    durationType?: 'QUEST' | 'TURN' | 'HOUR' | string;
    damagePercent?: number; // DoT
    isStun?: boolean; // Control
}

export const STATUS_EFFECT_DEFINITIONS: Record<StatusEffectType, Omit<StatusEffect, 'applied_at'>> = {
    BUFF: { type: 'BUFF', name: 'Active Skill Buff', description: 'A temporary skill effect.' },
    STEALTH: { type: 'STEALTH', name: 'Stealth', description: 'The System conceals your presence.' },
    MIASMA: {
        type: 'MIASMA',
        name: 'System Miasma',
        description: 'Caused by neglected duties. XP and Gold gains are reduced by 15%.',
        modifiers: {
            xp_gain_multiplier: 0.85,
            gold_gain_multiplier: 0.85
        },
        duration_hours: 12
    },
    EXHAUSTION: {
        type: 'EXHAUSTION',
        name: 'Severe Exhaustion',
        description: 'Physical limit reached. All stats reduced by 30%.',
        modifiers: {
            stat_multiplier: 0.7
        },
        duration_hours: 12
    },
    CURSE: {
        type: 'CURSE',
        name: 'Monarch\'s Curse',
        description: 'The System is fighting against you. 0% Mana regeneration.',
        modifiers: {
            mana_regen_multiplier: 0
        },
        duration_hours: 48
    },
    POISON: {
        type: 'POISON',
        name: 'Venom',
        description: 'Slowing you down. Agility and Strength slightly reduced.',
        modifiers: {
            stat_multiplier: 0.9
        },
        duration_hours: 8
    },
    LETHARGY: {
        type: 'LETHARGY',
        name: 'Lethargy',
        description: 'A heavy drowsiness. Physical and magical stats reduced by 25%. Mutually exclusive with Focus.',
        modifiers: {
            stat_multiplier: 0.75
        },
        duration_hours: 24
    },
    FOCUS: {
        type: 'FOCUS',
        name: 'Massive Focus',
        description: 'Enhanced mental clarity. All stats significantly boosted. Mutually exclusive with Lethargy.',
        modifiers: {
            stat_multiplier: 1.5
        },
        duration_hours: 24
    },
    BURN: { type: 'BURN', name: 'Burn', description: 'Taking fire damage over time.', modifiers: {}, duration_hours: 0 },
    BLEED: { type: 'BLEED', name: 'Bleed', description: 'Losing HP from open wounds.', modifiers: {}, duration_hours: 0 },
    STUN: { type: 'STUN', name: 'Stun', description: 'Unable to act.', modifiers: {}, duration_hours: 0 },
    FREEZE: { type: 'FREEZE', name: 'Freeze', description: 'Frozen solid. Cannot move.', modifiers: {}, duration_hours: 0 },
    FEAR: { type: 'FEAR', name: 'Fear', description: 'Stats reduced by terror.', modifiers: { stat_multiplier: 0.8 }, duration_hours: 0 },
    SHIELD: { type: 'SHIELD', name: 'Shield', description: 'Damage mitigation active.', modifiers: {}, duration_hours: 0 },
    REGEN: { type: 'REGEN', name: 'Regeneration', description: 'Recovering HP over time.', modifiers: {}, duration_hours: 0 },
    SYSTEM_INTERFERENCE: {
        type: 'SYSTEM_INTERFERENCE',
        name: 'System Interference',
        description: 'Kandiaru is blocking your connection to the System. Level-up rewards and healing are suppressed.',
        modifiers: {},
        duration_hours: 0
    },

    // ============================================
    // COSMIC STATUS EFFECTS (Post-999 / Cosmic Bosses Only)
    // ============================================
    REALITY_FRACTURE: {
        type: 'REALITY_FRACTURE',
        name: 'Reality Fracture',
        description: 'The fabric of reality is torn. One random stat is nullified for 2 turns. Cannot be resisted.',
        modifiers: {
            stat_multiplier: 0.5 // Represents the average impact; actual logic handled in combat
        },
        duration_hours: 0
    },
    COSMIC_DREAD: {
        type: 'COSMIC_DREAD',
        name: 'Cosmic Dread',
        description: 'An incomprehensible terror grips your soul. All XP, Gold, and damage multipliers are halved for 3 turns.',
        modifiers: {
            xp_gain_multiplier: 0.5,
            gold_gain_multiplier: 0.5,
            stat_multiplier: 0.5
        },
        duration_hours: 0
    },
    ENTROPY: {
        type: 'ENTROPY',
        name: 'Entropy',
        description: 'The void consumes you. Lose 10% of Max HP per action. Ignores all defenses and resistances.',
        modifiers: {},
        duration_hours: 0
    }
};
