"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { equipItemAction, consumeItemAction, sellItemAction } from "@/app/actions/inventory";
import { Zap, RefreshCw, Coins, AlertCircle, LayoutGrid, Shield, FlaskConical, Ticket, SlidersHorizontal, Package, Sparkles } from "lucide-react";
import { formatItemEffects } from "@/utils/item-effects";
import { ItemIcon } from "@/components/items/ItemIcon";
import { SellModal } from "./SellModal";

import { SystemAlert } from "@/components/system/SystemAlert";
import { ItemComparisonTooltip } from "@/components/inventory/ItemComparisonTooltip";
import { RANK_LEVELS, getRankValue } from "@/lib/system/rank-constants";

interface InventoryItem {
    id: number;
    quantity: number;
    equipped: boolean;
    item: {
        id: number;
        name: string;
        description: string;
        type: string;
        rarity: string;
        price: number;
        purchased_price?: number | null;
        effect: {
            level_required?: number;
            unlocks_dungeon?: string;
            [key: string]: any;
        } | null;
        slot?: string; // Opt-in slot property if available
        quality_roll?: number;
        roll_tier?: string;
        bonus_affixes?: string[];
    };
}

const TIER_CONFIG: Record<string, { color: string, border: string, bg: string, label: string }> = {
    'COMMON': { color: 'text-slate-400', border: 'border-slate-700', bg: 'bg-slate-900', label: 'Common' },
    'SUPERIOR': { color: 'text-cyan-400', border: 'border-cyan-700', bg: 'bg-cyan-950', label: 'Superior' },
    'LEGENDARY': { color: 'text-purple-400', border: 'border-purple-700', bg: 'bg-purple-950', label: 'Legendary' },
    'PERFECT': { color: 'text-amber-400', border: 'border-amber-600', bg: 'bg-amber-950', label: 'Perfect' },
    'TRANSCENDENT': { color: 'text-red-500', border: 'border-red-600', bg: 'bg-red-950', label: 'Transcendent' },
};

