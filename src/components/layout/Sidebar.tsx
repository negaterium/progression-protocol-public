
"use client";

import { LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardData } from "@/lib/dashboard-data";
import { logout } from "@/app/login/actions";
import { MiniBossWidget } from "@/components/dashboard/MiniBossWidget";

interface SidebarProps {
    data: DashboardData;
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
                    onClick={onClose}
                />
            )}

            {/* Mobile Drawer — hidden on desktop */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 flex flex-col h-screen w-64 bg-black border-r border-cyan-900/50 overflow-hidden transition-all duration-300 ease-in-out lg:hidden",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Decorative Grid Background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between p-4 h-16 shrink-0">
                    <span className="font-mono font-bold text-cyan-500 tracking-wider">
                        SYSTEM
                    </span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Mini Boss Widget */}
                <div className="px-4 pb-2">
                    <MiniBossWidget />
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Footer */}
                <div className="p-4 border-t border-cyan-900/30 shrink-0">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-2 py-3 w-full text-left text-slate-500 hover:text-red-400 hover:bg-red-950/10 transition-colors rounded-sm group whitespace-nowrap"
                    >
                        <LogOut className="w-5 h-5 shrink-0 text-slate-600 group-hover:text-red-500" />
                        <span className="font-mono text-sm tracking-wider font-bold">
                            LOGOUT
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
}


