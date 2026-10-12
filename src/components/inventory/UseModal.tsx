"use client";

import { ItemIcon } from "@/components/items/ItemIcon";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import { formatItemEffects } from "@/utils/item-effects";

interface UseModalProps {
    item: any;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isUsing: boolean;
}

export function UseModal({ item, isOpen, onClose, onConfirm, isUsing }: UseModalProps) {
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
    const effects = formatItemEffects(item.effect);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={!isUsing ? onClose : undefined}
            />

            {/* Modal */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="use-item-dialog-title"
                aria-describedby="use-item-dialog-description"
                aria-busy={isUsing}
                className={cn(
                    "relative bg-slate-950 border-2 rounded-lg w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200",
                    colorClass
                )}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 id="use-item-dialog-title" className="text-xl font-bold text-white uppercase tracking-widest">System Notification</h2>
                        <p className="text-xs text-slate-400 font-mono">CONFIRM USAGE</p>
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
                            <h3 className="font-bold text-white uppercase">{item.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 italic line-clamp-2 mb-2">
                            {item.description}
                        </p>

                        {/* Effects Display */}
                        {effects.length > 0 && (
                            <div className="space-y-1 mt-2">
                                <span className="text-[10px] uppercase text-slate-500 font-bold">Effects:</span>
                                {effects.map((eff, i) => (
                                    <div key={i} className="text-xs text-cyan-300 font-mono flex items-center gap-1">
                                        <Zap className="w-3 h-3 text-cyan-500" />
                                        {eff}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-green-950/20 border border-green-900/50 p-3 rounded mb-6">
                    <p id="use-item-dialog-description" className="text-[10px] text-green-500 text-center font-mono">
                        This item will be consumed upon use.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUsing}
                        className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isUsing}
                        className={cn(
                            "px-6 py-2 rounded text-xs font-bold uppercase tracking-wider text-black transition-all flex items-center gap-2",
                            isUsing ? "opacity-50 cursor-wait bg-slate-500" : "bg-green-500 hover:bg-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                        )}
                    >
                        {isUsing ? "Activating..." : "Confirm Use"}
                    </button>
                </div>
            </div>
        </div>
    );
}
