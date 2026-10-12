"use client";

import { useAuthUser } from "@/hooks/useAuthUser";
import { useState } from "react";
import { RefreshCw, Zap, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function DebugControls({ onUpdate, canJump }: { onUpdate?: () => void; canJump: boolean }) {
    const [loading, setLoading] = useState(false);
    const { userId } = useAuthUser();

    const handleReset = async () => {
        if (!confirm("WARNING: DESIGNATED RESET.\n\nThis will return your parameters to Level 1. Confirm?")) return;

        setLoading(true);

        try {
            const { resetSystemAction } = await import("@/app/actions/system");
            const result = await resetSystemAction();
            if (!result.success) throw new Error("Reset Failed");

            // Reload page to clear boss widget and refresh all state
            window.location.reload();
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : "Reset Failed");
        }

        setLoading(false);
        if (onUpdate) onUpdate();
    };

    const handleGrantXP = async () => {
        if (!userId) return;
        setLoading(true);

        // We use the action now to ensure triggers/achievements run
        const { addXpAction } = await import("@/app/actions/system");
        const result = await addXpAction(50000); // Inject 50k

        if (result.success) {
            if (result.unlocked && result.unlocked.length > 0) {
                result.unlocked.forEach((ach: { name: string, xp: number }) => {
                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                        detail: {
                            title: "ACHIEVEMENT UNLOCKED", message: ach.name, type: 'ACHIEVEMENT', xp: ach.xp
                        }
                    }));
                });
            }
            if (result.newLevel) {
                window.dispatchEvent(new CustomEvent('solo_achievement', {
                    detail: {
                        title: "LEVEL UP!", message: `Level ${result.newLevel}`, type: 'LEVEL_UP'
                    }
                }));
            }
            window.dispatchEvent(new Event('progression_protocol_update'));
        }

        setLoading(false);
        if (onUpdate) onUpdate();
    };

    return (
        <div className="flex flex-wrap gap-2 mb-4 justify-end opacity-50 hover:opacity-100 transition-opacity">
            <button
                onClick={handleReset}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-red-900/50 bg-red-950/20 text-red-500 rounded hover:bg-red-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                Reset System
            </button>

            <button
                onClick={async () => {
                    if (!confirm("Reset all quests to Available? Progress logs will be wiped.")) return;
                    setLoading(true);
                    try {
                        const { resetQuestsAction } = await import("@/app/actions/system");
                        await resetQuestsAction();
                    } catch (e) {
                        console.error(e);
                        alert("Failed to reset quests");
                    }
                    setLoading(false);
                }}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-orange-900/50 bg-orange-950/20 text-orange-500 rounded hover:bg-orange-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                Reset Quests
            </button>

            <div className="w-[1px] bg-white/10 mx-1"></div>

            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        const { unlockAllBossesAction } = await import("@/app/actions/bosses");
                        await unlockAllBossesAction();
                        alert("BOSSES UNLOCKED. INCURSION IMMINENT.");
                    } catch (e) { console.error(e); }
                    setLoading(false);
                }}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-green-900/50 bg-green-950/20 text-green-500 rounded hover:bg-green-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <Zap className="w-3 h-3" />
                Unlock Bosses
            </button>

            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        const { lockAllBossesAction } = await import("@/app/actions/bosses");
                        await lockAllBossesAction();
                    } catch (e) { console.error(e); }
                    setLoading(false);
                }}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-slate-700 bg-slate-800/50 text-slate-400 rounded hover:bg-slate-700 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                Lock Bosses
            </button>

            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        const { clearActiveEncountersAction } = await import("@/app/actions/bosses");
                        await clearActiveEncountersAction();
                        alert("ENCOUNTERS CLEARED.");
                        if (onUpdate) onUpdate();
                        window.location.reload(); // Force refresh to update widget
                    } catch (e) {
                        console.error(e);
                        alert("Failed to clear encounters");
                    }
                    setLoading(false);
                }}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-purple-900/50 bg-purple-950/20 text-purple-500 rounded hover:bg-purple-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <Zap className="w-3 h-3" />
                Clear Encounters
            </button>

            <div className="w-[1px] bg-white/10 mx-1"></div>

            <button
                onClick={handleGrantXP}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-cyan-900/50 bg-cyan-950/20 text-cyan-500 rounded hover:bg-cyan-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <Zap className="w-3 h-3" />
                Inject 50k XP
            </button>

            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        const { injectGoldAction } = await import("@/app/actions/system");
                        await injectGoldAction(100000);
                        if (onUpdate) onUpdate();
                        window.dispatchEvent(new Event('progression_protocol_update'));
                    } catch (e) { console.error(e); }
                    setLoading(false);
                }}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-yellow-900/50 bg-yellow-950/20 text-yellow-500 rounded hover:bg-yellow-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <Coins className="w-3 h-3" />
                Inject 100k G
            </button>

            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        const { injectBulkCompletionsAction } = await import("@/app/actions/system");
                        const res = await injectBulkCompletionsAction(100);
                        if (res.success) {
                            alert("100 MISSIONS INJECTED INTO RECORDS.");
                            if (onUpdate) onUpdate();
                            window.dispatchEvent(new Event('progression_protocol_update'));
                        }
                    } catch (e) {
                        console.error(e);
                        alert("Access Denied: Level 10 Authorization Required.");
                    }
                    setLoading(false);
                }}
                disabled={loading}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-cyan-500/50 bg-cyan-950/20 text-cyan-400 rounded hover:bg-cyan-900/40 transition-colors uppercase",
                    loading && "opacity-50 cursor-not-allowed"
                )}
            >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                Inject 100 Missions
            </button>
            {/* Available only to explicitly authorized developer accounts. */}
            {canJump && (
                <>
                    <div className="w-[1px] bg-white/10 mx-1"></div>
                    <button
                        onClick={async () => {
                            if (!confirm("⚠️ COSMIC JUMP\n\nSet level directly to 999 to test The Beyond mechanics?")) return;
                            setLoading(true);
                            try {
                                const { jumpToLevel999Action } = await import("@/app/actions/system");
                                const result = await jumpToLevel999Action();
                                if (result.success) {
                                    window.dispatchEvent(new CustomEvent('solo_achievement', {
                                        detail: {
                                            title: "COSMIC AWAKENING",
                                            message: "Level 999 — The Beyond awaits",
                                            type: 'LEVEL_UP'
                                        }
                                    }));
                                    window.location.reload();
                                }
                            } catch (e: unknown) {
                                alert(e instanceof Error ? e.message : "Jump failed");
                            }
                            setLoading(false);
                        }}
                        disabled={loading}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono border border-violet-500/60 bg-violet-950/30 text-violet-300 rounded hover:bg-violet-900/50 transition-colors uppercase shadow-[0_0_8px_rgba(139,92,246,0.3)]",
                            loading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Zap className="w-3 h-3 text-violet-400" />
                        ⚡ Jump to Lv.999
                    </button>
                </>
            )}
        </div >
    );
}
