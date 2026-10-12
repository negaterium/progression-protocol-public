"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { StatsRadar } from "@/components/dashboard/StatsRadar";

import { ProductivityHub } from "@/components/dashboard/ProductivityHub";
import ShadowArmy from "@/components/shadows/ShadowArmy";
import { Users, Activity } from "lucide-react";
import { CollapsiblePanel } from "@/components/dashboard/CollapsiblePanel";
import { DailyProgress } from "@/components/dashboard/DailyProgress";
import { MissionControl } from "@/components/dashboard/MissionControl";
import { CombatLog } from "@/components/dashboard/CombatLog";
import { OfflineSyncModal } from "@/components/dashboard/OfflineSyncModal";

import { checkAndResetRecurringQuests } from "@/app/actions/quests";
import { regenerateManaAction, checkDailyPenalty } from "@/app/actions/system";
import { countDailyCompletions } from "@/lib/quest-utils";
import { StatsManager } from "@/lib/stats-manager";
import { calculateQuestManaEfficiency } from "@/lib/system/skill-effects";

import { DashboardData, Profile, ShadowAssignment } from "@/lib/dashboard-data";
import { completeQuestAction, failQuestAction } from "@/app/actions/quests";
import { delegateQuestAction } from "@/app/actions/shadows";
import { useSystemNotification } from "@/components/system/NotificationProvider";

interface DashboardClientProps {
    initialData: DashboardData;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
    const router = useRouter();
    const { showNotification } = useSystemNotification();

    // Initialize state with Server Data
    const [profile, setProfile] = useState<typeof initialData.profile>(initialData.profile);
    const [stats, setStats] = useState(initialData.stats);
    const [quests, setQuests] = useState(initialData.quests);
    const [logs, setLogs] = useState(initialData.logs || []);
    const [modifiers, setModifiers] = useState(initialData.modifiers);
    const [availableShadows, setAvailableShadows] = useState(initialData.availableShadows || 0);
    const [activeAssignments, setActiveAssignments] = useState<ShadowAssignment[]>(initialData.activeAssignments || []);
    const [offlineGaps, setOfflineGaps] = useState<string[]>(initialData.offlineGaps || []);

    // Sync state when Server Data updates (e.g. after router.refresh())
    // This is CRITICAL for the "Level Up" flow to work without page reload
    useEffect(() => {
        const timer = setTimeout(() => {
            setProfile(initialData.profile);
            setStats(initialData.stats);
            setQuests(initialData.quests);
            setLogs(initialData.logs || []);
            setModifiers(initialData.modifiers);
            setAvailableShadows(initialData.availableShadows || 0);
            setActiveAssignments(initialData.activeAssignments || []);
            setOfflineGaps(initialData.offlineGaps || []);
        }, 0);
        return () => clearTimeout(timer);
    }, [initialData]);

