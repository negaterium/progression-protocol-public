"use client";

import { useState, useEffect } from "react";
import { Zap, Skull, Ghost, Dumbbell, CheckCircle2, Shield, Cross, User } from 'lucide-react';
import { cn } from "@/lib/utils";
import Image from "next/image";

import { calculateXpForLevel, calculateGlobalRewardMultiplier } from "@/lib/system/formula";

import { STATUS_EFFECT_DEFINITIONS, StatusEffect } from "@/lib/system/status-effects";

interface StatusCardProps {
    username?: string;
    jobTitle?: string;
    rank?: string;
    level: number;
    currentXp: number;
    nextLevelXp?: number;
    gold?: number;
    title?: string;
    classType?: string; // e.g. "Human" or "Shadow"
    currentHp?: number;
    maxHp?: number;
    currentMana?: number;
    maxMana?: number;
    gender?: 'MALE' | 'FEMALE';
    statusEffects?: StatusEffect[];
    lastPermanentStatAt?: Record<string, { name: string, applied_at: string } | string> | null;
    now?: number;
    shadowStats?: {
        total: number;
        available: number;
        max: number;
        elites: number;
        elitesSummoned?: number;
        elitesMax?: number;
        activeEliteEffects?: { name: string; level: number; effectText: string }[];
    };
}

