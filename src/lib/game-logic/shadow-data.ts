export interface ShadowAbility {
    name: string;
    description: string;
    effect: string;
    type: 'PASSIVE' | 'ACTIVE';
    baseValue?: number;
    scalingStep?: number;
    ceiling?: number;
}

export function getShadowGrade(level: number): string {
    switch (level) {
        case 1: return "NORMAL GRADE";
        case 2: return "ELITE GRADE";
        case 3: return "KNIGHT GRADE";
        case 4: return "ELITE KNIGHT GRADE";
        case 5: return "COMMANDER GRADE";
        case 6: return "MARSHAL GRADE";
        default: return "GRAND MARSHAL GRADE";
    }
}

export const SHADOW_DATA: Record<string, ShadowAbility> = {
    "Blue Venom-Fanged Kasaka": {
        name: "Serpent's Poison",
        description: "Reduces Mana cost of Daily quests.",
        effect: "-{value}% Daily Mana Cost",
        type: "PASSIVE",
        baseValue: 10,
        scalingStep: 2,
        ceiling: 22
    },
    "Hwang Dongsuk": {
        name: "Greed's Hunger",
        description: "An unquenchable thirst for material growth.",
        effect: "+{value}% Gold from Quests",
        type: "PASSIVE",
        baseValue: 20,
        scalingStep: 3,
        ceiling: 40
    },
    "Giant Arachnid Buryura": {
        name: "Web Weaver",
        description: "Increases XP rewards from all completions.",
        effect: "+{value}% XP Gain",
        type: "PASSIVE",
        baseValue: 10,
        scalingStep: 3,
        ceiling: 30
    },
    "Cerberus (Gatekeeper)": {
        name: "Hellhound's Vigil",
        description: "Increases defense against mental fatigue.",
        effect: "+{value}% Vitality",
        type: "PASSIVE",
        baseValue: 15,
        scalingStep: 2,
        ceiling: 30
    },
    "Avaricious Vulcan": {
        name: "Molten Greed",
        description: "Increases Gold rewards from Boss battles.",
        effect: "+{value}% Boss Gold",
        type: "PASSIVE",
        baseValue: 20,
        scalingStep: 5,
        ceiling: 50
    },
    "Metus (Soul Shepherd)": {
        name: "Soul Collector",
        description: "Restores mental energy when pushing through tasks.",
        effect: "+{value}% Max MP upon Task Completion",
        type: "PASSIVE",
        baseValue: 5,
        scalingStep: 2,
        ceiling: 17
    },
    "Blood-Red Commander Igris": {
        name: "Red Knight's Command",
        description: "Ensures flawless execution of goals.",
        effect: "+{value}% Agility & Critical Task Chance",
        type: "PASSIVE",
        baseValue: 10,
        scalingStep: 2,
        ceiling: 25
    },
    "Iron (Kim Chul)": {
        name: "Shield of the Titan",
        description: "Protects the monarch from system penalties.",
        effect: "Blocks 1 Penalty/Week",
        type: "PASSIVE"
    },
    "Tank (Ice Bear Leader)": {
        name: "Hibernation Recovery",
        description: "Store energy while resting.",
        effect: "+{value}% Idle Regeneration",
        type: "PASSIVE",
        baseValue: 50,
        scalingStep: 10,
        ceiling: 110
    },
    "Kargalgan (Orc Shaman)": {
        name: "Hymn of the Giant",
        description: "Amplifies the reach of your magical prowess.",
        effect: "+{value}% Intelligence & XP Multiplier",
        type: "PASSIVE",
        baseValue: 15,
        scalingStep: 2,
        ceiling: 30
    },
    "Ant King (Beru)": {
        name: "Autonomous Command",
        description: "The ultimate soldier coordinates the legion. Reduces shadow cost and duration of delegated tasks.",
        effect: "Reduces Delegation Time & Shadow Cost by {value}%",
        type: "PASSIVE",
        baseValue: 10,
        scalingStep: 5,
        ceiling: 40
    },
    "Kaisellin (Sky Dragon)": {
        name: "Sky Courier",
        description: "Dominates the horizon and brings treasures.",
        effect: "Auto-Claim Daily Rewards",
        type: "PASSIVE"
    },
    "Baruka (Ice Elf Leader)": {
        name: "Drill Instructor",
        description: "Refines skill with every movement.",
        effect: "+{value}% Skill XP Gain",
        type: "PASSIVE",
        baseValue: 30,
        scalingStep: 5,
        ceiling: 60
    },
    "Greed (Hwang Dong-Su)": {
        name: "Avarice",
        description: "An unquenchable thirst for material growth.",
        effect: "Triple Gold on Next Quest (Active)",
        type: "ACTIVE"
    },
    "Kamish (The Dragon)": {
        name: "Dragon's Wrath",
        description: "A natural disaster that clears everything.",
        effect: "Global Task Wipe (Weekly)",
        type: "ACTIVE"
    },
    "Legia (Monarch of the Beginning)": {
        name: "Primordial Momentum",
        description: "The first spark ignites a wildfire.",
        effect: "5x Reward for First Daily",
        type: "PASSIVE"
    },
    "Querehsha (Monarch of Plagues)": {
        name: "Viral Productivity",
        description: "Effort spreads like an infection.",
        effect: "Batch Auto-Completion (C-Rank)",
        type: "PASSIVE"
    },
    "Rakan (Monarch of Beastly Fangs)": {
        name: "Bloodscent",
        description: "Tracks the most valuable prey.",
        effect: "+100% Rewards for Highest Priority",
        type: "PASSIVE"
    },
    "Tarnak (Monarch of Iron Body)": {
        name: "Fortress State",
        description: "The monarch stands unmoved by the system.",
        effect: "Total Penalty Immunity (24h Active)",
        type: "ACTIVE"
    },
    "Yogumunt (Monarch of Transfiguration)": {
        name: "Equivalent Exchange",
        description: "Rewrites the value of reality.",
        effect: "Swap Quest Rewards",
        type: "ACTIVE"
    },
    "Sillad (Monarch of Frost)": {
        name: "Absolute Zero",
        description: "Freezes the flow of time and decay.",
        effect: "Freeze All Timers (24h)",
        type: "ACTIVE"
    },
    "Antares (Monarch of Destruction)": {
        name: "Total War",
        description: "Burn the system and everything in it.",
        effect: "Instant Quest Log Clear at Max Cost",
        type: "ACTIVE"
    },
    "Ashborn (Shadow Monarch)": {
        name: "Heart of the Monarch",
        description: "The true heir of the void.",
        effect: "Permanent +{value}% All Stats",
        type: "PASSIVE",
        baseValue: 50,
        scalingStep: 5,
        ceiling: 80
    },
    "Statue of God": {
        name: "Commandments of Cartenon",
        description: "Follow the rules of God, or be erased by them.",
        effect: "+{value}% All Stats (System Authority)",
        type: "PASSIVE",
        baseValue: 10,
        scalingStep: 2,
        ceiling: 30
    },
    "The Architect (Kandiaru)": {
        name: "System Blueprint",
        description: "Grants access to the system's core architecture.",
        effect: "Expands Max HP, MP, and Storage Capacity by +{value}%",
        type: "PASSIVE",
        baseValue: 10,
        scalingStep: 5,
        ceiling: 40
    },
    "Apostles of Itarim": {
        name: "Celestial Echo",
        description: "Whispers from the outer gods grant foresight.",
        effect: "+{value}% Rare Loot Finding",
        type: "PASSIVE",
        baseValue: 50,
        scalingStep: 5,
        ceiling: 80
    },
    "Itarim (Outer God)": {
        name: "Absolute Existence",
        description: "Your mastery over causality deepens with consistent effort.",
        effect: "Every 100 Lifetime Tasks completed grants +1 Permanent AP",
        type: "PASSIVE"
    },

    // ============================================
    // PHASE 6: THE BEYOND — COSMIC SHADOWS
    // ============================================

    "Azathoth, The Blind Idiot God": {
        name: "Dreamer's Dividend",
        description: "The Blind Idiot God dreams, and reality bends to your will. Cosmic Essence generation is amplified.",
        effect: "+{value}% Cosmic Essence Gain",
        type: "PASSIVE",
        baseValue: 100,
        scalingStep: 10,
        ceiling: 200
    },
    "Tiamat, The Chromatic Sovereign": {
        name: "Prismatic Scales",
        description: "The Chromatic Sovereign's scales absorb all elemental damage. Grants resistance to all damage types.",
        effect: "+{value}% All Elemental Resistance",
        type: "PASSIVE",
        baseValue: 25,
        scalingStep: 5,
        ceiling: 60
    },
    "Vecna, The Whispered One": {
        name: "Forbidden Knowledge",
        description: "The Whispered One's secrets flow into your mind. All XP gains are amplified by forbidden lore.",
        effect: "+{value}% XP from all sources",
        type: "PASSIVE",
        baseValue: 50,
        scalingStep: 5,
        ceiling: 100
    },
    "Nyarlathotep, The Crawling Chaos": {
        name: "Thousand Faces",
        description: "The Crawling Chaos shifts your form. Once per day, randomize all stats — with a chance for massive gains.",
        effect: "Daily Stat Chaos Roll (50% chance of +200% random stat)",
        type: "ACTIVE"
    },
    "Atropus, The World Born Dead": {
        name: "Necrotic Ascension",
        description: "The World Born Dead converts failure into power. HP lost to penalties is converted to bonus XP.",
        effect: "HP Penalty → Bonus XP (1 HP = {value} XP)",
        type: "PASSIVE",
        baseValue: 100,
        scalingStep: 20,
        ceiling: 300
    }
};

