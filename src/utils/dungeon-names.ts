/**
 * Maps technical dungeon identifiers to lore-friendly display names
 */
export function getDungeonDisplayName(dungeonId: string): string {
    const dungeonNames: Record<string, string> = {
        // E-Rank
        'hapjeong_subway': 'Hapjeong Subway Station',

        // D-Rank
        'random_d_rank': 'Forgotten Catacombs',

        // C-Rank
        'demon_castle': 'Demon Castle',

        // B-Rank
        'red_gate': 'Red Gate',

        // A-Rank
        'shadow_realm': 'Shadow Monarch\'s Realm',

        // S-Rank
        'jeju_island': 'Jeju Island',
        'chaos_realm': 'Chaos Dimension',
    };

    return dungeonNames[dungeonId] || dungeonId
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
