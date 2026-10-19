"use client";

import { useState, useEffect } from "react";
import { Database } from "@/types/database.types";
import { ZoneGrid } from "@/components/quests/ZoneGrid";
import { QuestGrid } from "@/components/quests/QuestGrid";
import { cn } from "@/lib/utils";
import { Target, History, Layers, Clock, Calendar, CalendarRange, Zap, Activity } from "lucide-react";
import { voidStrikeAction, completeQuestAction, failQuestAction } from "@/app/actions/quests";
import { delegateQuestAction } from "@/app/actions/shadows";
import { useSystemNotification } from "@/components/system/NotificationProvider";
import { SystemConfirmModal } from "@/components/modals/SystemConfirmModal";
import { calculateScaledQuestReward } from "@/lib/system/formula";
import { calculateQuestManaEfficiency } from "@/lib/system/skill-effects";
import { sortQuestsByRank } from "@/lib/quest-utils";
import { DetailedLogViewer } from "@/components/habits/DetailedLogViewer";

interface LogEntry {
    id: number;
    quest_title: string;
    quest_type: string;
    difficulty: string;
    xp_reward: number;
    completed_at: string;
}

type Zone = Database['public']['Tables']['zones']['Row'];
type Quest = Database['public']['Tables']['quests']['Row'];

interface QuestsClientProps {
    initialZones: Zone[];
    initialQuests: Quest[];
    initialMana: number;
    initialLevel?: number;
    initialStats: { strength: number, agility: number, intelligence: number, vitality: number, perception: number };
    voidStrikeState: { equipped: boolean; available: boolean };
    availableShadows?: number;
    hunterClass?: string;
    modifiers?: Record<string, number>;
    initialQuestLogs?: LogEntry[];
}

