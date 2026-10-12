/** Validate settings before Node.js serves requests, including standalone Docker. */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
        const { parseApplicationEnvironment } = await import('./lib/server/environment');
        parseApplicationEnvironment(process.env);
    }
}
