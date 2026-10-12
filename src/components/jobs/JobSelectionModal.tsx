"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Lock, Shield, Sword, Wand2, Heart, Skull, Sprout, Ghost } from "lucide-react";
import { updatePlayerClassAction } from "@/app/actions/profile";
import { useSystemNotification } from "@/components/system/NotificationProvider";


interface JobSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStats: {
        strength: number;
        agility: number;
        intelligence: number;
        vitality: number;
        perception: number;
    };
    completedQuestsCount: number;
    userId: string;
    hasDefeatedIgris: boolean; // New Requirement
}

const JOBS = [
    {
        id: 'Fighter',
        name: 'Fighter',
        desc: 'A master of close combat. Increases Strength and Vitality growth.',
        icon: Sword,
        color: 'text-red-500'
    },
    {
        id: 'Mage',
        name: 'Mage',
        desc: 'A wielder of arcane arts. Increases Intelligence and Mana capacity.',
        icon: Wand2,
        color: 'text-blue-500'
    },
    {
        id: 'Tank',
        name: 'Tank',
        desc: 'An unshakable fortress. Greatly increases Vitality and defense.',
        icon: Shield,
        color: 'text-amber-500'
    },
    {
        id: 'Assassin',
        name: 'Assassin',
        desc: 'A shadow in the night. Increases Agility and critical strike chance.',
        icon: Ghost,
        color: 'text-purple-400'
    },
    {
        id: 'Warlock',
        name: 'Warlock',
        desc: 'A practitioner of dark curses. Increases Intelligence and debuff potency.',
        icon: Skull,
        color: 'text-violet-500'
    },
    {
        id: 'Healer',
        name: 'Healer',
        desc: 'The backbone of any party. Increases Intelligence and recovery.',
        icon: Heart,
        color: 'text-green-500'
    },
    {
        id: 'Ranger',
        name: 'Ranger',
        desc: 'A deadly marksman from afar. Increases Perception and Agility.',
        icon: Sprout,
        color: 'text-emerald-500'
    }
];

export function JobSelectionModal({ isOpen, onClose, currentStats, completedQuestsCount, hasDefeatedIgris }: JobSelectionModalProps) {
    const [selectedJob, setSelectedJob] = useState<string | null>(null);

    // Hidden Class Logic (Necromancer)
    // Lore: Must have defeated Igris + Extreme Mental/Sensory Stats + Legendary Dedication
    const canSeeNecromancer = hasDefeatedIgris &&
        currentStats.intelligence >= 100 &&
        currentStats.perception >= 100 &&
        completedQuestsCount >= 500;

    const [isPending, setIsPending] = useState(false);
    const { showNotification } = useSystemNotification();

    const handleConfirm = async () => {
        if (!selectedJob) return;
        setIsPending(true);

        try {
            const result = await updatePlayerClassAction(selectedJob);
            if (result.success) {
                showNotification({
                    title: "CLASS CHANGE SUCCESSFUL",
                    message: `You have awakened as a ${selectedJob}!`,
                    type: 'SUCCESS'
                });
                onClose();
            } else {
                showNotification({
                    title: "CLASS CHANGE FAILED",
                    message: "Failed to recognize new class. Please try again.",
                    type: 'ERROR'
                });
            }
        } catch (error) {
            showNotification({
                title: "SYSTEM ERROR",
                message: "An unexpected error occurred during the trial.",
                type: 'ERROR'
            });
        } finally {
            setIsPending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
            <div className="w-full max-w-5xl bg-[#0a0a12] border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                    <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Class Change: The Trial</h2>
                    <p className="text-slate-400 font-mono text-sm mt-1">Select your specialized path. This decision cannot be reversed easily.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {JOBS.map(job => (
                        <button
                            key={job.id}
                            onClick={() => setSelectedJob(job.id)}
                            className={cn(
                                "flex flex-col items-center p-6 rounded-lg border transition-all text-center group relative overflow-hidden",
                                selectedJob === job.id
                                    ? "border-cyan-500 bg-cyan-950/30 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                    : "border-slate-800 bg-slate-900/40 hover:border-slate-600"
                            )}
                        >
                            <job.icon strokeWidth={1.5} className={cn("w-16 h-16 mb-4 flex-shrink-0 transition-transform group-hover:scale-110", job.color)} />
                            <h3 className="text-lg font-bold text-white mb-2">{job.name}</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">{job.desc}</p>
                        </button>
                    ))}

                    {/* Hidden Class Slot */}
                    {canSeeNecromancer ? (
                        <button
                            onClick={() => setSelectedJob('Necromancer')}
                            className={cn(
                                "flex flex-col items-center p-6 rounded-lg border transition-all text-center group relative overflow-hidden animate-pulse",
                                selectedJob === 'Necromancer'
                                    ? "border-purple-500 bg-purple-950/30 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                                    : "border-purple-900/50 bg-black hover:border-purple-500/50"
                            )}
                        >
                            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay" />
                            <Skull className="w-12 h-12 mb-4 text-purple-500 animate-[pulse_3s_ease-in-out_infinite]" />
                            <h3 className="text-lg font-black text-purple-200 mb-2 font-mono glitch-text">NECROMANCER</h3>
                            <p className="text-xs text-purple-400 leading-relaxed">The Monarch of Shadows. Command the dead.</p>
                        </button>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-slate-900 bg-black/50 opacity-50 cursor-not-allowed group relative">
                            <Lock className="w-8 h-8 text-slate-700 mb-2 group-hover:text-slate-500 transition-colors" />
                            <p className="text-xs text-slate-700 font-mono group-hover:text-slate-500 transition-colors">??? Locked ???</p>

                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-4 text-center">
                                <p className="text-[10px] text-red-500 font-mono uppercase tracking-widest mb-2">Conditions Not Met</p>
                                {!hasDefeatedIgris ? (
                                    <p className="text-[9px] text-red-400 font-mono">DEFEAT THE KNIGHT OF BLOOD</p>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-cyan-500 font-mono">MASTER YOUR SENSES AND MIND</p>
                                        <p className="text-[9px] text-purple-500 font-mono">PROVE YOUR DEDICATION TO THE GRIND</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer unchanged */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-2 rounded text-slate-400 hover:text-white transition-colors">CANCEL</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedJob || isPending}
                        className="px-8 py-2 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider shadow-lg shadow-cyan-900/20"
                    >
                        {isPending ? "AWAKENING..." : "CONFIRM SELECTION"}
                    </button>
                </div>
            </div>
        </div>
    );
}
