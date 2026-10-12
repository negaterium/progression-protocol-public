"use client";

import { subDays, format, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Circle, Settings as SettingsIcon, Calendar, ListTodo, Activity, Award, Coins, Zap, TrendingUp, Users } from "lucide-react";
import { calculateScaledQuestReward } from "@/lib/system/formula";

interface ProductivityHubProps {
    quests: any[];
    userMana: number;
    userLevel?: number;
    userStats?: { strength: number, agility: number, intelligence: number, vitality: number, perception: number };
    logs: any[]; // New prop for MonthView
    onComplete?: (id: string, xp: number, manaCost: number) => void;
    lastUpdated?: number;
    hunterClass?: string;
    availableShadows?: number;
    onDelegate?: (id: string) => void;
}

export function ProductivityHub({ logs = [] }: ProductivityHubProps) {
    const [activeTab, setActiveTab] = useState<'MONTH' | 'SETTINGS'>('MONTH');

    return (
        <div className="glass-panel p-6 rounded-lg min-h-[400px] flex flex-col">
            {/* Tabs Header */}
            <div className="flex items-center gap-6 border-b border-cyan-900/30 pb-4 mb-6">
                {/* Agenda Tab Removed - Moved to MissionControl */}
                <button
                    onClick={() => setActiveTab('MONTH')}
                    className={cn(
                        "flex items-center gap-2 text-sm font-bold transition-all uppercase tracking-wider",
                        activeTab === 'MONTH' ? "text-white border-b-2 border-cyan-500 pb-4 -mb-4.5" : "text-slate-500 hover:text-cyan-400"
                    )}
                >
                    <Calendar className="w-4 h-4" /> Month/History
                </button>
                <button
                    onClick={() => setActiveTab('SETTINGS')}
                    className={cn(
                        "flex items-center gap-2 text-sm font-bold transition-all uppercase tracking-wider ml-auto",
                        activeTab === 'SETTINGS' ? "text-white border-b-2 border-cyan-500 pb-4 -mb-4.5" : "text-slate-500 hover:text-cyan-400"
                    )}
                >
                    <SettingsIcon className="w-4 h-4" /> Settings
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1">
                {activeTab === 'MONTH' && <MonthView logs={logs} />}
                {activeTab === 'SETTINGS' && <SettingsView />}
            </div>
        </div>
    );
}


// ... AgendaView (Same as before) ...
export interface AgendaViewProps {
    quests: any[];
    userMana: number;
    userLevel: number;
    userStats?: any;
    onComplete?: (id: string, xp: number, manaCost: number) => void;
    hunterClass?: string;
    availableShadows?: number;
    onDelegate?: (id: string) => void;
}

