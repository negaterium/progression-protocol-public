"use client";

import { useState } from "react";
import {
    Lock, CheckCircle2, Trophy, Crown, Zap, Ghost, Skull, Sword, Shield, BookOpen, Clock, Activity, Flame, Dumbbell, Map, Target, DoorOpen, Calendar, Sun, Moon, Hammer, Book, Award, Layers, Coins, Gem, ShoppingBag, Watch, Crosshair, Terminal, Sparkles, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// Map slugs to icons
const ICON_MAP: Record<string, any> = {
    Zap, Ghost, Crown, Dumbbell, Activity, Flame, Sword, Skull, Map, Target, DoorOpen, Clock, CheckCircle: CheckCircle2, Calendar, Shield, Sun, Moon, Hammer, Book, Award, Layers, Coins, Gem, ShoppingBag, BookOpen, Watch, Crosshair, Terminal, Sparkles
};

interface Achievement {
    id: string;
    code: string;
    name: string;
    description: string;
    icon_slug: string;
    rarity: string;
    xp_reward: number;
    gold_reward?: number;
    item_reward_name?: string;
    item_reward_rarity?: string;
    is_hidden: boolean;
}

interface AchievementsPanelProps {
    refreshTrigger?: number;
    allAchievements: Achievement[];
    unlockedIds: string[];
}

type FilterTab = 'ALL' | 'UNLOCKED' | 'LOCKED' | 'SECRET';

export function AchievementsPanel({ allAchievements, unlockedIds }: AchievementsPanelProps) {
    const [filter, setFilter] = useState<FilterTab>('ALL');
    const userAchievements = new Set(unlockedIds);
    const achievements = allAchievements || [];

    const unlockedCount = userAchievements.size;
    const totalCount = achievements.length;
    const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    // Filter achievements based on active tab
    const filteredAchievements = achievements.filter(ach => {
        const isUnlocked = userAchievements.has(ach.id);
        const isSecret = ach.is_hidden && !isUnlocked;

        if (filter === 'UNLOCKED') return isUnlocked;
        if (filter === 'LOCKED') return !isUnlocked && !isSecret;
        if (filter === 'SECRET') return isSecret;
        return true;
    });

    const getRarityStyles = (rarity: string, isUnlocked: boolean) => {
        if (!isUnlocked) {
            return {
                cardBg: "bg-slate-950/40 border-slate-800/60 opacity-60 grayscale hover:opacity-100 hover:border-slate-700 transition-all",
                iconBg: "bg-slate-900 border-slate-700 text-slate-600",
                badgeBg: "bg-slate-900 text-slate-500 border-slate-700",
                textHex: "text-slate-400"
            };
        }

        const r = (rarity || 'COMMON').toUpperCase();
        if (r === 'S' || r === 'LEGENDARY' || r === 'COSMIC') {
            return {
                cardBg: "bg-gradient-to-br from-amber-950/50 via-amber-900/20 to-black border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:border-amber-400",
                iconBg: "bg-gradient-to-br from-amber-500/30 to-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]",
                badgeBg: "bg-amber-950/80 text-amber-400 border-amber-500/50",
                textHex: "text-amber-300"
            };
        }
        if (r === 'A' || r === 'EPIC' || r === 'XX') {
            return {
                cardBg: "bg-gradient-to-br from-pink-950/50 via-purple-900/20 to-black border-pink-500/60 shadow-[0_0_20px_rgba(236,72,153,0.2)] hover:border-pink-400",
                iconBg: "bg-gradient-to-br from-pink-500/30 to-purple-950/80 border-pink-400 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.4)]",
                badgeBg: "bg-pink-950/80 text-pink-400 border-pink-500/50",
                textHex: "text-pink-300"
            };
        }
        if (r === 'B' || r === 'RARE') {
            return {
                cardBg: "bg-gradient-to-br from-cyan-950/50 via-blue-900/20 to-black border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:border-cyan-400",
                iconBg: "bg-gradient-to-br from-cyan-500/30 to-blue-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]",
                badgeBg: "bg-cyan-950/80 text-cyan-400 border-cyan-500/50",
                textHex: "text-cyan-300"
            };
        }
        // Common / C / D / E
        return {
            cardBg: "bg-gradient-to-br from-emerald-950/40 via-slate-900/40 to-black border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:border-emerald-400",
            iconBg: "bg-gradient-to-br from-emerald-500/25 to-slate-900 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
            badgeBg: "bg-emerald-950/80 text-emerald-400 border-emerald-500/50",
            textHex: "text-emerald-300"
        };
    };

    return (
        <div className="space-y-6">
            {/* System Header & Progress Stats */}
            <div className="glass-panel p-5 rounded-lg border border-cyan-900/40 bg-black/60 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-cyan-900/30 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-cyan-400" />
                            <h3 className="text-lg font-bold font-mono tracking-widest text-white uppercase">
                                SYSTEM ACHIEVEMENTS LOG
                            </h3>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                            Hunter Progression Milestones & Classified Trophies
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end font-mono">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">COMPLETION</span>
                            <span className="text-xl font-bold text-cyan-400">{progressPercent}%</span>
                        </div>
                        <div className="h-8 w-px bg-cyan-900/50" />
                        <div className="flex flex-col items-end font-mono">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">RECORD</span>
                            <span className="text-xl font-bold text-white">
                                <span className="text-cyan-400">{unlockedCount}</span> / {totalCount}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2.5 bg-slate-950 border border-cyan-900/40 rounded-full overflow-hidden mb-4">
                    <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-600 via-cyan-400 to-amber-400 transition-all duration-700 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 font-mono text-xs overflow-x-auto pb-1">
                    {(['ALL', 'UNLOCKED', 'LOCKED', 'SECRET'] as FilterTab[]).map((tab) => {
                        const count = tab === 'ALL' ? achievements.length
                            : tab === 'UNLOCKED' ? unlockedCount
                            : tab === 'LOCKED' ? achievements.filter(a => !userAchievements.has(a.id) && !a.is_hidden).length
                            : achievements.filter(a => a.is_hidden && !userAchievements.has(a.id)).length;

                        return (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md border text-[11px] font-bold tracking-wider transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap",
                                    filter === tab
                                        ? "bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                                        : "bg-black/40 border-slate-800 text-slate-500 hover:border-cyan-900 hover:text-slate-300"
                                )}
                            >
                                {tab}
                                <span className="px-1.5 py-0.2 text-[9px] rounded bg-black/60 border border-white/10 text-slate-400">
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Achievements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAchievements.map(ach => {
                    const isUnlocked = userAchievements.has(ach.id);
                    const Icon = ICON_MAP[ach.icon_slug] || Trophy;
                    const isSecret = ach.is_hidden && !isUnlocked;
                    const rarityStyle = getRarityStyles(ach.rarity, isUnlocked);

                    // Determine thematic background based on icon slug
                    const combatSlugs = ['Sword', 'Skull', 'Target', 'Crosshair', 'Flame', 'Shield', 'Activity'];
                    const wealthSlugs = ['Coins', 'Gem', 'ShoppingBag', 'Crown'];
                    let bgImage = '/achievements/progression.png'; // default
                    if (isSecret) bgImage = '/achievements/secret.png';
                    else if (combatSlugs.includes(ach.icon_slug)) bgImage = '/achievements/combat.png';
                    else if (wealthSlugs.includes(ach.icon_slug)) bgImage = '/achievements/wealth.png';

                    return (
                        <div
                            key={ach.id}
                            className={cn(
                                "relative p-4 rounded-lg border flex items-start gap-4 transition-all duration-300 group overflow-hidden",
                                rarityStyle.cardBg
                            )}
                        >
                            {/* Thematic Background Image */}
                            <div className="absolute inset-0 z-0">
                                <Image
                                    src={bgImage}
                                    alt="Achievement Background"
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    className={cn(
                                        "object-cover transition-all duration-700",
                                        isUnlocked ? "opacity-30 group-hover:opacity-50 group-hover:scale-105 mix-blend-screen" : "opacity-10 grayscale mix-blend-overlay"
                                    )}
                                />
                                {/* Gradient to ensure text readability */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-transparent" />
                            </div>

                            {/* Icon Badge Container */}
                            <div className="relative shrink-0 flex flex-col items-center z-10">
                                <div className={cn(
                                    "w-14 h-14 rounded-lg flex items-center justify-center border relative transition-transform duration-300 group-hover:scale-105 overflow-hidden",
                                    rarityStyle.iconBg,
                                    !isUnlocked && "grayscale opacity-75"
                                )}>
                                    <div className="absolute inset-0 opacity-20">
                                        <Image src={bgImage} alt="Icon Background" fill sizes="56px" className="object-cover blur-[2px]" />
                                    </div>
                                    <div className="relative z-10">
                                        {isSecret ? (
                                            <Lock className="w-6 h-6 text-red-400 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                        ) : (
                                            <Icon className="w-6 h-6 drop-shadow-[0_0_8px_currentColor]" />
                                        )}
                                    </div>

                                    {/* Scanline overlay */}
                                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.3)_50%)] bg-[size:100%_4px] pointer-events-none rounded-lg opacity-40 z-20" />
                                </div>

                                {/* Rarity / Encrypted Badge */}
                                <span className={cn(
                                    "mt-1 px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wider uppercase border rounded shadow-sm whitespace-nowrap",
                                    isSecret ? "bg-red-950/80 text-red-400 border-red-800/60" : rarityStyle.badgeBg
                                )}>
                                    {isSecret ? "SECRET" : (ach.rarity || 'COMMON')}
                                </span>
                            </div>

                            {/* Info & Description */}
                            <div className="flex-1 min-w-0 pr-4 z-10">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <h4 className={cn(
                                        "font-bold text-sm font-sans tracking-wide truncate drop-shadow-md",
                                        isSecret ? "text-red-400/90 italic font-mono text-xs" : isUnlocked ? "text-white" : "text-slate-400"
                                    )}>
                                        {isSecret ? "CLASSIFIED SYSTEM RECORD" : ach.name}
                                    </h4>
                                </div>

                                <p className="text-[11px] text-slate-400 font-sans leading-relaxed line-clamp-2 mb-3">
                                    {isSecret ? "Defeat the designated target or complete the secret objective to decrypt this record." : ach.description}
                                </p>

                                {/* Rewards Badges */}
                                {!isSecret && (
                                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                                        {ach.xp_reward > 0 && (
                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 flex items-center gap-1 shadow-[0_0_5px_rgba(6,182,212,0.2)]">
                                                <Zap className="w-2.5 h-2.5 text-cyan-400" />
                                                +{ach.xp_reward.toLocaleString()} XP
                                            </span>
                                        )}
                                        {ach.gold_reward && ach.gold_reward > 0 && (
                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/80 flex items-center gap-1 shadow-[0_0_5px_rgba(245,158,11,0.2)]">
                                                <Coins className="w-2.5 h-2.5 text-amber-400" />
                                                +{ach.gold_reward.toLocaleString()} Gold
                                            </span>
                                        )}
                                        {ach.item_reward_name && (
                                            <span className={cn(
                                                "text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900/90 border flex items-center gap-1 shadow-md",
                                                ach.item_reward_rarity === 'S' ? "text-amber-400 border-amber-700/60" :
                                                    ach.item_reward_rarity === 'A' ? "text-pink-400 border-pink-700/60" :
                                                        ach.item_reward_rarity === 'B' ? "text-cyan-400 border-cyan-700/60" : "text-emerald-400 border-emerald-700/60"
                                            )}>
                                                <ShoppingBag className="w-2.5 h-2.5" />
                                                {ach.item_reward_name}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Top Right Status Indicator */}
                            <div className="absolute top-2.5 right-2.5">
                                {isUnlocked ? (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 text-[9px] font-mono font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                                        <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                                        UNLOCKED
                                    </div>
                                ) : isSecret ? (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800/60 text-red-400 text-[9px] font-mono font-bold">
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        ENCRYPTED
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-500 text-[9px] font-mono">
                                        <Lock className="w-3 h-3" />
                                        LOCKED
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredAchievements.length === 0 && (
                <div className="glass-panel p-8 rounded-lg text-center font-mono text-slate-500 text-xs border border-slate-800">
                    NO ACHIEVEMENTS FOUND IN THIS CATEGORY.
                </div>
            )}
        </div>
    );
}
