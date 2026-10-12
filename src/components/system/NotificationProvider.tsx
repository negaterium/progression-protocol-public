"use strict";
"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { Trophy, CheckCircle, Zap, AlertTriangle, Sparkles, Coins, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SystemNotification {
    id: string;
    title: string;
    message: string;
    type: 'ACHIEVEMENT' | 'LEVEL_UP' | 'QUEST_COMPLETE' | 'ITEM' | 'WARNING' | 'SUCCESS' | 'ERROR';
    xp?: number;
    gold?: number;
    item?: any;
    rarity?: string;
}

interface NotificationContextType {
    showNotification: (notification: Omit<SystemNotification, "id">) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useSystemNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useSystemNotification must be used within a NotificationProvider");
    }
    return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [mounted, setMounted] = useState(false);

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const showNotification = useCallback((notification: Omit<SystemNotification, "id">) => {
        const id = Math.random().toString(36).substring(7);
        const newNotification = { ...notification, id };

        setNotifications(prev => [...prev, newNotification]);

        // Auto Dismiss
        setTimeout(() => {
            removeNotification(id);
        }, 5000); // 5 seconds duration
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleCustomEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                // Map achievement event to ITEM type if it contains loot-like data or keep as is
                // For 'solo_achievement' we usually get Achievement/LevelUp notifications
                showNotification(detail);
            }
        };

        const handleLootEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.item) {
                showNotification({
                    title: detail.title || "ITEM ACQUIRED",
                    message: detail.message || detail.item.description || "A new item has been added to your inventory.",
                    type: 'ITEM',
                    item: detail.item,
                    rarity: detail.item.rarity
                });
            }
        };

        window.addEventListener('solo_achievement', handleCustomEvent);
        window.addEventListener('solo_loot_drop', handleLootEvent);
        return () => {
            window.removeEventListener('solo_achievement', handleCustomEvent);
            window.removeEventListener('solo_loot_drop', handleLootEvent);
        };
    }, [showNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            {mounted && createPortal(
                <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none flex flex-col items-end gap-3 w-full max-w-[440px]">
                    {notifications.map((n) => (
                        <SystemToast key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
                    ))}
                </div>,
                document.body
            )}
        </NotificationContext.Provider>
    );
}

import { X } from "lucide-react";
import { ItemIcon } from "@/components/items/ItemIcon";
import { formatItemEffects } from "@/utils/item-effects";
import { sellItemAction } from "@/app/actions/inventory";

