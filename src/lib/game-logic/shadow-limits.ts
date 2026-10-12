// Helper for limit calculation
// [REMOVED] - Now handled dynamically in user-stats.ts and stored in profiles table
export function calculateStorageLimit(level: number) {
    // Legacy fallback incase DB is not yet updated
    return 200 + (level * 10);
}

// Helper for ELITE Limit
// Scaled to reach a maximum of 10 active elites at Level 999 with max INT investment.
//
// Level Scaling (square-root curve, capped at +7):
//   Starts rewarding slots quickly at low levels, then slows down at high levels.
//   Milestones: L40=1, L55=2, L100=3, L175=4, L280=5, L415=6, L580=7, L775+=8 (level cap)
//
// INT Scaling (capped at +2):
//   Meaningful bonus for INT-focused builds (Necromancer's primary stat).
//   INT 150 = +1 | INT 300+ = +2 (max from INT)
//
// Total Maximum: 1 + 7 (level) + 2 (INT) = 10 active elites at L999, INT 300+
export function calculateEliteLimit(level: number, intelligence: number) {
    const levelBonus = Math.min(7, Math.floor(Math.sqrt(Math.max(0, level - 40) / 15)));
    const intBonus = Math.min(2, Math.floor(intelligence / 150));
    return 1 + levelBonus + intBonus;
}

