"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { Award, CheckIcon, Dumbbell, Skull, Cpu, Brain, Star, AlertTriangle, Repeat, Calendar, Clock, Wind, Eye, Music, Footprints, Flower, TrendingUp, Scroll, Gamepad2, Ghost, Pencil, Save, X, ChevronDown, ChevronUp } from "lucide-react";
import { calculateScaledQuestReward } from "@/lib/system/formula";
import { calculateQuestManaEfficiency } from "@/lib/system/skill-effects";
import { updateCustomQuestAction } from "@/app/actions/quests";

type Quest = Database['public']['Tables']['quests']['Row'] & { zone_name?: string };

interface QuestProps {
    quest: Quest;
    userLevel?: number;
    userStats?: { strength: number, agility: number, intelligence: number, vitality: number, perception: number };
    userMana?: number;
    onComplete?: (id: number) => void;
    onFail?: (id: number) => void;
    voidStrikeAvailable?: boolean;
    onVoidStrike?: (id: number) => void;
    modifiers?: Record<string, number>;
    availableShadows?: number;
    hunterClass?: string;
    onDelegate?: (id: number) => void;
    zones?: any[];
}


function getQuestIcon(quest: Quest) {
    if (quest.type === 'PENALTY' || quest.title.startsWith('PENALTY:')) return AlertTriangle;

    // Type priority
    switch (quest.type) {
        case 'Training': return Dumbbell;
        case 'Dungeon':
        case 'Red Gate': return Skull;
        case 'System': return Cpu;
        case 'Intellect': return Brain;
        case 'Special': return Star;
        case 'Meditation':
            const title = quest.title.toLowerCase();
            if (title.includes('breathing')) return Wind;
            if (title.includes('gazing')) return Eye;
            if (title.includes('mantra')) return Music;
            if (title.includes('walking')) return Footprints;
            if (title.includes('sitting')) return Flower;
            return Brain; // Default for meditation
    }

    // Frequency fallback if type is generic or missing specific mapping
    switch (quest.frequency) {
        case 'Daily': return Repeat;
        case 'Weekly': return Calendar;
        case 'Monthly': return Clock;
    }

    return Scroll;
}

