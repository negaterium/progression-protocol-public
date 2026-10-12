"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { Skull, Crown, Eye, Sword, ArrowUpCircle, Ghost, ShieldAlert, SignalHigh, Sparkles, ShoppingBag, Coins } from "lucide-react";
import { startBossBattleAction } from "@/app/actions/bosses";
import { purchaseItemAction } from "@/app/actions/store";
import { BattleResultModal } from "@/components/dashboard/BattleResultModal";
import { useRouter } from "next/navigation";
import { calculateBossCooldown } from "@/lib/game-logic/boss-cooldowns";
import { Database } from "@/types/database.types";
import { getAbilityIntel, getResistanceIntel, getWeaknessIntel, IntelMetadata } from "@/lib/game-logic/boss-intel-metadata";
import { calculateBossMaxHP } from "@/lib/system/formula";
import { getBossKeySuffix } from "@/lib/system/rank-constants";

type Boss = Database['public']['Tables']['bosses']['Row'] & {
    intel?: {
        weakness: string;
        resistances: string[];
        abilities: string[];
        strategy: string;
        lore: string;
    };
    last_defeated_at?: string;
};

type InventoryItem = {
    id: number;
    quantity: number;
    item: { name: string };
};


type BattleResult = {
    success: boolean;
    error?: string;
    bossName?: string;
    xp?: number;
    gold?: number;
    drops?: any[];
};



interface BossesClientProps {
    initialBosses: Boss[];
    initialHistory: any[];
    initialUserLevel: number;
    initialUserGold: number;
    initialInventory: InventoryItem[];
    initialKeys: any[];
    storeDiscount: number;
}

