"use client";

import { RankingEntry } from "@/app/actions/leaderboard";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
    Trophy,
    Zap,
    Coins,
    ChevronUp,
    Activity,
    Sword,
    Shield
} from "lucide-react";

interface RankingPanelProps {
    entries: RankingEntry[];
}

export function RankingPanel({ entries }: RankingPanelProps) {
    const highestMissionCount = Math.max(
        1,
        ...entries.map(entry => Number(entry.completed_quests) || 0),
    );

    return (
        <div className="glass-panel overflow-hidden border border-white/5 rounded-xl bg-slate-900/20">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                        <Trophy className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-widest uppercase font-sans">
                            Global Hunter Rankings
                        </h2>
                        <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">
                            SYSTEM_LOG // RANKING_SNAPSHOT
                        </p>
                        <p className="text-[9px] text-slate-600 font-mono uppercase tracking-tight">
                            Personal combat and resource values are private.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/50 border border-white/5 rounded text-[10px] font-mono text-slate-500">
                    <Activity className="w-3 h-3 text-cyan-500" />
                    STATUS: SNAPSHOT
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-950/40 text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                            <th className="px-6 py-4 font-bold">Rank</th>
                            <th className="px-6 py-4 font-bold">Hunter</th>
                            <th className="px-6 py-4 font-bold text-center">Level</th>
                            <th className="px-6 py-4 font-bold">Performance</th>
                            <th className="px-6 py-4 font-bold">Combat Intel</th>
                            <th className="px-6 py-4 font-bold">Resources</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-600 font-mono text-xs italic">
                                    {'>'} NO HUNTER DATA DETECTED IN CURRENT SECTOR
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry, index) => {
                                const rank = index + 1;
                                const isTopThree = rank <= 3;
                                const rankValue = String(entry.hunter_rank || 'E-RANK').toUpperCase();
                                const rankLabel = rankValue === '[Ω]' || rankValue.endsWith('RANK')
                                    ? rankValue
                                    : `${rankValue}-RANK`;
                                const performancePercent = Math.min(
                                    100,
                                    Math.round(((Number(entry.completed_quests) || 0) / highestMissionCount) * 100),
                                );

                                return (
                                    <tr
                                        key={entry.id}
                                        className={cn(
                                            "group transition-colors hover:bg-white/5",
                                            isTopThree ? "bg-cyan-500/[0.02]" : ""
                                        )}
                                    >
                                        {/* Rank Column */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "w-6 h-6 flex items-center justify-center rounded text-[10px] font-black font-mono",
                                                    rank === 1 ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30" :
                                                        rank === 2 ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" :
                                                            rank === 3 ? "bg-orange-600/20 text-orange-600 border border-orange-600/30" :
                                                                "bg-slate-800/50 text-slate-500 border border-white/5"
                                                )}>
                                                    #{rank}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Hunter Column */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {(() => {
                                                    const getAvatarPath = (hClass: string) => {
                                                        const c = (hClass || 'NONE').toLowerCase();
                                                        if (c.includes('mage')) return '/avatars/mage-male.webp';
                                                        if (c.includes('healer')) return '/avatars/healer-male.webp';
                                                        if (c.includes('tank')) return '/avatars/tank-male.webp';
                                                        if (c.includes('assassin')) return '/avatars/assassin-male.webp';
                                                        if (c.includes('necromancer') || c.includes('monarch')) return '/avatars/necromancer-male.webp';
                                                        if (c.includes('warlock')) return '/avatars/warlock-male.webp';
                                                        if (c.includes('fighter')) return '/avatars/monk-male.webp'; // Fallback for fighter
                                                        if (c.includes('ranger')) return '/avatars/generic-male.webp'; // Fallback
                                                        return '/avatars/generic-male.webp';
                                                    };

                                                    return (
                                                        <div className="w-10 h-10 rounded shrink-0 border border-white/10 overflow-hidden relative group-hover:border-cyan-500/50 transition-colors bg-slate-900">
                                                            <Image
                                                                src={getAvatarPath(entry.hunter_class)}
                                                                alt={entry.hunter_class || 'Hunter Class'}
                                                                fill
                                                                className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            />
                                                        </div>
                                                    );
                                                })()}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-white tracking-tight group-hover:text-cyan-400 transition-colors truncate">
                                                        {entry.username}
                                                        {entry.is_current_user && (
                                                            <span className="ml-2 text-[8px] font-mono text-cyan-400 border border-cyan-500/30 rounded px-1 py-0.5 align-middle">
                                                                YOU
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-widest truncate">
                                                        {entry.hunter_class || 'NONE'}
                                                        <span className="mx-1 opacity-20">/</span>
                                                        <span className="text-cyan-600 font-bold">{rankLabel}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Level Column */}
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-lg font-black text-white font-sans leading-none">
                                                    {entry.level}
                                                </span>
                                                <span className="text-[8px] text-slate-600 font-mono uppercase mt-1">Level</span>
                                            </div>
                                        </td>

                                        {/* Performance Column */}
                                        <td className="px-6 py-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 min-w-[60px]">
                                                        <Zap className="w-3 h-3 text-purple-400" />
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {entry.completed_quests} <span className="text-[8px] font-normal uppercase opacity-60">Missions</span>
                                                        </span>
                                                    </div>
                                                    {(entry.current_streak || 0) > 0 && (
                                                        <div className="flex items-center gap-1 text-[9px] font-black text-red-500 animate-pulse bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                                            STREAK: {entry.current_streak ?? 0}
                                                        </div>
                                                    )}
                                                </div>
                                                <div
                                                    className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden"
                                                    role="progressbar"
                                                    aria-label={`${entry.completed_quests} completed missions relative to the listed leader`}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                    aria-valuenow={performancePercent}
                                                >
                                                    <div className="h-full bg-cyan-500/40" style={{ width: `${performancePercent}%` }} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Combat Intel Column */}
                                        <td className="px-6 py-4">
                                            {entry.is_current_user ? (
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Sword className="w-3 h-3 text-red-500" />
                                                        <span className="text-xs font-bold text-slate-300">{entry.atk ?? 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Shield className="w-3 h-3 text-blue-500" />
                                                        <span className="text-xs font-bold text-slate-300">{entry.def ?? 0}</span>
                                                    </div>
                                                    <div className="text-[8px] text-slate-600 uppercase font-mono tracking-tighter">Att</div>
                                                    <div className="text-[8px] text-slate-600 uppercase font-mono tracking-tighter">Def</div>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">PRIVATE</span>
                                            )}
                                        </td>

                                        {/* Resources Column */}
                                        <td className="px-6 py-4">
                                            {entry.is_current_user ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Coins className="w-3 h-3 text-yellow-500" />
                                                        <span className="text-[10px] font-bold text-yellow-500/90">
                                                            {Number(entry.gold_credits || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-mono tracking-tighter">
                                                        {Number(entry.current_xp || 0).toLocaleString()} <span className="text-[8px] opacity-40">TOTAL XP</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">PRIVATE</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-slate-950/20 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                <span>{'//'} TOP_50_WORLDWIDE_HUNTERS_LISTED</span>
                <span className="flex items-center gap-1">
                    <ChevronUp className="w-3 h-3 text-cyan-500" />
                    SCROLL_FOR_MORE_DETAILS
                </span>
            </div>
        </div>
    );
}
