// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: db }));
import { AchievementManager } from "./achievement-manager";

beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue({ rows: [] });
    db.queryOne.mockImplementation(async (_sql: string, params: string[]) => params[0] === "ACH_AWAKENING"
        ? { id: "achievement", xp_reward: 100, gold_reward: 25, name: "Awakening" } : null);
});

describe("Achievement reward claims", () => {
    it("does not reward a stale achievement check when another request already inserted its claim", async () => {
        const response = await new AchievementManager().checkAchievements("player", "LEVEL_UP", { level: 10 });
        expect(response.totalXp).toBe(0);
        expect(response.unlocked).toHaveLength(0);
        expect(db.query.mock.calls.some(([sql]) => sql.includes("UPDATE profiles"))).toBe(false);
    });
    it("retains XP and gold rewards when the achievement claim is newly inserted", async () => {
        db.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("INSERT INTO user_achievements") ? [{ achievement_id: "achievement" }] : [] }));
        const response = await new AchievementManager().checkAchievements("player", "LEVEL_UP", { level: 10 });
        expect(response.totalXp).toBe(100);
        expect(response.unlocked).toHaveLength(1);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("gold_credits = gold_credits + $1"), [25, "player"]);
    });
    it("places earned item rewards in the implemented inventory table", async () => {
        db.queryOne.mockImplementation(async (sql: string) => sql.includes('FROM achievements')
            ? { id: 'achievement', xp_reward: 100, name: 'Awakening', item_reward_id: 'item' }
            : sql.includes('FROM items') ? { id: 'item', name: 'Reward' } : null);
        db.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('INSERT INTO user_achievements') ? [{ achievement_id: 'achievement' }] : [] }));
        const response = await new AchievementManager().checkAchievements('player', 'LEVEL_UP', { level: 10 });
        expect(response.unlocked[0].item).toEqual({ id: 'item', name: 'Reward' });
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory'), ['player', 'item']);
    });
});
