// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provisionPlayer } from './player-provisioning';

vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed-password') } }));
const query = vi.fn();
const release = vi.fn();
const pool = { connect: vi.fn(async () => ({ query, release })) };
beforeEach(() => { vi.clearAllMocks(); query.mockResolvedValue({ rows: [] }); });

describe('Playable account provisioning', () => {
    it('uses one identity for credentials, profile, stats and quest state in one transaction', async () => {
        const id = await provisionPlayer(pool as never, '  hunter  ', 'password123');
        expect(query.mock.calls[0][0]).toBe('BEGIN');
        expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
        expect(query.mock.calls.slice(1, -1).every(([, params]) => params[0] === id)).toBe(true);
        expect(query.mock.calls[1][1]).toEqual([id, 'hunter', 'hashed-password']);
        expect(query.mock.calls[2][1]).toEqual([id, 'hunter', 5580]);
        expect(query.mock.calls.some(([sql]) => /UPDATE|ON CONFLICT/.test(sql))).toBe(false);
        expect(release).toHaveBeenCalledOnce();
    });
    it('rolls back credentials when profile insertion fails', async () => {
        query.mockImplementation(async (sql: string) => {
            if (sql.startsWith('INSERT INTO public.profiles')) throw new Error('profile failed');
            return { rows: [] };
        });
        await expect(provisionPlayer(pool as never, 'hunter', 'password123')).rejects.toThrow('profile failed');
        expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
        expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
        expect(release).toHaveBeenCalledOnce();
    });
    it('rejects blank names and bcrypt-truncated passwords before connecting', async () => {
        await expect(provisionPlayer(pool as never, ' ', 'password123')).rejects.toThrow();
        await expect(provisionPlayer(pool as never, 'hunter', 'é'.repeat(37))).rejects.toThrow();
        expect(pool.connect).not.toHaveBeenCalled();
    });
});