function SystemToast({ notification, onClose }: { notification: SystemNotification, onClose: () => void }) {
    const isAchievement = notification.type === 'ACHIEVEMENT';
    const isLevelUp = notification.type === 'LEVEL_UP';
    const isWarning = notification.type === 'WARNING';
    const isItem = notification.type === 'ITEM' || !!notification.item;

    const [isSelling, setIsSelling] = useState(false);
    const { showNotification } = useSystemNotification();

    const handleSell = async () => {
        if (!notification.item?.inventory_id || isSelling) return;

        setIsSelling(true);
        try {
            const res = await sellItemAction(notification.item.inventory_id);
            if (res.data) {
                // Show success notification & trigger dashboard refresh
                const goldEarned = res.data.goldEarned || notification.item.price * 0.75;
                showNotification({
                    title: "ITEM SOLD",
                    message: res.data.message || `Sold ${notification.item.name} for ${goldEarned} Gold`,
                    type: 'SUCCESS',
                    gold: goldEarned
                });
                onClose(); // Hide current toast so it disappears immediately

                // Dispatch event to force dashboard update (gold/inventory)
                window.dispatchEvent(new CustomEvent('solo_gold_refresh', { detail: { amount: goldEarned } }));
            } else if (res.error) {
                if (res.error === "Item unavailable") {
                    // This happens if the user double-clicks rapidly or clicks a duplicate stack notification
                    onClose();
                } else {
                    console.error("Sell failed:", res.error);
                    showNotification({
                        title: "SALE FAILED",
                        message: res.error,
                        type: 'ERROR'
                    });
                }
            }
        } catch (err) {
            console.error("Sell exception:", err);
        } finally {
            setIsSelling(false);
        }
    };

    const rankColors: Record<string, string> = {
        'E': 'text-slate-400 border-slate-600 bg-slate-950/90',
        'D': 'text-cyan-400 border-cyan-500 bg-cyan-950/90 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
        'C': 'text-blue-400 border-blue-500 bg-blue-950/90 shadow-[0_0_20px_rgba(59,130,246,0.1)]',
        'B': 'text-purple-400 border-purple-500 bg-purple-950/90 shadow-[0_0_30px_rgba(147,51,234,0.15)]',
        'A': 'text-red-500 border-red-500 bg-red-950/90 shadow-[0_0_40px_rgba(220,38,38,0.2)]',
        'S': 'text-yellow-400 border-yellow-500 bg-yellow-950/90 shadow-[0_0_50px_rgba(234,179,8,0.3)]',
        'S+': 'text-orange-400 border-orange-500 bg-orange-950/90 shadow-[0_0_50px_rgba(251,146,60,0.3)]',
        'XX': 'text-violet-400 border-violet-500 bg-violet-950/90 shadow-[0_0_50px_rgba(139,92,246,0.3)]',
        'COSMIC': 'text-pink-500 border-pink-500 bg-pink-950/90 shadow-[0_0_50px_rgba(236,72,153,0.3)]',
    };

    const TIER_CONFIG: Record<string, { color: string, border: string, bg: string, label: string }> = {
        'COMMON': { color: 'text-slate-400', border: 'border-slate-700', bg: 'bg-slate-900', label: 'Common' },
        'SUPERIOR': { color: 'text-cyan-400', border: 'border-cyan-700', bg: 'bg-cyan-950', label: 'Superior' },
        'LEGENDARY': { color: 'text-purple-400', border: 'border-purple-700', bg: 'bg-purple-950', label: 'Legendary' },
        'PERFECT': { color: 'text-amber-400', border: 'border-amber-600', bg: 'bg-amber-950', label: 'Perfect' },
        'TRANSCENDENT': { color: 'text-red-500', border: 'border-red-600', bg: 'bg-red-950', label: 'Transcendent' },
    };

    const rarity = notification.rarity || notification.item?.rarity || 'E';
    const colorClass = rankColors[rarity] || 'border-slate-700';

    return (
        <div className={cn(
            "relative pointer-events-auto flex flex-col w-full overflow-hidden",
            "bg-black/95 backdrop-blur-xl border-l-4 shadow-2xl rounded-sm",
            isAchievement ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]" :
                isLevelUp ? "border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.1)]" :
                    isWarning ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
                        isItem ? colorClass : "border-slate-700",
            "animate-in fade-in slide-in-from-right-8 duration-500 ease-out"
        )}>
            {/* Close Button */}
            <button onClick={onClose} className="absolute top-2 right-2 text-white/10 hover:text-white transition-colors z-10">
                <X className="w-4 h-4" />
            </button>

            {/* Background Grid */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />

            <div className="p-4 flex gap-4">
                {/* Icon Section */}
                <div className={cn(
                    "w-14 h-14 flex items-center justify-center shrink-0 rounded border bg-black/40",
                    isAchievement ? "border-amber-500/30 text-amber-500" :
                        isLevelUp ? "border-cyan-500/30 text-cyan-500" :
                            isWarning ? "border-red-500/30 text-red-500" :
                                isItem ? colorClass.replace('bg-', 'border-').split(' ')[1] : "border-slate-700 text-slate-400"
                )}>
                    {isAchievement ? <Trophy className="w-8 h-8 animate-pulse" /> :
                        isLevelUp ? <Zap className="w-8 h-8 animate-pulse" /> :
                            isWarning ? <AlertTriangle className="w-8 h-8 animate-pulse" /> :
                                isItem ? <ItemIcon item={notification.item} className="w-10 h-10" /> :
                                    <CheckCircle className="w-8 h-8" />}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                    <div className={cn(
                        "text-[10px] font-mono tracking-[0.2em] uppercase mb-1",
                        isAchievement ? "text-amber-500" :
                            isLevelUp ? "text-cyan-500" :
                                isWarning ? "text-red-500" :
                                    isItem ? colorClass.split(' ')[0] : "text-slate-500"
                    )}>
                        {isAchievement ? "ACHIEVEMENT UNLOCKED" :
                            isLevelUp ? "LEVEL UP" :
                                isWarning ? "SYSTEM WARNING" :
                                    isItem ? `${rarity}-RANK DROP` : "SYSTEM NOTIFICATION"}
                    </div>

                    <h3 className="text-base font-black text-white font-sans uppercase tracking-tight leading-tight whitespace-normal mb-1">
                        {notification.title}
                    </h3>

                    <p className="text-xs text-slate-400 font-mono leading-snug whitespace-normal">
                        {notification.message}
                    </p>

                    {/* Rich Item Details */}
                    {isItem && notification.item && notification.item.roll_tier && notification.item.roll_tier !== 'COMMON' && (
                        <div className={cn(
                            "text-[9px] font-bold uppercase mt-2 mb-1 w-fit px-1.5 py-0.5 rounded border flex items-center gap-1",
                            TIER_CONFIG[notification.item.roll_tier]?.color || 'text-slate-400',
                            TIER_CONFIG[notification.item.roll_tier]?.border || 'border-slate-700',
                            "bg-black/40"
                        )}>
                            <Sparkles className="w-3 h-3" />
                            {notification.item.roll_tier} {notification.item.quality_roll ? `${Math.round(notification.item.quality_roll)}%` : ''}
                        </div>
                    )}

                    {/* Rich Item Details */}
                    {isItem && notification.item && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                            {/* Effects */}
                            {/* Validate effects exist and contain meaningful data */}
                            {((notification.item.effect && Object.keys(notification.item.effect).length > 0) ||
                                (notification.item.effects && Object.keys(notification.item.effects).length > 0)) && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {formatItemEffects(notification.item.effect || notification.item.effects).map((effect, i) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 font-mono">
                                                {effect}
                                            </span>
                                        ))}
                                    </div>
                                )}

                            {/* Sell Action & Added to Inventory */}
                            <div className="flex items-center justify-between pt-1">
                                <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest leading-none flex items-center h-6">
                                    {notification.item?.auto_sold ? "Converted to Gold" : (notification.item?.inventory_id && notification.item.inventory_id !== -1 ? "Added to Inventory" : "Log Sequence Active")}
                                </div>

                                {notification.item?.inventory_id && notification.item.inventory_id !== -1 && !notification.item?.auto_sold && (
                                    <button
                                        onClick={handleSell}
                                        disabled={isSelling}
                                        className="h-6 px-3 flex items-center justify-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-sm text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap overflow-hidden pointer-events-auto"
                                    >
                                        {isSelling ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <>
                                                <Coins className="w-3 h-3" />
                                                Sell ({Math.floor((notification.item.price || 0) * 0.75)}G)
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* XP & Gold Reward Tags */}
                <div className="flex flex-col gap-1">
                    {notification.xp !== undefined && notification.xp !== 0 && (
                        <div className={cn(
                            "text-[10px] font-bold font-mono px-2 py-1 rounded border",
                            notification.xp > 0
                                ? "text-cyan-400 bg-cyan-950/40 border-cyan-500/20"
                                : "text-red-400 bg-red-950/40 border-red-500/20"
                        )}>
                            {notification.xp > 0 ? "+" : ""}{notification.xp} XP
                        </div>
                    )}
                    {notification.gold !== undefined && notification.gold > 0 && (
                        <div className="text-[10px] font-bold font-mono px-2 py-1 rounded border text-yellow-400 bg-yellow-950/40 border-yellow-500/20">
                            +{notification.gold.toLocaleString()} Gold
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-0.5 w-full bg-white/5 overflow-hidden">
                <div className="h-full bg-current opacity-20 animate-[width_6s_linear_forwards] w-full origin-left" />
            </div>
        </div>
    );
}

// Add shimmer keyframes to global css if not present or assume tailwind config handles it.
// For safety we can add inline style for the animation if needed, but 'animate-pulse' is standard.
