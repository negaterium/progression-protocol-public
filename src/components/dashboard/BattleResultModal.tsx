"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ItemIcon } from "@/components/items/ItemIcon";
import { Trophy, Coins, Star } from "lucide-react";

interface BattleResultModalProps {
    result: {
        success: boolean;
        bossName: string;
        xp: number;
        gold: number;
        drops: any[];
        error?: string;
    };
    onClose: () => void;
}

export function BattleResultModal({ result, onClose }: BattleResultModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [counterXp, setCounterXp] = useState(0);
    const [counterGold, setCounterGold] = useState(0);
    const [showDrops, setShowDrops] = useState(false);

    useEffect(() => {
        setIsVisible(true);

        // Animate Counters
        const duration = 1500; // ms
        const steps = 30;
        const stepTime = duration / steps;

        let step = 0;
        const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            setCounterXp(Math.floor(result.xp * progress));
            setCounterGold(Math.floor(result.gold * progress));

            if (step >= steps) {
                clearInterval(timer);
                setCounterXp(result.xp);
                setCounterGold(result.gold);
                setTimeout(() => setShowDrops(true), 300);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [result]);

    if (!result.success && result.error) {
        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                <div className="bg-red-950/20 border border-red-900 p-8 rounded-lg max-w-md text-center">
                    <h2 className="text-2xl font-bold text-red-500 mb-2">BATTLE FAILED</h2>
                    <p className="text-red-200">{result.error}</p>
                    <button onClick={onClose} className="mt-6 px-6 py-2 bg-red-900/50 hover:bg-red-800 rounded text-white font-mono">CLOSE</button>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className={cn("absolute inset-0 bg-black/90 transition-opacity duration-500", isVisible ? "opacity-100" : "opacity-0")}
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={cn(
                "relative bg-black border border-cyan-900/50 rounded-xl w-full max-w-lg overflow-hidden transition-all duration-500 transform",
                isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
            )}>
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-950 to-cyan-950 p-6 text-center border-b border-cyan-500/30">
                    <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2 animate-bounce" />
                    <h2 className="text-3xl font-bold text-white uppercase tracking-widest text-glow-cyan">
                        DUNGEON CLEARED
                    </h2>
                    <p className="text-cyan-400 font-mono text-sm mt-1 uppercase">
                        TARGET ELIMINATED: <span className="text-white font-bold">{result.bossName}</span>
                    </p>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8">
                    {/* Rewards Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-4 flex flex-col items-center justify-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400">
                                <Star className="w-6 h-6 fill-current" />
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-blue-300 font-mono uppercase">Reference XP</div>
                                <div className="text-2xl font-bold text-white tabular-nums">+{counterXp.toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-lg p-4 flex flex-col items-center justify-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-yellow-900/30 flex items-center justify-center text-yellow-500">
                                <Coins className="w-6 h-6 fill-current" />
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-yellow-500 font-mono uppercase">Gold Acquired</div>
                                <div className="text-2xl font-bold text-white tabular-nums">+{counterGold.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    {/* Drops Section */}
                    {result.drops && result.drops.length > 0 && (
                        <div className={cn(
                            "space-y-4 transition-all duration-500 delay-300",
                            showDrops ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        )}>
                            <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-900 to-transparent" />
                                <h3 className="text-cyan-400 font-mono font-bold tracking-widest text-sm uppercase">Acquired Items</h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-900 to-transparent" />
                            </div>

                            <div className="flex flex-wrap justify-center gap-4">
                                {result.drops.map((item, i) => (
                                    <div key={i} className="group relative flex flex-col items-center gap-2 animate-in zoom-in duration-300" style={{ animationDelay: `${i * 150}ms` }}>
                                        <div className={cn(
                                            "w-16 h-16 rounded border-2 bg-black/50 flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-110",
                                            getRankBorderColor(item.rarity)
                                        )}>
                                            <ItemIcon item={item} className="w-8 h-8" />
                                            {/* Glow */}
                                            <div className={cn("absolute inset-0 opacity-20 group-hover:opacity-40", getRankBgColor(item.rarity))} />
                                            {item.auto_sold && (
                                                <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                                                    <span className="text-[8px] font-black text-yellow-500 bg-black/80 px-1 py-0.5 rounded border border-yellow-500/50">SOLD</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <div className={cn("text-xs font-bold", getRankTextColor(item.rarity))}>{item.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">
                                                {item.auto_sold ? "AUTO-SOLD" : `${item.rarity}-Rank`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/50 border-t border-white/10 flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono tracking-wider rounded transition-all hover:shadow-[0_0_20px_rgba(8,145,178,0.5)]"
                    >
                        CONFIRM
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Helpers (Duplicated slightly from other comps, good for utility file later)
function getRankBorderColor(rank: string) {
    if (rank === 'S') return 'border-yellow-500';
    if (rank === 'A') return 'border-red-500';
    if (rank === 'B') return 'border-purple-500';
    if (rank === 'C') return 'border-blue-500';
    return 'border-slate-600';
}
function getRankBgColor(rank: string) {
    if (rank === 'S') return 'bg-yellow-500';
    if (rank === 'A') return 'bg-red-500';
    if (rank === 'C') return 'bg-blue-500';
    return 'bg-slate-500';
}

function getRankTextColor(rank: string) {
    if (rank === 'S') return 'text-yellow-500';
    if (rank === 'A') return 'text-red-500';
    if (rank === 'C') return 'text-blue-500';
    return 'text-white';
}
