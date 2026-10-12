"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsiblePanelProps {
    title: string;
    children: React.ReactNode;
    defaultCollapsed?: boolean;
    defaultOpen?: boolean;
    icon?: React.ReactNode;
}

export function CollapsiblePanel({ title, children, defaultCollapsed, defaultOpen, icon }: CollapsiblePanelProps) {
    // defaultOpen takes precedence if provided, otherwise fallback to !defaultCollapsed, otherwise false (collapsed)
    const initialOpen = defaultOpen !== undefined ? defaultOpen : (defaultCollapsed !== undefined ? !defaultCollapsed : false);
    const [isOpen, setIsOpen] = useState(initialOpen);

    return (
        <div className="space-y-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-left w-full group"
            >
                <span className="text-cyan-500 hover:text-cyan-300 transition-colors">
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
                {icon && <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">{icon}</span>}
                <span className="text-sm font-bold font-mono tracking-wide text-slate-400 group-hover:text-white transition-colors">
                    {title}
                </span>
                <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    {isOpen ? "COLLAPSE" : "EXPAND"}
                </span>
            </button>

            {isOpen && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
}
