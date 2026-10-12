"use client";

import { createElement } from "react";
import Image from "next/image";
import { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { getSkillIcon } from "./SkillIcons";
import {
    getActiveSkillEffectSummary,
    getPassiveSkillEffectSummary,
    getSkillRuntimeLabel,
} from "@/lib/system/skill-effects";

type Skill = Database['public']['Tables']['skills']['Row'];
type UserSkill = Database['public']['Tables']['user_skills']['Row'];

interface ReserveSkillCardProps {
    skill: Skill;
    userSkill?: UserSkill;
    isSelected: boolean;
    isClassLocked: boolean;
    isParentLocked: boolean;
    isUltimateGated: boolean;
    onSelect: (skillId: string) => void;
}

export function ReserveSkillCard({
    skill,
    userSkill,
    isSelected,
    isClassLocked,
    isParentLocked,
    isUltimateGated,
    onSelect,
}: ReserveSkillCardProps) {
    const currentLevel = userSkill?.current_level || 0;
    const maxLevel = skill.max_level || 1;
    const isMaxed = currentLevel >= maxLevel;
    const isLocked = isClassLocked || isParentLocked || isUltimateGated;
    const status = isMaxed ? 'MAXED' : currentLevel > 0 ? 'LEARNED' : isLocked ? 'LOCKED' : 'AVAILABLE';
    const icon = getSkillIcon(skill.name);
    const displaySkillLevel = Math.max(1, currentLevel);
    const activeEffectSummary = getActiveSkillEffectSummary(skill.effect_type, displaySkillLevel);
    const passiveEffectSummary = getPassiveSkillEffectSummary(skill.name, Math.max(1, currentLevel));
    const hasStatImprint = Boolean(skill.stat_bonus && Object.keys(skill.stat_bonus).length > 0);
    const runtimeLabel = getSkillRuntimeLabel({
        hasActiveEffect: Boolean(activeEffectSummary),
        hasPassiveEffect: Boolean(passiveEffectSummary),
        hasStatImprint,
    });

    return (
        <button
            type="button"
            onClick={() => onSelect(skill.id)}
            aria-pressed={isSelected}
            className={cn(
                "group rounded-lg border p-4 text-left transition-colors",
                isSelected
                    ? "border-cyan-400 bg-cyan-950/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                    : "border-cyan-900/40 bg-slate-950/60 hover:border-cyan-500/70 hover:bg-slate-900/70",
                isLocked && !isSelected && "opacity-70"
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-black/50",
                    isMaxed ? "border-yellow-500/70 text-yellow-400" : "border-cyan-700/60 text-cyan-300"
                )}>
                    {icon.type === 'png'
                        ? <Image src={icon.icon} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
                        : createElement(icon.icon, { className: "h-5 w-5" })}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-xs font-bold uppercase tracking-wider text-cyan-100">
                            {skill.name}
                        </span>
                        <span className={cn(
                            "shrink-0 text-[9px] font-mono tracking-widest",
                            isMaxed ? "text-yellow-400" : currentLevel > 0 ? "text-purple-300" : isLocked ? "text-slate-500" : "text-cyan-400"
                        )}>
                            [{status}]
                        </span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-slate-400">
                        LV.{currentLevel}/{maxLevel} · {skill.cost || 1} SP{skill.is_active ? " · ACTIVE" : " · PASSIVE"} · {runtimeLabel}
                    </div>
                </div>
            </div>
            <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-slate-300/90">
                {skill.description || "No description available."}
            </p>
            {(activeEffectSummary || passiveEffectSummary) ? (
                <p className="mt-2 text-[10px] font-mono uppercase tracking-wide text-purple-300/90">
                    {activeEffectSummary || passiveEffectSummary}
                </p>
            ) : runtimeLabel === 'STAT IMPRINT' ? (
                <p className="mt-2 text-[10px] font-mono uppercase tracking-wide text-amber-300/90">
                    Stat imprint only; no separate runtime trigger is registered.
                </p>
            ) : null}
        </button>
    );
}
