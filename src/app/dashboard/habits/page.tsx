
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { DetailedLogViewer } from "@/components/habits/DetailedLogViewer";
import { MonthView } from "@/components/dashboard/ProductivityHub";
import { HabitStats } from "@/components/habits/HabitStats";

export default async function HabitsPage() {
    const user = await getAuthenticatedUser();

    // Fetch Logs (Last 500)
    // We join quests to get title/type if missing, or rely on snapshot columns in quest_logs
    const { rows: logs } = await db.query(
        "SELECT * FROM quest_logs WHERE user_id = $1 ORDER BY completed_at DESC, id DESC LIMIT 500",
        [user.id]
    );

    return (
        <div className="container mx-auto p-6 space-y-6 min-h-screen">
            <header className="mb-6">
                <h1 className="text-4xl font-bold font-sans tracking-tight text-white mb-2">
                    HABIT LOGS
                </h1>
                <p className="text-cyan-600 font-mono text-sm">
                    SYSTEM TRACKING // CONSISTENCY ANALYSIS
                </p>
            </header>

            {/* Stats Overview */}
            <HabitStats logs={logs} />

            <div className="p-6 bg-black/40 border border-cyan-900/30 rounded-lg">
                <MonthView logs={logs} />
            </div>

            <div className="space-y-4">
                <DetailedLogViewer logs={logs} />
            </div>
        </div>
    );
}
