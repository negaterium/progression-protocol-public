// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const pool = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: pool }));
import { gameDb, withGameTransaction } from "./game-db";

let connections: Array<{ statements: string[]; committed: boolean; rolledBack: boolean }>;
beforeEach(() => {
    vi.clearAllMocks(); connections = [];
    pool.query.mockResolvedValue({ rows: [{ via: "pool" }] });
    pool.queryOne.mockResolvedValue({ via: "pool" });
    pool.transaction.mockImplementation(async work => {
        const connection = { statements: [] as string[], committed: false, rolledBack: false };
        connections.push(connection);
        const client = {
            query: vi.fn(async (sql: string, params?: unknown[]) => {
                connection.statements.push(sql);
                if (sql === "FAIL") throw new Error("statement failed");
                return { rows: [{ id: params?.[0] || "profile", via: connections.indexOf(connection) }] };
            })
        };
        try { const result = await work(client); connection.committed = true; return result; }
        catch (error) { connection.rolledBack = true; throw error; }
    });
});

describe("Scoped game transactions", () => {
    it("uses the existing pool outside a transaction", async () => {
        expect((await gameDb.query("READ")).rows[0].via).toBe("pool");
        expect((await gameDb.queryOne("READ"))?.via).toBe("pool");
        expect(pool.transaction).not.toHaveBeenCalled();
    });
    it("uses one connection and profile lock for nested reward helpers", async () => {
        await withGameTransaction("player-1", async () => {
            await withGameTransaction("player-1", () => gameDb.query("WRITE"));
        });
        expect(connections).toHaveLength(1);
        expect(connections[0].statements.filter(sql => sql.includes("FOR UPDATE"))).toHaveLength(1);
        expect(pool.query).not.toHaveBeenCalled();
        expect(connections[0].committed).toBe(true);
    });
    it("keeps concurrent requests on their own connections", async () => {
        const responses = await Promise.all(["player-1", "player-2"].map(id => withGameTransaction(id, async () => {
            await Promise.resolve();
            return gameDb.queryOne("READ", [id]);
        })));
        expect(responses.map(r => r?.id)).toEqual(["player-1", "player-2"]);
        expect(responses[0]?.via).not.toBe(responses[1]?.via);
        expect(connections.every(c => c.committed)).toBe(true);
    });
    it("rolls back a caught optional statement and continues the transaction", async () => {
        await withGameTransaction("player-1", async () => {
            await gameDb.query("FAIL").catch(() => undefined);
            await gameDb.query("WRITE");
        });
        expect(connections[0].statements.some(sql => sql.startsWith("ROLLBACK TO SAVEPOINT"))).toBe(true);
        expect(connections[0].committed).toBe(true);
        expect(connections[0].statements).toContain("WRITE");
    });
    it("rolls back all writes when a required statement fails", async () => {
        await expect(withGameTransaction("player-1", async () => {
            await gameDb.query("WRITE");
            await gameDb.query("FAIL");
        })).rejects.toThrow("statement failed");
        expect(connections[0].rolledBack).toBe(true);
        expect(connections[0].committed).toBe(false);
    });
    it("serializes Promise.all statements with their savepoints", async () => {
        await withGameTransaction("player-1", () => Promise.all([gameDb.query("A"), gameDb.query("B")]));
        const statements = connections[0].statements;
        const a = statements.indexOf("A"), b = statements.indexOf("B");
        expect(statements[a - 1]).toMatch(/^SAVEPOINT /);
        expect(statements[a + 1]).toMatch(/^RELEASE SAVEPOINT /);
        expect(statements[b - 1]).toMatch(/^SAVEPOINT /);
        expect(statements[b + 1]).toMatch(/^RELEASE SAVEPOINT /);
    });
    it("drains queued Promise.all work before rolling back a rejected operation", async () => {
        await expect(withGameTransaction("player-1", () => Promise.all([gameDb.query("FAIL"), gameDb.query("B")]))).rejects.toThrow();
        expect(connections[0].statements).toContain("B");
        expect(connections[0].rolledBack).toBe(true);
    });
    it("prevents a nested operation from switching the reward recipient", async () => {
        await expect(withGameTransaction("player-1", () => withGameTransaction("player-2", () => gameDb.query("WRITE")))).rejects.toThrow("another player");
        expect(connections[0].statements).not.toContain("WRITE");
        expect(connections[0].rolledBack).toBe(true);
    });
});
