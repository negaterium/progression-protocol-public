"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { DashboardData } from "@/lib/dashboard-data";
import { StatsManager } from "@/lib/stats-manager";
import { Coins, LogOut, Skull, Zap, Heart, Droplet, Loader2, Activity, User, Target, Sword, Shield, ShoppingBag, Flame, Snowflake, Eye, Sparkles, Brain, Ban, AlertTriangle, Wind, Ghost, TrendingUp, HelpCircle } from "lucide-react";
import { logout } from "@/app/login/actions";
import { StatusEffect } from "@/lib/system/status-effects";
import { calculateLevel } from "@/lib/system/leveling";
import { quickUsePotionAction } from "@/app/actions/inventory";
import { useSystemNotification } from "@/components/system/NotificationProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";

function getStatusEffectUI(type: string, name: string = "") {
    const lowerName = name.toLowerCase();
    const upperType = type.toUpperCase();

    // 1. Specific name-based matches for distinct skill/combat buffs
    if (lowerName.includes('sprint')) {
        return {
            Icon: Wind,
            colorClass: "border-sky-500/50 bg-sky-950/30 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.2)]",
            textColor: "text-sky-400"
        };
    }
    if (lowerName.includes('mutilate')) {
        return {
            Icon: Sword,
            colorClass: "border-red-500/50 bg-red-950/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]",
            textColor: "text-red-400"
        };
    }
    if (lowerName.includes('confusion')) {
        return {
            Icon: HelpCircle,
            colorClass: "border-purple-500/50 bg-purple-950/30 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]",
            textColor: "text-purple-400"
        };
    }
    if (lowerName.includes('weakened') || lowerName.includes('lethargy')) {
        return {
            Icon: Activity,
            colorClass: "border-slate-500/50 bg-slate-950/30 text-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.2)]",
            textColor: "text-slate-400"
        };
    }

    switch (upperType) {
        case 'STEALTH':
            return {
                Icon: Ghost,
                colorClass: "border-cyan-500/50 bg-cyan-950/30 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]",
                textColor: "text-cyan-400"
            };
        case 'BUFF':
            return {
                Icon: TrendingUp,
                colorClass: "border-green-500/50 bg-green-950/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.2)]",
                textColor: "text-green-400"
            };
        case 'MIASMA':
            return {
                Icon: Zap,
                colorClass: "border-purple-500/50 bg-purple-950/30 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]",
                textColor: "text-purple-400"
            };
        case 'EXHAUSTION':
            return {
                Icon: Activity,
                colorClass: "border-orange-500/50 bg-orange-950/30 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]",
                textColor: "text-orange-400"
            };
        case 'CURSE':
            return {
                Icon: Skull,
                colorClass: "border-red-600/50 bg-red-950/30 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]",
                textColor: "text-red-500"
            };
        case 'POISON':
            return {
                Icon: Skull,
                colorClass: "border-green-600/50 bg-green-950/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.2)]",
                textColor: "text-green-400"
            };
        case 'LETHARGY':
            return {
                Icon: Brain,
                colorClass: "border-slate-600/50 bg-slate-950/30 text-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.2)]",
                textColor: "text-slate-400"
            };
        case 'FOCUS':
            return {
                Icon: Sparkles,
                colorClass: "border-cyan-500/50 bg-cyan-950/30 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]",
                textColor: "text-cyan-400"
            };
        case 'BURN':
            return {
                Icon: Flame,
                colorClass: "border-amber-600/50 bg-amber-950/30 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]",
                textColor: "text-amber-500"
            };
        case 'BLEED':
            return {
                Icon: Droplet,
                colorClass: "border-red-500/50 bg-red-950/30 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]",
                textColor: "text-red-400"
            };
        case 'STUN':
            return {
                Icon: AlertTriangle,
                colorClass: "border-yellow-500/50 bg-yellow-950/30 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]",
                textColor: "text-yellow-400"
            };
        case 'FREEZE':
            return {
                Icon: Snowflake,
                colorClass: "border-sky-500/50 bg-sky-950/30 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.2)]",
                textColor: "text-sky-400"
            };
        case 'FEAR':
            return {
                Icon: Eye,
                colorClass: "border-indigo-500/50 bg-indigo-950/30 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]",
                textColor: "text-indigo-400"
            };
        case 'SHIELD':
            return {
                Icon: Shield,
                colorClass: "border-emerald-500/50 bg-emerald-950/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]",
                textColor: "text-emerald-400"
            };
        case 'REGEN':
            return {
                Icon: Activity,
                colorClass: "border-green-500/50 bg-green-950/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.2)]",
                textColor: "text-green-400"
            };
        case 'SYSTEM_INTERFERENCE':
            return {
                Icon: Ban,
                colorClass: "border-rose-600/50 bg-rose-950/30 text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.2)]",
                textColor: "text-rose-500"
            };
        case 'REALITY_FRACTURE':
            return {
                Icon: AlertTriangle,
                colorClass: "border-fuchsia-600/50 bg-fuchsia-950/30 text-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.2)]",
                textColor: "text-fuchsia-500"
            };
        case 'COSMIC_DREAD':
            return {
                Icon: Skull,
                colorClass: "border-purple-600/50 bg-purple-950/30 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]",
                textColor: "text-purple-400"
            };
        case 'ENTROPY':
            return {
                Icon: Skull,
                colorClass: "border-neutral-500/50 bg-neutral-950/30 text-neutral-400 shadow-[0_0_8px_rgba(115,115,115,0.2)]",
                textColor: "text-neutral-400"
            };
        default:
            return {
                Icon: AlertTriangle,
                colorClass: "border-amber-600/50 bg-amber-950/30 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]",
                textColor: "text-amber-500"
            };
    }
}

