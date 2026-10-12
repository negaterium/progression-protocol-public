"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { AchievementsPanel } from "@/components/achievements/AchievementsPanel";
import { TitleSelector } from "@/components/achievements/TitleSelector";
import { DebugControls } from "@/components/dashboard/DebugControls";
import { StatsRadar } from "@/components/dashboard/StatsRadar";
import { LevelUpProjection } from "@/components/profile/LevelUpProjection";
import { BackupRestoreControls } from "@/components/profile/BackupRestoreControls";
import { updateGenderAction, toggleAutoSellAction } from "@/app/actions/profile";
import { RankingPanel } from "@/components/profile/RankingPanel";
import { RankingEntry } from "@/app/actions/leaderboard";
import { CollapsiblePanel } from "@/components/dashboard/CollapsiblePanel";
import Image from "next/image";
import { Calendar, Trophy, Briefcase, Zap, Loader2, Sparkles, User, UserCheck, CheckCircle2 } from "lucide-react";
import { CustomQuestCreator } from "@/components/profile/CustomQuestCreator";
import { triggerTranscendenceAction } from "@/app/actions/prestige";

interface ProfileClientProps {
    canUseDeveloperTools: boolean;
    profile: any;
    stats: any;
    baseStats: any; // Added
    derivedStats: { maxHp: number, maxMana: number, currentHp: number, currentMana: number };
    derivedCombatStats: {
        critChance: number;
        dodgeChance: number;
        lootFind: number;
        finalAtk: number;
        finalDef: number;
    };
    extendedStats: {
        daysActive: number;
        questsCompleted: number;
        inventoryCount: number;
        skillsCount: number;
        skillsTotal: number;
        skillsMaxed: number;
        isSkillsMaxed?: boolean;
    };
    allAchievements: any[];
    userAchievementIds: string[];
    allTitles: any[];
    userTitles: any[];
    leaderboard: RankingEntry[];
    initialZones: any[];
}

