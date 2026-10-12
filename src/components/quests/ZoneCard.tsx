"use client";

import { cn } from "@/lib/utils";
import { Database } from "@/types/database.types";
import { MapPin } from "lucide-react";

type Zone = Database['public']['Tables']['zones']['Row'];

interface ZoneCardProps {
    zone: Zone;
    isActive?: boolean;
    onSelect: (zone: Zone) => void;
    questCount?: number;
}

export function ZoneCard({ zone, isActive, onSelect, questCount = 0 }: ZoneCardProps) {
    const zoneImages: Record<string, string> = {
        'HOME BASE': '/zones/home.webp',
        'WORK SECTOR': '/zones/work.webp',
        'TRAINING GROUNDS': '/zones/training.webp',
        'LIBRARY': '/zones/library.webp',
        'SANCTUARY': '/zones/sanctuary.webp',
        'FANTASYA': '/zones/fantasya.webp'
    };

    const zoneImage = zoneImages[zone.name] || '/zones/home.webp';

    return (
        <button
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(zone)}
            className={cn(
                "relative h-48 rounded-xl border transition-all duration-500 text-left w-full group overflow-hidden",
                "hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]",
                isActive
                    ? "border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-500/50"
                    : "border-white/10 grayscale-[0.3] hover:grayscale-0 hover:border-cyan-500/50"
            )}
        >
            {/* Background Image */}
            <div
                className={cn(
                    "absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110",
                    !isActive && "opacity-60 group-hover:opacity-100"
                )}
                style={{ backgroundImage: `url(${zoneImage})` }}
            />

            {/* Overlay Gradient */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-t transition-opacity duration-500",
                isActive
                    ? "from-black via-black/40 to-transparent opacity-90"
                    : "from-black via-black/60 to-transparent opacity-80 group-hover:opacity-90"
            )} />

            {/* Inner Content */}
            <div className="relative h-full p-5 flex flex-col justify-end">
                <div className="flex items-center justify-between mb-2">
                    <div className={cn(
                        "p-1.5 rounded-lg border transition-colors duration-300",
                        isActive ? "bg-cyan-500/20 border-cyan-400/50" : "bg-black/40 border-white/10 group-hover:border-cyan-500/30"
                    )}>
                        <MapPin
                            className={cn("w-4 h-4", isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400")}
                            style={{ color: isActive && zone.hex_color ? zone.hex_color : undefined }}
                            suppressHydrationWarning
                        />
                    </div>
                    {questCount > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 backdrop-blur-sm animate-pulse-slow">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,1)]" />
                            <span className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider">
                                {questCount} MISSIONS
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-1">
                    <h3 className={cn(
                        "text-xl font-black font-sans tracking-tight transition-colors duration-300",
                        isActive ? "text-white" : "text-slate-200 group-hover:text-white"
                    )}>
                        {zone.name}
                    </h3>
                    <p className={cn(
                        "text-[11px] font-mono line-clamp-2 leading-snug transition-colors duration-300",
                        isActive ? "text-cyan-200/70" : "text-slate-400 group-hover:text-slate-200"
                    )}>
                        {zone.description || "Sector analysis pending..."}
                    </p>
                </div>
            </div>

            {/* Active Glow Accent */}
            {isActive && (
                <div
                    className="absolute top-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                    style={{ backgroundColor: zone.hex_color || undefined }}
                    suppressHydrationWarning
                />
            )}

            {/* Decorative Corner Scanline Effects */}
            <div className="absolute top-2 right-2 flex gap-1 transform scale-75 opacity-50">
                <div className="w-1 h-3 bg-cyan-500/20" />
                <div className="w-1 h-3 bg-cyan-500/40" />
                <div className="w-1 h-3 bg-cyan-500/60" />
            </div>
        </button>
    );
}
