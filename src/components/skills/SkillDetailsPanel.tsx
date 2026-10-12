"use client";

import { createElement, useState, useEffect } from "react";
import Image from "next/image";
import { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { X, ArrowUpCircle, Zap as ZapIcon, Clock, PlusSquare, Lock } from "lucide-react";
import { getSkillIcon } from "./SkillIcons";
import { equipSkillToHotbarAction } from "@/app/actions/skills";
import { useSystemNotification } from "@/components/system/NotificationProvider";
import { calculateSkillManaCost } from "@/lib/system/formula";
import {
    calculateSkillCooldownSeconds,
    getActiveSkillEffectSummary,
    getPassiveSkillEffectSummary,
    getSkillRuntimeLabel,
    getSkillStatScalingSummary,
} from "@/lib/system/skill-effects";

type Skill = Database['public']['Tables']['skills']['Row'] & {
    stat_bonus?: Record<string, number> | null;
    is_active?: boolean;
    mana_cost?: number;
    effect_type?: string;
    cooldown_seconds?: number;
    active_effect?: string | null;
};
type UserSkill = Database['public']['Tables']['user_skills']['Row'];

interface SkillDetailsPanelProps {
    skill: Skill | null;
    userSkill?: UserSkill;
    playerLevel: number;
    maxMana: number;
    availableSp: number;
    userClass?: string | null;
    isAllMaxed: boolean;
    allSkills: Skill[];
    userSkills: UserSkill[];
    onClose: () => void;
    onUnlock: (skillId: any) => void;
    onDecrease?: (skillId: any) => void;
    onActivate?: (skillId: any) => void;
}

export function SkillDetailsPanel({
    skill,
    userSkill,
    playerLevel,
    maxMana,
    availableSp,
    userClass,
    isAllMaxed,
    allSkills,
    userSkills,
    onClose,
    onUnlock,
    onDecrease,
    onActivate
}: SkillDetailsPanelProps) {
    const { showNotification } = useSystemNotification();
    const [isEquipping, setIsEquipping] = useState(false);
    // Cooldown state
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!skill?.cooldown_seconds || !userSkill?.last_used_at) return;

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, [skill?.cooldown_seconds, skill?.effect_type, userSkill?.current_level, userSkill?.last_used_at]);

    if (!skill) return null;

    const currentLevel = userSkill?.current_level || 0;
    const isLearned = currentLevel > 0;
    const isMaxed = currentLevel >= (skill.max_level || 1);
    const cost = skill.cost || 1;
    const canAfford = availableSp >= cost;

    const lastUsed = userSkill?.last_used_at ? new Date(userSkill.last_used_at).getTime() : 0;
    const displaySkillLevel = Math.max(1, currentLevel);
    const effectiveCooldownSeconds = calculateSkillCooldownSeconds(
        skill.cooldown_seconds,
        displaySkillLevel,
        skill.effect_type
    );
    const effectiveManaCost = calculateSkillManaCost(
        skill.mana_cost || 0,
        displaySkillLevel,
        maxMana,
        skill.effect_type
    );
    const cooldownMs = effectiveCooldownSeconds * 1000;
    const remainingMs = Math.max(0, lastUsed + cooldownMs - now);
    const isOnCooldown = remainingMs > 0;

    const formatRemaining = (ms: number) => {
        const s = Math.ceil(ms / 1000);
        if (s < 60) return `${s}S`;
        const m = Math.floor(s / 60);
        const rs = s % 60;
        return `${m}M ${rs}S`;
    };

    // Requirement Checks
    const isUltimateGated = skill.category === 'ULTIMATE' && !isAllMaxed;
    const isClassLocked = skill.required_class && skill.required_class !== userClass;

    // Parent dependency check
    const parentSkill = skill.parent_skill_id ? allSkills.find(s => s.id === skill.parent_skill_id) : null;
    const parentUserSkill = parentSkill ? userSkills.find(us => us.skill_id === parentSkill.id) : null;
    const isParentLocked = !!skill.parent_skill_id && (!parentUserSkill || (parentUserSkill.current_level || 0) <= 0);

    const isLocked = isUltimateGated || isClassLocked || isParentLocked;
    const canLearn = !isLocked && canAfford && !isMaxed;
    const activeEffectSummary = getActiveSkillEffectSummary(skill.effect_type, displaySkillLevel);
    const passiveEffectSummary = getPassiveSkillEffectSummary(skill.name, displaySkillLevel);
    const statScalingSummary = getSkillStatScalingSummary(
        skill.stat_bonus,
        currentLevel,
        playerLevel,
        skill.category
    );
    const runtimeLabel = getSkillRuntimeLabel({
        hasActiveEffect: Boolean(activeEffectSummary),
        hasPassiveEffect: Boolean(passiveEffectSummary),
        hasStatImprint: statScalingSummary.length > 0,
    });
    const runtimeLabelClass = runtimeLabel === 'ACTIVE EFFECT'
        ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10'
        : runtimeLabel === 'PASSIVE EFFECT'
            ? 'text-purple-300 border-purple-500/20 bg-purple-500/10'
            : runtimeLabel === 'STAT IMPRINT'
                ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
                : 'text-slate-400 border-slate-500/20 bg-slate-500/10';

    const formatCooldownSeconds = (seconds: number) => {
        if (seconds < 60) return `${seconds}S`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}M`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}H ${remainingMinutes}M` : `${hours}H`;
    };

    return (
        <div className="w-full bg-black/95 border border-cyan-500 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-in slide-in-from-right-10 fade-in duration-300">
            {/* Header */}
            <div className="bg-cyan-950/80 p-3 border-b border-cyan-500/50 flex justify-between items-center relative overflow-hidden rounded-t-lg">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 pointer-events-none" />
                <div>
                    <h3 className="font-sans font-black text-xl text-white tracking-[0.2em] uppercase truncate max-w-[240px] drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                        {skill.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-cyan-500/70 tracking-widest uppercase">MODULE // ID: {skill.id.toString().slice(0, 8)}</span>
                    </div>
                </div>
                <button onClick={onClose} className="text-cyan-400 hover:text-white transition-all hover:rotate-90 duration-300 p-1 bg-white/5 rounded-full">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* Image/Icon Display */}
                <div className="w-full h-32 bg-gradient-to-b from-slate-950 to-[#02060a] border border-cyan-500/20 rounded-sm flex items-center justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,255,0.05),transparent_70%)] opacity-50" />
                    <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />

                    {/* Animated scanning line effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-20 w-full -translate-y-full animate-scan" />

                    <div className="relative z-10 flex items-center justify-center p-2">
                        <SkillIconDisplay name={skill.name} className="w-24 h-24 object-contain text-cyan-400 drop-shadow-[0_0_30px_rgba(0,242,255,0.6)]" />
                    </div>

                    {/* Decorative Corner Flairs */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-500/20" />
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-500/20" />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-mono tracking-tighter text-cyan-600/60 uppercase">
                        <span className="flex items-center gap-1"><ZapIcon className="w-3 h-3" /> Category: {skill.category}</span>
                        <span className={cn("px-2 py-0.5 rounded border", runtimeLabelClass)}>{runtimeLabel}</span>
                    </div>

                    <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Catalog Description</div>
                    <div className="text-sm text-slate-400 leading-relaxed font-sans italic border-l-2 border-cyan-900 pl-4 py-1">
                        &quot;{skill.description || "No description available."}&quot;
                    </div>

                    {/* Generated mechanics display */}
                    {activeEffectSummary && (
                        <div className="bg-cyan-950/30 border border-cyan-800/50 p-2 rounded flex flex-col gap-1">
                            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Active Effect</span>
                            <div className="text-xs text-white font-mono leading-relaxed">{activeEffectSummary}</div>
                        </div>
                    )}
                    {passiveEffectSummary && (
                        <div className="bg-purple-950/30 border border-purple-800/50 p-2 rounded flex flex-col gap-1">
                            <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Passive Effect</span>
                            <div className="text-xs text-white font-mono leading-relaxed">{passiveEffectSummary}</div>
                        </div>
                    )}
                    {statScalingSummary.length > 0 && (
                        <div className="bg-cyan-950/30 border border-cyan-800/50 p-2 rounded flex flex-col gap-1">
                            <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Stat Imprint</span>
                            {statScalingSummary.map(summary => (
                                <div key={summary} className="text-xs text-white font-mono leading-relaxed">{summary}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-900/50 p-2 rounded border border-white/5">
                        <span className="text-slate-500 block mb-1">LEVEL</span>
                        <span className={cn("text-lg font-bold", isMaxed ? "text-yellow-400" : "text-white")}>
                            {currentLevel} <span className="text-slate-600 text-xs">/ {skill.max_level}</span>
                        </span>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded border border-white/5">
                        <span className="text-slate-500 block mb-1">COST</span>
                        <span className={cn("text-lg font-bold", canAfford ? "text-white" : "text-red-500")}>
                            {cost} <span className="text-slate-600 text-xs">SP</span>
                        </span>
                    </div>
                </div>

                {/* Active Skill Info */}
                {skill.is_active && (
                    <div className="bg-cyan-900/20 border border-cyan-500/30 p-3 rounded flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
                                    <ZapIcon className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div>
                                    <div className="text-[10px] text-cyan-500 font-bold uppercase tracking-wider">ACTIVE ABILITY</div>
                                    <div className="text-xs text-white font-mono flex items-center gap-2">
                                        <span>Cost: <span className="text-cyan-400">{effectiveManaCost} MP</span></span>
                                        {effectiveCooldownSeconds > 0 && (
                                            <>
                                                <span className="text-cyan-900/40">|</span>
                                                <span>CD: <span className="text-cyan-400">{formatCooldownSeconds(effectiveCooldownSeconds)}</span></span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Equip UI */}
                        {isLearned && (
                            <div className="mt-2 border-t border-cyan-500/10 pt-2">
                                {!isEquipping ? (
                                    <button
                                        onClick={() => setIsEquipping(true)}
                                        className="text-[10px] flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors uppercase font-bold tracking-wider"
                                    >
                                        <PlusSquare className="w-3 h-3" /> Assign to Hotbar
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Slot:</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(slot => (
                                                <button
                                                    key={slot}
                                                    onClick={async () => {
                                                        try {
                                                            const res = await equipSkillToHotbarAction(skill.id, slot);
                                                            if (res?.success) {
                                                                showNotification({
                                                                    title: "EQUIPPED",
                                                                    message: `Assigned to Slot ${slot}`,
                                                                    type: "SUCCESS"
                                                                });
                                                                setIsEquipping(false);
                                                            }
                                                        } catch (error) {
                                                            console.error("Failed to equip skill:", error);
                                                            showNotification({
                                                                title: "ERROR",
                                                                message: "Failed to equip skill.",
                                                                type: "ERROR"
                                                            });
                                                        }
                                                    }}
                                                    className="w-5 h-5 bg-black/50 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400 text-[10px] text-cyan-200 flex items-center justify-center rounded transition-all"
                                                >
                                                    {slot}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setIsEquipping(false)}
                                                className="w-5 h-5 text-slate-500 hover:text-white flex items-center justify-center"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="flex flex-col gap-3 w-full">
                    {/* Requirements / Warnings Section */}
                    {isLocked && (
                        <div className="space-y-2 mb-1">
                            {isClassLocked && (
                                <div className="bg-red-950/20 border border-red-500/30 p-2 rounded flex items-center gap-3">
                                    <X className="w-4 h-4 text-red-500" />
                                    <div>
                                        <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">CLASS MISMATCH</div>
                                        <div className="text-[9px] text-red-200/60 font-mono">NEURAL INTERFACE REQUIRES: <span className="text-red-400">{skill.required_class}</span></div>
                                    </div>
                                </div>
                            )}

                            {isParentLocked && (
                                <div className="bg-amber-950/20 border border-amber-500/30 p-2 rounded flex items-center gap-3">
                                    <Lock className="w-4 h-4 text-amber-500" />
                                    <div>
                                        <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">PARENT MODULE MISSING</div>
                                        <div className="text-[9px] text-amber-200/60 font-mono">REQUIRED PREREQUISITE: <span className="text-amber-400">{parentSkill?.name || "Unknown"}</span></div>
                                    </div>
                                </div>
                            )}

                            {isUltimateGated && (
                                <div className="bg-purple-950/20 border border-purple-500/30 p-2 rounded flex items-center gap-3">
                                    <ZapIcon className="w-4 h-4 text-purple-500 animate-pulse" />
                                    <div>
                                        <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">SYSTEM CONSTRAINT</div>
                                        <div className="text-[9px] text-purple-200/60 font-mono">MASTER ALL OTHER MODULES TO INITIALIZE ULTIMATE AWAKENING.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!canAfford && !isMaxed && !isLocked && (
                        <div className="bg-slate-900 border border-slate-700 p-2 rounded flex items-center gap-3 mb-1">
                            <ZapIcon className="w-4 h-4 text-slate-500" />
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">INSUFFICIENT ENERGY</div>
                                <div className="text-[9px] text-slate-500 font-mono">ADDITIONAL SP REQUIRED: <span className="text-white">{cost}</span></div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 w-full">
                        {/* Refund Button */}
                        {isLearned && (
                            <button
                                onClick={() => onDecrease?.(String(skill.id))}
                                className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 w-12 flex-none py-2 font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center rounded-sm"
                                title="Refund 1 SP"
                            >
                                <span className="text-xl leading-none mb-1">-</span>
                            </button>
                        )}

                        {/* Learn / Level Up Button */}
                        <button
                            onClick={() => onUnlock(String(skill.id))}
                            disabled={!canLearn}
                            className={cn(
                                "flex-1 py-2 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 clip-path-slant",
                                isMaxed
                                    ? "bg-yellow-900/20 text-yellow-600 border border-yellow-900/50 cursor-default"
                                    : canLearn
                                        ? "bg-cyan-600 hover:bg-cyan-500 text-black shadow-[0_0_15px_rgba(8,145,178,0.6)]"
                                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-60"
                            )}
                        >
                            {isMaxed ? (
                                <>MAXED</>
                            ) : isLocked ? (
                                <><Lock className="w-5 h-5" /> LOCKED</>
                            ) : isLearned ? (
                                <><ArrowUpCircle className="w-5 h-5" /> LEVEL UP</>
                            ) : (
                                <><ZapIcon className="w-5 h-5" /> LEARN</>
                            )}
                        </button>
                    </div>

                    {/* Activate Button (Second Row) */}
                    {isLearned && skill.is_active && (
                        <button
                            onClick={() => !isOnCooldown && onActivate?.(String(skill.id))}
                            disabled={isOnCooldown}
                            className={cn(
                                "w-full py-4 font-black text-lg uppercase tracking-widest transition-all duration-300 clip-path-slant flex items-center justify-center gap-2",
                                isOnCooldown
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                                    : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)] border border-cyan-400/50"
                            )}
                        >
                            {isOnCooldown ? (
                                <><Clock className="w-5 h-5" /> COOLDOWN: {formatRemaining(remainingMs)}</>
                            ) : (
                                <><ZapIcon className="w-5 h-5" /> ACTIVATE</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Footer Decoration */}
            <div className="h-1 w-full bg-cyan-600 flex">
                <div className="w-1/3 bg-cyan-400" />
                <div className="w-1/3 bg-cyan-800" />
            </div>
        </div>
    );
}

function SkillIconDisplay({ name, className }: { name: string, className?: string }) {
    const iconData = getSkillIcon(name);
    if (iconData.type === 'png') {
        return (
            <Image
                src={iconData.icon}
                alt={name}
                width={96}
                height={96}
                className={cn("object-contain", className)}
            />
        );
    }
    return createElement(iconData.icon, { className: className || "" });
}
