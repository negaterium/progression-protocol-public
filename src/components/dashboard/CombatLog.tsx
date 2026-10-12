"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    Sword, Shield, Zap, Skull, Trophy, AlertTriangle,
    Crosshair, Activity, Users
} from "lucide-react";
import { fetchActiveEncounterAction } from "@/app/actions/bosses";

// ─── Types ───────────────────────────────────────────────────────────────────

type LogEntryType =
    | "PLAYER_ATTACK"
    | "PLAYER_CRIT"
    | "PLAYER_DOUBLE"
    | "SHADOW_ATTACK"
    | "SHADOW_SIEGE"
    | "BOSS_ATTACK"
    | "BOSS_EVADED"
    | "ABILITY"
    | "STATUS_EFFECT"
    | "ENCOUNTER_START"
    | "VICTORY"
    | "SYSTEM";

interface LogEntry {
    id: number;
    type: LogEntryType;
    timestamp: number;
    message: string;
    bossHp?: number;
    bossMaxHp?: number;
}

// ─── Module-level singleton store (survives router.refresh() re-renders) ──────
//
// Using module state means CombatLog's entries are never lost when Next.js
// App Router calls router.refresh() and re-renders the component tree.

let _entryId = 0;
let _entries: LogEntry[] = [];
let _hasEncounter = false;
let _bossName = "";
let _initialized = false;
const MAX_ENTRIES = 60;

type Listener = () => void;
const _listeners = new Set<Listener>();

function notify() {
    _listeners.forEach(fn => fn());
}

function pushEntry(entry: Omit<LogEntry, "id" | "timestamp">) {
    _entries = [..._entries, { ...entry, id: ++_entryId, timestamp: Date.now() }];
    if (_entries.length > MAX_ENTRIES) _entries = _entries.slice(-MAX_ENTRIES);
    notify();
}

function clearEntries() {
    _entries = [];
    notify();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }

