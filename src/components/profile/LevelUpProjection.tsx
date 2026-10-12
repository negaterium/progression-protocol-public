"use client";

import { useEffect, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { TrendingUp, Clock, CalendarDays, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getXPLogsAction } from "@/app/actions/stats";
import { calculateXpForLevel } from "@/lib/system/formula";

interface LevelUpProjectionProps {
    userId: string;
    currentXp: number;
    nextLevelXp: number;
    level: number;
}

export function LevelUpProjection({ userId, currentXp, nextLevelXp, level }: LevelUpProjectionProps) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        daysRemaining: 0,
        dailyAverage: 0,
        xpNeeded: 0,
        projectionDate: null as Date | null,
        status: 'ANALYZING' as 'ANALYZING' | 'SUFFICIENT' | 'INSUFFICIENT'
    });

    useEffect(() => {
        const analyzeGrowth = async () => {
            if (!userId) return;

            setLoading(true);

            try {
                // Fetch XP logs via Server Action
                const logs = await getXPLogsAction(7);

                if (logs && logs.length > 0) {
                    // 1. Calculate Total XP in period
                    const totalRecentXp = logs.reduce((sum: number, log: any) => sum + (log.xp_reward || 0), 0);

                    // 2. Calculate Active Days in period (to avoid diluting avg if user just started 2 days ago)
                    // Actually, for "Projection", strict 7-day average is more realistic for "Time" estimation?
                    // Or "Active Days Average"?
                    // Let's use strict 7-day divisor to represent "Real Time" speed, 
                    // BUT if they registered < 7 days ago, use that count.

                    // For simplicity and robustness:
                    // Find earliest log in the batch.
                    const earliestDate = logs.reduce((earliest: Date, log: any) => {
                        const d = new Date(log.completed_at);
                        return d < earliest ? d : earliest;
                    }, new Date());

                    const daysAnalyzing = Math.max(1, differenceInDays(new Date(), earliestDate) + 1);
                    const dailyAverage = Math.floor(totalRecentXp / daysAnalyzing);

                    // 3. Projection
                    const xpNeeded = Math.max(0, nextLevelXp - currentXp);

                    if (dailyAverage > 0) {
                        const daysRemaining = Math.ceil(xpNeeded / dailyAverage);
                        const projectionDate = new Date();
                        projectionDate.setDate(projectionDate.getDate() + daysRemaining);

                        setStats({
                            daysRemaining,
                            dailyAverage,
                            xpNeeded,
                            projectionDate,
                            status: 'SUFFICIENT'
                        });
                    } else {
                        setStats(prev => ({ ...prev, xpNeeded, status: 'INSUFFICIENT' }));
                    }
                } else {
                    setStats(prev => ({
                        ...prev,
                        xpNeeded: Math.max(0, nextLevelXp - currentXp),
                        status: 'INSUFFICIENT'
                    }));
                }
            } catch (error) {
                console.error("Failed to analyze growth:", error);
            }
            setLoading(false);
        };

        analyzeGrowth();
    }, [userId, currentXp, nextLevelXp]);

    if (loading) return <div className="animate-pulse h-32 bg-slate-900/20 rounded-lg border border-white/5" />;

    const levelStartXp = calculateXpForLevel(level);
    const xpIntoLevel = Math.max(0, currentXp - levelStartXp);
    const xpNeededForLevel = Math.max(0, nextLevelXp - levelStartXp);
    const percentProgress = xpNeededForLevel > 0
        ? Math.min(100, Math.round((xpIntoLevel / xpNeededForLevel) * 100))
        : 100;

    return (
        <div className="glass-panel p-5 rounded-lg border border-white/10 relative overflow-hidden group">
            {/* Background Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-900/10 blur-[50px] -z-10 group-hover:bg-cyan-900/20 transition-colors" />

            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-cyan-500" />
                        Growth Projection
                    </h3>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                        LEVEL {level} &rarr; {level + 1}
                    </div>
                </div>
                {stats.status === 'SUFFICIENT' && (
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white font-mono leading-none">
                            {stats.daysRemaining} <span className="text-xs text-slate-500">DAYS</span>
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono mt-1">
                            EST: {stats.projectionDate ? format(stats.projectionDate, 'MMM do') : 'N/A'}
                        </div>
                    </div>
                )}
                {stats.status === 'INSUFFICIENT' && (
                    <div className="text-right">
                        <div className="text-xl font-bold text-slate-600 font-mono leading-none">
                            TBD
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono mt-1">
                            MORE DATA NEEDED
                        </div>
                    </div>
                )}
            </div>

            {/* Progress Bar with markers */}
            <div className="relative mb-4">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>{xpIntoLevel.toLocaleString()} LEVEL XP</span>
                    <span>{xpNeededForLevel.toLocaleString()} LEVEL XP</span>
                </div>
                <Progress
                    value={percentProgress}
                    className="h-2 bg-slate-950 border border-slate-800"
                    indicatorClassName="bg-cyan-600"
                    aria-label="Level XP progress"
                />
                <div className="text-right text-[9px] text-slate-600 font-mono" title={`Total XP: ${currentXp.toLocaleString()} / ${nextLevelXp.toLocaleString()}`}>
                    TOTAL XP: {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()}
                </div>
                <div className="text-center text-[10px] text-cyan-500/80 font-mono mt-1">
                    {stats.xpNeeded} XP REMAINING
                </div>
            </div>

            {/* Stats Footer */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-green-950/30 rounded border border-green-900/30">
                        <CalendarDays className="w-3 h-3 text-green-500" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase">Daily Avg</div>
                        <div className="text-xs font-bold text-slate-300 font-mono">
                            {stats.status === 'SUFFICIENT' ? `+${stats.dailyAverage} XP` : 'CALCULATING...'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-950/30 rounded border border-purple-900/30">
                        <Clock className="w-3 h-3 text-purple-500" />
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase">Velocity</div>
                        <div className="text-xs font-bold text-slate-300 font-mono">
                            {stats.status === 'SUFFICIENT' ? 'STABLE' : 'LOW DATA'}
                        </div>
                    </div>
                </div>
            </div>

            {stats.status === 'INSUFFICIENT' && (
                <div className="mt-3 flex items-start gap-2 p-2 bg-yellow-950/10 border border-yellow-900/20 rounded text-[10px] text-yellow-600 font-mono">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    Complete more quests to establish a growth baseline.
                </div>
            )}
        </div>
    );
}