export default function ProfileClient({
    canUseDeveloperTools,
    profile,
    stats,
    baseStats,
    derivedStats,
    extendedStats,
    allAchievements,
    userAchievementIds,
    allTitles,
    userTitles,
    leaderboard,
    initialZones,
    derivedCombatStats
}: ProfileClientProps) {
    const router = useRouter();

    const handleRefresh = () => {
        router.refresh();
    };

    const [now, setNow] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setNow(Date.now()), 0);
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, []);

    const handleGenderUpdate = async (g: string) => {
        try {
            await updateGenderAction(g);
            router.refresh();
        } catch (e) {
            console.error(e);
        }
    };

    const handleAutoSellUpdate = async () => {
        try {
            await toggleAutoSellAction(!profile.auto_sell_junk);
            router.refresh();
        } catch (e) {
            console.error(e);
        }
    };

    const handleTranscendence = async () => {
        if (!confirm("Are you ready to transcend your mortal coil? Your level will be reset, but your soul will be crystallized with cosmic power. This cannot be undone.")) return;

        try {
            const res = await triggerTranscendenceAction();
            if (res.error) {
                alert(res.error);
            } else {
                alert(res.message);
                router.refresh();
            }
        } catch (e) {
            console.error(e);
            alert("A cosmic disturbance occurred. Transcendence failed.");
        }
    };

    // Derived states
    if (!profile) return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
            <div className="text-cyan-500 font-mono text-sm tracking-widest animate-pulse">
                ESTABLISHING SYSTEM CONNECTION...
            </div>
        </div>
    );

    const isAdmin = canUseDeveloperTools;

    return (
        <div className="space-y-8 p-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-widest text-white font-sans uppercase">
                        Hunter Profile <span className="text-cyan-600 text-sm ml-2">{'// ID: '}{profile.username}</span>
                    </h1>
                    {/* Manual Job Change Trigger */}
                    {profile && (profile.level ?? 0) >= 40 && (!profile.hunter_class || profile.hunter_class === 'NONE') && (
                        <button
                            onClick={() => window.dispatchEvent(new Event('solo_open_job_modal'))}
                            className="mt-2 flex items-center gap-2 px-4 py-1 bg-purple-600/20 border border-purple-500 text-purple-200 text-xs font-bold rounded animate-pulse hover:bg-purple-600/40 transition-colors"
                        >
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                            CLASS CHANGE AVAILABLE // CLICK TO INITIATE
                        </button>
                    )}

                    {/* Transcendence Ritual Trigger */}
                    {profile && (profile.level ?? 0) >= 999 && (
                        <button
                            onClick={handleTranscendence}
                            disabled={!extendedStats.isSkillsMaxed}
                            className={cn(
                                "mt-2 flex items-center gap-2 px-6 py-2 border rounded font-bold transition-all duration-500",
                                extendedStats.isSkillsMaxed
                                    ? "bg-purple-600/30 border-purple-400 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-pulse hover:bg-purple-600/50"
                                    : "bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                            )}
                        >
                            <Sparkles className={cn("w-4 h-4", extendedStats.isSkillsMaxed ? "text-purple-300 animate-spin-slow" : "text-slate-600")} />
                            {extendedStats.isSkillsMaxed ? "INITIATE TRANSCENDENCE RITUAL" : "TRANSCENDENCE LOCKED // MASTER ALL SKILLS"}
                        </button>
                    )}
                </div>
                <div className="text-xs font-mono text-slate-500">
                    SYSTEM BUILD // CURRENT
                </div>
            </div>

            <nav
                aria-label="Profile sections"
                className="flex flex-wrap items-center gap-2 border-y border-white/5 py-3 text-[10px] font-mono uppercase tracking-widest"
            >
                {[
                    ['overview', 'Overview'],
                    ['customization', 'Customization'],
                    ['progression', 'Progression'],
                    ['achievements', 'Achievements'],
                    ['backups', 'Backups'],
                    ['rankings', 'Rankings'],
                ].map(([id, label]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className="rounded border border-slate-800 px-3 py-1.5 text-slate-500 transition-colors hover:border-cyan-800 hover:text-cyan-400"
                    >
                        {label}
                    </a>
                ))}
            </nav>

            {/* Top Row: User Card + Titles */}
            <div id="overview" className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                <div className="space-y-6">
                    <StatusCard
                        username={profile.username}
                        jobTitle={profile.job_title || profile.hunter_class || 'NONE'}
                        rank={profile.hunter_rank}
                        level={profile.level}
                        currentXp={profile.current_xp || 0}
                        nextLevelXp={profile.next_level_xp || 100}
                        gold={profile.gold_credits || 0}
                        title={profile.title || 'The Recruit'}
                        classType={profile.hunter_class || 'HUMAN'}
                        currentHp={derivedStats.currentHp}
                        maxHp={derivedStats.maxHp}
                        currentMana={derivedStats.currentMana}
                        maxMana={derivedStats.maxMana}
                        gender={profile.gender || 'MALE'}
                        statusEffects={profile.status_effects || []}
                        lastPermanentStatAt={profile.last_permanent_stat_at}
                        now={now}
                    />

                    {/* Core Stats Analysis */}
                    {stats && (
                        <StatsRadar
                            strength={stats.strength}
                            agility={stats.agility}
                            intelligence={stats.intelligence}
                            vitality={stats.vitality}
                            perception={stats.perception}
                            baseStats={baseStats}
                            availableAp={profile.available_ap}
                            derivedStats={derivedCombatStats}
                            onUpdate={handleRefresh}
                        />
                    )}

                    {/* Hunter Records / Activity Log */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-4 rounded bg-slate-900/40 flex flex-col items-center justify-center text-center group hover:bg-slate-900/60 transition-colors border border-slate-800 hover:border-cyan-900/50">
                            <Calendar className="w-5 h-5 text-slate-500 mb-2 group-hover:text-cyan-400 transition-colors" />
                            <span className="text-slate-500 text-[10px] font-mono tracking-widest uppercase mb-1">Days Awakened</span>
                            <span className="text-2xl font-bold text-white font-sans">{extendedStats.daysActive}</span>
                        </div>
                        <div className="glass-panel p-4 rounded bg-slate-900/40 flex flex-col items-center justify-center text-center group hover:bg-slate-900/60 transition-colors border border-slate-800 hover:border-cyan-900/50">
                            <Trophy className="w-5 h-5 text-slate-500 mb-2 group-hover:text-cyan-400 transition-colors" />
                            <span className="text-slate-500 text-[10px] font-mono tracking-widest uppercase mb-1">Missions Complete</span>
                            <span className="text-2xl font-bold text-cyan-400 font-sans">{extendedStats.questsCompleted}</span>
                        </div>
                        <div className="glass-panel p-4 rounded bg-slate-900/40 flex flex-col items-center justify-center text-center group hover:bg-slate-900/60 transition-colors border border-slate-800 hover:border-cyan-900/50">
                            <Briefcase className="w-5 h-5 text-slate-500 mb-2 group-hover:text-cyan-400 transition-colors" />
                            <span className="text-slate-500 text-[10px] font-mono tracking-widest uppercase mb-1">Arsenal Size</span>
                            <span className="text-2xl font-bold text-white font-sans">{extendedStats.inventoryCount}</span>
                        </div>
                        <div className="glass-panel p-4 rounded bg-slate-900/40 flex flex-col items-center justify-center text-center group hover:bg-slate-900/60 transition-colors border border-slate-800 hover:border-cyan-900/50">
                            <Zap className="w-5 h-5 text-slate-500 mb-2 group-hover:text-cyan-400 transition-colors" />
                            <span className="text-slate-500 text-[10px] font-mono tracking-widest uppercase mb-1">Skills Learned</span>
                            <span className="text-2xl font-bold text-purple-400 font-sans">
                                {extendedStats.skillsCount}<span className="text-sm text-slate-500">/{extendedStats.skillsTotal}</span>
                            </span>
                            <span className="text-[9px] text-purple-300/70 font-mono uppercase tracking-wider">{extendedStats.skillsMaxed} maxed</span>
                        </div>
                    </div>
                </div>

                <div id="customization" className="space-y-6 scroll-mt-6">
                    {/* Custom Quest Creator */}
                    <CustomQuestCreator zones={initialZones} />

                    <div className="glass-panel p-4 rounded-lg h-fit">
                        <TitleSelector
                            currentTitle={profile.title}
                            allTitles={allTitles}
                            userTitles={userTitles}
                        />
                    </div>

                    {/* Gender Selector */}
                    {(() => {
                        const job = (profile.hunter_class || '').toLowerCase();
                        let baseAvatarClass = 'generic';
                        if (job.includes('assassin')) baseAvatarClass = 'assassin';
                        else if (job.includes('druid')) baseAvatarClass = 'druid';
                        else if (job.includes('healer')) baseAvatarClass = 'healer';
                        else if (job.includes('mage')) baseAvatarClass = 'mage';
                        else if (job.includes('monk') || job.includes('fighter') || job.includes('warrior')) baseAvatarClass = 'monk';
                        else if (job.includes('necromancer') || job.includes('shadow') || job.includes('monarch')) baseAvatarClass = 'necromancer';
                        else if (job.includes('tank') || job.includes('knight')) baseAvatarClass = 'tank';
                        else if (job.includes('warlock')) baseAvatarClass = 'warlock';

                        const maleAvatarUrl = `/avatars/${baseAvatarClass}-male.webp`;
                        const femaleAvatarUrl = `/avatars/${baseAvatarClass}-female.webp`;

                        return (
                            <div className="glass-panel p-4 rounded-lg h-fit">
                                <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest font-mono flex items-center gap-2">
                                    <span className="text-cyan-600">▸</span> BIOLOGICAL TRAITS
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleGenderUpdate('MALE')}
                                        className={cn(
                                            "relative p-3 rounded-lg flex flex-col items-center justify-center gap-2 border transition-all duration-300 group overflow-hidden",
                                            (profile.gender || 'MALE') === 'MALE'
                                                ? "bg-blue-950/40 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.35)]"
                                                : "bg-slate-900/40 border-slate-800 text-slate-500 hover:border-blue-900/60 hover:text-blue-400/70"
                                        )}
                                    >
                                        <div className="relative w-16 h-16 rounded-md overflow-hidden border border-blue-500/30 group-hover:scale-105 transition-transform duration-300 shadow-inner bg-slate-950">
                                            <Image
                                                src={maleAvatarUrl}
                                                alt="Male Physique"
                                                fill
                                                sizes="64px"
                                                className="object-cover"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-transparent to-transparent pointer-events-none" />
                                        </div>

                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="text-xs font-mono font-bold tracking-wider">MALE</span>
                                            </div>
                                            {(profile.gender || 'MALE') === 'MALE' && (
                                                <span className="text-[9px] font-mono text-blue-400/90 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE VESSEL
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handleGenderUpdate('FEMALE')}
                                        className={cn(
                                            "relative p-3 rounded-lg flex flex-col items-center justify-center gap-2 border transition-all duration-300 group overflow-hidden",
                                            (profile.gender || 'MALE') === 'FEMALE'
                                                ? "bg-pink-950/40 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.35)]"
                                                : "bg-slate-900/40 border-slate-800 text-slate-500 hover:border-pink-900/60 hover:text-pink-400/70"
                                        )}
                                    >
                                        <div className="relative w-16 h-16 rounded-md overflow-hidden border border-pink-500/30 group-hover:scale-105 transition-transform duration-300 shadow-inner bg-slate-950">
                                            <Image
                                                src={femaleAvatarUrl}
                                                alt="Female Physique"
                                                fill
                                                sizes="64px"
                                                className="object-cover"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-pink-950/80 via-transparent to-transparent pointer-events-none" />
                                        </div>

                                        <div className="flex flex-col items-center">
                                            <div className="flex items-center gap-1.5">
                                                <UserCheck className="w-3.5 h-3.5 text-pink-400" />
                                                <span className="text-xs font-mono font-bold tracking-wider">FEMALE</span>
                                            </div>
                                            {(profile.gender || 'MALE') === 'FEMALE' && (
                                                <span className="text-[9px] font-mono text-pink-400/90 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE VESSEL
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* System Settings */}
                    <div className="glass-panel p-4 rounded-lg h-fit">
                        <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest font-mono">
                            System Preferences
                        </h3>
                        <div className="flex items-center justify-between p-3 border border-slate-800 bg-slate-900/30 rounded">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white uppercase font-mono tracking-wider">Passive Auto-Sell</span>
                                <span className="text-[10px] text-slate-500 max-w-[200px]">Automatically convert E/D/C rank Weapons, Armors, and Accessories into Gold.</span>
                            </div>
                            <button
                                onClick={handleAutoSellUpdate}
                                className={cn(
                                    "px-4 py-2 rounded text-xs font-bold border uppercase tracking-widest transition-all",
                                    profile.auto_sell_junk 
                                        ? "bg-cyan-900/40 border-cyan-500 text-cyan-400" 
                                        : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                                )}
                            >
                                {profile.auto_sell_junk ? 'ENABLED' : 'DISABLED'}
                            </button>
                        </div>
                    </div>

                    {/* Level Up Projection */}
                    <div id="progression" className="scroll-mt-6">
                        <LevelUpProjection
                            userId={profile.id}
                            currentXp={profile.current_xp || 0}
                            nextLevelXp={profile.next_level_xp || 100}
                            level={profile.level || 1}
                        />
                    </div>
                </div>
            </div>

            {/* Achievements Grid */}
            <div id="achievements" className="scroll-mt-6">
                <CollapsiblePanel title="Achievements">
                    <AchievementsPanel
                        allAchievements={allAchievements}
                        unlockedIds={userAchievementIds}
                    />
                </CollapsiblePanel>
            </div>

            {/* Backup/Restore Section */}
            <div id="backups" className="scroll-mt-6">
                <BackupRestoreControls username={profile.username} />
            </div>

            {/* Global Ranking System */}
            <div id="rankings" className="scroll-mt-6 border-t border-white/5 pt-8">
                <RankingPanel entries={leaderboard} />
            </div>

            {/* Debug Tools for Verification - ADMIN ONLY */}
            {isAdmin && (
                <div className="mt-12 pt-8 border-t border-white/5">
                    <h4 className="text-xs font-bold text-slate-600 mb-4 uppercase tracking-widest">Developer Console</h4>
                    <DebugControls onUpdate={handleRefresh} canJump={canUseDeveloperTools} />
                </div>
            )}
        </div>
    );
}
