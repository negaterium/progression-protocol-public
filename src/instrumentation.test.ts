// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const validate = vi.hoisted(() => vi.fn());
vi.mock('./lib/server/environment', () => ({ parseApplicationEnvironment: validate }));
import { register } from './instrumentation';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_RUNTIME', 'nodejs'); vi.stubEnv('NEXT_PHASE', ''); });
afterEach(() => vi.unstubAllEnvs());
it('validates Node.js startup and propagates configuration failure', async () => {
    validate.mockImplementationOnce(() => { throw new Error('Invalid configuration: POSTGRES_HOST'); });
    await expect(register()).rejects.toThrow('POSTGRES_HOST');
    expect(validate).toHaveBeenCalledOnce();
});
it('does not require runtime credentials during production builds', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await register();
    expect(validate).not.toHaveBeenCalled();
});
it('keeps the Node.js configuration check out of Edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    await register();
    expect(validate).not.toHaveBeenCalled();
});
