"use client";

import { useRef, useState, useEffect } from "react";
import { format } from "date-fns";
import { RefreshCcw, Save, ShieldCheck, AlertTriangle, FileJson, Upload } from "lucide-react";
import { createDailyBackupAction, restoreUserBackupAction, getUserBackupsAction, exportUserDataAction, importUserDataAction } from "@/app/actions/backup";
import { cn } from "@/lib/utils";

interface BackupRestoreControlsProps {
    username: string;
}

export function BackupRestoreControls({ username }: BackupRestoreControlsProps) {
    const [backups, setBackups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmingRestore, setConfirmingRestore] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchBackups = async () => {
        setIsLoading(true);
        try {
            const res = await getUserBackupsAction();
            if (res.success && res.data?.backups) {
                setBackups(res.data.backups);
            }
        } catch (e) {
            console.error("Failed to fetch backups:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Load initial data
    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await createDailyBackupAction('MANUAL');
            if (!result.success) throw new Error(result.error);
            await fetchBackups();
        } catch (e) {
            console.error(e);
            setError("Backup Creation Failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportJson = async () => {
        setIsLoading(true);
        try {
            const res = await exportUserDataAction();
            if (res.success && res.data?.data) {
                const jsonString = JSON.stringify(res.data.data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `progression-protocol-profile-${username}-${format(new Date(), "yyyy-MM-dd")}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error("Export Failed", e);
            setError("Export Failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("WARNING: Importing data will OVERWRITE your current profile progress. Are you sure?")) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setIsLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonContent = JSON.parse(event.target?.result as string);
                const result = await importUserDataAction(jsonContent);
                if (!result.success) throw new Error(result.error);
                window.location.reload();
            } catch (err) {
                console.error("Import Failed:", err);
                setError("Import Failed: Invalid JSON or Server Error.");
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    };

    const handleRestore = async (id: string) => {
        if (confirmingRestore !== id) {
            setConfirmingRestore(id);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const result = await restoreUserBackupAction(id);
            if (!result.success) throw new Error(result.error);
            window.location.reload(); // Hard reload to reflect deep state changes
        } catch (e) {
            console.error(e);
            setError("Restoration failed. Please check the error and try again.");
            setIsLoading(false);
        } finally {
            setConfirmingRestore(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-2 gap-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" />
                    Chrono-Stasis Module (Backups)
                </h3>
                <div className="flex flex-wrap gap-2">
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleImportJson}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1 bg-slate-900/30 border border-slate-700 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                        <Upload className="w-3 h-3" />
                        IMPORT
                    </button>
                    <button
                        onClick={handleExportJson}
                        disabled={isLoading}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-1 bg-slate-900/30 border border-slate-700 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                        <FileJson className="w-3 h-3" />
                        EXPORT
                    </button>
                    <button
                        onClick={handleCreateBackup}
                        disabled={isLoading}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-3 py-1 bg-cyan-950/30 border border-cyan-800/50 hover:bg-cyan-900/50 text-cyan-400 text-xs font-bold rounded transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                        {isLoading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        CREATE SNAPSHOT
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs font-mono rounded flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {backups.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-slate-600 font-mono text-xs">
                        NO SNAPSHOTS DETECTED.
                    </div>
                )}

                {backups.map((bk) => (
                    <div
                        key={bk.id}
                        className={cn(
                            "flex items-center justify-between p-3 rounded border transition-all",
                            confirmingRestore === bk.id
                                ? "bg-red-950/20 border-red-500/50"
                                : "bg-black/40 border-white/5 hover:border-cyan-900/30"
                        )}
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-xs font-bold px-1.5 py-0.5 rounded",
                                    bk.type === 'MANUAL' ? "bg-purple-900/30 text-purple-400" : "bg-green-900/30 text-green-400"
                                )}>
                                    {bk.type}
                                </span>
                                <span className="text-sm font-mono text-slate-300">
                                    {format(new Date(bk.created_at), "yyyy-MM-dd HH:mm:ss")}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-1">
                                DATA: {bk.quest_count || 0} Quests // {bk.item_count || 0} Items
                            </div>
                        </div>

                        <button
                            onClick={() => handleRestore(bk.id)}
                            disabled={isLoading}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded border transition-all",
                                confirmingRestore === bk.id
                                    ? "bg-red-600 text-white border-red-500 hover:bg-red-700 blink-animation"
                                    : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                            )}
                        >
                            {confirmingRestore === bk.id ? (
                                <>
                                    <AlertTriangle className="w-3 h-3" />
                                    CONFIRM RESTORE?
                                </>
                            ) : (
                                <>
                                    <RefreshCcw className="w-3 h-3" />
                                    RESTORE
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
