import { gameDb as db } from "@/lib/server/game-db";

export class AchievementManager {
    // No constructor needed as we use the singleton db

    /**
     * core check function to be called from various actions.
     * @param userId
     * @param eventType - e.g. 'LEVEL_UP', 'QUEST_COMPLETE', 'STAT_UPDATE'
     * @param data - contextual data (e.g. current level, total quests completed)
     */
    async checkAchievements(userId: string, eventType: string, data: any) {
        // This function will contain the specific logic for each achievement trigger.
        // For efficiency, we can filter triggers by eventType.

        const newlyUnlocked: Array<{ code: string; name: string; description: string; xp: number; gold?: number; item?: any }> = [];

        // 1. Fetch user's existing achievements to avoid re-checking/re-inserting
        const { rows: existing } = await db.query(`
            SELECT ua.achievement_id, a.code
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = $1
        `, [userId]);

        const unlockedCodes = new Set(existing.map((row: any) => row.code));

        // 1.5 Fetch retroactive data if not provided (Enable 'SYNC' or 'LOGIN' events)
        const context = { ...data };
        if (eventType === 'SYNC' || eventType === 'LOGIN' || eventType === 'QUEST_COMPLETE' || eventType === 'BOSS_KILL' || eventType === 'CLASS_CHANGE') {
            // ... (rest of the gathering logic)
            // But if it's BOSS_KILL, we might already have the boss name in data.
            // Let's gather everything to be safe and thorough for titles.

            // ... (existing gathering code)
            // Count Wolf-type kills from quest logs
            const wolfLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs
                WHERE user_id = $1 AND (quest_title ILIKE '%Wolf%' OR quest_title ILIKE '%Lycan%')
            `, [userId]);

            // Count Demon-type kills (Quests + Bosses)
            const demonQuestLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs
                WHERE user_id = $1 AND (quest_title ILIKE '%Demon%' OR quest_title ILIKE '%Hell%')
            `, [userId]);

            const demonBossLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM active_encounters ae
                JOIN bosses b ON ae.boss_id = b.id
                WHERE ae.user_id = $1 AND ae.status = 'DEFEATED' AND (b.type ILIKE '%Demon%' OR b.name ILIKE '%Demon%')
            `, [userId]);


            // Real Life Habit Counts
            const meditationLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND (quest_title ILIKE '%Meditation%' OR quest_type = 'Meditation')
            `, [userId]);

