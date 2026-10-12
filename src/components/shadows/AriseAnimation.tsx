"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AriseAnimationProps {
    onComplete?: () => void;
    shadowName: string;
    bossImage?: string;
    bossRank?: string;
    bossDescription?: string;
    intel?: any;
}

export default function AriseAnimation({
    onComplete,
    shadowName,
    bossImage,
    bossRank,
    bossDescription,
    intel
}: AriseAnimationProps) {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        // Timeline of animation
        // 0ms: Start (Black Screen)
        // 100ms: Text "ARISE" appears
        // 2000ms: Explosion / Reveal (Boss image appears)
        // 5000ms: Fade out -> onComplete

        const t1 = setTimeout(() => setPhase(1), 100);
        const t2 = setTimeout(() => setPhase(2), 2000); // Shadow Reveal (Boss Data)
        const t3 = setTimeout(() => setPhase(3), 5500); // Fade Start

        const tEnd = setTimeout(() => {
            onComplete?.();
        }, 6000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(tEnd);
        };
    }, [onComplete]);

    // Parse intel data
    let parsedIntel = intel;
    if (typeof parsedIntel === 'string') {
        try {
            parsedIntel = JSON.parse(parsedIntel);
        } catch {
            parsedIntel = {};
        }
    }

    const weaknesses = parsedIntel?.weaknesses || [];
    const resistances = parsedIntel?.resistances || [];
    const abilities = parsedIntel?.abilities || [];

    return (
        <div className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden transition-opacity duration-500",
            phase === 3 ? "opacity-0" : "opacity-100"
        )}>
            {/* Background Boss Image Reveal */}
            {bossImage && (
                <div className={cn(
                    "absolute inset-0 z-0 transition-all duration-[2000ms] ease-out",
                    phase >= 2 ? "opacity-40 scale-110 blur-sm" : "opacity-0 scale-150 blur-2xl"
                )}>
                    <img
                        src={bossImage}
                        alt="Boss"
                        className="w-full h-full object-cover grayscale brightness-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
                    <div className="absolute inset-0 bg-purple-900/20 mix-blend-overlay" />
                </div>
            )}

            {/* Background Chaos overlay */}
            <div className={cn(
                "absolute inset-0 bg-purple-600/10 mix-blend-color-dodge transition-opacity duration-1000 z-10",
                phase >= 1 ? "opacity-100" : "opacity-0"
            )} />

            {/* Main Command Word */}
            <div className={cn(
                "relative z-20 text-center transition-all duration-1000",
                phase === 1 ? "scale-100 opacity-100" : (phase > 1 ? "scale-150 opacity-0 blur-2xl" : "scale-50 opacity-0")
            )}>
                <h1 className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-t from-purple-600 to-white drop-shadow-[0_0_50px_rgba(168,85,247,0.8)] tracking-widest animate-pulse">
                    ARISE
                </h1>
                {bossImage && (
                    <div className="mt-8 flex justify-center">
                        <div className="relative w-48 h-48 md:w-72 md:h-72 border-2 border-purple-600/40 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(168,85,247,0.4)] animate-in zoom-in-75 duration-1000 delay-300">
                            <img
                                src={bossImage}
                                alt="Shadow Boss"
                                className="w-full h-full object-cover grayscale brightness-90 saturate-[0.8]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/20" />
                        </div>
                    </div>
                )}
            </div>

            {/* Shadow Reveal & Boss Info */}
            <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center transition-all duration-[1200ms] z-30 px-6",
                phase === 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            )}>
                <div className="text-purple-400 font-mono tracking-[0.6em] text-xs md:text-sm uppercase mb-4 animate-in fade-in slide-in-from-top-4 duration-1000 delay-500">
                    SHADOW EXTRACTION SUCCESSFUL
                </div>

                <div className="relative mb-6">
                    <h2 className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_0_40px_rgba(168,85,247,1)] uppercase tracking-tight text-center">
                        {shadowName}
                    </h2>
                    {bossRank && (
                        <div className="absolute -top-6 -right-12 bg-purple-600 text-white font-black px-3 py-1 rounded-sm text-xl rotate-12 border-2 border-white shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                            {bossRank}
                        </div>
                    )}
                </div>

                <div className="max-w-2xl w-full bg-black/60 backdrop-blur-xl border border-purple-500/30 rounded-lg p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-1000 delay-700">
                    <p className="text-purple-200 text-sm md:text-base mb-6 text-center italic font-medium leading-relaxed">
                        &quot;{bossDescription || "A powerful soul has been bound to the monarch's will."}&quot;
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Abilities */}
                        {abilities.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                                    Legacy_Abilities
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {abilities.map((ability: string, i: number) => (
                                        <span key={i} className="text-xs px-2 py-1 rounded bg-purple-900/30 text-purple-300 border border-purple-700/30 font-mono">
                                            {ability}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Combat Intel */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                                Combat_Intel
                            </h3>
                            <div className="space-y-1">
                                {weaknesses.length > 0 && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        <span className="text-cyan-500 font-bold uppercase mr-2">Weak:</span>
                                        {weaknesses.join(", ")}
                                    </div>
                                )}
                                {resistances.length > 0 && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        <span className="text-purple-500 font-bold uppercase mr-2">Resist:</span>
                                        {resistances.join(", ")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-purple-500/20 text-center">
                        <div className="inline-block px-8 py-2 bg-gradient-to-r from-purple-900/40 via-purple-600/40 to-purple-900/40 rounded text-white font-black tracking-[0.3em] uppercase text-xs border border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.3)] animate-pulse">
                            NEW SOLDIER ADDED TO ARMY
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Glitch Overlay */}
            <div className="absolute inset-0 z-40 pointer-events-none opacity-20 transition-opacity duration-1000">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)]" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
            </div>

            {/* Particles/Smoke effect */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div className={cn(
                    "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-[3000ms]",
                    phase >= 2 ? "w-[1500px] h-[1500px] bg-purple-600/10 blur-[150px] opacity-100" : "w-[500px] h-[500px] bg-purple-600/20 blur-[100px] opacity-0"
                )} />
            </div>
        </div>
    );
}