export function BossesClient({ 
    initialBosses, 
    initialHistory, 
    initialUserLevel, 
    initialUserGold,
    initialInventory,
    initialKeys,
    storeDiscount
}: BossesClientProps) {
    const router = useRouter();

    // Compute User-Specific Boss Statuses
    const isPostCap = initialUserLevel >= 999;

    const bosses = useMemo(() => {
        // Group bosses by phase for phase-scoped sequential unlock
        const byPhase: Record<number, typeof initialBosses> = {};
        for (const b of initialBosses) {
            const p = b.phase ?? 1;
            if (!byPhase[p]) byPhase[p] = [];
            byPhase[p].push(b);
        }

        return initialBosses.map((boss) => {
            const historyEntry = initialHistory.find(h => h.boss_id === boss.id);
            const isDefeated = !!historyEntry;

            // Post-cap players (Lv 999+) unlock all Phase 5 bosses automatically
            const isPhase5 = (boss.phase ?? 1) === 5;
            if (isPostCap && isPhase5) {
                return {
                    ...boss,
                    status: isDefeated ? 'DEFEATED' : 'AVAILABLE',
                    last_defeated_at: historyEntry?.created_at
                };
            }

            // Sequential unlock: check previous boss WITHIN the same phase
            const phaseGroup = byPhase[boss.phase ?? 1] ?? [];
            const bossIndexInPhase = phaseGroup.findIndex(b => b.id === boss.id);
            const prevBossInPhase = phaseGroup[bossIndexInPhase - 1];
            const prevBossDefeated = !prevBossInPhase || initialHistory.some(h => h.boss_id === prevBossInPhase.id);

            let userStatus = 'LOCKED';
            if (isDefeated) userStatus = 'DEFEATED';
            else if (prevBossDefeated) userStatus = 'AVAILABLE';

            return {
                ...boss,
                status: userStatus,
                last_defeated_at: historyEntry?.created_at
            };
        });
    }, [initialBosses, initialHistory, isPostCap]);

    const [activePhase, setActivePhase] = useState(1);
    const [selectedBoss, setSelectedBoss] = useState<Boss | null>(null);

    // Battle State
    const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleBattle = (bossId: number) => {
        startTransition(async () => {
            const result = await startBossBattleAction({ bossId: bossId.toString() });
            if (result.success) {
                const boss = bosses.find(b => b.id === bossId);
                if (result.data?.encounter && boss) {
                    window.dispatchEvent(new CustomEvent('solo_boss_engaged', {
                        detail: {
                            id: result.data.encounter.id,
                            boss_name: boss.name,
                            boss_rank: boss.rank,
                            current_hp: result.data.encounter.current_hp,
                            max_hp: result.data.encounter.max_hp,
                            streak_bonus: 0,
                            status: 'ACTIVE',
                            image_url: boss.image_url
                        }
                    }));
                }
                window.dispatchEvent(new Event('progression_protocol_update'));
                router.push('/dashboard');
            } else {
                // Show error in themed modal
                setBattleResult({ success: false, error: result.error });
            }
        });
    };

    const handlePurchaseKey = (itemId: number) => {
        startTransition(async () => {
            try {
                const result = await purchaseItemAction(itemId, 1);
                if (result.success) {
                    window.dispatchEvent(new Event('progression_protocol_update'));
                    router.refresh();
                }
            } catch (err: any) {
                setBattleResult({ success: false, error: err.message });
            }
        });
    };

    const phases = [
        { id: 1, title: "INITIATION", icon: Sword },
        { id: 2, title: "ASCENSION", icon: ArrowUpCircle },
        { id: 3, title: "CALAMITY", icon: Skull },
        { id: 4, title: "MONARCHS", icon: Crown },
        { id: 5, title: "OUTER GODS", icon: Ghost },
        { id: 6, title: "COSMIC", icon: Sparkles }
    ].map(p => ({
        ...p,
        bosses: bosses.filter(b => b.phase === p.id)
    }));

    const currentPhaseData = phases.find(p => p.id === activePhase);

    return (
        <div className="container mx-auto px-6 pt-12 pb-24 min-h-screen flex flex-col relative">
            <header className="mb-8 border-b border-red-900/30 pb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold font-sans tracking-tight text-red-500 text-glow-red mb-2 uppercase">
                            Hierarchy of Trials
                        </h1>
                        <p className="text-red-400/60 font-mono text-sm tracking-widest flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 animate-pulse" />
                            WARNING: CLASSIFIED ENTITIES DETECTED // AUTHORIZATION LEVEL S
                        </p>
                    </div>

                    <div className="p-3 border border-yellow-900/30 bg-yellow-950/20 rounded-lg shrink-0">
                        <span className="text-yellow-500 font-mono font-bold text-lg flex items-center gap-2">
                            <Coins className="w-5 h-5" /> {initialUserGold.toLocaleString()} G
                        </span>
                    </div>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex flex-wrap gap-2 mb-8">
                {phases.map((phase) => (
                    <button
                        type="button"
                        key={phase.id}
                        onClick={() => setActivePhase(phase.id)}
                        aria-pressed={activePhase === phase.id}
                        aria-label={`Show phase ${phase.id}: ${phase.title}`}
                        className={`px-4 py-2 text-sm font-bold font-mono tracking-wider border transition-all duration-300 clip-path-slant flex items-center gap-2 ${activePhase === phase.id
                            ? "bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                            : "bg-black/40 text-red-900 border-red-900/30 hover:text-red-400 hover:border-red-500/50"
                            }`}
                    >
                        <phase.icon className="w-4 h-4" />
                        PHASE {phase.id} {'//'} {phase.title}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {currentPhaseData && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
                            <h2 className="text-xl font-mono font-bold text-red-400 tracking-[0.2em] uppercase shrink-0">
                                {currentPhaseData.title} PROTOCOL
                            </h2>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
                        </div>


                        {currentPhaseData.bosses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {currentPhaseData.bosses.map((boss) => (
                                    <BossCard
                                        key={boss.id}
                                        boss={boss}
                                        userLevel={initialUserLevel}
                                        userInventory={initialInventory}
                                        keyItems={initialKeys}
                                        storeDiscount={storeDiscount}
                                        onViewIntel={(b) => setSelectedBoss(b)}
                                        onBattle={() => handleBattle(boss.id)}
                                        onPurchaseKey={handlePurchaseKey}
                                        isPending={isPending}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 border border-dashed border-red-900/30 rounded bg-black/20 flex flex-col items-center justify-center gap-4">
                                <SignalHigh className="w-12 h-12 text-red-900/30" />
                                <span className="text-red-900/50 font-mono tracking-widest">
                                    NO SIGNAL DETECTED FROM THIS DIMENSION
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedBoss && (
                <BossIntelModal boss={selectedBoss} userLevel={initialUserLevel} onClose={() => setSelectedBoss(null)} />
            )}


            {/* Battle Result Modal */}
            {battleResult && (
                <BattleResultModal
                    result={{
                        success: battleResult.success,
                        error: battleResult.error,
                        bossName: battleResult.bossName || "Unknown Boss",
                        xp: battleResult.xp || 0,
                        gold: battleResult.gold || 0,
                        drops: battleResult.drops || []
                    }}
                    onClose={() => setBattleResult(null)}
                />
            )}
        </div>
    );
}

function BossCard({ 
    boss, 
    userLevel, 
    userInventory, 
    keyItems, 
    storeDiscount, 
    onViewIntel, 
    onBattle, 
    onPurchaseKey, 
    isPending 
}: { 
    boss: Boss, 
    userLevel: number, 
    userInventory: InventoryItem[], 
    keyItems: any[], 
    storeDiscount: number, 
    onViewIntel: (b: Boss) => void, 
    onBattle: () => void, 
    onPurchaseKey: (itemId: number) => void, 
    isPending: boolean 
}) {
    const isLevelMet = userLevel >= (boss.required_level || 1);
    const isDbUnlocked = boss.status !== 'LOCKED';
    const isUnlocked = isLevelMet || isDbUnlocked;
    const isDefeated = boss.status === 'DEFEATED';



    const isIgris = boss.name.includes("Igris");

    // VISUAL OVERRIDE: Display Igris as S-Rank even if mechanics use A-Rank
    const rank = isIgris ? 'S' : (boss.rank || 'E');

    const keySuffix = getBossKeySuffix(rank);
    const requiredKeyName = `Instant Dungeon Key (${keySuffix})`;

    // Post-Cap users (Level 999+) bypass key requirements
    const isPostCap = userLevel >= 999;
    const hasKey = isPostCap || isIgris || userInventory.some(i => i.item?.name === requiredKeyName && i.quantity > 0);

    const getRankColor = (rank: string) => {
        if (rank.includes('S')) return "text-red-500 border-red-500";
        if (rank.includes('A')) return "text-orange-400 border-orange-400";
        if (rank.includes('B')) return "text-yellow-400 border-yellow-400";
        if (rank === 'X' || rank === 'XX' || rank.includes('XX')) return "text-purple-500 border-purple-500";
        if (rank === 'COSMIC') return "text-indigo-400 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse";
        if (rank === '???') return "text-white border-white";
        return "text-slate-400 border-slate-500"; // E/C/D default
    };

    const rankStyle = getRankColor(rank);

    const cooldown = calculateBossCooldown(boss.last_defeated_at, rank);
    const isReady = cooldown.isReady;

    const borderColor = isDefeated ? (isReady ? "border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "border-green-800") : (isUnlocked ? "border-red-900/50 hover:border-red-500" : "border-slate-800 opacity-75");
    const bgGradient = isDefeated ? "bg-green-950/10" : (isUnlocked ? "bg-red-950/10 group-hover:bg-red-950/20" : "bg-slate-900/20");

    return (
        <div className={`group relative overflow-hidden rounded-lg bg-black border transition-all duration-300 ${borderColor}`}>
            {boss.image_url && (
                <div className="absolute inset-0 z-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={boss.image_url}
                        alt={boss.name || "Boss"}
                        className={`w-full h-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-110 ${!isUnlocked ? "grayscale blur-sm opacity-30" : "opacity-60 group-hover:opacity-80"}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                </div>
            )}

            <div className={`absolute inset-0 transition-colors z-0 ${bgGradient} mix-blend-overlay`} />

            <div className="relative p-6 space-y-4">
                <div className="flex justify-between items-start">
                    <span className={`px-2 py-1 text-xs font-bold border rounded ${rankStyle} bg-black/50`}>
                        RANK {rank}
                    </span>
                    {rank.includes('X') || rank === '???' ? (
                        <Crown className="w-5 h-5 text-purple-500" />
                    ) : (
                        <Skull className={`w-5 h-5 ${!isUnlocked ? "text-slate-600" : (isDefeated ? "text-green-500" : "text-red-500")}`} />
                    )}
                </div>

                <div>
                    <h3 className={`text-lg font-bold font-sans transition-colors ${!isUnlocked ? "text-slate-500" : "text-white group-hover:text-red-400"
                        }`}>
                        {boss.name}
                    </h3>
                    <p className="text-xs font-mono text-cyan-700 mt-1 uppercase tracking-wide">
                        [{boss.type}]
                    </p>
                </div>

                {/* Attributes / Intel Section */}
                <div className="space-y-3">
                    {/* Abilities */}
                    {boss.intel?.abilities && boss.intel.abilities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {boss.intel.abilities.slice(0, 3).map((ability: string, i: number) => (
                                <IntelTooltip key={i} metadata={getAbilityIntel(ability, boss.rank)} position="top">
                                    <span className="text-[9px] px-2 py-0.5 bg-orange-950/30 text-orange-300 border border-orange-900/40 rounded hover:border-orange-500 cursor-help transition-colors">
                                        {ability}
                                    </span>
                                </IntelTooltip>
                            ))}
                        </div>
                    )}

                    {/* Resistances / Weaknesses */}
                    {(boss.intel?.resistances || boss.intel?.weakness) && (
                        <div className="flex flex-wrap gap-1.5">
                            {boss.intel?.weakness && (
                                <IntelTooltip metadata={getWeaknessIntel(boss.intel.weakness)} position="top">
                                    <span className="text-[9px] px-2 py-0.5 bg-cyan-950/30 text-cyan-300 border border-cyan-900/40 rounded hover:border-cyan-500 cursor-help transition-colors">
                                        {boss.intel.weakness}
                                    </span>
                                </IntelTooltip>
                            )}
                            {boss.intel?.resistances?.slice(0, 2).map((res: string, i: number) => (
                                <IntelTooltip key={i} metadata={getResistanceIntel(res)} position="top">
                                    <span className="text-[9px] px-2 py-0.5 bg-slate-900/50 text-slate-400 border border-slate-800 rounded hover:border-slate-500 cursor-help transition-colors">
                                        {res}
                                    </span>
                                </IntelTooltip>
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {boss.description}
                </p>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono relative gap-2">
                    <span className={isUnlocked ? "text-red-400" : "text-slate-600"}>
                        REQ: LVL {boss.required_level}
                    </span>

                    <div className="flex gap-2 min-w-0">
                        <button
                            type="button"
                            onClick={() => onViewIntel(boss)}
                            aria-label={`View intel for ${boss.name}`}
                            className="flex items-center gap-1 text-cyan-600 hover:text-white transition-colors whitespace-nowrap"
                        >
                            <Eye className="w-3 h-3" /> INTEL
                        </button>

                        {isUnlocked && (!isDefeated || boss.last_defeated_at) && (
                            <div className="flex items-center gap-2">
                                {!hasKey && !isPostCap && !isIgris && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const keyMeta = keyItems.find(k => k.name === requiredKeyName);
                                            if (keyMeta) onPurchaseKey(keyMeta.id);
                                        }}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-yellow-600/20 border border-yellow-600/50 text-yellow-500 hover:bg-yellow-600/30 hover:border-yellow-500 transition-all rounded text-[10px] uppercase font-bold"
                                    >
                                        <ShoppingBag className="w-3 h-3" />
                                        {(() => {
                                            const keyMeta = keyItems.find(k => k.name === requiredKeyName);
                                            const price = keyMeta ? Math.floor(Number(keyMeta.price) * (1 - storeDiscount)) : 0;
                                            return `BUY ${price.toLocaleString()}G`;
                                        })()}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={onBattle}
                                    disabled={isPending || !hasKey || !isLevelMet || !isReady}
                                    className={`flex items-center gap-1 font-bold animate-pulse hover:animate-none transition-colors disabled:opacity-50 disabled:animate-none whitespace-nowrap ${hasKey && isLevelMet && isReady ? "text-red-500 hover:text-white" : "text-slate-500 cursor-not-allowed"}`}
                                >
                                    <Sword className="w-3 h-3" />
                                    {isPending ? "ENGAGING..." :
                                        (!isLevelMet ? `REQ. LVL ${boss.required_level}` :
                                            (isIgris && !boss.last_defeated_at ? "JOB TRIAL" :
                                                (!isReady ? "COOLDOWN" : (hasKey ? (isDefeated ? "RE-ENTER" : "FIGHT") : "KEY REQ."))))}
                                </button>
                            </div>
                        )}

                        {isDefeated && (
                            <div className="flex flex-col items-end leading-none">
                                <span className="text-green-600 font-bold flex items-center gap-1 whitespace-nowrap">
                                    EXECUTED
                                </span>
                                {boss.last_defeated_at && (
                                    <CountdownTimer lastDefeatedAt={boss.last_defeated_at} rank={rank} />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isUnlocked && !isDefeated && !hasKey && (
                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-[10px] text-red-500 border-l border-b border-red-900/50 rounded-bl">
                        Need: {requiredKeyName}
                    </div>
                )}
            </div>
        </div>
    );
}

import { createPortal } from "react-dom";

function IntelTooltip({
    children,
    metadata,
    position = "right"
}: {
    children: React.ReactNode,
    metadata: IntelMetadata,
    position?: "left" | "right" | "top"
}) {
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

    const handleMouseEnter = (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
        setMousePos(null);
    };

    return (
        <div
            className="inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {mousePos && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed pointer-events-none transition-opacity duration-200 z-[9999]"
                    style={{
                        top: mousePos.y + 10,
                        left: position === "right" ? mousePos.x + 20 : mousePos.x - 280,
                        // Ensure it doesn't go off bottom
                        transform: mousePos.y > (typeof window !== 'undefined' ? window.innerHeight - 200 : 0) ? 'translateY(-100%)' : 'none'
                    }}
                >
                    <div className="w-[260px] p-4 bg-black/95 border border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.5)]
                            rounded-lg border-t-2 border-t-cyan-400 animate-in fade-in zoom-in-95 duration-150">

                        <div className="text-cyan-400 font-mono text-xs font-bold border-b border-cyan-900 pb-2 mb-2 uppercase tracking-tighter">
                            {metadata.title}
                        </div>

                        <p className="text-slate-300 text-[11px] leading-relaxed mb-3">
                            {metadata.description}
                        </p>

                        {metadata.stats && metadata.stats.length > 0 && (
                            <div className="space-y-1 mb-3">
                                {metadata.stats.map((stat, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px] text-cyan-200 font-mono">
                                        <span className="text-cyan-600">»</span> {stat}
                                    </div>
                                ))}
                            </div>
                        )}

                        {metadata.flavor && (
                            <div className="text-[9px] text-slate-500 italic border-t border-cyan-900/50 pt-2 font-mono">
                                {metadata.flavor}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function BossIntelModal({ boss, userLevel, onClose }: { boss: Boss, userLevel: number, onClose: () => void }) {
    if (!boss.intel) return null;

    const strategy = boss.intel.strategy || "ANALYSIS FAILED: No strategic data available for this entity.";
    const abilities = boss.intel.abilities || [];
    const weakness = boss.intel.weakness || "Unknown";
    const resistances = boss.intel.resistances || [];
    const lore = boss.intel.lore || "No historical records found in the System database.";

    const isPostCapPlayer = userLevel >= 999;
    const estMaxHp = calculateBossMaxHP(boss.rank, userLevel, boss.max_hp || 1000, isPostCapPlayer);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-black border border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.2)] rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-cyan-950/20 p-4 border-b border-cyan-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Skull className="w-6 h-6 text-cyan-400" />
                        <div>
                            <h2 className="text-xl font-bold font-sans text-white tracking-wide uppercase">
                                SYSTEM DATABASE : {boss.name}
                            </h2>
                            <div className="flex gap-2 text-[10px] font-mono text-cyan-600">
                                <span>RANK: {boss.rank}</span>
                                <span>TYPE: {boss.type.toUpperCase()}</span>
                                <span className="text-red-400 border-l border-cyan-800 pl-2 ml-1">EST. HP: {estMaxHp.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close boss intel" className="text-cyan-600 hover:text-cyan-400 font-mono text-xl">
                        [X]
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-cyan-400 font-mono border-b border-cyan-900/50 pb-1 w-full">
                            {'//'} STRATEGIC ANALYSIS
                        </h3>
                        <p className="text-sm text-cyan-100/90 leading-relaxed font-mono">
                            {strategy}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-red-400 font-mono uppercase">
                                Known Abilities
                            </h3>
                            {abilities.length > 0 ? (
                                <ul className="space-y-1">
                                    {abilities.map((ability: string, i: number) => (
                                        <li key={i} className="text-xs text-slate-400">
                                            <IntelTooltip metadata={getAbilityIntel(ability, boss.rank)} position="right">
                                                <div className="flex items-start gap-2 hover:text-cyan-300 transition-colors cursor-help py-0.5">
                                                    <span className="text-red-900 mt-1">▶</span>
                                                    {ability}
                                                </div>
                                            </IntelTooltip>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-slate-600 italic">No ability signatures detected.</p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-xs font-bold text-green-400 font-mono uppercase">
                                    Vulnerabilities
                                </h3>
                                <div className="text-xs text-green-200/80 border border-green-900/30 bg-green-950/10 p-2 rounded cursor-help transition-colors hover:border-green-500/50">
                                    <IntelTooltip metadata={getResistanceIntel(weakness)}>
                                        <div className="w-full h-full">{weakness}</div>
                                    </IntelTooltip>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xs font-bold text-orange-400 font-mono uppercase">
                                    Resistances
                                </h3>
                                <div className="flex flex-wrap gap-1">
                                    {resistances.length > 0 ? (
                                        resistances.map((res: string, i: number) => (
                                            <IntelTooltip key={i} metadata={getResistanceIntel(res)} position="left">
                                                <span className="text-[10px] px-2 py-1 bg-orange-950/20 text-orange-300 border border-orange-900/40 rounded hover:border-orange-500 cursor-help transition-colors">
                                                    {res}
                                                </span>
                                            </IntelTooltip>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-slate-600">None detected</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-cyan-900/30">
                        <h3 className="text-xs font-bold text-slate-500 font-mono uppercase">
                            Archived Lore
                        </h3>
                        <p className="text-xs text-slate-500 italic leading-relaxed font-serif">
                            &quot;{lore}&quot;
                        </p>
                    </div>
                </div>

                <div className="p-3 bg-black border-t border-cyan-900/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-cyan-950/30 border border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 text-xs font-mono font-bold tracking-wider transition-colors"
                    >
                        CLOSE TERMINAL
                    </button>
                </div>
            </div>
        </div>
    );
}

function CountdownTimer({ lastDefeatedAt, rank }: { lastDefeatedAt: string, rank: string }) {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const calculateTime = () => {
            const cooldown = calculateBossCooldown(lastDefeatedAt, rank);

            if (cooldown.isReady) {
                setTimeLeft("READY");
                return;
            }

            if (cooldown.d > 0) setTimeLeft(`${cooldown.d}d ${cooldown.h}h`);
            else setTimeLeft(`${cooldown.h}h ${cooldown.m}m`);
        };

        calculateTime();
        const interval = setInterval(calculateTime, 60000);
        return () => clearInterval(interval);
    }, [lastDefeatedAt, rank]);

    if (timeLeft === "READY") return <span className="text-[10px] text-green-400 font-mono animate-pulse">GATE OPEN</span>;

    return (
        <span className="text-[10px] text-slate-500 font-mono">
            REGEN: {timeLeft}
        </span>
    );
}
