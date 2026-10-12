"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Terminal, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
    id: number;
    quest_title: string;
    quest_type: string;
    difficulty: string;
    xp_reward: number;
    completed_at: string;
}

interface DetailedLogViewerProps {
    logs: LogEntry[];
}

export function DetailedLogViewer({ logs = [] }: DetailedLogViewerProps) {
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [rankFilter, setRankFilter] = useState('ALL');
    const [showSearch, setShowSearch] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const pageSize = 15;

    const sortedLogs = [...logs].sort((a, b) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        || Number(b.id) - Number(a.id)
    );
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredLogs = sortedLogs.filter(log => {
        const matchesSearch = !normalizedSearch || [log.quest_title, log.quest_type, log.difficulty]
            .some(value => value?.toLowerCase().includes(normalizedSearch));
        const matchesRank = rankFilter === 'ALL' || (log.difficulty || 'E').toUpperCase() === rankFilter;
        return matchesSearch && matchesRank;
    });
    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    const safePage = Math.min(page, Math.max(0, totalPages - 1));
    const currentLogs = filteredLogs.slice(safePage * pageSize, (safePage + 1) * pageSize);

    return (
        <div className="border border-slate-800 bg-[#0d1117]/80 rounded-lg overflow-hidden flex flex-col min-h-[600px] animate-in fade-in duration-700">
            {/* Header / Toolbar */}
            <div className="p-4 border-b border-slate-800 bg-black/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-cyan-950/30 flex items-center justify-center border border-cyan-900/50">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-200 tracking-wider">SYSTEM_LOGS</h2>
                        <div className="text-[10px] text-cyan-700 font-mono">
                            ACCESS_LEVEL_10 // AUTHORIZED
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                    {showSearch && (
                        <input
                            value={searchTerm}
                            onChange={event => {
                                setSearchTerm(event.target.value);
                                setPage(0);
                            }}
                            placeholder="Search mission log"
                            aria-label="Search mission log"
                            className="h-8 w-48 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] font-mono text-slate-300 outline-none focus:border-cyan-500"
                        />
                    )}
                    {showFilters && (
                        <select
                            value={rankFilter}
                            onChange={event => {
                                setRankFilter(event.target.value);
                                setPage(0);
                            }}
                            aria-label="Filter mission log by rank"
                            className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-[10px] font-mono text-slate-300 outline-none focus:border-cyan-500"
                        >
                            {['ALL', 'E', 'D', 'C', 'B', 'A', 'S'].map(rank => (
                                <option key={rank} value={rank}>{rank === 'ALL' ? 'ALL RANKS' : `RANK ${rank}`}</option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        aria-label="Search mission log"
                        aria-pressed={showSearch}
                        onClick={() => setShowSearch(value => !value)}
                        className={cn("p-2 rounded text-slate-500 hover:bg-slate-800 hover:text-cyan-400 transition-colors", showSearch && "bg-slate-800 text-cyan-400")}
                    >
                        <Search className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Filter mission log"
                        aria-pressed={showFilters}
                        onClick={() => setShowFilters(value => !value)}
                        className={cn("p-2 rounded text-slate-500 hover:bg-slate-800 hover:text-cyan-400 transition-colors", showFilters && "bg-slate-800 text-cyan-400")}
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800/50 bg-slate-900/20 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <div className="col-span-2">Timestamp</div>
                <div className="col-span-1">ID</div>
                <div className="col-span-5">Mission Objective</div>
                <div className="col-span-2">Type / Rank</div>
                <div className="col-span-2 text-right">Rewards</div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 font-mono text-sm">
                        {logs.length === 0 ? 'NO RECORDS FOUND' : 'NO MATCHING RECORDS'}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/30">
                        {currentLogs.map((log) => (
                            <div
                                key={log.id}
                                className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-cyan-950/5 transition-colors group items-center text-xs font-sans"
                            >
                                {/* Timestamp */}
                                <div className="col-span-2 font-mono text-slate-500 group-hover:text-cyan-400/70 transition-colors">
                                    {format(new Date(log.completed_at), "MMM dd HH:mm")}
                                </div>

                                {/* ID */}
                                <div className="col-span-1 font-mono text-slate-600">
                                    #{String(log.id).padStart(4, '0')}
                                </div>

                                {/* Title */}
                                <div className="col-span-5 font-medium text-slate-300 group-hover:text-white truncate pr-4">
                                    {log.quest_title}
                                </div>

                                {/* Type / Rank */}
                                <div className="col-span-2 flex items-center gap-2">
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-mono border uppercase",
                                        getDifficultyStyles(log.difficulty)
                                    )}>
                                        {log.difficulty || 'E'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 uppercase truncate max-w-[80px]">
                                        {log.quest_type}
                                    </span>
                                </div>

                                {/* Rewards */}
                                <div className="col-span-2 text-right font-mono group-hover:text-cyan-400 transition-colors">
                                    +{log.xp_reward} XP
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination / Footer */}
            <div className="p-3 border-t border-slate-800 bg-black/20 flex items-center justify-between text-xs font-mono text-slate-500">
                <div>
                    PAGE {safePage + 1} / {Math.max(1, totalPages)}
                </div>
                <div className="flex gap-1">
                    <button
                        type="button"
                        aria-label="Previous log page"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="p-1 px-3 border border-slate-800 rounded hover:bg-cyan-950/30 hover:text-cyan-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
                    >
                        PREV
                    </button>
                    <button
                        type="button"
                        aria-label="Next log page"
                        onClick={() => setPage(p => p + 1)}
                        disabled={safePage >= totalPages - 1}
                        className="p-1 px-3 border border-slate-800 rounded hover:bg-cyan-950/30 hover:text-cyan-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
                    >
                        NEXT
                    </button>
                </div>
            </div>
        </div>
    );
}

function getDifficultyStyles(difficulty: string | null = 'E') {
    const d = difficulty || 'E';
    switch (d.toUpperCase()) {
        case 'S': return "bg-red-950/30 border-red-500/50 text-red-400";
        case 'A': return "bg-orange-950/30 border-orange-500/50 text-orange-400";
        case 'B': return "bg-purple-950/30 border-purple-500/50 text-purple-400";
        case 'C': return "bg-blue-950/30 border-blue-500/50 text-blue-400";
        case 'D': return "bg-cyan-950/30 border-cyan-500/50 text-cyan-400";
        default: return "bg-slate-800/50 border-slate-600/50 text-slate-400";
    }
}
