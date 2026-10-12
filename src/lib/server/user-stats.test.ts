import { describe, expect, it } from "vitest";
import { calculatePlayerStatsSnapshot, type PlayerStatsSnapshot } from "./user-stats";
import type { PlayerStatsContext } from "./stats-loader";

function makeContext(): PlayerStatsContext {
    return {
        profile: {
            hunter_class: "NONE",
            level: 1,
            prestige_level: 0,
            current_hp: 999,
            current_mana: 999,
            last_regen_at: "2999-01-01T00:00:00.000Z",
            status_effects: [],
        },
        stats: {
            strength: 10,
            agility: 10,
            intelligence: 10,
            vitality: 10,
            perception: 10,
            charisma: 10,
            focus: 10,
            willpower: 10,
            luck: 10,
            crystallized_stats: {},
        },
        inventory: [],
        modifiers: {},
        skillModifiers: {},
        statusEffects: [],
        summonedElites: [],
    };
}

describe("read-only player stat snapshots", () => {
    it("clamps projected values in memory without mutating the loaded profile", () => {
        const context = makeContext();
        const originalProfile = { ...context.profile };

        const snapshot: PlayerStatsSnapshot = calculatePlayerStatsSnapshot(context);

        expect(snapshot.maxHp).toBe(260);
        expect(snapshot.maxMana).toBe(160);
        expect(snapshot.currentHp).toBe(260);
        expect(snapshot.currentMana).toBe(160);
        expect(context.profile).toEqual(originalProfile);
    });
});