export function StatusCard({
    username = "HUNTER",
    jobTitle = "NONE",
    rank = "E-RANK",
    level = 1,
    currentXp = 0,
    nextLevelXp = 100,
    gold = 0,
    title = "None",
    classType = "HUMAN",
    currentHp = 100,
    maxHp = 100,
    currentMana = 50,
    maxMana = 50,
    gender = 'MALE',
    statusEffects = [],
    lastPermanentStatAt = null,
    now = 0,
    shadowStats
}: StatusCardProps) {

    // Calculate XP Progress relative to current level
    const startXp = calculateXpForLevel(level);
    const xpNeededForLevel = Math.max(0, nextLevelXp - startXp);
    const xpIntoLevel = Math.max(0, currentXp - startXp);

    // Ensure we don't divide by zero and clamp between 0-100
    const xpPercentage = xpNeededForLevel > 0
        ? Math.min(100, (xpIntoLevel / xpNeededForLevel) * 100)
        : 100;

    // Use displayHpPercent and displayManaPercent instead of these static ones

    // Parse display name (remove domain if present)
    const displayName = username.split('@')[0];

    const [lastXpGain, setLastXpGain] = useState(0);
    const [showXpPopup, setShowXpPopup] = useState(false);

    // Real-time State
    const [localHp, setLocalHp] = useState(currentHp);
    const [localMana, setLocalMana] = useState(currentMana);
    const [localEffects, setLocalEffects] = useState<StatusEffect[]>(statusEffects);

    // Sync server props into the local optimistic combat state after a refresh.
    // The state is also updated by live combat events, so deriving these values
    // directly from props would overwrite an in-flight client-side result.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (currentHp !== undefined) setLocalHp(prev => prev !== currentHp ? currentHp : prev);
        if (currentMana !== undefined) setLocalMana(prev => prev !== currentMana ? currentMana : prev);
        if (statusEffects) setLocalEffects(prev => JSON.stringify(prev) !== JSON.stringify(statusEffects) ? statusEffects : prev);
    }, [currentHp, currentMana, statusEffects]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Recalculate percentages based on local state
    const displayHpPercent = Math.min(100, (localHp / maxHp) * 100);
    const displayManaPercent = Math.min(100, (localMana / maxMana) * 100);

    // Filter out expired status effects
    const activeEffects = localEffects.filter(eff => {
        if (eff.duration && eff.duration > 0) return true; // Combat effect with turns remaining

        const def = STATUS_EFFECT_DEFINITIONS[eff.type];
        const duration = eff.duration_hours || def?.duration_hours;
        if (!duration) return true; // Permanent
        if (!now || now === 0) return true; // Show while syncing
        if (!eff.applied_at) return true; // Fallback if no applied_at but no turns (shouldn't happen for timed)

        const remainingMs = (new Date(eff.applied_at).getTime() + (duration * 3600000)) - now;
        return remainingMs > 0;
    });

    useEffect(() => {
        const handleXpGain = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.amount) {
                setLastXpGain(detail.amount);
                setShowXpPopup(true);
                setTimeout(() => setShowXpPopup(false), 3000);
            }
        };

        const handleBossDamage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                if (detail.currentHp !== undefined) setLocalHp(detail.currentHp);
                // Mana might update via other events, but mostly HP in combat

                // Add new status effect if applied
                if (detail.statusApplied) {
                    setLocalEffects(prev => {
                        // Replace if exists, else add
                        const existingIdx = prev.findIndex(p => p.type === detail.statusApplied.type);
                        if (existingIdx >= 0) {
                            const newArr = [...prev];
                            newArr[existingIdx] = detail.statusApplied;
                            return newArr;
                        }
                        return [...prev, detail.statusApplied];
                    });
                }
            }
        };

        // Also listen for general updates which might carry fresh profile data
        // But we rely on props updating for that via parent re-fetch.
        // This listener is purely for optimistic/instant combat updates not yet saved/refetched.

        window.addEventListener('solo_xp_gain', handleXpGain);
        window.addEventListener('solo_boss_damage', handleBossDamage);

        return () => {
            window.removeEventListener('solo_xp_gain', handleXpGain);
            window.removeEventListener('solo_boss_damage', handleBossDamage);
        };
    }, []);

    const renderJobIcon = () => {
        // Prepare terms to check - prioritize Job if set, otherwise Class
        const terms = [jobTitle, classType].map(s => s.toUpperCase());
        let Icon = User;

        for (const term of terms) {
            if (term === "NONE" || !term) continue;

            if (term.includes("TANK") || term.includes("KNIGHT")) { Icon = Shield; break; }
            if (term.includes("ASSASSIN") || term.includes("ROGUE")) { Icon = Ghost; break; }
            if (term.includes("MAGE")) { Icon = Zap; break; }
            if (term.includes("HEALER") || term.includes("CLERIC") || term.includes("PRIEST")) { Icon = Cross; break; }
            if (term.includes("FIGHTER") || term.includes("WARRIOR")) { Icon = Dumbbell; break; }
            if (term.includes("WARLOCK") || term.includes("NECROMANCER")) { Icon = Skull; break; }
        }

        return <Icon className="w-16 h-16 text-cyan-700 group-hover:text-cyan-500 transition-colors" />;
    };

    return (
        <div className="glass-panel p-3 md:p-4 rounded-lg relative group">
            {/* Header */}
            <div className="flex justify-between items-start mb-3 md:mb-4 border-b border-cyan-900/30 pb-2">
                <div>
                    <span className="text-[10px] text-cyan-700 tracking-[0.2em] uppercase block mb-0.5">Class ID: TYPE-{classType}</span>
                    <span className="text-xl md:text-2xl font-sans font-bold text-white tracking-wider">
                        {displayName.toUpperCase()}
                    </span>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-cyan-700 tracking-[0.2em] uppercase mb-0.5">Hunter Rank</div>
                    <div className="text-lg md:text-xl font-bold text-yellow-500 tracking-widest text-glow-cyan leading-none">{rank}</div>
                </div>
            </div>

            <div className="flex flex-row gap-5 md:gap-8">
                {/* Avatar Section - Enlarge Portrait */}
                <div className="relative w-28 md:w-32 h-28 md:h-32 shrink-0 border border-cyan-500/30 rounded-md overflow-hidden bg-black group-hover:border-cyan-500/50 transition-colors flex justify-center bg-slate-900/50">
                    <div className="relative w-full h-full">
                        <Image
                            src={`/avatars/${(() => {
                                let baseClass = 'generic';
                                const job = jobTitle?.toLowerCase() || '';
                                const cls = classType?.toLowerCase() || '';
                                if (job !== 'none' && job !== '') {
                                    if (job.includes('assassin')) baseClass = 'assassin';
                                    else if (job.includes('druid')) baseClass = 'druid';
                                    else if (job.includes('healer')) baseClass = 'healer';
                                    else if (job.includes('mage')) baseClass = 'mage';
                                    else if (job.includes('monk') || job.includes('fighter') || job.includes('warrior')) baseClass = 'monk';
                                    else if (job.includes('necromancer') || job.includes('shadow')) baseClass = 'necromancer';
                                    else if (job.includes('tank') || job.includes('knight')) baseClass = 'tank';
                                    else if (job.includes('warlock')) baseClass = 'warlock';
                                } else if (cls !== 'human' && cls !== '') {
                                    if (cls.includes('fighter') || cls.includes('warrior')) baseClass = 'monk';
                                }
                                return `${baseClass}-${gender?.toLowerCase() || 'male'}.webp`;
                            })()}`}
                            alt="Hunter Avatar"
                            fill
                            priority
                            sizes="128px"
                            className="object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center -z-10 bg-slate-900">
                        {renderJobIcon()}
                    </div>
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,255,255,0.05)_50%)] bg-[size:100%_4px] pointer-events-none z-10" />
                </div>

                {/* Stats Grid - Adjusted for larger portrait */}
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs md:text-sm pt-2">
                    <div className="flex flex-col border-b border-cyan-900/30 pb-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">LEVEL</span>
                        <span className="text-xl font-bold text-white leading-none">{level}</span>
                    </div>
                    <div className="flex flex-col border-b border-cyan-900/30 pb-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">JOB</span>
                        <span className="text-base text-cyan-400 font-bold tracking-wider leading-tight break-words">{jobTitle}</span>
                    </div>
                    <div 
                        className="flex flex-col border-b border-cyan-900/30 pb-1 cursor-help"
                        title={`${Number(gold || 0).toLocaleString()} Gold`}
                    >
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">GOLD</span>
                        <span className="text-base text-yellow-400 font-bold leading-none">{Number(gold || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col border-b border-cyan-900/30 pb-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-tighter">TITLE</span>
                        <span className="text-base text-purple-400 font-bold leading-tight break-words">{title}</span>
                    </div>
                </div>
            </div>

            {/* Vital Signs (HP/MP) */}
            <div className="mt-5 grid grid-cols-2 gap-4">
                {/* HP Bar */}
                <div className="group/hp">
                    <div className="flex justify-between text-xs text-red-500 mb-1 font-mono tracking-wider">
                        <span>HP // VITALITY</span>
                        <span className="group-hover/hp:text-white transition-colors">{Math.round(localHp)} / {maxHp}</span>
                    </div>
                    <div className="h-2 bg-red-950/20 border border-red-900/30 rounded-full relative overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-900 to-red-600 transition-all duration-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                            style={{ width: `${displayHpPercent}%` }}
                        />
                    </div>
                </div>

                {/* MP Bar */}
                <div className="group/mp">
                    <div className="flex justify-between text-xs text-blue-500 mb-1 font-mono tracking-wider">
                        <span>MP // MANA</span>
                        <span className="group-hover/mp:text-white transition-colors">{Math.round(localMana)} / {maxMana}</span>
                    </div>
                    <div className="h-2 bg-blue-950/20 border border-blue-900/30 rounded-full relative overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-900 to-blue-600 transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                            style={{ width: `${displayManaPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* XP Bar */}
            <div className="mt-5">
                <div className="flex justify-between items-end text-xs text-cyan-600 mb-2 font-mono">
                    <div className="flex items-center gap-2">
                        <span>EXP</span>
                        {lastXpGain > 0 && showXpPopup && (
                            <span className="text-xs text-cyan-400 font-bold animate-bounce">+{lastXpGain} GAIN</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-500">TO NEXT: <span className="text-slate-200">{Math.max(0, nextLevelXp - currentXp).toLocaleString()}</span></span>
                        <span
                            className="text-slate-500 uppercase"
                            title="Estimated quests remaining using a 200 XP baseline scaled by your level"
                        >
                            AVG QUESTS: <span className="text-cyan-400 font-bold">
                                {(() => {
                                const remaining = Math.max(0, nextLevelXp - currentXp);
                                if (remaining === 0) return 0;
                                // This is a rough estimate, not a guaranteed quest count.
                                const baseline = 200; 
                                const multiplier = calculateGlobalRewardMultiplier(level);
                                const avgGain = Math.floor(baseline * multiplier);
                                return Math.max(1, Math.ceil(remaining / avgGain));
                            })()}
                        </span></span>
                        <span
                            className="text-white font-bold"
                            title={`Total XP: ${currentXp.toLocaleString()} / ${nextLevelXp.toLocaleString()}`}
                        >
                            {xpIntoLevel.toLocaleString()} / {xpNeededForLevel.toLocaleString()} LEVEL XP
                        </span>
                    </div>
                </div>
                <div className="h-3 bg-cyan-950/30 border border-cyan-900/50 rounded-sm relative overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_10px_rgba(0,242,255,0.5)] transition-all duration-1000"
                        style={{ width: `${xpPercentage}%` }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_2px,#000_2px)] bg-[size:10px_100%] opacity-20" />
                </div>
            </div>



            {/* Shadow Monarch Stats (Necromancer Only) */}
            {
                jobTitle?.toLowerCase().includes('necromancer') && shadowStats && (
                    <div className="mt-5 pt-4 border-t border-purple-900/30">
                        <div className="flex items-center gap-2 mb-3 text-[10px] text-purple-400 font-mono uppercase tracking-widest">
                            <Ghost className="w-3 h-3" />
                            ARMY OF THE DEAD
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-purple-950/20 border border-purple-900/40 rounded p-2 text-center group/shadow-stat transition-colors hover:bg-purple-900/40">
                                <div className="text-[18px] font-bold text-white font-mono leading-none">{shadowStats.max}</div>
                                <div className="text-[10px] text-purple-400 mt-1 uppercase font-bold tracking-wider">Max</div>
                            </div>
                            <div className="bg-purple-950/20 border border-purple-900/40 rounded p-2 text-center group/shadow-stat transition-colors hover:bg-purple-900/40">
                                <div className="text-[18px] font-bold text-purple-300 font-mono leading-none">{shadowStats.total - shadowStats.available}</div>
                                <div className="text-[10px] text-purple-400 mt-1 uppercase font-bold tracking-wider">Used</div>
                            </div>
                            <div className="bg-purple-950/20 border border-purple-900/40 rounded p-2 text-center group/shadow-stat transition-colors hover:bg-purple-900/40">
                                <div className="text-[18px] font-bold text-cyan-300 font-mono leading-none">{shadowStats.available}</div>
                                <div className="text-[10px] text-purple-400 mt-1 uppercase font-bold tracking-wider">Avail</div>
                            </div>
                            <div className="bg-purple-950/20 border border-purple-900/40 rounded p-2 text-center group/shadow-stat transition-colors hover:bg-purple-900/40">
                                <div className="text-[18px] font-bold text-yellow-500 font-mono leading-none">
                                    {shadowStats.elitesSummoned ?? shadowStats.elites}
                                    <span className="text-[12px] text-purple-400 ml-0.5">/{shadowStats.elitesMax ?? '?'}</span>
                                </div>
                                <div className="text-[10px] text-purple-400 mt-1 uppercase font-bold tracking-wider">Elites</div>
                            </div>
                        </div>
                        {shadowStats.activeEliteEffects && shadowStats.activeEliteEffects.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1.5">
                                {shadowStats.activeEliteEffects.map((eff, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-purple-950/20 border border-purple-900/30 rounded px-2 py-1.5">
                                        <Skull className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider shrink-0">{eff.name}</span>
                                        <div className="flex-1 border-b border-purple-900/40 border-dashed mx-2"></div>
                                        <span className="text-[10px] text-cyan-400 font-mono tracking-wide bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/50">{eff.effectText}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Redesigned Ailment Row - More space, more info */}
            <div className="mt-5 pt-4 border-t border-cyan-900/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2.5">
                    {activeEffects.length > 0 ? activeEffects.map((eff, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2.5 bg-red-950/20 border border-red-500/40 rounded px-2 py-1.5 group/eff relative hover:bg-red-900/30 transition-colors"
                        >
                            <div className={cn(
                                "p-1 rounded-sm border",
                                eff.type === 'MIASMA' ? "bg-purple-950/40 border-purple-800 text-purple-400" : "bg-red-950/40 border-red-800 text-red-500"
                            )}>
                                {eff.type === 'MIASMA' ? <Zap className="w-3 h-3" /> : <Skull className="w-3 h-3" />}
                            </div>

                            <div className="flex flex-col min-w-[110px]">
                                <div className="flex items-center justify-between gap-3 border-b border-red-500/10 pb-0.5 mb-1.5">
                                    <span className="text-[11px] font-bold text-red-400 uppercase leading-none whitespace-nowrap">{eff.name}</span>
                                    <span className="text-[11px] text-yellow-500 font-mono font-bold shrink-0 shadow-sm">
                                        {(() => {
                                            const def = STATUS_EFFECT_DEFINITIONS[eff.type];

                                            // 1. Combat Duration (Turns)
                                            if (eff.duration && eff.duration > 0) {
                                                return `${eff.duration} TURNS`;
                                            }

                                            // 2. Real-time Duration
                                            const duration = eff.duration_hours || def?.duration_hours;

                                            if (!duration) return 'PERM';
                                            if (!now || now === 0) return '--h --m';
                                            if (!eff.applied_at) return 'Unknown';

                                            const remainingMs = (new Date(eff.applied_at).getTime() + (duration * 3600000)) - now;
                                            const h = Math.floor(remainingMs / 3600000);
                                            const m = Math.floor((remainingMs % 3600000) / 60000);
                                            return remainingMs > 0 ? `${h}h ${m}m` : 'EXPIRED';
                                        })()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 font-mono mr-1">EFFECT:</span>
                                    {eff.damagePercent !== undefined && eff.damagePercent > 0 && (
                                        <span className="text-[10px] bg-red-950/60 text-red-500 px-1 rounded border border-red-900/30 font-mono font-bold whitespace-nowrap">
                                            DMG -{Math.round(eff.damagePercent * 100)}%/quest
                                        </span>
                                    )}
                                    {eff.modifiers?.xp_gain_multiplier !== undefined && (
                                        <span className={cn(
                                            "text-[10px] px-1 rounded border font-mono font-bold whitespace-nowrap",
                                            eff.modifiers.xp_gain_multiplier >= 1 
                                                ? "bg-emerald-950/60 text-emerald-500 border-emerald-900/30" 
                                                : "bg-red-950/60 text-red-500 border-red-900/30"
                                        )}>
                                            XP {eff.modifiers.xp_gain_multiplier >= 1 ? '+' : ''}{Math.round((eff.modifiers.xp_gain_multiplier - 1) * 100)}%
                                        </span>
                                    )}
                                    {eff.modifiers?.stat_multiplier !== undefined && (
                                        <span className={cn(
                                            "text-[10px] px-1 rounded border font-mono font-bold whitespace-nowrap",
                                            eff.modifiers.stat_multiplier >= 1 
                                                ? "bg-emerald-950/60 text-emerald-500 border-emerald-900/30" 
                                                : "bg-red-950/60 text-red-500 border-red-900/30"
                                        )}>
                                            STATS {eff.modifiers.stat_multiplier >= 1 ? '+' : ''}{Math.round((eff.modifiers.stat_multiplier - 1) * 100)}%
                                        </span>
                                    )}
                                    {/* Bonus tag for non-numerical effects like Stealth */}
                                    {eff.modifiers && Object.keys(eff.modifiers).length > 0 && 
                                     eff.modifiers.xp_gain_multiplier === undefined && 
                                     eff.modifiers.stat_multiplier === undefined && (
                                        <span className="text-[10px] bg-cyan-950/60 text-cyan-500 px-1 rounded border border-cyan-900/30 font-mono font-bold whitespace-nowrap">
                                            ACTIVE
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Tooltip on Hover - Fixed Z-depth and removed card overflow */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-2 bg-black/95 backdrop-blur-md border border-red-500/40 rounded shadow-[0_0_30px_rgba(0,0,0,0.8)] opacity-0 group-hover/eff:opacity-100 transition-all translate-y-1 group-hover/eff:translate-y-0 pointer-events-none z-[100]">
                                <div className="flex items-center gap-2 mb-1.5 border-b border-red-900/30 pb-1.5">
                                    <div className="w-1 h-3 bg-red-600" />
                                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{eff.name}</span>
                                </div>
                                <p className="text-[10px] text-slate-300 font-sans leading-relaxed">{eff.description}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em]">
                            <CheckCircle2 className="w-3 h-3 text-green-900" />
                            System Condition // Stable
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        (() => {
                            if (!lastPermanentStatAt || Object.keys(lastPermanentStatAt).length === 0 || !now) return "bg-green-500 shadow-[0_0_8px_#22c55e]";
                            const isAdapting = Object.values(lastPermanentStatAt).some(entry => {
                                const timestamp = typeof entry === 'string' ? entry : entry.applied_at;
                                const diff = (now - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24);
                                return diff < 30;
                            });
                            return isAdapting ? "bg-yellow-500 animate-pulse shadow-[0_0_8px_#eab308]" : "bg-green-500 shadow-[0_0_8px_#22c55e]";
                        })()
                    )} />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        {(() => {
                            if (!lastPermanentStatAt || Object.keys(lastPermanentStatAt).length === 0) return "VESSEL STABLE";
                            const adaptations = Object.keys(lastPermanentStatAt).length;
                            return `Physique Integration: ${adaptations} ADAPT.`;
                        })()}
                    </span>
                </div>
            </div>
        </div >
    );
}
