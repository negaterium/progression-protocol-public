import { z } from 'zod';

/** @typedef {Record<string, string | undefined>} Environment */
const text = z.string().min(1).refine(value => value === value.trim(), 'Remove surrounding whitespace.');
const port = z.string().regex(/^\d+$/, 'Use an integer port.').refine(value => Number(value) >= 1 && Number(value) <= 65535, 'Use a port from 1 to 65535.');
const flag = z.enum(['true', 'false']);
const uuid = z.string().uuid();
const databaseSchema = z.object({
    POSTGRES_HOST: text,
    POSTGRES_PORT: port.default('5432'),
    POSTGRES_DATABASE: text,
    POSTGRES_USER: text,
    POSTGRES_PASSWORD: z.string().min(1).refine(value => !['replace_me', 'change_me', 'your_password', 'your_db_password'].includes(value), 'Replace the template password.'),
});
const applicationSchema = databaseSchema.extend({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    USE_SECURE_COOKIES: flag.optional(),
    SLS_ENABLE_DEV_AUTH: flag.default('false'),
    SLS_DEV_USER_ID: z.union([z.literal(''), uuid]).optional(),
    SLS_DEVELOPER_USER_IDS: z.string().default('').refine(value => !value.trim()
        || value.split(',').every(id => uuid.safeParse(id.trim()).success), 'Use comma-separated user UUIDs.'),
    SLS_TRUST_PROXY_HEADERS: flag.default('false'),
    PORT: port.optional(),
}).superRefine((env, ctx) => {
    if (env.SLS_ENABLE_DEV_AUTH === 'true') {
        if (env.NODE_ENV !== 'development') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SLS_ENABLE_DEV_AUTH'], message: 'Enable only in development.' });
        if (!env.SLS_DEV_USER_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SLS_DEV_USER_ID'], message: 'Select an existing user UUID when enabling the override.' });
    }
});

/** Only field names and fixed guidance enter this error, never supplied values. */
export class ConfigurationError extends Error {
    /** @param {string[]} fields */
    constructor(fields) {
        super(`Invalid configuration: ${fields.join(', ')}. Check the environment template and docs/SETUP.md. Values are not shown.`);
        this.fields = fields;
        this.name = 'ConfigurationError';
    }
}

/** @template T @param {import('zod').SafeParseReturnType<unknown, T>} result @returns {T} */
function unwrap(result) {
    if (!result.success) throw new ConfigurationError([...new Set(result.error.issues.map(issue => String(issue.path[0])))]);
    return result.data;
}

/** @param {Environment} env */
export function parseDatabaseEnvironment(env) { return unwrap(databaseSchema.safeParse(env)); }

/** @param {Environment} env */
export function parseApplicationEnvironment(env) { return unwrap(applicationSchema.safeParse(env)); }

/** @param {Environment} env @returns {string[]} */
export function configurationNotes(env) {
    const parsed = parseApplicationEnvironment(env);
    const notes = [];
    if (parsed.NODE_ENV === 'production' && parsed.USE_SECURE_COOKIES === 'false') notes.push('USE_SECURE_COOKIES=false: HTTP is permitted; reserve this for a trusted private network.');
    if (parsed.SLS_TRUST_PROXY_HEADERS === 'true') notes.push('SLS_TRUST_PROXY_HEADERS=true requires an exclusively accessible proxy that overwrites X-Real-IP.');
    if (env.NEXT_PUBLIC_ENABLE_DEV_AUTH !== undefined || env.NEXT_PUBLIC_DEV_USER_ID !== undefined) notes.push('Legacy NEXT_PUBLIC authentication overrides are ignored. Use the server-only settings in the template.');
    return notes;
}
