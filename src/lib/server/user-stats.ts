import { getServerPlayerContext, type PlayerStatsContext } from "./stats-loader";
import { gameDb as db } from "@/lib/server/game-db";
import { StatsManager } from "@/lib/stats-manager";

export interface PlayerStatsSnapshot {
    maxHp: number;
    maxMana: number;
    currentHp: number;
    currentMana: number;
    effectiveStats: Record<string, number>;
    modifiers: Record<string, number>;
    skillModifiers: Record<string, number>;
}

function calculatePlayerStatsBase(context: PlayerStatsContext): PlayerStatsSnapshot {
    const { profile, stats, modifiers, skillModifiers, statusEffects } = context;
    const baseStats = {
        strength: stats.strength || 10,
        agility: stats.agility || 10,
        intelligence: stats.intelligence || 10,
        vitality: stats.vitality || 10,
        perception: stats.perception || 10,
        charisma: stats.charisma || 10,
        focus: stats.focus || 10,
        willpower: stats.willpower || 10,
        luck: stats.luck || 10,
    };

    const hunterClass = profile.hunter_class || 'NONE';
    const crystallizedStats = stats.crystallized_stats || {};
    const prestigeLevel = profile.prestige_level || 0;
    const effectiveStats = StatsManager.calculateEffectiveStats(
        baseStats,
        modifiers,
        statusEffects,
        hunterClass,
        crystallizedStats,
    );
    const maxHp = StatsManager.calculateMaxHP(
        effectiveStats.vitality,
        effectiveStats.strength,
        profile.level || 1,
        modifiers,
        hunterClass,
        prestigeLevel,
    );
    const maxMana = StatsManager.calculateMaxMana(
        effectiveStats.intelligence,
        profile.level || 1,
        modifiers,
        hunterClass,
        prestigeLevel,
    );

    return {
        maxHp,
        maxMana,
        currentHp: Math.min(maxHp, Math.max(0, Number(profile.current_hp) || 0)),
        currentMana: Math.min(maxMana, Math.max(0, Number(profile.current_mana) || 0)),
        effectiveStats,
        modifiers,
        skillModifiers,
    };
}

/**
 * Builds the profile's effective stats without writing to PostgreSQL.
 * Offline regeneration is projected in memory; gameplay actions remain the
 * boundary that persists regenerated HP/MP and recalculated totals.
 */
export function calculatePlayerStatsSnapshot(context: PlayerStatsContext): PlayerStatsSnapshot {
    const snapshot = calculatePlayerStatsBase(context);
    const { profile } = context;
    const statusEffects = Array.isArray(profile.status_effects) ? profile.status_effects : [];

    if (statusEffects.some((effect: any) => effect.type === 'SYSTEM_INTERFERENCE')) {
        return snapshot;
    }

    const { newHp, newMana } = StatsManager.calculateOfflineRegen(
        profile.last_regen_at || new Date().toISOString(),
        snapshot.currentHp,
        snapshot.maxHp,
        snapshot.currentMana,
        snapshot.maxMana,
        profile.hunter_class,
        snapshot.modifiers,
    );

    return {
        ...snapshot,
        currentHp: newHp,
        currentMana: newMana,
    };
}

