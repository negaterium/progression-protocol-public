"use client";

import { Database } from "@/types/database.types";
import { ZoneCard } from "./ZoneCard";

type Zone = Database['public']['Tables']['zones']['Row'];

interface ZoneGridProps {
    zones: Zone[];
    quests: Database['public']['Tables']['quests']['Row'][];
    selectedZoneId?: string;
    onSelectZone: (zone: Zone) => void;
}

export function ZoneGrid({ zones, quests, selectedZoneId, onSelectZone }: ZoneGridProps) {
    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-white font-sans tracking-widest flex items-center gap-2 mb-4">
                ZONE SELECT <span className="text-[10px] text-cyan-800 font-mono mt-1">{"//"} SAT-LINK CONNECTED</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {zones.map(zone => {
                    const questCount = quests.filter(q =>
                        q.zone_id === zone.id || (zone.name === 'HOME BASE' && !q.zone_id)
                    ).length;

                    return (
                        <ZoneCard
                            key={zone.id}
                            zone={zone}
                            isActive={zone.id === selectedZoneId}
                            onSelect={onSelectZone}
                            questCount={questCount}
                        />
                    );
                })}

                {zones.length === 0 && (
                    <div className="col-span-full py-8 text-center text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded">
                        NO ZONES DISCOVERED. SYSTEM STANDBY.
                    </div>
                )}
            </div>
        </div>
    );
}