    const [now, setNow] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setNow(Date.now()), 0);
        const interval = setInterval(() => setNow(Date.now()), 60000); // Tick every minute
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, []);

    // Derived stats
    const baseStats = {
        strength: stats?.strength || 10,
        agility: stats?.agility || 10,
        intelligence: stats?.intelligence || 10,
        vitality: stats?.vitality || 10,
        perception: stats?.perception || 10
    };

    // DERIVED STATE: Filter expired status effects and calculate effective stats
    const activeStatusEffects = useMemo(() => {
        const effects = Array.isArray(profile?.status_effects) ? profile.status_effects : [];
        if (now === 0) return effects; // Initial render safety
        return effects.filter((eff: any) => {
            if (!eff.duration_hours) return true; // Permanent until cured 
            const appliedAt = new Date(eff.applied_at).getTime();
            const durationMs = (eff.duration_hours || 0) * 60 * 60 * 1000;
            return now < (appliedAt + durationMs);
        });
    }, [profile, now]);

    const hClass = profile?.hunter_class || 'NONE';
    const effectiveStats = StatsManager.calculateEffectiveStats(baseStats, modifiers, activeStatusEffects, hClass) as typeof baseStats;

    const fetchData = useCallback(async () => {
        // Get userId from the profile data (server-side authenticated)
        const userId = profile?.id;

        if (!userId) {
            console.error("No user ID available");
            return;
        }

        // Ensure Daily Quests are reset if needed (Pass timezone offset)
        await checkAndResetRecurringQuests(new Date().getTimezoneOffset());

        // Check for Daily Penalty (Async, don't block main load)
        checkDailyPenalty(userId, new Date().getTimezoneOffset()).then(res => {
            // 1. Handle Boss Damage Notification
            if (res?.bossDamage) {
                window.dispatchEvent(new CustomEvent('solo_achievement', {
                    detail: {
                        title: "ONGOING INCURSION DAMAGE",
                        message: `The active boss ${res.bossDamage.bossName} dealt ${res.bossDamage.damage} damage while you rested.`,
                        type: 'WARNING', // Use Warning style (Red)
                        xp: 0
                    }
                }));
            }

            // 2. Handle Penalty Notification
            if (res?.status === 'PENALTY_ISSUED') {
                window.dispatchEvent(new CustomEvent('solo_achievement', {
                    detail: {
                        title: "PENALTY PROCEDURE INITIATED",
                        message: `Warning: ${res.quest}`,
                        type: 'WARNING',
                        xp: 0
                    }
                }));
            }
        });

        // Check for Mana Regeneration
        await regenerateManaAction();

        // Refresh Server Components to get fresh data
        // This triggers a re-render with new initialData, which the useEffect above picks up
        router.refresh();
    }, [profile?.id, router]);

    const handleCompleteQuest = async (id: string, xpReward: number, manaCost: number = 0) => {
        console.log(`[Dashboard] Completing quest ${id}, XP: ${xpReward}, Mana: ${manaCost}`);
        try {
            const mods = modifiers || {};
            const effMult = calculateQuestManaEfficiency(mods);
            const cost = Math.floor(manaCost * effMult);

            // Optimistic Update: Quests
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Complete', completed_at: new Date().toISOString() } : q));

            // Optimistic Update: Profile Mana
            if (profile && cost > 0) {
                setProfile((prev: Profile | null) => prev ? {
                    ...prev,
                    current_mana: Math.max(0, (prev.current_mana ?? 0) - cost)
                } : null);
                
                window.dispatchEvent(new CustomEvent('solo_player_mana_use', {
                    detail: { cost }
                }));
            }

            // Call Server Action
            const result = await completeQuestAction({ questId: id.toString(), xpReward });

            if (result.success && (result.data as any)?.interrupted) {
                // Revert optimistic status update
                setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
                showNotification({
                    title: "ACTION INTERRUPTED",
                    message: (result.data as any).message || "You are currently recovering from a status effect.",
                    type: 'WARNING'
                });
                await fetchData();
                return;
            }

            if (result.success && result.data) {
                const leveledUp = !!(result.data as any).newLevel;
                const newLevelValue = (result.data as any).newLevel;

                // ALWAYS log the full result data for debugging
                console.log("[Dashboard] completeQuestAction result:", JSON.stringify(result.data));

                // --- DISPATCH LEVEL UP FIRST (before any refresh) ---
                if (leveledUp) {
                    console.log("[Dashboard] Level Up detected! New level:", newLevelValue);

                    // CRITICAL: Write to localStorage IMMEDIATELY so it survives any subsequent
                    // router.refresh() that might remount LevelManager.
                    // LevelManager reads this on every mount.
                    localStorage.setItem("solo_pending_level_up", String(newLevelValue));

                    // Directly update profile level in state
                    setProfile((prev: Profile | null) => prev ? { ...prev, level: newLevelValue } : null);

                    // Fire global event (triggers LevelManager active detection)
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "LEVEL UP",
                            message: `Level ${newLevelValue}`,
                            type: 'LEVEL_UP',
                            newLevel: newLevelValue,
                            xp: xpReward
                        }
                    }));
                }

                // Dispatch XP Gain Event for UI feedback
                window.dispatchEvent(new CustomEvent('solo_xp_gain', {
                    detail: { amount: xpReward }
                }));

                // Boss Update
                if (result.data.bossDamage) {
                    window.dispatchEvent(new CustomEvent('solo_boss_damage', {
                        detail: result.data.bossDamage
                    }));

                    const damageData = result.data.bossDamage as { playerDamage?: number, rewards?: any };
                    if (damageData.playerDamage) {
                        window.dispatchEvent(new CustomEvent('solo_player_damage', {
                            detail: { damage: damageData.playerDamage }
                        }));
                    }
                }

                // Add to Loot Queue (handles multi-drops)
                if (result.data.loot) {
                    const loot = result.data.loot;
                    const lootArray = Array.isArray(loot) ? loot : [loot];

                    lootArray.forEach(item => {
                        window.dispatchEvent(new CustomEvent('solo_loot_drop', {
                            detail: {
                                title: item.name || "ITEM ACQUIRED",
                                item: item
                            }
                        }));
                    });
                }

                if (result.data.synergy) {
                    showNotification({
                        title: "SYNERGY BOOST ACTIVATED",
                        message: `High ${result.data.synergy.stat} detected! Bonus Rewards applied.`,
                        type: 'LEVEL_UP',
                        xp: result.data.synergy.bonusXp
                    });
                }

                if (result.data.unlocked && result.data.unlocked.length > 0) {
                    result.data.unlocked.forEach((ach: { name: string; xp: number }) => {
                        window.dispatchEvent(new CustomEvent('solo_achievement', {
                            detail: {
                                title: "ACHIEVEMENT UNLOCKED", message: ach.name, type: 'ACHIEVEMENT', xp: ach.xp
                            }
                        }));
                    });
                }

                // Daily All-Clear Bounty Notification
                if ((result.data as any).dailyBounty) {
                    const bounty = (result.data as any).dailyBounty;
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "DAILY REGIMEN ALL-CLEAR",
                            message: `[System] All Daily Objectives Complete! +${bounty.xp.toLocaleString()} XP, +${bounty.gold.toLocaleString()} Gold, Status Recovered!`,
                            type: 'SUCCESS',
                            xp: bounty.xp
                        }
                    }));
                }

                // Shadow Extraction Notification
                if (result.data.shadowExtracted) {
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "ARMY EXPANDED",
                            message: "A new Shadow Infantry has risen from the depths.",
                            type: 'SUCCESS'
                        }
                    }));
                }

                // Refresh data. If a level-up occurred, the modal is already shown
                // and the LevelManager will trigger a progression_protocol_update on modal close.
                // We still refresh here to update quest list, stats, etc.
                // The router.refresh inside fetchData will NOT destroy the modal because
                // LevelManager now manages its own state independently.
                window.dispatchEvent(new Event('progression_protocol_update'));
                await fetchData();
            } else if (!result.success) {
                console.error("Complete Quest Failed:", result.error);
                showNotification({
                    title: "QUEST FAILED",
                    message: result.error || "Unknown error occurred.",
                    type: 'WARNING'
                });
            }
        } catch (error) {
            console.error("Failed to complete quest:", error);
        }
    };

    const handleGiveUpQuest = async (id: string) => {
        try {
            // Optimistic Update: Mark as Failed
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Failed' } : q));

            // Call Server Action
            const result = await failQuestAction(id.toString());

            // Notify User
            if (result.success && result.data) {
                window.dispatchEvent(new CustomEvent('solo_achievement', {
                    detail: {
                        title: "QUEST FAILED",
                        message: `Penalty applied: ${result.data.penaltyXp} XP, -${result.data.penaltyHp} HP`,
                        type: 'WARNING',
                        xp: result.data.penaltyXp // This is negative
                    }
                }));

                if (result.data.penaltyHp) {
                    window.dispatchEvent(new CustomEvent('solo_player_damage', {
                        detail: { damage: result.data.penaltyHp }
                    }));
                }
            }

            // Re-fetch to sync
            await fetchData();
        } catch (error) {
            console.error("Failed to give up quest:", error);
            window.dispatchEvent(new CustomEvent('solo_achievement', {
                detail: {
                    title: "SYSTEM ERROR",
                    message: "Failed to process request. Check console for details.",
                    type: 'WARNING',
                    xp: 0
                }
            }));
        }
    };

    const handleDelegateQuest = async (id: string) => {
        if (hClass !== 'Necromancer') return;

        const quest = quests.find(q => q.id === id);
        if (!quest) return;

        // Calculate Cost & Duration (Mirror Server Logic)
        const rank = quest.difficulty || 'E';
        const costs: Record<string, number> = { 'E': 10, 'D': 25, 'C': 50, 'B': 100, 'A': 250, 'S': 500 };
        const durations: Record<string, number> = { 'E': 1, 'D': 2, 'C': 4, 'B': 8, 'A': 12, 'S': 24 };

        const cost = costs[rank] || 5;
        let durationHours = durations[rank] || 2;

        if (quest.type === 'Daily' || ((quest as any).frequency === 'Daily')) durationHours = 20;
        else if ((quest as any).frequency === 'Weekly') durationHours = 24 * 6;
        else if ((quest as any).frequency === 'Monthly') durationHours = 24 * 3;

        // Optimistic Check
        if (availableShadows < cost) {
            showNotification({ title: "INSUFFICIENT SHADOWS", message: `Need ${cost} shadows.`, type: 'WARNING' });
            return;
        }

        // Optimistic Update: Mark as Completed (Delegated)
        setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Complete', completed_at: new Date().toISOString() } : q));

        // Optimistic Update: Shadows
        setAvailableShadows(prev => Math.max(0, prev - cost));

        const optimisticAssignment: ShadowAssignment = {
            id: 'temp-' + Date.now(),
            quest_id: id,
            shadow_count: cost,
            return_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
            quest_title: quest.title
        };
        setActiveAssignments(prev => [...prev, optimisticAssignment]);

        try {
            const result = await delegateQuestAction({ questId: id });
            if (result.success && result.data) {
                showNotification({
                    title: "DELEGATION SUCCESS",
                    message: result.data.message || result.message || "Shadows dispatched.",
                    type: 'SUCCESS'
                });

                const leveledUp = !!result.data.newLevel;
                const newLevelValue = result.data.newLevel;

                if (leveledUp) {
                    localStorage.setItem("solo_pending_level_up", String(newLevelValue));
                    setProfile((prev: Profile | null) => prev ? { ...prev, level: newLevelValue } : null);
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "LEVEL UP",
                            message: `Level ${newLevelValue}`,
                            type: 'LEVEL_UP',
                            newLevel: newLevelValue,
                            xp: result.data.earnedXp || 0
                        }
                    }));
                }

                if (result.data.earnedXp) {
                    window.dispatchEvent(new CustomEvent('solo_xp_gain', {
                        detail: { amount: result.data.earnedXp }
                    }));
                }

                if (result.data.bossDamage) {
                    window.dispatchEvent(new CustomEvent('solo_boss_damage', {
                        detail: result.data.bossDamage
                    }));

                    const damageData = result.data.bossDamage as { playerDamage?: number };
                    if (damageData.playerDamage) {
                        window.dispatchEvent(new CustomEvent('solo_player_damage', {
                            detail: { damage: damageData.playerDamage }
                        }));
                    }
                }

                if (result.data.loot) {
                    const loot = result.data.loot;
                    const lootArray = Array.isArray(loot) ? loot : [loot];

                    lootArray.forEach(item => {
                        window.dispatchEvent(new CustomEvent('solo_loot_drop', {
                            detail: {
                                title: item.name || "ITEM ACQUIRED",
                                item: item
                            }
                        }));
                    });
                }

                if (result.data.synergy) {
                    showNotification({
                        title: "SYNERGY BOOST ACTIVATED",
                        message: `High ${result.data.synergy.stat} detected! Bonus Rewards applied.`,
                        type: 'LEVEL_UP',
                        xp: result.data.synergy.bonusXp
                    });
                }

                if (result.data.unlocked && result.data.unlocked.length > 0) {
                    result.data.unlocked.forEach((ach: any) => {
                        window.dispatchEvent(new CustomEvent('solo_achievement', {
                            detail: {
                                title: "ACHIEVEMENT UNLOCKED", message: ach.name, type: 'ACHIEVEMENT', xp: ach.xp
                            }
                        }));
                    });
                }

                // Daily All-Clear Bounty Notification
                if ((result.data as any).dailyBounty) {
                    const bounty = (result.data as any).dailyBounty;
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "DAILY REGIMEN ALL-CLEAR",
                            message: `[System] All Daily Objectives Complete! +${bounty.xp.toLocaleString()} XP, +${bounty.gold.toLocaleString()} Gold, Status Recovered!`,
                            type: 'SUCCESS',
                            xp: bounty.xp
                        }
                    }));
                }

                if (result.data.shadowExtracted) {
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "ARMY EXPANDED",
                            message: "A new Shadow Infantry has risen from the depths.",
                            type: 'SUCCESS'
                        }
                    }));
                }
                
                window.dispatchEvent(new Event('progression_protocol_update'));
                await fetchData();
            } else {
                // Revert
                setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
                setAvailableShadows(prev => prev + cost);
                setActiveAssignments(prev => prev.filter(a => a.id !== optimisticAssignment.id));
                showNotification({ title: "DELEGATION FAILED", message: result.error || result.message || "Unknown error", type: 'WARNING' });
            }
        } catch (error: any) {
            console.error("Delegation Error:", error);
            showNotification({ title: "DELEGATION FAILED", message: error.message, type: 'WARNING' });
            // Revert
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
            setAvailableShadows(prev => prev + cost);
            setActiveAssignments(prev => prev.filter(a => a.id !== optimisticAssignment.id));
        }
    };


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleUpdate = () => fetchData();
        window.addEventListener('progression_protocol_update', handleUpdate);

        return () => {
            window.removeEventListener('progression_protocol_update', handleUpdate);
        };
    }, [fetchData]);

    const completedDailies = countDailyCompletions(quests, initialData.reportDay);

    return (
        <div className="mx-auto space-y-6 pt-6 pb-24">

            {offlineGaps && offlineGaps.length > 0 && (
                <OfflineSyncModal 
                    gaps={offlineGaps} 
                    onComplete={async () => {
                        setOfflineGaps([]);
                        await fetchData();
                    }} 
                />
            )}

            {/* Daily Progress Ribbon */}
            <DailyProgress
                dailyCount={completedDailies}
                reportDay={initialData.reportDay}
                todayCount={initialData.todayCompletions}
                weekCount={initialData.weekCompletions}
                streak={initialData.streak}
                totalCompletions={initialData.totalCompletions}
                activeBoss={initialData.activeBoss}
            />

            <MissionControl
                quests={quests}
                reportDay={initialData.reportDay}
                userMana={profile?.current_mana ?? 0}
                userLevel={profile?.level ?? 1}
                userStats={effectiveStats}
                onComplete={handleCompleteQuest}
                onGiveUp={handleGiveUpQuest}
                hunterClass={hClass}
                availableShadows={availableShadows}
                onDelegate={handleDelegateQuest}
            />

            {/* Hunter details remain available below the daily actions. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <StatusCard
                    username={profile?.username ?? "HUNTER"}
                    jobTitle={profile?.hunter_class ?? "NONE"}
                    rank={profile?.hunter_rank ?? "E"}
                    level={profile?.level ?? 1}
                    currentXp={profile?.current_xp ?? 0}
                    nextLevelXp={profile?.next_level_xp ?? 100}
                    gold={profile?.gold_credits ?? 0}
                    title={profile?.title ?? "None"}
                    classType="HUMAN"
                    currentHp={profile?.current_hp ?? 100}
                    // Use EFFECTIVE stats for Max HP Calc
                    maxHp={StatsManager.calculateMaxHP(effectiveStats.vitality, effectiveStats.strength, profile?.level ?? 1, modifiers, hClass)}
                    currentMana={profile?.current_mana ?? 0}
                    // Use EFFECTIVE stats for Max Mana Calc
                    maxMana={StatsManager.calculateMaxMana(effectiveStats.intelligence, profile?.level ?? 1, modifiers, hClass)}
                    gender={profile?.gender ?? 'MALE'}
                    statusEffects={activeStatusEffects}
                    lastPermanentStatAt={profile?.last_permanent_stat_at}
                    now={now}
                    shadowStats={initialData.shadowStats ? {
                        ...initialData.shadowStats,
                        available: availableShadows // Use dynamic state
                    } : undefined}
                />
                <StatsRadar
                    // Use EFFECTIVE stats for Radar
                    strength={effectiveStats.strength}
                    agility={effectiveStats.agility}
                    intelligence={effectiveStats.intelligence}
                    vitality={effectiveStats.vitality}
                    perception={effectiveStats.perception}
                    baseStats={baseStats}
                    availableAp={profile?.available_ap || 0}
                    hunterClass={hClass}
                    onUpdate={fetchData}
                />
            </div>

            {/* Combat Encounter Log — only visible when boss is active */}
            <CombatLog />

            {/* Habits & Analysis (formerly Agenda) */}
            <CollapsiblePanel
                title="HABITS & HISTORY" // Renamed from AGENDA
                icon={<Activity className="w-5 h-5 text-purple-400" />}
                defaultOpen={true}
            >
                <div className="bg-black/40 p-4 rounded-lg border border-purple-900/30">
                    <ProductivityHub
                        quests={quests} // Still passing for compatibility if needed, though prop removed from signature
                        userMana={profile?.current_mana ?? 0}
                        userLevel={profile?.level ?? 1}
                        userStats={effectiveStats}
                        logs={logs}
                        onComplete={handleCompleteQuest}
                        hunterClass={hClass}
                        availableShadows={availableShadows}
                        onDelegate={handleDelegateQuest}
                    />
                </div>
            </CollapsiblePanel>

            {/* Shadow Monarch's Domain (Conditional) */}
            {profile?.hunter_class === 'Necromancer' && (profile?.level ?? 0) >= 40 && (
                <div className="border border-purple-900/30 rounded-lg p-6 bg-black/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Users className="w-32 h-32 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-bold text-purple-400 mb-6 flex items-center gap-2 uppercase tracking-widest relative z-10">
                        <Users className="w-6 h-6" />
                        Army of the Dead
                    </h2>

                    {/* Lazy load to avoid hydration mismatches if possible, or just standard load */}
                    <div className="relative z-10">
                        <ShadowArmy availableInfantry={availableShadows} activeAssignments={activeAssignments} />
                    </div>
                </div>
            )}
        </div>
    );
}