            const deepWorkLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND (quest_title ILIKE '%Deep Work%' OR quest_title ILIKE '%Code%' OR quest_title ILIKE '%Focus%')
            `, [userId]);

            const fitnessLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND (quest_title ILIKE '%Workout%' OR quest_title ILIKE '%Pushup%' OR quest_title ILIKE '%Strength%' OR quest_title ILIKE '%Yoga%')
            `, [userId]);

            const learningLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND (quest_title ILIKE '%Read%' OR quest_title ILIKE '%Study%' OR quest_title ILIKE '%Library%' OR quest_title ILIKE '%Theory%')
            `, [userId]);

            const financeLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND (quest_title ILIKE '%Finance%' OR quest_title ILIKE '%Budget%' OR quest_title ILIKE '%Money%')
            `, [userId]);

            const explorerLog = await db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND (quest_title ILIKE '%Walk%' OR quest_title ILIKE '%Hike%' OR quest_title ILIKE '%Explor%' OR quest_title ILIKE '%Terrain%')
            `, [userId]);

            context.wolf_kills = parseInt(wolfLog?.count || '0');
            context.demon_kills = (parseInt(demonQuestLog?.count || '0') * 5) + parseInt(demonBossLog?.count || '0');

            // Retroactive Boss Kills
            const defeatedBosses = await db.query(`
                SELECT b.name
                FROM active_encounters ae
                JOIN bosses b ON ae.boss_id = b.id
                WHERE ae.user_id = $1 AND ae.status = 'DEFEATED'
            `, [userId]);

            context.defeated_boss_names = new Set(defeatedBosses.rows.map((r: any) => r.name));
            context.igris_defeated = context.defeated_boss_names.has('Blood-Red Commander Igris');

            context.meditation_sessions = parseInt(meditationLog?.count || '0');
            context.deep_work_sessions = parseInt(deepWorkLog?.count || '0');
            context.fitness_sessions = parseInt(fitnessLog?.count || '0');
            context.learning_sessions = parseInt(learningLog?.count || '0');
            context.finance_sessions = parseInt(financeLog?.count || '0');
            context.exploration_sessions = parseInt(explorerLog?.count || '0');

            // Merge real-time data if provided (e.g. from BOSS_KILL)
            if (eventType === 'BOSS_KILL' && data.bossName) {
                if (!context.defeated_boss_names) context.defeated_boss_names = new Set();
                context.defeated_boss_names.add(data.bossName);
            }
            if (eventType === 'CLASS_CHANGE' && data.class) {
                context.class = data.class;
            }

            // Count total quests and rank-specific counts
            const totalQuestRes = await db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1", [userId]);
            const eRankQuestRes = await db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND difficulty = 'E'", [userId]);

            context.total_quests = parseInt(totalQuestRes?.count || '0');
            context.total_e_rank = parseInt(eRankQuestRes?.count || '0');

            // Skill counts
            const skillRows = await db.query(`
                SELECT us.current_level, s.max_level
                FROM user_skills us
                JOIN skills s ON us.skill_id = s.id
                WHERE us.user_id = $1
            `, [userId]);

            context.total_skills = skillRows.rows.length;
            context.maxed_skills = skillRows.rows.filter((s: any) => s.current_level >= s.max_level).length;

            // Fetch missing profile data
            if (context.current_hp === undefined || context.level === undefined || context.class === undefined || context.gold === undefined) {
                const p = await db.queryOne<{ current_hp: number, level: number, hunter_class: string, gold_credits: number }>("SELECT current_hp, level, hunter_class, gold_credits FROM profiles WHERE id = $1", [userId]);
                if (p) {
                    if (context.current_hp === undefined) context.current_hp = p.current_hp;
                    if (context.level === undefined) context.level = p.level;
                    if (context.class === undefined) context.class = p.hunter_class;
                    if (context.gold === undefined) context.gold = p.gold_credits;
                }
            }
        }

        // 2. Define Triggers
        const rules = [
            // Progression
            // Progression
            { code: 'ACH_AWAKENING', check: () => context.level >= 10 },
            { code: 'ACH_FALSE_RANKER', check: () => context.level >= 40 },
            { code: 'ACH_RANK_S', check: () => context.level >= 50 },
            { code: 'ACH_RANK_NATIONAL', check: () => context.level >= 100 },
            { code: 'ACH_S_RANK', check: () => context.level >= 100 }, // Legacy/Alternate code for National

            // Combat / Task
            { code: 'ACH_FIRST_BLOOD', check: () => (context.total_quests || 0) >= 1 },
            { code: 'ACH_GOBLIN_SLAYER', check: () => (context.total_e_rank || 0) >= 100 },
            { code: 'ACH_THE_GRIND', check: () => (context.total_quests || 0) >= 500 },

            // Titles: Specific Kills
            // Logic: 30 Wolf Kills roughly ~ 3-4 quests
            { code: 'ACH_WOLF_SLAYER', check: () => (context.wolf_kills || 0) >= 3 },
            // Logic: 100 Demons is high, say 20 quests
            { code: 'ACH_DEMON_HUNTER', check: () => (context.demon_kills || 0) >= 20 },

            // Real Life Titles
            { code: 'ACH_ZEN_MASTER', check: () => (context.meditation_sessions || 0) >= 50 },
            { code: 'ACH_DEEP_WORK', check: () => (context.deep_work_sessions || 0) >= 20 },
            { code: 'ACH_GYM_RAT', check: () => (context.fitness_sessions || 0) >= 50 },
            { code: 'ACH_SCHOLAR', check: () => (context.learning_sessions || 0) >= 20 },
            { code: 'ACH_EXPLORER', check: () => (context.exploration_sessions || 0) >= 10 },
            { code: 'ACH_WEALTHY', check: () => (context.finance_sessions || 0) >= 5 || (context.gold || 0) >= 1000000 },
            { code: 'ACH_SYSTEM_OPT', check: () => (parseInt(context.sys_admin_sessions || '0') >= 10) }, // Need to fetch this if we strictly want it, or map to 'System' type quests

            // Titles: Bosses
            { code: 'ACH_BOSS_IGRIS', check: () => context.defeated_boss_names?.has('Blood-Red Commander Igris') },
            { code: 'ACH_IGRIS', check: () => context.defeated_boss_names?.has('Blood-Red Commander Igris') }, // Legacy Alias
            { code: 'ACH_BOSS_KASAKA', check: () => context.defeated_boss_names?.has('Blue Venom-Fanged Kasaka') },
            { code: 'ACH_BOSS_CERBERUS', check: () => context.defeated_boss_names?.has('Cerberus (Gatekeeper)') },
            { code: 'ACH_BOSS_BURYURA', check: () => context.defeated_boss_names?.has('Giant Arachnid Buryura') },
            { code: 'ACH_BOSS_HWANG', check: () => context.defeated_boss_names?.has('Hwang Dongsuk') },
            { code: 'ACH_BOSS_BARUKA', check: () => context.defeated_boss_names?.has('Baruka (Ice Elf Leader)') },
            { code: 'ACH_BOSS_VULCAN', check: () => context.defeated_boss_names?.has('Avaricious Vulcan') },
            { code: 'ACH_BOSS_METUS', check: () => context.defeated_boss_names?.has('Metus (Soul Shepherd)') },
            { code: 'ACH_BOSS_KARGALGAN', check: () => context.defeated_boss_names?.has('Kargalgan (Orc Shaman)') },
            { code: 'ACH_BOSS_LEGIA', check: () => context.defeated_boss_names?.has('Legia (Monarch of the Beginning)') },
            { code: 'ACH_BOSS_QUEREHSHA', check: () => context.defeated_boss_names?.has('Querehsha (Monarch of Plagues)') },
            { code: 'ACH_BOSS_RAKAN', check: () => context.defeated_boss_names?.has('Rakan (Monarch of Beastly Fangs)') },
            { code: 'ACH_BOSS_YOGUMUNT', check: () => context.defeated_boss_names?.has('Yogumunt (Monarch of Transfiguration)') },
            { code: 'ACH_BOSS_TARNAK', check: () => context.defeated_boss_names?.has('Tarnak (Monarch of Iron Body)') },
            { code: 'ACH_BOSS_GOD_STATUE', check: () => context.defeated_boss_names?.has('Statue of God') },
            { code: 'ACH_BOSS_BARAN', check: () => context.defeated_boss_names?.has('Baran (Monarch of White Flames)') },
            { code: 'ACH_BOSS_SILLAD', check: () => context.defeated_boss_names?.has('Sillad (Monarch of Frost)') },
            { code: 'ACH_BOSS_ASHBORN', check: () => context.defeated_boss_names?.has('Ashborn (Shadow Monarch)') },
            { code: 'ACH_BOSS_ANTARES', check: () => context.defeated_boss_names?.has('Antares (Monarch of Destruction)') },
            { code: 'ACH_BOSS_BERU', check: () => context.defeated_boss_names?.has('Ant King (Beru)') },
            { code: 'ACH_BOSS_KAMISH', check: () => context.defeated_boss_names?.has('Kamish (The Dragon)') },
            { code: 'ACH_BOSS_ARCHITECT', check: () => context.defeated_boss_names?.has('The Architect (Kandiaru)') },
            { code: 'ACH_BOSS_ITARIM_APOSTLES', check: () => context.defeated_boss_names?.has('Apostles of Itarim') },
            { code: 'ACH_BOSS_ITARIM', check: () => context.defeated_boss_names?.has('Itarim (Outer God)') },

            // Titles: Class/State
            { code: 'ACH_CLASS_AWAKENED', check: () => context.class && context.class !== 'NONE' },
            { code: 'ACH_CLASS_FIGHTER', check: () => context.class === 'Fighter' },
            { code: 'ACH_CLASS_MAGE', check: () => context.class === 'Mage' },
            { code: 'ACH_CLASS_TANK', check: () => context.class === 'Tank' },
            { code: 'ACH_CLASS_ASSASSIN', check: () => context.class === 'Assassin' },
            { code: 'ACH_CLASS_WARLOCK', check: () => context.class === 'Warlock' },
            { code: 'ACH_CLASS_HEALER', check: () => context.class === 'Healer' },
            { code: 'ACH_CLASS_RANGER', check: () => context.class === 'Ranger' },
            { code: 'ACH_CLASS_NECRO', check: () => context.class === 'Necromancer' },
            { code: 'ACH_CLASS_MONARCH', check: () => context.class === 'Shadow Monarch' },

            // Ranks
            // (Already handled in Progression section above)

            { code: 'ACH_SHADOW_MONARCH', check: () => context.class === 'Necromancer' || context.class === 'Shadow Monarch' },
            { code: 'ACH_DARK_LORD', check: () => context.class === 'Necromancer' }, // Overlap intended

            // Titles: Feats
            // Adversity: HP < 1% of Max check is hard async.
            // Simplified: If HP is 1 (Penalty) or very low.
            { code: 'ACH_ADVERSITY', check: () => context.current_hp === 1 },

            // Dimenstional / Stats
            { code: 'ACH_LIMIT_BREAKER', check: () => eventType === 'STAT_UPDATE' && Object.values(context.stats || {}).some((v: any) => v >= 100) },
            { code: 'ACH_SYS_ADMIN', check: () => eventType === 'DEBUG_USED' },

            // Skills
            { code: 'ACH_SKILL_INITIATE', check: () => eventType === 'SKILL_UNLOCK' && context.total_skills >= 1 },
            { code: 'ACH_JACK_TRADES', check: () => eventType === 'SKILL_UNLOCK' && context.total_skills >= 10 },
            { code: 'ACH_MASTER_ARTS', check: () => (eventType === 'SKILL_LEVEL_UP' || eventType === 'SKILL_UNLOCK') && context.maxed_skills >= 1 },
        ];

        // 3. Evaluate Rules
        let totalXp = 0;
        for (const rule of rules) {
            const isMeetsCondition = rule.check();
            const alreadyHasAchievement = unlockedCodes.has(rule.code);

            if (isMeetsCondition) {
                if (!alreadyHasAchievement) {
                    // Unlock for the first time
                    const info = await this.unlock(userId, rule.code);
                    if (info) {
                        totalXp += info.xp;
                        newlyUnlocked.push({ code: rule.code, ...info });
                    }
                } else if (eventType === 'LOGIN' || eventType === 'SYNC') {
                    // Retroactive title grant for existing achievement
                    await this.ensureTitleUnlocked(userId, rule.code);
                }
            }
        }

        return { unlocked: newlyUnlocked, totalXp };
    }

    private async unlock(userId: string, code: string): Promise<{ xp: number; gold?: number; item?: any; name: string; description: string } | null> {
        // 1. Get Achievement Data including gold_reward and item_reward_id
        const ach = await db.queryOne<{
            id: string,
            xp_reward: number,
            gold_reward?: number,
            item_reward_id?: string,
            name: string,
            description: string
        }>(
            'SELECT id, xp_reward, gold_reward, item_reward_id, name, description FROM achievements WHERE code = $1',
            [code]
        );

        if (!ach) return null;

        // 2. Insert User Achievement
        const inserted = await db.query(`
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
            RETURNING achievement_id
        `, [userId, ach.id]);
        if (inserted.rows.length === 0) return null;

        // 3. Grant Gold Reward if present
        if (ach.gold_reward && ach.gold_reward > 0) {
            await db.query(
                'UPDATE profiles SET gold_credits = gold_credits + $1 WHERE id = $2',
                [ach.gold_reward, userId]
            );
        }

        // 4. Grant Item Reward if present
        let itemReward = undefined;
        if (ach.item_reward_id) {
            // Fetch item details first
            const item = await db.queryOne(
                'SELECT * FROM items WHERE id = $1',
                [ach.item_reward_id]
            );

            if (item) {
                // Insert into inventory
                await db.query(`
                    INSERT INTO inventory (user_id, item_id, quantity)
                    VALUES ($1, $2, 1)
                `, [userId, ach.item_reward_id]);

                itemReward = item;
            }
        }

        // 5. Check for title unlocks
        await this.checkTitleUnlocks(userId, code);

        return {
            xp: ach.xp_reward || 0,
            gold: ach.gold_reward || undefined,
            item: itemReward,
            name: ach.name,
            description: ach.description || ''
        };
    }

    private async checkTitleUnlocks(userId: string, achievementCode: string) {
        await this.ensureTitleUnlocked(userId, achievementCode);
    }

    /**
     * Ensures that any titles associated with an achievement code are granted to the user.
     * Idempotent thanks to ON CONFLICT DO NOTHING.
     */
    private async ensureTitleUnlocked(userId: string, achievementCode: string) {
        // Find titles that require this achievement
        const { rows: titles } = await db.query(
            'SELECT id FROM titles WHERE required_achievement_code = $1',
            [achievementCode]
        );

        if (titles.length > 0) {
            for (const title of titles) {
                await db.query(`
                    INSERT INTO user_titles (user_id, title_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [userId, title.id]);
            }
        }
    }
}
