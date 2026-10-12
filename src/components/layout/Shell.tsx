
"use client";

import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { VitalStrip } from "./VitalStrip";
import { DashboardData } from "@/lib/dashboard-data";
import { JobSelectionModal } from "@/components/jobs/JobSelectionModal";
import { BossWidget } from "@/components/dashboard/BossWidget";
import { VictoryModal } from "@/components/dashboard/VictoryModal";
import AriseAnimation from "@/components/shadows/AriseAnimation";
import { useEffect, useState, useCallback } from "react";
import { StatsManager } from "@/lib/stats-manager";
import { NotificationProvider } from "@/components/system/NotificationProvider";
import { useRouter, usePathname } from "next/navigation";
import { SkillHotbar } from "@/components/skills/SkillHotbar";
import { LevelManager } from "@/components/dashboard/LevelManager";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Activity, User, Target, Sword, Zap, Shield, ShoppingBag, Coins, Info, ExternalLink } from "lucide-react";

interface ShellProps {
    children: React.ReactNode;
    data: DashboardData;
}

const TABS = [
    { id: "status", label: "STATUS", href: "/dashboard", icon: Activity },
    { id: "profile", label: "PROFILE", href: "/dashboard/profile", icon: User },
    { id: "quests", label: "QUESTS", href: "/dashboard/quests", icon: Target },
    { id: "bosses", label: "BOSSES", href: "/dashboard/bosses", icon: Sword },
    { id: "skills", label: "SKILLS", href: "/dashboard/skills", icon: Zap },
    { id: "habits", label: "HABITS", href: "/dashboard/habits", icon: Shield },
    { id: "inventory", label: "INVENTORY", href: "/dashboard/inventory", icon: ShoppingBag },
    { id: "store", label: "STORE", href: "/dashboard/store", icon: Coins },
    { id: "about", label: "ABOUT", href: "/dashboard/about", icon: Info },
];

const PUBLIC_REPOSITORY_URL = "https://github.com/negaterium/progression-protocol-public";