/**
 * Calculates the scaled value for a shadow's ability based on its level.
 * Formula: baseValue + (level - 1) * scalingStep, capped at ceiling.
 */
export function calculateShadowEffect(shadowName: string, level: number = 1): number {
    const data = SHADOW_DATA[shadowName];
    if (!data || data.baseValue === undefined) return 0;

    const base = data.baseValue;
    const step = data.scalingStep || 0;
    const cap = data.ceiling || base;

    const calculated = base + (level - 1) * step;
    return Math.min(cap, calculated);
}

/**
 * Formats the shadow effect string dynamically based on level.
 * Replaces {value} payload with the mathematically scaled value.
 */
export function formatShadowEffect(shadowName: string, level: number = 1): string {
    const data = SHADOW_DATA[shadowName];
    if (!data) return "Effect Encrypted...";

    if (!data.baseValue || !data.effect.includes('{value}')) {
        return data.effect;
    }

    const value = calculateShadowEffect(shadowName, level);
    const formattedValue = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);

    return data.effect.replace('{value}', formattedValue);
}

/**
 * Translates active summoned elite shadows into numeric system modifiers.
 */
export function getActiveShadowModifiers(summonedShadows: { name: string, level: number }[]): Record<string, number> {
    const mods: Record<string, number> = {};
    
    summonedShadows.forEach(shadow => {
        const value = calculateShadowEffect(shadow.name, shadow.level);
        if (value <= 0) return;

        // Convert percentage to decimal multiplier for StatsManager (e.g., 10% -> 0.1)
        const percent = value / 100;

        switch (shadow.name) {
            case "The Architect (Kandiaru)":
                mods['hp_percent'] = (mods['hp_percent'] || 0) + percent;
                mods['mana_percent'] = (mods['mana_percent'] || 0) + percent;
                mods['storage_capacity_percent'] = (mods['storage_capacity_percent'] || 0) + percent;
                break;
            case "Statue of God":
                mods['all_stats_percent'] = (mods['all_stats_percent'] || 0) + percent;
                mods['defense_percent'] = (mods['defense_percent'] || 0) + 0.20; // Absolute protection
                break;
            case "Ashborn (Shadow Monarch)":
                mods['all_stats_percent'] = (mods['all_stats_percent'] || 0) + percent;
                break;
            case "Kargalgan (Orc Shaman)":
                mods['intelligence_percent'] = (mods['intelligence_percent'] || 0) + percent;
                mods['xp_multiplier'] = (mods['xp_multiplier'] || 0) + percent;
                break;
            case "Cerberus (Gatekeeper)":
                mods['vitality_percent'] = (mods['vitality_percent'] || 0) + percent;
                break;
            case "Blood-Red Commander Igris":
                mods['agility_percent'] = (mods['agility_percent'] || 0) + percent;
                mods['crit_chance'] = (mods['crit_chance'] || 0) + percent; // Native crit is flat addition in StatsManager
                break;
            case "Tank (Ice Bear Leader)":
                mods['regen_rate_percent'] = (mods['regen_rate_percent'] || 0) + percent;
                break;
            case "Apostles of Itarim":
                mods['loot_find'] = (mods['loot_find'] || 0) + percent; // Native loot chance is flat addition
                break;
            case "Tiamat, The Chromatic Sovereign":
                mods['defense_percent'] = (mods['defense_percent'] || 0) + percent;
                break;
            case "Vecna, The Whispered One":
                mods['xp_multiplier'] = (mods['xp_multiplier'] || 0) + percent;
                break;
            case "Azathoth, The Blind Idiot God":
                mods['cosmic_power_percent'] = (mods['cosmic_power_percent'] || 0) + percent;
                break;
            case "Avaricious Vulcan":
                mods['boss_gold_multiplier'] = (mods['boss_gold_multiplier'] || 0) + percent;
                break;
            case "Giant Arachnid Buryura":
                mods['xp_multiplier'] = (mods['xp_multiplier'] || 0) + percent;
                break;
            case "Hwang Dongsuk":
                mods['gold_multiplier'] = (mods['gold_multiplier'] || 0) + percent;
                break;
        }
    });

    return mods;
}

