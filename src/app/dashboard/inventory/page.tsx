import { getAuthenticatedUser } from "@/lib/auth-utils";
import { MarketTabs } from "@/components/dashboard/MarketTabs";
import { getMarketData } from "@/lib/market-data";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const selectedMarketTab = typeof params.s_tab === 'string' ? params.s_tab : undefined;

    // Preserve old bookmarked links while keeping Store and Inventory distinct.
    if (selectedMarketTab === 'store' || selectedMarketTab === 'altar') {
        redirect(selectedMarketTab === 'altar' ? '/dashboard/store?s_tab=altar' : '/dashboard/store');
    }

    const user = await getAuthenticatedUser();
    const { inventoryData, storeData } = await getMarketData(user.id);

    return (
        <MarketTabs
            inventoryData={inventoryData}
            storeData={storeData}
        />
    );
}
