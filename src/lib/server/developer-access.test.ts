// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDeveloperUserId } from './developer-access';

const id = '00000000-0000-4000-8000-000000000001';
afterEach(() => vi.unstubAllEnvs());

describe('Deployment-controlled developer privileges', () => {
    it('denies access by default and ignores account names', () => {
        vi.stubEnv('SLS_DEVELOPER_USER_IDS', '');
        expect(isDeveloperUserId(id)).toBe(false);
        expect(isDeveloperUserId('testuser')).toBe(false);
    });
    it('authorizes only configured UUIDs, including whitespace and case normalization', () => {
        vi.stubEnv('SLS_DEVELOPER_USER_IDS', ` ${id}, 00000000-0000-4000-8000-000000000002 `);
        expect(isDeveloperUserId(id)).toBe(true);
        expect(isDeveloperUserId('00000000-0000-4000-8000-000000000003')).toBe(false);
    });
    it('fails closed for an invalid list rather than partially granting access', () => {
        vi.stubEnv('SLS_DEVELOPER_USER_IDS', `${id},testuser`);
        expect(isDeveloperUserId(id)).toBe(false);
    });
});
