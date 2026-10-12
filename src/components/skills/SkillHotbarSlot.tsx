import { cn } from "@/lib/utils";
import { ZapIcon, Hourglass } from "lucide-react";
import { useEffect, useState, useCallback, createElement, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { getSkillIcon } from "./SkillIcons";

interface SkillHotbarSlotProps {
    slotNumber: number;
    skill?: {
        id: string;
        name: string;
        // icon?: string; // Removed
        manaCost: number;
        cooldown: number;
        lastUsed?: string;
        description?: string;
        category?: string;
        requiredClass?: string;
    };
    currentMana: number;
    onActivate: (skillId: string) => void;
}

export function SkillHotbarSlot({ slotNumber, skill, currentMana, onActivate }: SkillHotbarSlotProps) {
    const calculateRemaining = useCallback(() => {
        if (!skill || !skill.lastUsed || skill.cooldown <= 0) return 0;
        const lastUsed = new Date(skill.lastUsed).getTime();
        const now = Date.now();
        const elapsed = (now - lastUsed) / 1000;
        return Math.max(0, skill.cooldown - elapsed);
    }, [skill]);

    // Initialize state
    // The initial render must match on the server and during hydration. Read the
    // wall clock only after mounting; activation still checks the real cooldown.
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const slotRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (!hasSkill) return;
        setIsHovered(true);
        if (slotRef.current) {
            const rect = slotRef.current.getBoundingClientRect();
            setTooltipStyle({
                position: 'fixed',
                top: rect.top + rect.height / 2,
                left: rect.left - 16,
                transform: 'translate(-100%, -50%)',
                zIndex: 100
            });
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    // Cooldown Logic
    useEffect(() => {
        if (!skill || skill.cooldown <= 0) return;

        const initialUpdate = setTimeout(() => setCooldownRemaining(calculateRemaining()), 0);
        const interval = setInterval(() => {
            const remaining = calculateRemaining();
            setCooldownRemaining(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 1000);

        return () => { clearTimeout(initialUpdate); clearInterval(interval); };
    }, [skill, calculateRemaining]);

    const hasSkill = !!skill;
    const isOnCooldown = cooldownRemaining > 0;
    const isManaLow = hasSkill && currentMana < skill.manaCost;
    // Pulp if mana is low AND not on cooldown
    const isPulsing = isManaLow && !isOnCooldown;

    // Icon Data
    const iconData = skill ? getSkillIcon(skill.name) : null;

    const formatCooldown = (seconds: number) => {
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${Math.ceil(seconds % 60)}s`;
    };

    const handleClick = () => {
        if (!skill) return;
        if (isOnCooldown || calculateRemaining() > 0) return;
        // Allow clicking even if low mana, let the action fail/warn
        onActivate(skill.id);
    };

    return (
        <div
            ref={slotRef}
            className={cn(
                "relative shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-lg border-2 flex items-center justify-center transition-all duration-200 select-none group",
                hasSkill ? "bg-black/80 border-cyan-500/50 cursor-pointer hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]" : "bg-black/40 border-slate-800",
                isPulsing && "animate-pulse border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]",
                isOnCooldown && "opacity-50 grayscale cursor-not-allowed"
            )}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Slot Number */}
            <div className="absolute top-0.5 left-1 text-[8px] md:text-[10px] font-mono text-slate-500 group-hover:text-cyan-400">
                {slotNumber}
            </div>

            {hasSkill ? (
                <>
                    {/* Icon */}
                    {iconData ? (
                        <div className="w-8 h-8 md:w-10 md:h-10 relative flex items-center justify-center">
                            {iconData.type === 'png' ? (
                                <Image
                                    src={iconData.icon}
                                    alt={skill.name}
                                    fill
                                    className="object-contain"
                                />
                            ) : (
                                createElement(iconData.icon, {
                                    className: cn("w-6 h-6 md:w-8 md:h-8", isManaLow ? "text-red-400" : "text-cyan-400")
                                })
                            )}
                        </div>
                    ) : (
                        <ZapIcon className={cn("w-6 h-6 md:w-8 md:h-8", isManaLow ? "text-red-400" : "text-cyan-400")} />
                    )}

                    {/* Mana Cost */}
                    <div className={cn(
                        "absolute bottom-0.5 right-1 text-[8px] md:text-[10px] font-bold font-mono",
                        isManaLow ? "text-red-500" : "text-cyan-200"
                    )}>
                        {skill.manaCost} MP
                    </div>

                    {/* Cooldown Overlay */}
                    {isOnCooldown && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg backdrop-blur-[1px]">
                            <Hourglass className="w-3 h-3 md:w-4 md:h-4 text-white/70 mb-0.5" />
                            <span className="text-[10px] md:text-xs font-bold text-white drop-shadow-md leading-none text-center">
                                {formatCooldown(cooldownRemaining)}
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center opacity-20">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                </div>
            )}

            {/* Hover Tooltip (Portal) */}
            {hasSkill && isHovered && typeof document !== 'undefined' && createPortal(
                <div 
                    style={tooltipStyle}
                    className="w-56 bg-black/95 border border-cyan-500/50 p-3 rounded-md transition-all duration-200 pointer-events-none hidden md:block shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-sm animate-in fade-in zoom-in-95"
                >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm uppercase tracking-wider text-cyan-400">
                            {skill.name}
                        </h4>
                        <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {skill.category || 'ACTIVE'}
                        </span>
                    </div>

                    <div className="h-0.5 w-full bg-slate-800/50 rounded-full mb-3 overflow-hidden">
                        <div className="h-full w-full bg-cyan-500" />
                    </div>

                    {/* Description */}
                    <p className="text-[10px] text-slate-300 leading-relaxed mb-3 font-sans opacity-90">
                        {skill.description || "No description available."}
                    </p>

                    {/* Stats */}
                    <div className="border-t border-cyan-900/30 pt-2 mt-auto">
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 mb-1">
                            <span>COST:</span>
                            <span className="text-cyan-300 font-bold">{skill.manaCost} MP</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 mb-1">
                            <span>COOLDOWN:</span>
                            <span className="text-cyan-300 font-bold">{skill.cooldown}s</span>
                        </div>
                        {skill.requiredClass && (
                            <div className="flex justify-between items-center text-[9px] font-mono text-red-400 mt-2 pt-1 border-t border-slate-800/50">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                    REQ:
                                </div>
                                <span>{skill.requiredClass}</span>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
