"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { AchievementManager } from "@/lib/achievement-manager";
import { awardXp } from "@/lib/server/xp-rewards";
import { logTransaction } from "@/lib/server/audit";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import db from "@/lib/db";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { calculateSkillManaCost } from "@/lib/system/formula";
import {
    calculateDominatorsTouchBonuses,
    applyHealingReceivedBonus,
    calculateMutilateMultiplier,
    calculateRecoveryPercent,
    calculateSkillCooldownSeconds,
    calculateShadowExtractionSuccessPercent,
    calculateSprintMultiplier,
    calculateStealthBonuses,
    calculateVitalStrikeBonuses,
} from "@/lib/system/skill-effects";

export async function unlockSkillAction(skillId: string) {
    return safeAction(z.string(), skillId, async (id) => {
        const user = await getAuthenticatedUser();

        // 1. Fetch Profile (SP and Class), Skill (Cost + Bonus), and Existing User Skill
        const profile = await db.queryOne<{ available_sp: number, hunter_class: string }>(
            "SELECT available_sp, hunter_class FROM profiles WHERE id = $1",
            [user.id]
        );

        const skill = await db.queryOne<{ id: number, max_level: number, stat_bonus: any, name: string, cost: number, required_class: string }>(
            "SELECT * FROM skills WHERE id = $1",
            [id]
        );

        if (!profile || !skill) throw new Error("Data error: Profile or skill not found.");

        const existingUserSkill = await db.queryOne<{ id: number, current_level: number }>(
            "SELECT id, current_level FROM user_skills WHERE user_id = $1 AND skill_id = $2",
            [user.id, id]
        );

        // 2. Validation
        if (skill.required_class && skill.required_class !== profile.hunter_class) {
            throw new Error("Class Restriction: You do not have the required class for this module.");
        }

        const isMaxed = existingUserSkill && existingUserSkill.current_level >= (skill.max_level || 10);
        if (isMaxed) throw new Error("Max Level Reached");

        const spCost = skill.cost || 1;

        if ((profile.available_sp || 0) < spCost) {
            throw new Error("Insufficient Skill Points");
        }

        // 3. Deduct SP
        await db.query(
            "UPDATE profiles SET available_sp = $1 WHERE id = $2",
            [(profile.available_sp || 0) - spCost, user.id]
        );

        // 4. Update/Insert User Skill
        if (existingUserSkill) {
            try {
                await db.query(
                    "UPDATE user_skills SET current_level = current_level + 1, current_xp = 0 WHERE id = $1",
                    [existingUserSkill.id]
                );
            } catch {
                // Refund SP if skill update fails
                await db.query("UPDATE profiles SET available_sp = $1 WHERE id = $2", [profile.available_sp, user.id]);
                throw new Error('Skill update failed. Please try again.');
            }
        } else {
            try {
                await db.query(`
                    INSERT INTO user_skills (user_id, skill_id, current_level, current_xp)
                    VALUES ($1, $2, 1, 0)
                `, [user.id, id]);
            } catch {
                // Refund SP
                await db.query("UPDATE profiles SET available_sp = $1 WHERE id = $2", [profile.available_sp, user.id]);
                throw new Error('Skill unlock failed. Please try again.');
            }
        }

        // 5. Check Achievements
        let unlocked: Array<{ code: string; name: string; description: string; xp: number }> = [];
        let earnedXp = 0;

        try {
            const skillsCountRes = await db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM user_skills WHERE user_id = $1", [user.id]);
            const totalSkills = parseInt(skillsCountRes?.count || '0');

            const { rows: allUserSkills } = await db.query(`
                SELECT us.current_level, s.max_level 
                FROM user_skills us
                JOIN skills s ON us.skill_id = s.id
                WHERE us.user_id = $1
            `, [user.id]);

            let maxedCount = 0;
            if (allUserSkills) {
                maxedCount = allUserSkills.filter((us: any) => us.current_level >= (us.max_level || 10)).length;
            }

            const achievementManager = new AchievementManager();
            const { unlocked: newUnlocked, totalXp } = await achievementManager.checkAchievements(user.id, existingUserSkill ? 'SKILL_LEVEL_UP' : 'SKILL_UNLOCK', {
                total_skills: totalSkills,
                maxed_skills: maxedCount
            });
            unlocked = newUnlocked;
            earnedXp = totalXp;

            if (totalXp > 0) {
                await awardXp(user.id, totalXp);
            }

        } catch (err) {
            console.error("Achievement Check Failed:", err);
        }

        await logTransaction(user.id, "SKILL_UNLOCK", { xp: -1 }, { skillId: id, name: skill.name }); // xp -1 denotes point spend

        revalidatePath("/dashboard/skills");
        revalidatePath("/dashboard"); // For stats radar
        return { unlocked, earnedXp };
    });
}