export async function recalculateAndClampPlayerStats(userId: string) {
    // 1. Fetch Unified Context (includes Shadows, Titles, Gear, Skills)
    const context = await getServerPlayerContext(userId);
    const { profile, stats, inventory, modifiers } = context;
    const hClass = profile.hunter_class || 'NONE';
    const statsResult = calculatePlayerStatsBase(context);
    const { maxHp, maxMana, effectiveStats, skillModifiers } = statsResult;

    // 4. Clamp Current Values
    const currentHp = Number(profile.current_hp) || 0;
    const currentMana = Number(profile.current_mana) || 0;

    const updates: Record<string, number> = {};

    // Only update if current exceeds max or if strictly clamping logic requires it.
    if (currentHp > maxHp) {
        updates.current_hp = maxHp;
    }

    if (currentMana > maxMana) {
        updates.current_mana = maxMana;
    }

    // 5. Update Database if needed
    if (Object.keys(updates).length > 0) {
        // Build dynamic UPDATE query
        const keys = Object.keys(updates);
        const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
        const values = keys.map(k => updates[k]);

        await db.query(
            `UPDATE profiles SET ${setClause} WHERE id = $1`,
            [userId, ...values]
        );
    }

    // [NEW] Persist Calculated Effective Stats to hunter_stats
    // [NEW] Persist Calculated Effective Stats & Combat Stats to hunter_stats
    const cosmicPower = stats.cosmic_power || 0;
    const dmg = StatsManager.calculatePlayerDamage(effectiveStats, inventory, hClass, modifiers);
    const atk = dmg.min; // Leaderboard uses Min Damage as "ATK"
    const def = StatsManager.calculateDefense(effectiveStats.vitality, modifiers, hClass, cosmicPower);

    // [NEW] Shadow Storage Calculation (Epic Scale)
    // Formula: 200 + (Level * 10) + (Intelligence * 5)
    // Lvl 170 / Int 300 => 200 + 1700 + 1500 = 3400 Slots.
    const shadowStorage = 200 + ((profile.level || 1) * 10) + (effectiveStats.intelligence * 5);

    // Persist to profiles (shadow_storage_limit) if changed
    if (profile.shadow_storage_limit !== shadowStorage) {
        await db.query("UPDATE profiles SET shadow_storage_limit = $1 WHERE id = $2", [shadowStorage, userId]);
    }

    await db.query(
        `UPDATE hunter_stats 
         SET total_strength = $1, 
             total_vitality = $2, 
             total_agility = $3, 
             total_intelligence = $4, 
             total_perception = $5,
             total_attack = $6,
             total_defense = $7
         WHERE user_id = $8`,
        [
            effectiveStats.strength,
            effectiveStats.vitality,
            effectiveStats.agility,
            effectiveStats.intelligence,
            effectiveStats.perception,
            atk,
            def,
            userId
        ]
    );

    // 6. Return Fresh Data (useful for chains)
    return {
        maxHp,
        maxMana,
        currentHp: updates.current_hp ?? statsResult.currentHp,
        currentMana: updates.current_mana ?? statsResult.currentMana,
        effectiveStats,
        modifiers,
        skillModifiers
    };
}

/**
 * Applies passive regeneration (HP/MP) based on time elapsed since last_regen_at.
 * This is a server-side action that updates the database.
 */
export async function applyPassiveRegen(userId: string) {
    // 1. Get current state (calculate fresh max values)
    const statsResult = await recalculateAndClampPlayerStats(userId);

    // 2. Fetch profile for last_regen_at
    const profile = await db.queryOne<{ last_regen_at: string, current_hp: number, current_mana: number, hunter_class: string, status_effects: any }>(
        "SELECT last_regen_at, current_hp, current_mana, hunter_class, status_effects FROM profiles WHERE id = $1",
        [userId]
    );

    if (!profile) return statsResult;

    // 3. Calculate Regeneration
    const statusEffects = Array.isArray(profile.status_effects) ? profile.status_effects : [];
    const hasInterference = statusEffects.some((e: any) => e.type === 'SYSTEM_INTERFERENCE');

    if (hasInterference) {
        console.log(`[Regen] Passive Regeneration BLOCK by System Interference.`);
        return statsResult;
    }

    const { newHp, newMana } = StatsManager.calculateOfflineRegen(
        profile.last_regen_at || new Date().toISOString(),
        profile.current_hp,
        statsResult.maxHp,
        profile.current_mana,
        statsResult.maxMana,
        profile.hunter_class,
        statsResult.modifiers
    );

    // 4. Update Database if changed
    if (newHp !== profile.current_hp || newMana !== profile.current_mana) {
        await db.query(
            "UPDATE profiles SET current_hp = $1, current_mana = $2, last_regen_at = $3 WHERE id = $4",
            [newHp, newMana, new Date().toISOString(), userId]
        );

        return {
            ...statsResult,
            currentHp: newHp,
            currentMana: newMana
        };
    }

    return statsResult;
}
