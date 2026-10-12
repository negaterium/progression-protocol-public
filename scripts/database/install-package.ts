import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { catalogInserts, validateCatalogSeed, type CatalogName } from './catalogs';

export interface DatabasePackage { version: string; schema: string; catalogs: unknown }

/** Trusted, reviewed repository SQL only; never accepts uploaded save SQL. */
export async function installDatabasePackage(pool: Pick<Pool, 'connect'>, bundle: DatabasePackage): Promise<'installed' | 'already-installed'> {
    validateCatalogSeed(bundle.catalogs);
    if (!/^\d{3}_[a-z0-9_]+$/.test(bundle.version)) throw new Error('Invalid migration version.');
    if (/^\s*\\/m.test(bundle.schema)) throw new Error('Baseline must contain SQL only, without psql metacommands.');
    const checksum = createHash('sha256').update(bundle.schema).update(JSON.stringify(bundle.catalogs)).digest('hex');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [731946201]);
        const version = Number((await client.query('SHOW server_version_num')).rows[0].server_version_num);
        if (version < 170000) throw new Error('The baseline requires PostgreSQL 17 or later.');
        const marker = (await client.query("SELECT to_regclass('public.sls_schema_migrations') AS marker")).rows[0].marker;
        if (marker) {
            const prior = await client.query('SELECT checksum FROM public.sls_schema_migrations WHERE version = $1', [bundle.version]);
            if (prior.rows[0]?.checksum !== checksum) throw new Error('Baseline missing or modified; an explicit upgrade migration is required.');
            await client.query('COMMIT');
            return 'already-installed';
        }
        const objects = await client.query(`SELECT c.oid FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')`);
        if (objects.rows.length) throw new Error('Fresh installation requires an empty public schema. Existing installations must use an explicit upgrade path.');
        await client.query(bundle.schema);
        for (const name of Object.keys(catalogInserts) as CatalogName[]) {
            const rows = bundle.catalogs[name];
            if (rows.length) await client.query(catalogInserts[name], [JSON.stringify(rows)]);
        }
        // Imported catalog IDs can use identity sequences; advance these without
        // interpolating identifiers or touching player-table sequences.
        for (const name of Object.keys(catalogInserts) as CatalogName[]) {
            const sequence = (await client.query('SELECT pg_get_serial_sequence($1, $2) AS sequence', [`public.${name}`, 'id'])).rows[0].sequence;
            const ids = bundle.catalogs[name].map(row => String(row.id)).filter(id => /^\d+$/.test(id));
            if (sequence && ids.length) {
                const max = ids.reduce((a, b) => BigInt(a) > BigInt(b) ? a : b);
                await client.query('SELECT setval($1::regclass, $2::bigint, true)', [sequence, max]);
            }
        }
        await client.query(`CREATE TABLE public.sls_schema_migrations (
            version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
        )`);
        await client.query('INSERT INTO public.sls_schema_migrations (version, checksum) VALUES ($1, $2)', [bundle.version, checksum]);
        await client.query('COMMIT');
        return 'installed';
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
}