export async function decreaseSkillAction(skillId: string) {
    return safeAction(z.string(), skillId, async (id) => {
        const user = await getAuthenticatedUser();

        // 1. Fetch Skill, UserSkill
        const [skill, userSkill] = await Promise.all([
            db.queryOne<any>("SELECT * FROM skills WHERE id = $1", [id]),
            db.queryOne<any>("SELECT id, current_level FROM user_skills WHERE user_id = $1 AND skill_id = $2", [user.id, id])
        ]);

        if (!skill || !userSkill || userSkill.current_level <= 0) {
            throw new Error("Invalid skill or level");
        }

        // 2. Check if children depend on this skill (Basic check: if this skill is parent, and level is currently 1)
        if (userSkill.current_level === 1) {
            const dependentSkills = await db.queryOne<{ count: string }>(
                "SELECT COUNT(*) as count FROM user_skills us JOIN skills s ON us.skill_id = s.id WHERE us.user_id = $1 AND s.parent_skill_id = $2 AND us.current_level > 0",
                [user.id, id]
            );
            if (parseInt(dependentSkills?.count || '0') > 0) {
                throw new Error("Cannot remove skill: Dependent skills are currently unlocked.");
            }
        }

        const spRefund = skill.cost || 1; // Refund the exact cost per level

        // 3. Update Database
        await db.query("UPDATE user_skills SET current_level = current_level - 1 WHERE id = $1", [userSkill.id]);
        await db.query("UPDATE profiles SET available_sp = available_sp + $1 WHERE id = $2", [spRefund, user.id]);

        await logTransaction(user.id, "SKILL_REFUND", { sp: spRefund }, { skillId: id, name: skill.name });

        revalidatePath("/dashboard/skills");
        revalidatePath("/dashboard");
        return { success: true };
    });
}


