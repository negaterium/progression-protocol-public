import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import ProfileClient from "./ProfileClient";
import { fetchLeaderboardAction } from "@/app/actions/leaderboard";
import { calculatePlayerStatsSnapshot } from "@/lib/server/user-stats";
import { getServerPlayerContext } from "@/lib/server/stats-loader";
import { isDeveloperUserId } from '@/lib/server/developer-access';
import { getPlayerSkillProgress } from '@/lib/server/skill-progress';

export default async function ProfilePage() {
    const user = await getAuthenticatedUser();

    // Profile rendering is read-only. Gameplay actions remain responsible for
    // persisting regeneration and recalculated derived stats.
    const playerContext = await getServerPlayerContext(user.id);
    const { profile, stats } = playerContext;

    if (!profile || !stats) return <div className="p-8 text-cyan-500 font-mono">PROFILE NOT FOUND</div>;

    const regenResult = calculatePlayerStatsSnapshot(playerContext);

    // All remaining profile data is read-only and can be fetched in parallel.
    const [
        questsCountRes,
        inventoryCountRes,
        skillProgress,
        titlesAll,
        titlesUser,
        achievementsAll,
        achievementsUser,
        zonesRes,
        leaderboard
    ] = await Promise.all([
        db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1", [user.id]),
        db.queryOne<{ count: string }>("SELECT COUNT(*) as count FROM inventory WHERE user_id = $1", [user.id]),
        getPlayerSkillProgress(user.id),
        db.query("SELECT * FROM titles ORDER BY name"),
        db.query("SELECT * FROM user_titles WHERE user_id = $1", [user.id]),
        db.query(`
            SELECT a.*, i.name as item_reward_name, i.rarity as item_reward_rarity 
            FROM achievements a 
            LEFT JOIN items i ON a.item_reward_id = i.id 
            ORDER BY a.xp_reward ASC
        `),
        db.query("SELECT achievement_id FROM user_achievements WHERE user_id = $1", [user.id]),
        db.query("SELECT * FROM zones ORDER BY name"),
        fetchLeaderboardAction(),
    ]);



    // Days Active
    const createdAt = new Date(profile.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const extendedStats = {
        daysActive: diffDays,
        questsCompleted: parseInt(questsCountRes?.count || '0'),
        inventoryCount: parseInt(inventoryCountRes?.count || '0'),
        skillsCount: skillProgress.learned,
        skillsTotal: skillProgress.total,
        skillsMaxed: skillProgress.maxed,
        isSkillsMaxed: skillProgress.allMaxed
    };

    const { maxHp, maxMana, effectiveStats: finalStats } = regenResult;
    const userAchievementIds = achievementsUser.rows.map((ua: any) => ua.achievement_id);

    // Derived combat stats — computed from pre-fetched DB columns, no extra query needed
    const computedDerivedStats = {
        finalAtk: stats.total_attack || 0,
        finalDef: stats.total_defense || 0,
        critChance: Math.min(75, ((stats.total_agility + stats.total_perception) / 500) * 10),
        dodgeChance: Math.min(50, (stats.total_agility / 500) * 10),
        lootFind: Math.min(100, (stats.total_perception / 200) * 10),
    };

    return (
        <ProfileClient
            canUseDeveloperTools={isDeveloperUserId(user.id)}
            profile={profile}
            stats={finalStats}
            baseStats={stats}
            derivedStats={{
                maxHp,
                maxMana,
                currentHp: regenResult.currentHp,
                currentMana: regenResult.currentMana,
            }}
            derivedCombatStats={computedDerivedStats}
            extendedStats={extendedStats}
            allAchievements={achievementsAll.rows}
            userAchievementIds={userAchievementIds}
            allTitles={titlesAll.rows}
            userTitles={titlesUser.rows}
            leaderboard={leaderboard}
            initialZones={zonesRes.rows}
        />
    );
}
