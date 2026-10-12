
import { StatsManager } from "@/lib/stats-manager";
import { Database } from "@/types/database.types";
import { calculateXpForLevel, scaleItemEffect, calculateGlobalRewardMultiplier, isPostCap, calculateSkillManaCost } from "@/lib/system/formula";
import { calculateSkillCooldownSeconds } from "@/lib/system/skill-effects";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import db from "@/lib/db";
import { applyPassiveRegen } from "@/lib/server/user-stats";
import { applyQualityToEffect } from "@/lib/game-logic/item-roller";
import { formatShadowEffect, getActiveShadowModifiers } from "@/lib/game-logic/shadow-data";

// Re-export types for use in components
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type HunterStats = Database['public']['Tables']['hunter_stats']['Row'];
// Update Quest type to include dynamic user state
export type Quest = Database['public']['Tables']['quests']['Row'] & {
    status?: string | null;
    completed_at?: string | null;
};

export interface ShadowAssignment {
    id: string;
    quest_id: string;
    shadow_count: number;
    return_at: string;
    quest_title?: string;
}

export interface DashboardData {
    profile: Profile | null;
    stats: HunterStats | null;
    effectiveStats?: Record<string, number>; // Calculated stats
    quests: Quest[];
    inventory: any[];
    logs: any[];  // Quest completion logs for history
    modifiers: Record<string, number>;
    derivedStats: {
        maxHp: number;
        maxMana: number;
        atk: number;
        def: number;
        xpPercent: number;
        dailyQuestCount: number;
        secondaryStats: {
            critChance: number;
            dodgeChance: number;
            lootFind: number;
            critMultiplier: number;
        };
    };
    totalCompletions: number;
    hasDefeatedIgris: boolean;
    availableShadows: number;
    activeAssignments: ShadowAssignment[];
    shadowStats: {
        total: number;
        available: number;
        max: number;
        elites: number;
        elitesSummoned: number;
        elitesMax: number;
        activeEliteEffects: { name: string; level: number; effectText: string }[];
    };
    hotbar: {
        slot: number;
        skillId: string;
        name: string;
        manaCost: number;
        cooldown: number;
        lastUsed?: string;
        description?: string;
        category?: string;
    }[];
    activeBoss?: {
        id: string;
        name: string;
        currentHp: number;
        maxHp: number;
        image?: string;
        rank?: string;
        description?: string;
        intel?: any;
        damageType?: string;
    } | null;
    todayCompletions: number;
    reportDay: string;
    weekCompletions: number;
    streak: number;
    offlineGaps: string[];
}

import { getServerPlayerContext } from "./server/stats-loader";

