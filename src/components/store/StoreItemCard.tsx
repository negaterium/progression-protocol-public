"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Coins, ShoppingBag, Minus, Plus, Loader2 } from "lucide-react";
import { ItemIcon } from "@/components/items/ItemIcon";

import { formatItemEffects } from "@/utils/item-effects";

const MAX_PURCHASE_QUANTITY = 1000;

interface StoreItemProps {
    item: {
        id: number | string;
        name: string;
        description: string | null;
        type: string;
        rarity: string;
        price: number;
        effect: any;
    };
    userLevel: number;
    userGold: number;
    isPurchasing?: boolean;
    storeDiscount?: number;
    onPurchase: (quantity: number) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
    onMouseMove?: (e: React.MouseEvent) => void;
}

export function StoreItemCard({ item, userGold, userLevel, isPurchasing, storeDiscount, onPurchase, onMouseEnter, onMouseLeave, onMouseMove }: StoreItemProps) {
    const [quantity, setQuantity] = useState(1);

    // Stackable items can be bought in bulk (consumables and keys)
    const isStackable = ['CONSUMABLE', 'KEY'].includes(item.type);

    // Bulk purchases and Discounts
    const discountMultiplier = 1 - (storeDiscount || 0);
    const unitPrice = Math.floor(item.price * discountMultiplier);
    const totalPrice = unitPrice * quantity;
    const canAfford = userGold >= totalPrice;
    const isDiscounted = (storeDiscount || 0) > 0;
    const effects = formatItemEffects(item.effect, (item as any).scale_factor);

    // Level Gating Logic
    let requiredLevel = 0;
    if (item.rarity === 'S') requiredLevel = 40;
    else if (item.rarity === 'S+') requiredLevel = 80;
    else if (item.rarity === 'XX') requiredLevel = 90;
    else if (item.rarity === 'COSMIC') requiredLevel = 100;
    if (item.name === 'Ring of the Monarch') requiredLevel = 100;

    const isLevelLocked = userLevel < requiredLevel;
    const canBuy = canAfford && !isLevelLocked && !isPurchasing;

    const rankColors: Record<string, string> = {
        'E': 'text-slate-400 border-slate-700/50',
        'D': 'text-cyan-400 border-cyan-700/50',
        'C': 'text-blue-400 border-blue-700/50',
        'B': 'text-purple-400 border-purple-700/50',
        'A': 'text-red-400 border-red-700/50',
        'S': 'text-yellow-400 border-yellow-700/50',
        'S+': 'text-orange-400 border-orange-500/50',
        'XX': 'text-violet-400 border-violet-500/50',
        'COSMIC': 'text-pink-500 border-pink-500/50',
    };

    const handleQuantityChange = (delta: number) => {
        setQuantity(prev => Math.max(1, prev + delta));
    };

    return (
        <div
            data-price={item.price}
            data-discount={storeDiscount}
            data-unitprice={unitPrice}
            aria-busy={isPurchasing}
            className={cn(
                "bg-slate-950/50 border rounded-lg p-4 flex flex-col group hover:bg-slate-900/80 transition-all relative overflow-hidden",
                rankColors[item.rarity] || rankColors['E'],
                isLevelLocked && "opacity-75 grayscale-[0.5]"
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseMove={onMouseMove}
        >
            {/* Background Icon Watermark */}
            <div aria-hidden="true" className="absolute -right-4 -bottom-4 opacity-5 rotate-12 pointer-events-none text-white">
                <ItemIcon item={item} className="w-32 h-32" />
            </div>

            {/* Level Lock Overlay Hint */}
            {isLevelLocked && (
                <div className="absolute top-2 right-2 bg-red-950/80 border border-red-500/50 px-2 py-0.5 rounded text-[8px] font-bold text-red-500 z-20 animate-pulse uppercase tracking-tighter">
                    Locked: LVL {requiredLevel}
                </div>
            )}

            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex gap-4">
                    <div className={cn(
                        "w-20 h-20 rounded-md flex items-center justify-center border bg-black/40 flex-shrink-0 overflow-hidden",
                        rankColors[item.rarity] || rankColors['E']
                    )}>
                        <ItemIcon item={item} className="w-full h-full" />
                    </div>
                    <div>
                        <h3 className="font-bold font-sans uppercase tracking-wide text-white text-sm leading-tight">{item.name}</h3>
                        <span className={cn("text-[9px] font-mono border px-1 py-px rounded inline-block mt-1", rankColors[item.rarity] || rankColors['E'])}>
                            RANK {item.rarity}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Preview using formatItemEffects */}
            {effects.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 relative z-10">
                    {effects.map((eff, i) => {
                        const isPrimary = eff.includes("⚔️") || eff.includes("🛡️");
                        if (!isPrimary && i > 2) return null; // Limit visible secondary stats
                        return (
                            <span key={i} className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                isPrimary ? "bg-white/10 text-white font-bold border border-white/20" : "bg-cyan-950/30 text-cyan-400 border border-cyan-900/30"
                            )}>
                                {eff}
                            </span>
                        )
                    })}
                </div>
            )}

            <p className="text-xs text-slate-400 mb-4 flex-1 line-clamp-3 relative z-10 pl-1">
                {item.description}
            </p>

            <div className="mt-auto border-t border-white/5 pt-3 flex items-center justify-between gap-2">
                {/* Quantity Selector for Stackable Items */}
                {isStackable ? (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label={`Decrease ${item.name} quantity`}
                            onClick={() => handleQuantityChange(-1)}
                            disabled={quantity <= 1 || isPurchasing}
                            className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors",
                                quantity > 1 && !isPurchasing
                                    ? "bg-slate-700 text-white hover:bg-slate-600"
                                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                            )}
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-white text-sm">
                            {quantity}
                        </span>
                        <button
                            type="button"
                            aria-label={`Increase ${item.name} quantity`}
                            onClick={() => handleQuantityChange(1)}
                            disabled={isPurchasing || quantity >= MAX_PURCHASE_QUANTITY}
                            className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors",
                                !isPurchasing
                                    ? "bg-slate-700 text-white hover:bg-slate-600"
                                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                            )}
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {isLevelLocked && (
                            <span className="text-[8px] text-red-500/70 font-mono uppercase">Requires Level {requiredLevel}</span>
                        )}
                    </div>
                )}

                {/* Price & Buy Button */}
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        {isDiscounted && (
                            <span className="font-mono text-[10px] text-slate-500 line-through">
                                {(item.price * quantity).toLocaleString()}G
                            </span>
                        )}
                        <span className={cn("font-mono font-bold flex items-center gap-1 text-sm", canAfford ? "text-yellow-400" : "text-red-500")}>
                            <Coins className="w-3 h-3" /> {totalPrice.toLocaleString()}
                        </span>
                    </div>

                    <button
                        type="button"
                        aria-label={isLevelLocked
                            ? `${item.name} locked until level ${requiredLevel}`
                            : `Buy ${quantity} ${item.name} for ${totalPrice.toLocaleString()} Gold`}
                        onClick={() => onPurchase(quantity)}
                        disabled={!canBuy}
                        className={cn(
                            "px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors min-w-[70px] justify-center",
                            canBuy
                                ? "bg-cyan-600 text-white hover:bg-cyan-500"
                                : "bg-slate-800 text-slate-600 cursor-not-allowed"
                        )}
                    >
                        {isPurchasing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <>
                                <ShoppingBag className="w-3 h-3" /> {isLevelLocked ? "Locked" : "Buy"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
