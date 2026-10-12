"use client";

import { useState } from "react";
import { HunterBody } from "@/components/inventory/HunterBody";
import { InventoryGrid } from "@/components/inventory/InventoryGrid";
import { Package, HardDrive, Shirt, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface InventoryMainProps {
    bagItems: any[];
    equipped: any;
    profile: any;
    stats: any;
    derivedStats: any;
}

export function InventoryMain({ bagItems, equipped, profile, stats, derivedStats }: InventoryMainProps) {
    const [mobileView, setMobileView] = useState<'EQUIPMENT' | 'STORAGE'>('STORAGE');

    return (
        <div className="p-4 md:p-6 h-screen flex flex-col animate-in fade-in duration-500">
            <header className="mb-4 md:mb-6 flex justify-between items-end border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-widest font-sans uppercase flex items-center gap-3">
                        <Package className="w-6 h-6 md:w-8 md:h-8 text-cyan-500" />
                        Inventory
                    </h1>
                    <p className="text-slate-500 font-mono text-xs md:text-sm mt-1 hidden md:block">
                        MANAGE YOUR EQUIPMENT AND ITEMS.
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-cyan-600 font-mono text-[10px] md:text-xs block flex items-center justify-end gap-1">
                        <HardDrive className="w-3 h-3" /> CAPACITY
                    </span>
                    <span className="text-xl md:text-2xl font-bold text-white font-mono">{bagItems.length} <span className="text-sm text-slate-600">/ ∞</span></span>
                </div>
            </header>

            {/* Mobile View Switcher */}
            <div className="lg:hidden flex gap-2 mb-4">
                <button
                    type="button"
                    aria-pressed={mobileView === 'STORAGE'}
                    onClick={() => setMobileView('STORAGE')}
                    className={cn(
                        "flex-1 py-2 text-xs font-bold uppercase tracking-wider border rounded flex items-center justify-center gap-2 transition-all",
                        mobileView === 'STORAGE'
                            ? "bg-cyan-950/50 text-cyan-400 border-cyan-500/50"
                            : "bg-slate-900/40 text-slate-500 border-slate-800"
                    )}
                >
                    <Box className="w-4 h-4" />
                    Storage
                </button>
                <button
                    type="button"
                    aria-pressed={mobileView === 'EQUIPMENT'}
                    onClick={() => setMobileView('EQUIPMENT')}
                    className={cn(
                        "flex-1 py-2 text-xs font-bold uppercase tracking-wider border rounded flex items-center justify-center gap-2 transition-all",
                        mobileView === 'EQUIPMENT'
                            ? "bg-cyan-950/50 text-cyan-400 border-cyan-500/50"
                            : "bg-slate-900/40 text-slate-500 border-slate-800"
                    )}
                >
                    <Shirt className="w-4 h-4" />
                    Equipment
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-1 overflow-hidden">
                {/* Visual Section (Equipment) */}
                <div className={cn(
                    "w-full lg:w-[400px] flex-none bg-slate-950/30 rounded-xl p-4 border border-white/5 flex flex-col transition-all",
                    // Mobile visibility logic
                    mobileView === 'EQUIPMENT' ? "flex flex-1" : "hidden lg:flex"
                )}>
                    <h2 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                        Equipment Status
                    </h2>
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar">
                        <HunterBody
                            equipped={equipped}
                            playerClass={profile?.hunter_class}
                            stats={stats}
                            derivedStats={derivedStats}
                        />
                    </div>
                </div>

                {/* Grid Section (Storage) */}
                <div className={cn(
                    "flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar",
                    // Mobile visibility logic
                    mobileView === 'STORAGE' ? "block" : "hidden lg:block"
                )}>
                    <h2 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider hidden lg:block">
                        Storage Box
                    </h2>
                    {bagItems.length > 0 ? (
                        <InventoryGrid
                            items={bagItems}
                            userLevel={profile?.level || 1}
                            hunterClass={profile?.hunter_class}
                            equippedItems={equipped}
                        />
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-lg">
                            <p>INVENTORY EMPTY</p>
                            <p className="text-xs mt-2">Visit the Store to purchase items.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
