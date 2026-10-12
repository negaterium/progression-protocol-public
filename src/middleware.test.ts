// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('Route authentication redirects', () => {
    it('keeps login accessible when a stale or forged session cookie exists', async () => {
        const response = await middleware(new NextRequest('http://localhost/login', { headers: { cookie: 'sls_session=malformed' } }));
        expect(response.headers.get('location')).toBeNull();
    });
    it('redirects an anonymous dashboard request to login', async () => {
        const response = await middleware(new NextRequest('http://localhost/dashboard/profile'));
        expect(response.status).toBe(307); expect(response.headers.get('location')).toContain('/login');
    });
});
