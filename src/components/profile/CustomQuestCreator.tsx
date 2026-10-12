"use client";

import { useState } from "react";
import { Plus, X, Sparkles, Zap, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { createCustomQuestAction } from "@/app/actions/quests";

interface CustomQuestCreatorProps {
    className?: string;
    zones: any[];
}

const REWARDS: Record<string, { xp: number, mana: number }> = {
    'E': { xp: 50, mana: 50 },
    'D': { xp: 150, mana: 150 },
    'C': { xp: 450, mana: 400 },
    'B': { xp: 1000, mana: 800 },
    'A': { xp: 2500, mana: 1500 },
    'S': { xp: 5000, mana: 2500 },
};

export function CustomQuestCreator({ className, zones }: CustomQuestCreatorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [rank, setRank] = useState("E");
    const [frequency, setFrequency] = useState("Daily");
    const [description, setDescription] = useState("");
    const [zoneId, setZoneId] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!title.trim()) return;

        setLoading(true);
        try {
            const res = await createCustomQuestAction({
                title: title,
                difficulty: rank,
                frequency: frequency,
                description: description,
                zoneId: zoneId || undefined
            });

            if (res.error) {
                alert(res.error);
            } else {
                setIsOpen(false);
                setTitle("");
                setDescription("");
                setRank("E");
                setZoneId("");
            }
        } catch (e) {
            console.error(e);
            alert("System Error: Setup Failed");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "w-full py-3 flex items-center justify-center gap-2 rounded border border-dashed border-slate-700 bg-slate-900/20 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-slate-900/40 transition-all group",
                    className
                )}
            >
                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Create Protocol</span>
            </button>
        );
    }

    const currentReward = REWARDS[rank] || REWARDS['E'];

    return (
        <div className={cn("glass-panel p-3 rounded-lg border border-cyan-900/50 relative", className)}>
            <button
                onClick={() => setIsOpen(false)}
                className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
            >
                <X className="w-3 h-3" />
            </button>

            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Initialize Protocol
            </h3>

            <div className="flex flex-col gap-2">
                {/* Title Input */}
                <div>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Objective..."
                        className="w-full bg-slate-950/50 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-700 font-mono"
                    />
                </div>

                {/* Description Input */}
                <div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description (Optional)..."
                        rows={2}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-700 font-mono resize-none"
                    />
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={rank}
                        onChange={(e) => setRank(e.target.value)}
                        className="bg-slate-950/50 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                    >
                        {Object.keys(REWARDS).map(r => (
                            <option key={r} value={r} className="bg-slate-900 text-white">{r}-Rank</option>
                        ))}
                    </select>

                    <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="bg-slate-950/50 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                    >
                        <option value="Daily" className="bg-slate-900 text-white">Daily</option>
                        <option value="Once" className="bg-slate-900 text-white">One-Time</option>
                    </select>
                </div>

                {/* Zone Selector */}
                <div>
                    <select
                        value={zoneId}
                        onChange={(e) => setZoneId(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                    >
                        <option value="" className="bg-slate-900 text-slate-500">Select Zone (Optional)</option>
                        {zones.map(z => (
                            <option key={z.id} value={z.id} className="bg-slate-900 text-white">{z.name}</option>
                        ))}
                    </select>
                </div>

                {/* Reward Preview (Compact Strip) */}
                <div className="flex items-center justify-between bg-slate-950/80 rounded px-3 py-1.5 border border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-bold text-blue-400 font-mono">{currentReward.mana}</span>
                        </div>
                        <div className="w-px h-3 bg-slate-800" />
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-purple-500" />
                            <span className="text-xs font-bold text-purple-400 font-mono">+{currentReward.xp}</span>
                        </div>
                    </div>
                    <Lock className="w-2.5 h-2.5 text-slate-700" />
                </div>

                {/* Action Button */}
                <button
                    onClick={handleSubmit}
                    disabled={loading || !title.trim()}
                    className={cn(
                        "w-full py-1.5 rounded text-[10px] font-bold font-mono tracking-widest uppercase transition-all",
                        loading || !title.trim()
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-cyan-900/30 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/50 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    )}
                >
                    {loading ? "PROCESSING..." : "CONFIRM"}
                </button>
            </div>
        </div>
    );
}
