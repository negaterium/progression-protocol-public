import { createHash } from 'node:crypto';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 10_000;
const attempts = new Map<string, { count: number; expiresAt: number }>();

/** Single-process protection. Deployments with replicas also need proxy throttling. */
export function takeLoginAttempt(username: string, trustedClientIp?: string): boolean {
    const now = Date.now();
    for (const [key, bucket] of attempts) if (bucket.expiresAt <= now) attempts.delete(key);
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    const limits: [string, number][] = [
        [`account:${digest(username.toLowerCase())}`, 5],
        [trustedClientIp ? `client:${digest(trustedClientIp)}` : 'instance', trustedClientIp ? 30 : 300],
    ];
    const missing = limits.filter(([key]) => !attempts.has(key)).length;
    if (attempts.size + missing > MAX_KEYS) return false;
    if (limits.some(([key, limit]) => (attempts.get(key)?.count || 0) >= limit)) return false;
    for (const [key] of limits) {
        const bucket = attempts.get(key) || { count: 0, expiresAt: now + WINDOW_MS };
        bucket.count++;
        attempts.set(key, bucket);
    }
    return true;
}