export function AgendaView({ quests, userMana, userLevel, userStats, onComplete, hunterClass, availableShadows, onDelegate }: AgendaViewProps) {
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    const toggleExpand = (id: string | number) => {
        const strId = String(id);
        setExpandedIds(prev => prev.includes(strId) ? prev.filter(p => p !== strId) : [...prev, strId]);
    };

    const dailies = quests.filter(q => q.type === 'Daily');

    const todos = dailies.sort((a, b) => {
        if (a.status === 'Complete' && b.status !== 'Complete') return 1;
        if (a.status !== 'Complete' && b.status === 'Complete') return -1;
        return 0;
    });

    if (dailies.length === 0) {
        return <div className="text-center text-slate-500 py-10 font-mono">NO ACTIVE ROUTINES ASSIGNED.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {todos.map(quest => {
                const isDone = quest.status === 'Complete';
                const isExpanded = expandedIds.includes(String(quest.id));
                const isLocked = false;

                const {
                    finalXp,
                    finalManaCost: scaledManaCost,
                    synergyStat,
                    hasBonus
                } = calculateScaledQuestReward(
                    quest.xp_reward || 0,
                    quest.gold_reward || 0,
                    quest.mana_cost || 0,
                    userLevel,
                    userStats,
                    quest.skill_rewards as any,
                    0, // completedDailies not passed here yet
                    quest.difficulty || undefined
                );

                const finalManaCost = scaledManaCost;
                const canAfford = userMana >= finalManaCost;

                return (
                    <div
                        key={quest.id}
                        className={cn(
                            "flex flex-col rounded border transition-all duration-300",
                            isDone
                                ? "bg-green-950/10 border-green-900/20 opacity-60"
                                : isExpanded
                                    ? "bg-slate-900/60 border-cyan-900/50 shadow-[0_0_15px_rgba(8,145,178,0.1)]"
                                    : "bg-slate-900/40 border-slate-800 hover:border-cyan-900/30"
                        )}
                    >
                        {/* Main Row */}
                        <div
                            className="flex items-center justify-between p-3 cursor-pointer"
                            onClick={() => toggleExpand(quest.id)}
                        >
                            <div className="flex items-center gap-4">
                                <button
                                    disabled={isDone || !canAfford}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isDone && canAfford && !isLocked && onComplete) {
                                            onComplete(quest.id, finalXp, finalManaCost);
                                        }
                                    }}
                                    className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center border transition-all",
                                        isDone
                                            ? "bg-green-500/20 border-green-500 text-green-500"
                                            : !canAfford || isLocked
                                                ? "border-red-900/50 bg-red-950/20 text-red-700 cursor-not-allowed"
                                                : "border-slate-600 text-transparent hover:border-cyan-400 hover:bg-cyan-950/30 hover:text-cyan-400/50"
                                    )}
                                >
                                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                </button>

                                <div>
                                    <div className={cn("text-sm font-bold font-sans tracking-wide", isDone ? "text-slate-500 line-through" : "text-slate-200")}>
                                        {quest.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                        <span className="text-cyan-700 font-bold">{quest.difficulty || 'E'}</span>
                                        <span>{'//'}</span>
                                        <span className="text-slate-400 font-bold uppercase">{quest.type}</span>
                                        <span>{'//'}</span>
                                        {(() => {
                                            return (
                                                <span className={cn(
                                                    "flex items-center gap-1",
                                                    hasBonus ? "text-cyan-400 font-bold" : "text-slate-400"
                                                )}>
                                                    REWARDS: {hasBonus && <TrendingUp className="w-2 h-2" />}
                                                    {finalXp} XP
                                                    {synergyStat && <span className="text-[8px] text-purple-400">({synergyStat})</span>}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right flex items-center gap-3">
                                {finalManaCost > 0 && !isDone && (
                                    <div className={cn("text-[10px] font-mono", canAfford ? "text-blue-400" : "text-red-500 font-bold animate-pulse")}>
                                        -{finalManaCost} MP
                                    </div>
                                )}
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded uppercase min-w-[70px] text-center",
                                    isDone ? "bg-green-900/20 text-green-600" : isLocked ? "bg-red-950/20 text-red-600" : "bg-cyan-900/20 text-cyan-500"
                                )}>
                                    {isDone ? "DONE" : "PENDING"}
                                </span>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && !isDone && (
                            <div className="px-12 pb-4 pt-0 animate-in slide-in-from-top-2">
                                <div className="text-xs text-slate-400 font-sans leading-relaxed border-l-2 border-slate-700 pl-3 mb-3">
                                    {quest.description || "No tactical details provided."}
                                </div>
                                <div className="flex justify-end gap-2">
                                    {/* Delegate Button - Necromancer Only */}
                                    {onDelegate && (hunterClass || '').toLowerCase() === 'necromancer' && (() => {
                                        const rank = quest.difficulty || 'E';
                                        const costs: Record<string, number> = { 'E': 10, 'D': 25, 'C': 50, 'B': 100, 'A': 250, 'S': 500 };
                                        const cost = costs[rank] || 5;
                                        const canDelegate = (availableShadows || 0) >= cost;

                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelegate(quest.id);
                                                }}
                                                disabled={!canDelegate}
                                                className={cn(
                                                    "px-4 py-2 text-xs font-bold font-mono rounded uppercase transition-all flex items-center gap-2 border",
                                                    canDelegate
                                                        ? "bg-purple-900/20 text-purple-400 border-purple-500/50 hover:bg-purple-900/40 hover:text-white"
                                                        : "bg-black/40 text-slate-700 border-slate-800 cursor-not-allowed"
                                                )}
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                {canDelegate ? `DELEGATE (-${cost})` : `NEED ${cost} SHADOWS`}
                                            </button>
                                        );
                                    })()}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canAfford && !isLocked && onComplete) onComplete(quest.id, finalXp, finalManaCost);
                                        }}
                                        disabled={!canAfford || isLocked}
                                        className={cn(
                                            "px-4 py-2 text-xs font-bold font-mono rounded uppercase transition-all flex items-center gap-2",
                                            canAfford && !isLocked
                                                ? "bg-cyan-600 text-black hover:bg-cyan-500 hover:shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                                                : "bg-red-950/20 text-red-500 border border-red-900/50 cursor-not-allowed"
                                        )}
                                    >
                                        {canAfford ? "EXECUTE MISSION" : "NO MANA"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ------------------------------------

export function MonthView({ logs }: { logs: any[] }) {
    const [today, setToday] = useState(() => new Date());
    useEffect(() => {
        const interval = setInterval(() => {
            const nextToday = new Date();
            setToday(currentToday => (
                format(currentToday, "yyyy-MM-dd") === format(nextToday, "yyyy-MM-dd")
                    ? currentToday
                    : nextToday
            ));
        }, 60_000);

        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        // Calculate Current Month Stats
        const currentMonthLogs = logs.filter((l: any) => isSameMonth(new Date(l.completed_at), today));
        return currentMonthLogs.reduce((acc: any, curr: any) => ({
            quests: acc.quests + 1,
            xp: acc.xp + (curr.xp_reward || 0),
            // Gold logic is tricky without join. Assume 0 or pass gold map?
            // If quest_logs has no gold, we drop tracking gold here or rely on backend to pass it.
            // Let's assume gold is not strictly tracked here unless joined.
            gold: acc.gold + (curr.gold || 0),
            bosses: acc.bosses + ((curr.quest_type === 'BOSS' || (curr.quest_title || '').toLowerCase().includes('boss')) ? 1 : 0)
        }), { quests: 0, xp: 0, gold: 0, bosses: 0 });
    }, [logs, today]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Monthly Summary Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="QUESTS CLEARED" value={stats.quests} icon={<ListTodo className="w-4 h-4 text-cyan-500" />} />
                <SummaryCard label="XP GAINED" value={stats.xp} icon={<Activity className="w-4 h-4 text-green-500" />} />
                <SummaryCard label="GOLD EARNED" value={stats.gold} icon={<Coins className="w-4 h-4 text-yellow-500" />} />
                <SummaryCard label="BOSSES DEFEATED" value={stats.bosses} icon={<Zap className="w-4 h-4 text-red-500" />} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. System Activity (Green) */}
                <UnifiedHeatmap
                    title="System Activity"
                    color="green"
                    icon={<Activity className="w-4 h-4 text-green-500" />}
                    data={logs}
                    referenceDate={today}
                    calcIntensity={(dayLogs) => {
                        const count = dayLogs.length;
                        if (count >= 3) return 2;
                        if (count >= 1) return 1;
                        return 0;
                    }}
                />

                {/* 2. Quest Volume (Blue) */}
                <UnifiedHeatmap
                    title="Daily Mission Activity"
                    color="cyan"
                    icon={<CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                    data={logs}
                    referenceDate={today}
                    calcIntensity={(dayLogs) => {
                        // Count completed 'Daily' quests
                        const count = dayLogs.filter(l => l.quest_type === 'Daily').length;
                        if (count >= 5) return 2;
                        if (count >= 1) return 1;
                        return 0;
                    }}
                />

                {/* 3. Physical Intensity (Orange) */}
                <UnifiedHeatmap
                    title="Physical Intensity"
                    color="orange"
                    icon={<Award className="w-4 h-4 text-orange-500" />}
                    data={logs}
                    referenceDate={today}
                    calcIntensity={(dayLogs) => {
                        const physical = dayLogs.filter((l: any) => {
                            const t = (l.quest_title || '').toLowerCase();
                            const type = (l.quest_type || '').toLowerCase();
                            const keywords = ['strength', 'push', 'run', 'squat', 'workout', 'gym', 'train', 'situp', 'curl', 'sprint', 'jog', 'flex'];
                            return keywords.some(k => t.includes(k) || type.includes('fitness') || type.includes('strength'));
                        }).length;

                        if (physical >= 3) return 2;
                        if (physical >= 1) return 1;
                        return 0;
                    }}
                />

                {/* 4. Mental Fortitude (Purple) */}
                <UnifiedHeatmap
                    title="Mental Fortitude"
                    color="purple"
                    icon={<Calendar className="w-4 h-4 text-purple-500" />}
                    data={logs}
                    referenceDate={today}
                    calcIntensity={(dayLogs) => {
                        const mental = dayLogs.filter((l: any) => {
                            const t = (l.quest_title || '').toLowerCase();
                            const type = (l.quest_type || '').toLowerCase();
                            const keywords = ['read', 'study', 'meditat', 'focus', 'learn', 'write', 'code', 'logic', 'chess', 'analy'];
                            return keywords.some(k => t.includes(k) || type.includes('intel') || type.includes('wis'));
                        }).length;
                        if (mental >= 1) return 2;
                        return 0;
                    }}
                />
            </div>
        </div>
    );
}

function UnifiedHeatmap({
    title,
    color,
    icon,
    data,
    referenceDate,
    calcIntensity
}: {
    title: string,
    color: string,
    icon: React.ReactNode,
    data: any[],
    referenceDate: Date,
    calcIntensity: (logs: any[]) => number // Returns 0, 1, or 2
}) {
    const prefixDays = useMemo(() => {
        const startDate = subDays(referenceDate, 90);
        const startDayOfWeek = startDate.getDay(); // 0 is Sunday, 1 is Monday
        return Array.from({ length: startDayOfWeek }).map(() => null);
    }, [referenceDate]);

    const days = useMemo(() => {
        // Generate last 90 days
        return Array.from({ length: 91 }).map((_, i) => {
            const date = subDays(referenceDate, 90 - i);

            // Find logs for this day
            const dayLogs = data.filter(l => isSameDay(new Date(l.completed_at), date));
            const intensity = calcIntensity(dayLogs);

            return { date, intensity };
        });
    }, [data, referenceDate, calcIntensity]);

    const getColor = (intensity: number) => {
        if (intensity === 0) return "bg-[#161b22]";
        switch (color) {
            case "green": return intensity === 2 ? "bg-green-500" : "bg-green-900";
            case "orange": return intensity === 2 ? "bg-orange-500" : "bg-orange-900";
            case "purple": return intensity === 2 ? "bg-purple-500" : "bg-purple-900";
            case "cyan": return intensity === 2 ? "bg-cyan-500" : "bg-cyan-900";
            case "yellow": return intensity === 2 ? "bg-yellow-500" : "bg-yellow-900";
            default: return "bg-slate-700";
        }
    };

    return (
        <div className="bg-[#0d1117] border border-cyan-900/30 p-4 rounded-lg overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    {icon} {title}
                </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 items-start mt-2">
                {/* Y-Axis Labels (Sun-Sat) */}
                <div className="grid grid-rows-7 gap-1 text-[8px] text-slate-600 font-mono text-right pr-1">
                    <span className="h-3 flex items-center justify-end"></span>
                    <span className="h-3 flex items-center justify-end">M</span>
                    <span className="h-3 flex items-center justify-end"></span>
                    <span className="h-3 flex items-center justify-end">W</span>
                    <span className="h-3 flex items-center justify-end"></span>
                    <span className="h-3 flex items-center justify-end">F</span>
                    <span className="h-3 flex items-center justify-end"></span>
                </div>

                {/* Grid container with 7 rows, auto columns, flowing vertically then horizontally */}
                <div
                    className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto hide-scrollbar pb-1"
                    role="group"
                    aria-label={`${title} activity heatmap`}
                >
                    {prefixDays.map((_, i) => (
                        <div key={`empty-${i}`} className="w-3 h-3 bg-transparent" aria-hidden="true" />
                    ))}
                    {days.map((d, i) => (
                        <div 
                            key={`day-${i}`} 
                            className={cn("w-3 h-3 rounded-sm transition-colors cursor-help", getColor(d.intensity))} 
                            role="img"
                            aria-label={`${format(d.date, "MMMM d, yyyy")}: ${d.intensity === 0 ? "no activity" : `activity level ${d.intensity}`}`}
                            title={`${format(d.date, "MMM d, yyyy")}: Level ${d.intensity}`} 
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function SettingsView() {
    return (
        <div className="text-center py-12 text-slate-600 font-mono animate-in fade-in duration-500">
            <SettingsIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            SYSTEM SETTINGS LOCKED.<br />
            Feature pending Level 10 Authorization.
        </div>
    );
}

function SummaryCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
    return (
        <div className="bg-[#0d1117] border border-cyan-900/30 p-4 rounded-lg flex flex-col justify-between h-24">
            <div className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                {icon}
                {label}
            </div>
            <div className="text-2xl font-bold text-white font-mono">
                {value}
            </div>
        </div>
    );
}
