"use client";

import { useState } from "react";
import { RotateCcw, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResetApButtonProps {
    onUpdate?: () => void;
    currentStats?: {
        strength: number;
        agility: number;
        intelligence: number;
        vitality: number;
        perception: number;
    };
}

export function ResetApButton({ onUpdate, currentStats }: ResetApButtonProps) {
    const [state, setState] = useState<'idle' | 'confirm' | 'loading' | 'done'>('idle');
    const [refunded, setRefunded] = useState(0);

    // Calculate how many AP have been spent (base is 10 per stat)
    const BASE = 10;
    const spentAp = currentStats
        ? Math.max(0, (currentStats.strength - BASE)) +
        Math.max(0, (currentStats.agility - BASE)) +
        Math.max(0, (currentStats.intelligence - BASE)) +
        Math.max(0, (currentStats.vitality - BASE)) +
        Math.max(0, (currentStats.perception - BASE))
        : 0;

    const handleReset = async () => {
        setState('loading');
        try {
            const { resetAttributePointsAction } = await import("@/app/actions/stats");
            const result = await resetAttributePointsAction();
            if (result.success) {
                setRefunded(result.data?.refunded ?? 0);
                setState('done');
                if (onUpdate) onUpdate();
                // Auto-close after 2.5s
                setTimeout(() => setState('idle'), 2500);
            } else {
                throw new Error(result.error || "Reset failed.");
            }
        } catch (e: unknown) {
            console.error(e);
            setState('idle');
            alert(e instanceof Error ? e.message : "Reset failed.");
        }
    };

    // Nothing spent — show a muted disabled state
    if (spentAp === 0 && state === 'idle') {
        return (
            <button
                disabled
                title="No attribute points have been spent yet"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-slate-800 bg-slate-900/30 text-slate-600 rounded cursor-not-allowed uppercase tracking-widest"
            >
                <RotateCcw className="w-3 h-3" />
                Reset AP
            </button>
        );
    }


    // Layout wrapper to ensure we have a stable anchor
    return (
        <div className="relative inline-flex items-center">
            {/* 1. Phantom/Active Idle Button - Always renders primarily for layout space, or interaction in idle state */}
            <button
                onClick={() => state === 'idle' && setState('confirm')}
                disabled={state !== 'idle'}
                title={`Reset all ${spentAp} spent AP back to base stats`}
                className={cn(
                    "group flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-all duration-200",
                    "border border-amber-900/50 bg-amber-950/20 text-amber-600",
                    // Interaction styles only when idle
                    state === 'idle' && "hover:border-amber-600/70 hover:bg-amber-900/30 hover:text-amber-400 hover:shadow-[0_0_8px_rgba(217,119,6,0.25)]",
                    // Hide visibility but keep layout when not idle (phantom mode)
                    state !== 'idle' && "opacity-0 pointer-events-none"
                )}
            >
                <RotateCcw className="w-3 h-3 group-hover:rotate-[-180deg] transition-transform duration-500" />
                RESET AP
                <span className="text-[9px] opacity-60">({spentAp})</span>
            </button>

            {/* 2. Absolute Confirmation Overlay - Expands effortlessly to the right without pushing layout */}
            {state === 'confirm' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 px-2 py-1.5 border border-amber-600/40 bg-black/90 rounded backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_15px_rgba(217,119,6,0.3)] whitespace-nowrap">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-tight">
                        RESET ALL? <span className="text-white">+{spentAp} AP</span>
                    </span>
                    <div className="flex gap-1 pl-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                            className="px-2 py-0.5 text-[9px] font-mono font-black bg-amber-600 hover:bg-amber-400 text-black rounded transition-all uppercase active:scale-95"
                        >
                            CONFIRM
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setState('idle'); }}
                            className="px-1.5 py-0.5 text-[9px] font-mono text-amber-600 hover:text-white border border-amber-900/50 hover:bg-amber-900/30 rounded transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* 3. Loading State Overlay */}
            {state === 'loading' && (
                <div className="absolute left-0 top-0 w-full h-full flex items-center justify-center gap-1.5 bg-cyan-950/80 border border-cyan-900/50 rounded z-50 backdrop-blur-[2px]">
                    <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                </div>
            )}

            {/* 4. Success State Overlay */}
            {state === 'done' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 px-2 py-1.5 bg-emerald-950/90 border border-emerald-500/50 rounded animate-in fade-in whitespace-nowrap shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-mono text-emerald-300 font-bold tracking-tight">
                        +{refunded} AP REFUNDED
                    </span>
                </div>
            )}
        </div>
    );
}
