import { getDashboardData } from "@/lib/dashboard-data";
import DashboardClient from "./DashboardClient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const dashboardData = await getDashboardData();

    return (
        <DashboardClient initialData={dashboardData} />
    );
}
