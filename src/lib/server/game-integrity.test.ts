// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    db: { query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() },
    auth: vi.fn(), combat: vi.fn(), achievements: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mocks.db }));
vi.mock("@/lib/auth-utils", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/achievement-manager", () => ({
    AchievementManager: class {
        checkAchievements(...args: unknown[]) { return mocks.achievements(...args); }
    }
}));
vi.mock("@/lib/server/user-stats", () => ({
    recalculateAndClampPlayerStats: vi.fn(async () => ({ maxHp: 260, maxMana: 1000 })),
}));
vi.mock("@/lib/game-logic/boss-combat", () => ({ calculateBossCombatRound: mocks.combat }));

import { completeQuestAction } from "@/app/actions/quests/complete";
import { acceptQuestAction, checkAndResetRecurringQuests, failQuestAction } from "@/app/actions/quests/lifecycle";
import { grantBossRewards, startBossBattleAction, unlockAllBossesAction, lockAllBossesAction, clearActiveEncountersAction } from "@/app/actions/bosses";
import { consumeItemAction } from "@/app/actions/inventory";
import { delegateQuestAction } from "@/app/actions/shadows";
import { addXpAction, injectGoldAction, injectBulkCompletionsAction, jumpToLevel999Action, syncOfflineProgressAction, resetSystemAction, checkDailyPenalty } from "@/app/actions/system";
import { purchaseItemAction } from '@/app/actions/store';
import { awardXp } from "./xp-rewards";
import { getXpRequiredForLevel } from "@/lib/system/leveling";

// A deterministic transactional database double exercises the actual action/reward
// chain and scoped client, without accessing the user's database or environment.
// PostgreSQL behavior itself still needs a disposable-database smoke test.
interface State {
    profiles: Record<string, any>; stats: Record<string, any>; quests: Record<string, any>;
    userQuests: Record<string, any>; encounters: any[]; inventory: any[]; items: any[];
    logs: any[]; habits: any[]; assignments: any[]; bosses: any[]; skills: any[];
}
let state: State;
let mutex: Promise<void>;
let failQuery: (sql: string) => boolean;
let calls: Array<{ sql: string; params: any[] }>;
let commits: number;
let rollbacks: number;
const user = { id: "00000000-0000-4000-8000-000000000001", username: "hunter" };
const key = (questId: string) => `${user.id}:${questId}`;
const result = (rows: any[] = []) => ({ rows: structuredClone(rows), rowCount: rows.length });