export async function getDashboardData(targetUserId?: string): Promise<DashboardData> {
    const reportDay = new Date().toISOString().slice(0, 10);
    let userId = targetUserId;

    // 1. Get User ID (if not provided)
    if (!userId) {
        try {
            const user = await getAuthenticatedUser();
            userId = user.id;
        } catch {
            // Not authenticated
            userId = undefined;
        }
    }

    if (!userId) {
        // Return empty structure if no user
        return {
            profile: null,
            stats: null,
            quests: [],
            inventory: [],
            logs: [],
            modifiers: {},
            derivedStats: {
                maxHp: 100,
                maxMana: 50,
                atk: 10,
                def: 10,
                xpPercent: 0,
                dailyQuestCount: 0,
                secondaryStats: { critChance: 0, dodgeChance: 0, lootFind: 0, critMultiplier: 1.5 }
            },
            totalCompletions: 0,
            hasDefeatedIgris: false,
            availableShadows: 0,
            activeAssignments: [],
            shadowStats: { total: 0, available: 0, max: 0, elites: 0, elitesSummoned: 0, elitesMax: 0, activeEliteEffects: [] },
            hotbar: [],
            activeBoss: null,
            todayCompletions: 0,
            reportDay,
            weekCompletions: 0,
            streak: 0,
            offlineGaps: []
        };
    }

    // 1.5 Apply Passive Regeneration (Ensures data is fresh)
    await applyPassiveRegen(userId);

    // 2. Parallel Requests
    const [context, allTitles, quests, logs, completionsCount, igrisDefeat, assignmentsRow, assignmentsRow2, activeEncounterRow] = await Promise.all([
        getServerPlayerContext(userId),
        db.query("SELECT * FROM titles"),
        db.query<Quest>(`
            SELECT q.*, 
                   COALESCE(uq.status, 'Available') as status,
                   uq.completed_at
            FROM quests q
            LEFT JOIN user_quests uq ON q.id = uq.quest_id AND uq.user_id = $1
            WHERE q.user_id IS NULL OR q.user_id = $1
        `, [userId]),
        db.query("SELECT * FROM quest_logs WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1000", [userId]),
        db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1", [userId]),
        db.queryOne<{ id: string }>(`
            SELECT ae.id FROM active_encounters ae
            JOIN bosses b ON ae.boss_id = b.id
            WHERE ae.user_id = $1 AND ae.status = 'DEFEATED' AND b.name ILIKE '%Igris%'
            LIMIT 1
        `, [userId]),
        db.queryOne<{ total_assigned: string }>(`
            SELECT SUM(shadow_count) as total_assigned
            FROM shadow_assignments
            WHERE user_id = $1 AND expires_at > NOW()
        `, [userId]),
        db.query<ShadowAssignment>(`
            SELECT sa.id, sa.quest_id, sa.shadow_count, sa.expires_at as return_at, q.title as quest_title
            FROM shadow_assignments sa
            LEFT JOIN quests q ON sa.quest_id = q.id
            WHERE sa.user_id = $1 AND sa.expires_at > NOW()
            ORDER BY sa.expires_at ASC
        `, [userId]),
        // Fetch full active encounter details
        db.queryOne<{ id: string, name: string, current_hp: number, max_hp: number, image_url: string, rank: string, description: string, intel: any, damage_type: string }>(`
            SELECT ae.id, b.name, ae.current_hp, ae.max_hp, b.image_url, b.rank, b.description, b.intel, b.damage_type
            FROM active_encounters ae
            JOIN bosses b ON ae.boss_id = b.id
            WHERE ae.user_id = $1 AND ae.status = 'ACTIVE'
            LIMIT 1
        `, [userId])
    ]);

    const { profile, stats, inventory, modifiers, statusEffects, summonedElites } = context;

    const titlesList = allTitles.rows || [];
    const questList = quests.rows || [];

    const elitesCount = summonedElites.length; // Count of Elite Shadows in the army
    const elitesSummoned = summonedElites.length; // Currently summoned

    // 4. Derived Statistics
    let maxHp = 100;
    let maxMana = 50;
    let atk = 10;
    let def = 10;
    let xpPercent = 0;
    let finalStats: Record<string, number> | undefined;

    if (profile && stats) {
        // Effective Stats (Stat + Mods)
        const baseStats = {
            strength: stats.strength || 10,
            agility: stats.agility || 10,
            intelligence: stats.intelligence || 10,
            vitality: stats.vitality || 10,
            perception: stats.perception || 10
        };

        const hClass = profile.hunter_class || 'NONE';
        const crystallizedStats = (stats as any).crystallized_stats || {};
        const prestigeLevel = (profile as any).prestige_level || 0;
        const cosmicPower = (stats as any).cosmic_power || 0;

        finalStats = StatsManager.calculateEffectiveStats(baseStats, modifiers, statusEffects, hClass, crystallizedStats);

        // Max HP/Mana
        maxHp = StatsManager.calculateMaxHP(
            finalStats.vitality,
            finalStats.strength,
            profile.level || 1,
            modifiers,
            hClass,
            prestigeLevel
        );

        maxMana = StatsManager.calculateMaxMana(
            finalStats.intelligence,
            profile.level || 1,
            modifiers,
            hClass,
            prestigeLevel
        );

        // ATK/DEF (Standardized)
        // [FIX] Pass modifiers to calculatePlayerDamage for correct multiplier scaling
        const dmg = StatsManager.calculatePlayerDamage(finalStats, inventory, hClass, modifiers);
        atk = dmg.min;
        def = StatsManager.calculateDefense(finalStats.vitality, modifiers, hClass, cosmicPower);

        // XP Calculation
        const startXp = calculateXpForLevel(profile.level || 1);
        const xpNeeded = (profile.next_level_xp || 100) - startXp;
        const xpInto = (profile.current_xp || 0) - startXp;
        const rawPercent = xpNeeded > 0 ? (xpInto / xpNeeded) * 100 : 100;
        xpPercent = Math.min(100, Math.max(0, Math.round(rawPercent)));

        // Shadow Config (Moved to shadowStats)
    }

    // Shadow Stats Calculation
    const totalInfantry = profile?.shadow_infantry_count || 0;
    const assignedInfantry = parseInt(assignmentsRow?.total_assigned || '0');
    const availableInfantry = Math.max(0, totalInfantry - assignedInfantry);
    
    const pLevel = profile?.level || 1;
    const int = finalStats?.intelligence || stats?.intelligence || 0; // Use effective int if available
    const elitesMax = 1 + Math.floor(Math.max(0, pLevel - 40) / 20) + Math.floor(int / 500);

    const activeEliteEffects = summonedElites.map((e: any) => ({
        name: e.name,
        level: e.level,
        effectText: formatShadowEffect(e.name, e.level)
    }));

    // Recalculate Storage Limit (Use DB value from user-stats.ts)
    // Fallback to old calc if 0/null (Migration safety)
    let storageLimit = (profile as any)?.shadow_storage_limit || 0;

    if (storageLimit === 0 && pLevel >= 40) {
        // Fallback or just show 0 if not calculated yet
        // Ideally user-stats.ts runs on login/action, so it should be there.
        // But let's verify_shadow_limit.ts showed it WAS updated in DB.
        // So we just need to read it.
        storageLimit = 200 + (pLevel * 10); // Simple fallback closer to new scale
    }

    // Apply Shadow Modifier (e.g. Architect's capacity expansion)
    if (modifiers.storage_capacity_percent) {
        storageLimit = Math.floor(storageLimit * (1 + modifiers.storage_capacity_percent));
    }

    const shadowStats = {
        total: totalInfantry,
        available: availableInfantry,
        max: storageLimit,
        elites: elitesCount,
        elitesSummoned,
        elitesMax,
        activeEliteEffects
    };

    const activeAssignments = (assignmentsRow2 as any)?.rows || [];

    // Daily Count
    const dailyQuestCount = questList.filter(q => q.type === 'Daily' && q.status !== 'Complete').length;

    // Fetch Active Skills
    const hotbarRes = await db.query<{
        skill_id: string,
        last_used_at: string,
        name: string,
        mana_cost: number,
        effect_type: string,
        cooldown_seconds: number,
        description: string,
        category: string,
        current_level: number
    }>(`
        SELECT s.id as skill_id, us.last_used_at, s.name, s.mana_cost, s.effect_type, s.cooldown_seconds,
               s.description, s.category, us.current_level
        FROM user_skills us
        JOIN skills s ON us.skill_id = s.id
        WHERE us.user_id = $1 AND s.is_active = true AND us.current_level > 0
        ORDER BY s.category ASC, s.name ASC
    `, [userId]);

    const hotbar = hotbarRes.rows.map((r, index) => {
        const effectType = r.effect_type || r.category; // Ensure fallback
        const effectiveManaCost = calculateSkillManaCost(r.mana_cost, r.current_level, maxMana, effectType);

        return {
            slot: index + 1,
            skillId: r.skill_id,
            name: r.name,
            manaCost: effectiveManaCost,
            cooldown: calculateSkillCooldownSeconds(r.cooldown_seconds, r.current_level, effectType),
            lastUsed: r.last_used_at,
            description: r.description,
            category: r.category
        };
    });

    const activeBoss = activeEncounterRow?.id ? {
        id: activeEncounterRow.id,
        name: activeEncounterRow.name,
        currentHp: activeEncounterRow.current_hp,
        maxHp: activeEncounterRow.max_hp,
        image: activeEncounterRow.image_url,
        rank: activeEncounterRow.rank,
        description: activeEncounterRow.description,
        intel: activeEncounterRow.intel,
        damageType: activeEncounterRow.damage_type
    } : null;

    return {
        profile: profile || null,
        stats: stats || null,
        effectiveStats: finalStats || undefined,
        quests: questList,
        inventory,
        logs: logs.rows || [],
        modifiers,
        derivedStats: {
            maxHp,
            maxMana,
            atk,
            def,
            xpPercent,
            dailyQuestCount,
            secondaryStats: finalStats ? StatsManager.calculateSecondaryStats(finalStats, modifiers, profile?.hunter_class || 'NONE') : {
                critChance: 0,
                dodgeChance: 0,
                lootFind: 0,
                critMultiplier: 1.5
            }
        },
        totalCompletions: parseInt(completionsCount?.count || '0'),
        hasDefeatedIgris: !!igrisDefeat,
        availableShadows: shadowStats.available, // Keep for backward compat if needed,
        activeAssignments,
        shadowStats,
        hotbar,
        activeBoss,
        ...(() => {
            const allLogs: any[] = logs.rows || [];
            const now = new Date();
            const todayStr = reportDay;

            // Start of this week (Monday)
            const dayOfWeek = now.getDay() || 7; // Sun=7
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - dayOfWeek + 1);
            weekStart.setHours(0, 0, 0, 0);

            let todayCompletions = 0;
            let weekCompletions = 0;

            // Collect unique completion dates for streak
            const completionDates = new Set<string>();

            for (const log of allLogs) {
                if (!log.completed_at) continue;
                const d = new Date(log.completed_at);
                const dateStr = d.toISOString().slice(0, 10);
                completionDates.add(dateStr);
                if (dateStr === todayStr) todayCompletions++;
                if (d >= weekStart) weekCompletions++;
            }

            // Streak: count consecutive days backwards from today (or yesterday if nothing today yet)
            let streak = 0;
            const checkDate = new Date(now);
            // If no completions today, start from yesterday
            if (!completionDates.has(todayStr)) {
                checkDate.setDate(checkDate.getDate() - 1);
            }
            while (completionDates.has(checkDate.toISOString().slice(0, 10))) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }

            // Calculate offline gaps (up to 7 missed days)
            const offlineGaps: string[] = [];
            let lastDateStr: string | null = null;
            // Find the most recent completion date BEFORE today
            for (const d of completionDates) {
                if (d === todayStr) continue;
                if (!lastDateStr || d > lastDateStr) {
                    lastDateStr = d;
                }
            }

            if (lastDateStr) {
                const lastDate = new Date(lastDateStr);
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                
                // If last completion was before yesterday, we have gaps
                const diffTime = yesterday.getTime() - lastDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 0) {
                    const gapStart = new Date(lastDate);
                    gapStart.setDate(gapStart.getDate() + 1);
                    
                    let limit = 7; // Max 7 days of recovery
                    while (gapStart <= yesterday && limit > 0) {
                        const gapStr = gapStart.toISOString().slice(0, 10);
                        if (!completionDates.has(gapStr)) {
                            offlineGaps.push(gapStr);
                        }
                        gapStart.setDate(gapStart.getDate() + 1);
                        limit--;
                    }
                }
            }

            return { todayCompletions, weekCompletions, streak, offlineGaps, reportDay };
        })()
    };
}
