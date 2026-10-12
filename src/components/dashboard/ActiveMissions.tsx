"use client";

import { Database } from "@/types/database.types";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle, Award, Coins, Dumbbell, Skull, Cpu, Brain, Star, Wind, Eye, Music, Footprints, Flower, Repeat, Calendar, Clock, Scroll, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState, useMemo } from "react";
import { SystemConfirmModal } from "@/components/modals/SystemConfirmModal";
import { calculateScaledQuestReward, DAILY_ALL_CLEAR_TARGET } from "@/lib/system/formula";
import { countDailyCompletions } from "@/lib/quest-utils";


type Quest = Database['public']['Tables']['quests']['Row'];

interface ActiveMissionsProps {
    quests: Quest[];
    reportDay?: string;
    userMana?: number;
    userLevel?: number;
    userStats?: { strength: number; agility: number; intelligence: number; vitality: number; perception: number };
    onComplete?: (id: string, xp: number, manaCost: number) => void;
    onGiveUp?: (id: string) => void;
    hunterClass?: string;
    availableShadows?: number;
    onDelegate?: (id: string) => void;
}

function getQuestIcon(quest: Quest) {
    if (quest.type === 'PENALTY' || quest.title.startsWith('PENALTY:')) return AlertTriangle;

    const title = quest.title.toLowerCase();

    // Title keyword priority
    if (title.includes('breathing')) return Wind;
    if (title.includes('gazing')) return Eye;
    if (title.includes('mantra')) return Music;
    if (title.includes('walking')) return Footprints;
    if (title.includes('sitting')) return Flower;

    // Type priority
    switch (quest.type) {
        case 'Training': return Dumbbell;
        case 'Dungeon':
        case 'Red Gate': return Skull;
        case 'System': return Cpu;
        case 'Intellect': return Brain;
        case 'Special': return Star;
    }

    // Frequency fallback
    switch (quest.frequency) {
        case 'Daily': return Repeat;
        case 'Weekly': return Calendar;
        case 'Monthly': return Clock;
    }

    return Scroll;
}

