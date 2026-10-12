
import { DetailedLogViewer } from "@/components/habits/DetailedLogViewer";
import { MonthView } from "@/components/dashboard/ProductivityHub";
import { HabitStats } from "@/components/habits/HabitStats";

interface HabitsViewProps {
    logs: any[];
}

export function HabitsView({ logs }: HabitsViewProps) {
    return (
        <div className="container mx-auto p-2 lg:p-6 space-y-6 min-h-screen animate-in fade-in duration-300">
            <header className="mb-6">
                <h1 className="text-3xl lg:text-4xl font-bold font-sans tracking-tight text-white mb-2">
                    HABIT LOGS
                </h1>
                <p className="text-cyan-600 font-mono text-sm">
                    SYSTEM TRACKING // CONSISTENCY ANALYSIS
                </p>
            </header>

            {/* Stats Overview */}
            <HabitStats logs={logs} />

            <div className="p-4 lg:p-6 bg-black/40 border border-cyan-900/30 rounded-lg">
                <MonthView logs={logs} />
            </div>

            <div className="space-y-4">
                <DetailedLogViewer logs={logs} />
            </div>
        </div>
    );
}
