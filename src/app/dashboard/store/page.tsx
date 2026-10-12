import { getAuthenticatedUser } from "@/lib/auth-utils";
import { MarketTabs } from "@/components/dashboard/MarketTabs";
import { getMarketData } from "@/lib/market-data";

export const dynamic = 'force-dynamic';

export default async function StorePage() {
    const user = await getAuthenticatedUser();
    const { inventoryData, storeData } = await getMarketData(user.id);

    return (
        <MarketTabs
            inventoryData={inventoryData}
            storeData={storeData}
        />
    );
}