interface VitalStripProps {
    data: DashboardData;
}

// Circular gauge component using SVG
function CircularGauge({
    value,
    max,
    color,
    label,
    size = 36,
}: {
    value: number;
    max: number;
    color: "red" | "blue";
    label: string;
    size?: number;
}) {
    const radius = (size - 6) / 2;
    const circumference = 2 * Math.PI * radius;
    const percent = Math.min(1, Math.max(0, value / max));
    const offset = circumference * (1 - percent);

    const colors = {
        red: {
            stroke: "#ef4444",
            glow: "rgba(239,68,68,0.4)",
            bg: "rgba(127,29,29,0.3)",
            text: "text-red-400",
        },
        blue: {
            stroke: "#3b82f6",
            glow: "rgba(59,130,246,0.4)",
            bg: "rgba(30,58,138,0.3)",
            text: "text-blue-400",
        },
    };

    const c = colors[color];

    return (
        <div className="flex flex-col items-center gap-0.5 group relative" title={`${label}: ${Math.round(value)} / ${max}`}>
            <svg width={size} height={size} className="transform -rotate-90" suppressHydrationWarning>
                {/* Background ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={c.bg}
                    strokeWidth={3}
                    suppressHydrationWarning
                />
                {/* Value ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={c.stroke}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                    style={{ filter: `drop-shadow(0 0 4px ${c.glow})` }}
                    suppressHydrationWarning
                />
            </svg>
            <span className={cn("text-[9px] font-mono font-bold tracking-wider", c.text)}>
                {label}
            </span>
            {/* Hover tooltip with exact values */}
            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-black/95 border border-cyan-500/30 rounded-lg p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 shadow-[0_0_20px_rgba(0,163,255,0.2)] z-50 lg:block hidden min-w-[120px]">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">{label} STATUS</div>
                <div className={cn("text-sm font-bold tracking-wider", c.text)}>
                    {Math.round(value)} <span className="text-slate-600">/</span> {max}
                </div>
            </div>
        </div>
    );
}

