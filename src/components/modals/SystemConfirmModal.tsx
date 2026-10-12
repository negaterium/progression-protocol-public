"use client";

import { AlertTriangle } from "lucide-react";

interface SystemConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export function SystemConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "CONFIRM",
    cancelText = "CANCEL",
    variant = 'danger'
}: SystemConfirmModalProps) {
    if (!isOpen) return null;

    const colors = {
        danger: {
            icon: "text-red-500",
            border: "border-red-900/50",
            bg: "bg-red-950/10",
            button: "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
        },
        warning: {
            icon: "text-orange-500",
            border: "border-orange-900/50",
            bg: "bg-orange-950/10",
            button: "bg-orange-600 hover:bg-orange-500 text-white"
        },
        info: {
            icon: "text-cyan-500",
            border: "border-cyan-900/50",
            bg: "bg-cyan-950/10",
            button: "bg-cyan-600 hover:bg-cyan-500 text-white"
        }
    };

    const style = colors[variant];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`relative w-full max-w-md bg-[#0a0a12] border ${style.border} rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-black/40">
                    <AlertTriangle className={`w-5 h-5 ${style.icon} animate-pulse`} />
                    <h3 className={`text-sm font-bold font-mono uppercase tracking-widest ${style.icon}`}>
                        {title}
                    </h3>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-300 font-sans leading-relaxed">
                        {message}
                    </p>
                    {variant === 'danger' && (
                        <div className="text-xs font-mono text-red-400 bg-red-950/20 p-3 rounded border border-red-900/30">
                            WARNING: PENALTY DETECTED. THIS ACTION CANNOT BE UNDONE.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/40 border-t border-white/5 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded text-xs font-bold font-mono text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-6 py-2 rounded text-xs font-bold font-mono tracking-wider transition-all ${style.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