// ============================================================
// CLASS-BASED ELITE PRIORITY SCORING
// Used by autoAllocateElitesAction to pick the best active set.
// Higher score = higher priority for that class.
// Any shadow not listed gets a default score of 5.
// ============================================================

export type HunterClass = 'Necromancer' | 'Fighter' | 'Mage' | 'Assassin' | 'Ranger' | string;

export const SHADOW_CLASS_SCORES: Record<string, Record<string, number>> = {
    Necromancer: {
        // Shadow-synergy & mana management are top priority
        "Ant King (Beru)":                  10, // Delegation cost/time reduction - core mechanic
        "Blue Venom-Fanged Kasaka":         10, // Mana cost reduction - essential for Necromancer
        "Kargalgan (Orc Shaman)":           9,  // +INT & XP multiplier
        "The Architect (Kandiaru)":         9,  // +HP/MP/Storage - expands army capacity
        "Itarim (Outer God)":               9,  // Permanent stat per task
        "Statue of God":                    8,  // +All Stats
        "Apostles of Itarim":               8,  // +Rare Loot
        "Rakan (Monarch of Beastly Fangs)": 8,  // +100% highest priority
        "Giant Arachnid Buryura":           7,  // +XP gain
        "Hwang Dongsuk":                    7,  // +Gold from quests
        "Baruka (Ice Elf Leader)":          7,  // +Skill XP
        "Ashborn (Shadow Monarch)":         8,  // +All Stats (monarch synergy)
        "Cerberus (Gatekeeper)":            6,  // +Vitality
        "Avaricious Vulcan":                6,  // +Boss Gold
        "Metus (Soul Shepherd)":            6,  // +MP on task completion
        "Antares (Monarch of Destruction)": 5,  // Instant quest clear (active utility)
        "Querehsha (Monarch of Plagues)":   7,  // Batch auto-completion
        "Tank (Ice Bear Leader)":           4,  // Idle regen
        "Blood-Red Commander Igris":        4,  // +AGI (not Necromancer primary)
        "Kamish (The Dragon)":              5,  // Weekly wipe (active)
        "Tarnak (Monarch of Iron Body)":    5,  // Penalty immunity (active)
    },
    Fighter: {
        // Physical stats and survival
        "Cerberus (Gatekeeper)":            10, // +Vitality
        "Blood-Red Commander Igris":        10, // +AGI & crit chance
        "Tank (Ice Bear Leader)":           9,  // Idle regen
        "Rakan (Monarch of Beastly Fangs)": 9,  // +100% highest priority
        "Tarnak (Monarch of Iron Body)":    8,  // Penalty immunity
        "Statue of God":                    8,  // +All Stats
        "Ashborn (Shadow Monarch)":         8,  // +All Stats
        "Itarim (Outer God)":               8,  // Permanent stat per task
        "Avaricious Vulcan":                7,  // +Boss Gold (combat focus)
        "Giant Arachnid Buryura":           6,  // +XP
        "Hwang Dongsuk":                    6,  // +Gold
        "The Architect (Kandiaru)":         7,  // +HP/Storage
        "Apostles of Itarim":               6,  // +Loot
        "Kargalgan (Orc Shaman)":           5,  // +INT (not Fighter primary)
        "Ant King (Beru)":                  4,  // Delegation (less relevant for Fighter)
        "Blue Venom-Fanged Kasaka":         4,  // Mana (less relevant for Fighter)
    },
    Mage: {
        // INT, XP, and knowledge-power effects
        "Kargalgan (Orc Shaman)":           10, // +INT & XP multiplier
        "Giant Arachnid Buryura":           10, // +XP gain
        "Itarim (Outer God)":               9,  // Permanent stat per task
        "Baruka (Ice Elf Leader)":          9,  // +Skill XP
        "Statue of God":                    9,  // +All Stats
        "Ashborn (Shadow Monarch)":         8,  // +All Stats
        "The Architect (Kandiaru)":         8,  // +HP/MP/Storage
        "Metus (Soul Shepherd)":            8,  // +MP on task
        "Apostles of Itarim":               7,  // +Loot
        "Rakan (Monarch of Beastly Fangs)": 7,  // +100% priority
        "Blue Venom-Fanged Kasaka":         7,  // Mana cost reduction
        "Avaricious Vulcan":                5,
        "Hwang Dongsuk":                    5,
        "Blood-Red Commander Igris":        4,
    },
    Assassin: {
        // AGI, crit, stealth, gold
        "Blood-Red Commander Igris":        10, // +AGI & crit
        "Hwang Dongsuk":                    10, // +Gold (Assassin grind gold)
        "Avaricious Vulcan":                9,  // +Boss Gold
        "Apostles of Itarim":               9,  // +Rare Loot
        "Rakan (Monarch of Beastly Fangs)": 8,  // +100% priority
        "Giant Arachnid Buryura":           7,  // +XP
        "Itarim (Outer God)":               7,  // Permanent stat
        "Cerberus (Gatekeeper)":            7,  // +Vitality
        "Statue of God":                    7,  // +All Stats
        "Ashborn (Shadow Monarch)":         7,  // +All Stats
        "Kamish (The Dragon)":              6,  // Quest wipe (optional reset)
        "Tank (Ice Bear Leader)":           5,
        "Kargalgan (Orc Shaman)":           4,  // INT not Assassin primary
    },
    Ranger: {
        // Perception, loot, and accuracy
        "Apostles of Itarim":               10, // +Rare Loot
        "Avaricious Vulcan":                9,  // +Boss Gold
        "Rakan (Monarch of Beastly Fangs)": 9,  // +100% priority
        "Blood-Red Commander Igris":        8,  // +AGI & crit
        "Giant Arachnid Buryura":           8,  // +XP
        "Hwang Dongsuk":                    8,  // +Gold
        "Itarim (Outer God)":               8,  // Permanent stat
        "Statue of God":                    7,  // +All Stats
        "Cerberus (Gatekeeper)":            6,
        "The Architect (Kandiaru)":         6,
        "Baruka (Ice Elf Leader)":          6,
        "Ashborn (Shadow Monarch)":         7,
    },
};

