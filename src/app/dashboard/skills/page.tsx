import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import SkillsClient from "./SkillsClient";
import { getServerPlayerContext } from "@/lib/server/stats-loader";
import { StatsManager } from "@/lib/stats-manager";

export default async function SkillsPage() {
    const user = await getAuthenticatedUser();

    // Parallel Fetching
    const [playerContext, skillsRows, userSkillsRows] = await Promise.all([
        getServerPlayerContext(user.id),
        db.query("SELECT * FROM skills ORDER BY id ASC"),
        db.query("SELECT * FROM user_skills WHERE user_id = $1", [user.id])
    ]);

    const profile = playerContext.profile;
    const baseStats = {
        strength: playerContext.stats.strength || 10,
        agility: playerContext.stats.agility || 10,
        intelligence: playerContext.stats.intelligence || 10,
        vitality: playerContext.stats.vitality || 10,
        perception: playerContext.stats.perception || 10,
        charisma: playerContext.stats.charisma || 10,
        focus: playerContext.stats.focus || 10,
        willpower: playerContext.stats.willpower || 10,
        luck: playerContext.stats.luck || 10,
    };
    const effectiveStats = StatsManager.calculateEffectiveStats(
        baseStats,
        playerContext.modifiers,
        playerContext.statusEffects,
        profile.hunter_class || 'NONE',
        playerContext.stats.crystallized_stats || {}
    );
    const maxMana = StatsManager.calculateMaxMana(
        effectiveStats.intelligence,
        profile.level || 1,
        playerContext.modifiers,
        profile.hunter_class || 'NONE',
        profile.prestige_level || 0
    );

    const skills = skillsRows.rows || [];
    const userSkills = userSkillsRows.rows || [];

    return (
        <SkillsClient
            initialProfile={profile}
            maxMana={maxMana}
            initialSkills={skills}
            initialUserSkills={userSkills}
        />
    );
}
