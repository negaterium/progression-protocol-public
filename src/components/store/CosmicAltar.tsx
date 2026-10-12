"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";
import { purchaseAltarUpgradeAction } from "@/app/actions/altar";
import { useSystemNotification } from "@/components/system/NotificationProvider";

interface CosmicAltarProps {
    userEssence: number;
    userStats: {
        strength: number;
        agility: number;
        intelligence: number;
        vitality: number;
        perception: number;
        luck: number;
        cosmic_power?: number;
    };
    userLevel: number;
}

const UPGRADES = [
    {
        id: "strength",
        name: "Void Strength Infusion",
        description: "Injects raw void energy to permanently increase base Strength.",
        cost: 5,
        effect: "+5 Base Strength",
        image: "/items/altar-strength.png",
        color: "from-red-500/20 to-red-950/20 border-red-500/30 text-red-400 hover:border-red-500/60"
    },
    {
        id: "agility",
        name: "Void Agility Infusion",
        description: "Condenses chaotic void currents to permanently increase base Agility.",
        cost: 5,
        effect: "+5 Base Agility",
        image: "/items/altar-agility.png",
        color: "from-blue-500/20 to-blue-950/20 border-blue-500/30 text-blue-400 hover:border-blue-500/60"
    },
    {
        id: "intelligence",
        name: "Void Intelligence Infusion",
        description: "Awakens dark secrets within to permanently increase base Intelligence.",
        cost: 5,
        effect: "+5 Base Intelligence",
        image: "/items/altar-intelligence.png",
        color: "from-purple-500/20 to-purple-950/20 border-purple-500/30 text-purple-400 hover:border-purple-500/60"
    },
    {
        id: "vitality",
        name: "Void Vitality Infusion",
        description: "Hardens the vessel with cosmic matter to permanently increase base Vitality.",
        cost: 5,
        effect: "+5 Base Vitality",
        image: "/items/altar-vitality.png",
        color: "from-emerald-500/20 to-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60"
    },
    {
        id: "perception",
        name: "Void Perception Infusion",
        description: "Expands sensory depth beyond reality to permanently increase base Perception.",
        cost: 5,
        effect: "+5 Base Perception",
        image: "/items/altar-perception.png",
        color: "from-amber-500/20 to-amber-950/20 border-amber-500/30 text-amber-400 hover:border-amber-500/60"
    },
    {
        id: "luck",
        name: "Eldritch Luck Blessing",
        description: "Aligns the stars in your favor to permanently increase base Luck.",
        cost: 8,
        effect: "+10 Base Luck",
        image: "/items/cosmic-shard.webp",
        color: "from-pink-500/20 to-pink-950/20 border-pink-500/30 text-pink-400 hover:border-pink-500/60"
    },
    {
        id: "cosmic_power",
        name: "Acausal Resilience Infusion",
        description: "Infuses the soul with Cosmic Power, permanently scaling global Defense.",
        cost: 10,
        effect: "+250 Cosmic Power (+2.5 Defense)",
        image: "/items/essence-of-arise.webp",
        color: "from-cyan-500/20 to-cyan-950/20 border-cyan-500/30 text-cyan-400 hover:border-cyan-500/60"
    },
    {
        id: "key_cosmic",
        name: "Synthesize Cosmic Key",
        description: "Forges a gateway key using pure Cosmic Essence to unlock the Cosmic Realm.",
        cost: 10,
        effect: "1x Instant Dungeon Key (Cosmic)",
        image: "/items/dungeon-key-d.webp",
        color: "from-yellow-500/20 to-yellow-950/20 border-yellow-500/30 text-yellow-400 hover:border-yellow-500/60"
    },
    {
        id: "holy_water",
        name: "Synthesize Holy Water",
        description: "Condenses healing energies to forge a single phial of Holy Water of Life.",
        cost: 15,
        effect: "1x Holy Water of Life (Full HP/MP, Cleanses Disease)",
        image: "/items/holy-water-of-life.webp",
        color: "from-teal-500/20 to-teal-950/20 border-teal-500/30 text-teal-400 hover:border-teal-500/60"
    }
];