export function QuestCard({ quest, userLevel = 1, userStats, userMana = 0, onComplete, onFail, voidStrikeAvailable = false, onVoidStrike, modifiers = {}, availableShadows = 0, onDelegate, hunterClass = 'NONE', zones = [] }: QuestProps) {
    const isLocked = false;
    const isPenalty = quest.type === 'PENALTY' || quest.title.startsWith('PENALTY:');
    const isCustom = quest.type === 'CUSTOM';
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(quest.title);
    const [editDiff, setEditDiff] = useState(quest.difficulty || 'E');
    const [editFreq, setEditFreq] = useState(quest.frequency || 'Once');
    const [editDesc, setEditDesc] = useState(quest.description || '');
    const [editZoneId, setEditZoneId] = useState(quest.zone_id || '');
    const [isSaving, setIsSaving] = useState(false);

    const [isDescExpanded, setIsDescExpanded] = useState(false);
    const isLongDesc = quest.description && (quest.description.length > 85 || (quest.description.match(/\n/g) || []).length >= 2);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await updateCustomQuestAction({
                questId: quest.id,
                title: editTitle,
                difficulty: editDiff,
                frequency: editFreq,
                description: editDesc,
                zoneId: editZoneId || undefined
            });
            if (res.success) {
                setIsEditing(false);
                router.refresh();
            } else {
                alert("Failed to update quest: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to parse skill rewards since it's JSONB
    const skillRewards = quest.skill_rewards as Record<string, number> | null;
    const rankColors: Record<string, string> = {
        'E': 'border-slate-600 text-slate-400',
        'D': 'border-cyan-600 text-cyan-400',
        'C': 'border-blue-500 text-blue-400',
        'B': 'border-purple-500 text-purple-400',
        'A': 'border-red-500 text-red-500',
        'S': 'border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]',
        'S+': 'border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]',
        'COSMIC': 'border-pink-500/50 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]',
    };

    const rankColor = rankColors[quest.difficulty || 'E'] || rankColors['E'];

    // Icon Mapping Logic
    const QuestIcon = getQuestIcon(quest);

    // --- REWARD SCALING CALCULATION (UI PREVIEW) ---
    // If editing, we should ideally preview the NEW rewards, but for simplicity, we show current.
    // Or we could pass 'editDiff' to the calculator if we wanted dynamic preview.
    // Let's stick to current for now until saved.
    const {
        finalXp,
        finalGold,
        finalManaCost: scaledManaCost,
        synergyStat,
        synergyBonusXp,
        levelMult,
        hasBonus
    } = calculateScaledQuestReward(
        quest.xp_reward || 0,
        quest.gold_reward || 0,
        quest.mana_cost || 0,
        userLevel,
        userStats,
        skillRewards,
        0, // completedDailies not passed here yet
        quest.difficulty
    );

    const manaEfficiency = calculateQuestManaEfficiency(modifiers);
    const finalManaCost = Math.floor(scaledManaCost * manaEfficiency);

    const scaledXpBase = Math.floor((quest.xp_reward || 0) * levelMult);


    return (
        <div className={cn(
            "bg-[#02060a] border rounded p-4 relative flex flex-col justify-between group h-full transition-all duration-300",
            isPenalty ? 'border-red-900 shadow-[0_0_20px_rgba(220,38,38,0.1)]' : rankColors[quest.difficulty || 'E'].split(' ')[0], // Border color
            isLocked ? "opacity-50 grayscale select-none" : "hover:bg-[#050a10]"
        )}>
            {/* Rank Badge */}
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                {isCustom && !isEditing && (
                    <button
                        onClick={() => {
                            setIsEditing(true);
                            setEditTitle(quest.title);
                            setEditDiff(quest.difficulty || 'E');
                            setEditFreq(quest.frequency || 'Once');
                            setEditDesc(quest.description || '');
                            setEditZoneId(quest.zone_id || '');
                        }}
                        className="text-slate-600 hover:text-cyan-400 transition-colors"
                        title="Edit Custom Quest"
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                )}

                <span className={cn(
                    "text-xs font-bold font-mono px-2 py-0.5 rounded border bg-black/50",
                    isPenalty
                        ? "border-red-600 text-red-500 animate-pulse shadow-[0_0_10px_#ef4444]"
                        : rankColor
                )}>
                    {isPenalty ? '⚠ PENALTY' : `RANK ${quest.difficulty || 'E'} `}
                </span>

                {quest.zone_name && !isEditing && (
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border border-cyan-800 bg-cyan-950/50 text-cyan-500 uppercase">
                        {quest.zone_name}
                    </span>
                )}
            </div>

            <div className="mb-4">

                <div className="flex justify-between items-start mb-2 pr-16 relative">
                    <div className="flex items-center gap-3 w-full">
                        {/* Quest Icon - NEW */}
                        <div className={cn(
                            "p-2 rounded border bg-black/50 shrink-0",
                            isPenalty ? "border-red-900 text-red-500" : rankColor.replace("text-slate-400", "text-slate-500") // Use border color but dim text slightly
                        )}>
                            {React.createElement(QuestIcon, { className: "w-5 h-5" })}
                        </div>

                        {isEditing ? (
                            <div className="flex flex-col gap-2 w-full pr-2">
                                <input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-white px-2 py-1 text-sm rounded focus:border-cyan-500 outline-none w-full font-bold"
                                    placeholder="Quest Title"
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={editDiff}
                                        onChange={(e) => setEditDiff(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 text-xs px-1 py-1 rounded text-slate-300 focus:border-cyan-500 outline-none"
                                    >
                                        {['E', 'D', 'C', 'B', 'A', 'S'].map(r => <option key={r} value={r}>Rank {r}</option>)}
                                    </select>
                                    <select
                                        value={editFreq}
                                        onChange={(e) => setEditFreq(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 text-xs px-1 py-1 rounded text-slate-300 focus:border-cyan-500 outline-none"
                                    >
                                        <option value="Once">Once</option>
                                        <option value="Daily">Daily</option>
                                    </select>
                                </div>
                                <div className="mt-2 space-y-2">
                                    <textarea
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 text-xs px-2 py-1 text-slate-300 w-full rounded focus:border-cyan-500 outline-none resize-none"
                                        placeholder="Description"
                                        rows={2}
                                    />
                                    <select
                                        value={editZoneId}
                                        onChange={(e) => setEditZoneId(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 text-xs px-1 py-1 rounded text-slate-300 focus:border-cyan-500 outline-none w-full"
                                    >
                                        <option value="">No Zone</option>
                                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-green-900/40 text-green-400 border border-green-800 hover:bg-green-900/60 text-xs px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <Save className="w-3 h-3" /> Save
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="bg-red-900/20 text-red-400 border border-red-800 hover:bg-red-900/40 text-xs px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <X className="w-3 h-3" /> Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <h3 className={cn(
                                "text-xl font-bold font-sans tracking-wide uppercase break-words w-full",
                                isPenalty ? "text-red-500 glitch-text" : "text-white"
                            )}>
                                {quest.title}
                            </h3>
                        )}
                    </div>



                    {isPenalty && (
                        <div className="absolute -top-6 -left-2 text-[10px] text-red-800 font-mono opacity-50 pointer-events-none">
                            System.Error.404
                        </div>
                    )}
                </div>

                {quest.description && (
                    <div className="mb-3 pl-1">
                        <p 
                            className={cn(
                                "text-xs leading-relaxed whitespace-pre-wrap transition-all duration-300",
                                !isDescExpanded ? "line-clamp-2" : "",
                                isPenalty ? "text-red-400/70 font-mono italic" : "text-slate-400",
                                isLongDesc && !isDescExpanded && "cursor-pointer hover:text-slate-300"
                            )}
                            onClick={() => {
                                if (isLongDesc && !isDescExpanded) setIsDescExpanded(true);
                            }}
                        >
                            {quest.description || (isPenalty ? "Unmet expectations have consequences. Restore balance immediately." : "No tactical details provided.")}
                        </p>
                        {isLongDesc && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDescExpanded(!isDescExpanded);
                                }}
                                className="text-[10px] text-cyan-700 hover:text-cyan-400 font-mono mt-1.5 transition-colors flex items-center gap-1 group/descbtn"
                            >
                                {isDescExpanded ? (
                                    <>HIDE LOG <ChevronUp className="w-3 h-3 group-hover/descbtn:-translate-y-0.5 transition-transform" /></>
                                ) : (
                                    <>READ LOG <ChevronDown className="w-3 h-3 group-hover/descbtn:translate-y-0.5 transition-transform" /></>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Recurrence Badge */}
                {quest.frequency && quest.frequency !== 'Once' && (
                    <div className="mb-2">
                        <span className="text-[10px] uppercase font-bold text-cyan-500 border border-cyan-900/50 bg-cyan-950/30 px-1.5 py-0.5 rounded">
                            ⟳ {quest.frequency}
                        </span>
                    </div>
                )}

                {/* Rewards & Cost - HIDDEN FOR PENALTY unless negative? Actually just hide purely for Penalty. */}
                {quest.type !== 'PENALTY' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {/* Mana Cost Badge - FIXED: Only show if > 0 */}
                        {finalManaCost > 0 && (
                            <div className={cn(
                                "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono",
                                userMana >= finalManaCost
                                    ? "bg-blue-950/20 text-blue-400 border-blue-900/40"
                                    : "bg-red-950/20 text-red-400 border-red-900/40"
                            )}>
                                <span className="text-[8px]">MP</span>
                                -{finalManaCost}
                            </div>
                        )}

                        {quest.xp_reward && quest.xp_reward > 0 ? (
                            <div className={cn(
                                "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                                hasBonus
                                    ? "bg-cyan-950/40 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.1)]"
                                    : "bg-blue-950/30 text-blue-300 border-blue-900/30"
                            )}>
                                <Award className="w-3 h-3" />
                                {finalXp.toLocaleString()} XP
                                {synergyBonusXp > 0 && (
                                    <span className="text-[8px] text-cyan-500 font-bold ml-0.5 animate-pulse">
                                        +{Math.round((synergyBonusXp / scaledXpBase) * 100)}%
                                    </span>
                                )}
                            </div>
                        ) : null}

                        {quest.gold_reward && quest.gold_reward > 0 ? (
                            <div className={cn(
                                "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                                hasBonus
                                    ? "bg-yellow-950/30 text-yellow-400 border-yellow-500/40"
                                    : "bg-yellow-950/20 text-yellow-500 border-yellow-900/30"
                            )}>
                                <span>⛃</span>
                                {finalGold.toLocaleString()}G
                            </div>
                        ) : null}

                        {skillRewards && (() => {
                            const { Mana, ...otherSkills } = skillRewards;
                            return (
                                <>
                                    {Mana !== undefined && Mana > 0 && (
                                        <div className="flex items-center gap-1 text-[10px] bg-blue-950/40 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                                            <span className="font-bold">MP</span>
                                            +{Mana}
                                        </div>
                                    )}
                                    {Object.entries(otherSkills).map(([skill, val]) => (
                                        <div key={skill} className="text-[10px] bg-purple-950/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-900/30 uppercase">
                                            +{val} {skill}
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* Scaling Indicator (Synergy/Level) */}
                {hasBonus && quest.type !== 'PENALTY' && (
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-[9px] font-mono text-cyan-500/80 uppercase tracking-tighter">
                            <TrendingUp className="w-3 h-3" />
                            Level Rewards Active ({Math.round(levelMult * 100)}%)
                        </div>
                        {synergyStat && (
                            <div className="text-[9px] font-mono text-purple-400/80 uppercase tracking-tighter italic">
                                + {synergyStat} Synergy
                            </div>
                        )}
                    </div>
                )}

                {/* Survival Notice for Penalty */}
                {isPenalty && (
                    <div className="mt-2 text-[10px] text-red-500 font-mono border border-red-900/50 bg-red-950/20 px-2 py-1.5 rounded flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 animate-pulse" />
                        <span>SURVIVAL OBJECTIVE: COMPLETE TO RESTORE SYSTEM STABILITY.</span>
                    </div>
                )}

                {/* Void Strike Indicator (Only for minor tasks) */}
                {voidStrikeAvailable && ['E', 'D'].includes(quest.difficulty || 'E') && quest.status === 'Active' && (
                    <div className="mt-3 p-2 border border-purple-900/50 bg-purple-950/20 rounded flex items-center justify-between group/void">
                        <div className="flex items-center gap-2">
                            <Gamepad2 className="w-4 h-4 text-purple-400 animate-pulse" />
                            <div>
                                <div className="text-[10px] font-bold text-purple-300 uppercase leading-none">Void Strike Available</div>
                                <div className="text-[8px] text-purple-500 font-mono">INSTANT DELETE TARGET</div>
                            </div>
                        </div>
                        <button
                            onClick={() => onVoidStrike?.(quest.id)}
                            className="text-[9px] font-bold bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded transition-colors shadow-[0_0_10px_#9333ea]"
                        >
                            EXECUTE
                        </button>
                    </div>
                )}

                {/* Shadow Delegation (Moved to Action Bar) */}
            </div>

            <div className="mt-auto border-t border-white/5 pt-3">
                <div className="flex gap-2 font-mono text-[10px] font-bold">
                    {quest.status === 'Active' ? (
                        <>
                            <button
                                onClick={async () => {
                                    if ((userMana >= finalManaCost || quest.type === 'PENALTY') && onComplete) {
                                        onComplete(quest.id);
                                    }
                                }}
                                disabled={userMana < finalManaCost && quest.type !== 'PENALTY'}
                                className={cn(
                                    "flex-1 border py-2 transition-colors uppercase tracking-wider flex items-center justify-center gap-1",
                                    quest.type === 'PENALTY'
                                        ? "bg-red-950/20 border-red-600/50 text-red-500 hover:bg-red-900/40 hover:text-red-300 hover:border-red-500"
                                        : userMana >= finalManaCost
                                            ? "bg-cyan-950/20 border-cyan-700 text-cyan-400 hover:bg-cyan-900/40 hover:text-cyan-200"
                                            : "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed"
                                )}
                            >
                                {userMana >= finalManaCost || isPenalty ? (
                                    <><CheckIcon className="w-3 h-3" /> {isPenalty ? "SURVIVE" : "COMPLETE"}</>
                                ) : (
                                    <>NO MANA ({finalManaCost})</>
                                )}
                            </button>
                            <button
                                onClick={() => onFail?.(quest.id)}
                                className="px-3 bg-red-950/10 border border-red-900/50 text-red-700 py-2 hover:bg-red-950/30 hover:text-red-500 transition-colors uppercase tracking-wider"
                            >
                                FAIL
                            </button>
                            {/* Delegate Button - Necromancer Only */}
                            {onDelegate && (hunterClass || '').toLowerCase() === 'necromancer' && (() => {
                                // Cost Calculation Check
                                const rank = quest.difficulty || 'E';
                                const costs: Record<string, number> = { 'E': 10, 'D': 25, 'C': 50, 'B': 100, 'A': 250, 'S': 500 };
                                const cost = costs[rank] || 5;
                                const canDelegate = availableShadows >= cost;

                                return (
                                    <button
                                        onClick={() => canDelegate && onDelegate(quest.id)}
                                        disabled={!canDelegate}
                                        title={canDelegate ? `Delegate to ${cost} Shadows` : `Need ${cost} Shadows(Available: ${availableShadows})`}
                                        className={cn(
                                            "px-2 border transition-colors flex items-center justify-center gap-1 min-w-[32px]",
                                            canDelegate
                                                ? "bg-purple-950/20 border-purple-900/50 text-purple-400 hover:bg-purple-900/40 hover:text-white"
                                                : "bg-slate-900/50 border-slate-800 text-slate-700 cursor-not-allowed"
                                        )}
                                    >
                                        <Ghost className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold">-{cost}</span>
                                    </button>
                                );
                            })()}
                        </>
                    ) : quest.status === 'Available' ? (
                        <div className="flex-1 flex gap-2">
                            {!isLocked && (
                                <button
                                    onClick={() => onComplete?.(quest.id)}
                                    disabled={userMana < finalManaCost}
                                    className={cn(
                                        "flex-1 border py-2 transition-all uppercase tracking-wider flex items-center justify-center gap-1",
                                        userMana >= finalManaCost
                                            ? "bg-cyan-950/20 border-cyan-700 text-cyan-400 hover:bg-cyan-900/40 hover:text-cyan-200 shadow-[0_0_10px_rgba(8,145,178,0.1)]"
                                            : "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed"
                                    )}
                                >
                                    <CheckIcon className="w-3 h-3" /> {userMana >= finalManaCost ? "COMPLETE" : "NO MANA"}
                                </button>
                            )}
                            {/* Delegate Button - Necromancer Only (Available State) */}
                            {!isLocked && onDelegate && (hunterClass || '').toLowerCase() === 'necromancer' && (() => {
                                const rank = quest.difficulty || 'E';
                                const costs: Record<string, number> = { 'E': 10, 'D': 25, 'C': 50, 'B': 100, 'A': 250, 'S': 500 };
                                const cost = costs[rank] || 5;
                                const canDelegate = availableShadows >= cost;

                                return (
                                    <button
                                        onClick={() => canDelegate && onDelegate(quest.id)}
                                        disabled={!canDelegate}
                                        title={canDelegate ? `Delegate to ${cost} Shadows` : `Need ${cost} Shadows(Available: ${availableShadows})`}
                                        className={cn(
                                            "px-2 border transition-colors flex items-center justify-center gap-1 min-w-[32px]",
                                            canDelegate
                                                ? "bg-purple-950/20 border-purple-900/50 text-purple-400 hover:bg-purple-900/40 hover:text-white"
                                                : "bg-slate-900/50 border-slate-800 text-slate-700 cursor-not-allowed"
                                        )}
                                    >
                                        <Ghost className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold">-{cost}</span>
                                    </button>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className={cn(
                            "w-full text-center py-1 uppercase tracking-widest",
                            quest.status === 'Complete' ? "text-cyan-600" : "text-red-800"
                        )}>
                            [{quest.status}]
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
