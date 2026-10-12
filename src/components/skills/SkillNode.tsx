"use client";

import { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { Lock, Star } from "lucide-react";
import { getSkillIcon } from "./SkillIcons";
import { useEffect, useState, createElement } from "react";
import {
    getActiveSkillEffectSummary,
    getPassiveSkillEffectSummary,
    getSkillRuntimeLabel,
} from "@/lib/system/skill-effects";

type Skill = Database['public']['Tables']['skills']['Row'];
type UserSkill = Database['public']['Tables']['user_skills']['Row'];

interface SkillNodeProps {
    skill: Skill;
    userSkill?: UserSkill; // If undefined, user doesn't have it
    isUnlocked: boolean; // True if parent is satisfied or root
    canAfford: boolean; // True if user has enough SP
    onClick: (skillId: number) => void;
    isSelected?: boolean;
    parentSkillName?: string;
    isAllMaxed: boolean;
}

export function SkillNode({ skill, userSkill, isUnlocked, canAfford, onClick, isSelected, parentSkillName, isAllMaxed }: SkillNodeProps) {
    const [levelUpTrigger, setLevelUpTrigger] = useState(false);
    const currentLevel = userSkill?.current_level || 0;
    const isMaxed = currentLevel >= (skill.max_level || 1);
    const isLearned = currentLevel > 0;
    const isUltimateGated = skill.category === 'ULTIMATE' && !isAllMaxed;
    const displaySkillLevel = Math.max(1, currentLevel);
    const activeEffectSummary = getActiveSkillEffectSummary(skill.effect_type, displaySkillLevel);
    const passiveEffectSummary = getPassiveSkillEffectSummary(skill.name, displaySkillLevel);
    const hasStatImprint = Boolean(skill.stat_bonus && Object.keys(skill.stat_bonus).length > 0);
    const runtimeLabel = getSkillRuntimeLabel({
        hasActiveEffect: Boolean(activeEffectSummary),
        hasPassiveEffect: Boolean(passiveEffectSummary),
        hasStatImprint,
    });

    // Trigger level-up animation when currentLevel increases
    useEffect(() => {
        if (currentLevel > 0) {
            const timer = setTimeout(() => {
                setLevelUpTrigger(true);
                setTimeout(() => setLevelUpTrigger(false), 600);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [currentLevel]);

    // Status Determination
    let status: 'locked' | 'available' | 'learned' | 'maxed' = 'locked';
    if (isMaxed) status = 'maxed';
    else if (isLearned) status = 'learned';
    else if (isUnlocked && !isUltimateGated) status = 'available';

    const isTopHalf = (skill.y_pos || 0) < 40;

    return (
        <div
            className={cn(
                "absolute transform -translate-x-1/2 -translate-y-1/2 group z-10 transition-all hover:z-[9999]",
                isSelected && "z-[9990] scale-110",
                levelUpTrigger && "animate-level-up"
            )}
            style={{
                left: `${skill.x_pos}%`,
                top: `${skill.y_pos}%`
            }}
        >
            {/* Pulsing selection ring */}
            {isSelected && (
                <div className="absolute -inset-2 bg-cyan-400/20 blur-lg rounded-full animate-pulse" />
            )}

            {/* Spendable SP indicator */}
            {status === 'available' && canAfford && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full z-20 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            )}

            {/* Tooltip */}
            <div className={cn(
                "absolute left-1/2 w-56 bg-black/95 border border-cyan-500/50 p-3 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] hidden md:block shadow-[0_0_20px_rgba(0,0,0,0.8)] translate-y-2 group-hover:translate-y-0 backdrop-blur-sm",
                isTopHalf ? "top-full mt-3" : "bottom-full mb-3",
                (skill.x_pos || 0) < 20 ? "left-0 translate-x-0" :
                    (skill.x_pos || 0) > 80 ? "left-auto right-0 translate-x-0" : "-translate-x-1/2"
            )}>
                <div className="flex justify-between items-start mb-2">
                    <h4 className={cn("font-bold text-sm uppercase tracking-wider",
                        status === 'maxed' ? "text-yellow-400" : "text-cyan-400"
                    )}>
                        {skill.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5">Lv.{currentLevel}/{skill.max_level}</span>
                </div>

                <div className="h-0.5 w-full bg-slate-800/50 rounded-full mb-3 overflow-hidden">
                    <div
                        className={cn("h-full transition-all duration-500", isMaxed ? "bg-yellow-500" : "bg-cyan-500")}
                        style={{ width: `${(currentLevel / (skill.max_level || 1)) * 100}%` }}
                    />
                </div>

                {/* Description */}
                <p className="text-[10px] text-slate-300 leading-relaxed mb-3 font-sans opacity-90">
                    {skill.description || "No description available."}
                </p>

                <div className="mb-3 border-t border-cyan-900/30 pt-2">
                    <div className={cn(
                        "text-[9px] font-mono font-bold uppercase tracking-wider",
                        runtimeLabel === 'ACTIVE EFFECT' ? "text-cyan-300" :
                            runtimeLabel === 'PASSIVE EFFECT' ? "text-purple-300" :
                                runtimeLabel === 'STAT IMPRINT' ? "text-amber-300" : "text-slate-500"
                    )}>
                        RUNTIME CONTRACT: {runtimeLabel}
                    </div>
                    {(activeEffectSummary || passiveEffectSummary) ? (
                        <div className="mt-1 text-[9px] text-slate-300 leading-relaxed">
                            {activeEffectSummary || passiveEffectSummary}
                        </div>
                    ) : runtimeLabel === 'STAT IMPRINT' ? (
                        <div className="mt-1 text-[9px] text-amber-200/70 leading-relaxed">
                            Character-level stat imprint only; no separate trigger is registered.
                        </div>
                    ) : null}
                </div>

                {/* Requirements Section */}
                {(skill.required_class || (parentSkillName && !isUnlocked) || (skill.category === 'ULTIMATE' && !isAllMaxed)) && (
                    <div className="flex flex-col gap-1 mb-3 pt-2 border-t border-slate-800/50">
                        {skill.required_class && (
                            <div className="text-[9px] font-mono text-red-300 flex items-center gap-1.5">
                                <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                CLASS: {skill.required_class}
                            </div>
                        )}
                        {parentSkillName && !isUnlocked && (
                            <div className="text-[9px] font-mono text-amber-300 flex items-center gap-1.5">
                                <Lock className="w-2.5 h-2.5" />
                                REQ: {parentSkillName}
                            </div>
                        )}
                        {skill.category === 'ULTIMATE' && !isAllMaxed && (
                            <div className="text-[9px] font-mono text-purple-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                                GATED: MASTER ALL SKILLS FIRST
                            </div>
                        )}
                    </div>
                )}

                <div className="text-[9px] font-mono flex justify-between items-center text-slate-400 pt-1 border-t border-cyan-900/30">
                    <div className="flex flex-col">
                        <span>COST: <span className="text-white">{skill.cost} SP</span></span>
                        {skill.is_active && <span className="text-cyan-400 font-bold animate-pulse text-[8px] mt-0.5">ACTIVE MODULE</span>}
                    </div>
                    <span className={cn("uppercase font-bold tracking-wider",
                        status === 'maxed' ? "text-yellow-600" :
                            status === 'available' ? "text-cyan-600" : "text-slate-600"
                    )}>[{status}]</span>
                </div>
            </div>

            {/* Hexagon Node */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(skill.id);
                }}
                // Keep a gated ultimate inspectable so the side panel can explain its requirements.
                disabled={status === 'locked' && !isUltimateGated}
                className={cn(
                    "w-12 h-12 flex items-center justify-center relative clip-path-hexagon transition-all duration-300 border-2 rounded-lg",
                    status === 'locked' && "bg-[#020202] border-slate-800/50 grayscale opacity-40 cursor-not-allowed",
                    status === 'available' && "bg-slate-950 cursor-pointer border-cyan-500/50 hover:border-cyan-400 animate-skill-pulse hover:bg-slate-900",
                    status === 'learned' && "bg-slate-950 cursor-pointer border-purple-500/50 hover:border-purple-400 hover:bg-slate-900",
                    status === 'maxed' && "bg-slate-950 border-yellow-500/60 animate-mastery hover:bg-slate-900",
                    skill.is_active && status !== 'locked' && "animate-active-ability shadow-[0_0_15px_rgba(34,211,238,0.4)]",
                    isSelected && "border-white scale-105 z-50 shadow-[0_0_20px_rgba(255,255,255,0.3)] bg-black"
                )}
            >
                {/* Background Pattern Layer */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:4px_4px]" />

                {/* Content */}
                <div className="relative flex flex-col items-center justify-center w-full h-full">
                    {status === 'locked' ? (
                        <Lock className="w-5 h-5 text-slate-700" />
                    ) : (() => {
                        const skillIcon = getSkillIcon(skill.name);
                        return (
                            <>
                                {skillIcon.type === 'png' ? (
                                    <img
                                        src={skillIcon.icon}
                                        alt={skill.name}
                                        className={cn(
                                            "w-[85%] h-[85%] object-contain transition-all duration-300",
                                            status === 'maxed' ? "drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" : "drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                                        )}
                                    />
                                ) : (
                                    createElement(skillIcon.icon, {
                                        className: cn(
                                            "w-6 h-6 mb-0.5",
                                            status === 'maxed' ? "text-yellow-400 shadow-yellow-500/50" :
                                                status === 'learned' ? "text-purple-300" : "text-cyan-400"
                                        )
                                    })
                                )}
                                {isMaxed ? (
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-pulse absolute -top-1 -right-1" />
                                ) : isLearned && (
                                    <span className="absolute bottom-0.5 right-2 text-[8px] font-bold text-white/90 font-mono bg-black/60 px-1 rounded-full backdrop-blur-sm z-10 shadow-sm border border-white/10">{currentLevel}</span>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Inner Glow for active/learned */}
                {(status === 'available' || status === 'learned') && (
                    <div className={cn(
                        "absolute inset-0 opacity-20",
                        status === 'available' ? "bg-cyan-400" : "bg-purple-400"
                    )} />
                )}
            </button>

            {/* Label */}
            {/* Label */}
            <div className={cn(
                "absolute top-full mt-1 left-1/2 flex flex-col items-center",
                (skill.x_pos || 0) < 15 ? "left-0 translate-x-0 items-start text-left" :
                    (skill.x_pos || 0) > 85 ? "left-auto right-0 translate-x-0 items-end text-right" : "-translate-x-1/2 text-center"
            )}>
                <span className={cn(
                    "px-1 py-0.5 text-[8px] leading-tight font-mono font-bold uppercase transition-all duration-300 max-w-[64px] break-words",
                    status === 'locked' ? "text-slate-600" : "text-cyan-200/80 group-hover:text-cyan-100 group-hover:bg-black/60 rounded-sm",
                    status === 'maxed' && "text-yellow-400/90",
                    isSelected && "bg-cyan-500 text-black scale-105 z-50 rounded"
                )}>
                    {skill.name}
                </span>
            </div>
        </div >
    );
}
