"use client";

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { PlusCircle, Loader2, Info } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { allocateStatAction } from "@/app/actions/stats";
// import { cn } from "@/lib/utils"; // Removed unused import
import { useSystemNotification } from "@/components/system/NotificationProvider";
import { SystemWidget } from "@/components/dashboard/SystemWidget";
import { ResetApButton } from "@/components/dashboard/ResetApButton";
import { createPortal } from "react-dom";
import { CLASS_MODIFIERS } from "@/lib/stats-manager";

interface StatsRadarProps {
    strength: number;
    agility: number;
    intelligence: number;
    vitality: number;
    perception: number;
    availableAp: number;
    hunterClass?: string;
    baseStats?: {
        strength: number;
        agility: number;
        intelligence: number;
        vitality: number;
        perception: number;
    };
    derivedStats?: {
        critChance: number;
        dodgeChance: number;
        lootFind: number;
        finalAtk: number;
        finalDef: number;
    };
    onUpdate?: () => void;
}

type ViewMode = 'EFFECTIVE' | 'BASE';

export function StatsRadar({
    strength = 10,
    agility = 10,
    intelligence = 10,
    vitality = 10,
    perception = 10,
    availableAp = 0,
    hunterClass = 'NONE',
    baseStats,
    derivedStats,
    onUpdate
}: Partial<StatsRadarProps>) {

    const [allocating, setAllocating] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('EFFECTIVE');

    const { showNotification } = useSystemNotification();

    const allocatingRef = useRef<boolean>(false);

    const handleAllocate = async (stat: string, amount: number = 1) => {
        // Double-click protection
        if (allocating || allocatingRef.current) return;

        allocatingRef.current = true;
        setAllocating(stat);

        try {
            const result = await allocateStatAction(stat, amount);
            if (result.success) {
                if (result.data?.unlocked && result.data.unlocked.length > 0) {
                    result.data.unlocked.forEach((ach: any) => {
                        showNotification({
                            title: "ACHIEVEMENT UNLOCKED",
                            message: ach.name,
                            type: 'ACHIEVEMENT',
                            xp: ach.xp,
                            gold: ach.gold,
                            item: ach.item,
                            rarity: ach.item?.rarity
                        });
                    });
                }

                if (onUpdate) onUpdate();
            } else {
                console.error(result.error);
                alert(result.error);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to allocate point.");
        } finally {
            setAllocating(null);
            // Small delay before allowing next allocation
            setTimeout(() => {
                allocatingRef.current = false;
            }, 300);
        }
    };

    const getStatImpact = useCallback((statCode: string) => {
        const hClass = hunterClass || 'NONE';
        const classMod = CLASS_MODIFIERS[hClass] || CLASS_MODIFIERS['NONE'];
        const archetype = classMod.archetype || 'POWER';

        switch (statCode) {
            case 'STR':
                const strAtk = archetype === 'POWER' ? '1.2' : archetype === 'SPEED' ? '0.3' : '0.0';
                return `STRENGTH: Increases physical power and stability. Currently contributing +${strAtk} to your ATK based on your ${hClass} class. Also increases Max HP by +5 per point.`;
            case 'VIT':
                return `VITALITY: Increases physical resilience. Each point adds +1.2 to DEF and +10 to Max HP. Also boosts health regeneration rates.`;
            case 'AGI':
                const agiAtk = archetype === 'SPEED' ? '0.8' : archetype === 'POWER' ? '0.2' : '0.0';
                return `AGILITY: Increases movement speed and combat reflexes. Currently adding +${agiAtk} to your ATK. Critical Hit Chance rises by +0.2% per combined AGI/PER point (10% per 50 points).`;
            case 'INT':
                const intAtk = archetype === 'MAGIC' ? '1.5' : '0.0';
                return `INTELLIGENCE: Governs mana flow and mental acuity. Currently adding +${intAtk} to your ATK. Each point adds +10 to Max Mana and boosts mana regeneration rates.`;
            case 'PER':
                return `PERCEPTION: Sharpens senses and critical awareness. Increases Critical Hit Chance and improves chances of finding rare loot in Dungeons.`;
            default:
                return "";
        }
    }, [hunterClass]);

    const handleMouseEnter = (e: React.MouseEvent, statCode: string) => {
        const content = getStatImpact(statCode);
        setTooltip({
            content,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tooltip) {
            setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        }
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    // Determine which stats to show based on view mode
    const displayStats = viewMode === 'EFFECTIVE'
        ? { strength, vitality, intelligence, perception, agility }
        : (baseStats || { strength, vitality, intelligence, perception, agility });

    // Calculate dynamic fullMark based on highest stat (min 150, round to nearest 50)
    const maxStat = Math.max(
        displayStats.strength,
        displayStats.vitality,
        displayStats.intelligence,
        displayStats.perception,
        displayStats.agility,
        150
    );
    const fullMark = Math.ceil(maxStat / 50) * 50;

    const data = [
        { subject: 'STR', A: displayStats.strength, B: viewMode === 'EFFECTIVE' ? baseStats?.strength || 0 : strength, fullMark },
        { subject: 'VIT', A: displayStats.vitality, B: viewMode === 'EFFECTIVE' ? baseStats?.vitality || 0 : vitality, fullMark },
        { subject: 'INT', A: displayStats.intelligence, B: viewMode === 'EFFECTIVE' ? baseStats?.intelligence || 0 : intelligence, fullMark },
        { subject: 'PER', A: displayStats.perception, B: viewMode === 'EFFECTIVE' ? baseStats?.perception || 0 : perception, fullMark },
        { subject: 'AGI', A: displayStats.agility, B: viewMode === 'EFFECTIVE' ? baseStats?.agility || 0 : agility, fullMark },
    ];

    return (
        <div className="glass-panel p-6 rounded-lg flex flex-col items-center justify-center min-h-[400px] relative">
            {/* Header */}
            <div className="w-full border-b border-cyan-900/30 pb-4 mb-4 flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h3 className="text-cyan-400 font-bold font-mono tracking-widest text-sm">STATS ANALYSIS</h3>
                        {availableAp > 0 && <span className="text-[10px] text-yellow-500 font-bold animate-pulse mt-1">⚠ AP AVAILABLE: {availableAp}</span>}
                    </div>

                    {/* Reset AP Button — Moved to left side to prevent overlap with clock */}
                    <ResetApButton
                        onUpdate={onUpdate}
                        currentStats={baseStats}
                    />
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    {/* Animated Toggle Switch */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'EFFECTIVE' ? 'BASE' : 'EFFECTIVE')}
                            className="relative flex items-center h-7 w-36 bg-black/60 border border-cyan-900/50 rounded-full p-1 transition-all duration-300 hover:border-cyan-500/50 group"
                        >
                            {/* Sliding Background */}
                            <div
                                className={`absolute h-5 w-16 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-full transition-transform duration-300 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)] ${viewMode === 'EFFECTIVE' ? 'translate-x-0' : 'translate-x-16'
                                    }`}
                            />

                            {/* Labels */}
                            <span className={`relative z-10 flex-1 text-[10px] font-mono font-bold tracking-wider text-center transition-colors duration-200 ${viewMode === 'EFFECTIVE' ? 'text-white' : 'text-cyan-700'
                                }`}>
                                EFFECTIVE
                            </span>
                            <span className={`relative z-10 flex-1 text-[10px] font-mono font-bold tracking-wider text-center transition-colors duration-200 ${viewMode === 'BASE' ? 'text-white' : 'text-cyan-700'
                                }`}>
                                BASE
                            </span>
                        </button>
                    </div>

                    {/* System Widget */}
                    <SystemWidget />
                </div>
            </div>

            <div className="flex flex-col md:flex-row w-full h-full gap-8">
                {/* Left Side: Radar Chart */}
                <div className="w-full md:w-3/5 h-[300px] relative">
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                            <PolarGrid stroke="#0e7490" strokeOpacity={0.3} />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: '#00F2FF', fontFamily: 'var(--font-jetbrains-mono)', fontSize: 12, fontWeight: 'bold' }}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, fullMark]} tick={false} axisLine={false} />

                            {/* Effective Stats (Filled) */}
                            <Radar
                                name="Effective"
                                dataKey="A"
                                stroke="#00F2FF"
                                strokeWidth={2}
                                fill="#00F2FF"
                                fillOpacity={0.3}
                            />

                            {/* Base Stats (Stroke Only) */}
                            {baseStats && (
                                <Radar
                                    name="Base"
                                    dataKey="B"
                                    stroke="#FFFFFF"
                                    strokeWidth={1}
                                    strokeOpacity={0.5}
                                    fill="transparent"
                                    strokeDasharray="4 4"
                                />
                            )}
                        </RadarChart>
                    </ResponsiveContainer>

                    {/* Decorative center glowing dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_15px_#00F2FF]" />
                </div>

                {/* Right Side: Stats List */}
                <div className="w-full md:w-2/5 flex flex-col justify-center space-y-3 font-mono text-sm">
                    {[
                        { label: "STRENGTH", value: strength, code: "STR", key: "Strength", baseValue: baseStats?.strength || strength },
                        { label: "VITALITY", value: vitality, code: "VIT", key: "Vitality", baseValue: baseStats?.vitality || vitality },
                        { label: "AGILITY", value: agility, code: "AGI", key: "Agility", baseValue: baseStats?.agility || agility },
                        { label: "INTELLIGENCE", value: intelligence, code: "INT", key: "Intelligence", baseValue: baseStats?.intelligence || intelligence },
                        { label: "PERCEPTION", value: perception, code: "PER", key: "Perception", baseValue: baseStats?.perception || perception }
                    ].map((stat) => {
                        const displayValue = viewMode === 'EFFECTIVE' ? stat.value : stat.baseValue;
                        const bonus = stat.value - stat.baseValue;
                        const barPercentage = (displayValue / fullMark) * 100;

                        return (
                            <div
                                key={stat.code}
                                className="group relative"
                                onMouseEnter={(e) => handleMouseEnter(e, stat.code)}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                            >
                                {/* Stat Header */}
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-cyan-600 font-bold text-xs">{stat.code}</span>
                                        <span className="text-slate-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity animate-pulse">
                                            <Info className="w-3 h-3" />
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Value Display */}
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold text-white transition-all group-hover:text-cyan-300">
                                                {displayValue}
                                            </span>
                                            {viewMode === 'EFFECTIVE' && bonus > 0 && (
                                                <span className="text-xs text-emerald-400 font-bold">
                                                    +{bonus}
                                                </span>
                                            )}
                                        </div>

                                        {/* Allocation Buttons (+1 & +10) */}
                                        {availableAp > 0 && (
                                            <div className="flex items-center gap-1.5 z-10">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const qty = e.shiftKey ? Math.min(10, availableAp) : 1;
                                                        handleAllocate(stat.key, qty);
                                                    }}
                                                    disabled={!!allocating}
                                                    className="text-cyan-600 hover:text-white transition-colors disabled:opacity-50"
                                                    title="Allocate 1 AP (Shift+Click for 10 AP)"
                                                >
                                                    {allocating === stat.key ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <PlusCircle className="w-5 h-5" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAllocate(stat.key, Math.min(10, availableAp));
                                                    }}
                                                    disabled={!!allocating}
                                                    className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-cyan-950/80 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-800/60 hover:border-cyan-400 rounded transition-all disabled:opacity-50 active:scale-95"
                                                    title="Allocate 10 AP"
                                                >
                                                    +10
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="relative h-2 bg-black/60 border border-cyan-900/30 rounded-full overflow-hidden">
                                    {/* Background gradient bar */}
                                    <div
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                        style={{ width: `${Math.min(barPercentage, 100)}%` }}
                                    />

                                    {/* Equipment bonus overlay (lighter shade) */}
                                    {viewMode === 'EFFECTIVE' && bonus > 0 && (
                                        <div
                                            className="absolute inset-y-0 bg-emerald-400/40 rounded-full transition-all duration-500"
                                            style={{
                                                left: `${((stat.baseValue / fullMark) * 100)}%`,
                                                width: `${((bonus / fullMark) * 100)}%`
                                            }}
                                        />
                                    )}

                                    {/* Animated glow effect */}
                                    <div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                                        style={{ width: `${Math.min(barPercentage, 100)}%` }}
                                    />
                                </div>

                                {/* Base stat indicator */}
                                {viewMode === 'EFFECTIVE' && baseStats && (
                                    <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                                        BASE: {stat.baseValue}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Derived Stats Panel */}
            {derivedStats && (
                <div className="w-full mt-6 pt-6 border-t border-cyan-900/30">
                    <h4 className="text-xs font-mono font-bold text-cyan-600 tracking-widest mb-3 flex items-center gap-2">
                        <span className="text-cyan-800">▸</span> COMBAT ANALYTICS
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Critical Chance */}
                        <div className="bg-black/40 border border-cyan-900/30 rounded p-3 hover:border-cyan-700/50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-cyan-700 uppercase tracking-wider">Critical</span>
                                <span className="text-xs text-yellow-500">⚔</span>
                            </div>
                            <div className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                                {derivedStats.critChance.toFixed(1)}%
                            </div>
                        </div>

                        {/* Dodge Chance */}
                        <div className="bg-black/40 border border-cyan-900/30 rounded p-3 hover:border-cyan-700/50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-cyan-700 uppercase tracking-wider">Dodge</span>
                                <span className="text-xs text-blue-400">⚡</span>
                            </div>
                            <div className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                                {derivedStats.dodgeChance.toFixed(1)}%
                            </div>
                        </div>

                        {/* Loot Find */}
                        <div className="bg-black/40 border border-cyan-900/30 rounded p-3 hover:border-cyan-700/50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-cyan-700 uppercase tracking-wider">Loot Find</span>
                                <span className="text-xs text-emerald-400">◆</span>
                            </div>
                            <div className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                                {derivedStats.lootFind.toFixed(1)}%
                            </div>
                        </div>

                        {/* Combat Power */}
                        <div className="bg-black/40 border border-cyan-900/30 rounded p-3 hover:border-cyan-700/50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-cyan-700 uppercase tracking-wider">Combat</span>
                                <span className="text-xs text-red-400">⚔</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-600 uppercase">ATK</span>
                                    <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{derivedStats.finalAtk}</span>
                                </div>
                                <div className="text-slate-700">/</div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-600 uppercase">DEF</span>
                                    <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{derivedStats.finalDef}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tooltip Portal */}
            {tooltip && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[10000] pointer-events-none p-3 bg-black/95 border border-cyan-500/50 rounded shadow-[0_0_20px_rgba(0,242,255,0.2)] max-w-[250px] animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: tooltip.y + 15,
                        left: tooltip.x + 15,
                        // Flip if near edge
                        transform: tooltip.x > (window.innerWidth / 2) ? 'translateX(-100%)' : 'none'
                    }}
                >
                    <p className="text-xs font-mono text-cyan-100 leading-relaxed uppercase">
                        {tooltip.content}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-[8px] text-cyan-500/60 font-bold border-t border-cyan-900/30 pt-1">
                        <Info className="w-2.5 h-2.5" />
                        SCALING BASED ON {hunterClass.toUpperCase()} CLASS
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
