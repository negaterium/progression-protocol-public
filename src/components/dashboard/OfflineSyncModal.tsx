"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { syncOfflineProgressAction } from "@/app/actions/system";
import { Check, Info } from "lucide-react";

interface OfflineSyncModalProps {
    gaps: string[];
    onComplete: () => void;
}

export function OfflineSyncModal({ gaps, onComplete }: OfflineSyncModalProps) {
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(gaps)); // Default to all selected
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleDate = (date: string) => {
        const newSet = new Set(selectedDates);
        if (newSet.has(date)) {
            newSet.delete(date);
        } else {
            newSet.add(date);
        }
        setSelectedDates(newSet);
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);
        try {
            const datesToSync = Array.from(selectedDates);
            if (datesToSync.length > 0) {
                const res = await syncOfflineProgressAction(datesToSync);
                if (!res?.success) {
                    throw new Error("Failed to sync offline progress");
                }
            }
            onComplete();
        } catch (err: any) {
            setError(err.message || "An error occurred during synchronization.");
        } finally {
            setIsSyncing(false);
        }
    };

    if (gaps.length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/50 rounded-lg shadow-2xl overflow-hidden max-w-md w-full animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                            <Info className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                SHADOW OBSERVER
                            </h2>
                            <p className="text-xs text-blue-400/80 font-mono tracking-widest uppercase">System Sync Required</p>
                        </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-md border border-slate-800 mb-6">
                        <p className="text-sm text-slate-300 leading-relaxed">
                            The System was unable to track your progress for <span className="font-bold text-white">{gaps.length} day(s)</span>. 
                            Your Shadow Detachment observed your actions while disconnected.
                        </p>
                        <p className="text-sm text-slate-400 mt-2 italic border-l-2 border-slate-700 pl-3">
                            &quot;Did you complete your daily objectives on these dates?&quot;
                        </p>
                    </div>

                    <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
                        {gaps.sort((a,b)=> a.localeCompare(b)).map(date => {
                            const isSelected = selectedDates.has(date);
                            return (
                                <button
                                    key={date}
                                    onClick={() => toggleDate(date)}
                                    className={`w-full flex items-center justify-between p-3 rounded-md border transition-all ${isSelected ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}
                                >
                                    <span className={`font-mono text-sm ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {format(parseISO(date), "EEEE, MMM do")}
                                    </span>
                                    <div className={`h-5 w-5 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-400' : 'bg-slate-900 border-slate-600'}`}>
                                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {error && (
                        <div className="bg-red-950/50 border border-red-500/30 text-red-400 px-3 py-2 rounded text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onComplete}
                            disabled={isSyncing}
                            className="flex-1 py-2.5 rounded text-sm font-bold tracking-wider text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            SKIP
                        </button>
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex-1 py-2.5 rounded text-sm font-bold tracking-wider relative overflow-hidden group bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
                            {isSyncing ? "SYNCING..." : "CONFIRM SYNC"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
