"use client";

import { ItemIcon } from "@/components/items/ItemIcon";
import { cn } from "@/lib/utils";
import { Coins, Sparkles } from "lucide-react";

const TIER_CONFIG: Record<string, { color: string, border: string, bg: string, label: string }> = {
    'COMMON': { color: 'text-slate-400', border: 'border-slate-700', bg: 'bg-slate-900', label: 'Common' },
    'SUPERIOR': { color: 'text-cyan-400', border: 'border-cyan-700', bg: 'bg-cyan-950', label: 'Superior' },
    'LEGENDARY': { color: 'text-purple-400', border: 'border-purple-700', bg: 'bg-purple-950', label: 'Legendary' },
    'PERFECT': { color: 'text-amber-400', border: 'border-amber-600', bg: 'bg-amber-950', label: 'Perfect' },
    'TRANSCENDENT': { color: 'text-red-500', border: 'border-red-600', bg: 'bg-red-950', label: 'Transcendent' },
};

interface SellModalProps {
    item: any;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isSelling: boolean;
    sellPrice: number;
}

export function SellModal({ item, isOpen, onClose, onConfirm, isSelling, sellPrice }: SellModalProps) {
    if (!isOpen || !item) return null;

    const rankColors: Record<string, string> = {
        'E': 'text-slate-400 border-slate-600',
        'D': 'text-cyan-400 border-cyan-600',
        'C': 'text-blue-400 border-blue-600',
        'B': 'text-purple-400 border-purple-600',
        'A': 'text-red-500 border-red-600',
        'S': 'text-yellow-400 border-yellow-500',
        'S+': 'text-orange-400 border-orange-500/50',
        'COSMIC': 'text-pink-500 border-pink-500/50',
    };

    const colorClass = rankColors[item.rarity] || rankColors['E'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={!isSelling ? onClose : undefined}
            />

            {/* Modal */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="sell-item-dialog-title"
                aria-describedby="sell-item-dialog-description"
                aria-busy={isSelling}
                className={cn(
                    "relative bg-slate-950 border-2 rounded-lg w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200",
                    colorClass
                )}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 id="sell-item-dialog-title" className="text-xl font-bold text-white uppercase tracking-widest">System Notification</h2>
                        <p className="text-xs text-slate-400 font-mono">CONFIRM SALE</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex gap-4 mb-6 bg-black/40 p-4 rounded border border-white/5">
                    <div className={cn(
                        "w-16 h-16 rounded border flex items-center justify-center bg-slate-900 shrink-0",
                        colorClass
                    )}>
                        <ItemIcon item={item} className="w-10 h-10" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-bold border px-1 rounded", colorClass)}>
                                {item.rarity}
                            </span>
                            {item.roll_tier && item.roll_tier !== 'COMMON' && (
                                <div className={cn(
                                    "text-[9px] font-bold uppercase px-1 py-0.5 rounded border flex items-center gap-1",
                                    TIER_CONFIG[item.roll_tier]?.color || 'text-slate-400',
                                    TIER_CONFIG[item.roll_tier]?.border || 'border-slate-700',
                                    "bg-black/40"
                                )}>
                                    <Sparkles className="w-2 h-2" />
                                    {item.roll_tier} {item.quality_roll ? `${Math.round(item.quality_roll)}%` : ''}
                                </div>
                            )}
                            <h3 className="font-bold text-white uppercase">{item.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 italic line-clamp-2 mb-2">
                            {item.description}
                        </p>

                        <div className="flex items-center gap-4 text-xs">
                            <div className="text-slate-500 line-through">
                                Original: {item.price} G
                            </div>
                            <div className="flex items-center gap-1 text-yellow-400 font-bold font-mono text-sm">
                                <Coins className="w-4 h-4" />
                                +{sellPrice.toLocaleString()} G
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-950/20 border border-yellow-900/50 p-3 rounded mb-6">
                    <p id="sell-item-dialog-description" className="text-[10px] text-yellow-500 text-center font-mono">
                        WARNING: Sold items cannot be recovered.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSelling}
                        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSelling}
                        className={cn(
                            "px-6 py-2 rounded text-xs font-bold uppercase tracking-wider text-black transition-all flex items-center gap-2",
                            isSelling ? "opacity-50 cursor-wait bg-slate-500" : "bg-yellow-500 hover:bg-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.5)]"
                        )}
                    >
                        {isSelling ? "Processing..." : "Confirm Sale"}
                    </button>
                </div>
            </div>
        </div>
    );
}
