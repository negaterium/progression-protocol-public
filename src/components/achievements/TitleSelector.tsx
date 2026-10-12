"use client";

import { Crown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { equipTitleAction } from "@/app/actions/profile";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface Title {
    id: string;
    name: string;
    description: string;
    buff_description: string;
    modifiers: Record<string, number>;
    rarity: string;
}

interface UserTitle {
    title_id: string;
    is_equipped: boolean;
}

interface TitleSelectorProps {
    currentTitle: string;
    allTitles: Title[];
    userTitles: UserTitle[];
}

export function TitleSelector({ allTitles, userTitles }: TitleSelectorProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");

    const handleEquip = async (titleId: string) => {
        try {
            await equipTitleAction(titleId);
            router.refresh(); // Refresh server data
        } catch (e) {
            console.error("Failed to equip title", e);
        }
    };

    const formatModifiers = (modifiers: Record<string, number>) => {
        if (!modifiers) return "No effects";
        return Object.entries(modifiers).map(([key, val]) => {
            const percent = Math.round(val * 100);
            const keyMap: Record<string, string> = {
                'xp_gain_percent': 'XP Gain',
                'all_stats_percent': 'All Stats',
                'all_damage_percent': 'All Damage',
                'strength_percent': 'Strength',
                'agility_percent': 'Agility',
                'intelligence_percent': 'Intelligence',
                'vitality_percent': 'Vitality',
                'perception_percent': 'Perception',
                'willpower_percent': 'Willpower',
                'mana_percent': 'Mana Pool',
                'hp_percent': 'Health Pool',
                'damage_physical_percent': 'Phys Dmg',
                'damage_magic_percent': 'Magic Dmg',
                'damage_ranged_percent': 'Ranged Dmg',
                'defense_percent': 'Defense',
                'damage_reduction_percent': 'Dmg Reduc.',
                'crit_damage_percent': 'Crit Dmg',
                'crit_chance_flat': 'Crit Chance',
                'mana_cost_reduction': 'Mana Cost',
                'regen_rate_percent': 'Regen Rate',
                'attack_percent': 'Attack Power',
                'pen_physical_percent': 'Armor Pen',
                'damage_vs_dragon_percent': 'Vs Dragons',
                'armor_percent': 'Armor',
                'attack_speed_percent': 'Atk Speed',
                'summon_damage_percent': 'Summon Dmg'
            };

            const label = keyMap[key] || key.replace(/_/g, ' ');
            const valueStr = key.includes('reduction') ? `-${percent}%` : `+${percent}%`;

            // Handle flat values if any (though currently all are %)
            if (key.endsWith('flat')) {
                return `+${val} ${label.replace(' Flat', '')}`;
            }

            return `${valueStr} ${label}`;
        }).join(", ");
    };

    const availableTitles = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return allTitles
            .filter(t => userTitles.some(ut => ut.title_id === t.id))
            .filter(t => {
                if (!normalizedSearch) return true;
                return [t.name, t.description, formatModifiers(t.modifiers)]
                    .some(value => value.toLowerCase().includes(normalizedSearch));
            });
    }, [allTitles, userTitles, searchTerm]);

    const acquiredTitleCount = allTitles.filter(t => userTitles.some(ut => ut.title_id === t.id)).length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Crown className="w-4 h-4" /> Acquired Titles
                    <span className="text-[10px] text-slate-600 font-mono">{acquiredTitleCount}</span>
                </h3>
                {acquiredTitleCount > 4 && (
                    <label className="relative flex items-center">
                        <Search className="absolute left-2 w-3 h-3 text-slate-600 pointer-events-none" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search"
                            aria-label="Search acquired titles"
                            className="w-28 rounded border border-slate-800 bg-slate-950/60 py-1 pl-7 pr-2 text-[10px] font-mono text-slate-300 placeholder:text-slate-700 focus:border-cyan-700 focus:outline-none"
                        />
                    </label>
                )}
            </div>

            {availableTitles.length === 0 ? (
                <div className="text-xs text-slate-600 font-mono p-4 border border-dashed border-slate-800 rounded">
                    {acquiredTitleCount === 0 ? "NO TITLES ACQUIRED" : "NO TITLES MATCH THE SEARCH"}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {availableTitles.map(title => {
                        const isEquipped = userTitles.find(ut => ut.title_id === title.id)?.is_equipped;

                        // Rarity Colors
                        const rarityColor: Record<string, string> = {
                            'Common': 'border-slate-700 text-slate-400',
                            'Uncommon': 'border-cyan-700 text-cyan-400',
                            'Rare': 'border-blue-600 text-blue-400',
                            'Epic': 'border-purple-600 text-purple-400',
                            'Legendary': 'border-yellow-600 text-yellow-400',
                            'Mythic': 'border-red-600 text-red-500',
                        };
                        const colorClass = rarityColor[title.rarity] || 'border-slate-700 text-slate-400';

                        return (
                            <button
                                key={title.id}
                                onClick={() => handleEquip(title.id)}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded border text-left transition-all hover:bg-white/5",
                                    colorClass,
                                    isEquipped ? "bg-cyan-950/30 ring-1 ring-cyan-500" : "bg-black/20"
                                )}
                            >
                                <div>
                                    <div className="font-bold text-sm tracking-wide">{title.name}</div>
                                    <div className="text-[10px] opacity-70 font-mono text-cyan-200/80">
                                        {formatModifiers(title.modifiers)}
                                    </div>
                                    <div className="text-[10px] opacity-50 font-mono mt-0.5 italic">
                                        &quot;{title.description}&quot;
                                    </div>
                                </div>
                                {isEquipped && (
                                    <div className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/50">
                                        EQUIPPED
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
