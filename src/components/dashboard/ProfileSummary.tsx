import { cn } from "@/lib/utils";
import { Coins, Target, Shield, Zap, Sword } from "lucide-react";
import { Profile } from "@/lib/dashboard-data";

interface ProfileSummaryProps {
    profile: Profile | null;
    maxHp: number;
    maxMana: number;
    atk: number;
    def: number;
    xpPercent: number;
    dailyQuestCount: number;
    shadowStats?: {
        total: number;
        available: number;
        max: number;
        elites: number;
    };
    secondaryStats?: {
        critChance: number;
        dodgeChance: number;
        lootFind: number;
        critMultiplier: number;
    };
}

export function ProfileSummary({
    profile,
    maxHp,
    maxMana,
    atk,
    def,
    xpPercent,
    dailyQuestCount,
    shadowStats,
    secondaryStats
}: ProfileSummaryProps) {
    // If no profile (loading or error), show skeleton or default
    // Using a default "Offline" state to preserve layout
    const safeProfile = profile || {
        username: "INITIALIZING...",
        hunter_class: "SYSTEM",
        hunter_rank: "E",
        level: 1,
        current_hp: 100,
        current_mana: 50,
        current_xp: 0,
        next_level_xp: 100,
        available_sp: 0,
        available_ap: 0,
        gold_credits: 0
    };

    // Clean Username (remove email)
    const displayName = (safeProfile.username || "PLAYER").split('@')[0].toUpperCase();

    const formatGold = (value: number) => {
        if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (value >= 10000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return value.toLocaleString();
    };

    return (
        <div className="mx-3 mb-2 p-3 bg-slate-900/50 border border-cyan-900/40 rounded overflow-hidden relative group">
            <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-10 transition-opacity" />

            {/* Header: Name & Rank */}
            <div className="flex justify-between items-start mb-3 border-b border-cyan-900/30 pb-2">
                <div>
                    <h3 className="text-sm font-bold text-white font-sans tracking-wide truncate max-w-[120px]" title={safeProfile.username || ""}>
                        {displayName}
                    </h3>
                    <p className={cn("text-[10px] font-mono mt-0.5",
                        safeProfile.hunter_rank === '[Ω]' ? "text-purple-400 animate-pulse" : "text-cyan-500"
                    )}>
                        {(safeProfile as any).entity_type || safeProfile.hunter_class || "NONE"}
                    </p>
                </div>
                <div className="flex flex-col items-end">
                    <span className={cn("text-xs font-bold font-mono px-1 rounded",
                        safeProfile.hunter_rank === '[Ω]' ? "text-white bg-purple-950/50 border border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-pulse" :
                            safeProfile.hunter_rank === 'S' ? "text-orange-400 bg-orange-950/30 border border-orange-900/50" :
                                "text-cyan-300 bg-cyan-950/30 border border-cyan-900/50"
                    )}>
                        {safeProfile.hunter_rank || "E"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-1">
                        Lv.{safeProfile.level || 1}
                    </span>
                </div>
            </div>

            {/* Bars: HP/MP/XP */}
            <div className="space-y-1.5 mb-3">
                {/* HP */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-red-400 w-4">HP</span>
                    <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-red-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, ((safeProfile.current_hp || 0) / maxHp) * 100)}%` }}
                        />
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 w-10 text-right">
                        {safeProfile.current_hp || 0}/{maxHp}
                    </span>
                </div>
                {/* MP */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-blue-400 w-4">MP</span>
                    <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, ((safeProfile.current_mana || 0) / maxMana) * 100)}%` }}
                        />
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 w-10 text-right">
                        {safeProfile.current_mana || 0}/{maxMana}
                    </span>
                </div>
                {/* XP */}
                <div className="flex items-center gap-1.5 relative group/xp">
                    <span className="text-[9px] font-bold text-yellow-400 w-4">XP</span>
                    <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-500 transition-all duration-500"
                            style={{ width: `${xpPercent}%` }}
                        />
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 w-10 text-right">
                        {xpPercent}%
                    </span>
                </div>
            </div>

            {/* Grid Stats */}
            <div className="space-y-2 text-[10px] font-mono border-t border-cyan-900/30 pt-2">
                {/* Row 1: Gold & Daily */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between text-slate-300 min-w-0">
                        <span className="flex items-center gap-1 shrink-0"><Coins className="w-3 h-3 text-yellow-500" /> Gold</span>
                        <span
                            className="text-yellow-100 font-bold cursor-help"
                            title={`${Number(safeProfile.gold_credits || 0).toLocaleString()} Gold`}
                        >
                            {formatGold(Number(safeProfile.gold_credits || 0))}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 min-w-0">
                        <span className="flex items-center gap-1 shrink-0"><Target className="w-3 h-3 text-red-500" /> Daily</span>
                        <span className={dailyQuestCount > 0 ? "text-red-300 animate-pulse font-bold" : "text-slate-500"}>{dailyQuestCount}</span>
                    </div>
                </div>

                {/* Row 2: ATK & DEF */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1"><Sword className="w-3 h-3 text-red-500/70" /> ATK</span>
                        <span className="text-white font-bold">{atk}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-500/70" /> DEF</span>
                        <span className="text-white font-bold">{def}</span>
                    </div>
                </div>

                {/* Row 3: AP & SP */}
                <div className="grid grid-cols-2 gap-2 border-t border-cyan-900/10 pt-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-cyan-600/70" /> AP</span>
                        <span className={cn(safeProfile.available_ap && safeProfile.available_ap > 0 ? "text-cyan-300 font-bold" : "text-slate-500")}>
                            {safeProfile.available_ap || 0}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-purple-600/70" /> SP</span>
                        <span className={cn(safeProfile.available_sp && safeProfile.available_sp > 0 ? "text-purple-300 font-bold" : "text-slate-500")}>
                            {safeProfile.available_sp || 0}
                        </span>
                    </div>
                </div>

                {/* Row 4: Secondary Stats (Hidden no more) */}
                {secondaryStats && (
                    <div className="grid grid-cols-3 gap-1 border-t border-cyan-900/10 pt-2 pb-1">
                        <div className="flex flex-col items-center group/stat relative" title="CRIT CHANCE: Base from (AGI+PER)/500">
                            <span className="text-[7px] text-slate-500 uppercase font-black mb-0.5">Crit</span>
                            <span className="text-orange-400 font-bold">{(secondaryStats.critChance * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col items-center group/stat relative" title="DODGE: Base from AGI/500">
                            <span className="text-[7px] text-slate-500 uppercase font-black mb-0.5">Dodge</span>
                            <span className="text-cyan-400 font-bold">{(secondaryStats.dodgeChance * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col items-center group/stat relative" title="LOOT: Base from PER/200">
                            <span className="text-[7px] text-slate-500 uppercase font-black mb-0.5">Loot</span>
                            <span className="text-yellow-500 font-bold">+{Math.floor(secondaryStats.lootFind * 100)}%</span>
                        </div>
                    </div>
                )}
            </div>


            {/* Shadow Army Stats (Necromancer Only) */}
            {
                (safeProfile.hunter_class?.toLowerCase().includes('necromancer') || (safeProfile as any).job_title?.toLowerCase().includes('necromancer')) && shadowStats && (
                    <div className="mt-2 pt-2 border-t border-purple-900/30">
                        <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-purple-400 font-mono uppercase tracking-widest">
                            <span className="w-1 h-3 bg-purple-600 rounded-sm"></span>
                            ARMY OF THE DEAD
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                            <div className="bg-purple-950/20 border border-purple-900/30 rounded p-1 text-center">
                                <div className="text-[10px] font-bold text-white leading-none">{shadowStats.max}</div>
                                <div className="text-[7px] text-purple-400/70 mt-0.5 uppercase tracking-wider">Max</div>
                            </div>
                            <div className="bg-purple-950/20 border border-purple-900/30 rounded p-1 text-center">
                                <div className="text-[10px] font-bold text-purple-300 leading-none">{shadowStats.total - shadowStats.available}</div>
                                <div className="text-[7px] text-purple-400/70 mt-0.5 uppercase tracking-wider">Used</div>
                            </div>
                            <div className="bg-purple-950/20 border border-purple-900/30 rounded p-1 text-center">
                                <div className="text-[10px] font-bold text-cyan-300 leading-none">{shadowStats.available}</div>
                                <div className="text-[7px] text-purple-400/70 mt-0.5 uppercase tracking-wider">Avail</div>
                            </div>
                            <div className="bg-purple-950/20 border border-purple-900/30 rounded p-1 text-center">
                                <div className="text-[10px] font-bold text-yellow-500 leading-none">{shadowStats.elites}</div>
                                <div className="text-[7px] text-purple-400/70 mt-0.5 uppercase tracking-wider">Elite</div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

