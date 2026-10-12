"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchActiveEncounterAction, forfeitBossBattleAction } from "@/app/actions/bosses";
import { cn } from "@/lib/utils";
import { Shield, Skull, Zap, Sword, Target, Flame, Droplets, Snowflake, Ghost, ChevronDown, ChevronUp } from "lucide-react";
import { StatusEffect } from "@/lib/game-logic/boss-ability-manager";
import { createPortal } from "react-dom";
import { getAbilityIntel, getResistanceIntel, getWeaknessIntel, IntelMetadata } from "@/lib/game-logic/boss-intel-metadata";

interface IntelTooltipProps {
    children: React.ReactNode;
    metadata: IntelMetadata;
    position?: "left" | "right" | "top";
}

function IntelTooltip({
    children,
    metadata,
    position = "right"
}: IntelTooltipProps) {
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

    const handleMouseEnter = (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
        setMousePos(null);
    };

    return (
        <div
            className="inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {mousePos && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed pointer-events-none transition-opacity duration-200 z-[9999]"
                    style={{
                        top: mousePos.y + 10,
                        left: position === "right" ? mousePos.x + 20 : mousePos.x - 280,
                        transform: mousePos.y > (typeof window !== 'undefined' ? window.innerHeight - 200 : 0) ? 'translateY(-100%)' : 'none'
                    }}
                >
                    <div className="w-[260px] p-4 bg-black/95 border border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.5)] 
                            rounded-lg border-t-2 border-t-cyan-400 animate-in fade-in zoom-in-95 duration-150">

                        <div className="text-cyan-400 font-mono text-xs font-bold border-b border-cyan-900 pb-2 mb-2 uppercase tracking-tighter">
                            {metadata.title}
                        </div>

                        <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
                            {metadata.description}
                        </p>

                        {metadata.stats && metadata.stats.length > 0 && (
                            <div className="space-y-1 mb-3">
                                {metadata.stats.map((stat, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] text-cyan-200 font-mono">
                                        <span className="text-cyan-600">»</span> {stat}
                                    </div>
                                ))}
                            </div>
                        )}

                        {metadata.flavor && (
                            <div className="text-[9px] text-slate-500 italic border-t border-cyan-900/50 pt-2 font-mono">
                                {metadata.flavor}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

interface BossEncounter {
    id: string;
    boss_name: string;
    boss_rank: string;
    current_hp: number;
    max_hp: number;
    streak_bonus: number;
    status: string;
    image_url?: string;
    description?: string;
    intel?: any;
    damage_type?: string;
    abilities?: any;
    weaknesses?: any;
    resistances?: any;
    created_at?: string;
    potentialRewards?: {
        xp: number;
        gold: number;
    };
}

export function BossWidget() {
    const [encounter, setEncounter] = useState<BossEncounter | null>(null);
    const [loading, setLoading] = useState(false);
    const [isIntelOpen, setIsIntelOpen] = useState(false);
    const [showDamage, setShowDamage] = useState(false);
    const [damageAmount, setDamageAmount] = useState(0);
    const [mitigatedInfo, setMitigatedInfo] = useState<{ percent: number, type: string } | null>(null);
    const lastHpRef = useRef(0);
    const [delayedHp, setDelayedHp] = useState(0);
    const [abilityFlash, setAbilityFlash] = useState<{ name: string, desc: string } | null>(null);
    const [activeEffects, setActiveEffects] = useState<StatusEffect[]>([]);

    const fetchEncounter = useCallback(async (isInitial = false) => {
        try {
            // Only set loading if we don't have data yet to prevent flashing on updates
            if(isInitial) setLoading(true);

            console.log('[BossWidget] Calling fetchActiveEncounterAction');
            const data = await fetchActiveEncounterAction();
            console.log('[BossWidget] Server Action returned:', data);

            if(data) {
                const enc: BossEncounter = {
                    id: data.id,
                    boss_name: (data.boss as any)?.name || 'Unknown',
                    boss_rank: (data.boss as any)?.rank || 'E',
                    current_hp: data.current_hp,
                    max_hp: data.max_hp,
                    streak_bonus: data.streak_bonus,
                    status: data.status,
                    image_url: (data.boss as any)?.image_url,
                    description: (data.boss as any)?.description,
                    intel: (data.boss as any)?.intel,
                    damage_type: (data.boss as any)?.damage_type,
                    abilities: (data.boss as any)?.abilities,
                    weaknesses: (data.boss as any)?.weaknesses,
                    resistances: (data.boss as any)?.resistances,
                    created_at: (data as any).created_at,
                    potentialRewards: (data as any).potentialRewards
                };

                const currentLastHp = lastHpRef.current;

                if(currentLastHp === 0) {
                    setDelayedHp(enc.current_hp);
                }

                if(currentLastHp > 0 && enc.current_hp < currentLastHp) {
                    const delta = currentLastHp - enc.current_hp;
                    if(delta > 0) {
                        setDamageAmount(delta);
                        setShowDamage(true);
                        setTimeout(() => setShowDamage(false), 1000);
                    }
                }
                lastHpRef.current = enc.current_hp;
                setEncounter(enc);
            } else {
                console.log('[BossWidget] Server Action returned null');
                setEncounter(null);
            }
        } catch(e) {
            console.error("Failed to fetch boss encounter", e);
            setEncounter(null);
        } finally {
            if(isInitial) setLoading(false);
        }
    }, []); // Stable callback with no dependencies

    useEffect(() => {
        // Initial fetch with loading state
        fetchEncounter(true);

        const handleUpdate = () => fetchEncounter(false);
        window.addEventListener('progression_protocol_update', handleUpdate);

        const handleDamage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if(detail && detail.currentHp !== undefined) {
                const delta = detail.damageDealt || 0;

                if(delta > 0) {
                    setDamageAmount(delta);
                    if(detail.mitigatedPercent && detail.mitigatedPercent > 0) {
                        setMitigatedInfo({ percent: detail.mitigatedPercent, type: detail.damageType || 'PHYSICAL' });
                    }
                    setShowDamage(true);
                    setTimeout(() => {
                        setShowDamage(false);
                        setMitigatedInfo(null);
                    }, 1000);

                    setTimeout(() => {
                        setDelayedHp(detail.currentHp);
                    }, 500);
                } else {
                    setDelayedHp(detail.currentHp);
                }

                lastHpRef.current = detail.currentHp;
                setEncounter(prev => prev ? { ...prev, current_hp: detail.currentHp, max_hp: detail.maxHp || prev.max_hp } : null);

                if(detail.abilityName) {
                    setAbilityFlash({ name: detail.abilityName, desc: detail.abilityDescription });
                    setTimeout(() => setAbilityFlash(null), 3000);
                }

                if(detail.statusApplied) {
                    setActiveEffects(prev => [...prev.filter(e => e.name !== detail.statusApplied.name), detail.statusApplied]);
                }
            }
        };
        window.addEventListener('solo_boss_damage', handleDamage);

        const handleEngage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if(detail) {
                setLoading(false); // Ensure loading is cleared immediately on event
                setEncounter(detail);
                setDelayedHp(detail.current_hp);
            }
        };
        window.addEventListener('solo_boss_engaged', handleEngage);

        return () => {
            window.removeEventListener('progression_protocol_update', handleUpdate);
            window.removeEventListener('solo_boss_damage', handleDamage);
            window.removeEventListener('solo_boss_engaged', handleEngage);
        };
    }, [fetchEncounter]);

    if(loading) {
        return (
            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black/40 p-4 h-32 animate-pulse">
                <div className="h-4 w-1/3 bg-slate-800 rounded mb-4" />
                <div className="flex justify-between items-end mb-4">
                    <div className="h-8 w-1/2 bg-slate-800 rounded" />
                    <div className="h-8 w-20 bg-slate-800 rounded" />
                </div>
                <div className="h-4 w-full bg-slate-800 rounded-full" />
            </div>
        );
    }



    if(!encounter) return null;

    const safeMax = Math.max(1, encounter.max_hp);
    const hpPercent = Math.min(100, Math.max(0, (encounter.current_hp / safeMax) * 100));
    const delayedHpPercent = Math.min(100, Math.max(0, (delayedHp / safeMax) * 100));
    const isCritical = hpPercent < 25;

    // Parse intel data
    const weaknessesList = encounter.weaknesses || encounter.intel?.weaknesses || [];
    const resistancesList = encounter.resistances || encounter.intel?.resistances || [];
    const abilitiesList = encounter.abilities || encounter.intel?.abilities || [];

    const getStatusIcon = (type: string) => {
        switch(type) {
            case 'POISON': return <Droplets className="w-3 h-3 text-green-500" />;
            case 'BURN': return <Flame className="w-3 h-3 text-orange-500" />;
            case 'FREEZE': return <Snowflake className="w-3 h-3 text-cyan-300" />;
            case 'FEAR': return <Ghost className="w-3 h-3 text-purple-500" />;
            default: return <Skull className="w-3 h-3 text-slate-400" />;
        }
    };

    return (
        <div className={cn(
            "relative overflow-hidden rounded-lg border bg-black/95 transition-colors",
            isCritical ? "border-red-500/60 shadow-lg shadow-red-950/30" : "border-red-900/50"
        )}>
            <div className="relative z-10 flex gap-4 p-4 sm:p-5 bg-gradient-to-r from-red-950/20 via-transparent to-transparent">
                {encounter.image_url && (
                    <div className="hidden sm:block w-20 h-24 shrink-0 overflow-hidden rounded-md border border-red-900/40 bg-red-950/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={encounter.image_url} alt={encounter.boss_name} width={80} height={96}
                            className="h-full w-full object-cover object-top" />
                    </div>
                )}
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-red-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                <Skull className="h-3 w-3" />
                                Active encounter <span className="text-red-300">{encounter.boss_rank}-Rank</span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-black text-white uppercase italic tracking-tight leading-tight">
                                {encounter.boss_name}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-expanded={isIntelOpen}
                                aria-controls="boss-intel-panel"
                                onClick={() => setIsIntelOpen(open => !open)}
                                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-mono text-slate-300 hover:border-cyan-700 hover:text-cyan-300 transition-colors"
                            >
                                Boss intel
                                {isIntelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if(confirm("THE SYSTEM WILL LOG YOUR DEFEAT. ARE YOU SURE?")) {
                                        await forfeitBossBattleAction();
                                        window.dispatchEvent(new Event('progression_protocol_update'));
                                    }
                                }}
                                className="rounded-md border border-red-900/60 px-3 py-2 text-xs font-mono text-red-400 hover:bg-red-950/60 hover:border-red-500 transition-colors"
                            >
                                Retreat
                            </button>
                        </div>
                    </div>
                    <div>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                            <span className="flex items-center gap-2 text-red-300">
                                <Sword className="h-3 w-3" /> Boss HP
                                {encounter.damage_type && encounter.damage_type !== 'PHYSICAL' && (
                                    <span className="rounded border border-cyan-900/50 bg-cyan-950/30 px-1.5 py-0.5 text-cyan-300">{encounter.damage_type}</span>
                                )}
                            </span>
                            <span className="tabular-nums text-white">
                                {encounter.current_hp.toLocaleString()} <span className="text-slate-400">/ {encounter.max_hp.toLocaleString()}</span>
                                <span className="ml-3 text-red-400">{hpPercent.toFixed(1)}% remaining</span>
                            </span>
                        </div>
                        <div className="relative h-2.5 overflow-hidden rounded-full border border-red-900/40 bg-slate-950">
                            <div className="absolute inset-y-0 left-0 bg-white/25 transition-all duration-1000" style={{ width: `${delayedHpPercent}%` }} />
                            <div className={cn("absolute inset-y-0 left-0 bg-gradient-to-r from-red-800 to-red-500 transition-all duration-300", isCritical && "animate-pulse")}
                                style={{ width: `${hpPercent}%` }} />
                        </div>
                    </div>
                    {encounter.potentialRewards && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                            <span className="text-slate-400">Rewards</span>
                            <span className="text-blue-400">+{encounter.potentialRewards.xp.toLocaleString()} XP</span>
                            <span className="text-yellow-400">+{encounter.potentialRewards.gold.toLocaleString()} G</span>
                            {encounter.streak_bonus > 0 && <span className="text-red-400">+{encounter.streak_bonus}% DMG</span>}
                        </div>
                    )}
                    {activeEffects.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {activeEffects.map((effect, idx) => (
                                <div key={idx} className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs font-mono text-slate-300">
                                    {getStatusIcon(effect.type)} {effect.name} ({effect.duration})
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {isIntelOpen && (
                <div id="boss-intel-panel" className="relative z-10 border-t border-red-900/30 p-4 sm:p-5">
                    {/* Description */}
                    <div className="mb-3 bg-red-950/10 border border-red-900/20 rounded-sm p-2">
                        <p className="text-sm text-slate-300 font-mono leading-relaxed italic">
                            <span className="text-red-900 font-bold mr-1">{'>'}</span>
                            {encounter.description || "Biological signature identified. Extreme caution advised."}
                        </p>
                    </div>

                    {/* Intel Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {/* Weaknesses */}
                        {weaknessesList.length > 0 && (
                            <div className="bg-cyan-950/20 border border-cyan-900/30 rounded p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <Target className="w-3 h-3 text-cyan-400" />
                                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Weakness</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {weaknessesList.slice(0, 3).map((weak: string, i: number) => (
                                        <IntelTooltip key={i} metadata={getWeaknessIntel(weak)} position="right">
                                            <span className="text-xs text-cyan-300 bg-cyan-950/40 px-1 py-0.5 rounded font-mono hover:text-cyan-100 cursor-help transition-colors border border-transparent hover:border-cyan-500/50">
                                                {weak}
                                            </span>
                                        </IntelTooltip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Resistances */}
                        {resistancesList.length > 0 && (
                            <div className="bg-purple-950/20 border border-purple-900/30 rounded p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <Shield className="w-3 h-3 text-purple-400" />
                                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Resist</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {resistancesList.slice(0, 3).map((res: string, i: number) => (
                                        <IntelTooltip key={i} metadata={getResistanceIntel(res)} position="right">
                                            <span className="text-xs text-purple-300 bg-purple-950/40 px-1 py-0.5 rounded font-mono hover:text-purple-100 cursor-help transition-colors border border-transparent hover:border-purple-500/50">
                                                {res}
                                            </span>
                                        </IntelTooltip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Abilities */}
                        {abilitiesList.length > 0 && (
                            <div className="col-span-2 bg-orange-950/20 border border-orange-900/30 rounded p-3">
                                <div className="flex items-center gap-1 mb-1">
                                    <Zap className="w-3 h-3 text-orange-400" />
                                    <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Abilities</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {abilitiesList.slice(0, 4).map((ability: string, i: number) => (
                                        <IntelTooltip key={i} metadata={getAbilityIntel(ability, encounter.boss_rank)} position="right">
                                            <span className="text-xs text-orange-300 bg-orange-950/40 px-1 py-0.5 rounded font-mono hover:text-orange-100 cursor-help transition-colors border border-transparent hover:border-orange-500/50">
                                                {ability}
                                            </span>
                                        </IntelTooltip>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Damage Popup */}
            {showDamage && damageAmount > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black text-red-500 italic animate-out fade-out zoom-out font-sans duration-700 drop-shadow-[0_0_30px_rgba(220,38,38,1)] z-50 pointer-events-none select-none tracking-tighter">
                    -{Math.floor(damageAmount)}
                    {mitigatedInfo && (
                        <div className="text-sm font-bold text-cyan-400 tracking-widest mt-1 uppercase drop-shadow-md">
                            RESISTED ({Math.floor(mitigatedInfo.percent)}%)
                        </div>
                    )}
                </div>
            )}

            {/* Ability Flash Overlay */}
            {abilityFlash && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-40 animate-in fade-in zoom-in duration-300 pointer-events-none">
                    <div className="text-3xl md:text-4xl font-black text-red-500 uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] text-center px-4 animate-pulse">
                        {abilityFlash.name}
                    </div>
                    <div className="text-sm font-mono text-white mt-2 bg-red-950/80 px-3 py-1 rounded border border-red-500/30">
                        {abilityFlash.desc}
                    </div>
                </div>
            )}
        </div>
    );
}