export function CosmicAltar({ userEssence }: CosmicAltarProps) {
    const { showNotification } = useSystemNotification();
    const [upgradingId, setUpgradingId] = useState<string | null>(null);

    const handleUpgrade = async (upgradeId: string, upgradeName: string) => {
        setUpgradingId(upgradeId);
        try {
            const res = await purchaseAltarUpgradeAction(upgradeId);
            if (res.error) {
                throw new Error(res.error);
            }

            // Trigger server refresh and reload UI state
            window.dispatchEvent(new Event('progression_protocol_update'));

            showNotification({
                title: "ALTAR TRANSCENDENCE",
                message: `Successfully claimed: ${upgradeName}`,
                type: 'SUCCESS'
            });
        } catch (error: any) {
            showNotification({
                title: "SYNTHESIS FAILED",
                message: error.message || "Failed to upgrade at Cosmic Altar.",
                type: 'ERROR'
            });
        } finally {
            setUpgradingId(null);
        }
    };

    return (
        <div className="space-y-8 pb-32">
            {/* Header info bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border border-cyan-500/20 bg-cyan-950/10 rounded-xl gap-4 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="space-y-1 relative z-10">
                    <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                        COSMIC SANCTUARY
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                        OFFER PRIMARY ESSENCE TO ACCRUE ABSOLUTE STATS AND METE OUT DRACONIC ARTIFACTS.
                    </p>
                </div>
                <div className="p-4 border border-cyan-500/30 bg-cyan-950/30 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.15)] flex flex-col items-center md:items-end relative z-10">
                    <span className="text-[10px] text-cyan-500 font-mono tracking-widest uppercase mb-1">Available Essence</span>
                    <span className="text-2xl font-black text-cyan-300 font-mono tracking-wider flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-cyan-400 animate-spin-slow" />
                        {userEssence} CE
                    </span>
                </div>
            </div>

            {/* Grid of upgrades */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {UPGRADES.map((upg) => {
                    const canAfford = userEssence >= upg.cost;
                    const isUpgrading = upgradingId === upg.id;

                    return (
                        <div
                            key={upg.id}
                            className={cn(
                                "flex flex-col rounded-xl border p-5 transition-all duration-300 bg-black/40 hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                                upg.color
                            )}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="relative w-12 h-12 border border-white/10 bg-black/50 rounded-lg overflow-hidden flex items-center justify-center p-1">
                                    <Image
                                        src={upg.image}
                                        alt={upg.name}
                                        fill
                                        className="object-contain p-1"
                                        sizes="48px"
                                    />
                                </div>
                                <span className="px-3 py-1 bg-black/50 border border-white/10 rounded-full font-mono text-[10px] font-bold text-slate-300">
                                    Cost: {upg.cost} CE
                                </span>
                            </div>

                            <div className="flex-1 space-y-2 mb-6">
                                <h4 className="font-bold text-white text-base tracking-wide uppercase font-sans">
                                    {upg.name}
                                </h4>
                                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                                    {upg.description}
                                </p>
                                <div className="pt-2">
                                    <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/40 px-2.5 py-1 rounded border border-cyan-800/20 block text-center w-full">
                                        Effect: {upg.effect}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                aria-label={`${upg.name}, costs ${upg.cost} Cosmic Essence`}
                                onClick={() => handleUpgrade(upg.id, upg.name)}
                                disabled={!canAfford || isUpgrading}
                                className={cn(
                                    "w-full py-2.5 rounded font-mono font-bold text-xs uppercase tracking-widest border transition-all duration-200 flex items-center justify-center gap-2",
                                    canAfford
                                        ? "bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
                                        : "bg-slate-950/20 text-slate-600 border-white/5 cursor-not-allowed"
                                )}
                            >
                                {isUpgrading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                        SYNTHESIZING...
                                    </>
                                ) : (
                                    <>
                                        Claim Infusion
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