export function Shell({ children, data }: ShellProps) {
    const router = useRouter();
    const pathname = usePathname();

    // Initialize state from props
    // We update this state when props change (via useEffect below)
    const [profile, setProfile] = useState(data.profile);
    const [modifiers, setModifiers] = useState(data.modifiers);
    const [stats, setStats] = useState(data.stats);
    const [showJobModal, setShowJobModal] = useState(false);
    const [hasAutoShown, setHasAutoShown] = useState(false);
    const [completedCount, setCompletedCount] = useState(data.totalCompletions || 0);
    const [hasDefeatedIgris, setHasDefeatedIgris] = useState(data.hasDefeatedIgris || false);

    // Check Trigger Logic
    const checkJobUnlock = useCallback((currentProfile: DashboardData['profile'], igrisDefeated: boolean) => {
        if (!currentProfile?.id) return;
        const seenKey = `job_modal_seen_${currentProfile.id}`;
        const hasBeenSeen = typeof window !== 'undefined' && localStorage.getItem(seenKey);

        if (
            !hasBeenSeen &&
            !hasAutoShown &&
            (currentProfile.level ?? 0) >= 40 &&
            (!currentProfile.hunter_class || currentProfile.hunter_class === 'NONE') &&
            igrisDefeated
        ) {
            setShowJobModal(true);
            setHasAutoShown(true);
            localStorage.setItem(seenKey, 'true');
        }
    }, [hasAutoShown]);

    // Sync state with props (Re-hydration after server refresh)
    // Sync state when Server Data updates (e.g. after router.refresh())
    // This is CRITICAL for the "Level Up" flow to work without page reload.
    // We use a key-based approach or just rely on the effect to trigger when data changes,
    // but we MUST NOT call setState UNLESS the data actually changed and is different from current state
    // to avoid unnecessary re-renders. Actually, better to use the effect to only update when needed.
    useEffect(() => {
        const updateState = () => {
            if (data.profile && data.profile !== profile) setProfile(data.profile);
            if (data.modifiers && data.modifiers !== modifiers) setModifiers(data.modifiers);
            if (data.stats && data.stats !== stats) setStats(data.stats);
            if (data.totalCompletions !== undefined && data.totalCompletions !== completedCount) setCompletedCount(data.totalCompletions);
            if (data.hasDefeatedIgris !== undefined && data.hasDefeatedIgris !== hasDefeatedIgris) setHasDefeatedIgris(data.hasDefeatedIgris);

            requestAnimationFrame(() => {
                checkJobUnlock(data.profile, data.hasDefeatedIgris || false);
            });
        };

        // Defer state updates to avoid sync cascading renders warning
        const timer = setTimeout(updateState, 0);
        return () => clearTimeout(timer);
    }, [data, checkJobUnlock, profile, modifiers, stats, completedCount, hasDefeatedIgris]);

    // Listener for Updates
    useEffect(() => {
        const handleUpdate = () => {
            // Trigger server re-fetch
            router.refresh();
        };

        window.addEventListener('progression_protocol_update', handleUpdate);
        return () => window.removeEventListener('progression_protocol_update', handleUpdate);
    }, [router]);

    // Listener for manual Job Modal trigger
    useEffect(() => {
        const handleOpenJobModal = () => setShowJobModal(true);
        window.addEventListener('solo_open_job_modal', handleOpenJobModal);
        return () => window.removeEventListener('solo_open_job_modal', handleOpenJobModal);
    }, []);

    // Combat Feedback State
    const [damageFlash, setDamageFlash] = useState(false);
    const [damageAmount, setDamageAmount] = useState(0);
    const [victoryOpen, setVictoryOpen] = useState(false);
    const [victoryData, setVictoryData] = useState<any>(null);
    const [showArise, setShowArise] = useState(false);
    const [ariseData, setAriseData] = useState<any>(null);

    // Global Event Listeners for Combat
    useEffect(() => {
        const handleBossDamage = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.playerDamage > 0) {
                setDamageAmount(detail.playerDamage);
                setDamageFlash(true);
                setTimeout(() => setDamageFlash(false), 800);
            }
            if (detail && detail.victory && detail.rewards) {
                setVictoryData({
                    bossName: detail.rewards.bossName || "Boss",
                    bossImage: detail.rewards.bossImage,
                    bossRank: detail.rewards.bossRank,
                    bossDescription: detail.rewards.bossDescription,
                    bossIntel: detail.rewards.bossIntel,
                    bossDamageType: detail.rewards.bossDamageType,
                    xpGained: detail.rewards.xp,
                    goldGained: detail.rewards.gold,
                    drops: detail.rewards.drops || [],
                    shadowExtracted: detail.rewards.shadowExtracted
                });
                setVictoryOpen(true);
            }
        };

        const handlePlayerDamageDirect = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.damage > 0) {
                // Only show if positive damage
                setDamageAmount(detail.damage);
                setDamageFlash(true);
                setTimeout(() => setDamageFlash(false), 800);
            }
        };

        window.addEventListener('solo_boss_damage', handleBossDamage);
        window.addEventListener('solo_player_damage', handlePlayerDamageDirect);

        return () => {
            window.removeEventListener('solo_boss_damage', handleBossDamage);
            window.removeEventListener('solo_player_damage', handlePlayerDamageDirect);
        };
    }, []);

    // Layout State
    const [isMobileOpen, setIsMobileOpen] = useState(false);



    const effectiveStats = stats ? StatsManager.calculateEffectiveStats({
        strength: stats.strength || 10,
        agility: stats.agility || 10,
        intelligence: stats.intelligence || 10,
        vitality: stats.vitality || 10,
        perception: stats.perception || 10
    }, modifiers) : { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10 };

    return (
        <NotificationProvider>
            <div className="flex h-screen overflow-hidden bg-black text-cyan-100 font-mono selection:bg-cyan-900/50">
                {/* Desktop: Slim vital strip | Mobile: Horizontal bar below header */}
                <VitalStrip data={data} />

                {/* Mobile Sidebar Drawer (hamburger menu) */}
                <Sidebar
                    data={data}
                    isOpen={isMobileOpen}
                    onClose={() => setIsMobileOpen(false)}
                />

                {/* Main Content Area */}
                <main className="flex-1 relative overflow-y-auto flex flex-col custom-scrollbar pt-[104px] lg:pt-0 lg:pl-[256px]">
                    {/* Mobile Header Trigger */}
                    <MobileHeader onOpenConfig={() => setIsMobileOpen(true)} />

                    {/* Top Gradient Line */}
                    <div className="absolute top-16 lg:top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

                    <div className="container mx-auto max-w-7xl flex-1">
                        {/* Global Boss Widget - Standard Scroll (Not Sticky) */}
                        <div className="relative z-30 bg-black/90 backdrop-blur-md border-b border-white/5 shadow-2xl transition-all duration-300">
                            <BossWidget />
                        </div>

                        {/* Global Navigation Tabs */}
                        <div className="sticky top-16 lg:top-0 z-30 bg-black/80 backdrop-blur-md border-b border-cyan-900/30 h-14 shrink-0">
                            <div className="flex items-center overflow-x-auto no-scrollbar px-4 py-2 gap-2 lg:gap-4 lg:justify-start h-full">
                                {TABS.map((tab) => {
                                    const isActive = pathname === tab.href;
                                    return (
                                        <Link
                                            key={tab.id}
                                            href={tab.href}
                                            className={cn(
                                                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 whitespace-nowrap text-xs md:text-sm font-mono font-bold tracking-wider",
                                                isActive
                                                    ? "bg-cyan-950/50 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.2)]"
                                                    : "bg-transparent border-transparent text-slate-500 hover:text-cyan-200 hover:bg-cyan-950/20"
                                            )}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            <span>
                                                {tab.label}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="px-4 lg:px-8 pb-24 lg:pb-8">
                            {children}
                            <footer className="mx-auto mt-10 max-w-3xl border-t border-cyan-900/30 pt-4 text-center text-xs leading-relaxed text-slate-600">
                                <p>
                                    Progression Protocol · unofficial, non-commercial fan project inspired by Solo Leveling.
                                </p>
                                <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                                    <Link href="/dashboard/about" className="text-cyan-600 transition-colors hover:text-cyan-300">
                                        ABOUT & DISCLAIMER
                                    </Link>
                                    <span aria-hidden="true">·</span>
                                    <a
                                        href={`${PUBLIC_REPOSITORY_URL}/blob/master/SECURITY.md`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-cyan-600 transition-colors hover:text-cyan-300"
                                    >
                                        SECURITY
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                    <span aria-hidden="true">·</span>
                                    <span>Maintained by Negaterium</span>
                                </p>
                            </footer>
                        </div>
                    </div>

                    {/* Global Job Modal */}
                    {profile && (
                        <JobSelectionModal
                            isOpen={showJobModal}
                            onClose={() => setShowJobModal(false)}
                            userId={profile.id}
                            currentStats={effectiveStats as any}
                            completedQuestsCount={completedCount}
                            hasDefeatedIgris={hasDefeatedIgris}
                        />
                    )}

                    {/* Global Damage Overlay */}
                    {damageFlash && (
                        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
                            <div className="absolute inset-0 bg-red-600/20 animate-in fade-in duration-100 mix-blend-overlay" />
                            <div className="text-6xl font-black text-red-500 animate-bounce drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                                -{damageAmount}
                            </div>
                        </div>
                    )}

                    {/* Global Victory Modal */}
                    {victoryData && (
                        <VictoryModal
                            isOpen={victoryOpen}
                            onClose={() => {
                                setVictoryOpen(false);
                                if (victoryData?.shadowExtracted) {
                                    setAriseData(victoryData);
                                    setShowArise(true);
                                } else {
                                    window.dispatchEvent(new Event('progression_protocol_update'));
                                }
                            }}
                            bossName={victoryData.bossName}
                            xpGained={victoryData.xpGained}
                            goldGained={victoryData.goldGained}
                            drops={victoryData.drops}
                            bossImage={victoryData.bossImage}
                        />
                    )}

                    {/* Global Arise Animation */}
                    {showArise && ariseData && (
                        <AriseAnimation
                            shadowName={ariseData.bossName}
                            bossImage={ariseData.bossImage}
                            bossRank={ariseData.bossRank}
                            bossDescription={ariseData.bossDescription}
                            intel={ariseData.bossIntel}
                            onComplete={() => {
                                setShowArise(false);
                                setAriseData(null);
                                window.dispatchEvent(new Event('progression_protocol_update'));
                            }}
                        />
                    )}

                    {/* Global Level Up Listener */}
                    {profile && (
                        <LevelManager initialLevel={profile.level ?? 1} />
                    )}

                    {/* Skill Hotbar HUD */}
                    {data.hotbar && (
                        <SkillHotbar
                            hotbarSkills={data.hotbar}
                            currentMana={profile?.current_mana || 0}
                        />
                    )}
                </main>
            </div>
        </NotificationProvider>
    );
}
