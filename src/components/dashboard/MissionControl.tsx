"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveMissions } from "@/components/dashboard/ActiveMissions";
import { AgendaView } from "@/components/dashboard/ProductivityHub";

interface MissionControlProps {
    quests: any[];
    reportDay: string;
    userMana: number;
    userLevel: number;
    userStats?: any;
    onComplete?: (id: string, xp: number, manaCost: number) => void;
    onGiveUp?: (id: string) => void;
    hunterClass?: string;
    availableShadows?: number;
    onDelegate?: (id: string) => void;
}

export function MissionControl({
    quests,
    reportDay,
    userMana,
    userLevel,
    userStats,
    onComplete,
    onGiveUp,
    hunterClass,
    availableShadows,
    onDelegate
}: MissionControlProps) {
    const [viewMode, setViewMode] = useState<'CARDS' | 'CHECKLIST'>('CARDS');

    // Persist view mode preference
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const saved = localStorage.getItem('mission_control_view');
            if (saved === 'CARDS' || saved === 'CHECKLIST') setViewMode(saved);
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    const handleToggle = (mode: 'CARDS' | 'CHECKLIST') => {
        setViewMode(mode);
        localStorage.setItem('mission_control_view', mode);
    };

    return (
        <div className="space-y-4">
            {/* Header / Toggle */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-sans tracking-wide text-white flex items-center gap-2">
                    MISSION CONTROL
                </h2>

                <div className="flex bg-black/40 p-1 rounded-md border border-white/10">
                    <button
                        onClick={() => handleToggle('CARDS')}
                        className={cn(
                            "p-1.5 rounded transition-all",
                            viewMode === 'CARDS'
                                ? "bg-cyan-950/60 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                : "text-slate-600 hover:text-slate-400"
                        )}
                        title="Card View (Active Missions)"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleToggle('CHECKLIST')}
                        className={cn(
                            "p-1.5 rounded transition-all",
                            viewMode === 'CHECKLIST'
                                ? "bg-cyan-950/60 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                : "text-slate-600 hover:text-slate-400"
                        )}
                        title="Checklist View (Agenda)"
                    >
                        <ListTodo className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in duration-300">
                {viewMode === 'CARDS' ? (
                    <ActiveMissions
                        quests={quests}
                        reportDay={reportDay}
                        userMana={userMana}
                        userLevel={userLevel}
                        userStats={userStats}
                        onComplete={onComplete}
                        onGiveUp={onGiveUp}
                        hunterClass={hunterClass}
                        availableShadows={availableShadows}
                        onDelegate={onDelegate}
                    />
                ) : (
                    <div className="glass-panel p-6 rounded-lg">
                        <AgendaView
                            quests={quests}
                            userMana={userMana}
                            userLevel={userLevel}
                            userStats={userStats}
                            onComplete={onComplete}
                            hunterClass={hunterClass}
                            availableShadows={availableShadows}
                            onDelegate={onDelegate}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
