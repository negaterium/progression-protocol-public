// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('./db', () => ({ default: { query: mocks.query } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set, delete: mocks.delete }) }));
import { createSession, getSession, extendSession } from './session';

const id = '00000000-0000-4000-8000-000000000001';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('USE_SECURE_COOKIES', ''); mocks.query.mockResolvedValue({ rows: [], rowCount: 0 }); });
afterEach(() => vi.unstubAllEnvs());

describe('Session lifecycle', () => {
    it('rejects malformed cookie tokens without querying the database', async () => {
        mocks.get.mockReturnValue({ value: 'malformed' });
        expect(await getSession()).toBeNull(); expect(mocks.query).not.toHaveBeenCalled();
    });
    it('defaults new production cookies to Secure and 30 days', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const before = Date.now(); await createSession(id);
        const options = mocks.set.mock.calls[0][2];
        expect(options).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
        expect(options.expires.getTime() - before).toBeCloseTo(30 * 86400000, -3);
    });
    it('allows an explicit HTTP override for a trusted local deployment', async () => {
        vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('USE_SECURE_COOKIES', 'false');
        await createSession(id); expect(mocks.set.mock.calls[0][2].secure).toBe(false);
    });
    it('never renews an expired or missing database session', async () => {
        mocks.get.mockReturnValue({ value: id });
        expect(await extendSession()).toBe(false);
        expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
        expect(mocks.set).not.toHaveBeenCalled();
    });
    it('renews only the validated session and owning user', async () => {
        mocks.get.mockReturnValue({ value: id });
        mocks.query.mockResolvedValueOnce({ rows: [{ id, user_id: id, username: 'hunter' }], rowCount: 1 });
        mocks.query.mockResolvedValueOnce({ rows: [{ id }], rowCount: 1 });
        expect(await extendSession()).toBe(true);
        expect(mocks.query.mock.calls[1][0]).toContain('user_id = $3');
        expect(mocks.query.mock.calls[1][1].slice(1)).toEqual([id, id]);
    });
});
