"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StoreItemCard } from "@/components/store/StoreItemCard";
import { Search, Trophy, LayoutGrid, Sword, Shield, Gem, FlaskConical, Ticket, ShoppingBasket } from "lucide-react";
import { purchaseItemAction } from "@/app/actions/store";
import { ItemComparisonTooltip } from "@/components/inventory/ItemComparisonTooltip";
import { useSystemNotification } from "@/components/system/NotificationProvider";

interface StoreInterfaceProps {
    items: any[];
    userGold: number;
    userLevel: number;
    storeDiscount: number;
    equippedItems: any;
}

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'S+', 'XX', 'COSMIC'];

export function StoreInterface({ items, userGold, userLevel, storeDiscount, equippedItems }: StoreInterfaceProps) {
    const { showNotification } = useSystemNotification();
    const [activeRank, setActiveRank] = useState("E");
    const [activeType, setActiveType] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    const [purchasingId, setPurchasingId] = useState<number | string | null>(null);

    const handlePurchaseRequest = async (item: any, quantity: number) => {
        // Direct 1-click buy
        const itemId = item.id;
        const qty = Number(quantity);

        setPurchasingId(itemId);
        try {
            await purchaseItemAction(itemId, qty);
            // Success
            window.dispatchEvent(new Event('progression_protocol_update'));

            showNotification({
                title: "ITEM PURCHASED",
                message: `Successfully bought ${quantity}x ${item.name}`,
                type: 'SUCCESS',
                item: item
            });

        } catch (error: any) {
            showNotification({
                title: "TRANSACTION FAILED",
                message: error.message || "Insufficient funds.",
                type: 'ERROR'
            });
            // Also keep alert for major errors? Or just notification? Notification is better.
        } finally {
            setPurchasingId(null);
        }
    };

    // Filter by Rank
    const rankItems = items.filter(item => item.rarity === activeRank);

    // Filter by Type
    const typeItems = activeType === 'ALL'
        ? rankItems
        : rankItems.filter(item => {
            if (activeType === 'WEAPON') return item.type === 'EQUIPMENT' && ['MAIN_HAND', 'OFF_HAND'].includes(item.slot);
            if (activeType === 'ARMOR') return item.type === 'EQUIPMENT' && ['HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS'].includes(item.slot);
            if (activeType === 'ACCESSORY') return item.type === 'EQUIPMENT' && item.slot === 'ACCESSORY';
            return item.type === activeType;
        });

    // Apply Search
    const filteredItems = typeItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group by Type (for rendering categories)
    const consumables = filteredItems.filter(i => i.type === 'CONSUMABLE');
    const weapons = filteredItems.filter(i => i.type === 'EQUIPMENT' && ['MAIN_HAND', 'OFF_HAND'].includes(i.slot));
    const armor = filteredItems.filter(i => i.type === 'EQUIPMENT' && ['HEAD', 'CHEST', 'LEGS', 'FEET', 'HANDS'].includes(i.slot));
    const accessories = filteredItems.filter(i => i.type === 'EQUIPMENT' && i.slot === 'ACCESSORY');
    const keys = filteredItems.filter(i => i.type === 'KEY');

    // Categorization helper for clean rendering
    const categories = [
        { title: "CONSUMABLES", items: consumables, color: "text-blue-500", type: 'CONSUMABLE' },
        { title: "WEAPONS", items: weapons, color: "text-red-500", type: 'WEAPON' },
        { title: "ARMOR", items: armor, color: "text-green-500", type: 'ARMOR' },
        { title: "ACCESSORIES", items: accessories, color: "text-purple-500", type: 'ACCESSORY' },
        { title: "DUNGEON KEYS", items: keys, color: "text-yellow-500", type: 'KEY' },
    ];

    // Filter categories to render based on activeType if not ALL, or just use filteredItems results
    // Actually the filteredItems logic above handles the content, so categories with 0 items won't render due to the check below.
    // But we might want to ensure 'ALL' order is preserved or specific type view is clean.
    // The existing map implementation `cat.items.length > 0` handles it perfectly.

    // Tooltip Logic (Replicated from InventoryGrid)
    const [tooltipData, setTooltipData] = useState<{ item: any, position: { x: number, y: number } } | null>(null);

    const handleMouseEnter = (e: React.MouseEvent, item: any) => {
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

    const getEquippedComparison = (hoveredItem: any) => {
        if (!equippedItems || hoveredItem.type !== 'EQUIPMENT') return null;

        // 1. Explicit slot logic
        const slot = hoveredItem.slot || hoveredItem.effect?.slot;

        if (slot && equippedItems[slot]) {
            return equippedItems[slot];
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Purchase Confirmation Modal */}
            {/* Purchase Modal Removed */}

            {/* Controls */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    {/* Rank Tabs */}
                    <div className="flex bg-black/40 p-1 rounded-lg border border-white/10 overflow-x-auto w-full md:w-auto">
                        {RANKS.map(rank => (
                            <button
                                key={rank}
                                type="button"
                                aria-pressed={activeRank === rank}
                                onClick={() => setActiveRank(rank)}
                                className={cn(
                                    "px-6 py-2 rounded text-sm font-bold font-mono transition-all uppercase whitespace-nowrap flex items-center gap-2",
                                    activeRank === rank
                                        ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                                        : "text-slate-500 hover:text-cyan-400 hover:bg-white/5"
                                )}
                            >
                                <Trophy className="w-3 h-3" />
                                {rank}-Rank
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search current rank..."
                            aria-label="Search store items in current rank"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-10 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Type Sub-Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/5">
                    {([
                        { id: 'ALL', icon: LayoutGrid },
                        { id: 'WEAPON', icon: Sword },
                        { id: 'ARMOR', icon: Shield },
                        { id: 'ACCESSORY', icon: Gem },
                        { id: 'CONSUMABLE', icon: FlaskConical },
                        { id: 'KEY', icon: Ticket },
                    ] as const).map(type => (
                        <button
                            key={type.id}
                            type="button"
                            aria-pressed={activeType === type.id}
                            onClick={() => setActiveType(type.id)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all uppercase whitespace-nowrap border flex items-center gap-2",
                                activeType === type.id
                                    ? "bg-white/10 text-cyan-400 border-cyan-500/50"
                                    : "text-slate-500 border-transparent hover:text-cyan-300 hover:bg-white/5"
                            )}
                        >
                            <type.icon className="w-3 h-3" />
                            {type.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500" key={`${activeRank}-${activeType}`}>
                {categories.map((cat) => (
                    cat.items.length > 0 && (
                        <section key={cat.title}>
                            <h3 className="text-sm font-bold text-slate-400 mb-4 border-b border-white/5 pb-2 flex items-center gap-2 tracking-widest">
                                <span className={cn("w-2 h-2 rounded-full bg-current", cat.color)} />
                                {cat.title} <span className="text-slate-600 ml-auto text-[10px] uppercase font-normal">{cat.items.length} Items</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {cat.items.map(item => (
                                    <StoreItemCard
                                        key={item.id}
                                        item={item}
                                        userLevel={userLevel}
                                        userGold={userGold}
                                        storeDiscount={storeDiscount}
                                        isPurchasing={purchasingId === item.id}
                                        onPurchase={(qty: number) => { void handlePurchaseRequest(item, qty); }}
                                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                                        onMouseLeave={handleMouseLeave}
                                        onMouseMove={handleMouseMove}
                                    />
                                ))}
                            </div>
                        </section>
                    )
                ))}

                {filteredItems.length === 0 && (
                    <div role="status" className="text-center py-20 text-slate-600 font-mono flex flex-col items-center gap-4">
                        <ShoppingBasket className="w-12 h-12 opacity-20" />
                        NO ITEMS FOUND FOR {activeRank}-RANK {activeType !== 'ALL' ? `(${activeType})` : ''} MATCHING CRITERIA.
                    </div>
                )}
            </div>

            {/* Comparison Tooltip */}
            {tooltipData && (
                <ItemComparisonTooltip
                    hoveredItem={tooltipData.item}
                    equippedItem={getEquippedComparison(tooltipData.item)}
                    position={tooltipData.position}
                />
            )}
        </div>
    );
}
