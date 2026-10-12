"use client";

import { ItemIcon } from "@/components/items/ItemIcon";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

interface PurchaseModalProps {
    item: any;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isPurchasing: boolean;
}

export function PurchaseModal({ item, isOpen, onClose, onConfirm, isPurchasing }: PurchaseModalProps) {
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
                onClick={onClose}
            />

            {/* Modal */}
            <div className={cn(
                "relative bg-slate-950 border-2 rounded-lg w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200",
                colorClass
            )}>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest">System Store</h2>
                        <p className="text-xs text-slate-400 font-mono">CONFIRM TRANSACTION</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex gap-4 mb-8 bg-black/40 p-4 rounded border border-white/5">
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
                            <h3 className="font-bold text-white uppercase">{item.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 italic line-clamp-2 mb-2">
                            {item.description}
                        </p>
                        <div className="flex items-center gap-1 text-yellow-400 font-bold font-mono">
                            <Coins className="w-3 h-3" />
                            {item.price.toLocaleString()} G
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isPurchasing}
                        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPurchasing}
                        className={cn(
                            "px-6 py-2 rounded text-xs font-bold uppercase tracking-wider text-black transition-all flex items-center gap-2",
                            isPurchasing ? "opacity-50 cursor-wait bg-slate-500" : "bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                        )}
                    >
                        {isPurchasing ? "Processing..." : "Confirm Purchase"}
                    </button>
                </div>
            </div>
        </div>
    );
}
