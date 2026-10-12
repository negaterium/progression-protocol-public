import { gameDb as db } from "@/lib/server/game-db";
import { StatsManager } from "@/lib/stats-manager";
import { ItemEffectSchema } from "@/lib/types/zod-schemas";
import { applyQualityToEffect } from "@/lib/game-logic/item-roller";
import { getActiveShadowModifiers } from "@/lib/game-logic/shadow-data";
import { calculateItemStatScale, SCALABLE_ATTRIBUTES } from "@/lib/system/formula";

export interface PlayerStatsContext {
    profile: any;
    stats: any;
    inventory: any[];
    modifiers: Record<string, number>;
    skillModifiers: Record<string, number>;
    statusEffects: any[];
    summonedElites: any[];
}

/**
 * Centrally loads all data required to calculate a player's current effective stats and modifiers.
 * Includes Titles, Equipment (Quality Scaled), Skills, Status Effects, and Active Shadows.
 */
export async function getServerPlayerContext(userId: string): Promise<PlayerStatsContext> {
    const [profile, stats, inventoryRows, allTitles, skillRows, eliteShadowsRow] = await Promise.all([
        db.queryOne<any>("SELECT * FROM profiles WHERE id = $1", [userId]),
        db.queryOne<any>("SELECT * FROM hunter_stats WHERE user_id = $1", [userId]),
        db.query(`
            SELECT i.*, 
                   it.id as linked_item_id,
                   it.name as item_name, it.description as item_desc, it.type as item_type, 
                   it.rarity as item_rarity, it.slot as item_slot, it.price as item_price, 
                   it.effect as item_effect, it.image_url as item_image
            FROM inventory i
            JOIN items it ON i.item_id = it.id
            WHERE i.user_id = $1 AND i.equipped = true
        `, [userId]),
        db.query('SELECT t.* FROM titles t JOIN user_titles ut ON ut.title_id = t.id WHERE ut.user_id = $1', [userId]),
        db.query(`
            SELECT us.*, s.name, s.stat_bonus, s.category, s.max_level
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            WHERE us.user_id = $1 AND us.current_level > 0
        `, [userId]),
        db.query(`SELECT name, level, status FROM shadows WHERE user_id = $1 AND boss_id IS NOT NULL`, [userId]),
    ]);

    if (!profile || !stats) {
        throw new Error("Required player data not found for stat loading.");
    }

    const modifierSources: Record<string, any>[] = [];

    // 1. Shadows (Elite summoned)
    const summonedElites = (eliteShadowsRow.rows || []).filter((s: any) => s.status === 'SUMMONED');
    const shadowMods = getActiveShadowModifiers(summonedElites);
    if (Object.keys(shadowMods).length > 0) {
        modifierSources.push(shadowMods);
    }

    // 2. Titles
    if (profile.title) {
        const activeTitle = (allTitles.rows || []).find((t: any) => t.name === profile.title);
        if (activeTitle?.modifiers) {
            modifierSources.push(activeTitle.modifiers);
        }
    }

    // 3. Equipment (with quality scaling and player level scaling)
    const playerLevel = profile?.level || 1;
    const inventory = inventoryRows.rows.map(row => {
        const baseEffect = row.item_effect || {};
        const qualityRoll = row.quality_roll || 100.0;
        const rollTier = row.roll_tier || 'COMMON';
        const bonusAffixes = Array.isArray(row.bonus_affixes) ? row.bonus_affixes : [];

        const scaledEffect = applyQualityToEffect(
            baseEffect,
            { qualityPercent: qualityRoll, rollTier: rollTier as any, bonusAffixes },
            row.item_type,
            row.item_slot
        );

        // Apply level-based dynamic scaling
        const lvlScale = calculateItemStatScale(row.item_rarity, playerLevel);
        let finalEffect = scaledEffect;
        if (lvlScale > 1 && row.item_type === 'EQUIPMENT') {
            finalEffect = { ...scaledEffect };
            SCALABLE_ATTRIBUTES.forEach((stat: string) => {
                const v = (finalEffect as any)[stat];
                if (typeof v === 'number' && v > 0) (finalEffect as any)[stat] = Math.round(v * lvlScale);
            });
        }

        return {
            ...row,
            slot: row.item_slot,
            type: row.item_type,
            effect: finalEffect
        };
    });

    inventory.forEach((entry: any) => {
        if (entry.effect) {
            const result = ItemEffectSchema.safeParse(entry.effect);
            if (result.success) {
                modifierSources.push(result.data as any);
            }
        }
    });

    // 4. Skills (Standardized Scaling)
    const skillList = skillRows.rows || [];
    const scaledSkillModifiers = StatsManager.calculateScaledSkillModifiers(skillList, profile.level || 1);
    const skillModifiers = StatsManager.aggregateModifiers(scaledSkillModifiers);
    modifierSources.push(...scaledSkillModifiers);

    // 5. Status Effects
    const statusEffects = Array.isArray(profile.status_effects) ? profile.status_effects : [];
    statusEffects.forEach((eff: any) => {
        if (eff.modifiers) {
            modifierSources.push(eff.modifiers);
        }
    });

    const modifiers = StatsManager.aggregateModifiers(modifierSources);

    return {
        profile,
        stats,
        inventory,
        modifiers,
        skillModifiers,
        statusEffects,
        summonedElites
    };
}