export function QuestsClient({ initialZones, initialQuests, initialMana, initialLevel = 1, initialStats, voidStrikeState, availableShadows = 0, hunterClass = 'NONE', modifiers = {}, initialQuestLogs = [] }: QuestsClientProps) {
    const { showNotification } = useSystemNotification();
    const [zones] = useState<Zone[]>(initialZones);
    const [quests, setQuests] = useState<Quest[]>(initialQuests);
    const [currentMana, setCurrentMana] = useState<number>(initialMana);
    const [currentLevel, setCurrentLevel] = useState<number>(initialLevel || 1);
    const [hunterStats, setHunterStats] = useState(initialStats);
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [viewMode, setViewMode] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [questToFail, setQuestToFail] = useState<number | null>(null);
    const [voidStrike, setVoidStrike] = useState(voidStrikeState);
    const [selectedRank, setSelectedRank] = useState<string | 'ALL'>('ALL');

    // RSC props are the authoritative snapshot after router.refresh(); these
    // effects preserve optimistic quest interactions until that snapshot arrives.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        setQuests(initialQuests);
    }, [initialQuests]);

    useEffect(() => {
        setCurrentMana(initialMana);
    }, [initialMana]);

    useEffect(() => {
        setCurrentLevel(initialLevel || 1);
    }, [initialLevel]);

    useEffect(() => {
        setHunterStats(initialStats);
    }, [initialStats]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Filter Logic
    const filteredQuests = selectedZone
        ? quests.filter(q => q.zone_id === selectedZone.id || (selectedZone.name === 'HOME BASE' && !q.zone_id))
        : quests;

    const activeQuests = filteredQuests.filter(q => {
        const statusMatch = q.status === 'Active';
        const rankMatch = selectedRank === 'ALL' || q.difficulty === selectedRank;
        return statusMatch && rankMatch;
    });

    const targetQuests = viewMode === 'CURRENT'
        ? filteredQuests.filter(q => q.status === 'Available' && (selectedRank === 'ALL' || q.difficulty === selectedRank))
        : filteredQuests.filter(q => (q.status === 'Complete' || q.status === 'Failed') && (selectedRank === 'ALL' || q.difficulty === selectedRank));

    const sortedAvailableQuests = viewMode === 'CURRENT' ? sortQuestsByRank(targetQuests) : targetQuests;

    const groupedQuests = {
        daily: sortedAvailableQuests.filter(q => (q.frequency || 'Daily') === 'Daily'),
        weekly: sortedAvailableQuests.filter(q => q.frequency === 'Weekly'),
        monthly: sortedAvailableQuests.filter(q => q.frequency === 'Monthly'),
        yearly: sortedAvailableQuests.filter(q => q.frequency === 'Yearly'),
        once: sortedAvailableQuests.filter(q => q.frequency === 'Once' || !q.frequency),
    };

    const categories = [
        { id: 'ALL', label: 'ALL CONTRACTS', icon: Layers },
        { id: 'DAILY', label: 'DAILY', icon: Clock },
        { id: 'WEEKLY', label: 'WEEKLY', icon: Calendar },
        { id: 'MONTHLY', label: 'MONTHLY', icon: CalendarRange },
        { id: 'SPECIAL', label: 'SPECIAL OPS', icon: Zap },
    ];

    const handleSelectZone = (zone: Zone) => {
        setSelectedZone((prev: Zone | null) => prev?.id === zone.id ? null : zone);
    };

    const handleCompleteQuest = async (id: number) => {
        const quest = quests.find(q => q.id === id);
        if (!quest) return;

        const { finalManaCost, finalXp: xpReward } = calculateScaledQuestReward(
            quest.xp_reward || 0,
            quest.gold_reward || 0,
            quest.mana_cost || 0,
            currentLevel,
            hunterStats,
            quest.skill_rewards as any
        );

        const manaEfficiency = calculateQuestManaEfficiency(modifiers);
        const costWithEfficiency = Math.floor(finalManaCost * manaEfficiency);

        // Optimistic Update
        const previousStatus = quest.status;
        setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Complete' } : q));
        setCurrentMana(prev => Math.max(0, prev - costWithEfficiency));

        const rollbackCompletion = () => {
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: previousStatus } : q));
            setCurrentMana(prev => prev + costWithEfficiency);
            // Refresh the shared vitals and quest data after an interrupted or
            // rejected action so the optimistic update cannot linger in the UI.
            window.dispatchEvent(new Event('progression_protocol_update'));
        };

        window.dispatchEvent(new CustomEvent('solo_player_mana_use', {
            detail: { cost: costWithEfficiency }
        }));

        try {
            const result = await completeQuestAction({ questId: id.toString(), xpReward });

            if (result.success && result.data) {
                if ((result.data as any).interrupted) {
                    rollbackCompletion();
                    showNotification({
                        title: "ACTION INTERRUPTED",
                        message: (result.data as any).message || "You are currently recovering from a status effect.",
                        type: 'WARNING'
                    });
                    return;
                }

                if (result.data.loot) {
                    const loot = result.data.loot;
                    const lootArray = Array.isArray(loot) ? loot : [loot];

                    lootArray.forEach(item => {
                        const isAutoSold = item.auto_sold === true;
                        window.dispatchEvent(new CustomEvent('solo_loot_drop', {
                            detail: {
                                title: isAutoSold ? `ITEM AUTO-SOLD (${item.rarity}-RANK)` : (item.name || "ITEM ACQUIRED"),
                                item: item,
                                message: isAutoSold ? `System automatically converted this low-rank item into ${item.sold_for || 0} Gold.` : undefined
                            }
                        }));
                    });
                }

                if (result.data.shadowExtracted) {
                    showNotification({
                        title: "ARMY EXPANDED",
                        message: "A new Shadow Infantry has risen from the depths.",
                        type: 'SUCCESS'
                    });
                }

                if (result.data.bossDamage) {
                    if (result.data.bossDamage.bounty?.participationXp > 0) {
                        showNotification({ title: 'BOSS XP EARNED', message: 'Combat participation reward. XP bonuses apply to this base amount.',
                            type: 'SUCCESS', xp: result.data.bossDamage.bounty.participationXp });
                    }
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
                                title: "ACHIEVEMENT UNLOCKED",
                                message: ach.name,
                                type: 'ACHIEVEMENT',
                                xp: ach.xp,
                                gold: ach.gold,
                                item: ach.item,
                                rarity: ach.item?.rarity
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

                // --- DISPATCH LEVEL UP (before any refresh) ---
                if ((result.data as any).newLevel) {
                    const newLevelValue = (result.data as any).newLevel;
                    localStorage.setItem("solo_pending_level_up", String(newLevelValue));
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

                window.dispatchEvent(new CustomEvent('solo_xp_gain', {
                    detail: { amount: xpReward }
                }));

                window.dispatchEvent(new Event('progression_protocol_update'));
            } else {
                rollbackCompletion();
                console.error("Complete Quest Failed:", result.error);
                showNotification({
                    title: "QUEST FAILED",
                    message: result.error || "Unknown error occurred.",
                    type: 'WARNING'
                });
            }
        } catch (error) {
            rollbackCompletion();
            console.error("Complete Quest Error:", error);
            showNotification({
                title: "SYSTEM ERROR",
                message: "An unexpected error occurred.",
                type: 'WARNING'
            });
        }
    };

    const handleVoidStrike = async (id: number) => {
        if (!voidStrike.available) return;

        setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Complete' } : q));
        setVoidStrike(prev => ({ ...prev, available: false }));

        try {
            const result = await voidStrikeAction(id.toString());
            if (result.success) {
                showNotification({
                    title: "VOID STRIKE SUCCESSFUL",
                    message: "Minor task deleted from existence.",
                    type: 'SUCCESS'
                });
                window.dispatchEvent(new Event('progression_protocol_update'));
            } else {
                setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
                setVoidStrike(prev => ({ ...prev, available: true }));
            }
        } catch (error: any) {
            console.error("Void Strike Error:", error);
            showNotification({
                title: "VOID STRIKE FAILED",
                message: error.message || "Ability on cooldown or invalid target.",
                type: 'WARNING'
            });
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
            setVoidStrike(prev => ({ ...prev, available: true }));
        }
    };

    const handleDelegateQuest = async (id: number) => {
        if (hunterClass !== 'Necromancer') {
            showNotification({ title: "ACCESS DENIED", message: "Only Necromancers can command the Shadow Army.", type: 'WARNING' });
            return;
        }

        // Just checking if any available for base logic, but QuestCard handles specific cost check
        // We will trust the server action to validate exact cost
        if (availableShadows < 1) { // Basic check
            showNotification({ title: "INSUFFICIENT SHADOWS", message: "No shadows available for deployment.", type: 'WARNING' });
            return;
        }

        setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Complete' } : q));

        try {
            const result = await delegateQuestAction({ questId: id.toString() });
            if (result.success && result.data) {
                showNotification({
                    title: "DELEGATION SUCCESS",
                    message: result.data.message || "Your shadows have completed the mission.",
                    type: 'SUCCESS'
                });

                if (result.data.loot) {
                    const loot = result.data.loot;
                    const lootArray = Array.isArray(loot) ? loot : [loot];

                    lootArray.forEach(item => {
                        const isAutoSold = item.auto_sold === true;
                        window.dispatchEvent(new CustomEvent('solo_loot_drop', {
                            detail: {
                                title: isAutoSold ? `ITEM AUTO-SOLD (${item.rarity}-RANK)` : (item.name || "ITEM ACQUIRED"),
                                item: item,
                                message: isAutoSold ? `System automatically converted this low-rank item into ${item.sold_for || 0} Gold.` : undefined
                            }
                        }));
                    });
                }

                if (result.data.shadowExtracted) {
                    showNotification({
                        title: "ARMY EXPANDED",
                        message: "A new Shadow Infantry has risen from the depths.",
                        type: 'SUCCESS'
                    });
                }

                if (result.data.bossDamage) {
                    if (result.data.bossDamage.bounty?.participationXp > 0) {
                        showNotification({ title: 'BOSS XP EARNED', message: 'Combat participation reward. XP bonuses apply to this base amount.',
                            type: 'SUCCESS', xp: result.data.bossDamage.bounty.participationXp });
                    }
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
                                title: "ACHIEVEMENT UNLOCKED",
                                message: ach.name,
                                type: 'ACHIEVEMENT',
                                xp: ach.xp,
                                gold: ach.gold,
                                item: ach.item,
                                rarity: ach.item?.rarity
                            }
                        }));
                    });
                }

                if (result.data.newLevel) {
                    const newLevelValue = result.data.newLevel;
                    localStorage.setItem("solo_pending_level_up", String(newLevelValue));
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
                
                window.dispatchEvent(new Event('progression_protocol_update'));
            } else {
                setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
                showNotification({ title: "DELEGATION FAILED", message: result.error || result.message || "Unknown error", type: 'WARNING' });
            }
        } catch (error: any) {
            console.error("Delegation Error:", error);
            showNotification({ title: "DELEGATION FAILED", message: error.message, type: 'WARNING' });
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Active' } : q));
        }
    };

    const handleFailQuest = (id: number) => {
        setQuestToFail(id);
    };

    const executeFailQuest = async () => {
        if (!questToFail) return;
        const id = questToFail;
        const previousStatus = quests.find(q => q.id === id)?.status || 'Active';
        setQuestToFail(null);

        setQuests(prev => prev.map(q => q.id === id ? { ...q, status: 'Failed' } : q));

        try {
            const result = await failQuestAction(id.toString());
            if (result.success && result.data) {
                showNotification({
                    title: "MISSION FAILED",
                    message: `Penalty Applied: ${result.data.penaltyXp} XP, -${result.data.penaltyHp} HP`,
                    type: 'WARNING',
                    xp: result.data.penaltyXp
                });

                if (result.data.penaltyHp) {
                    window.dispatchEvent(new CustomEvent('solo_player_damage', {
                        detail: { damage: result.data.penaltyHp }
                    }));
                }

                window.dispatchEvent(new Event('progression_protocol_update'));
            } else {
                setQuests(prev => prev.map(q => q.id === id ? { ...q, status: previousStatus } : q));
                window.dispatchEvent(new Event('progression_protocol_update'));
                showNotification({
                    title: "MISSION NOT ABORTED",
                    message: result.error || "The mission could not be cancelled.",
                    type: 'WARNING'
                });
            }
        } catch (e: unknown) {
            console.error("Fail Quest Error:", e);
            setQuests(prev => prev.map(q => q.id === id ? { ...q, status: previousStatus } : q));
            showNotification({
                title: "SYSTEM ERROR",
                message: "Failed to process cancellation.",
                type: 'WARNING'
            });
            window.dispatchEvent(new Event('progression_protocol_update'));
        }
    };

    return (
        <div className="container mx-auto px-6 pt-24 pb-24 min-h-screen flex flex-col relative">
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold font-sans tracking-tight text-white mb-2">
                        MISSION CONTROL
                    </h1>
                    <p className="text-cyan-600 font-mono text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 animate-pulse" />
                        SYSTEM ONLINE // {quests.length} QUESTS DETECTED {'//'} MANA: {currentMana}
                    </p>
                </div>

                <div className="flex bg-black/40 border border-white/10 p-1 rounded-lg">
                    <button
                        type="button"
                        aria-pressed={viewMode === 'CURRENT'}
                        onClick={() => setViewMode('CURRENT')}
                        className={`px-4 py-2 text-xs font-bold font-mono transition-all rounded flex items-center gap-2 ${viewMode === 'CURRENT'
                            ? "bg-cyan-950 text-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.2)]"
                            : "text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        <Target className="w-4 h-4" />
                        ACTIVE OPS
                    </button>
                    <button
                        type="button"
                        aria-pressed={viewMode === 'HISTORY'}
                        onClick={() => setViewMode('HISTORY')}
                        className={`px-4 py-2 text-xs font-bold font-mono transition-all rounded flex items-center gap-2 ${viewMode === 'HISTORY'
                            ? "bg-cyan-950 text-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.2)]"
                            : "text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        <History className="w-4 h-4" />
                        MISSION LOG
                    </button>
                </div>
            </header>

            {viewMode === 'CURRENT' && (
                <ZoneGrid
                    zones={zones}
                    quests={quests}
                    selectedZoneId={selectedZone?.id ?? undefined}
                    onSelectZone={handleSelectZone}
                />
            )}

            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {(activeQuests.length > 0 && viewMode === 'CURRENT') && (
                    <QuestGrid
                        title="CURRENT OBJECTIVES"
                        quests={activeQuests}
                        userLevel={currentLevel}
                        userStats={hunterStats}
                        userMana={currentMana}
                        onComplete={handleCompleteQuest}
                        onFail={handleFailQuest}
                        voidStrikeAvailable={voidStrike.equipped && voidStrike.available}
                        onVoidStrike={handleVoidStrike}
                        modifiers={modifiers}
                        availableShadows={availableShadows}
                        hunterClass={hunterClass}
                        onDelegate={handleDelegateQuest}
                        zones={zones}
                    />
                )}

                {viewMode === 'CURRENT' && (
                    <div className="flex flex-wrap items-center gap-3 mb-6 bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">Filter by Rank:</span>
                        <div className="flex flex-wrap gap-2">
                            {['ALL', 'E', 'D', 'C', 'B', 'A', 'S'].map(rank => (
                                <button
                                    key={rank}
                                    type="button"
                                    aria-pressed={selectedRank === rank}
                                    onClick={() => setSelectedRank(rank)}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-bold font-mono border transition-all",
                                        selectedRank === rank
                                            ? "bg-cyan-600 text-black border-cyan-400 shadow-[0_0_10px_rgba(8,145,178,0.3)]"
                                            : "bg-black/40 text-slate-500 border-white/10 hover:border-cyan-900/50 hover:text-slate-300"
                                    )}
                                >
                                    {rank}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {(targetQuests.length > 0 && viewMode === 'CURRENT') && (
                    <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                aria-pressed={selectedCategory === cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-2 text-xs font-bold font-mono tracking-widest transition-all clip-path-slant flex items-center gap-2 ${selectedCategory === cat.id
                                    ? "bg-cyan-600 text-black shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                                    : "bg-black/40 text-cyan-700 hover:text-cyan-400 border border-cyan-900/30"
                                    }`}
                            >
                                <cat.icon className="w-4 h-4" />
                                {cat.label}
                            </button>
                        ))}
                    </div>
                )}

                {(selectedCategory === 'ALL' || selectedCategory === 'DAILY') && groupedQuests.daily.length > 0 && viewMode === 'CURRENT' && (
                    <QuestGrid
                        title="DAILY ROUTINES"
                        quests={groupedQuests.daily}
                        userLevel={currentLevel}
                        userStats={hunterStats}
                        userMana={currentMana}
                        onComplete={viewMode === 'CURRENT' ? handleCompleteQuest : undefined}
                        onFail={handleFailQuest}
                        onVoidStrike={handleVoidStrike}
                        modifiers={modifiers}
                        availableShadows={availableShadows}
                        hunterClass={hunterClass}
                        onDelegate={handleDelegateQuest}
                        zones={zones}
                    />
                )}

                {(selectedCategory === 'ALL' || selectedCategory === 'WEEKLY') && groupedQuests.weekly.length > 0 && viewMode === 'CURRENT' && (
                    <QuestGrid
                        title="WEEKLY TARGETS"
                        quests={groupedQuests.weekly}
                        userLevel={currentLevel}
                        userStats={hunterStats}
                        userMana={currentMana}
                        onComplete={viewMode === 'CURRENT' ? handleCompleteQuest : undefined}
                        onFail={handleFailQuest}
                        onVoidStrike={handleVoidStrike}
                        modifiers={modifiers}
                        availableShadows={availableShadows}
                        hunterClass={hunterClass}
                        onDelegate={handleDelegateQuest}
                        zones={zones}
                    />
                )}

                {(selectedCategory === 'ALL' || selectedCategory === 'MONTHLY') && groupedQuests.monthly.length > 0 && viewMode === 'CURRENT' && (
                    <QuestGrid
                        title="MONTHLY GOALS"
                        quests={groupedQuests.monthly}
                        userLevel={currentLevel}
                        userStats={hunterStats}
                        userMana={currentMana}
                        onComplete={viewMode === 'CURRENT' ? handleCompleteQuest : undefined}
                        onFail={handleFailQuest}
                        onVoidStrike={handleVoidStrike}
                        modifiers={modifiers}
                        availableShadows={availableShadows}
                        hunterClass={hunterClass}
                        onDelegate={handleDelegateQuest}
                        zones={zones}
                    />
                )}

                {(selectedCategory === 'ALL' || selectedCategory === 'SPECIAL') && groupedQuests.once.length > 0 && viewMode === 'CURRENT' && (
                    <QuestGrid
                        title="SPECIAL OPERATIONS"
                        quests={groupedQuests.once}
                        userLevel={currentLevel}
                        userStats={hunterStats}
                        userMana={currentMana}
                        onComplete={viewMode === 'CURRENT' ? handleCompleteQuest : undefined}
                        onFail={handleFailQuest}
                        onVoidStrike={handleVoidStrike}
                        modifiers={modifiers}
                        availableShadows={availableShadows}
                        hunterClass={hunterClass}
                        onDelegate={handleDelegateQuest}
                        zones={zones}
                    />
                )}

                {viewMode === 'HISTORY' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-900/50 to-transparent" />
                            <h2 className="text-xl font-mono font-bold text-cyan-400 tracking-[0.2em] uppercase shrink-0">
                                PERSISTENT MISSION LOG
                            </h2>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-900/50 to-transparent" />
                        </div>
                        <DetailedLogViewer logs={initialQuestLogs} />
                    </div>
                )}

                {targetQuests.length === 0 && viewMode === 'CURRENT' && (
                    <div className="glass-panel p-8 rounded-lg text-center">
                        <div className="font-mono text-slate-500">
                            NO AVAILABLE QUESTS IN THIS SECTOR
                        </div>
                    </div>
                )}
            </div>

            <SystemConfirmModal
                isOpen={!!questToFail}
                onClose={() => setQuestToFail(null)}
                onConfirm={executeFailQuest}
                title="SYSTEM WARNING"
                message="Are you sure you want to abort this mission? A penalty will be assessed."
                confirmText="ABORT MISSION"
                variant="danger"
            />
        </div>
    );
}
