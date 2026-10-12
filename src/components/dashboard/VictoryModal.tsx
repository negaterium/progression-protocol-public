"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Star, Gift, ArrowRight } from "lucide-react";
import { ItemIcon } from "@/components/items/ItemIcon";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";


interface VictoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    bossName: string;
    xpGained: number;
    goldGained: number;
    drops: any[];
}

export function VictoryModal({ isOpen, onClose, bossName, xpGained, goldGained, drops, bossImage }: VictoryModalProps & { bossImage?: string }) {
    const [animateItems, setAnimateItems] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setAnimateItems(true), 500);
            return () => {
                clearTimeout(timer);
                setAnimateItems(false);
            };
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={cn(
                "sm:max-w-xl bg-black/95 border border-blue-900/50 text-white p-0 overflow-hidden",
                "shadow-[0_0_100px_rgba(37,99,235,0.3)] animate-in zoom-in-95 duration-300"
            )}>
                {/* Boss Background Overlay */}
                {bossImage && (
                    <div className="absolute inset-0 z-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bossImage} alt="Boss Background" className="w-full h-full object-cover opacity-20 blur-sm scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-blue-950/50" />
                    </div>
                )}

                {/* Header / Banner */}
                <div className="relative z-10 py-10 text-center overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <Trophy className="w-16 h-16 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-bounce" />

                        <div>
                            <DialogTitle className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-300 drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
                                DUNGEON CLEARED
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Boss {bossName} has been defeated.
                            </DialogDescription>
                            <p className="text-blue-400 text-sm font-mono uppercase tracking-[0.3em] mt-2 font-bold drop-shadow-md">
                                {bossName} Defeated
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-8 pb-8 space-y-6">
                    {/* Primary Rewards (XP & Gold) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-950/40 border border-blue-500/20 p-4 rounded backdrop-blur-sm flex flex-col items-center text-center group hover:bg-blue-900/40 transition-colors">
                            <Star className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-3xl font-bold font-mono text-white shadow-black drop-shadow-md">+{(xpGained ?? 0).toLocaleString()}</div>
                            <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">Experience</div>
                        </div>
                        <div className="bg-yellow-950/20 border border-yellow-500/20 p-4 rounded backdrop-blur-sm flex flex-col items-center text-center group hover:bg-yellow-900/30 transition-colors">
                            <div className="w-6 h-6 rounded-full border-2 border-yellow-500 flex items-center justify-center text-yellow-500 font-bold text-xs mb-2 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                                G
                            </div>
                            <div className="text-3xl font-bold font-mono text-yellow-400 shadow-black drop-shadow-md">+{(goldGained ?? 0).toLocaleString()}</div>
                            <div className="text-[10px] uppercase tracking-wider text-yellow-600 font-bold">Gold</div>
                        </div>
                    </div>

                    {/* Loot Drops */}
                    {drops.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Gift className="w-4 h-4 text-purple-400" />
                                Obtained Items
                            </div>
                            <div className="space-y-3">
                                {drops.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded bg-black/60 border backdrop-blur-md transition-all duration-500 group hover:translate-x-1",
                                            animateItems ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4",
                                            item.rarity === 'COSMIC' ? "border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.15)]" :
                                                item.rarity === 'S+' ? "border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]" :
                                                    item.rarity === 'S' ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
                                                        item.rarity === 'A' ? "border-purple-500/50" :
                                                            item.rarity === 'B' ? "border-blue-500/50" : "border-slate-800"
                                        )}
                                        style={{ transitionDelay: `${idx * 150}ms` }}
                                    >
                                        <div className={cn(
                                            "w-12 h-12 rounded bg-black border flex items-center justify-center shrink-0 relative overflow-hidden",
                                            item.rarity === 'COSMIC' ? "border-pink-500" :
                                                item.rarity === 'S+' ? "border-orange-500" :
                                                    item.rarity === 'S' ? "border-red-500" :
                                                        item.rarity === 'A' ? "border-purple-500" : "border-slate-700"
                                        )}>
                                            <ItemIcon item={item} className="w-8 h-8 relative z-10" />
                                            {['S', 'S+', 'COSMIC'].includes(item.rarity) && (
                                                <div className={cn(
                                                    "absolute inset-0 animate-pulse",
                                                    item.rarity === 'COSMIC' ? "bg-pink-500/10" :
                                                        item.rarity === 'S+' ? "bg-orange-500/10" : "bg-red-500/10"
                                                )} />
                                            )}
                                        </div>
                                        <div>
                                            <div className={cn(
                                                "font-bold text-base group-hover:text-white transition-colors",
                                                item.rarity === 'COSMIC' ? "text-pink-400" :
                                                    item.rarity === 'S+' ? "text-orange-400" :
                                                        item.rarity === 'S' ? "text-red-400" :
                                                            item.rarity === 'A' ? "text-purple-400" : "text-slate-300"
                                            )}>
                                                {item.name}
                                                {item.auto_sold && <span className="ml-2 text-[8px] px-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded uppercase font-black">Sold</span>}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                {item.auto_sold ? `Automatically converted to ${item.sold_for || 0} Gold` : `${item.rarity}-Rank Item`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer / Action */}
                    <button
                        onClick={onClose}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] text-sm rounded transition-all flex items-center justify-center gap-3 group shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_50px_rgba(37,99,235,0.6)] border border-blue-400"
                    >
                        Return to Lobby
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
