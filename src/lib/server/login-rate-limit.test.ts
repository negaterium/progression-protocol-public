// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T00:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('Login throttling', () => {
    it('limits a username even when callers vary case or client address', async () => {
        const { takeLoginAttempt } = await import('./login-rate-limit');
        for (let index = 0; index < 5; index++) expect(takeLoginAttempt('hunter', `127.0.0.${index + 1}`)).toBe(true);
        expect(takeLoginAttempt('HUNTER', '127.0.0.20')).toBe(false);
    });
    it('limits password spraying from one trusted client across different accounts', async () => {
        const { takeLoginAttempt } = await import('./login-rate-limit');
        for (let index = 0; index < 30; index++) expect(takeLoginAttempt(`hunter-${index}`, '127.0.0.1')).toBe(true);
        expect(takeLoginAttempt('another-hunter', '127.0.0.1')).toBe(false);
    });
    it('expires throttles after the fixed window', async () => {
        const { takeLoginAttempt } = await import('./login-rate-limit');
        for (let index = 0; index < 5; index++) takeLoginAttempt('hunter');
        expect(takeLoginAttempt('hunter')).toBe(false);
        vi.advanceTimersByTime(15 * 60 * 1000);
        expect(takeLoginAttempt('hunter')).toBe(true);
    });
    it('applies an instance limit when there is no trusted client address', async () => {
        const { takeLoginAttempt } = await import('./login-rate-limit');
        for (let index = 0; index < 300; index++) expect(takeLoginAttempt(`hunter-${index}`)).toBe(true);
        expect(takeLoginAttempt('another-hunter')).toBe(false);
    });
});
