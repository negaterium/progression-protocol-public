"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchActiveEncounterAction } from "@/app/actions/bosses";
import { cn } from "@/lib/utils";
import { Shield, Zap, Sword } from "lucide-react";
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
    description?: string;
    intel?: any;
    damage_type?: string;
}

export function MiniBossWidget() {
    const [encounter, setEncounter] = useState<BossEncounter | null>(null);
    const [damageAmount, setDamageAmount] = useState(0);
    const [showDamage, setShowDamage] = useState(false);

    const fetchEncounter = useCallback(async () => {
        try {
            const data = await fetchActiveEncounterAction();
            if (data) {
                setEncounter({
                    id: data.id,
                    boss_name: (data.boss as unknown as { name: string })?.name || 'Unknown',
                    boss_rank: (data.boss as unknown as { rank: string })?.rank || 'E',
                    current_hp: data.current_hp,
                    max_hp: data.max_hp,
                    streak_bonus: data.streak_bonus,
                    status: data.status,
                    description: (data.boss as any)?.description,
                    intel: (data.boss as any)?.intel,
                    damage_type: (data.boss as any)?.damage_type,
                });
            } else {
                setEncounter(null);
            }
        } catch (e) {
            console.error("Failed to fetch mini boss widget", e);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            await fetchEncounter();
        };
        init();

        const handleUpdate = () => fetchEncounter();

        const handleDamage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.currentHp !== undefined) {
                if ((detail.damageDealt || 0) > 0) {
                    setDamageAmount(detail.damageDealt);
                    setShowDamage(true);
                    setTimeout(() => setShowDamage(false), 2000);
                }
                setEncounter(prev => prev ? { ...prev, current_hp: detail.currentHp } : null);
            }
        };

        const handleEngage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) setEncounter(detail);
        };

        window.addEventListener('progression_protocol_update', handleUpdate);
        window.addEventListener('solo_boss_damage', handleDamage);
        window.addEventListener('solo_boss_engaged', handleEngage);

        return () => {
            window.removeEventListener('progression_protocol_update', handleUpdate);
            window.removeEventListener('solo_boss_damage', handleDamage);
            window.removeEventListener('solo_boss_engaged', handleEngage);
        };
    }, [fetchEncounter]);

    if (!encounter) return null;

    const hpPercent = (encounter.current_hp / encounter.max_hp) * 100;
    const isCritical = hpPercent < 25;

    // Parse intel data
    let intel = encounter.intel;
    if (typeof intel === 'string') {
        try {
            intel = JSON.parse(intel);
        } catch {
            intel = {};
        }
    }

    const weaknesses = intel?.weaknesses || [];
    const resistances = intel?.resistances || [];
    const abilities = intel?.abilities || [];

    return (
        <div className={cn(
            "mt-auto pt-4 border-t border-cyan-900/30 p-2 animate-in fade-in slide-in-from-left-4 duration-500",
            isCritical ? "border-red-900/50" : ""
        )}>
            <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-red-500 font-black tracking-widest uppercase flex items-center gap-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full", isCritical ? "bg-red-500 animate-ping" : "bg-red-600")} />
                    WARNING
                </span>
                <span className="text-[10px] text-slate-400 font-mono border border-slate-700/50 px-1.5 py-0.5 rounded bg-slate-900/50">
                    RANK {encounter.boss_rank}
                </span>
            </div>

            <div className="text-[11px] font-bold text-white mb-1 truncate leading-tight">
                {encounter.boss_name}
            </div>

            {/* HP Bar */}
            <div className="h-1.5 w-full bg-slate-900 rounded-sm relative overflow-hidden border border-red-900/30 mb-2">
                <div
                    className={cn(
                        "absolute top-0 left-0 h-full transition-all duration-300",
                        isCritical ? "bg-red-500 animate-pulse" : "bg-red-600"
                    )}
                    style={{ width: `${hpPercent}%` }}
                />
            </div>

            <div className="text-[9px] text-slate-400 mb-1 flex items-center justify-between">
                <span>HP: {encounter.current_hp.toLocaleString()} / {encounter.max_hp.toLocaleString()}</span>
                <span className="text-slate-500">{hpPercent.toFixed(1)}%</span>
            </div>

            {/* Intel Section - Compact */}
            {(weaknesses.length > 0 || resistances.length > 0 || abilities.length > 0) && (
                <div className="space-y-1.5 mt-2 border-t border-slate-800/50 pt-2">
                    {/* Weaknesses */}
                    {weaknesses.length > 0 && (
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5 text-yellow-500" />
                                <span className="text-[8px] text-yellow-500 font-bold uppercase">Weak</span>
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                                {weaknesses.slice(0, 3).map((weakness: string, i: number) => (
                                    <IntelTooltip key={i} metadata={getWeaknessIntel(weakness)} position="right">
                                        <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-900/20 text-yellow-400 border border-yellow-700/30 hover:border-yellow-500 cursor-help transition-colors">
                                            {weakness}
                                        </span>
                                    </IntelTooltip>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resistances */}
                    {resistances.length > 0 && (
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5 text-cyan-500" />
                                <span className="text-[8px] text-cyan-500 font-bold uppercase">Resist</span>
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                                {resistances.slice(0, 3).map((resist: string, i: number) => (
                                    <IntelTooltip key={i} metadata={getResistanceIntel(resist)} position="right">
                                        <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-cyan-900/20 text-cyan-400 border border-cyan-700/30 hover:border-cyan-500 cursor-help transition-colors">
                                            {resist}
                                        </span>
                                    </IntelTooltip>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Abilities */}
                    {abilities.length > 0 && (
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                                <Sword className="w-2.5 h-2.5 text-red-500" />
                                <span className="text-[8px] text-red-500 font-bold uppercase">Abilities</span>
                            </div>
                            <div className="space-y-0.5">
                                {abilities.slice(0, 2).map((ability: string, i: number) => (
                                    <IntelTooltip key={i} metadata={getAbilityIntel(ability, encounter.boss_rank)} position="right">
                                        <div className="text-[8px] text-slate-400 truncate hover:text-red-400 cursor-help transition-colors">
                                            • {ability}
                                        </div>
                                    </IntelTooltip>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showDamage && (
                <div className="text-sm font-black text-red-500 text-right mt-1 animate-out fade-out zoom-out duration-1000 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    -{damageAmount}
                </div>
            )}
        </div>
    );
}
