"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { User, Shield, Sword, Footprints, Info, Zap, Skull, Crosshair, Ghost, Columns, Star, Sparkles, Hand } from "lucide-react";
import { ItemIcon } from "@/components/items/ItemIcon";
import { formatItemEffects } from "@/utils/item-effects";

const TIER_CONFIG: Record<string, { color: string, border: string, bg: string, shadow: string, label: string }> = {
    'COMMON': {
        color: 'text-slate-400',
        border: 'border-slate-700',
        bg: 'bg-slate-900/80',
        shadow: 'shadow-[0_0_10px_rgba(148,163,184,0.2)]',
        label: 'Common'
    },
    'SUPERIOR': {
        color: 'text-cyan-400',
        border: 'border-cyan-700',
        bg: 'bg-cyan-950/80',
        shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.3)]',
        label: 'Superior'
    },
    'LEGENDARY': {
        color: 'text-purple-400',
        border: 'border-purple-700',
        bg: 'bg-purple-950/80',
        shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
        label: 'Legendary'
    },
    'PERFECT': {
        color: 'text-amber-400',
        border: 'border-amber-600',
        bg: 'bg-amber-950/80',
        shadow: 'shadow-[0_0_25px_rgba(245,158,11,0.5)]',
        label: 'Perfect'
    },
    'TRANSCENDENT': {
        color: 'text-red-500',
        border: 'border-red-600',
        bg: 'bg-red-950/80',
        shadow: 'shadow-[0_0_30px_rgba(239,68,68,0.6)]',
        label: 'Transcendent'
    },
};

interface EquippedItems {
    HEAD?: any;
    CHEST?: any;
    LEGS?: any;
    FEET?: any;
    MAIN_HAND?: any;
    OFF_HAND?: any;
    ACCESSORY?: any;
    HANDS?: any;
}

