"use client";

import { Database } from "@/types/database.types";
import { SkillNode } from "./SkillNode";

type Skill = Database['public']['Tables']['skills']['Row'];
type UserSkill = Database['public']['Tables']['user_skills']['Row'];

interface SkillTreeCanvasProps {
    skills: Skill[];
    userSkills: UserSkill[];
    availableSp: number;
    userClass?: string | null;
    isAllMaxed: boolean;
    activeSkillId: number | null;
    onSkillSelect: (skillId: number | null) => void;
}

export function SkillTreeCanvas({
    skills,
    userSkills,
    availableSp,
    userClass,
    isAllMaxed,
    activeSkillId,
    onSkillSelect
}: SkillTreeCanvasProps) {
    // 1. Filter invalid skills AND class-locked skills
    const validSkills = skills.filter(s => {
        const hasPos = s.x_pos !== null && s.y_pos !== null;
        if (!hasPos) return false;

        // Class Check
        if (!s.required_class) return true; // Available to everyone
        return s.required_class === userClass; // Only available if class matches
    });

    // 2. Map skills for easier access
    const skillMap = new Map(validSkills.map(s => [s.id, s]));

    // 3. Determine Unlocked Status for visual lines
    const isSkillUnlocked = (skill: Skill) => {
        if (!skill.parent_skill_id) return true;
        const parentUserSkill = userSkills.find(us => us.skill_id === skill.parent_skill_id);
        return (parentUserSkill?.current_level || 0) > 0;
    };

    const handleSkillClick = (skillId: number) => {
        onSkillSelect(activeSkillId === skillId ? null : skillId);
    };

    return (
        <div className="relative w-full h-[700px] bg-[#02060a] border border-cyan-900/30 rounded-lg shadow-inner">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle, #0e7490 1px, transparent 1px)', backgroundSize: '30px 30px' }}
            />

            {/* Click to deselect background */}
            <div className="absolute inset-0" onClick={() => onSkillSelect(null)} />

            {/* SVG Connections Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {validSkills.map(skill => {
                    if (!skill.parent_skill_id) return null;
                    const parent = skillMap.get(skill.parent_skill_id);
                    if (!parent) return null;

                    const isUnlocked = isSkillUnlocked(skill);
                    const isLearned = userSkills.some(us => us.skill_id === skill.id && us.current_level! > 0);

                    return (
                        <line
                            key={`line-${skill.id}`}
                            x1={`${parent.x_pos}%`}
                            y1={`${parent.y_pos}%`}
                            x2={`${skill.x_pos}%`}
                            y2={`${skill.y_pos}%`}
                            stroke={isLearned ? "#a855f7" : isUnlocked ? "#06b6d4" : "#1e293b"}
                            strokeWidth="2"
                            strokeOpacity={isUnlocked ? "0.6" : "0.2"}
                            strokeDasharray={isUnlocked ? "none" : "4 4"}
                        />
                    );
                })}
            </svg>

            {/* Nodes Layer */}
            {validSkills.map(skill => {
                const userSkill = userSkills.find(us => us.skill_id === skill.id);
                const parentSkill = skill.parent_skill_id ? skillMap.get(skill.parent_skill_id) : null;

                return (
                    <SkillNode
                        key={skill.id}
                        skill={skill}
                        userSkill={userSkill}
                        isUnlocked={isSkillUnlocked(skill)}
                        canAfford={availableSp >= (skill.cost || 1)}
                        onClick={handleSkillClick} // Click opens panel/selects
                        isSelected={activeSkillId === skill.id}
                        parentSkillName={parentSkill?.name}
                        isAllMaxed={isAllMaxed}
                    />
                );
            })}
        </div>
    );
}
