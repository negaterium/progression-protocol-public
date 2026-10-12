"use client";

import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";

interface SystemAlertProps {
    message: string;
    type?: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
    onClose: () => void;
}

export function SystemAlert({ message, type = 'INFO', onClose }: SystemAlertProps) {
    useEffect(() => {
        // Auto-close after 3 seconds for success messages
        if (type === 'SUCCESS') {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [type, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'SUCCESS': return <CheckCircle className="w-6 h-6 text-green-500" />;
            case 'ERROR': return <XCircle className="w-6 h-6 text-red-500" />;
            case 'WARNING': return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
            default: return <Info className="w-6 h-6 text-cyan-500" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'SUCCESS': return {
                border: 'border-green-500/50',
                bg: 'bg-green-950/20',
                text: 'text-green-500',
                title: 'SYSTEM NOTIFICATION'
            };
            case 'ERROR': return {
                border: 'border-red-500/50',
                bg: 'bg-red-950/20',
                text: 'text-red-500',
                title: 'ERROR'
            };
            case 'WARNING': return {
                border: 'border-yellow-500/50',
                bg: 'bg-yellow-950/20',
                text: 'text-yellow-500',
                title: 'WARNING'
            };
            default: return {
                border: 'border-cyan-500/50',
                bg: 'bg-cyan-950/20',
                text: 'text-cyan-500',
                title: 'SYSTEM MESSAGE'
            };
        }
    };

    const colors = getColors();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`relative w-full max-w-md border ${colors.border} ${colors.bg} shadow-[0_0_30px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${colors.border}`}>
                    <div className="flex items-center gap-3">
                        {getIcon()}
                        <h3 className={`font-mono font-bold tracking-wider ${colors.text}`}>
                            {colors.title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className={`${colors.text} hover:text-white transition-colors`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Message */}
                <div className="p-6">
                    <p className="text-white font-mono text-sm leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className={`p-3 border-t ${colors.border} flex justify-end bg-black/30`}>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 ${colors.border} ${colors.text} border hover:bg-white/5 text-xs font-mono font-bold tracking-wider transition-colors rounded`}
                    >
                        OK
                    </button>
                </div>

                {/* Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,255,255,0.02)_50%)] bg-[size:100%_4px] pointer-events-none" />
            </div>
        </div>
    );
}
