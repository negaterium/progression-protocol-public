"use client";

import { useState, useEffect } from "react";
import { Users, Crown, Sparkles, Ghost, ChevronDown, ChevronUp, Zap, CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getShadowArmyAction, toggleSummonAction, autoAllocateElitesAction } from "@/app/actions/shadows";
import { SHADOW_DATA, formatShadowEffect, getShadowGrade } from "@/lib/game-logic/shadow-data";

interface Shadow {
    id: string;
    name: string;
    rank: string;
    level: number;
    status: 'SUMMONED' | 'STORED';
    image_url?: string;
    boss_name?: string;
}

interface ShadowArmyProps {
    availableInfantry?: number;
    activeAssignments?: {
        id: string;
        quest_id: string;
        shadow_count: number;
        return_at: string;
        quest_title?: string;
    }[];
}

export default function ShadowArmy({ availableInfantry, activeAssignments = [] }: ShadowArmyProps) {
    const [army, setArmy] = useState<Shadow[]>([]);
    const [infantryCount, setInfantryCount] = useState(0);
    const [storageLimit, setStorageLimit] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isDefsExpanded, setIsDefsExpanded] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [optimizeResult, setOptimizeResult] = useState<{ summoned: { name: string; rank: string }[] } | null>(null);

    const loadArmy = async () => {
        try {
            const res = await getShadowArmyAction();
            setArmy(res.shadows);
            setInfantryCount(res.infantryCount);
            setStorageLimit(res.storageLimit);
        } catch (error) {
            console.error("Failed to load army:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadArmy();
    }, []);

    const toggleSummon = async (shadowId: string) => {
        try {
            await toggleSummonAction({ shadowId });
            await loadArmy();
        } catch (error) {
            console.error("Failed to toggle summon:", error);
        }
    };

    const optimizeFormation = async () => {
        if (optimizing) return;
        setOptimizing(true);
        setOptimizeResult(null);
        try {
            const result = await autoAllocateElitesAction();
            if (result.success && result.summoned) {
                setOptimizeResult({ summoned: result.summoned });
                await loadArmy();
                // Auto-dismiss after 5s
                setTimeout(() => setOptimizeResult(null), 5000);
            }
        } catch (error) {
            console.error("Failed to optimize formation:", error);
        } finally {
            setOptimizing(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Summoning the Legion...</div>;

    // Correction:
    const finalTotalInfantry = infantryCount; // From server action
    const finalAvailableInfantry = availableInfantry !== undefined ? availableInfantry : infantryCount; // Fallback to total if no delegation logic

    const displayTotalForces = army.length + finalTotalInfantry;

    return (
        <div className="space-y-6">
            {/* Header / Army Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/40 border border-purple-900/30 p-4 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-purple-900/20 rounded-full text-purple-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-400">Total Forces</div>
                        <div className="text-2xl font-bold font-mono text-white">{displayTotalForces}</div>
                    </div>
                </div>

                <div className="bg-black/40 border border-purple-900/30 p-4 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-purple-900/20 rounded-full text-purple-400">
                        <Ghost className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-400">Infantry (Avail)</div>
                        <div className="text-2xl font-bold font-mono text-white">
                            {finalAvailableInfantry} <span className="text-xs text-slate-500">/ {finalTotalInfantry} <span className="text-purple-500/80">({storageLimit} Max)</span></span>
                        </div>
                    </div>
                </div>

                {/* Active Deployments Card */}
                <div className={cn(
                    "bg-black/40 border border-purple-900/30 rounded-lg flex flex-col gap-4 col-span-2 md:col-span-2 transition-all duration-300",
                    isDefsExpanded ? "p-4 row-span-2" : "p-4"
                )}>
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => activeAssignments.length > 0 && setIsDefsExpanded(!isDefsExpanded)}>
                        <div className="p-3 bg-purple-900/20 rounded-full text-purple-400">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-slate-400">Active Deployments</div>
                                {activeAssignments.length > 0 && (
                                    <button className="text-slate-500 hover:text-white transition-colors">
                                        {isDefsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>

                            {!isDefsExpanded && (
                                <div className="mt-1">
                                    {activeAssignments.length > 0 ? (
                                        <div className="flex gap-2 overflow-hidden">
                                            {activeAssignments.slice(0, 3).map(a => {
                                                const minsLeft = Math.max(0, Math.ceil((new Date(a.return_at).getTime() - Date.now()) / 60000));
                                                return (
                                                    <div key={a.id} className="text-[10px] bg-purple-900/30 border border-purple-500/30 px-2 py-1 rounded whitespace-nowrap flex items-center gap-2">
                                                        <span className="text-purple-300 font-bold">{a.shadow_count} Shd</span>
                                                        <span className="text-slate-500">|</span>
                                                        <span className="text-purple-400 font-mono">{minsLeft}m</span>
                                                    </div>
                                                );
                                            })}
                                            {activeAssignments.length > 3 && (
                                                <div className="text-[10px] bg-slate-800/50 border border-slate-700/30 px-2 py-1 rounded text-slate-400 whitespace-nowrap">
                                                    +{activeAssignments.length - 3} More
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-600 font-mono">NO ACTIVE OPERATIONS</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {isDefsExpanded && activeAssignments.length > 0 && (
                        <div className="border-t border-white/5 pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            {activeAssignments.map(a => {
                                const minsLeft = Math.max(0, Math.ceil((new Date(a.return_at).getTime() - Date.now()) / 60000));
                                return (
                                    <div key={a.id} className="text-xs bg-purple-900/20 border border-purple-500/20 p-2 rounded flex flex-col gap-1">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1">
                                            <span className="text-purple-300 font-bold">{a.shadow_count} Shadows</span>
                                            <span className="text-purple-400 font-mono text-[10px]">{minsLeft}m Left</span>
                                        </div>
                                        <div className="text-slate-400 truncate" title={a.quest_title}>
                                            {a.quest_title || 'Unknown Mission'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Boss Shadows (The Monarch's Elite) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        Elite Shadows
                    </h3>
                    {/* Auto-Optimize Button */}
                    <button
                        id="elite-shadow-optimize-btn"
                        onClick={optimizeFormation}
                        disabled={optimizing}
                        className={cn(
                            "group flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border transition-all duration-300",
                            optimizing
                                ? "border-purple-500/30 bg-purple-900/20 text-purple-400 cursor-wait"
                                : optimizeResult
                                ? "border-emerald-500/50 bg-emerald-900/20 text-emerald-400"
                                : "border-purple-500/30 bg-black/40 text-purple-300 hover:bg-purple-900/40 hover:border-purple-400 hover:text-white"
                        )}
                        title="Auto-select the best elites for your class"
                    >
                        {optimizing ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Optimizing...</>
                        ) : optimizeResult ? (
                            <><CheckCircle className="w-3 h-3" /> Formation Set</>
                        ) : (
                            <><Zap className="w-3 h-3 group-hover:text-yellow-400 transition-colors" /> Optimize Formation</>
                        )}
                    </button>
                </div>

                {/* Optimize Result Flash */}
                {optimizeResult && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-3">
                        <div className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Optimal Formation Deployed
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {optimizeResult.summoned.map((s, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 rounded border font-mono"
                                    style={{
                                        borderColor: s.rank === 'XX' ? 'rgba(234,179,8,0.4)' : s.rank.startsWith('S') ? 'rgba(168,85,247,0.4)' : 'rgba(100,116,139,0.3)',
                                        color: s.rank === 'XX' ? '#fbbf24' : s.rank.startsWith('S') ? '#c084fc' : '#94a3b8',
                                        background: s.rank === 'XX' ? 'rgba(234,179,8,0.08)' : 'rgba(88,28,135,0.15)'
                                    }}
                                >
                                    [{s.rank}] {s.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {army.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center text-slate-500">
                        No Boss Shadows extracted yet. Defeat Dungeon Bosses to recruit them.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...army]
                            .sort((a, b) => {
                                // 1. SUMMONED always before STORED
                                if (a.status !== b.status) return a.status === 'SUMMONED' ? -1 : 1;
                                // 2. Within same status, sort by rank
                                const rankOrder: Record<string, number> = { XX: 0, 'S+': 1, S: 2, A: 3, B: 4, C: 5, D: 6, E: 7 };
                                return (rankOrder[a.rank] ?? 8) - (rankOrder[b.rank] ?? 8);
                            })
                            .map((shadow) => (

                            <div key={shadow.id} className="group relative overflow-hidden bg-black/60 border border-purple-500/30 rounded-lg hover:border-purple-500/80 transition-all duration-300">
                                {/* Background Image/Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90 z-10" />
                                {shadow.image_url && (
                                    <div className="absolute inset-0 grayscale group-hover:grayscale-0 transition-all duration-500 opacity-40 group-hover:opacity-60">
                                        <Image
                                            src={shadow.image_url}
                                            alt={shadow.name}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover"
                                        />
                                    </div>
                                )}

                                <div className="relative z-20 p-4 h-full flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "text-xs font-bold px-1.5 py-0.5 rounded border mb-1 w-fit",
                                                shadow.rank.includes('S') ? "border-red-900 text-red-500 bg-red-950/30" : "border-slate-700 text-slate-400"
                                            )}>
                                                {shadow.rank}-RANK
                                            </span>
                                            <h4 className="font-bold text-lg text-purple-100 group-hover:text-purple-300 transition-colors shadow-black drop-shadow-md">
                                                {shadow.name}
                                            </h4>
                                            <div className="mt-0.5 text-[10px] text-purple-400 font-mono tracking-widest">{getShadowGrade(shadow.level)}</div>
                                        </div>
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        {/* Ability Info */}
                                        <div className="bg-purple-900/10 border border-purple-500/10 rounded p-2">
                                            {SHADOW_DATA[shadow.name] || SHADOW_DATA[shadow.boss_name || ""] ? (
                                                <>
                                                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" />
                                                        {(SHADOW_DATA[shadow.name] || SHADOW_DATA[shadow.boss_name || ""]).name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-300 leading-tight flex justify-between items-center">
                                                        <span>{formatShadowEffect(shadow.name || shadow.boss_name || "", shadow.level)}</span>
                                                        {shadow.level >= 7 && (
                                                            <span className="text-[8px] bg-yellow-500/20 text-yellow-500 px-1 rounded font-bold border border-yellow-500/30">MAX RANK</span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-[10px] text-slate-500 italic">Ability Data Encrypted...</div>
                                            )}
                                        </div>

                                        {/* Status Badge & Toggle */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className={cn(
                                                "flex items-center gap-2 text-xs font-mono py-1 px-2 rounded w-fit",
                                                shadow.status === 'SUMMONED' ? "bg-purple-600/20 text-purple-300" : "bg-slate-800/50 text-slate-500"
                                            )}>
                                                <div className={cn("w-1.5 h-1.5 rounded-full", shadow.status === 'SUMMONED' ? "bg-purple-400 animate-pulse" : "bg-slate-600")} />
                                                {shadow.status}
                                            </div>

                                            <button
                                                onClick={() => toggleSummon(shadow.id)}
                                                className={cn(
                                                    "text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded transition-all",
                                                    shadow.status === 'SUMMONED' ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-purple-900/40 hover:bg-purple-600 text-purple-200 border border-purple-500/30"
                                                )}
                                            >
                                                {shadow.status === 'SUMMONED' ? 'Release' : 'Summon'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Shadow Infantry Visualization (Silhouette Mass) */}
            <div className="relative border-t border-white/5 pt-6">
                <div className="absolute inset-0 bg-gradient-to-t from-purple-950/20 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                        <Ghost className="w-4 h-4 text-purple-500" />
                        Shadow Infantry
                    </h3>

                    <div className="flex flex-wrap gap-3">
                        {Array.from({ length: Math.min(infantryCount, 100) }).map((_, i) => (
                            <div
                                key={i}
                                className="group/infantry relative w-8 h-8 flex items-center justify-center bg-purple-900/20 border border-purple-500/10 rounded-md hover:bg-purple-600/30 hover:border-purple-500/50 transition-all duration-300"
                                title="Shadow Soldier"
                            >
                                <Ghost className="w-5 h-5 text-purple-500/40 group-hover/infantry:text-purple-400 group-hover/infantry:scale-110 transition-all" />
                                <div className="absolute -bottom-1 w-1/2 h-[1px] bg-purple-500/50 blur-[1px] group-hover/infantry:w-full transition-all" />
                            </div>
                        ))}
                        {infantryCount > 100 && (
                            <div className="flex items-center justify-center p-3 text-xs text-purple-400/60 font-mono bg-purple-900/10 border border-dashed border-purple-500/20 rounded-md">
                                + {infantryCount - 100} MORE SHADOWS
                            </div>
                        )}
                        {infantryCount === 0 && (
                            <div className="w-full py-8 text-center text-slate-600 border border-dashed border-slate-800 rounded-lg">
                                No infantry extracted. Extract shadows from minor dungeon monsters.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
