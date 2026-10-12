"use client";

import { Menu } from "lucide-react";

interface MobileHeaderProps {
    onOpenConfig: () => void;
}

export function MobileHeader({ onOpenConfig }: MobileHeaderProps) {
    return (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-md border-b border-cyan-900/30">
            <div className="flex items-center gap-3">
                <button
                    onClick={onOpenConfig}
                    className="p-2 -ml-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 rounded-md transition-colors"
                    aria-label="Open Menu"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-mono font-bold text-cyan-500 tracking-wider">SYSTEM</span>
            </div>

            {/* Placeholder for potential right-side mobile actions (e.g. notifications) */}
            <div className="w-8" />
        </div>
    );
}