const DEFAULT_CLASS_SCORES: Record<string, number> = {
    "Rakan (Monarch of Beastly Fangs)": 9,
    "Itarim (Outer God)":               9,
    "Statue of God":                    8,
    "Ashborn (Shadow Monarch)":         8,
    "Apostles of Itarim":               8,
    "Giant Arachnid Buryura":           7,
    "Hwang Dongsuk":                    7,
};

const RANK_TIEBREAK: Record<string, number> = {
    'XX': 1.0, 'S+': 0.8, 'S': 0.6, 'A': 0.4, 'B': 0.3, 'C': 0.2, 'D': 0.1, 'E': 0.05
};

/**
 * Score a shadow for auto-allocation for a given hunter class.
 * Returns a numeric priority score; higher = better fit.
 */
export function getShadowPriorityScore(
    shadowName: string,
    shadowRank: string,
    shadowLevel: number,
    hunterClass: HunterClass
): number {
    const classScores = SHADOW_CLASS_SCORES[hunterClass] ?? DEFAULT_CLASS_SCORES;
    const baseScore = classScores[shadowName] ?? DEFAULT_CLASS_SCORES[shadowName] ?? 5;
    const rankBonus = RANK_TIEBREAK[shadowRank] ?? 0.1;
    // Level adds a small tiebreak (+0.1 per shadow level, capped at 0.7)
    const levelBonus = Math.min(0.7, shadowLevel * 0.1);
    return baseScore + rankBonus + levelBonus;
}