export async function activateSkillAction(skillId: string) {
    return safeAction(z.string(), skillId, async (id) => {
        const user = await getAuthenticatedUser();

        // 1. Fetch Skill
        const skill = await db.queryOne<{ id: number, name: string, is_active: boolean, mana_cost: number, effect_type: string, cooldown_seconds: number }>(
            "SELECT * FROM skills WHERE id = $1",
            [id]
        );

        if (!skill) throw new Error("Data error: Skill not found.");
        if (!skill.is_active) throw new Error("This is not an active skill.");

        const existingUserSkill = await db.queryOne<{ id: number, current_level: number, last_used_at: string }>(
            "SELECT id, current_level, last_used_at FROM user_skills WHERE user_id = $1 AND skill_id = $2",
            [user.id, id]
        );

        if (!existingUserSkill || existingUserSkill.current_level <= 0) {
            throw new Error("You have not unlocked this skill yet.");
        }

        const sLevel = existingUserSkill.current_level;

        // 2. Calculate Effective Cooldown
        // Sprint (XP Buff) reduces cooldown by 30 mins (1800s) per level
        const effectiveCooldown = calculateSkillCooldownSeconds(
            skill.cooldown_seconds,
            sLevel,
            skill.effect_type
        );

        // 3. Check Cooldown
        if (effectiveCooldown > 0 && existingUserSkill.last_used_at) {
            const lastUsed = new Date(existingUserSkill.last_used_at).getTime();
            const now = Date.now();
            const elapsed = (now - lastUsed) / 1000;
            const remaining = effectiveCooldown - elapsed;

            if (remaining > 0) {
                const mins = Math.floor(remaining / 60);
                const secs = Math.ceil(remaining % 60);
                const hours = Math.floor(mins / 60);
                if (hours > 0) {
                    throw new Error(`Skill on cooldown. Available in ${hours}h ${mins % 60}m.`);
                }
                throw new Error(`Skill on cooldown. Available in ${mins}m ${secs}s.`);
            }
        }

        // 4. Fetch Stats & Check Mana
        const stats = await recalculateAndClampPlayerStats(user.id);
        const { currentHp, currentMana, maxHp } = stats;

        // Dynamic Mana Cost Scaling (Base Cost + (Skill Level * 2% of Max Mana))
        // Exempt MANA_RESTORATION (Dominator's Touch) from the dynamic penalty to prevent draining
        const effectiveManaCost = calculateSkillManaCost(skill.mana_cost, sLevel, stats.maxMana, skill.effect_type);

        if (currentMana < effectiveManaCost) {
            throw new Error(`Insufficient Mana. Need ${effectiveManaCost} MP.`);
        }

        // 5. Deduct Mana & Update Usage
        await db.query("UPDATE user_skills SET last_used_at = NOW() WHERE id = $1", [existingUserSkill.id]);

        const newMana = currentMana - effectiveManaCost;
        await db.query(
            "UPDATE profiles SET current_mana = $1 WHERE id = $2",
            [newMana, user.id]
        );

        // 6. Trigger Scaled Effects
        let message = `Used ${skill.name}!`;
        const effects: any = {};

        switch (skill.effect_type) {
            case 'INSTANT_HEAL': // Recovery
                // Scale: 20% per level. Level 5 = 100%.
                const healPercent = calculateRecoveryPercent(sLevel);
                const healAmount = applyHealingReceivedBonus(maxHp * healPercent, stats.modifiers);
                const healedHp = Math.min(maxHp, currentHp + healAmount);

                await db.query("UPDATE profiles SET current_hp = $1 WHERE id = $2", [healedHp, user.id]);

                message += ` Restored ${healAmount} HP (${Math.round(healPercent * 100)}%).`;
                effects.heal = healAmount;
                break;

            case 'INSTANT_XP_BUFF': // Sprint
                // Scale: 1.20x Base + 0.1x per level
                const sprintMult = calculateSprintMultiplier(sLevel);
                message += ` Sprint Active! (${sprintMult.toFixed(2)}x XP Gain for 5 Quests)`;

                const currentSprintEffects = await db.queryOne<{ status_effects: any }>("SELECT status_effects FROM profiles WHERE id = $1", [user.id]);
                const activeSprintEffects = Array.isArray(currentSprintEffects?.status_effects) ? currentSprintEffects.status_effects : [];
                const newSprintEffects = activeSprintEffects.filter((e: any) => e.name !== 'Sprint');

                newSprintEffects.push({
                     name: 'Sprint',
                     type: 'BUFF',
                     description: `XP Gain ${sprintMult.toFixed(2)}x`,
                     duration: 5,
                     durationType: 'QUEST',
                     modifiers: { xp_gain_multiplier: sprintMult }
                 });

                 await db.query("UPDATE profiles SET status_effects = $1 WHERE id = $2", [JSON.stringify(newSprintEffects), user.id]);
                 effects.buff = { type: 'XP_MULTIPLIER', val: sprintMult, duration: '5 Quests' };
                 break;

            case 'STEALTH_MODE': // Stealth
                 // Stealth becomes a massive setup + survival skill for 3 Quests
                 // Grants hardcoded 40% Boss Evasion (via quests.ts matching 'STEALTH')
                 // Grants Crit Chance: +20% Base + 5% per level
                const { evasionPercent, critRatePercent: stealthCritBonus } = calculateStealthBonuses(sLevel);
                message += ` Stealth Active! (+${evasionPercent}% Evasion, +${stealthCritBonus}% Crit Rate for 3 Quests)`;
                 
                 const currentStealthEffects = await db.queryOne<{ status_effects: any }>("SELECT status_effects FROM profiles WHERE id = $1", [user.id]);
                 const activeStealthEffects = Array.isArray(currentStealthEffects?.status_effects) ? currentStealthEffects.status_effects : [];
                 const newStealthEffects = activeStealthEffects.filter((e: any) => e.name !== 'Stealth');
                 
                 newStealthEffects.push({
                     name: 'Stealth',
                     type: 'STEALTH',
                     description: `Evade Boss (${evasionPercent}%), Crit Rate +${stealthCritBonus}%`,
                     duration: 3, // 3 Quests
                     durationType: 'QUEST',
                     modifiers: {
                         crit_chance: stealthCritBonus / 100,
                         boss_evasion: evasionPercent / 100,
                     }
                 });
                 
                 await db.query("UPDATE profiles SET status_effects = $1 WHERE id = $2", [JSON.stringify(newStealthEffects), user.id]);
                 effects.buff = { type: 'STEALTH', val: stealthCritBonus, duration: '3 Quests' };
                 break;

            case 'DAMAGE_BUFF': // Mutilate
                 // A massive global damage multiplier that stacks with crits for 3 Quests
                 // Scale: 1.20x Base + 0.05x per level
                 const mutilateMult = calculateMutilateMultiplier(sLevel);
                 message += ` Mutilation Active! (${mutilateMult.toFixed(2)}x Global Damage for 3 Quests)`;
                 
                 const currentMutEffects = await db.queryOne<{ status_effects: any }>("SELECT status_effects FROM profiles WHERE id = $1", [user.id]);
                 const activeMutEffects = Array.isArray(currentMutEffects?.status_effects) ? currentMutEffects.status_effects : [];
                 const newMutEffects = activeMutEffects.filter((e: any) => e.name !== 'Mutilate');
                 
                 newMutEffects.push({
                     name: 'Mutilate',
                     type: 'BUFF',
                     description: `Global Damage ${mutilateMult.toFixed(2)}x`,
                     duration: 3, // 3 Quests
                     durationType: 'QUEST',
                     modifiers: { damage_multiplier: mutilateMult }
                 });
                 
                 await db.query("UPDATE profiles SET status_effects = $1 WHERE id = $2", [JSON.stringify(newMutEffects), user.id]);
                 effects.buff = { type: 'DAMAGE_MULTIPLIER', val: mutilateMult, duration: '3 Quests' };
                 break;

            case 'CRIT_BUFF': // Vital Strike
                // The ultimate boss-killer buff.
                // Scale: Crit Rate +20% Base + 5% per level, Crit Damage +0.5x Base + 0.1x per level
                const { critRatePercent: critRateBonus, critDamageMultiplier: critDamageBonus } = calculateVitalStrikeBonuses(sLevel);
                message += ` Vital Focus! (+${critRateBonus}% Crit Rate, +${critDamageBonus.toFixed(1)}x Crit Damage for 5 Quests)`;

                // [NEW] Persist Buff
                const currentStatusEffects = await db.queryOne<{ status_effects: any }>("SELECT status_effects FROM profiles WHERE id = $1", [user.id]);
                const activeEffects = Array.isArray(currentStatusEffects?.status_effects) ? currentStatusEffects.status_effects : [];

                // Remove existing Vital Strike if any
                const newEffects = activeEffects.filter((e: any) => e.name !== 'Vital Strike');

                newEffects.push({
                    name: 'Vital Strike',
                    type: 'BUFF',
                    description: `Crit Rate +${critRateBonus}%, Crit DMG +${critDamageBonus.toFixed(1)}x`,
                    duration: 5, // 5 Quests
                    durationType: 'QUEST',
                    modifiers: { 
                        crit_chance: critRateBonus / 100,
                        crit_damage: critDamageBonus
                    }
                });

                await db.query("UPDATE profiles SET status_effects = $1 WHERE id = $2", [JSON.stringify(newEffects), user.id]);

                effects.buff = { type: 'CRIT_RATE_AND_DMG', val: [critRateBonus, critDamageBonus], duration: '5 Quests' };
                break;

            case 'MANA_RESTORATION': // Dominators Touch
                // Scale: Restores 10% Base + 5% per level of Max Mana
                const { manaRestorePercent, armorCrushPercent, telekineticPressurePercent } = calculateDominatorsTouchBonuses(sLevel);
                const manaRestore = Math.floor(stats.maxMana * manaRestorePercent);
                const restoredMana = Math.min(stats.maxMana, currentMana + manaRestore);

                // Update the profile directly with new mana (dynamic cost was bypassed)
                await db.query("UPDATE profiles SET current_mana = $1 WHERE id = $2", [restoredMana, user.id]);

                // [NEW] Apply Dominator's Domain Buff
                // Grants Armor Crush and Telekinetic Pressure in quests.ts
                const currentDomEffects = await db.queryOne<{ status_effects: any }>("SELECT status_effects FROM profiles WHERE id = $1", [user.id]);
                const activeDomEffects = Array.isArray(currentDomEffects?.status_effects) ? currentDomEffects.status_effects : [];
                const newDomEffects = activeDomEffects.filter((e: any) => e.name !== "Dominator's Domain");

                newDomEffects.push({
                    name: "Dominator's Domain",
                    type: 'BUFF',
                        description: `Armor Crush +${Math.round(armorCrushPercent * 100)}%, Telekinetic Pressure (${Math.round(telekineticPressurePercent * 100)}% HP/task)`,
                    duration: 2, // 2 Quests
                    durationType: 'QUEST',
                    modifiers: { 
                        armor_crush: armorCrushPercent,
                        telekinetic_pressure: telekineticPressurePercent,
                    }
                });

                await db.query("UPDATE profiles SET status_effects = $1 WHERE id = $2", [JSON.stringify(newDomEffects), user.id]);

                message += ` Restored ${manaRestore} MP (${Math.round(manaRestorePercent * 100)}%). Your authority over the domain is absolute.`;
                effects.mana_restore = manaRestore;
                effects.buff = { type: 'DOMINATORS_DOMAIN', val: sLevel, duration: '2 Quests' };
                break;

            case 'SHADOW_EXTRACTION': // Shadow Exchange / Extraction
                // 1. Check Storage
                const profileShadows = await db.queryOne<{ shadow_infantry_count: number, shadow_storage_limit: number, hunter_class: string, title: string }>(
                    "SELECT shadow_infantry_count, shadow_storage_limit, hunter_class, title FROM profiles WHERE id = $1",
                    [user.id]
                );

                const currentShadows = profileShadows?.shadow_infantry_count || 0;
                const limit = profileShadows?.shadow_storage_limit || 0;

                if (currentShadows >= limit) {
                    message += " Shadow Storage Full. Cannot extract more soldiers.";
                } else {
                    // 2. Calculate Success Chance & Yield
                    let successChance = calculateShadowExtractionSuccessPercent(sLevel);

                    // Necromancer / Shadow Monarch Bonus
                    let isNecromancer = false;
                    if (profileShadows?.hunter_class === 'Necromancer' || profileShadows?.title?.includes('Shadow Monarch')) {
                        successChance = 100;
                        isNecromancer = true;
                    }

                    const roll = Math.random() * 100;
                    if (roll <= successChance) {
                        // Success!
                        // Yield Scales with Intelligence: Base 5 + Math.floor(Int / 50)
                        const intStat = stats.effectiveStats.intelligence || 10;
                        let yieldAmt = 5 + Math.floor(intStat / 50);
                        if (isNecromancer) yieldAmt *= 2; // Double for Necromancers

                        const actualYield = Math.min(yieldAmt, limit - currentShadows);

                        await db.query("UPDATE profiles SET shadow_infantry_count = shadow_infantry_count + $1 WHERE id = $2", [actualYield, user.id]);
                        message += ` ARISE. ${actualYield} Shadow Soldier(s) joined your army.`;
                        effects.shadow_extracted = actualYield;
                    } else {
                        // Failure
                        message += " Extraction Failed. The target's will was too strong.";
                        effects.shadow_extracted = 0;
                    }
                }
                break;

            default:
                message += " Effect triggered.";
        }

        // 7. Log Transaction
        await logTransaction(user.id, "SKILL_USE", { mana: -effectiveManaCost, ...effects }, { skillId: id, name: skill.name, level: sLevel });

        revalidatePath("/dashboard");
        return { success: true, message, newMana };
    });
}

