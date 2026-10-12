import { z } from 'zod';

/** Deployment-controlled immutable IDs; an empty or malformed list denies all. */
export function isDeveloperUserId(userId: string): boolean {
    const configured = process.env.SLS_DEVELOPER_USER_IDS?.trim();
    if (!configured) return false;
    const ids = z.array(z.string().uuid()).safeParse(configured.split(',').map(id => id.trim()));
    return ids.success && ids.data.some(id => id.toLowerCase() === userId.toLowerCase());
}
