"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SkillTreeCanvas } from "@/components/skills/SkillTreeCanvas";
import { SkillDetailsPanel } from "@/components/skills/SkillDetailsPanel";
import { ReserveSkillCard } from "@/components/skills/ReserveSkillCard";
import { unlockSkillAction, decreaseSkillAction, resetAllSkillsAction, activateSkillAction } from "@/app/actions/skills";
import { useSystemNotification } from "@/components/system/NotificationProvider";
import { BrainCircuit, Activity, RotateCcw, Zap, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

// Define minimal types needed for props
type Skill = any;
type UserSkill = any;
type Profile = any;

interface SkillsClientProps {
    initialProfile: Profile;
    maxMana: number;
    initialSkills: Skill[];
    initialUserSkills: UserSkill[];
}

export default function SkillsClient({ initialProfile, maxMana, initialSkills, initialUserSkills }: SkillsClientProps) {
    // 1. Filter Ultimate Skill Logic.
    // Condition: every non-ultimate module available to this class must be maxed.
    // Reserve modules are included so an unpositioned skill cannot silently bypass the gate.
    const allOtherSkills = initialSkills.filter((s: any) => {
        if (s.category === 'ULTIMATE') return false;

        if (s.required_class && s.required_class !== initialProfile?.hunter_class) return false;

        return true;
    });

    const isAllMaxed = allOtherSkills.every((s: any) => {
        const us = initialUserSkills.find((u: any) => u.skill_id === s.id);
        return us && us.current_level >= s.max_level;
    });

    const visibleSkills = initialSkills;
    const reserveSkills = initialSkills.filter((skill: any) => (
        (skill.x_pos === null || skill.y_pos === null) &&
        (!skill.required_class || skill.required_class === initialProfile?.hunter_class)
    ));

    const visibleUserSkills = initialUserSkills;
    const router = useRouter();
    const [selectedSkillId, setSelectedSkillId] = useState<any>(null);
    const [isUnlocking, setIsUnlocking] = useState(false);

    // Derived state
    const selectedSkill = initialSkills.find((s: any) => s.id === selectedSkillId) || null;
    const selectedUserSkill = initialUserSkills.find((us: any) => us.skill_id === selectedSkillId);

    const { showNotification } = useSystemNotification();

    const handleUnlock = async (skillId: any) => {
        if (!initialProfile) return;
        setIsUnlocking(true);

        try {
            const result = await unlockSkillAction(skillId);

            if (!result.success) {
                showNotification({
                    title: "UNLOCK FAILED",
                    message: result.error || "Insufficient resources or module error.",
                    type: 'ERROR'
                });
                return;
            }

            window.dispatchEvent(new Event('progression_protocol_update'));

            showNotification({
                title: selectedUserSkill ? "MODULE UPGRADED" : "MODULE UNLOCKED",
                message: `Skill level increased. SP deducted.`,
                type: 'SUCCESS'
            });

            if (result.data?.unlocked && result.data.unlocked.length > 0) {
                result.data.unlocked.forEach((ach: any) => {
                    showNotification({
                        title: "ACHIEVEMENT UNLOCKED",
                        message: ach.name,
                        type: 'ACHIEVEMENT',
                        xp: ach.xp
                    });
                });
            }

            // Refresh Server Data
            router.refresh();
        } catch (e: any) {
            console.error("Frontend Unlock Error:", e);
            showNotification({
                title: "SYSTEM ERROR",
                message: "A critical client-side error occurred.",
                type: 'ERROR'
            });
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleDecrease = async (skillId: any) => {
        setIsUnlocking(true);
        try {
            const result = await decreaseSkillAction(skillId);

            if (!result.success) {
                showNotification({
                    title: "REFUND FAILED",
                    message: result.error || "Cannot refund this skill module.",
                    type: 'ERROR'
                });
                return;
            }

            window.dispatchEvent(new Event('progression_protocol_update'));
            router.refresh();
            showNotification({
                title: "SKILL REFUNDED",
                message: "1 Skill Point has been returned to your pool.",
                type: 'SUCCESS'
            });
        } catch (e: any) {
            console.error("Frontend Refund Error:", e);
            showNotification({
                title: "SYSTEM ERROR",
                message: "Failed to process refund request.",
                type: 'ERROR'
            });
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleActivate = async (skillId: any) => {
        setIsUnlocking(true);
        try {
            const result = await activateSkillAction(skillId);

            if (!result.success) {
                showNotification({
                    title: "ACTIVATION FAILED",
                    message: result.error || "Not enough mana or cooldown active.",
                    type: 'ERROR'
                });
                return;
            }

            window.dispatchEvent(new Event('progression_protocol_update'));

            showNotification({
                title: "SKILL ACTIVATED",
                message: result.data?.message || "Skill effect triggered.",
                type: 'SUCCESS',
                xp: result.data?.newMana ? undefined : 0 // Don't show XP unless it's an XP skill?
            });

            router.refresh();

        } catch (e: any) {
            console.error("Frontend Activation Error:", e);
            showNotification({
                title: "SYSTEM ERROR",
                message: "Failed to activate skill.",
                type: 'ERROR'
            });
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleReset = async () => {
        if (!confirm("Are you sure? This will wipe ALL currently allocated skills and refund ALL points.")) return;

        setIsUnlocking(true);
        try {
            const res = await resetAllSkillsAction();

            if (!res.success) {
                showNotification({
                    title: "RESET FAILED",
                    message: res.error || "Critical error during skill tree wipe.",
                    type: 'ERROR'
                });
                return;
            }

            window.dispatchEvent(new Event('progression_protocol_update'));
            router.refresh();
            showNotification({
                title: "SYSTEM RESET",
                message: `Skill tree cleared. ${res.data?.refunded || 0} SP recovered.`,
                type: 'SUCCESS'
            });
        } catch (e: any) {
            console.error("Frontend Reset Error:", e);
            showNotification({
                title: "SYSTEM ERROR",
                message: "Failed to perform full system reset.",
                type: 'ERROR'
            });
        } finally {
            setIsUnlocking(false);
        }
    };

    return (
        <div className="container mx-auto p-6 min-h-screen">
            <header className="mb-8 flex justify-between items-end">
                <div className="flex items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-bold font-sans tracking-tight text-white mb-2 flex items-center gap-3">
                            <BrainCircuit className="w-10 h-10 text-cyan-500" />
                            SKILL MATRIX
                        </h1>
                        <p className="text-cyan-600 font-mono text-sm flex items-center gap-2">
                            <Activity className="w-4 h-4 animate-pulse" />
                            NEURAL INTERFACE CONNECTED // V.2.1
                        </p>
                    </div>
                    {
                        <button
                            onClick={handleReset}
                            className="mb-1 px-3 py-1 bg-red-950/30 border border-red-900/50 rounded text-[10px] font-mono text-red-500 hover:bg-red-900/40 transition-colors uppercase tracking-widest flex items-center gap-2 group"
                        >
                            <RotateCcw className="w-3 h-3 group-hover:-rotate-180 transition-transform duration-500" />
                            [RESET SYSTEM]
                        </button>
                    }
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-purple-400 uppercase tracking-widest mb-1">Available SP</div>
                    <div className="text-3xl font-bold text-white font-mono text-shadow-purple flex items-center justify-end gap-2">
                        {initialProfile?.available_sp || 0}
                        <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
                <div className={cn(
                    "overflow-x-auto pb-4 custom-scrollbar", // Allow horizontal scroll
                    isUnlocking ? "opacity-50 pointer-events-none" : ""
                )}>
                    {/* Minimum width ensures nodes don't overlap on small screens */}
                    <div className="min-w-[800px]">
                        <SkillTreeCanvas
                            skills={visibleSkills}
                            userSkills={visibleUserSkills}
                            availableSp={initialProfile?.available_sp || 0}
                            userClass={initialProfile?.hunter_class}
                            isAllMaxed={isAllMaxed}
                            // Interface is: activeSkillId, onSkillSelect
                            activeSkillId={selectedSkillId}
                            onSkillSelect={setSelectedSkillId}
                        />
                    </div>
                    {reserveSkills.length > 0 && (
                        <section className="mt-6 rounded-lg border border-purple-900/40 bg-black/30 p-4">
                            <div className="mb-4 flex items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-purple-300">
                                        Reserve Modules
                                    </h2>
                                    <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-purple-500/80">
                                        UNPOSITIONED SYSTEM ARCHIVE // {reserveSkills.length} MODULES
                                    </p>
                                </div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                                    SELECT TO INSPECT
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {reserveSkills.map((skill: any) => {
                                    const parentSkill = skill.parent_skill_id
                                        ? initialSkills.find((candidate: any) => candidate.id === skill.parent_skill_id)
                                        : null;
                                    const parentUserSkill = parentSkill
                                        ? initialUserSkills.find((candidate: any) => candidate.skill_id === parentSkill.id)
                                        : null;

                                    return (
                                        <ReserveSkillCard
                                            key={skill.id}
                                            skill={skill}
                                            userSkill={initialUserSkills.find((candidate: any) => candidate.skill_id === skill.id)}
                                            isSelected={selectedSkillId === skill.id}
                                            isClassLocked={Boolean(skill.required_class && skill.required_class !== initialProfile?.hunter_class)}
                                            isParentLocked={Boolean(skill.parent_skill_id && (!parentUserSkill || (parentUserSkill.current_level || 0) <= 0))}
                                            isUltimateGated={skill.category === 'ULTIMATE' && !isAllMaxed}
                                            onSelect={setSelectedSkillId}
                                        />
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>

                {/* Side Panel for Details */}
                <div className="relative">
                    {selectedSkill ? (
                        <div className="sticky top-6 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
                            <SkillDetailsPanel
                                skill={selectedSkill}
                                userSkill={selectedUserSkill}
                                playerLevel={initialProfile?.level || 1}
                                maxMana={maxMana}
                                availableSp={initialProfile?.available_sp || 0}
                                userClass={initialProfile?.hunter_class}
                                isAllMaxed={isAllMaxed}
                                allSkills={initialSkills}
                                userSkills={initialUserSkills}
                                onClose={() => setSelectedSkillId(null)}
                                onUnlock={handleUnlock}
                                onDecrease={handleDecrease}
                                onActivate={handleActivate}
                            />
                        </div>
                    ) : (
                        <div className="h-[700px] border border-cyan-900/20 rounded-lg flex flex-col items-center justify-center gap-4 text-cyan-900/40 font-mono text-sm uppercase tracking-widest bg-[#02060a]/50">
                            <Scan className="w-16 h-16 animate-pulse" />
                            Select a Skill Module
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