export function VitalStrip({ data }: VitalStripProps) {
    const profile = data.profile;

    // Calculate XP progress correctly using leveling system
    // Use safe defaults when profile is null (will early-return below anyway)
    const totalXp = profile?.current_xp || 0;
    const xpData = calculateLevel(totalXp);
    const xpInCurrentLevel = xpData.remainder;
    const xpNeededForNext = xpData.nextLevelXp;

    // ALL hooks must be called unconditionally before any early returns
    const [currentXp, setCurrentXp] = useState(xpInCurrentLevel);
    const [nextLevelXp, setNextLevelXp] = useState(xpNeededForNext);

    const { showNotification } = useSystemNotification();
    const [isConsumingHp, setIsConsumingHp] = useState(false);
    const [isConsumingMp, setIsConsumingMp] = useState(false);
    const [xpGainedFlash, setXpGainedFlash] = useState(false);
    const [bossState, setBossState] = useState(data.activeBoss);
    const [displayHp, setDisplayHp] = useState(profile?.current_hp ?? 0);
    const [displayMana, setDisplayMana] = useState(profile?.current_mana ?? 0);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (data.activeBoss !== bossState) {
                setBossState(data.activeBoss);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [data.activeBoss, bossState]);

    useEffect(() => {
        if (!profile) return;
        const timer = setTimeout(() => {
            const totalXp = profile.current_xp || 0;
            const xpData = calculateLevel(totalXp);
            setCurrentXp(xpData.remainder);
            setNextLevelXp(xpData.nextLevelXp);
            
            // Sync with profile only if we haven't locally optimistically updated it
            setDisplayHp((prev: number) => {
                // If profile is strictly newer, we'd take it. For now, we prefer local changes unless server pushes a different value, but simple syncing is fine.
                // Assuming server refresh matches reality, we update from profile on refresh.
                // However, directly mirroring simple state on prop change:
                return profile.current_hp ?? 0;
            });
            setDisplayMana((prev: number) => profile.current_mana ?? 0);

        }, 0);
        return () => clearTimeout(timer);
    }, [profile?.current_xp, profile?.current_hp, profile?.current_mana]);

    useEffect(() => {
        const handleDamage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.currentHp !== undefined) {
                setBossState((prev: any) => prev ? { ...prev, currentHp: detail.currentHp, maxHp: detail.maxHp || prev.maxHp } : null);
            }
        };
        const handleEngage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                setBossState({
                    id: detail.id,
                    name: detail.boss_name,
                    currentHp: detail.current_hp,
                    maxHp: detail.max_hp,
                    image: detail.image_url,
                    rank: detail.boss_rank,
                    description: detail.description,
                    intel: detail.intel,
                    damageType: detail.damage_type
                });
            }
        };
        const handleXpGain = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.amount) {
                setCurrentXp((prev: number) => prev + detail.amount);
                setXpGainedFlash(true);
                setTimeout(() => setXpGainedFlash(false), 2000);
            }
        };

        const handlePlayerDamage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.damage !== undefined) {
                setDisplayHp((prev: number) => Math.max(0, prev - detail.damage));
            }
        };

        const handlePlayerManaUse = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.cost !== undefined) {
                setDisplayMana((prev: number) => Math.max(0, prev - detail.cost));
            }
        };

        const handleVitalsUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                if (detail.hp !== undefined) setDisplayHp(detail.hp);
                if (detail.mana !== undefined) setDisplayMana(detail.mana);
            }
        };

        window.addEventListener('solo_boss_damage', handleDamage);
        window.addEventListener('solo_boss_engaged', handleEngage);
        window.addEventListener('solo_xp_gain', handleXpGain);
        window.addEventListener('solo_player_damage', handlePlayerDamage);
        window.addEventListener('solo_player_mana_use', handlePlayerManaUse);
        window.addEventListener('solo_vitals_update', handleVitalsUpdate);
        
        return () => {
            window.removeEventListener('solo_boss_damage', handleDamage);
            window.removeEventListener('solo_boss_engaged', handleEngage);
            window.removeEventListener('solo_xp_gain', handleXpGain);
            window.removeEventListener('solo_player_damage', handlePlayerDamage);
            window.removeEventListener('solo_player_mana_use', handlePlayerManaUse);
            window.removeEventListener('solo_vitals_update', handleVitalsUpdate);
        };
    }, [profile]);

    // Guard against null profile AFTER all hooks (Rules of Hooks requires unconditional hook calls)
    if (!profile) return null;
    const stats = data.stats || { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10 };
    const baseStats = {
        strength: stats.strength || 10,
        agility: stats.agility || 10,
        intelligence: stats.intelligence || 10,
        vitality: stats.vitality || 10,
        perception: stats.perception || 10,
    };
    const hClass = profile.hunter_class || 'NONE';
    const modifiers = data.modifiers || {};

    // Status effects — must be declared before effectiveStats calculation
    const statusEffects: StatusEffect[] = Array.isArray(profile.status_effects) ? profile.status_effects : [];
    const activeEffects = statusEffects;

    const crystallizedStats = (stats as any).crystallized_stats || {};
    const prestigeLevel = profile.prestige_level || 0;
    const effectiveStats = StatsManager.calculateEffectiveStats(baseStats, modifiers, activeEffects, hClass, crystallizedStats);

    const maxHp = data.derivedStats?.maxHp || StatsManager.calculateMaxHP(effectiveStats.vitality, effectiveStats.strength, profile.level ?? 1, modifiers, hClass, prestigeLevel);
    const maxMana = data.derivedStats?.maxMana || StatsManager.calculateMaxMana(effectiveStats.intelligence, profile.level ?? 1, modifiers, hClass, prestigeLevel);

    // Clamp display values if needed just for the UI
    const currentHp = Math.min(displayHp, maxHp);
    const currentMana = Math.min(displayMana, maxMana);

    const rankColor = (rank: string) => {
        if (rank === '[Ω]') return 'border-purple-500 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.5)]';
        if (rank === 'S') return 'border-orange-500 text-orange-400';
        if (rank === 'A') return 'border-orange-400 text-orange-300';
        return 'border-cyan-500/50 text-cyan-300';
    };

    const formatGold = (v: number) => {
        if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (v >= 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return v.toLocaleString();
    };
    // Ensure we don't divide by zero
    // Removed unused progress variables to resolve lint warnings.
    // hpProgress and manaProgress were previously here.

    const handleQuickUsePotion = async (type: 'HP' | 'MP') => {
        if (type === 'HP') setIsConsumingHp(true);
        else setIsConsumingMp(true);

        try {
            const res = await quickUsePotionAction(type);
            if (res.error) {
                showNotification({
                    type: 'ERROR',
                    title: 'System Access Denied',
                    message: res.error
                });
            } else {
                showNotification({
                    type: 'SUCCESS',
                    title: 'Item Consumed',
                    message: res.data?.message || `Used ${type} Potion`
                });
                // Local optimistic update for responsiveness could go here, but rely on router refresh for exact stats.
            }
        } catch (e: any) {
            showNotification({
                type: 'ERROR',
                title: 'System Warning',
                message: e.message || "Failed to use item"
            });
        } finally {
            if (type === 'HP') setIsConsumingHp(false);
            else setIsConsumingMp(false);
        }
    };

    const handleLogout = async () => {
        try { await logout(); } catch (e) { console.error("Logout failed:", e); }
    };



    return (
        <>
            {/* ===== DESKTOP: Vertical strip (left side) ===== */}
            {/* ===== DESKTOP: Vertical strip (left side) ===== */}
            <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 z-40 flex-col items-stretch px-5 py-6 gap-3 bg-black/95 border-r border-cyan-900/30 backdrop-blur-md shadow-[4px_0_24px_rgba(0,163,255,0.05)] font-mono">
                
                {/* Header (Player Name & Class) */}
                <div className="flex flex-col gap-1 border-b border-cyan-900/40 pb-4 shrink-0">
                    <span className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">System Profile</span>
                    <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-wider truncate">
                        {profile.username || 'HUNTER'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "px-2 py-0.5 text-[10px] rounded border font-bold uppercase",
                            rankColor(profile.hunter_rank || 'E')
                        )}>{(profile.hunter_rank || 'E').replace('-RANK', '')}-RANK</span>
                        <span className="text-[10px] text-cyan-500 font-bold uppercase">{hClass}</span>
                    </div>
                </div>

                {/* Level & XP */}
                <div className="flex flex-col gap-2 mt-2 shrink-0">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-black text-cyan-300">LEVEL {profile.level ?? 1}</span>
                        <span className="text-[10px] text-cyan-500 font-bold">{Math.floor((currentXp / nextLevelXp) * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-cyan-950/30 rounded-full border border-cyan-900/30 overflow-hidden relative" title="XP Progress">
                        <div
                            className={cn(
                                "h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-1000",
                                xpGainedFlash && "bg-cyan-300 animate-pulse"
                            )}
                            style={{ width: `${Math.min(100, (currentXp / nextLevelXp) * 100)}%` }}
                        />
                    </div>
                    <div className="text-[9px] text-slate-500 text-right">{currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</div>
                </div>

                {/* Vitals (HP) */}
                <div className="flex flex-col gap-1.5 mt-2 shrink-0">
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-red-500 tracking-wider">HP</span>
                        <span className="text-xs font-bold text-red-400">{Math.round(currentHp)} <span className="text-red-900 text-[10px]">/ {maxHp}</span></span>
                    </div>
                    <div className="h-3 w-full bg-red-950/30 rounded-full border border-red-900/50 overflow-hidden relative" title="Health Points">
                         <div
                            className="h-full bg-gradient-to-r from-red-800 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)] transition-all duration-500"
                            style={{ width: `${Math.min(100, (currentHp / maxHp) * 100)}%` }}
                        />
                    </div>
                </div>

                {/* Vitals (MP) */}
                <div className="flex flex-col gap-1.5 mt-1 shrink-0">
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-blue-500 tracking-wider">MP</span>
                        <span className="text-xs font-bold text-blue-400">{Math.round(currentMana)} <span className="text-blue-900 text-[10px]">/ {maxMana}</span></span>
                    </div>
                    <div className="h-3 w-full bg-blue-950/30 rounded-full border border-blue-900/50 overflow-hidden relative" title="Mana Points">
                         <div
                            className="h-full bg-gradient-to-r from-blue-800 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)] transition-all duration-500"
                            style={{ width: `${Math.min(100, (currentMana / maxMana) * 100)}%` }}
                        />
                    </div>
                </div>

                {/* Finances Layer */}
                <div className="flex flex-col gap-2 mt-4 border-t border-cyan-900/30 pt-4 shrink-0">
                    <span className="text-[10px] text-slate-500 tracking-widest uppercase">Finances</span>
                    <div 
                        className="flex justify-between items-center bg-yellow-950/20 border border-yellow-900/30 rounded-lg p-3 cursor-help"
                        title={`${Number(profile.gold_credits || 0).toLocaleString()} Gold`}
                    >
                        <Coins className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]" />
                        <div className="text-lg font-bold text-yellow-400 tracking-wider">
                            {Number(profile.gold_credits || 0).toLocaleString()} <span className="text-xs text-yellow-600 font-bold">CC</span>
                        </div>
                    </div>
                </div>

                {/* Boss Status Component */}
                {bossState && bossState.currentHp > 0 && (
                    <div className="flex flex-col gap-2 mt-4 p-3 border border-red-900/50 bg-red-950/20 rounded-lg relative overflow-hidden group shrink-0">
                        <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none" />
                        <div className="flex justify-between items-center z-10 relative">
                            <span className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                                <Skull className="w-3 h-3 animate-bounce" /> Engagement
                            </span>
                            <span className={cn("text-[9px] px-1 rounded border font-bold bg-black/50", rankColor((bossState as any).rank || (bossState as any).boss_rank || 'E'))}>
                                {(bossState as any).rank || (bossState as any).boss_rank || 'E'}
                            </span>
                        </div>
                        <div className="text-sm font-black text-red-400 truncate z-10 relative drop-shadow-[0_0_5px_rgba(220,38,38,0.5)] uppercase tracking-wide">
                            {(bossState as any).name || (bossState as any).boss_name || 'UNKNOWN ENTITY'}
                        </div>
                        <div className="flex justify-between items-center mt-1 z-10 relative">
                            <div className="h-1.5 w-full bg-red-950/50 rounded-full overflow-hidden border border-red-900/30">
                                <div
                                    className="h-full bg-gradient-to-r from-red-700 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-all duration-300"
                                    style={{ width: `${Math.min(100, (bossState.currentHp / bossState.maxHp) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Effects List */}
                {activeEffects.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2 shrink-0">
                        <span className="text-[10px] text-slate-500 tracking-widest uppercase shrink-0">Status Feed</span>
                        <div className="flex flex-wrap gap-2 pr-1 pb-1">
                             {activeEffects.map((eff, i) => {
                                 const ui = getStatusEffectUI(eff.type, eff.name);
                                 const Icon = ui.Icon;
                                 return (
                                     <div 
                                         key={i} 
                                         className={cn(
                                             "w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 group/status relative hover:z-50",
                                             ui.colorClass
                                         )}
                                     >
                                         <Icon className="w-4 h-4 shrink-0" />
                                         
                                         {/* Tooltip Content */}
                                         <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#090d16] border border-cyan-900/80 rounded-lg p-3 pointer-events-none opacity-0 group-hover/status:opacity-100 transition-all translate-x-1 group-hover/status:translate-x-0 shadow-[0_10px_30px_rgba(0,0,0,0.9)] z-50 min-w-[220px] text-left">
                                             <div className={cn("text-xs font-bold uppercase tracking-wider mb-1", ui.textColor)}>
                                                 {eff.name}
                                             </div>
                                             <div className="text-[10px] text-slate-400 font-sans normal-case leading-normal mb-1.5">
                                                 {eff.description}
                                             </div>
                                             {eff.duration !== undefined && eff.duration > 0 && (
                                                 <div className="text-[9px] text-cyan-500 font-mono">
                                                     DURATION: {eff.duration} {eff.durationType === 'QUEST' ? 'QUESTS' : 'TURNS'}
                                                 </div>
                                             )}
                                             {eff.duration_hours !== undefined && eff.duration_hours > 0 && (
                                                 <div className="text-[9px] text-cyan-500 font-mono">
                                                     DURATION: {eff.duration_hours} HOURS
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 );
                             })}
                        </div>
                    </div>
                )}
                
                <div className="flex-1" />

                {/* Quick Actions Panel */}
                <div className="flex flex-col gap-2 w-full mt-2 pt-4 border-t border-cyan-900/30 shrink-0">
                     <span className="text-[10px] text-slate-500 tracking-widest uppercase mb-1">Quick Supply</span>
                     <button
                        onClick={() => handleQuickUsePotion('HP')}
                        disabled={isConsumingHp || currentHp >= maxHp}
                        className={cn(
                            "w-full py-3 px-4 rounded-lg flex items-center justify-between transition-all font-bold text-[11px] uppercase tracking-wider relative overflow-hidden group",
                            currentHp >= maxHp
                                ? "bg-red-950/10 border border-red-950 text-red-700 cursor-not-allowed opacity-80"
                                : "bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/60 hover:text-red-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <div className={cn("absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity", currentHp >= maxHp && "hidden")} />
                        <div className="flex items-center gap-2 relative z-10">
                             <Heart className={cn("w-4 h-4", currentHp >= maxHp ? "opacity-50" : "animate-pulse")} /> Restore HP
                        </div>
                        {isConsumingHp && <Loader2 className="w-4 h-4 animate-spin relative z-10" />}
                    </button>
                    
                    <button
                        onClick={() => handleQuickUsePotion('MP')}
                        disabled={isConsumingMp || currentMana >= maxMana}
                        className={cn(
                            "w-full py-3 px-4 rounded-lg flex items-center justify-between transition-all font-bold text-[11px] uppercase tracking-wider relative overflow-hidden group",
                            currentMana >= maxMana
                                ? "bg-blue-950/10 border border-blue-950 text-blue-700 cursor-not-allowed opacity-80"
                                : "bg-blue-950/40 border border-blue-900/50 text-blue-400 hover:bg-blue-900/60 hover:text-blue-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <div className={cn("absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity", currentMana >= maxMana && "hidden")} />
                        <div className="flex items-center gap-2 relative z-10">
                             <Droplet className={cn("w-4 h-4", currentMana >= maxMana ? "opacity-50" : "animate-pulse")} /> Restore MP
                        </div>
                        {isConsumingMp && <Loader2 className="w-4 h-4 animate-spin relative z-10" />}
                    </button>
                </div>

                {/* Footer Option */}
                <button
                    onClick={handleLogout}
                    className="flex shrink-0 items-center justify-center gap-2 mt-4 pt-4 border-t border-cyan-900/30 text-[10px] font-mono text-slate-600 hover:text-red-500 transition-colors uppercase font-bold"
                >
                    <LogOut className="w-3.5 h-3.5" /> Terminate Session
                </button>
            </div>

            {/* ===== MOBILE: Horizontal strip (below header) ===== */}
            <div className="lg:hidden fixed top-16 left-0 right-0 z-30 flex items-center justify-between px-3 py-1.5 bg-black/90 border-b border-cyan-900/30 backdrop-blur-md h-10">
                {/* Level & XP Bar */}
                <div className="flex items-center gap-2 group relative">
                    <div className={cn(
                        "w-6 h-6 rounded-full border flex items-center justify-center font-mono font-bold text-[10px] shrink-0 relative z-10",
                        rankColor(profile.hunter_rank || 'E'),
                        xpGainedFlash && "scale-110 shadow-[0_0_10px_cyan]"
                    )}>
                        {profile.level ?? 1}
                    </div>
                    {/* Mobile Mini XP Bar */}
                    <div className="w-8 h-1 bg-cyan-950/30 rounded-full overflow-hidden border border-cyan-900/30">
                        <div
                            className="h-full bg-cyan-500 transition-all duration-1000"
                            style={{ width: `${(currentXp / nextLevelXp) * 100}%` }}
                        />
                    </div>

                    {/* Simple Tooltip on touch/click might be hard, but let's add one for symmetry */}
                    <div className="absolute left-0 top-full mt-2 bg-black/95 border border-cyan-500/50 rounded p-2 min-w-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[100] shadow-xl">
                        <div className="text-[9px] font-mono text-cyan-400 font-bold mb-1">XP PROGRESS</div>
                        <div className="flex justify-between text-[8px] font-mono text-slate-300">
                            <span>{Math.floor((currentXp / nextLevelXp) * 100)}%</span>
                            <span>{currentXp.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* HP Bar (compact) */}
                <div className="flex items-center gap-1 flex-1 mx-2 group relative">
                    <span className="text-[9px] font-bold text-red-400 w-3">HP</span>
                    <div className="h-1.5 flex-1 bg-red-950/30 rounded-full overflow-hidden border border-red-900/30">
                        <div
                            className="h-full bg-red-500 transition-all duration-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]"
                            style={{ width: `${Math.min(100, (currentHp / maxHp) * 100)}%` }}
                        />
                    </div>
                    {/* Mobile Tooltip */}
                    <div className="absolute left-0 top-full mt-2 bg-black/95 border border-red-500/50 rounded p-1.5 min-w-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[100] shadow-xl">
                        <div className="text-[8px] font-mono text-red-400 font-bold">{Math.round(currentHp)} / {maxHp}</div>
                    </div>
                </div>

                {/* MP Bar (compact) */}
                <div className="flex items-center gap-1 flex-1 mx-2 group relative">
                    <span className="text-[9px] font-bold text-blue-400 w-3">MP</span>
                    <div className="h-1.5 flex-1 bg-blue-950/30 rounded-full overflow-hidden border border-blue-900/30">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]"
                            style={{ width: `${Math.min(100, (currentMana / maxMana) * 100)}%` }}
                        />
                    </div>
                    {/* Mobile Tooltip */}
                    <div className="absolute left-0 top-full mt-2 bg-black/95 border border-blue-500/50 rounded p-1.5 min-w-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[100] shadow-xl">
                        <div className="text-[8px] font-mono text-blue-400 font-bold">{Math.round(currentMana)} / {maxMana}</div>
                    </div>
                </div>

                {/* Gold */}
                <div className="flex items-center gap-1 shrink-0 group relative" title={`${Number(profile.gold_credits || 0).toLocaleString()} Gold`}>
                    <Coins className="w-3 h-3 text-yellow-500" />
                    <span className="text-[9px] font-mono text-yellow-300 font-bold">
                        {formatGold(Number(profile.gold_credits || 0))}
                    </span>
                    {/* Mobile Tooltip */}
                    <div className="absolute right-0 top-full mt-2 bg-black/95 border border-yellow-500/50 rounded p-1.5 min-w-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[100] shadow-xl text-right">
                        <div className="text-[8px] font-mono text-yellow-400 font-bold">{Number(profile.gold_credits || 0).toLocaleString()} GOLD</div>
                    </div>
                </div>

                {/* Status indicators */}
                {activeEffects.length > 0 && (
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                        {activeEffects.slice(0, 3).map((eff, i) => {
                            const ui = getStatusEffectUI(eff.type, eff.name);
                            const Icon = ui.Icon;
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-5 h-5 rounded border flex items-center justify-center",
                                        ui.colorClass
                                    )}
                                    title={`${eff.name}: ${eff.description}`}
                                >
                                    <Icon className="w-3 h-3" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Mobile Quick Actions */}
                <div className="flex gap-1.5 shrink-0 ml-2 border-l border-cyan-900/30 pl-2">
                    <button
                        onClick={() => handleQuickUsePotion('HP')}
                        disabled={isConsumingHp || currentHp >= maxHp}
                        className={cn(
                            "w-6 h-6 rounded flex items-center justify-center transition-all",
                            currentHp >= maxHp
                                ? "bg-slate-900/80 border border-slate-800 text-slate-700 opacity-50 cursor-not-allowed"
                                : "bg-red-950/40 border border-red-900/50 text-red-500 hover:bg-red-900/60 active:scale-95"
                        )}
                    >
                        {isConsumingHp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3" fill="currentColor" />}
                    </button>
                    <button
                        onClick={() => handleQuickUsePotion('MP')}
                        disabled={isConsumingMp || currentMana >= maxMana}
                        className={cn(
                            "w-6 h-6 rounded flex items-center justify-center transition-all",
                            currentMana >= maxMana
                                ? "bg-slate-900/80 border border-slate-800 text-slate-700 opacity-50 cursor-not-allowed"
                                : "bg-blue-950/40 border border-blue-900/50 text-blue-500 hover:bg-blue-900/60 active:scale-95"
                        )}
                    >
                        {isConsumingMp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Droplet className="w-3 h-3" fill="currentColor" />}
                    </button>
                </div>
            </div>
        </>
    );
}
