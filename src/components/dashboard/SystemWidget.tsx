"use client";

import { useEffect, useState } from "react";

const LORE_MESSAGES = [
    "SYSTEM STATUS: ONLINE",
    "MANA DENSITY: STABLE",
    "GATE PROXIMITY: NONE",
    "DUNGEON BREAK: NEGATIVE",
    "HUNTER REGISTRY: ACTIVE",
    "WORLD SEED: SYNCHRONIZED"
];

export function SystemWidget() {
    const [time, setTime] = useState<string>("");
    const [date, setDate] = useState<string>("");
    const [loreMessage, setLoreMessage] = useState(LORE_MESSAGES[0]);

    useEffect(() => {
        // Initial set
        requestAnimationFrame(() => {
            const now = new Date();
            setTime(now.toLocaleTimeString('en-US', { hour12: false }));
            setDate(now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase());
        });

        // Timer
        const timer = setInterval(() => {
            const n = new Date();
            setTime(n.toLocaleTimeString('en-US', { hour12: false }));
            setDate(n.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase());
        }, 1000);

        // Lore Cycler
        const loreTimer = setInterval(() => {
            const randomMsg = LORE_MESSAGES[Math.floor(Math.random() * LORE_MESSAGES.length)];
            setLoreMessage(randomMsg);
        }, 8000);

        return () => {
            clearInterval(timer);
            clearInterval(loreTimer);
        };
    }, []);

    // Prevent hydration mismatch by waiting for mount (Effect handles it essentially, but initial state is empty string)
    // We can render a placeholder or just wait. 
    // Since we use client, effective render happens after mount.

    return (
        <div className="flex flex-col items-end pointer-events-none select-none">
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-cyan-800 animate-pulse">●</span>
                <span className="text-xs font-mono font-bold text-cyan-500 tracking-widest">{time}</span>
            </div>
            <div className="text-[10px] font-mono text-cyan-700 tracking-tighter uppercase mb-1">
                {date}
            </div>
            <div className="text-[9px] font-mono text-cyan-900/80 tracking-widest border-t border-cyan-900/30 pt-1 mt-1">
                {loreMessage}
            </div>
        </div>
    );
}
