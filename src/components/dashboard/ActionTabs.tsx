
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Target, Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestsClient } from "@/components/quests/QuestsClient";
import { BossesClient } from "@/components/bosses/BossesClient";

interface ActionTabsProps {
    questsData: {
        initialZones: any[];
        initialQuests: any[];
        initialMana: number;
        initialLevel: number;
        initialStats: any;
        voidStrikeState: any;
        availableShadows?: number;
        hunterClass?: string;
        modifiers: any;
        initialQuestLogs?: any[];
    };
    bossesData: {
        initialBosses: any[];
        initialHistory: any[];
        initialUserLevel: number;
        initialUserGold: number;
        initialInventory: any[];
        initialKeys: any[];
        storeDiscount: number;
    };
}

const TABS = [
    { id: "quests", label: "QUESTS & MISSIONS", icon: Target },
    { id: "bosses", label: "BOSS RAIDS", icon: Sword },
];

export function ActionTabs({ questsData, bossesData }: ActionTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("s_tab") || "quests";

    const handleTabChange = (tabId: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("s_tab", tabId);
        router.replace(`?${params.toString()}`);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-[112px] lg:top-14 z-20 bg-black/80 backdrop-blur-md border-b border-cyan-900/30 h-14">
                <div className="flex items-center overflow-x-auto no-scrollbar px-4 py-2 gap-2 lg:gap-4 lg:justify-start">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 whitespace-nowrap",
                                    isActive
                                        ? "bg-cyan-950/50 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.2)]"
                                        : "bg-transparent border-transparent text-slate-500 hover:text-cyan-200 hover:bg-cyan-950/20"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="font-mono font-bold tracking-wider text-sm">
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <main className="h-full overflow-y-auto custom-scrollbar p-0 lg:p-0">
                    {activeTab === "quests" && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            <QuestsClient
                                {...questsData}
                            />
                        </div>
                    )}

                    {activeTab === "bosses" && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            <BossesClient
                                {...bossesData}
                            />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
