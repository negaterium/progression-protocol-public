import { Shell } from "@/components/layout/Shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// This layout is a Server Component. It fetches data once for the Sidebar/Shell.
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Fetch shared data (Profile, Stats, etc) for the Shell
    let user;
    try { user = await getAuthenticatedUser(); }
    catch { redirect('/login'); }
    const data = await getDashboardData(user.id);

    return <Shell data={data}>{children}</Shell>;
}
