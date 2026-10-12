// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), verify: vi.fn(), session: vi.fn(), attempts: vi.fn(), headers: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/db', () => ({ default: { query: mocks.query } }));
vi.mock('@/lib/auth-utils', () => ({ verifyPassword: mocks.verify }));
vi.mock('@/lib/session', () => ({ createSession: mocks.session, destroySession: vi.fn() }));
vi.mock('@/lib/server/login-rate-limit', () => ({ takeLoginAttempt: mocks.attempts }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('bcryptjs', () => ({ hashSync: () => 'test-dummy-hash' }));
import { login } from './actions';

const id = '00000000-0000-4000-8000-000000000001';
const form = (username = 'hunter', password = 'test-only-password') => {
    const data = new FormData(); data.set('username', username); data.set('password', password); return data;
};
beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('SLS_TRUST_PROXY_HEADERS', 'false');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.attempts.mockReturnValue(true); mocks.query.mockResolvedValue({ rows: [] });
    mocks.verify.mockResolvedValue(false); mocks.headers.mockResolvedValue(new Headers({ 'x-real-ip': '127.0.0.1' }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('Login input and request boundaries', () => {
    it('rejects missing, oversized, multibyte oversized and file credentials before database access', async () => {
        const inputs = [form('', 'test'), form('x'.repeat(51)), form('hunter', 'x'.repeat(73)), form('hunter', 'é'.repeat(37))];
        const file = form(); file.set('password', new Blob(['test-only-password']), 'credential.txt'); inputs.push(file);
        for (const input of inputs) expect((await login(input))?.error).toBeTruthy();
        expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
    });
    it('stops throttled attempts before database and bcrypt work', async () => {
        mocks.attempts.mockReturnValue(false);
        expect((await login(form()))?.error).toContain('Too many');
        expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
    });
    it('performs bcrypt for unknown accounts and returns the same credential error', async () => {
        expect((await login(form()))?.error).toBe('Invalid credentials');
        expect(mocks.verify).toHaveBeenCalledWith('test-only-password', 'test-dummy-hash');
        expect(mocks.session).not.toHaveBeenCalled();
    });
    it('does not trust caller-supplied proxy headers by default', async () => {
        await login(form()); expect(mocks.headers).not.toHaveBeenCalled();
        expect(mocks.attempts).toHaveBeenCalledWith('hunter', undefined);
    });
    it('uses only a valid proxy-overwritten IP when explicitly configured', async () => {
        vi.stubEnv('SLS_TRUST_PROXY_HEADERS', 'true');
        await login(form()); expect(mocks.attempts).toHaveBeenCalledWith('hunter', '127.0.0.1');
        mocks.headers.mockResolvedValue(new Headers({ 'x-real-ip': '127.0.0.1, forged' }));
        await login(form()); expect(mocks.attempts).toHaveBeenLastCalledWith('hunter', undefined);
    });
    it('creates a session only after successful verification', async () => {
        mocks.query.mockResolvedValue({ rows: [{ id, username: 'hunter', password_hash: 'test-stored-hash' }] });
        mocks.verify.mockResolvedValue(true);
        await login(form()); expect(mocks.session).toHaveBeenCalledWith(id);
        expect(mocks.redirect).toHaveBeenCalledWith('/dashboard');
    });
    it('keeps database detail out of the login response', async () => {
        mocks.query.mockRejectedValueOnce(Object.assign(new Error('test database detail'), { code: '42P01' }));
        const response = await login(form()); expect(response?.error).not.toContain('database detail');
        expect(mocks.session).not.toHaveBeenCalled();
    });
});
