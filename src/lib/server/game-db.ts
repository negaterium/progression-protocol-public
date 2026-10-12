import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import poolDb from "@/lib/db";

interface TransactionContext {
    client: PoolClient;
    queue: Promise<unknown>;
    sequence: number;
    userId?: string;
}

const transactions = new AsyncLocalStorage<TransactionContext>();

function enqueue<T>(context: TransactionContext, work: () => Promise<T>): Promise<T> {
    const result = context.queue.then(work);
    context.queue = result.catch(() => undefined);
    return result;
}

// Existing optional audit/loot queries catch database errors. A statement savepoint
// keeps those errors from poisoning the enclosing PostgreSQL transaction. Serialize
// statements so Promise.all callers cannot interleave savepoints on one connection.
async function query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    const context = transactions.getStore();
    if (!context) return poolDb.query<T>(sql, params);
    return enqueue(context, async () => {
        const name = `game_statement_${++context.sequence}`;
        await context.client.query(`SAVEPOINT ${name}`);
        try {
            const result = await context.client.query<T>(sql, params);
            await context.client.query(`RELEASE SAVEPOINT ${name}`);
            return result;
        } catch (error) {
            await context.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
            await context.client.query(`RELEASE SAVEPOINT ${name}`);
            throw error;
        }
    });
}

async function queryOne<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<T | null> {
    if (!transactions.getStore()) return poolDb.queryOne<T>(sql, params);
    return (await query<T>(sql, params)).rows[0] || null;
}

async function transaction<T>(work: (client: Pick<PoolClient, "query">) => Promise<T>): Promise<T> {
    const context = transactions.getStore();
    if (!context) {
        return poolDb.transaction(client => {
            const scope: TransactionContext = { client, queue: Promise.resolve(), sequence: 0 };
            return transactions.run(scope, async () => {
                try {
                    return await work({ query } as Pick<PoolClient, "query">);
                } finally {
                    // Promise.all may reject before its other queued queries finish.
                    await scope.queue;
                }
            });
        });
    }
    const name = `game_operation_${++context.sequence}`;
    await enqueue(context, () => context.client.query(`SAVEPOINT ${name}`));
    try {
        const result = await work({ query } as Pick<PoolClient, "query">);
        await enqueue(context, () => context.client.query(`RELEASE SAVEPOINT ${name}`));
        return result;
    } catch (error) {
        await enqueue(context, async () => {
            await context.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
            await context.client.query(`RELEASE SAVEPOINT ${name}`);
        });
        throw error;
    }
}

/** Reuses the existing pool; reward helpers participate in the caller's transaction. */
export const gameDb = { query, queryOne, transaction };

/** Serialize a player's quest, XP, inventory and encounter mutations across requests. */
export async function withGameTransaction<T>(userId: string, work: () => Promise<T>): Promise<T> {
    return transaction(async () => {
        const context = transactions.getStore()!;
        if (context.userId && context.userId !== userId) {
            throw new Error("Cannot mutate another player inside a game transaction.");
        }
        if (!context.userId) {
            const profile = await queryOne("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [userId]);
            if (!profile) throw new Error("Profile not found");
            context.userId = userId;
        }
        return work();
    });
}
