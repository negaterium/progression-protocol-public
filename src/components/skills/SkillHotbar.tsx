
"use client";

import { cn } from "@/lib/utils";
import { SkillHotbarSlot } from "./SkillHotbarSlot";
import { useState } from "react";
import { activateSkillAction } from "@/app/actions/skills";
import { useSystemNotification } from "@/components/system/NotificationProvider";

interface HotbarSkill {
    slot: number;
    skillId: string;
    name: string;
    // icon?: string; // Removed
    manaCost: number;
    cooldown: number;
    lastUsed?: string;
    description?: string;
    category?: string;
}

interface SkillHotbarProps {
    hotbarSkills: HotbarSkill[];
    currentMana: number;
    className?: string;
}

export function SkillHotbar({ hotbarSkills, currentMana, className }: SkillHotbarProps) {
    const { showNotification } = useSystemNotification();
    const [activating, setActivating] = useState<string | null>(null);

    const handleActivate = async (skillId: string) => {
        if (activating) return;
        setActivating(skillId);

        try {
            const result = await activateSkillAction(skillId);
            if (result?.success) {
                showNotification({
                    title: "SKILL ACTIVATED",
                    message: result.message || "Skill used successfully.",
                    type: "SUCCESS"
                });
            } else {
                showNotification({
                    title: "ACTIVATION FAILED",
                    message: result?.error || "Could not activate skill.",
                    type: "ERROR"
                });
            }
        } catch (error: any) {
            showNotification({
                title: "ERROR",
                message: error.message || "Something went wrong.",
                type: "ERROR"
            });
        } finally {
            setActivating(null);
        }
    };

    if (!hotbarSkills || hotbarSkills.length === 0) return null;

    return (
        <div className={cn(
            "fixed inset-x-3 bottom-3 z-50 lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-[55%] lg:-translate-y-1/2",
            "bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-2 lg:rounded-l-2xl lg:rounded-r-none lg:p-3",
            "shadow-lg shadow-cyan-950/30 flex items-center justify-center lg:flex-col",
            "group/hotbar transition-all duration-500 hover:border-cyan-400/50 hover:bg-black/90",
            className
        )}>
            {/* Vertical Label */}
            <div className="hidden lg:block absolute -left-5 top-1/2 -translate-y-1/2 rotate-180 [writing-mode:vertical-lr] text-[10px] font-bold tracking-[0.3em] text-cyan-500/40 uppercase pointer-events-none">
                Active Skills
            </div>

            {/* Decorative Top Accent */}
            <div className="hidden lg:block w-1 h-8 bg-gradient-to-b from-cyan-500/50 to-transparent rounded-full mb-3 shrink-0" />

            {/* Scrollable Container */}
            <div className="flex gap-2 max-w-full overflow-x-auto custom-scrollbar p-1 lg:flex-col lg:gap-4 lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[60vh]">
                {hotbarSkills.map((skill) => {
                    const componentKey = `${skill.slot}-${skill.skillId}`;

                    return (
                        <SkillHotbarSlot
                            key={componentKey}
                            slotNumber={skill.slot}
                            skill={{
                                id: skill.skillId,
                                name: skill.name,
                                manaCost: skill.manaCost,
                                cooldown: skill.cooldown,
                                lastUsed: skill.lastUsed,
                                description: skill.description,
                                category: skill.category
                            }}
                            currentMana={currentMana}
                            onActivate={handleActivate}
                        />
                    );
                })}
            </div>

            {/* Decorative Bottom Accent */}
            <div className="hidden lg:block w-1 h-8 bg-gradient-to-t from-cyan-500/50 to-transparent rounded-full mt-3 shrink-0" />
        </div>
    );
}
