// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ConfigurationError, parseApplicationEnvironment, parseDatabaseEnvironment, configurationNotes } from './environment';

const base = () => ({ POSTGRES_HOST: 'localhost', POSTGRES_DATABASE: 'sls_test', POSTGRES_USER: 'sls_test', POSTGRES_PASSWORD: 'test-only-password' });

describe('Configuration validation', () => {
    it('shares database defaults without permitting pg environment fallbacks', () => {
        expect(parseDatabaseEnvironment(base()).POSTGRES_PORT).toBe('5432');
        expect(() => parseDatabaseEnvironment({ PGPASSWORD: 'test-only-password' })).toThrow(ConfigurationError);
    });
    it.each(['', '0', '65536', '5432x', '5.5', '-1', ' 5432'])('rejects an invalid PostgreSQL port: %s', value => {
        expect(() => parseDatabaseEnvironment({ ...base(), POSTGRES_PORT: value })).toThrow('POSTGRES_PORT');
    });
    it('reports field names without leaking values or Zod received values', () => {
        const env = { ...base(), SLS_TRUST_PROXY_HEADERS: 'PRIVATE_SENTINEL', POSTGRES_PASSWORD: 'test-only-private-sentinel', POSTGRES_HOST: ' private-host ' };
        try { parseApplicationEnvironment(env); throw new Error('Expected validation failure'); }
        catch (error) {
            expect(error).toBeInstanceOf(ConfigurationError);
            expect(String(error)).toContain('SLS_TRUST_PROXY_HEADERS');
            expect(String(error)).not.toMatch(/PRIVATE_SENTINEL|test-only-private-sentinel|private-host/);
        }
    });
    it('requires operators to replace the template password', () => {
        expect(() => parseDatabaseEnvironment({ ...base(), POSTGRES_PASSWORD: 'replace_me' })).toThrow('POSTGRES_PASSWORD');
    });
    it('defaults security switches off and keeps cookie defaults mode-dependent', () => {
        const env = parseApplicationEnvironment({ ...base(), NODE_ENV: 'production' });
        expect(env.SLS_ENABLE_DEV_AUTH).toBe('false');
        expect(env.SLS_TRUST_PROXY_HEADERS).toBe('false');
        expect(env.SLS_DEVELOPER_USER_IDS).toBe('');
        expect(env.USE_SECURE_COOKIES).toBeUndefined();
    });
    it('rejects a production development override and a missing override identity', () => {
        expect(() => parseApplicationEnvironment({ ...base(), NODE_ENV: 'production', SLS_ENABLE_DEV_AUTH: 'true' })).toThrow('SLS_ENABLE_DEV_AUTH');
        expect(() => parseApplicationEnvironment({ ...base(), NODE_ENV: 'development', SLS_ENABLE_DEV_AUTH: 'true' })).toThrow('SLS_DEV_USER_ID');
    });
    it('allows an explicit development UUID without granting developer privileges', () => {
        const env = parseApplicationEnvironment({ ...base(), SLS_ENABLE_DEV_AUTH: 'true', SLS_DEV_USER_ID: '00000000-0000-4000-8000-000000000001' });
        expect(env.SLS_DEVELOPER_USER_IDS).toBe('');
    });
    it('rejects malformed UUID lists and boolean typos', () => {
        expect(() => parseApplicationEnvironment({ ...base(), SLS_DEVELOPER_USER_IDS: 'not-a-uuid' })).toThrow('SLS_DEVELOPER_USER_IDS');
        expect(() => parseApplicationEnvironment({ ...base(), USE_SECURE_COOKIES: 'False' })).toThrow('USE_SECURE_COOKIES');
    });
    it('explains explicit trust/cookie settings and ignored legacy flags without showing their values', () => {
        const notes = configurationNotes({ ...base(), NODE_ENV: 'production', USE_SECURE_COOKIES: 'false', SLS_TRUST_PROXY_HEADERS: 'true', NEXT_PUBLIC_DEV_USER_ID: 'PRIVATE_SENTINEL' });
        expect(notes).toHaveLength(3);
        expect(notes.join(' ')).not.toContain('PRIVATE_SENTINEL');
    });
});
