"use client";

import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ItemIcon } from "@/components/items/ItemIcon";
// import { formatItemEffects } from "@/utils/item-effects"; // Unused in this logic if we iterate
import { Shield, Coins, Sparkles } from "lucide-react";

const TIER_CONFIG: Record<string, { color: string, border: string, bg: string, label: string }> = {
    'COMMON': { color: 'text-slate-400', border: 'border-slate-700', bg: 'bg-slate-900', label: 'Common' },
    'SUPERIOR': { color: 'text-cyan-400', border: 'border-cyan-700', bg: 'bg-cyan-950', label: 'Superior' },
    'LEGENDARY': { color: 'text-purple-400', border: 'border-purple-700', bg: 'bg-purple-950', label: 'Legendary' },
    'PERFECT': { color: 'text-amber-400', border: 'border-amber-600', bg: 'bg-amber-950', label: 'Perfect' },
    'TRANSCENDENT': { color: 'text-red-500', border: 'border-red-600', bg: 'bg-red-950', label: 'Transcendent' },
};

interface TooltipProps {
    hoveredItem: any;
    equippedItem?: any;
    position: { x: number, y: number } | null;
}

export function ItemComparisonTooltip({ hoveredItem, equippedItem, position }: TooltipProps) {
    if (!position || !hoveredItem) return null;
    if (typeof document === 'undefined') return null;

    // Shift tooltip to ensure it stays on screen (basic logic)
    // Default: Top-Right of cursor
    // If near right edge, flip to Left
    // If near bottom, flip Up
    const xOffset = 20;
    const yOffset = 20;

    // Check viewport width if available to flip side
    const isRightSide = position.x > (window.innerWidth / 2);

    return createPortal(
        <div
            className="fixed z-[9999] pointer-events-none flex gap-4 items-start transition-opacity duration-150"
            style={{
                top: position.y + yOffset,
                left: isRightSide ? 'auto' : position.x + xOffset,
                right: isRightSide ? (window.innerWidth - position.x) + xOffset : 'auto',
                // Prevent overflowing bottom
                transform: position.y > window.innerHeight - 300 ? 'translateY(-100%)' : 'none'
            }}
        >
            {/* HOVERED ITEM */}
            <TooltipCard item={hoveredItem} type="HOVERED" comparisonItem={equippedItem} />

            {/* EQUIPPED ITEM (Comparison) */}
            {equippedItem && hoveredItem.type === 'EQUIPMENT' && (
                <TooltipCard item={equippedItem.item || equippedItem} type="EQUIPPED" />
            )}
        </div>,
        document.body
    );
}