function updateRow(row: any, sql: string, params: any[]) {
    const set = sql.split(/SET /i)[1].split(/ WHERE /i)[0];
    // These tests cover the parameterized profile/XP updates, including increments.
    const fields = [...set.matchAll(/(\w+)\s*=\s*(COALESCE\(\w+,\s*0\)\s*\+\s*\$\d+|\w+\s*\+\s*\$\d+|\$\d+|\d+|'[^']*')/g)];
    for (const [, column, expression] of fields) {
        const placeholder = expression.match(/\$(\d+)/);
        const value = placeholder ? params[Number(placeholder[1]) - 1] : Number(expression);
        row[column] = expression.includes("+") ? Number(row[column] || 0) + Number(value) : value;
    }
}

async function execute(local: State, sql: string, params: any[] = []) {
    calls.push({ sql, params });
    if (failQuery(sql)) throw new Error("Injected database failure");
    const compact = sql.replace(/\s+/g, " ").trim();
    if (compact.startsWith("SELECT")) {
        if (compact.includes("FROM quests WHERE")) {
            if (compact.includes("WHERE user_id = $1")) return result(Object.values(local.quests).filter(q => q.user_id === params[0]));
            const quest = local.quests[params[0]];
            return result(quest && (!compact.includes("user_id = $2") || quest.user_id == null || quest.user_id === params[1]) ? [quest] : []);
        }
        if (compact.startsWith("SELECT status FROM user_quests")) return result(local.userQuests[`${params[0]}:${params[1]}`] ? [local.userQuests[`${params[0]}:${params[1]}`]] : []);
        if (compact.startsWith("SELECT q.id, uq.completed_at")) return result(Object.entries(local.userQuests)
            .filter(([id, q]) => id.startsWith(`${params[0]}:`) && q.status === "Complete" && local.quests[q.quest_id].frequency !== "Once")
            .map(([, q]) => ({ ...local.quests[q.quest_id], completed_at: q.completed_at })));
        if (compact.includes("FROM profiles p") && compact.includes("JOIN hunter_stats")) return result([{ ...local.profiles[params[0]], ...local.stats[params[0]] }]);
        if (compact.includes("FROM user_skills us") && compact.includes("JOIN skills s")) return result(local.skills || []);
        if (compact.includes("FROM profiles")) return result(local.profiles[params[0]] ? [local.profiles[params[0]]] : []);
        if (compact.includes("FROM hunter_stats")) return result(local.stats[params[0]] ? [local.stats[params[0]]] : []);
        if (compact.startsWith("SELECT id, name FROM bosses WHERE phase = $1")) {
            const [phase, requiredLevel, name, id] = params;
            const previous = local.bosses
                .filter(b => Number(b.phase) === Number(phase))
                .filter(b => {
                    const candidateLevel = Number(b.required_level || 0);
                    return candidateLevel < Number(requiredLevel)
                        || (candidateLevel === Number(requiredLevel) && b.name < name)
                        || (candidateLevel === Number(requiredLevel) && b.name === name && b.id < id);
                })
                .sort((a, b) => Number(b.required_level || 0) - Number(a.required_level || 0)
                    || String(b.name).localeCompare(String(a.name))
                    || String(b.id).localeCompare(String(a.id)));
            return result(previous.slice(0, 1).map(b => ({ id: b.id, name: b.name })));
        }
        if (compact.includes("FROM bosses WHERE")) return result(local.bosses.filter(b => compact.includes("ILIKE") ? b.name.toLowerCase().includes(String(params[0]).replaceAll("%", "").toLowerCase()) : b.id === params[0]));
        if (compact.includes("FROM active_encounters")) {
            const rows = local.encounters.filter(e => e.user_id === params[0] &&
                (!compact.includes("boss_id = $2") || e.boss_id === params[1]) &&
                (!compact.includes("'ACTIVE'") || e.status === "ACTIVE") &&
                (!compact.includes("'DEFEATED'") || e.status === "DEFEATED") &&
                (!compact.includes("current_hp <= 0") || e.current_hp <= 0));
            if (compact.includes("COUNT(*)")) return result([{ count: String(rows.length) }]);
            return result(rows.map(e => ({ ...e, boss_name: "Wolf", boss_rank: "E", intel: {} })));
        }
        if (compact.includes("FROM inventory i") && compact.includes("WHERE i.id =")) return result(local.inventory.filter(i => i.id === params[0] && i.user_id === params[1]).map(i => {
            const item = local.items.find(it => it.id === i.item_id);
            return { ...i, item_name: item.name, item_type: item.type, item_rarity: item.rarity, item_effect: item.effect };
        }));
        if (compact.includes("FROM inventory") && compact.includes("item_id = $2")) return result(local.inventory.filter(i => i.user_id === params[0] && i.item_id === params[1]));
        if (compact.includes("FROM items")) return result(local.items.filter(i => compact.includes('WHERE id =') ? i.id === params[0] : i.name === params[0]));
        if (compact.includes("FROM quest_logs")) {
            const logs = local.logs.filter(l => l.user_id === params[0] && (!compact.includes("'DAILY_BOUNTY'") || l.type === "DAILY_BOUNTY"));
            return compact.includes("COUNT(*)") ? result([{ count: String(logs.length) }]) : result(logs);
        }
        if (compact.includes("COUNT(*)") && compact.includes("FROM user_quests")) {
            const rows = Object.values(local.userQuests).filter(q => q.user_id === params[0] && q.status === "Complete" &&
                (!compact.includes("q.frequency = 'Daily'") || local.quests[q.quest_id].frequency === "Daily"));
            return result([{ count: String(rows.length) }]);
        }
        if (compact.includes("SUM(shadow_count)")) return result([{ total_assigned: String(local.assignments.reduce((n, a) => n + a.shadow_count, 0)) }]);
        if (compact.includes("FROM user_backups")) return result([{ id: "existing-backup" }]);
        if (compact.includes("COUNT(*)")) return result([{ count: "0" }]);
        return result();
    }
    if (compact.startsWith("INSERT INTO quests")) {
        const id = `seed-${Object.keys(local.quests).length + 1}`;
        local.quests[id] = { id, user_id: params[0], title: params[1], description: params[2], type: params[3], difficulty: params[4], xp_reward: params[5], gold_reward: params[6], frequency: params[7], mana_cost: params[8] };
        return result([{ id }]);
    } else if (compact.startsWith("DELETE FROM quests")) {
        for (const [id, quest] of Object.entries(local.quests)) {
            if (quest.user_id === params[0] && (!compact.includes("title =") || quest.title === "Class Change: The Trial")) {
                delete local.quests[id]; delete local.userQuests[`${params[0]}:${id}`];
            }
        }
    } else if (compact.startsWith("INSERT INTO user_quests")) {
        local.userQuests[`${params[0]}:${params[1]}`] = {
            user_id: params[0], quest_id: params[1],
            status: compact.includes("'Complete'") ? "Complete" : compact.includes("'Failed'") ? "Failed" : compact.includes("'Available'") ? "Available" : "Active", completed_at: new Date()
        };
    } else if (compact.startsWith("DELETE FROM user_quests")) {
        for (const [id, quest] of Object.entries(local.userQuests)) {
            if (quest.user_id === params[0] && (!params[1] || params[1].includes(quest.quest_id))) delete local.userQuests[id];
        }
    } else if (compact.startsWith("DELETE FROM active_encounters")) {
        local.encounters = local.encounters.filter(e => e.user_id !== params[0]);
    } else if (compact.startsWith("DELETE FROM quest_logs")) {
        local.logs = local.logs.filter(l => l.user_id !== params[0]);
    } else if (compact.startsWith("DELETE FROM habit_logs")) {
        local.habits = local.habits.filter(l => l.user_id !== params[0]);
    } else if (compact.startsWith("UPDATE profiles")) {
        const userIndex = Number(compact.match(/WHERE id = \$(\d+)/)![1]) - 1;
        updateRow(local.profiles[params[userIndex]], compact, params);
        return compact.includes("RETURNING") ? result([local.profiles[params[userIndex]]]) : result();
    } else if (compact.startsWith("UPDATE hunter_stats")) {
        const userIndex = Number(compact.match(/WHERE user_id = \$(\d+)/)![1]) - 1;
        updateRow(local.stats[params[userIndex]], compact, params);
    } else if (compact.startsWith("INSERT INTO active_encounters")) {
        const encounter = { id: `encounter-${local.encounters.length + 1}`, user_id: params[0], boss_id: params[1], current_hp: params[2], max_hp: params[3], status: "ACTIVE", created_at: new Date() };
        local.encounters.push(encounter); return result([encounter]);
    } else if (compact.startsWith("UPDATE active_encounters")) {
        const idIndex = Number(compact.match(/WHERE id = \$(\d+)/)![1]) - 1;
        const encounter = local.encounters.find(e => e.id === params[idIndex]);
        if (compact.includes("current_hp = $1")) encounter.current_hp = params[0];
        if (compact.includes("status = 'DEFEATED'")) encounter.status = "DEFEATED";
    } else if (compact.startsWith("INSERT INTO quest_logs")) {
        local.logs.push({ id: local.logs.length + 1, user_id: params[0], type: compact.includes("'DAILY_BOUNTY'") ? "DAILY_BOUNTY" : compact.includes("'BOSS'") ? "BOSS" : "QUEST" });
    } else if (compact.startsWith("INSERT INTO habit_logs")) {
        local.habits.push({ user_id: params[0], title: params[1] });
    } else if (compact.startsWith("INSERT INTO shadow_assignments")) {
        local.assignments.push({ user_id: params[0], quest_id: params[1], shadow_count: params[2], expires_at: params[3] });
    } else if (compact.startsWith("INSERT INTO inventory")) {
        local.inventory.push({ id: local.inventory.length + 1, user_id: params[0], item_id: params[1], quantity: params[2], purchased_price: params[3] });
    } else if (compact.startsWith("DELETE FROM inventory")) {
        local.inventory = local.inventory.filter(i => compact.includes("user_id =") ? i.user_id !== params[0] : i.id !== params[0]);
    } else if (compact.startsWith("UPDATE inventory")) {
        const item = local.inventory.find(i => i.id === params[0]); item.quantity -= 1;
    }
    return result();
}

beforeEach(() => {
    vi.stubEnv('SLS_DEVELOPER_USER_IDS', '');
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => { });
    vi.spyOn(console, "warn").mockImplementation(() => { });
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    mocks.auth.mockResolvedValue(user);
    mocks.achievements.mockResolvedValue({ unlocked: [], totalXp: 0 });
    mocks.combat.mockResolvedValue({ currentHp: 0, maxHp: 100, damageDealt: 100 });
    state = {
        profiles: { [user.id]: { ...user, level: 1, current_xp: 0, current_mana: 1000, current_hp: 260, gold_credits: 0, available_ap: 0, available_sp: 0, status_effects: [], shadow_infantry_count: 100, shadow_storage_limit: 1000 }, "player-2": { level: 1, gold_credits: 0, current_xp: 0 } },
        stats: { [user.id]: { strength: 10, intelligence: 10, agility: 10, vitality: 10, perception: 10, mana: 1000 } },
        quests: { q1: { id: "q1", user_id: user.id, title: "Study", type: "CUSTOM", frequency: "Daily", difficulty: "E", xp_reward: 100, gold_reward: 100, mana_cost: 50, skill_rewards: {} } },
        userQuests: {}, encounters: [], inventory: [], items: [], logs: [], habits: [], assignments: [],
        bosses: [{ id: "boss-1", name: "Wolf", rank: "E", phase: 1, status: "AVAILABLE", required_level: 1, max_hp: 100 }], skills: [],
    };
    mutex = Promise.resolve(); calls = []; commits = 0; rollbacks = 0; failQuery = () => false;
    mocks.db.query.mockImplementation((sql, params) => execute(state, sql, params));
    mocks.db.queryOne.mockImplementation(async (sql, params) => (await execute(state, sql, params)).rows[0] || null);
    mocks.db.transaction.mockImplementation(async (work: any) => {
        let local = structuredClone(state);
        let release: (() => void) | undefined;
        const savepoints = new Map<string, State>();
        const client = {
            query: async (sql: string, params?: any[]) => {
                if (sql.startsWith("SAVEPOINT ")) { savepoints.set(sql.split(" ")[1], structuredClone(local)); return result(); }
                if (sql.startsWith("ROLLBACK TO SAVEPOINT ")) { local = structuredClone(savepoints.get(sql.split(" ")[3])!); return result(); }
                if (sql.startsWith("RELEASE SAVEPOINT ")) { savepoints.delete(sql.split(" ")[2]); return result(); }
                if (sql.includes("FROM profiles") && sql.includes("FOR UPDATE")) {
                    const previous = mutex;
                    mutex = new Promise<void>(resolve => { release = resolve; });
                    await previous; local = structuredClone(state);
                }
                return execute(local, sql, params);
            }
        };
        try { const output = await work(client); state = local; commits++; return output; }
        catch (error) { rollbacks++; throw error; }
        finally { release?.(); }
    });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("Quest integrity and compatibility", () => {
    it('persists XP for newly earned quest achievements exactly once', async () => {
        let claimed = false;
        mocks.achievements.mockImplementation(async (_id, event) => {
            if (event === 'QUEST_COMPLETE' && !claimed) {
                claimed = true;
                return { unlocked: [{ code: 'ACH_FIRST_BLOOD', xp: 50 }], totalXp: 50 };
            }
            return { unlocked: [], totalXp: 0 };
        });
        const response = await completeQuestAction({ questId: 'q1', xpReward: 100 });
        expect(response.success).toBe(true);
        expect(state.profiles[user.id].current_xp).toBe(152);
        expect(response.data?.earnedXp).toBe(50);
        expect(commits).toBe(1);
        expect((await completeQuestAction({ questId: 'q1', xpReward: 100 })).success).toBe(false);
        expect(state.profiles[user.id].current_xp).toBe(152);
    });
    it("completes an Available quest with server rewards, mana, logs and the existing response", async () => {
        const response = await completeQuestAction({ questId: "q1", xpReward: 999999 });
        expect(response.success).toBe(true);
        expect(response.data?.success).toBe(true);
        expect(state.profiles[user.id].current_xp).toBe(102);
        expect(state.profiles[user.id].gold_credits).toBe(102);
        expect(state.profiles[user.id].current_mana).toBeLessThan(1000);
        expect(state.userQuests[key("q1")].status).toBe("Complete");
        expect(state.logs).toHaveLength(1);
        expect(state.habits).toHaveLength(1);
        expect(commits).toBe(1);
        expect(mocks.db.transaction).toHaveBeenCalledTimes(1);
        expect(calls.some(c => c.sql.includes("FOR UPDATE"))).toBe(true);
        expect(mocks.db.queryOne).not.toHaveBeenCalled();
    });
    it("Purification cleanses ordinary statuses at quest start but preserves cosmic boundaries", async () => {
        state.skills = [{
            name: "Purification", current_level: 10, max_level: 10,
            category: "Passive", stat_bonus: { Intelligence: 1 },
        }];
        state.profiles[user.id].status_effects = [
            { name: "Venom", type: "POISON", duration: 2, damagePercent: 0.25, description: "poison" },
            { name: "Reality Fracture", type: "REALITY_FRACTURE", duration: 2, description: "cannot be resisted" },
        ];
        vi.spyOn(Math, "random").mockReturnValue(0.01);

        const response = await completeQuestAction({ questId: "q1", xpReward: 100 });
        expect(response.success).toBe(true);
        const stored = typeof state.profiles[user.id].status_effects === "string"
            ? JSON.parse(state.profiles[user.id].status_effects)
            : state.profiles[user.id].status_effects;
        expect(stored.map((effect: any) => effect.type)).toEqual(["REALITY_FRACTURE"]);
        expect(response.data?.purifiedStatuses).toEqual(["Venom"]);
        expect(state.profiles[user.id].current_hp).toBe(260);
    });
    it("rejects another player's quest and client-controlled mana bypass", async () => {
        state.quests.q1.user_id = "player-2";
        expect((await completeQuestAction({ questId: "q1", xpReward: 100 })).success).toBe(false);
        expect((await completeQuestAction({ questId: "q1", xpReward: 100, skipManaCost: true } as any)).success).toBe(false);
        expect(state.profiles[user.id].current_xp).toBe(0);
    });
    it("preserves globally available quest templates", async () => {
        state.quests.q1.user_id = null;
        expect((await completeQuestAction({ questId: "q1", xpReward: 100 })).success).toBe(true);
    });
    it("grants rewards only once for concurrent completion and rejects reaccept/replay", async () => {
        const responses = await Promise.all([1, 2].map(() => completeQuestAction({ questId: "q1", xpReward: 100 })));
        expect(responses.filter(r => r.success)).toHaveLength(1);
        expect(state.profiles[user.id].current_xp).toBe(102);
        expect(state.logs).toHaveLength(1);
        expect((await acceptQuestAction("q1")).success).toBe(false);
        expect((await completeQuestAction({ questId: "q1", xpReward: 100 })).success).toBe(false);
    });
    it("does not lose rewards when different quests complete concurrently", async () => {
        state.quests.q2 = { ...state.quests.q1, id: "q2" };
        const responses = await Promise.all(["q1", "q2"].map(questId => completeQuestAction({ questId, xpReward: 100 })));
        expect(responses.every(r => r.success)).toBe(true);
        expect(state.profiles[user.id].current_xp).toBe(204);
        expect(state.profiles[user.id].gold_credits).toBe(204);
    });
    it("rolls back mana, gold, completion and logs when the required XP write fails", async () => {
        failQuery = sql => sql.includes("UPDATE profiles SET current_xp");
        expect((await completeQuestAction({ questId: "q1", xpReward: 100 })).success).toBe(false);
        expect(state.profiles[user.id].current_mana).toBe(1000);
        expect(state.profiles[user.id].gold_credits).toBe(0);
        expect(state.userQuests[key("q1")]).toBeUndefined();
        expect(state.logs).toHaveLength(0);
        expect(rollbacks).toBe(1);
    });
    it("keeps optional audit failures from breaking completion", async () => {
        failQuery = sql => sql.includes("INSERT INTO audit_logs");
        expect((await completeQuestAction({ questId: "q1", xpReward: 100 })).success).toBe(true);
        expect(state.profiles[user.id].current_xp).toBe(102);
    });
    it("reopens a daily quest after its reset while leaving current and Once completions closed", async () => {
        state.userQuests[key("q1")] = { user_id: user.id, quest_id: "q1", status: "Complete", completed_at: new Date(Date.now() - 86400000) };
        state.quests.once = { ...state.quests.q1, id: "once", frequency: "Once" };
        state.userQuests[key("once")] = { ...state.userQuests[key("q1")], quest_id: "once" };
        expect((await checkAndResetRecurringQuests(0)).success).toBe(true);
        expect(state.userQuests[key("q1")]).toBeUndefined();
        expect(state.userQuests[key("once")].status).toBe("Complete");
        expect((await completeQuestAction({ questId: "q1", xpReward: 100 })).success).toBe(true);
        await checkAndResetRecurringQuests(0);
        expect(state.userQuests[key("q1")].status).toBe("Complete");
    });
    it("retains the quest-failure penalty and prevents repeated penalties", async () => {
        state.profiles[user.id].current_xp = 100;
        expect((await failQuestAction("q1")).success).toBe(true);
        expect(state.profiles[user.id].current_xp).toBe(50);
        expect((await failQuestAction("q1")).success).toBe(false);
        expect(state.profiles[user.id].current_xp).toBe(50);
    });
    it("allows mana-free delegation for a qualified Necromancer, reserving infantry once", async () => {
        state.profiles[user.id].hunter_class = "Necromancer";
        state.profiles[user.id].level = 40;
        state.profiles[user.id].current_xp = getXpRequiredForLevel(40);
        state.profiles[user.id].current_mana = 0;
        expect((await delegateQuestAction({ questId: "q1" })).success).toBe(true);
        expect(state.assignments).toHaveLength(1);
        expect(state.assignments[0].shadow_count).toBe(10);
        expect(state.profiles[user.id].current_mana).toBe(0);
        expect((await delegateQuestAction({ questId: "q1" })).success).toBe(false);
        expect(state.assignments).toHaveLength(1);
    });
    it("awards the daily all-clear bounty once across concurrent ninth/tenth completions", async () => {
        for (let i = 0;i < 8;i++) {
            const id = `done-${i}`; state.quests[id] = { ...state.quests.q1, id };
            state.userQuests[key(id)] = { user_id: user.id, quest_id: id, status: "Complete", completed_at: new Date() };
        }
        state.quests.q2 = { ...state.quests.q1, id: "q2" };
        const responses = await Promise.all(["q1", "q2"].map(questId => completeQuestAction({ questId, xpReward: 100 })));
        expect(responses.every(r => r.success)).toBe(true);
        expect(state.logs.filter(l => l.type === "DAILY_BOUNTY")).toHaveLength(1);
        expect(responses.filter(r => r.data?.dailyBounty)).toHaveLength(1);
    });
});

describe("Boss, inventory and developer boundaries", () => {
    it("requires a key and rejects the public bypass", async () => {
        expect((await startBossBattleAction({ bossId: "boss-1" })).success).toBe(false);
        expect((await startBossBattleAction({ bossId: "boss-1", skipKeyCheck: true } as any)).success).toBe(false);
        expect(state.encounters).toHaveLength(0);
    });
    it("starts a boss from an inventory key and consumes exactly one key", async () => {
        state.profiles[user.id].level = 10;
        state.items = [{ id: "key-1", name: "Instant Dungeon Key (E-Rank)", rarity: "E", type: "KEY", effect: {} }];
        state.inventory = [{ id: 1, user_id: user.id, item_id: "key-1", quantity: 2 }];
        expect((await consumeItemAction(1)).success).toBe(true);
        expect(state.inventory[0].quantity).toBe(1);
        expect(state.encounters).toHaveLength(1);
        expect((await consumeItemAction(1)).success).toBe(false);
        expect(state.inventory[0].quantity).toBe(1);
    });
    it("rolls back key consumption when encounter creation fails", async () => {
        state.items = [{ id: "key-1", name: "Instant Dungeon Key (E-Rank)", type: "KEY" }];
        state.inventory = [{ id: 1, user_id: user.id, item_id: "key-1", quantity: 1 }];
        failQuery = sql => sql.includes("INSERT INTO active_encounters");
        expect((await startBossBattleAction({ bossId: "boss-1" })).success).toBe(false);
        expect(state.inventory).toHaveLength(1);
        expect(state.inventory[0].quantity).toBe(1);
    });
    it("preserves Igris and post-cap key exceptions", async () => {
        state.bosses[0].name = "Blood-Red Commander Igris";
        expect((await startBossBattleAction({ bossId: "boss-1" })).success).toBe(true);
        state.encounters = []; state.bosses[0].name = "Wolf"; state.profiles[user.id].level = 999;
        expect((await startBossBattleAction({ bossId: "boss-1" })).success).toBe(true);
    });
    it("enforces the per-phase boss sequence on the server", async () => {
        state.profiles[user.id].level = 25;
        state.bosses = [
            { id: "boss-1", name: "Wolf", rank: "E", phase: 1, required_level: 1, max_hp: 100 },
            { id: "boss-2", name: "Bear", rank: "E", phase: 1, required_level: 2, max_hp: 100 },
        ];
        state.items = [{ id: "key-1", name: "Instant Dungeon Key (E-Rank)", rarity: "E", type: "KEY", effect: {} }];
        state.inventory = [{ id: 1, user_id: user.id, item_id: "key-1", quantity: 1 }];

        const locked = await startBossBattleAction({ bossId: "boss-2" });
        expect(locked.success).toBe(false);
        expect(locked.error).toContain("Defeat Wolf");
        expect(state.encounters).toHaveLength(0);
        expect(state.inventory[0].quantity).toBe(1);

        state.encounters = [{ id: "encounter-1", user_id: user.id, boss_id: "boss-1", status: "DEFEATED", current_hp: 0, created_at: new Date() }];
        const opened = await startBossBattleAction({ bossId: "boss-2" });
        expect(opened.success).toBe(true);
        expect(state.encounters.filter(e => e.status === "ACTIVE")).toHaveLength(1);
        expect(state.inventory).toHaveLength(0);
    });
    it("keeps the Phase 5 post-cap progression exception", async () => {
        state.profiles[user.id].level = 999;
        state.bosses = [
            { id: "outer-1", name: "Outer God One", rank: "XX", phase: 5, required_level: 190, max_hp: 100 },
            { id: "outer-2", name: "Outer God Two", rank: "XX", phase: 5, required_level: 200, max_hp: 100 },
        ];
        expect((await startBossBattleAction({ bossId: "outer-2" })).success).toBe(true);
    });
    it("authenticates boss reward requests before mutations and rejects cross-user IDs", async () => {
        mocks.auth.mockRejectedValueOnce(new Error("Authentication required"));
        expect((await grantBossRewards({ bossId: "boss-1", userId: user.id })).success).toBe(false);
        expect((await grantBossRewards({ bossId: "boss-1", userId: "player-2" })).success).toBe(false);
        expect(commits).toBe(0);
        expect(state.profiles["player-2"].gold_credits).toBe(0);
    });
    it("requires a zero-HP active encounter and rewards it only once", async () => {
        expect((await grantBossRewards({ bossId: "boss-1", userId: user.id })).success).toBe(false);
        state.encounters = [{ id: "encounter-1", user_id: user.id, boss_id: "boss-1", status: "ACTIVE", current_hp: 0 }];
        const responses = await Promise.all([1, 2].map(() => grantBossRewards({ bossId: "boss-1", userId: user.id })));
        expect(responses.filter(r => r.success)).toHaveLength(1);
        expect(state.profiles[user.id].gold_credits).toBe(204);
        expect(state.profiles[user.id].current_xp).toBe(102);
        expect(state.encounters[0].status).toBe("DEFEATED");
    });
    it("finishes combat and returns the existing victory/reward payload", async () => {
        state.encounters = [{ id: "encounter-1", user_id: user.id, boss_id: "boss-1", status: "ACTIVE", current_hp: 100, max_hp: 100 }];
        const response = await completeQuestAction({ questId: "q1", xpReward: 100 });
        expect(response.success).toBe(true);
        expect(response.data?.bossDamage.victory).toBe(true);
        expect(response.data?.bossDamage.rewards.bossName).toBe("Wolf");
        expect(state.encounters[0].status).toBe("DEFEATED");
        expect(state.profiles[user.id].current_xp).toBe(204);
    });
    it("keeps the quest successful and rolls back the combat round if boss rewards fail", async () => {
        state.encounters = [{ id: "encounter-1", user_id: user.id, boss_id: "boss-1", status: "ACTIVE", current_hp: 100, max_hp: 100 }];
        failQuery = sql => sql.includes("gold_credits = gold_credits + $1");
        const response = await completeQuestAction({ questId: "q1", xpReward: 100 });
        expect(response.success).toBe(true);
        expect(response.data?.bossError).toContain("Injected database failure");
        expect(response.data?.bossDamage.victory).toBeUndefined();
        expect(state.encounters[0].current_hp).toBe(100);
        expect(state.encounters[0].status).toBe("ACTIVE");
        expect(state.profiles[user.id].gold_credits).toBe(102);
    });
    it("rejects ordinary users' reward injection and global console actions", async () => {
        await expect(addXpAction(50000)).rejects.toThrow("Developer authorization");
        await expect(injectGoldAction(100000)).rejects.toThrow("Developer authorization");
        await expect(injectBulkCompletionsAction(100)).rejects.toThrow('Developer authorization');
        await expect(jumpToLevel999Action()).rejects.toThrow('Developer authorization');
        await expect(unlockAllBossesAction()).rejects.toThrow("Developer authorization");
        await expect(lockAllBossesAction()).rejects.toThrow("Developer authorization");
        expect((await clearActiveEncountersAction()).success).toBe(false);
        await expect(resetSystemAction()).rejects.toThrow("Developer authorization");
        expect(state.profiles[user.id].current_xp).toBe(0);
    });
    it('serializes purchases so concurrent requests cannot spend the same gold twice', async () => {
        state.profiles[user.id].gold_credits = 100;
        state.items = [{ id: 'sword', name: 'Test Sword', price: 50, rarity: 'E', type: 'EQUIPMENT', effect: {} }];
        const purchases = await Promise.all([purchaseItemAction('sword'), purchaseItemAction('sword')]);
        expect(purchases.every(purchase => purchase.success)).toBe(true);
        expect(state.profiles[user.id].gold_credits).toBe(6);
        expect(state.inventory).toHaveLength(2);
        await expect(purchaseItemAction('sword')).rejects.toThrow('Insufficient Funds');
        expect(state.profiles[user.id].gold_credits).toBe(6);
    });
    it('rolls back a purchase gold deduction when adding inventory fails', async () => {
        state.profiles[user.id].gold_credits = 100;
        state.items = [{ id: 'sword', name: 'Test Sword', price: 50, rarity: 'E', type: 'EQUIPMENT', effect: {} }];
        failQuery = sql => sql.includes('INSERT INTO inventory');
        await expect(purchaseItemAction('sword')).rejects.toThrow('Injected database failure');
        expect(state.profiles[user.id].gold_credits).toBe(100);
        expect(state.inventory).toHaveLength(0);
    });
    it('rejects invalid, future, old and oversized offline sync dates before player mutations', async () => {
        for (const dates of [['invalid'], ['2099-01-01'], ['2000-01-01'], Array(91).fill('2026-10-10')]) {
            await expect(syncOfflineProgressAction(dates)).rejects.toThrow('Validation Error');
        }
        expect(commits).toBe(0);
        expect(state.logs).toHaveLength(0);
    });
    it("allows explicitly authorized developers and serializes XP grants", async () => {
        vi.stubEnv('SLS_DEVELOPER_USER_IDS', user.id);
        mocks.auth.mockResolvedValue(user);
        const responses = await Promise.all([addXpAction(100), addXpAction(100)]);
        expect(responses.every(r => r.success)).toBe(true);
        expect(state.profiles[user.id].current_xp).toBe(200);
        expect((await injectGoldAction(1000)).newBalance).toBe(1000);
    });
    it("preserves level-up rewards and never awards them twice for concurrent grants", async () => {
        state.profiles[user.id].current_xp = getXpRequiredForLevel(2) - 100;
        await Promise.all([awardXp(user.id, 100), awardXp(user.id, 100)]);
        expect(state.profiles[user.id].level).toBe(2);
        expect(state.profiles[user.id].available_ap).toBe(5);
        expect(state.profiles[user.id].available_sp).toBe(1);
        expect(state.profiles[user.id].gold_credits).toBe(1000);
        expect(state.stats[user.id].mana).toBe(1010);
    });
    it("does not let callers process another player's penalties", async () => {
        await expect(checkDailyPenalty("player-2", 0)).rejects.toThrow("another player");
        expect(commits).toBe(0);
        expect((await checkDailyPenalty(user.id, 0)).status).toBe("SAFE");
    });
    it("preserves developer resets while keeping shared boss definitions untouched", async () => {
        vi.stubEnv('SLS_DEVELOPER_USER_IDS', user.id);
        mocks.auth.mockResolvedValue(user);
        state.profiles[user.id].level = 100;
        expect((await resetSystemAction()).success).toBe(true);
        expect(state.profiles[user.id].level).toBe(1);
        expect(state.profiles[user.id].next_level_xp).toBe(getXpRequiredForLevel(2));
        expect(calls.some(c => c.sql.includes("UPDATE bosses"))).toBe(false);
    });
});
