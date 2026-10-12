
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag, Coins, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { InventoryMain } from "@/app/dashboard/inventory/InventoryMain";
import { StoreInterface } from "@/components/store/StoreInterface";
import { CosmicAltar } from "@/components/store/CosmicAltar";

interface MarketTabsProps {
    inventoryData: {
        bagItems: any[];
        equipped: any;
        profile: any;
        stats: any; // Effective Stats
        derivedStats: any; // MaxHP, etc
    };
    storeData: {
        items: any[];
        userGold: number;
        userLevel: number;
        storeDiscount: number;
    };
}

const TABS = [
    { id: "inventory", label: "INVENTORY", icon: ShoppingBag },
    { id: "store", label: "STORE", icon: Coins },
    { id: "altar", label: "COSMIC ALTAR", icon: Sparkles },
];

export function MarketTabs({ inventoryData, storeData }: MarketTabsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("s_tab") || (pathname === "/dashboard/store" ? "store" : "inventory");

    const handleTabChange = (tabId: string) => {
        if (tabId === "inventory") {
            router.replace("/dashboard/inventory");
            return;
        }

        if (tabId === "store") {
            router.replace("/dashboard/store");
            return;
        }

        router.replace("/dashboard/store?s_tab=altar");
    };

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-[112px] lg:top-0 z-40 bg-black/95 backdrop-blur-md border-b border-cyan-900/30 h-14">
                <div className="flex items-center overflow-x-auto no-scrollbar px-4 py-2 gap-2 lg:gap-4 lg:justify-start">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() => handleTabChange(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 whitespace-nowrap",
                                    isActive
                                        ? "bg-cyan-950/50 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.2)]"
                                        : "bg-transparent border-transparent text-slate-500 hover:text-cyan-200 hover:bg-cyan-950/20"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="font-mono font-bold tracking-wider text-sm">
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                <main className="h-full overflow-y-auto custom-scrollbar p-0 lg:p-0">
                    {activeTab === "inventory" && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            <InventoryMain
                                {...inventoryData}
                            />
                        </div>
                    )}

                    {activeTab === "store" && (
                        <div className="animate-in fade-in zoom-in-95 duration-300 p-4 lg:p-6 pb-24">
                            {/* Keep Store styling consistent */}
                            <header className="mb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-white tracking-widest font-sans uppercase flex items-center gap-3">
                                            <Coins className="w-8 h-8 text-cyan-500" />
                                            System Store
                                        </h1>
                                        <p className="text-cyan-600 font-mono text-sm mt-1">
                                            MONARCH&apos;S VAULT: EQUIPMENT & SUPPORT ITEMS
                                        </p>
                                    </div>
                                    <div 
                                        className="p-3 border border-yellow-900/30 bg-yellow-950/20 rounded-lg cursor-help"
                                        title={`${Number(storeData.userGold || 0).toLocaleString()} Gold`}
                                    >
                                        <span className="text-yellow-500 font-mono font-bold text-lg flex items-center gap-2">
                                            <Coins className="w-5 h-5" /> {Number(storeData.userGold || 0).toLocaleString()} G
                                        </span>
                                    </div>
                                </div>
                            </header>
                            <StoreInterface
                                items={storeData.items}
                                userGold={storeData.userGold}
                                userLevel={storeData.userLevel}
                                storeDiscount={storeData.storeDiscount}
                                equippedItems={inventoryData.equipped}
                            />
                        </div>
                    )}

                    {activeTab === "altar" && (
                        <div className="animate-in fade-in zoom-in-95 duration-300 p-4 lg:p-6 pb-24">
                            <CosmicAltar
                                userEssence={inventoryData.profile?.cosmic_essence || 0}
                                userStats={inventoryData.stats}
                                userLevel={inventoryData.profile?.level || 1}
                            />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
