import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { z } from 'zod';
import { getXpRequiredForLevel } from '../system/leveling';

const credentials = z.object({
    username: z.string().trim().min(1).max(50),
    password: z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72),
});

/** Create a playable account atomically. Never attaches an existing profile. */
export async function provisionPlayer(pool: Pick<Pool, 'connect'>, username: string, password: string): Promise<string> {
    const input = credentials.safeParse({ username, password });
    if (!input.success) throw new Error('Use a username of 1–50 characters and a password of at least 8 characters, at most 72 UTF-8 bytes.');
    const hash = await bcrypt.hash(input.data.password, 12);
    const userId = randomUUID();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('INSERT INTO public.users (id, username, password_hash) VALUES ($1, $2, $3)', [userId, input.data.username, hash]);
        await client.query(`INSERT INTO public.profiles
            (id, username, hunter_rank, hunter_class, level, current_xp, next_level_xp,
             gold_credits, current_hp, current_mana, available_ap, available_sp)
            VALUES ($1, $2, 'E', 'NONE', 1, 0, $3, 0, 260, 160, 0, 0)`,
            [userId, input.data.username, getXpRequiredForLevel(2)]);
        await client.query(`INSERT INTO public.hunter_stats
            (user_id, strength, agility, intelligence, vitality, perception, mana)
            VALUES ($1, 10, 10, 10, 10, 10, 160)`, [userId]);
        // Shared quests remain templates. Per-player state is owned by this ID.
        await client.query(`INSERT INTO public.user_quests (user_id, quest_id, status)
            SELECT $1, id, 'Available' FROM public.quests WHERE user_id IS NULL`, [userId]);
        await client.query('COMMIT');
        return userId;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally { client.release(); }
}