export function InventoryGrid({
    items,
    userLevel = 1,
    hunterClass = 'NONE',
    equippedItems
}: {
    items: InventoryItem[],
    userLevel?: number,
    hunterClass?: string,
    equippedItems?: any
}) {
    const [loading, setLoading] = useState<number | null>(null);
    const [sellItem, setSellItem] = useState<{ id: number, item: InventoryItem['item'], price: number } | null>(null);

    const [activeTab, setActiveTab] = useState<'ALL' | 'EQUIPMENT' | 'CONSUMABLE' | 'KEY'>('ALL');
    const [sortBy, setSortBy] = useState<'RANK_DESC' | 'RANK_ASC' | 'NAME' | 'NEWEST'>('RANK_DESC');
    const [searchQuery, setSearchQuery] = useState("");
    const [alertMessage, setAlertMessage] = useState<{ message: string; type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' } | null>(null);

    // Tooltip State
    const [tooltipData, setTooltipData] = useState<{ item: any, position: { x: number, y: number } } | null>(null);

    const handleMouseEnter = (e: React.MouseEvent, item: InventoryItem['item']) => {
        setTooltipData({
            item,
            position: { x: e.clientX, y: e.clientY }
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tooltipData) {
            setTooltipData(prev => prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null);
        }
    };

    const handleMouseLeave = () => {
        setTooltipData(null);
    };

    // Helper to get equipped item for slot
    const getEquippedComparison = (hoveredItem: any) => {
        if (!equippedItems || hoveredItem.type !== 'EQUIPMENT') return null;

        // Try to resolve slot
        // 1. Explicit slot logic from item
        const slot = hoveredItem.slot || hoveredItem.effect?.slot;

        // 2. Fallback Inference if slot is missing
        if (!slot) {
            // Heuristic based on item name/type if needed, but DB likely provides it.
            // We can assume if it's missing, it's not equipable in a specific slot or is generic?
            // Actually, HunterBody expects keys: HEAD, CHEST, LEGS, FEET, MAIN_HAND, OFF_HAND, ACCESSORY
            // Let's rely on backend 'slot' property.
        }

        if (slot && equippedItems[slot]) {
            return equippedItems[slot];
        }

        return null;
    };


    const rankValue = (rank: string) => getRankValue(rank);

    const filteredItems = items
        .filter(entry => {
            const matchesTab = activeTab === 'ALL' || entry.item.type === activeTab;
            const matchesSearch = entry.item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesTab && matchesSearch;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'RANK_DESC': return rankValue(b.item.rarity) - rankValue(a.item.rarity);
                case 'RANK_ASC': return rankValue(a.item.rarity) - rankValue(b.item.rarity);
                case 'NAME': return a.item.name.localeCompare(b.item.name);
                case 'NEWEST': return b.id - a.id;
                default: return 0;
            }
        });

    const handleEquip = async (id: number) => {
        setLoading(id);
        try {
            const result = await equipItemAction(id);
            if (result.success) {
                window.dispatchEvent(new Event('progression_protocol_update'));
            } else {
                setAlertMessage({ message: result.error || "Action failed", type: 'ERROR' });
            }
        } catch { setAlertMessage({ message: "Action failed (Network)", type: 'ERROR' }); }
        setLoading(null);
    };

    const handleUseItem = async (id: number) => {
        setLoading(id);
        try {
            const result = await consumeItemAction(id);
            if (result.success) {
                window.dispatchEvent(new Event('progression_protocol_update'));
                // No success alert for seamless experience
            } else {
                setAlertMessage({ message: result.error || "Use failed", type: 'ERROR' });
            }
        } catch { setAlertMessage({ message: "Use failed (Network)", type: 'ERROR' }); }
        setLoading(null);
    };

    const handleSellClick = (id: number, item: InventoryItem['item']) => {
        const basePrice = item.price || 0;
        let price = Math.floor(basePrice * 0.75);
        if (basePrice > 0 && price < 1) price = 1;
        // Exploit Guard: never show a sell price higher than what was actually paid
        const purchasedPrice = item.purchased_price ?? null;
        if (purchasedPrice !== null && price > purchasedPrice) {
            price = purchasedPrice;
        }
        setSellItem({ id, item, price });
    };

    const handleConfirmSell = async () => {
        if (!sellItem) return;
        setLoading(sellItem.id);
        try {
            const result = await sellItemAction(sellItem.id);
            if (result.success) {
                window.dispatchEvent(new Event('progression_protocol_update'));
            } else {
                setAlertMessage({ message: result.error || "Sell failed", type: 'ERROR' });
            }
        } catch { setAlertMessage({ message: "Sell failed (Network)", type: 'ERROR' }); }
        setLoading(null);
        setSellItem(null);
    };

    // Affinity Helper
    const getAffinity = (item: InventoryItem['item']) => {
        if (item.type !== 'EQUIPMENT') return null;
        if (!hunterClass || hunterClass === 'NONE') return null;

        const name = item.name.toLowerCase();

        const MAGIC_CLASSES = ['Mage', 'Healer', 'Warlock', 'Necromancer', 'Shadow Monarch'];
        const SPEED_CLASSES = ['Assassin', 'Ranger'];
        const POWER_CLASSES = ['Fighter', 'Tank'];

        // Magic Weapons
        if (['staff', 'orb', 'grimoire', 'tome', 'wand'].some(k => name.includes(k)) || item.effect?.magic_amp) {
            if (MAGIC_CLASSES.includes(hunterClass)) return { label: 'PERFECT AFFINITY', color: 'text-purple-400 border-purple-500/50 bg-purple-950/30' };
            if (POWER_CLASSES.includes(hunterClass)) return { label: 'LOW AFFINITY', color: 'text-red-400 border-red-500/50 bg-red-950/30' };
        }

        // Speed Weapons
        if (['dagger', 'rapier', 'shortsword', 'bow', 'crossbow'].some(k => name.includes(k))) {
            if (SPEED_CLASSES.includes(hunterClass)) return { label: 'PERFECT AFFINITY', color: 'text-green-400 border-green-500/50 bg-green-950/30' };
            if (MAGIC_CLASSES.includes(hunterClass)) return { label: 'POOR AFFINITY', color: 'text-red-400 border-red-500/50 bg-red-950/30' };
        }

        // Power Weapons (Default for heavy/swords)
        if (['sword', 'axe', 'mace', 'shield', 'greatsword', 'hammer'].some(k => name.includes(k))) {
            if (POWER_CLASSES.includes(hunterClass)) return { label: 'PERFECT AFFINITY', color: 'text-orange-400 border-orange-500/50 bg-orange-950/30' };
        }

        return null;
    };


    const rankColors: Record<string, string> = {
        'E': 'text-slate-400 border-slate-700/50',
        'D': 'text-cyan-400 border-cyan-700/50',
        'C': 'text-blue-400 border-blue-700/50',
        'B': 'text-purple-400 border-purple-700/50',
        'A': 'text-red-400 border-red-700/50',
        'S': 'text-yellow-400 border-yellow-700/50',
        'S+': 'text-orange-400 border-orange-500/50',
        'XX': 'text-purple-400 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]',
        'COSMIC': 'text-pink-500 border-pink-500/50',
    };

    return (
        <div className="space-y-6">
            {/* Controls Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center bg-black/40 p-4 rounded-lg border border-slate-800">
                {/* Search & Tabs */}
                <div className="flex-1 space-y-3 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search Inventory..."
                        aria-label="Search inventory"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full md:max-w-xs bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none placeholder:text-slate-600 font-mono"
                    />
                    <div className="flex gap-2">
                        {([
                            { id: 'ALL', icon: LayoutGrid },
                            { id: 'EQUIPMENT', icon: Shield },
                            { id: 'CONSUMABLE', icon: FlaskConical },
                            { id: 'KEY', icon: Ticket }
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                aria-pressed={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-3 py-1 text-[10px] font-bold uppercase tracking-wider border rounded transition-all flex items-center gap-2",
                                    activeTab === tab.id
                                        ? "bg-cyan-950/50 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                        : "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600"
                                )}
                            >
                                <tab.icon className="w-3 h-3" />
                                {tab.id}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3" /> Sort:
                    </span>
                    <select
                        value={sortBy}
                        aria-label="Sort inventory"
                        onChange={(e) => setSortBy(e.target.value as 'RANK_DESC' | 'RANK_ASC' | 'NAME' | 'NEWEST')}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-cyan-500 outline-none uppercase font-bold"
                    >
                        <option value="RANK_DESC">Rank (High)</option>
                        <option value="RANK_ASC">Rank (Low)</option>
                        <option value="NAME">Name</option>
                        <option value="NEWEST">Newest</option>
                    </select>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
                {filteredItems.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-500 text-xs italic flex flex-col items-center gap-2 border border-dashed border-slate-800 rounded bg-slate-950/20">
                        <Package className="w-8 h-8 opacity-50" />
                        No items found corresponding to your criteria.
                    </div>
                )}
                {filteredItems.map(entry => {
                    const { item, quantity, equipped, id } = entry;
                    const isEquipable = item.type === 'EQUIPMENT';
                    const isConsumable = item.type === 'CONSUMABLE' || item.type === 'KEY';
                    const isLoading = loading === id;
                    const effects = formatItemEffects(item.effect, (item as any).scale_factor);

                    // Level Requirement Logic
                    let requiredLevel = 0;
                    if (item.effect?.level_required) requiredLevel = item.effect.level_required;
                    else if (item.type === 'KEY' && item.effect?.unlocks_dungeon) {
                        const map: Record<string, number> = { 'hapjeong_subway': 10, 'demon_castle': 40, 'jeju_island': 80 };
                        requiredLevel = map[item.effect.unlocks_dungeon] || 1;
                    }
                    // Apply rank-based requirements ONLY to KEYS
                    else if (item.type === 'KEY') {
                        const rawRank = (item.rarity || 'E').split('-')[0].trim().toUpperCase();
                        requiredLevel = RANK_LEVELS[rawRank] || 1;
                    }
                    const canUse = userLevel >= requiredLevel;

                    const basePrice = item.price || 0;
                    let sellPriceTooltip = Math.floor(basePrice * 0.75);
                    if (basePrice > 0 && sellPriceTooltip < 1) sellPriceTooltip = 1;
                    // Exploit Guard: cap tooltip price at what was paid
                    const purchasedPrice = (item as any).purchased_price ?? null;
                    if (purchasedPrice !== null && sellPriceTooltip > purchasedPrice) {
                        sellPriceTooltip = purchasedPrice;
                    }

                    return (
                        <div
                            key={id}
                            className={cn(
                                "bg-slate-900/50 border rounded p-3 flex flex-col relative group transition-all min-h-[140px]",
                                equipped ? "border-cyan-500 bg-cyan-950/20" : rankColors[item.rarity] || rankColors['E'],
                                isLoading && "opacity-50 pointer-events-none"
                            )}
                            onMouseEnter={(e) => handleMouseEnter(e, item)}
                            onMouseLeave={handleMouseLeave}
                            onMouseMove={handleMouseMove}
                        >
                            {equipped && (
                                <div className="absolute -top-2 -right-2 bg-cyan-600 text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-lg shadow-cyan-500/50 z-20">
                                    EQUIPPED
                                </div>
                            )}

                            <div className="flex items-start gap-4 mb-2">
                                <div className={cn(
                                    "w-20 h-20 rounded flex items-center justify-center border bg-black/40 flex-shrink-0 overflow-hidden",
                                    rankColors[item.rarity] || rankColors['E']
                                )}>
                                    <ItemIcon item={item} className="w-full h-full" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-start">
                                        <span className={cn("text-xs font-bold line-clamp-2 text-white block w-full")}>
                                            {item.name}
                                        </span>
                                        {quantity > 1 && (
                                            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 rounded ml-1">
                                                x{quantity}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <div className="text-[9px] text-slate-500 font-mono leading-none">
                                            {item.rarity}-Rank {item.type}
                                        </div>
                                        {item.type === 'EQUIPMENT' && item.roll_tier && item.roll_tier !== 'COMMON' && (
                                            <div className={cn(
                                                "text-[8px] font-bold px-1 py-0.5 rounded border flex items-center gap-1",
                                                TIER_CONFIG[item.roll_tier]?.color,
                                                TIER_CONFIG[item.roll_tier]?.border,
                                                "bg-black/40"
                                            )}>
                                                {item.roll_tier === 'PERFECT' || item.roll_tier === 'TRANSCENDENT' ? <Sparkles className="w-2 h-2" /> : null}
                                                {item.roll_tier} {item.quality_roll ? `${Math.round(item.quality_roll)}%` : ''}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {item.description && (
                                <p className="text-[10px] text-slate-400 leading-tight mb-3 line-clamp-3 italic">
                                    {item.description}
                                </p>
                            )}

                            {getAffinity(item) && (
                                <div className={cn(
                                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border mb-2 w-fit",
                                    getAffinity(item)?.color
                                )}>
                                    {getAffinity(item)?.label}
                                </div>
                            )}

                            {effects.length > 0 && (
                                <div className="mb-3 space-y-0.5">
                                    {effects.map((eff, i) => {
                                        const isPrimary = eff.includes("⚔️") || eff.includes("🛡️");
                                        return (
                                            <div key={i} className={cn(
                                                "text-[10px] font-mono flex items-center gap-1",
                                                isPrimary ? "text-white font-bold text-xs mb-1" : "text-cyan-200"
                                            )}>
                                                {!isPrimary && <span className="w-1 h-1 bg-cyan-500 rounded-full inline-block" />}
                                                {eff}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-auto flex gap-2">
                                {isEquipable && (
                                    <button
                                        type="button"
                                        aria-label={`${equipped ? 'Unequip' : 'Equip'} ${item.name}`}
                                        onClick={() => handleEquip(id)}
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-bold border rounded uppercase transition-colors flex justify-center items-center gap-1",
                                            equipped
                                                ? "border-amber-700 text-amber-500 hover:bg-amber-900/20"
                                                : "border-slate-700 text-slate-300 hover:bg-slate-800"
                                        )}
                                    >
                                        <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                                        {equipped ? "Unequip" : "Equip"}
                                    </button>
                                )}
                                {isConsumable && (
                                    <button
                                        type="button"
                                        aria-label={canUse ? `Use ${item.name}` : `${item.name} requires level ${requiredLevel}`}
                                        onClick={() => handleUseItem(id)}
                                        disabled={!canUse}
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-bold border rounded uppercase flex justify-center items-center gap-1 transition-colors",
                                            canUse
                                                ? "border-green-900/50 text-green-500 hover:bg-green-900/20"
                                                : "border-red-900/30 text-red-700 cursor-not-allowed bg-red-950/10"
                                        )}
                                        title={!canUse ? `Requires Level ${requiredLevel}` : "Use Item"}
                                    >
                                        {!canUse ? (
                                            <>
                                                <AlertCircle className="w-3 h-3" /> LVL {requiredLevel}
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-3 h-3" /> Use
                                            </>
                                        )}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    aria-label={`Sell ${item.name} for ${sellPriceTooltip.toLocaleString()} Gold`}
                                    onClick={() => handleSellClick(id, item)}
                                    className="px-2 py-1.5 text-[10px] font-bold border border-yellow-900/50 text-yellow-500 rounded uppercase hover:bg-yellow-900/20 flex justify-center items-center gap-1"
                                    title={`Sell for ${sellPriceTooltip.toLocaleString()} Gold`}
                                >
                                    <Coins className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                <SellModal
                    isOpen={!!sellItem}
                    item={sellItem?.item}
                    sellPrice={sellItem?.price || 0}
                    onClose={() => setSellItem(null)}
                    onConfirm={handleConfirmSell}
                    isSelling={loading !== null && sellItem !== null && loading === sellItem.id}
                />

                {alertMessage && (
                    <SystemAlert
                        message={alertMessage.message}
                        type={alertMessage.type}
                        onClose={() => setAlertMessage(null)}
                    />
                )}

                {/* COMPARISON TOOLTIP */}
                {tooltipData && (
                    <ItemComparisonTooltip
                        hoveredItem={tooltipData.item}
                        equippedItem={getEquippedComparison(tooltipData.item)}
                        position={tooltipData.position}
                    />
                )}
            </div>
        </div>
    )
}