export function HunterBody({ equipped, playerClass, stats, derivedStats }: { equipped: EquippedItems, playerClass?: string | null, stats?: any, derivedStats?: any }) {
    const [hoveredSlot, setHoveredSlot] = useState<{ id: string, item: any, rect: DOMRect } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Helper to render a slot
    const renderSlot = (slotName: string, icon: any, item: any, className: string, id: string) => {
        const tier = item?.roll_tier || 'COMMON';
        const config = TIER_CONFIG[tier] || TIER_CONFIG['COMMON'];

        return (
            <div
                className={cn("absolute flex items-center justify-center transition-all duration-500 z-10", className)}
                onMouseEnter={(e) => {
                    if (item) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredSlot({ id, item, rect });
                    }
                }}
                onMouseLeave={() => setHoveredSlot(null)}
            >
                <div className={cn(
                    "w-20 h-20 rounded border-2 flex flex-col items-center justify-center p-0 relative bg-black/40 backdrop-blur-sm transition-all duration-300",
                    item
                        ? cn(config.border, config.shadow, hoveredSlot?.id === id && "scale-110 z-20")
                        : "border-white/10 text-white/20"
                )}>
                    {item ? (
                        <ItemIcon item={item.item} className="w-full h-full mb-0" />
                    ) : (
                        icon
                    )}
                </div>
                <span className="absolute -bottom-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold opacity-70">{slotName}</span>
            </div>
        )
    };

    // --- DISPLAY LOGIC ---
    // Use effective stats if available, otherwise fallback to 0
    // We assume `stats` object has structure: { strength, agility, ... }
    // We assume `derivedStats` has: { atk, def, hp, mana, precision, etc }

    const atkDisplay = derivedStats?.atk ? `${derivedStats.atk}` : "0-0"; // derivedStats.atk might be "100-120"
    const defDisplay = derivedStats?.def || 0;

    const attributes = {
        strength: stats?.strength || 0,
        agility: stats?.agility || 0,
        intelligence: stats?.intelligence || 0,
        vitality: stats?.vitality || 0,
        perception: stats?.perception || 0,
    };

    // Calculate secondary stats from `stats` object if they exist, or fallback to aggregation?
    // Actually, `stats` (effectiveStats) usually contains flattened stats like `critCheck`, `dodgeDisplay` etc?
    // Let's check `UserStats` definition. It usually has `strength`, `agility`...
    // Secondary stats like `crit_rate` might be in there too.

    // For now, let's show the breakdown of the 5 attributes + derived Key stats.

    // Also include aggregated Item effects for secondary visual flair if needed, 
    // BUT user wants ACTUAL TOTALS. The `stats` object usually has Base + Mods.
    // Let's try to extract secondary stats from `stats` if possible.
    // If `stats` is just attributes, we might miss specific item effects like "Life Steal".
    // However, `effectiveStats` in `page.tsx` comes from `StatsManager.calculateEffectiveStats`.
    // It merges base + modifiers. So if an item gives "life_steal", it should be in `stats`.

    const secondaryStats = Object.entries(stats || {}).filter(([key, value]) => {
        // Filter out primary attributes and known non-display keys
        const isAttr = ['strength', 'agility', 'intelligence', 'vitality', 'perception', 'money', 'experience'].includes(key);
        // We want to show things like: critical_rate, dodge_rate, etc.
        // Also filter out 'available_points'
        if (isAttr || key === 'available_points' || key === 'points') return false;

        // Only show if value > 0 (and is number)
        return typeof value === 'number' && value > 0;
    });

    const hasAttributes = Object.values(attributes).some(v => v > 0);
    const hasSecondary = secondaryStats.length > 0;


    // Class Icon Logic
    const renderClassBackground = () => {
        const cls = (playerClass || "").toUpperCase();
        let Icon = User;

        if (cls.includes("MAGE")) Icon = Zap;
        else if (cls.includes("WARLOCK") || cls.includes("NECROMANCER")) Icon = Skull;
        else if (cls.includes("ASSASSIN") || cls.includes("ROGUE")) Icon = Ghost;
        else if (cls.includes("TANK") || cls.includes("KNIGHT")) Icon = Shield;
        else if (cls.includes("FIGHTER") || cls.includes("WARRIOR")) Icon = Sword;
        else if (cls.includes("HEALER") || cls.includes("PRIEST")) Icon = Crosshair;

        return <Icon className="w-48 h-48 text-cyan-500" />;
    };

    return (
        <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto h-full">
            {/* Visual Body - Compact */}
            <div className="relative w-full flex-1 min-h-[500px] p-4 flex items-center justify-center">

                {/* Background Layer (Clipped) */}
                <div className="absolute inset-0 border border-white/5 rounded-xl bg-gradient-to-b from-slate-900/50 to-black overflow-hidden pointer-events-none">
                    {/* Blurred Class Background Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 blur-md scale-150">
                        {renderClassBackground()}
                    </div>
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50" />
                </div>

                <div className="relative w-full h-full z-10" ref={containerRef}>
                    {/* HEAD */}
                    {renderSlot("HEAD", <User className="w-10 h-10" />, equipped.HEAD, "top-[5%] left-1/2 -translate-x-1/2", "head")}

                    {/* CHEST */}
                    {renderSlot("CHEST", <Shield className="w-10 h-10" />, equipped.CHEST, "top-[25%] left-1/2 -translate-x-1/2", "chest")}

                    {/* LEGS */}
                    {renderSlot("LEGS", <Columns className="w-10 h-10" />, equipped.LEGS, "top-[50%] left-1/2 -translate-x-1/2", "legs")}

                    {/* MAIN HAND */}
                    {renderSlot("MAIN", <Sword className="w-10 h-10" />, equipped.MAIN_HAND, "top-[30%] left-[2%]", "main")}

                    {/* OFF HAND */}
                    {renderSlot("OFF", <Shield className="w-10 h-10" />, equipped.OFF_HAND, "top-[30%] right-[2%]", "off")}

                    {/* FEET */}
                    {renderSlot("FEET", <Footprints className="w-10 h-10" />, equipped.FEET, "bottom-[10%] left-1/2 -translate-x-1/2", "feet")}

                    {/* ACCESSORY */}
                    {renderSlot("ACC", <Info className="w-10 h-10" />, equipped.ACCESSORY, "top-[5%] right-[2%]", "acc")}

                    {/* HANDS */}
                    {renderSlot("HANDS", <Hand className="w-10 h-10" />, equipped.HANDS, "top-[5%] left-[2%]", "hands")}
                </div>

                {/* PORTAL TOOLTIP */}
                {hoveredSlot && typeof document !== 'undefined' && createPortal(
                    <div
                        className="fixed z-[9999] pointer-events-none transition-all duration-300"
                        style={{
                            top: hoveredSlot.rect.top + (hoveredSlot.rect.height / 2),
                            left: hoveredSlot.id === 'acc' || hoveredSlot.id === 'off'
                                ? hoveredSlot.rect.left - 20 // Margin
                                : hoveredSlot.rect.right + 20, // Margin
                            transform: hoveredSlot.id === 'acc' || hoveredSlot.id === 'off'
                                ? 'translate(-100%, -50%)'
                                : 'translate(0, -50%)'
                        }}
                    >
                        <TooltipContent item={hoveredSlot.item} />
                    </div>,
                    document.body
                )}
            </div>

            {/* Equipment Stats Panel - Compact */}
            <div className="bg-slate-950/80 border border-cyan-900/40 rounded-lg p-3 flex-shrink-0 overflow-x-hidden hide-scrollbar">
                <h3 className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-2 border-b border-cyan-900/30 pb-1">
                    Status (Total)
                </h3>

                <div className="space-y-1.5 ">
                    {/* Primary Combat Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-red-950/20 border border-red-900/30 rounded px-2 py-1 flex flex-col items-center">
                            <span className="text-[9px] text-red-400 uppercase font-bold leading-none mb-0.5">ATK</span>
                            <span className="text-sm font-mono text-white leading-none">
                                {atkDisplay}
                            </span>
                        </div>
                        <div className="bg-blue-950/20 border border-blue-900/30 rounded px-2 py-1 flex flex-col items-center">
                            <span className="text-[9px] text-blue-400 uppercase font-bold leading-none mb-0.5">DEF</span>
                            <span className="text-sm font-mono text-white leading-none">
                                {defDisplay}
                            </span>
                        </div>
                    </div>

                    {/* Compact Attributes Grid */}
                    {hasAttributes && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-2">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">STR <span className="text-white">{attributes.strength}</span></div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">AGI <span className="text-white">{attributes.agility}</span></div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">INT <span className="text-white">{attributes.intelligence}</span></div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">VIT <span className="text-white">{attributes.vitality}</span></div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">PER <span className="text-white">{attributes.perception}</span></div>
                        </div>
                    )}

                    {/* Secondary Stats (Armor Pen, etc.) */}
                    {hasSecondary && (
                        <div className="border-t border-white/5 pt-1 mt-1">
                            <div className="grid grid-cols-1 gap-0.5">
                                {secondaryStats.map(([key, value]) => {
                                    // Format key: armor_pen -> Armor Pen
                                    const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                                    return (
                                        <div key={key} className="flex justify-between text-[10px] font-mono text-slate-500">
                                            {label} <span className="text-cyan-400">+{value as number}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {!hasAttributes && !hasSecondary && (
                        <div className="text-[10px] text-slate-600 italic text-center py-1">
                            No stats available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
// Separate Tooltip Component for Portal
function TooltipContent({ item }: { item: any }) {
    if (!item) return null;
    const tier = item.roll_tier || 'COMMON';
    const config = TIER_CONFIG[tier] || TIER_CONFIG['COMMON'];
    const quality = Number(item.quality_roll || 100);
    const affixes = Array.isArray(item.bonus_affixes) ? item.bonus_affixes : [];

    return (
        <div className={cn(
            "bg-slate-950/95 backdrop-blur-xl border p-4 rounded-lg w-64 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200",
            config.border
        )}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded border flex items-center justify-center bg-black/50", config.border)}>
                        <ItemIcon item={item.item} className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{item.item.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-[9px] font-bold uppercase px-1 rounded-sm border bg-black/40", config.border, config.color)}>
                                {config.label}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                                {quality.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Affixes */}
            {affixes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {affixes.map((aff: string, i: number) => (
                        <span key={i} className="text-[8px] bg-cyan-950/50 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-2 h-2" /> {aff.replace(/_/g, ' ')}
                        </span>
                    ))}
                </div>
            )}

            <div className="h-px bg-slate-800/50 w-full mb-2" />

            {/* Effects */}
            <div className="space-y-1 mb-3">
                {formatItemEffects(item.item.effect).map((eff, i) => {
                    const isPrimary = eff.includes("⚔️") || eff.includes("🛡️");
                    return (
                        <p key={i} className={cn(
                            "text-[10px] font-mono leading-tight flex items-center gap-1.5",
                            isPrimary ? "text-white font-bold text-xs" : "text-green-400 text-xs"
                        )}>
                            {!isPrimary && <span className="w-1 h-1 bg-green-500 rounded-full" />}
                            {eff}
                        </p>
                    );
                })}
            </div>

            {item.item.description && (
                <div className="bg-black/40 p-2 rounded border border-white/5">
                    <p className="text-[10px] text-slate-400 italic leading-snug">
                        {item.item.description}
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="mt-2 flex justify-between items-center text-[8px] font-bold uppercase tracking-widest text-slate-600">
                <span>{item.item.rarity}-Rank {item.item.type}</span>
                {tier !== 'COMMON' && (
                    <span className={cn("flex items-center gap-0.5", config.color)}>
                        <Star className="w-2 h-2 fill-current" />
                        Special Variant
                    </span>
                )}
            </div>
        </div>
    );
}
