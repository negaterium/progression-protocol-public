import { revalidatePath } from "next/cache";
import { calculateEliteLimit, calculateStorageLimit } from "@/lib/game-logic/shadow-limits";
import type { AuthenticatedUser } from "@/lib/auth-utils";
import { gameDb as db, withGameTransaction } from "./game-db";

// Configuration
const REQUIRED_CLASS = 'Necromancer';
const REQUIRED_LEVEL = 40;

export async function extractShadow(user: AuthenticatedUser, { bossId, source }: { bossId?: string, source: 'BOSS' | 'DUNGEON' }) {
    return withGameTransaction(user.id, async () => {

        // 1. Validation: Class & Level
        const profile = await db.queryOne<{ hunter_class: string, level: number, shadow_infantry_count: number, intelligence: number, shadow_storage_limit: number }>(
            `SELECT p.hunter_class, p.level, p.shadow_infantry_count, p.shadow_storage_limit, s.intelligence
             FROM profiles p
             JOIN hunter_stats s ON p.id = s.user_id
             WHERE p.id = $1`,
            [user.id]
        );

        if (!profile || profile.hunter_class !== REQUIRED_CLASS || profile.level < REQUIRED_LEVEL) {
            return { success: false, reason: "NOT_QUALIFIED" };
        }

        // 2. Logic Split
        if (source === 'BOSS' && bossId) {
            // --- BOSS EXTRACTION ---
            const boss = await db.queryOne<{ name: string, rank: string, required_level: number }>(
                "SELECT name, rank, required_level FROM bosses WHERE id = $1",
                [bossId]
            );

            if (!boss) throw new Error("Boss not found");

            const existing = await db.queryOne(
                "SELECT id FROM shadows WHERE user_id = $1 AND boss_id = $2",
                [user.id, bossId]
            );

            if (existing) {
                await db.query("UPDATE shadows SET level = level + 1, xp = xp + 100 WHERE id = $1", [existing.id]);
                return { success: true, type: 'UPGRADE', name: boss.name };
            } else {
                // CHECK ELITE LIMIT BEFORE SUMMONING
                const currentElites = await db.queryOne<{ count: string }>(
                    "SELECT COUNT(*) as count FROM shadows WHERE user_id = $1 AND boss_id IS NOT NULL AND status = 'SUMMONED'",
                    [user.id]
                );
                const activeCount = parseInt(currentElites?.count || '0');
                const eliteLimit = calculateEliteLimit(profile.level, profile.intelligence || 0);

                // Auto-Store if full
                const initialStatus = activeCount >= eliteLimit ? 'STORED' : 'SUMMONED';

                await db.query(`
                    INSERT INTO shadows (user_id, boss_id, name, rank, level, status, stats)
                    VALUES ($1, $2, $3, $4, 1, $5, $6)
                `, [
                    user.id,
                    bossId,
                    boss.name,
                    boss.rank,
                    initialStatus,
                    JSON.stringify({ str: 20, agi: 20, int: 20, vit: 20, per: 20 })
                ]);
                revalidatePath('/dashboard');
                return { success: true, type: 'NEW_BOSS', name: boss.name, status: initialStatus };
            }
        } else {
            // --- INFANTRY EXTRACTION ---
            const chance = Math.min(50, 10 + (profile.intelligence || 0) * 0.1);
            const roll = Math.random() * 100;

            if (roll <= chance) {
                // Use DB limit, fallback to calculation if 0 (migration safety)
                const storageLimit = profile.shadow_storage_limit || calculateStorageLimit(profile.level);

                if (profile.shadow_infantry_count >= storageLimit) {
                    return { success: false, reason: "STORAGE_FULL" };
                }

                await db.query(
                    "UPDATE profiles SET shadow_infantry_count = shadow_infantry_count + 1 WHERE id = $1",
                    [user.id]
                );

                revalidatePath('/dashboard');
                return { success: true, type: 'INFANTRY' };
            }

            return { success: false, reason: "FAILED_ROLL" };
        }
    });
}
