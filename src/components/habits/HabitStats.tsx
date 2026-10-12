"use client";

import { useEffect, useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import { Activity, Calendar, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface HabitStatsProps {
    logs: any[];
}

export function HabitStats({ logs = [] }: HabitStatsProps) {
    const [time, setTime] = useState(new Date());
    // Stats are now derived via useMemo

    // Clock Tick
    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Calculate Stats
    const stats = useMemo(() => {
        const endDate = time;
        const startDate = subDays(endDate, 30); // Analysing last 30 days
        const recentLogs = logs.filter((log: any) => new Date(log.completed_at) >= startDate);

        // 1. Total Logs
        const totalLogs = recentLogs.length;

        // 2. Total XP
        const totalXp = recentLogs.reduce((sum: number, log: any) => sum + (log.xp_reward || 0), 0);

        // 3. Consistency (Unique Days / 30)
        const uniqueDays = new Set(recentLogs.map((log: any) =>
            format(new Date(log.completed_at), 'yyyy-MM-dd')
        )).size;
        const consistency = Math.round((uniqueDays / 30) * 100);

        // 4. Current Streak
        const daysWithLogs = new Set(logs.map((log: any) => format(new Date(log.completed_at), 'yyyy-MM-dd')));
        let streak = 0;

        for (let i = 0; i < 365; i++) {
            const d = subDays(endDate, i);
            const key = format(d, 'yyyy-MM-dd');

            if (daysWithLogs.has(key)) {
                streak++;
            } else {
                if (i === 0) {
                    continue; // Today missing, streak alive
                } else {
                    break;
                }
            }
        }

        return {
            totalLogs,
            totalXp,
            consistency,
            streak
        };
    }, [logs, time]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {/* Clock Module */}
            <div className="lg:col-span-1 bg-black/40 border border-cyan-900/30 rounded-lg p-6 flex flex-col justify-center items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-cyan-900/5 group-hover:bg-cyan-900/10 transition-colors" />
                <div className="text-xs font-mono text-cyan-600 tracking-widest mb-2 relative z-10">SYSTEM TIME</div>
                <div className="text-5xl font-bold font-mono text-white tracking-tight relative z-10 tabular-nums" suppressHydrationWarning>
                    {format(time, "HH:mm:ss")}
                </div>
                <div className="text-sm font-mono text-slate-500 mt-2 relative z-10" suppressHydrationWarning>
                    {format(time, "EEEE, MMMM do, yyyy").toUpperCase()}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox
                    label="TOTAL COMPLETIONS"
                    value={stats.totalLogs}
                    icon={<Activity className="w-4 h-4 text-green-500" />}
                    sublabel="LAST 30 DAYS"
                />
                <StatBox
                    label="CONSISTENCY"
                    value={`${stats.consistency}%`}
                    icon={<Calendar className="w-4 h-4 text-cyan-500" />}
                    sublabel="ACTIVE DAYS"
                />
                <StatBox
                    label="CURRENT STREAK"
                    value={stats.streak}
                    icon={<Zap className="w-4 h-4 text-yellow-500" />}
                    sublabel="CONSECUTIVE DAYS"
                    highlight
                />
                <StatBox
                    label="XP GENERATED"
                    value={stats.totalXp}
                    icon={<Trophy className="w-4 h-4 text-purple-500" />}
                    sublabel="PRODUCTIVITY GAIN"
                />
            </div>
        </div>
    );
}

function StatBox({ label, value, icon, sublabel, highlight }: any) {
    return (
        <div className={cn(
            "bg-black/40 border rounded-lg p-4 flex flex-col justify-between h-32 relative overflow-hidden transition-all hover:border-cyan-900/50",
            highlight ? "border-yellow-900/30" : "border-white/5"
        )}>
            {highlight && <div className="absolute inset-0 bg-yellow-900/5 pointer-events-none" />}

            <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">{label}</span>
                {icon}
            </div>

            <div className="relative z-10">
                <div className={cn(
                    "text-3xl font-bold font-mono",
                    highlight ? "text-yellow-400" : "text-white"
                )}>
                    {value}
                </div>
                <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase">
                    {sublabel}
                </div>
            </div>
        </div>
    );
}
