import { revalidatePath } from "next/cache";
import { awardXp } from "./xp-rewards";
import type { AuthenticatedUser } from "@/lib/auth-utils";
import { generateQuestLoot } from "@/lib/game-logic/loot";
import { AchievementManager } from "@/lib/achievement-manager";
import { awardBossRewards } from "./boss-rewards";
import { StatsManager } from "@/lib/stats-manager";
import { type StatusEffect } from "@/lib/game-logic/boss-ability-manager";
import { SkillRewardsSchema } from "@/lib/types/zod-schemas";
import { calculateScaledQuestReward, isPostCap, DAILY_ALL_CLEAR_TARGET, DAILY_ALL_CLEAR_XP, DAILY_ALL_CLEAR_GOLD } from "@/lib/system/formula";
import { logTransaction } from "@/lib/server/audit";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { calculateShadowEffect } from "@/lib/game-logic/shadow-data";
import { calculateBossCombatRound } from "@/lib/game-logic/boss-combat";
import { calculateQuestManaEfficiency, cleansePurifiableStatusEffects } from "@/lib/system/skill-effects";
import { gameDb as db, withGameTransaction } from "./game-db";
import { getAccessibleQuest, assertQuestOpen } from "./quest-access";

export async function completeQuest(user: AuthenticatedUser, questId: string, { skipManaCost = false }: { skipManaCost?: boolean } = {}) {
    return withGameTransaction(user.id, async () => {
        const quest = await getAccessibleQuest<{
            id: string; title: string; type: string; difficulty: string;
            xp_reward: number; mana_cost: number; gold_reward: number; skill_rewards: any; frequency?: string;
        }>(user.id, questId);
        await assertQuestOpen(user.id, questId);

        // 2. Fetch profile, stats, and learned skills in parallel
        const [profile, stats, skillRows] = await Promise.all([
            db.queryOne<{
                level: number; current_mana: number; current_hp: number; gold_credits: number;
                hunter_class: string; status_effects: any; hunter_rank: string;
                shadow_infantry_count: number; shadow_storage_limit: number;
            }>(
                "SELECT level, current_mana, current_hp, gold_credits, hunter_class, status_effects, hunter_rank, shadow_infantry_count, shadow_storage_limit FROM profiles WHERE id = $1",
                [user.id]
            ),
            db.queryOne<{
                strength: number; agility: number; intelligence: number; vitality: number;
                perception: number; charisma: number; focus: number; willpower: number; luck: number;
            }>("SELECT * FROM hunter_stats WHERE user_id = $1", [user.id]),
            db.query<{ current_level: number; max_level: number; name: string; category: string; stat_bonus: any }>(
                `SELECT us.current_level, s.max_level, s.name, s.category, s.stat_bonus
                 FROM user_skills us
                 JOIN skills s ON us.skill_id = s.id
                 WHERE us.user_id = $1 AND us.current_level > 0`,
                [user.id]
            )
        ]);
        if (!profile) throw new Error("Profile not found");

        // 3. Status effect processing
        let activeEffects: StatusEffect[] = Array.isArray(profile.status_effects) ? profile.status_effects : [];
        const scaledSkillModifiers = StatsManager.calculateScaledSkillModifiers(
            skillRows.rows || [],
            profile.level || 1
        );
        const earlySkillModifiers = StatsManager.aggregateModifiers(scaledSkillModifiers);
        const purificationResult = cleansePurifiableStatusEffects(activeEffects, earlySkillModifiers);
        const purifiedStatuses = purificationResult.cleansedEffects.map(effect => effect.name || effect.type || 'Unknown status');
        if (purifiedStatuses.length > 0) {
            activeEffects = purificationResult.remainingEffects;
            await db.query(
                "UPDATE profiles SET status_effects = $1 WHERE id = $2",
                [JSON.stringify(activeEffects), user.id]
            );
        }
        let statusHpLoss = 0;
        let blockActionReason: string | null = null;
        let effectsChanged = false;
        const currentHp = profile.current_hp || 100;
        const maxHp = 100 + ((stats?.vitality || 10) * 10);

        const processedEffects: StatusEffect[] = [];
        for (const effect of activeEffects) {
            if (effect.damagePercent) { statusHpLoss += Math.floor(maxHp * effect.damagePercent); effectsChanged = true; }
            if (effect.isStun) blockActionReason = effect.description || "Stunned";
            const newDuration = (effect.duration || 0) - 1;
            if (newDuration > 0) processedEffects.push({ ...effect, duration: newDuration });
            effectsChanged = true;
        }

        if (statusHpLoss > 0 || effectsChanged) {
            activeEffects = processedEffects;
            const newHp = Math.max(0, currentHp - statusHpLoss);
            await db.query("UPDATE profiles SET current_hp = $1, status_effects = $2 WHERE id = $3",
                [newHp, JSON.stringify(activeEffects), user.id]);
            if (newHp <= 0) throw new Error("You have succumbed to your wounds (Status Effect).");
        }

        // 4. Load equipment + titles for modifier aggregation
        const [eqRes, titleRes] = await Promise.all([
            db.query<{ effect: any }>(`
                SELECT i.effect FROM inventory inv
                JOIN items i ON inv.item_id = i.id
                WHERE inv.user_id = $1 AND inv.equipped = true
            `, [user.id]),
            db.query<{ modifiers: any }>(`
                SELECT t.modifiers FROM user_titles ut
                JOIN titles t ON ut.title_id = t.id
                WHERE ut.user_id = $1 AND ut.is_equipped = true
            `, [user.id])
        ]);
        const equipment = eqRes.rows.map(r => r.effect || {});
        const titleModifiers = titleRes.rows.map(r => r.modifiers || {});
        const allModifiers = [
            ...equipment,
            ...titleModifiers,
            ...scaledSkillModifiers,
            ...activeEffects.map(e => (e as any).modifiers || {})
        ];
        const aggregatedModifiers = StatsManager.aggregateModifiers(allModifiers);

        const manaEfficiency = calculateQuestManaEfficiency(aggregatedModifiers);

        // 5. Shadow bonuses
        const summonedShadows = await db.query<{ boss_name: string, level: number }>(
            "SELECT b.name as boss_name, s.level FROM shadows s JOIN bosses b ON s.boss_id = b.id WHERE s.user_id = $1 AND s.status = 'SUMMONED'",
            [user.id]
        );
        const shadowBonuses = { xpMult: 1.0, manaDiscount: 1.0, goldMult: 1.0, skillXpMult: 1.0 };
        const SHADOW_BONUS_MAP: Record<string, keyof typeof shadowBonuses> = {
            "Giant Arachnid Buryura": 'xpMult',
            "Blue Venom-Fanged Kasaka": 'manaDiscount',
            "Hwang Dongsuk": 'goldMult',
            "Baruka (Ice Elf Leader)": 'skillXpMult',
        };
        for (const shadow of summonedShadows.rows) {
            const level = shadow.level || 1;
            const bonus = calculateShadowEffect(shadow.boss_name, level) / 100;
            if (shadow.boss_name === "Blue Venom-Fanged Kasaka") {
                shadowBonuses.manaDiscount *= (1 - bonus);
            } else if (SHADOW_BONUS_MAP[shadow.boss_name]) {
                shadowBonuses[SHADOW_BONUS_MAP[shadow.boss_name]] += bonus;
            }
        }

        // 6. Reward calculation (single call, destructure all needed fields)
        const recalculatedStats = await recalculateAndClampPlayerStats(user.id);
        const { maxMana } = recalculatedStats;
        const dailyRes = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM user_quests uq
             JOIN quests q ON uq.quest_id = q.id
             WHERE uq.user_id = $1 AND q.frequency = 'Daily' AND uq.status = 'Complete' AND uq.completed_at >= CURRENT_DATE`,
            [user.id]
        );
        const completedDailies = parseInt(dailyRes?.count || '0');

        const { finalXp: baseXp, finalGold, finalManaCost: scaledManaCost, synergyStat, synergyBonusXp } =
            calculateScaledQuestReward(
                quest.xp_reward || 0, quest.gold_reward || 0, quest.mana_cost || 0,
                profile.level || 1, stats || undefined, quest.skill_rewards,
                completedDailies, quest.difficulty, shadowBonuses, maxMana
            );

        let finalXp = baseXp;

        // Modifiers on XP
        if (blockActionReason) { finalXp = Math.floor(finalXp * 0.5); }
        if (isPostCap(profile.level || 1)) finalXp = Math.floor(finalXp * 2.0);
        const xpGainMod = aggregatedModifiers['xp_gain_percent'] || 0;
        if (xpGainMod > 0) finalXp = Math.floor(finalXp * (1 + xpGainMod));

        // Mana check
        const cost = skipManaCost ? 0 : Math.floor(scaledManaCost * manaEfficiency);
        if ((profile.current_mana || 0) < cost) {
            throw new Error(`Insufficient Mana. Required: ${cost}, Current: ${profile.current_mana}`);
        }

        // 7. Skill XP rewards
        const rewardParsed = SkillRewardsSchema.safeParse(quest.skill_rewards);
        const skillRewards = rewardParsed.success ? rewardParsed.data : {};
        const manaReward = Math.floor(Number(skillRewards['Mana'] || 0));
        const STAT_KEYS = new Set(['Strength', 'Intelligence', 'Agility', 'Vitality', 'Perception']);

        if (rewardParsed.success) {
            for (const [skillName, xpAmount] of Object.entries(skillRewards)) {
                if (skillName === 'Mana' || STAT_KEYS.has(skillName)) continue;
                const flooredXp = Math.floor(Number(xpAmount));
                const userSkill = await db.queryOne<{ id: number, current_xp: number, current_level: number, max_level: number }>(`
                    SELECT us.id, us.current_xp, us.current_level, s.max_level
                    FROM user_skills us JOIN skills s ON us.skill_id = s.id
                    WHERE us.user_id = $1 AND s.name = $2
                `, [user.id, skillName]);
                if (!userSkill) continue;
                const finalSkillXp = Math.floor(flooredXp * (shadowBonuses.skillXpMult || 1.0));
                if (finalSkillXp <= 0) continue;
                let newXp = (userSkill.current_xp || 0) + finalSkillXp;
                let newLevel = userSkill.current_level || 1;
                const maxLevel = userSkill.max_level || 10;
                while (newXp >= 100 && newLevel < maxLevel) { newXp -= 100; newLevel++; }
                await db.query(
                    "UPDATE user_skills SET current_xp = $1, current_level = $2 WHERE id = $3",
                    [newXp, newLevel, userSkill.id]
                );
            }
        }

        // 8. Gold + Mana update
        const goldBonusMult = equipment.reduce((m, e) => m * (1 + (e.gold_bonus || 0)), 1);
        const totalGold = Math.floor(finalGold * goldBonusMult);
        const finalNewMana = Math.floor((profile.current_mana || 0) - cost + manaReward);
        await db.query(
            "UPDATE profiles SET current_mana = $1, gold_credits = gold_credits + $2 WHERE id = $3",
            [finalNewMana, totalGold, user.id]
        );

        // 9. Mark quest complete
        await db.query(
            `INSERT INTO user_quests (user_id, quest_id, status, completed_at)
             VALUES ($1, $2, 'Complete', NOW())
             ON CONFLICT (user_id, quest_id) DO UPDATE SET status = 'Complete', completed_at = NOW()`,
            [user.id, questId]
        );

        // 10. Penalty quest cleanup
        if (quest.type === 'PENALTY' || quest.title.includes('PENALTY: Survival')) {
            await db.query(
                `DELETE FROM quests WHERE user_id = $1 AND id != $2 AND (type = 'PENALTY' OR title ILIKE 'PENALTY: Survival%')`,
                [user.id, questId]
            );
        }

        // 11. Audit + habit log
        try {
            await logTransaction(user.id, "QUEST_COMPLETE", { gold: totalGold, xp: finalXp }, { questId, title: quest.title });
            if (quest.type === 'Daily' || quest.frequency === 'Daily') {
                await db.query(
                    "INSERT INTO habit_logs (user_id, habit_name, completed_at) VALUES ($1, $2, $3)",
                    [user.id, quest.title, new Date().toISOString()]
                );
            }
        } catch (logErr) { console.warn("Failed to log quest history", logErr); }

        // 12. Boss combat round
        let bossDamageResult: Record<string, any> = {};
        let bossErrorString: string | null = null;
        try {
            await db.transaction(async () => {
                const activeEncounter = await db.queryOne<{
                    id: string; boss_id: string; boss_name: string; current_hp: number;
                    max_hp: number; intel: any; boss_rank: string; damage_type: string;
                }>(
                    `SELECT ae.id, ae.boss_id, b.name as boss_name, ae.current_hp, ae.max_hp, b.intel, b.rank as boss_rank, b.damage_type
                 FROM active_encounters ae JOIN bosses b ON ae.boss_id = b.id
                 WHERE ae.user_id = $1 AND ae.status = 'ACTIVE' FOR UPDATE OF ae`,
                    [user.id]
                );

                if (activeEncounter) {
                    const { rows: equippedItems } = await db.query(
                        `SELECT it.effect, it.type, it.slot, it.name as item_name FROM inventory i JOIN items it ON i.item_id = it.id WHERE i.user_id = $1 AND i.equipped = true`,
                        [user.id]
                    );
                    const rawStats = {
                        strength: stats?.strength || 10, agility: stats?.agility || 10,
                        intelligence: stats?.intelligence || 10, perception: stats?.perception || 10,
                        vitality: stats?.vitality || 10, charisma: stats?.charisma || 10,
                        focus: stats?.focus || 10, willpower: stats?.willpower || 10, luck: stats?.luck || 10,
                    };

                    const combatResult = await calculateBossCombatRound({
                        userId: user.id, questId, questDifficulty: quest.difficulty || 'E',
                        activeEncounter, rawStats,
                        effectiveStats: recalculatedStats.effectiveStats,
                        skillModifiers: recalculatedStats.skillModifiers,
                        equipmentList: equippedItems.map((e: any) => ({ effect: e.effect, type: e.type, slot: e.slot, item_name: e.item_name })),
                        equipment, hunterClass: profile.hunter_class || 'NONE',
                        hunterLevel: profile.level || 1, hunterRank: profile.hunter_rank || 'E',
                        shadowInfantryCount: profile.shadow_infantry_count || 0,
                        shadowStorageLimit: profile.shadow_storage_limit || 0,
                        currentPlayerMana: finalNewMana,
                        statusEffects: activeEffects, titleModifiers,
                        activeEffects, isStunned: !!blockActionReason, maxPlayerHp: maxHp,
                    });

                    // Write boss HP
                    await db.query("UPDATE active_encounters SET current_hp = $1, last_updated = $2 WHERE id = $3",
                        [combatResult.currentHp, new Date().toISOString(), activeEncounter.id]);

                    // Write updated status effects if boss applied one
                    if (combatResult.updatedStatusEffects) {
                        await db.query("UPDATE profiles SET status_effects = $1 WHERE id = $2",
                            [JSON.stringify(combatResult.updatedStatusEffects), user.id]);
                    }

                    // Resolve boss damage, Mana Shield absorption, and Life Drain healing
                    // together so one boss round cannot overwrite another HP/MP update.
                    const incomingDamage = combatResult.evaded ? 0 : (combatResult.playerDamage || 0);
                    const incomingManaDamage = combatResult.evaded ? 0 : (combatResult.playerManaDamage || 0);
                    const playerHealing = combatResult.playerHealing || 0;
                    if (incomingDamage > 0 || incomingManaDamage > 0 || playerHealing > 0) {
                        const freshProfile = await db.queryOne<{ current_hp: number; current_mana: number }>(
                            "SELECT current_hp, current_mana FROM profiles WHERE id = $1", [user.id]
                        );
                        const currentProfileHp = freshProfile?.current_hp || 100;
                        const currentProfileMana = freshProfile?.current_mana || 0;
                        const pNewHp = Math.min(maxHp, Math.max(1, currentProfileHp - incomingDamage + playerHealing));
                        const pNewMana = Math.max(0, currentProfileMana - incomingManaDamage);
                        await db.query("UPDATE profiles SET current_hp = $1, current_mana = $2 WHERE id = $3", [pNewHp, pNewMana, user.id]);
                    }

                    bossDamageResult = combatResult;

                    if (combatResult.currentHp === 0) {
                        const rewards = await awardBossRewards(user, activeEncounter.boss_id, activeEncounter.id);
                        try {
                            await db.query(
                                `INSERT INTO quest_logs (user_id, quest_id, quest_title, quest_type, difficulty, xp_reward, gold, synergy_stat, completed_at)
                             VALUES ($1, NULL, $2, 'BOSS', $3, $4, $5, NULL, NOW())`,
                                [user.id, activeEncounter.boss_name, activeEncounter.boss_rank, rewards.xp || 0, rewards.gold || 0]
                            );
                        } catch { /* non-critical */ }
                        bossDamageResult.victory = true;
                        if (rewards) {
                            bossDamageResult.rewards = {
                                xp: rewards.xp || 0, gold: rewards.gold || 0,
                                drops: rewards.drops || [], bossName: rewards.bossName || 'Unknown Boss',
                                bossImage: rewards.bossImage, shadowExtracted: rewards.shadowExtracted,
                            };
                        }
                    }
                }
            });
        } catch (bossErr: unknown) {
            const errMsg = (bossErr as Error)?.message || "Unknown Boss Logic Error";
            bossErrorString = errMsg;
            bossDamageResult = {};
            try {
                await db.query(`INSERT INTO debug_logs (message) VALUES ($1)`, [`[BossErr] ${errMsg}`]);
            } catch { /* non-critical */ }
        }

        // 13. Quest log
        try {
            await db.query(
                `INSERT INTO quest_logs (user_id, quest_id, quest_title, quest_type, difficulty, xp_reward, gold, synergy_stat, completed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [user.id, questId, quest.title, quest.type, quest.difficulty, finalXp, totalGold, synergyStat || null]
            );
        } catch { /* non-critical */ }

        // 13b. Daily Regimen All-Clear Bounty (Lore: Solo Leveling Daily Quest Completion Reward Box)
        // Awards a one-time daily bounty (+10,000 XP, +5,000 Gold, Full HP/MP Recovery) when reaching 9+ dailies.
        let dailyBountyAwarded: { xp: number; gold: number; title: string } | null = null;
        const isDailyQuest = quest.frequency === 'Daily' || quest.type === 'Daily';
        const newCompletedDailies = completedDailies + (isDailyQuest ? 1 : 0);

        if (newCompletedDailies >= DAILY_ALL_CLEAR_TARGET) {
            const existingBounty = await db.queryOne<{ id: number }>(
                `SELECT id FROM quest_logs
                 WHERE user_id = $1 AND quest_type = 'DAILY_BOUNTY' AND completed_at >= CURRENT_DATE`,
                [user.id]
            );

            if (!existingBounty) {
                dailyBountyAwarded = {
                    xp: DAILY_ALL_CLEAR_XP,
                    gold: DAILY_ALL_CLEAR_GOLD,
                    title: "DAILY REGIMEN ALL-CLEAR"
                };

                // 1. Log the bounty in quest_logs for audit and idempotency
                await db.query(
                    `INSERT INTO quest_logs (user_id, quest_id, quest_title, quest_type, difficulty, xp_reward, gold, synergy_stat, completed_at)
                         VALUES ($1, NULL, '[SYSTEM] Daily Regimen All-Clear', 'DAILY_BOUNTY', 'S', $2, $3, NULL, NOW())`,
                    [user.id, DAILY_ALL_CLEAR_XP, DAILY_ALL_CLEAR_GOLD]
                );

                // 2. Grant bounty gold
                await db.query(
                    "UPDATE profiles SET gold_credits = gold_credits + $1 WHERE id = $2",
                    [DAILY_ALL_CLEAR_GOLD, user.id]
                );

                // 3. Status Recovery: Full HP & Mana Restore outside active boss combat
                const activeCombat = await db.queryOne(
                    "SELECT id FROM active_encounters WHERE user_id = $1 AND status = 'ACTIVE'",
                    [user.id]
                );
                if (!activeCombat) {
                    const { maxHp: fullHp, maxMana: fullMana } = await recalculateAndClampPlayerStats(user.id);
                    await db.query(
                        "UPDATE profiles SET current_hp = $1, current_mana = $2 WHERE id = $3",
                        [fullHp, fullMana, user.id]
                    );
                }
            }
        }

        // 14. XP grant (combines quest XP and daily bounty XP atomically)
        const totalXpToGrant = finalXp + (dailyBountyAwarded ? dailyBountyAwarded.xp : 0);
        const xpResult = await awardXp(user.id, totalXpToGrant);

        // 15. Loot
        let droppedItems: Record<string, any>[] = [];
        if (quest.difficulty) {
            const { dropped, items } = await generateQuestLoot(quest.difficulty, user.id);
            if (dropped && items) droppedItems = items;
        }

        // 16. Achievements
        const unlocked: any[] = xpResult.unlocked || [];
        let earnedXp = xpResult.earnedXp || 0;
        let questAchievementXp = 0;
        try {
            const [qLogs, eLogs] = await Promise.all([
                db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM user_quests WHERE user_id = $1 AND status = 'Complete'", [user.id]),
                db.queryOne<{ count: string }>(
                    `SELECT COUNT(*) as count FROM user_quests uq
                     JOIN quests q ON uq.quest_id = q.id
                     WHERE uq.user_id = $1 AND uq.status = 'Complete' AND q.difficulty = 'E'`,
                    [user.id]
                )
            ]);
            const { unlocked: newUnlocked, totalXp: achXp } = await new AchievementManager().checkAchievements(
                user.id, 'QUEST_COMPLETE',
                { total_quests: parseInt(qLogs?.count || '0'), total_e_rank: parseInt(eLogs?.count || '0') }
            );
            if (newUnlocked.length > 0) unlocked.push(...newUnlocked);
            earnedXp += achXp;
            questAchievementXp = achXp;
        } catch (err) { console.error("Achievement Check Failed:", err); }

        // Newly claimed quest achievements must grant the XP shown in their
        // notification. Keep this award in the parent gameplay transaction.
        if (questAchievementXp > 0) {
            const achievementAward = await awardXp(user.id, questAchievementXp);
            if (achievementAward.newLevel) xpResult.newLevel = achievementAward.newLevel;
            unlocked.push(...achievementAward.unlocked);
            earnedXp += achievementAward.earnedXp;
        }

        // 17. Shadow extraction (infantry)
        let shadowExtracted = false;
        try {
            const { extractShadow } = await import("./shadow-extraction");
            const shadowRes = await extractShadow(user, { source: 'DUNGEON' });
            if (shadowRes?.success) shadowExtracted = true;
        } catch { /* non-critical */ }

        // 18. Itarim (Outer God) AP Grant
        let grantedItarimAp = false;
        const hasItarim = summonedShadows.rows.some(s => s.boss_name === 'Itarim (Outer God)');
        if (hasItarim) {
            try {
                const qLogsRes = await db.queryOne<{ count: string }>(
                    "SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1",
                    [user.id]
                );
                const lifetimeTasks = parseInt(qLogsRes?.count || '0');
                if (lifetimeTasks > 0 && lifetimeTasks % 100 === 0) {
                    await db.query("UPDATE profiles SET available_ap = available_ap + 1 WHERE id = $1", [user.id]);
                    grantedItarimAp = true;
                    try {
                        await logTransaction(user.id, "ITARIM_AP_GRANT", { sp: 1 }, { lifetimeTasks });
                    } catch { /* ignore log error */ }
                }
            } catch (err) {
                console.error("Itarim check failed:", err);
            }
        }

        revalidatePath("/dashboard/quests");
        revalidatePath("/dashboard", "layout");

        return {
            success: true, unlocked, earnedXp,
            loot: droppedItems.length > 0 ? droppedItems.filter((i: any) => !i.auto_sold) : null,
            synergy: synergyStat ? { stat: synergyStat, bonusXp: synergyBonusXp, bonusGold: 0 } : null,
            purifiedStatuses,
            bossDamage: bossDamageResult, bossError: bossErrorString,
            shadowExtracted, newLevel: xpResult.newLevel, grantedItarimAp,
            dailyBounty: dailyBountyAwarded
        };
    });
}
