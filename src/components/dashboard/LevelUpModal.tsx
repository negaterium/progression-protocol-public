"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpCircle, Trophy, ShieldAlert, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface LevelUpModalProps {
    newLevel: number;
    isOpen: boolean;
    onClose: () => void;
}

export function LevelUpModal({ newLevel, isOpen, onClose }: LevelUpModalProps) {
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
            <DialogContent
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                className={cn(
                    "sm:max-w-md bg-black/95 border border-cyan-500/50 text-white p-0 overflow-hidden",
                    "shadow-[0_0_100px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-500"
                )}>
                {/* Background Effects */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/20 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-cyan-950/40" />
                </div>

                {/* Header / Banner */}
                <div className="relative z-10 py-8 text-center overflow-hidden border-b border-cyan-500/20 bg-cyan-950/20 backdrop-blur-md">
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <ArrowUpCircle className="w-14 h-14 text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-bounce" />

                        <div>
                            <DialogTitle className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] pb-1">
                                LEVEL UP
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                You have reached level {newLevel}.
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-8 py-6 space-y-6">

                    {/* Level Transition Indicator */}
                    <div className="flex items-center justify-center gap-6 text-4xl font-mono text-cyan-400 font-bold">
                        <span className="opacity-50">LV. {newLevel - 1}</span>
                        <ChevronRight className="w-8 h-8 text-cyan-600 animate-pulse" />
                        <span className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] scale-110">LV. {newLevel}</span>
                    </div>

                    {/* Stats Gained List */}
                    <div className="space-y-3 pt-4 border-t border-cyan-500/20">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                            <Trophy className="w-4 h-4" />
                            System Rewards
                        </div>

                        {/* AP & SP (Staggered Animation) */}
                        <div className={cn(
                            "flex items-center justify-between p-3 rounded bg-cyan-950/30 border border-cyan-500/30 transition-all duration-500",
                            animateItems ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        )} style={{ transitionDelay: '150ms' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-cyan-900/50 flex items-center justify-center border border-cyan-500/50 text-cyan-300 font-bold">AP</div>
                                <div>
                                    <div className="font-bold text-sm text-white">Stat Points</div>
                                    <div className="text-[10px] text-cyan-500 font-mono">Available Points</div>
                                </div>
                            </div>
                            <div className="text-xl font-bold font-mono text-cyan-300 drop-shadow-md">+5</div>
                        </div>

                        <div className={cn(
                            "flex items-center justify-between p-3 rounded bg-blue-950/30 border border-blue-500/30 transition-all duration-500",
                            animateItems ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        )} style={{ transitionDelay: '300ms' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-blue-900/50 flex items-center justify-center border border-blue-500/50 text-blue-300 font-bold">SP</div>
                                <div>
                                    <div className="font-bold text-sm text-white">Skill Points</div>
                                    <div className="text-[10px] text-blue-500 font-mono">Skill Enhancement</div>
                                </div>
                            </div>
                            <div className="text-xl font-bold font-mono text-blue-300 drop-shadow-md">+1</div>
                        </div>

                        <div className={cn(
                            "flex items-center justify-between p-3 rounded bg-emerald-950/30 border border-emerald-500/30 transition-all duration-500",
                            animateItems ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        )} style={{ transitionDelay: '450ms' }}>
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-8 h-8 p-1.5 rounded bg-emerald-900/50 border border-emerald-500/50 text-emerald-300" />
                                <div>
                                    <div className="font-bold text-sm text-white">Status Recovery</div>
                                    <div className="text-[10px] text-emerald-500 font-mono uppercase">Fatigue Reset</div>
                                </div>
                            </div>
                            <div className="text-xl font-bold font-mono text-emerald-400 drop-shadow-md">FULL</div>
                        </div>
                    </div>

                    {/* Footer / Action */}
                    <button
                        onClick={onClose}
                        className="w-full mt-4 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-[0.2em] text-sm rounded transition-all flex items-center justify-center gap-3 group shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] border border-cyan-400"
                    >
                        Accept Rewards
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

