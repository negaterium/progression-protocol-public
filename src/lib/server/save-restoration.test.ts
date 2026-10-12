// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/db', () => ({ default: { transaction: mocks.transaction } }));
import { restoreSave } from './save-restoration';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const questId = '00000000-0000-4000-8000-000000000003';
let committed: boolean;
let rolledBack: boolean;
let writes: number;
const save = () => ({ profiles: [{ id: userId, username: 'hunter', level: 5 }], hunter_stats: [{ user_id: userId, strength: 10 }], inventory: [], user_quests: [], quest_logs: [] });

beforeEach(() => {
    vi.clearAllMocks(); committed = false; rolledBack = false; writes = 0;
    mocks.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith('SELECT id FROM profiles')) return { rows: [{ id: userId }] };
        if (sql.startsWith('SELECT id, user_id FROM quests')) return { rows: [] };
        writes++;
        return { rows: [] };
    });
    mocks.transaction.mockImplementation(async work => {
        try { await work({ query: mocks.query }); committed = true; }
        catch (error) { rolledBack = true; writes = 0; throw error; }
    });
});

describe('Save restoration ownership and SQL boundaries', () => {
    it('rejects a forged profile owner before opening a transaction', async () => {
        const data = save(); data.profiles[0].id = otherId;
        await expect(restoreSave(userId, data)).rejects.toThrow('different user');
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('rejects forged ownership inside a save despite a matching outer profile', async () => {
        const data = save(); data.hunter_stats[0].user_id = otherId;
        await expect(restoreSave(userId, data)).rejects.toThrow('another user');
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('rejects SQL-shaped field names before any database operation', async () => {
        const data = save(); Object.assign(data.hunter_stats[0], { 'strength) VALUES (999); --': 999 });
        await expect(restoreSave(userId, data)).rejects.toThrow('Invalid save field name');
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('rejects unknown table names instead of accepting arbitrary backup tables', async () => {
        await expect(restoreSave(userId, { ...save(), users: [{ id: otherId }] })).rejects.toThrow();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it('validates referenced quest ownership before creating a backup or deleting rows', async () => {
        mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT id, user_id') ? [{ id: questId, user_id: otherId }] : [{ id: userId }] }));
        await expect(restoreSave(userId, { ...save(), user_quests: [{ user_id: userId, quest_id: questId }] })).rejects.toThrow('another user');
        expect(mocks.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
    });
    it('does not allow an imported private quest to replace a global template', async () => {
        mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT id, user_id') ? [{ id: questId, user_id: null }] : [{ id: userId }] }));
        await expect(restoreSave(userId, { ...save(), quests: [{ id: questId, user_id: userId }] })).rejects.toThrow('shared template');
        expect(mocks.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
    });
    it('restores a valid save with JSON parameters, without updating identity or role fields', async () => {
        const data = save(); Object.assign(data.profiles[0], { username: 'renamed-owner', role: 'admin' });
        await restoreSave(userId, data);
        expect(committed).toBe(true);
        const profileUpdate = mocks.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE profiles'))!;
        expect(profileUpdate[0]).not.toContain('username =');
        expect(profileUpdate[0]).not.toContain('role');
        expect(profileUpdate[1][0]).toBe(userId);
        const insert = mocks.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO hunter_stats'))!;
        expect(insert[0]).toContain('jsonb_populate_recordset');
        expect(JSON.parse(insert[1][0])[0].user_id).toBe(userId);
        expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO user_backups'))).toBe(true);
    });
    it('rolls back deletes, updates and the safety backup on an insert failure', async () => {
        mocks.query.mockImplementation(async (sql: string) => {
            if (sql.startsWith('SELECT id FROM profiles')) return { rows: [{ id: userId }] };
            if (sql.startsWith('SELECT id, user_id FROM quests')) return { rows: [] };
            if (sql.startsWith('INSERT INTO hunter_stats')) throw new Error('test insert failure');
            writes++; return { rows: [] };
        });
        await expect(restoreSave(userId, save())).rejects.toThrow('test insert failure');
        expect(committed).toBe(false); expect(rolledBack).toBe(true); expect(writes).toBe(0);
    });
});
