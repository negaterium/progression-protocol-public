// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), queryOne: vi.fn() }));
vi.mock('./session', () => ({ getSession: mocks.session }));
vi.mock('./db', () => ({ default: { queryOne: mocks.queryOne } }));
import { getAuthenticatedUser } from './auth-utils';

const id = '00000000-0000-4000-8000-000000000001';
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue(null); });
afterEach(() => vi.unstubAllEnvs());

describe('Development authentication boundary', () => {
    it('requires a real session in production even when all override switches are set', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_ENABLE_DEV_AUTH', 'true');
        vi.stubEnv('NEXT_PUBLIC_DEV_USER_ID', id);
        vi.stubEnv('SLS_ENABLE_DEV_AUTH', 'true');
        vi.stubEnv('SLS_DEV_USER_ID', id);
        await expect(getAuthenticatedUser()).rejects.toThrow('Authentication required');
        expect(mocks.queryOne).not.toHaveBeenCalled();
    });
    it('permits an explicitly configured existing development user', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('SLS_ENABLE_DEV_AUTH', 'true');
        vi.stubEnv('SLS_DEV_USER_ID', id);
        mocks.queryOne.mockResolvedValue({ id, username: 'local-hunter' });
        expect(await getAuthenticatedUser()).toEqual({ id, username: 'local-hunter' });
        expect(mocks.queryOne).toHaveBeenCalledWith(expect.any(String), [id]);
    });
    it('rejects missing/invalid development identities and retains normal session authentication', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('SLS_ENABLE_DEV_AUTH', 'true');
        vi.stubEnv('SLS_DEV_USER_ID', 'not-a-uuid');
        mocks.session.mockResolvedValue({ user_id: id, username: 'session-hunter' });
        expect(await getAuthenticatedUser()).toEqual({ id, username: 'session-hunter' });
        expect(mocks.queryOne).not.toHaveBeenCalled();
    });
});