export function ActiveMissions({ quests, reportDay, userMana = 0, userLevel = 1, userStats, onComplete, onGiveUp, hunterClass, availableShadows = 0, onDelegate }: ActiveMissionsProps) {
    const [questToGiveUp, setQuestToGiveUp] = useState<string | null>(null);
    const [selectedRank, setSelectedRank] = useState<string | 'ALL'>('ALL');
    const [selectedFreq, setSelectedFreq] = useState<string | 'ALL'>('ALL');

    // 1. Calculate Daily Quest Progress
    const completedDailies = countDailyCompletions(quests, reportDay);

    const DAILY_TARGET = DAILY_ALL_CLEAR_TARGET;
    const progressPercent = Math.min(100, (completedDailies / DAILY_TARGET) * 100);
    const isBonusActive = completedDailies >= DAILY_TARGET;

    // 2. Select Quests based on filters
    const displayedQuests = useMemo(() => {
        let filtered = quests.filter(q => q.status !== 'Complete' && q.status !== 'Failed');

        // Apply Frequency Filter
        if (selectedFreq !== 'ALL') {
            filtered = filtered.filter(q => {
                if (q.type === 'PENALTY') return true; // Always show penalties
                if (selectedFreq === 'DAILY') return q.frequency === 'Daily' || q.type === 'Daily';
                if (selectedFreq === 'WEEKLY') return q.frequency === 'Weekly';
                if (selectedFreq === 'MONTHLY') return q.frequency === 'Monthly';
                if (selectedFreq === 'ONCE') return q.frequency === 'Once' || !q.frequency;
                return true;
            });
        } else {
            // Default "Dashboard View": Daily + Penalty if no filter set
            filtered = filtered.filter(q => q.frequency === 'Daily' || q.type === 'Daily' || q.type === 'PENALTY' || q.type === 'System');
        }

        // Apply Rank Filter
        if (selectedRank !== 'ALL') {
            filtered = filtered.filter(q => q.difficulty === selectedRank || q.type === 'PENALTY');
        }

        // Helper to value rank
        const rankValue = (rank: string | null) => {
            const ranks: Record<string, number> = { 'E': 0, 'D': 1, 'C': 2, 'B': 3, 'A': 4, 'S': 5, 'S+': 6, 'XX': 7 };
            return ranks[rank || 'E'] || 0;
        };

        // Sort by Type (PENALTY first) then Difficulty
        const sortedQuests = [...filtered].sort((a, b) => {
            if (a.type === 'PENALTY' && b.type !== 'PENALTY') return -1;
            if (a.type !== 'PENALTY' && b.type === 'PENALTY') return 1;
            return rankValue(a.difficulty) - rankValue(b.difficulty);
        });

        // Limit only if no specific filters are applied
        if (selectedRank === 'ALL' && selectedFreq === 'ALL') {
            return sortedQuests.slice(0, 6);
        }
        return sortedQuests;
    }, [quests, selectedRank, selectedFreq]);

    const handleConfirmGiveUp = () => {
        if (questToGiveUp && onGiveUp) {
            onGiveUp(questToGiveUp);
            setQuestToGiveUp(null);
        }
    };

    const freqFilters = [
        { id: 'ALL', label: 'All', icon: Layers },
        { id: 'DAILY', label: 'Daily', icon: Clock },
        { id: 'WEEKLY', label: 'Weekly', icon: Calendar },
        { id: 'MONTHLY', label: 'Monthly', icon: Repeat },
        { id: 'ONCE', label: 'Once', icon: Star },
    ];

    const rankFilters = ['ALL', 'E', 'D', 'C', 'B', 'A', 'S'];

    return (
        <div className="glass-panel p-5 rounded-lg relative group border border-white/5">
            {/* Background Glow */}
            {progressPercent < 100 && (
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-900/5 blur-[80px] -z-10 group-hover:bg-red-900/10 transition-colors" />
            )}

            <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                    <h3 className="text-lg font-bold font-sans tracking-wide text-white flex items-center gap-2">
                        ACTIVE MISSIONS <span className="hidden sm:inline text-[10px] text-cyan-600 font-mono mt-0.5 opacity-60">{'//'} STATUS REPORT</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-400 font-mono">
                            DAILY QUESTS: {completedDailies}/{DAILY_TARGET}
                        </p>
                        {isBonusActive && (
                            <span className="text-[8px] bg-yellow-900/30 text-yellow-500 px-1 py-0.5 rounded border border-yellow-700/50 animate-pulse font-bold uppercase">
                                Bonus Active
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {progressPercent < 100 ? (
                        <div className="animate-pulse">
                            <AlertTriangle className="w-5 h-5 text-red-500/80" />
                        </div>
                    ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-500/80" />
                    )}
                </div>
            </div>

            {/* Daily Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-[9px] font-mono mb-1 text-cyan-500/70 uppercase">
                    <span>Daily goal progress</span>
                    <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-1 bg-black/40 border border-white/5" indicatorClassName={cn(
                    "transition-all duration-1000",
                    progressPercent < 50 ? "bg-red-600" : progressPercent < 100 ? "bg-cyan-600" : "bg-green-500 shadow-[0_0_8px_#22c55e]"
                )} />
            </div>

            {/* Filter Controls */}
            <div className="mb-6 space-y-4">
                {/* Frequency Filters */}
                <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-3">
                    {freqFilters.map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setSelectedFreq(filter.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold font-mono tracking-wider transition-all border",
                                selectedFreq === filter.id
                                    ? "bg-cyan-950/40 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                                    : "bg-black/20 text-slate-500 border-white/5 hover:border-white/10 hover:text-slate-300"
                            )}
                        >
                            <filter.icon className="w-2.5 h-2.5" />
                            {filter.label.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Rank Filters */}
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[8px] font-mono text-slate-600 uppercase pt-1 mr-1">Rank:</span>
                    {rankFilters.map(rank => (
                        <button
                            key={rank}
                            onClick={() => setSelectedRank(rank)}
                            className={cn(
                                "px-2 py-0.5 text-[9px] font-bold font-mono transition-all border",
                                selectedRank === rank
                                    ? "bg-cyan-600/20 text-white border-cyan-500/60"
                                    : "bg-black/20 text-slate-600 border-white/5 hover:border-cyan-900/30 hover:text-slate-400"
                            )}
                        >
                            {rank}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid Layout */}
            <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <div className="text-[9px] font-bold text-slate-600 tracking-widest uppercase">
                        {selectedRank !== 'ALL' || selectedFreq !== 'ALL' ? 'Filtered Results' : 'Assigned Objectives'}
                    </div>
                    <span title="Reset Filters">
                        <RefreshCw
                            className="w-2.5 h-2.5 text-slate-800 cursor-pointer hover:text-cyan-500 hover:rotate-180 transition-all duration-500"
                            onClick={() => { setSelectedRank('ALL'); setSelectedFreq('ALL'); }}
                        />
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* System Alert for Penalties */}
                    {displayedQuests.some(q => q.type === 'PENALTY' || q.title.startsWith('PENALTY:')) && (
                        <div className="col-span-full bg-red-950/40 border border-red-500/50 p-3 rounded flex items-start gap-4 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)] mb-2">
                            <div className="bg-red-500/20 p-2 rounded border border-red-500/40">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-red-400 tracking-wider">SYSTEM ALERT // PENALTY DETECTED</span>
                                <p className="text-[10px] text-red-300/80 leading-relaxed font-mono">
                                    Failure to complete daily objectives has triggered a system penalty. Complete the survival mission immediately. Failure to comply before the deadline will result in severe punishment.
                                </p>
                            </div>
                        </div>
                    )}

                    {displayedQuests.length > 0 ? displayedQuests.map(quest => {
                        const isPenalty = quest.type === 'PENALTY' || quest.title.startsWith('PENALTY:');
                        const QuestIcon = getQuestIcon(quest);

                        const { finalXp, finalGold, finalManaCost } = calculateScaledQuestReward(
                            quest.xp_reward || 0,
                            quest.gold_reward || 0,
                            quest.mana_cost || 0,
                            userLevel ?? 1,
                            userStats,
                            quest.skill_rewards as any,
                            completedDailies,
                            quest.difficulty || undefined
                        );

                        return (
                            <div key={quest.id} className={cn(
                                "flex flex-col p-4 border rounded-md transition-all duration-300 group/item relative", // Increased padding
                                isPenalty
                                    ? "bg-red-950/20 border-red-500/40 hover:border-red-500/70 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]"
                                    : "bg-zinc-900/80 border-white/10 hover:border-cyan-500/50 hover:bg-zinc-800" // Higher contrast bg and border
                            )}>
                                {isPenalty && (
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-3xl -z-10 animate-pulse" />
                                )}
                                <div className="flex justify-between items-start mb-2 gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn(
                                            "p-2 rounded-md shrink-0 border", // Increased padding
                                            isPenalty ? "bg-red-950/30 border-red-800 text-red-500" : "bg-black/50 border-white/10 text-cyan-400"
                                        )}>
                                            <QuestIcon className="w-5 h-5" /> {/* Larger Icon */}
                                        </div>
                                        <div className="flex flex-col min-w-0 gap-1">
                                            <span className={cn(
                                                "text-sm font-bold truncate tracking-wide uppercase", // Larger Title
                                                isPenalty ? "text-red-400" : "text-slate-100"
                                            )}>{quest.title}</span>

                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[10px] font-bold px-1.5 py-0.5 rounded border", // Larger Badge
                                                    isPenalty ? "border-red-900 text-red-600" : "border-slate-700 text-slate-400 bg-black/40"
                                                )}>
                                                    RANK {quest.difficulty || 'E'}
                                                </span>
                                                <span className={cn(
                                                    "text-[10px] font-mono uppercase tracking-wider",
                                                    isPenalty ? "text-red-500/80 font-bold animate-pulse" : "text-slate-500"
                                                )}>
                                                    {quest.type === 'PENALTY' ? '🚨 EMERGENCY' : quest.frequency || 'ONCE'}
                                                </span>
                                            </div>

                                            <div className={cn(
                                                "text-xs mt-1 font-sans leading-relaxed whitespace-pre-wrap", // Larger, clearer description
                                                isPenalty ? "text-red-300 italic" : "text-slate-300"
                                            )}>
                                                {quest.description || (isPenalty ? "Restoration required." : "Tactical brief pending.")}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {quest.status !== 'Available' && onGiveUp && (
                                            <button
                                                onClick={() => setQuestToGiveUp(quest.id)}
                                                className="p-1.5 rounded hover:bg-red-900/30 text-slate-600 hover:text-red-500 transition-colors"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-auto pt-3 border-t border-white/5 gap-3 sm:gap-0">
                                    <div className="flex items-center justify-between sm:justify-start gap-4">
                                        {/* Rewards - Larger and brighter */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 text-xs font-bold font-mono text-cyan-400">
                                                <Award className="w-3.5 h-3.5" />
                                                <span>{finalXp} XP</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs font-bold font-mono text-yellow-400">
                                                <Coins className="w-3.5 h-3.5" />
                                                <span>{finalGold} G</span>
                                            </div>
                                            {finalManaCost > 0 && (
                                                <div className={cn("text-xs font-mono px-1.5 py-0.5 rounded bg-blue-950/30", (userMana >= finalManaCost) ? "text-blue-300 border border-blue-500/30" : "text-red-400 border border-red-900/40")}>
                                                    {finalManaCost} MP
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions Container */}
                                    <div className="flex gap-2 sm:gap-0 items-center justify-end">
                                        {/* Delegate Button - Necromancer Only */}
                                        {onDelegate && (hunterClass || '').toLowerCase() === 'necromancer' && (() => {
                                            const rank = quest.difficulty || 'E';
                                            const costs: Record<string, number> = { 'E': 10, 'D': 25, 'C': 50, 'B': 100, 'A': 250, 'S': 500 };
                                            const cost = costs[rank] || 5;
                                            const canDelegate = (availableShadows || 0) >= cost;

                                            return (
                                                <button
                                                    onClick={() => onDelegate(quest.id)}
                                                    disabled={!canDelegate}
                                                    className={cn(
                                                        "p-2 sm:p-1.5 mr-2 rounded border transition-all duration-300 group/btn relative overflow-hidden flex-1 sm:flex-none flex justify-center",
                                                        canDelegate
                                                            ? "border-purple-500/50 text-purple-400 hover:bg-purple-900/20 hover:text-white"
                                                            : "border-slate-800 text-slate-700 cursor-not-allowed bg-black/40"
                                                    )}
                                                    title={canDelegate ? `Delegate (Cost: ${cost} Shadows)` : `Need ${cost} Shadows`}
                                                >
                                                    <Users className="w-4 h-4 relative z-10" />
                                                    {canDelegate && (
                                                        <div className="absolute inset-0 bg-purple-500/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                                                    )}
                                                </button>
                                            );
                                        })()}

                                        <button
                                            onClick={() => {
                                                console.log(`[ActiveMissions] Clicked Complete for ${quest.id}. Mana: ${userMana}/${finalManaCost}`);
                                                const isLocked = false;
                                                if (!isLocked && userMana >= (finalManaCost || 0)) {
                                                    onComplete?.(quest.id, finalXp, finalManaCost || 0);
                                                } else {
                                                    console.warn(`[ActiveMissions] Cannot complete: ManaOK=${userMana >= (finalManaCost || 0)}`);
                                                }
                                            }}
                                            disabled={(userMana < finalManaCost && !isPenalty)}
                                            className={cn(
                                                "px-4 py-2 sm:py-1.5 rounded-sm text-xs font-bold uppercase transition-all border tracking-wider shadow-lg flex-1 sm:flex-none", // Full width on mobile
                                                isPenalty
                                                    ? "bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-red-900/20"
                                                    : userMana >= (finalManaCost || 0)
                                                        ? "bg-cyan-700 hover:bg-cyan-600 border-cyan-500 text-white shadow-cyan-900/20"
                                                        : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                                            )}
                                        >
                                            {(() => {
                                                if (isPenalty) return "SURVIVE";
                                                return userMana >= (finalManaCost || 0) ? "COMPLETE" : "NO MANA";
                                            })()}
                                        </button>
                                    </div>
                                </div>

                                <div className="text-[9px] text-slate-500 font-mono text-center pt-2 mt-2 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity">
                                    System ID: {quest.id.split('-')[0]} <span className="text-cyan-900 mx-1">{'//'}</span> Cls: {hunterClass}
                                </div>
                            </div>
                        );
                    }) : progressPercent >= 100 ? (
                        <div className="col-span-full text-center py-6 bg-green-950/5 border border-green-900/10 rounded text-green-600/60 font-mono text-[10px] uppercase tracking-widest">
                            Threshold Reached // All Systems Stable
                        </div>
                    ) : (
                        <div className="col-span-full text-center py-6 text-slate-700 font-mono text-[10px] border border-white/5 rounded bg-black/20 uppercase tracking-widest">
                            No Pending Objectives
                        </div>
                    )}
                </div>
            </div>

            <SystemConfirmModal
                isOpen={!!questToGiveUp}
                onClose={() => setQuestToGiveUp(null)}
                onConfirm={handleConfirmGiveUp}
                title="MISSION ABORTION"
                message="Abandoning this mission will trigger a system penalty. Are you sure, Hunter?"
                confirmText="ABORT MISSION"
                variant="danger"
            />
        </div >
    );
}