function TooltipCard({ item, type, comparisonItem }: { item: any, type: 'HOVERED' | 'EQUIPPED', comparisonItem?: any }) {
    if (!item) return null;

    // Helper to find comparison diff
    const getComparisonDiff = (statKey: string, val: number) => {
        if (type === 'EQUIPPED') return null;
        if (!comparisonItem) return null;

        // comparisonItem is a full inventory row — effect is nested under .item
        const compEffect = (comparisonItem.item || comparisonItem).effect || {};
        const compVal = Number(compEffect[statKey] || 0);
        const diff = val - compVal;

        if (diff === 0) return null;
        return (
            <span className={cn("ml-2 text-[10px] font-bold", diff > 0 ? "text-green-500" : "text-red-500")}>
                ({diff > 0 ? '+' : ''}{diff})
            </span>
        );
    };

    const rankColors: Record<string, string> = {
        'E': 'text-slate-400 border-slate-700',
        'D': 'text-cyan-400 border-cyan-700',
        'C': 'text-blue-400 border-blue-700',
        'B': 'text-purple-400 border-purple-700',
        'A': 'text-red-400 border-red-700',
        'S': 'text-yellow-400 border-yellow-700',
        'S+': 'text-orange-400 border-orange-500/50',
        'COSMIC': 'text-pink-500 border-pink-500/50',
    };

    const colorClass = rankColors[item.rarity] || 'text-slate-400 border-slate-700';

    return (
        <div className={cn(
            "w-64 bg-slate-950/95 backdrop-blur-md rounded-lg overflow-hidden border shadow-2xl p-3 flex flex-col gap-2",
            type === 'EQUIPPED' ? "border-slate-600 opacity-90 scale-95" : "border-cyan-500/50 scale-100"
        )}>
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="flex gap-3">
                    <div className={cn("w-10 h-10 rounded bg-black/50 border flex items-center justify-center shrink-0", colorClass)}>
                        <ItemIcon item={item} className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className={cn("font-bold text-sm leading-tight", 
                            item.rarity === 'S' ? "text-yellow-400" : 
                            item.rarity === 'S+' ? "text-orange-400" : 
                            item.rarity === 'COSMIC' ? "text-pink-400" : "text-white"
                        )}>
                            {item.name}
                        </h4>
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">
                            {item.rarity}-Rank {item.type}
                        </div>
                        {item.type === 'EQUIPMENT' && item.roll_tier && item.roll_tier !== 'COMMON' && (
                            <div className={cn(
                                "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border mt-1 flex items-center gap-1 w-fit",
                                TIER_CONFIG[item.roll_tier]?.color || 'text-slate-400',
                                TIER_CONFIG[item.roll_tier]?.border || 'border-slate-700',
                                "bg-black/40"
                            )}>
                                {item.roll_tier === 'PERFECT' || item.roll_tier === 'TRANSCENDENT' ? <Sparkles className="w-2 h-2" /> : null}
                                {item.roll_tier} {item.quality_roll ? `${Math.round(item.quality_roll)}%` : ''}
                            </div>
                        )}
                    </div>
                </div>
                {type === 'EQUIPPED' && (
                    <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                        Equipped
                    </span>
                )}
            </div>

            <div className="h-px bg-slate-800 my-1" />

            {/* Main Stats (Damage/Def) */}
            <div className="flex gap-4">
                {(item.effect?.damage_min || item.effect?.damage_max) && (
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase font-bold">Attack</span>
                        <div className="text-sm font-mono text-white flex items-center">
                            {item.effect.damage_max ? `${item.effect.damage_min}-${item.effect.damage_max}` : `+${item.effect.damage_min}`}
                            {item.scale_factor > 1 && <span className="text-[9px] text-cyan-500 ml-1">↑</span>}
                            {/* Diff logic complex for ranges, skip for simple */}
                        </div>
                    </div>
                )}
                {item.effect?.defense && (
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase font-bold">Defense</span>
                        <div className="text-sm font-mono text-white flex items-center">
                            {item.effect.defense}
                            {item.scale_factor > 1 && <span className="text-[9px] text-cyan-500 mr-1">↑</span>}
                            <Shield className="w-3 h-3 ml-1 text-slate-600" />
                            {getComparisonDiff('defense', item.effect.defense)}
                        </div>
                    </div>
                )}
            </div>

            {/* Attributes / Effects */}
            <div className="space-y-1 mt-1">
                {Object.entries(item.effect || {}).map(([key, val]) => {
                    if (['damage_min', 'damage_max', 'defense', 'level_required', 'unlocks_dungeon', 'sell_price', 'slot'].includes(key)) return null;
                    if (typeof val !== 'number') return null; // Skip non-numeric for stat diffs

                    const label = key.replace(/_/g, ' ').toUpperCase();
                    // Colors
                    const isAttr = ['strength', 'agility', 'vitality', 'intelligence', 'perception'].includes(key);
                    const labelColor = isAttr ? 'text-slate-300' : 'text-blue-300';
                    const isScalable = ['strength', 'agility', 'vitality', 'intelligence', 'perception', 'luck', 'armor_penetration', 'hp_flat', 'mana_flat'].includes(key);

                    return (
                        <div key={key} className="flex justify-between items-center text-xs font-mono">
                            <span className={labelColor}>{label}</span>
                            <span className="text-white flex items-center gap-1">
                                +{val}
                                {isScalable && item.scale_factor > 1 && <span className="text-[8px] text-cyan-500">↑</span>}
                                {getComparisonDiff(key, val as number)}
                            </span>
                        </div>
                    );
                })}

                {/* Text Effects from formatter (Handling arrays/strings) */}
                {/* Note: formatItemEffects handles known keys nicely. We can just use that for non-stat things or rely on our manual loop above for stats */}
                {/* actually formatItemEffects formats EVERYTHING including stats. */}
            </div>

            {/* Description */}
            {item.description && (
                <div className="mt-2 text-[10px] text-slate-400 italic bg-slate-900/50 p-2 rounded border border-slate-800">
                    {item.description}
                </div>
            )}

            {/* Footer */}
            <div className="mt-1 flex justify-between items-center border-t border-slate-800 pt-2">
                <span className="text-[10px] text-slate-500 uppercase">
                    Requires Lvl {item.effect?.level_required || 1}
                </span>
                <span className="text-xs font-bold text-yellow-500 flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {Number(item.price || 0).toLocaleString()}
                </span>
            </div>
        </div>
    )
}
