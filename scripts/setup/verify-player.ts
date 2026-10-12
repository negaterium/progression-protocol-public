/** Internal clean-install test helper. Never run against a deployment database. */
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { databaseConfig } from '../database/config';

async function main() {
    const config = databaseConfig('/config/setup.env');
    assert.equal(config.host, 'postgres');
    assert.match(String(config.database), /^sls_setup_[a-f0-9]{12}$/);
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const password: unknown = JSON.parse(input).password;
    assert.equal(typeof password, 'string');
    const pool = new Pool(config);
    try {
        const account = (await pool.query<{ id: string; password_hash: string }>(
            'SELECT id, password_hash FROM users WHERE username = $1', ['setup_hunter'])).rows[0];
        assert(account);
        assert(await bcrypt.compare(password as string, account.password_hash));
        const profile = (await pool.query('SELECT level, current_xp, next_level_xp FROM profiles WHERE id = $1', [account.id])).rows[0];
        assert.equal(profile.level, 1);
        assert.equal(profile.current_xp, 0);
        assert.equal(profile.next_level_xp, 5580);
        assert.equal((await pool.query('SELECT strength FROM hunter_stats WHERE user_id = $1', [account.id])).rows[0].strength, 10);
        const sessionId = randomUUID();
        await pool.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'10 minutes\')', [sessionId, account.id]);
        // Captured only by the parent verifier, never displayed as tool output.
        console.log(JSON.stringify({ sessionId }));
    } finally { await pool.end(); }
}

main().catch(() => { console.error('Synthetic player verification failed.'); process.exitCode = 1; });
