"use client";

import { Database } from "@/types/database.types";
import { QuestCard } from "./QuestCard";

type Quest = Database['public']['Tables']['quests']['Row'] & { zone_name?: string };

interface QuestGridProps {
    title: string;
    quests: Quest[];
    userLevel?: number;
    userStats?: { strength: number, agility: number, intelligence: number, vitality: number, perception: number };
    userMana?: number;
    onComplete?: (id: number) => void;
    onFail?: (id: number) => void;
    voidStrikeAvailable?: boolean;
    onVoidStrike?: (id: number) => void;
    modifiers?: Record<string, number>;
    availableShadows?: number;
    hunterClass?: string;
    onDelegate?: (id: number) => void;
    zones?: any[];
}

export function QuestGrid({ title = "QUEST LOG", quests = [], userLevel = 1, userStats, userMana = 0, onComplete, onFail, voidStrikeAvailable = false, onVoidStrike, modifiers = {}, availableShadows, hunterClass, onDelegate, zones = [] }: Partial<QuestGridProps>) {
    return (
        <div className="glass-panel p-6 rounded-lg mb-8">
            <div className="flex justify-between items-center mb-6 border-b border-cyan-900/30 pb-2">
                <div>
                    <h2 className="text-xl font-bold text-white font-sans tracking-widest flex items-center gap-2">
                        {title} <span className="text-xs text-cyan-800 font-mono mt-1">{'//'} {quests.length} ENTRIES</span>
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quests.map(quest => (
                    <QuestCard
                        key={quest.id}
                        quest={quest}
                        userLevel={userLevel}
                        userStats={userStats}
                        userMana={userMana}
                        onComplete={onComplete}
                        onFail={onFail}
                        voidStrikeAvailable={voidStrikeAvailable}
                        onVoidStrike={onVoidStrike}
                        modifiers={modifiers}
                        availableShadows={availableShadows}
                        hunterClass={hunterClass}
                        onDelegate={onDelegate}
                        zones={zones}
                    />
                ))}

                {quests.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                        <div className="font-mono text-sm text-slate-500 mb-2">NO DATA FOUND IN SECTOR</div>
                        <div className="text-[10px] text-cyan-900 font-mono">Standby for incoming mission parameters...</div>
                    </div>
                )}
            </div>
        </div>
    );
}