function hpBar(hp: number, max: number, width = 18): string {
    const pct = Math.min(1, Math.max(0, hp / Math.max(1, max)));
    const filled = Math.round(pct * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
}

// ─── Global event handlers (registered once, outside component lifecycle) ────

function setupGlobalListeners() {
    if (typeof window === "undefined") return;

    const handleEngage = (e: Event) => {
        const d = (e as CustomEvent).detail;
        if (!d) return;
        const name = d.boss_name || d.bossName || "Unknown";
        _hasEncounter = true;
        _bossName = name;
        _entries = [];
        pushEntry({
            type: "ENCOUNTER_START",
            message: `Encounter initiated — ${name} [${d.boss_rank || d.boss?.rank || "?"}]`,
            bossHp: d.current_hp ?? d.currentHp,
            bossMaxHp: d.max_hp ?? d.maxHp,
        });
    };

    const handleDamage = (e: Event) => {
        const d = (e as CustomEvent).detail;
        if (!d) return;

        console.log("[CombatLog] solo_boss_damage received:", d);

        _hasEncounter = true;
        notify(); // ensure UI updates even if no entries added

        if (d.victory) {
            const name = _bossName || d.rewards?.bossName || "Boss";
            if (d.rewards?.bossName && !_bossName) _bossName = d.rewards.bossName;
            pushEntry({
                type: "VICTORY",
                message: `${name} DEFEATED — +${fmt(d.rewards?.xp ?? 0)} XP  +${fmt(d.rewards?.gold ?? 0)} G`,
                bossHp: 0,
                bossMaxHp: d.maxHp,
            });
            setTimeout(() => { _hasEncounter = false; notify(); }, 8000);
            return;
        }

        const hp = d.currentHp ?? 0;
        const maxHp = d.maxHp ?? 0;

        // Player attack row
        const dmg = d.damageDealt ?? 0;
        const armyDmg = d.summonDamage ?? 0;
        const totalDmg = dmg + armyDmg;

        if (totalDmg > 0) {
            // 1. Player attack row (if they did non-summon damage)
            const playerBaseDmg = dmg - armyDmg; 
            if (playerBaseDmg > 0) {
                const type: LogEntryType = d.isCrit ? "PLAYER_CRIT" : d.doubleStrike ? "PLAYER_DOUBLE" : "PLAYER_ATTACK";
                const suffix = d.isCrit ? " [CRITICAL HIT]" : d.doubleStrike ? " [DOUBLE STRIKE]" : "";
                pushEntry({ type, message: `Dealt ${fmt(playerBaseDmg)} damage${suffix}`, bossHp: hp + armyDmg, bossMaxHp: maxHp });
            }

            // 2. Shadow attack row
            if (armyDmg > 0) {
                const isSiege = d.isArmySiege;
                const type: LogEntryType = isSiege ? "SHADOW_SIEGE" : "SHADOW_ATTACK";
                const armyRatio = d.armyCapacityRatio ? ` (${Math.floor(d.armyCapacityRatio * 100)}% Capacity)` : "";
                const msg = isSiege 
                    ? `[ARMY SIEGE] Your shadow division swarmed the target for ${fmt(armyDmg)} damage!${armyRatio}`
                    : `[ARMY] Shadows assisted your strike for ${fmt(armyDmg)} extra damage.`;
                
                pushEntry({ type, message: msg, bossHp: hp, bossMaxHp: maxHp });
            }
        } else {
            // 0 damage (stunned) — still log it
            pushEntry({ type: "SYSTEM", message: "Attack blocked — status effect active", bossHp: hp, bossMaxHp: maxHp });
        }

        if (d.playerHealing > 0) {
            pushEntry({ type: "SYSTEM", message: `[LIFE DRAIN] Restored ${fmt(d.playerHealing)} HP`, bossHp: hp, bossMaxHp: maxHp });
        }

        // Ability row
        if (d.abilityName) {
            pushEntry({ type: "ABILITY", message: `${d.abilityName}${d.abilityDescription ? ` — ${d.abilityDescription}` : ""}`, bossHp: hp, bossMaxHp: maxHp });
        }

        // Status effect row
        if (d.statusApplied?.name) {
            pushEntry({ type: "STATUS_EFFECT", message: `${d.statusApplied.name} inflicted (${d.statusApplied.duration} rounds)`, bossHp: hp, bossMaxHp: maxHp });
        }
        if (d.statusResisted) {
            pushEntry({ type: "STATUS_EFFECT", message: `Iron Will resisted the boss status effect${d.abilityName ? ` from ${d.abilityName}` : ""}`, bossHp: hp, bossMaxHp: maxHp });
        }
        if (d.bossRooted) {
            pushEntry({ type: "STATUS_EFFECT", message: "Entangling Roots bound the Boss — counter-attack skipped for 1 round", bossHp: hp, bossMaxHp: maxHp });
        }

        // Boss counter-attack row
        if (d.playerDamage !== undefined) {
            if (d.evaded) {
                pushEntry({ type: "BOSS_EVADED", message: "Boss attack evaded", bossHp: hp, bossMaxHp: maxHp });
            } else if (d.playerDamage > 0) {
                const mitStr = d.mitigatedPercent && d.mitigatedPercent > 0
                    ? ` [${d.damageType ?? "PHYSICAL"} — ${Math.floor(d.mitigatedPercent)}% resisted]`
                    : d.damageType && d.damageType !== "PHYSICAL" ? ` [${d.damageType}]` : "";
                const shieldStr = d.playerManaDamage > 0
                    ? ` [MANA SHIELD — ${fmt(d.playerManaDamage)} MP${d.manaShieldShattered ? "; SHATTERED" : ""}]`
                    : "";
                pushEntry({ type: "BOSS_ATTACK", message: `Boss dealt ${fmt(d.playerDamage)} damage to you${mitStr}${shieldStr}`, bossHp: hp, bossMaxHp: maxHp });
            } else {
                const shieldStr = d.playerManaDamage > 0
                    ? `Mana Shield absorbed ${fmt(d.playerManaDamage)} damage${d.manaShieldShattered ? "; shield shattered" : ""}`
                    : "Boss attack: 0 damage (fully mitigated)";
                pushEntry({ type: "BOSS_EVADED", message: shieldStr, bossHp: hp, bossMaxHp: maxHp });
            }
        }
    };

    window.addEventListener("solo_boss_engaged", handleEngage);
    window.addEventListener("solo_boss_damage", handleDamage);
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
    const ts = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const base = "flex items-start gap-2 px-3 py-1.5 font-mono text-[11px] leading-tight border-b border-white/[0.03] animate-in fade-in slide-in-from-bottom-1 duration-300";

    const config: Record<LogEntryType, { cls: string; icon: React.ReactNode; prefix: string }> = {
        PLAYER_ATTACK:  { cls: "text-cyan-300 hover:bg-cyan-950/20",      icon: <Sword         className="w-3 h-3 text-cyan-500 shrink-0 mt-0.5" />,   prefix: "ATK"    },
        PLAYER_CRIT:    { cls: "text-yellow-300 hover:bg-yellow-950/20",   icon: <Crosshair     className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />, prefix: "CRIT"   },
        PLAYER_DOUBLE:  { cls: "text-emerald-300 hover:bg-emerald-950/20", icon: <Sword         className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />, prefix: "×2"    },
        SHADOW_ATTACK:  { cls: "text-purple-300 hover:bg-purple-950/20",  icon: <Users         className="w-3 h-3 text-purple-500 shrink-0 mt-0.5" />,  prefix: "ARMY"   },
        SHADOW_SIEGE:   { cls: "text-indigo-400 font-bold hover:bg-indigo-950/30", icon: <Users className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />, prefix: "SIEGE"  },
        BOSS_ATTACK:    { cls: "text-red-300 hover:bg-red-950/20",         icon: <Skull         className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />,    prefix: "DMG"    },
        BOSS_EVADED:    { cls: "text-slate-400 hover:bg-slate-900/20",     icon: <Shield        className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />,  prefix: "EVD"    },
        ABILITY:        { cls: "text-orange-300 hover:bg-orange-950/20",   icon: <Zap           className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />, prefix: "ABILITY"},
        STATUS_EFFECT:  { cls: "text-purple-300 hover:bg-purple-950/20",   icon: <AlertTriangle className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />, prefix: "STATUS" },
        ENCOUNTER_START:{ cls: "text-slate-300 hover:bg-slate-900/40",     icon: <Activity      className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />,  prefix: "SYS"    },
        VICTORY:        { cls: "text-amber-300 hover:bg-amber-950/30",     icon: <Trophy        className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />,  prefix: "WIN"    },
        SYSTEM:         { cls: "text-slate-500 hover:bg-slate-900/20",     icon: <Activity      className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />,  prefix: "SYS"    },
    };

    const { cls, icon, prefix } = config[entry.type];

    return (
        <div className={cn(base, cls)}>
            <span className="text-slate-600 shrink-0 tabular-nums w-[68px]">{ts}</span>
            {icon}
            <span className="shrink-0 w-[44px] text-right opacity-70 text-[9px] uppercase tracking-wider mt-0.5">{prefix}</span>
            <span className="flex-1">{entry.message}</span>
            {entry.bossHp !== undefined && entry.bossMaxHp !== undefined && (
                <span className="shrink-0 text-[9px] tabular-nums hidden sm:inline">
                    <span className="text-red-800 mr-1">{hpBar(entry.bossHp, entry.bossMaxHp)}</span>
                    <span className="text-red-500">{fmt(entry.bossHp)}</span>
                    <span className="text-slate-700">/{fmt(entry.bossMaxHp)}</span>
                </span>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CombatLog() {
    const [, forceUpdate] = useState(0);
    const [isMinimised, setIsMinimised] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Subscribe to module store — re-render whenever store changes
    const rerender = useCallback(() => forceUpdate(n => n + 1), []);

    useEffect(() => {
        _listeners.add(rerender);

        // Register global event listeners once per page load
        if (!_initialized) {
            _initialized = true;
            setupGlobalListeners();
        }

        // On first mount (or after state is cleared), check for active encounter
        if (!_hasEncounter) {
            fetchActiveEncounterAction().then(data => {
                if (data && !_hasEncounter) {
                    const name = (data.boss as any)?.name || "Unknown";
                    _hasEncounter = true;
                    _bossName = name;
                    if (_entries.length === 0) {
                        pushEntry({
                            type: "ENCOUNTER_START",
                            message: `Active encounter detected — ${name} [${(data.boss as any)?.rank || "?"}]`,
                            bossHp: data.current_hp,
                            bossMaxHp: data.max_hp,
                        });
                    } else {
                        notify();
                    }
                }
            }).catch(() => { notify(); });
        }

        return () => {
            _listeners.delete(rerender);
        };
    }, [rerender]);

    // Auto-scroll
    useEffect(() => {
        if (!isMinimised && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [_entries.length, isMinimised]); // eslint-disable-line react-hooks/exhaustive-deps

    const entries = _entries;
    const hasEncounter = _hasEncounter;
    const bossName = _bossName;

    return (
        <div className={cn(
            "rounded-lg border border-red-950/40 bg-black/90 overflow-hidden transition-all duration-500 shadow-[0_0_30px_rgba(220,38,38,0.08)]",
            hasEncounter ? "opacity-100" : "opacity-40"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2.5 border-b border-red-950/40 bg-gradient-to-r from-red-950/30 via-black to-black cursor-pointer select-none"
                onClick={() => setIsMinimised(p => !p)}
            >
                <div className="flex items-center gap-2.5">
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        hasEncounter ? "bg-red-500 animate-pulse shadow-[0_0_6px_#ef4444]" : "bg-slate-700"
                    )} />
                    <span className="text-[10px] font-mono font-black text-red-500 tracking-[0.2em] uppercase">
                        ENCOUNTER LOG
                    </span>
                    {bossName && (
                        <>
                            <span className="text-slate-700 text-[10px]">{"//"}</span>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                                {bossName.toUpperCase()}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] text-slate-600 font-mono tabular-nums">{entries.length} events</span>
                    <button
                        className="text-slate-400 hover:text-white transition-colors text-xs font-mono"
                        aria-expanded={!isMinimised}
                        aria-controls="encounter-log-content"
                        title={isMinimised ? "Expand encounter log" : "Collapse encounter log"}
                    >
                        {isMinimised ? "Show log" : "Hide log"}
                    </button>
                </div>
            </div>

            {/* Log Scroll Area */}
            {!isMinimised && (
                <div
                    ref={scrollRef}
                    id="encounter-log-content"
                    className="h-48 overflow-y-auto"
                    style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(153,27,27,0.4) transparent" }}
                >
                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 font-mono text-[11px]">
                            <Activity className="w-5 h-5 opacity-30" />
                            <span>{hasEncounter ? "Awaiting combat events — complete a quest to deal damage" : "No active encounter"}</span>
                        </div>
                    ) : (
                        entries.map(entry => <LogRow key={entry.id} entry={entry} />)
                    )}
                </div>
            )}

            {/* Footer */}
            {!isMinimised && (
                <div className="flex items-center justify-between px-3 py-1 border-t border-white/5 bg-black/60">
                    <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">
                        SYSTEM · REAL-TIME
                    </span>
                    <button
                        onClick={e => { e.stopPropagation(); clearEntries(); }}
                        className="text-[9px] font-mono text-slate-700 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                        clear
                    </button>
                </div>
            )}
        </div>
    );
}