export async function resetAllSkillsAction() {
    return safeAction(z.any().optional(), undefined, async () => {
        const user = await getAuthenticatedUser();

        // 1. Fetch all user skills, their levels, and skill bonuses
        const userSkillsRes = await db.query(`
            SELECT us.id, us.current_level, s.cost, s.stat_bonus 
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            WHERE us.user_id = $1 AND us.current_level > 0
        `, [user.id]);

        const userSkills = userSkillsRes.rows || [];
        let totalSpRefund = 0;
        for (const us of userSkills) {
            const costPerLevel = us.cost || 1;
            totalSpRefund += us.current_level * costPerLevel;
        }

        // 3. Update Profile and Wipe Skills
        await db.query("UPDATE profiles SET available_sp = available_sp + $1 WHERE id = $2", [totalSpRefund, user.id]);
        await db.query("DELETE FROM user_skills WHERE user_id = $1", [user.id]);

        await logTransaction(user.id, "SKILL_RESET", { sp: totalSpRefund }, {});

        revalidatePath("/dashboard/skills");
        revalidatePath("/dashboard/skills");
        revalidatePath("/dashboard");
        return { refunded: totalSpRefund };
    });
}

export async function equipSkillToHotbarAction(skillId: string, slot: number) {
    return safeAction(z.object({ skillId: z.string(), slot: z.number().min(1).max(5) }), { skillId, slot }, async ({ skillId, slot }) => {
        const user = await getAuthenticatedUser();

        // Check if skill is unlocked and active
        const userSkill = await db.queryOne<{ id: number }>(`
            SELECT us.id FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            WHERE us.user_id = $1 AND us.skill_id = $2 AND us.current_level > 0 AND s.is_active = true
        `, [user.id, skillId]);

        if (!userSkill) throw new Error("Skill not found or not an active skill.");

        // Clear slot first (if occupied)
        await db.query("UPDATE user_skills SET hotbar_slot = NULL WHERE user_id = $1 AND hotbar_slot = $2", [user.id, slot]);

        // Equip
        await db.query("UPDATE user_skills SET hotbar_slot = $1 WHERE id = $2", [slot, userSkill.id]);

        revalidatePath("/dashboard");
        return { success: true };
    });
}

export async function unequipSkillFromHotbarAction(slot: number) {
    return safeAction(z.number().min(1).max(5), slot, async (s) => {
        const user = await getAuthenticatedUser();
        await db.query("UPDATE user_skills SET hotbar_slot = NULL WHERE user_id = $1 AND hotbar_slot = $2", [user.id, s]);
        revalidatePath("/dashboard");
        return { success: true };
    });
}
