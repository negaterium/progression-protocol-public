import { gameDb as db } from "@/lib/server/game-db";

/**
 * Logs a transaction or significant event to the audit_logs table.
 * Targeted for Gold and XP changes to detect exploits.
 */
export async function logTransaction(
    userId: string,
    action: string,
    changes: {
        gold?: number;
        xp?: number;
        hp?: number;
        mana?: number;
        sp?: number;
    },
    metadata?: Record<string, unknown>
) {
    try {
        // Fire-and-forget pattern
        // We use the singleton db pool which is efficient

        const payload = {
            user_id: userId,
            action_type: action,
            diff_gold: changes.gold || 0,
            diff_xp: changes.xp || 0,
            diff_hp: changes.hp || 0,
            metadata: metadata || {}
        };

        await db.query(`
            INSERT INTO audit_logs (user_id, action_type, diff_gold, diff_xp, diff_hp, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            payload.user_id,
            payload.action_type,
            payload.diff_gold,
            payload.diff_xp,
            payload.diff_hp,
            payload.metadata
        ]);

    } catch (err) {
        console.error("[AuditLog] Exception:", err);
    }
}
