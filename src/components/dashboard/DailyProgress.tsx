"use client";

import { Flame, Swords, Target, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAILY_ALL_CLEAR_TARGET } from "@/lib/system/formula";

interface DailyProgressProps {
    dailyCount: number;
    reportDay: string;
    /** Number of quests completed today */
    todayCount: number;
    /** Number of quests completed this week */
    weekCount: number;
    /** Current consecutive-day streak */
    streak: number;
    /** Total completions all-time */
    totalCompletions: number;
    /** Whether a boss encounter is currently active */
    activeBoss?: {
        name: string;
        currentHp: number;
        maxHp: number;
    } | null;
}

export function DailyProgress({
    dailyCount,
    reportDay,
    todayCount,
    weekCount,
    streak,
    totalCompletions,
    activeBoss,
}: DailyProgressProps) {
    // Determine daily goal tier (9 dailies for Daily All-Clear System Bounty)
    const dailyGoal = DAILY_ALL_CLEAR_TARGET || 9;
    const isAllClear = dailyCount >= dailyGoal;
    const dailyPercent = Math.min(100, (dailyCount / dailyGoal) * 100);
    const weeklyGoal = 25;
    const weeklyPercent = Math.min(100, (weekCount / weeklyGoal) * 100);

    return (
        <div className="glass-panel rounded-lg p-3 md:p-4">
            {/* Title bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-cyan-900/30 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-500" />
                    <span className="text-xs font-mono text-cyan-500 uppercase tracking-widest font-bold">
                        Daily Report
                    </span>
                    {isAllClear && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            ALL-CLEAR BOUNTY ACTIVE
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                    <span>{todayCount} total completions today</span>
                    <span className="text-slate-500 uppercase">
                        {new Date(`${reportDay}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Today */}
                <div 
                    className="flex flex-col gap-1.5 cursor-help"
                    title={`Complete ${dailyGoal} daily quests to claim the Daily Regimen All-Clear Bounty (+10,000 XP, +5,000 Gold, Full Recovery).`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider flex items-center gap-1">
                            Daily quests
                            {isAllClear && (
                                <span className="text-[9px] text-amber-400 font-bold">
                                    ★
                                </span>
                            )}
                        </span>
                        <span className={cn("text-xs font-mono font-bold", isAllClear ? "text-amber-400" : "text-white")}>
                            {dailyCount}<span className="text-slate-600">/{dailyGoal}</span>
                        </span>
                    </div>
                    <div className="h-1.5 bg-cyan-950/30 rounded-full overflow-hidden border border-cyan-900/30">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-700",
                                isAllClear
                                    ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                                    : "bg-cyan-500 shadow-[0_0_6px_rgba(0,242,255,0.3)]"
                            )}
                            style={{ width: `${dailyPercent}%` }}
                        />
                    </div>
                </div>

                {/* This week */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Week total</span>
                        <span className="text-xs font-mono font-bold text-white">
                            {weekCount}<span className="text-slate-600">/{weeklyGoal}</span>
                        </span>
                    </div>
                    <div className="h-1.5 bg-cyan-950/30 rounded-full overflow-hidden border border-cyan-900/30">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-700",
                                weeklyPercent >= 100
                                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                    : "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.3)]"
                            )}
                            style={{ width: `${weeklyPercent}%` }}
                        />
                    </div>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-8 h-8 rounded-md border flex items-center justify-center shrink-0",
                        streak > 0
                            ? "border-orange-500/50 bg-orange-950/30 text-orange-400"
                            : "border-slate-800 bg-slate-900/30 text-slate-600"
                    )}>
                        <Flame className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-mono font-bold text-white leading-none">
                            {streak}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Day Streak</span>
                    </div>
                </div>

                {/* Active Boss or Total */}
                {activeBoss ? (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md border border-red-500/50 bg-red-950/30 flex items-center justify-center shrink-0 animate-pulse">
                            <Swords className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-mono font-bold text-red-400 leading-none truncate" title={activeBoss.name}>
                                {activeBoss.name}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <div className="h-1 flex-1 bg-red-950/30 rounded-full overflow-hidden max-w-[60px]">
                                    <div
                                        className="h-full bg-red-500"
                                        style={{ width: `${(activeBoss.currentHp / activeBoss.maxHp) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-red-400 font-mono">{Math.round((activeBoss.currentHp / activeBoss.maxHp) * 100)}%</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md border border-cyan-900/30 bg-cyan-950/20 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-4 h-4 text-cyan-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-mono font-bold text-white leading-none">
                                {totalCompletions}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase">All-Time</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
