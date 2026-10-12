/**
 * Session Management Module
 * 
 * Cookie-based session authentication for Progression Protocol.
 * Sessions are stored in PostgreSQL and referenced by a secure HTTP-only cookie.
 * 
 * Session duration: 30 days for newly created or renewed sessions.
 */

import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import db from './db';
import { z } from 'zod';

// Session configuration
const SESSION_COOKIE_NAME = 'sls_session';
const SESSION_DURATION_DAYS = 30;
const uuidSchema = z.string().uuid();

function shouldSecureCookies(): boolean {
    return process.env.USE_SECURE_COOKIES === 'true'
        || (process.env.NODE_ENV === 'production' && process.env.USE_SECURE_COOKIES !== 'false');
}

/**
 * Session data returned from getSession
 */
export interface SessionData {
    id: string;
    user_id: string;
    username: string;
    expires_at: Date;
    created_at: Date;
}

/**
 * Create a new session for a user
 * @param userId The user's UUID
 * @returns The session ID
 */
export async function createSession(userId: string): Promise<string> {
    uuidSchema.parse(userId);
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Insert session into database
    await db.query(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
        [sessionId, userId, expiresAt]
    );

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: shouldSecureCookies(),
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
    });

    return sessionId;
}

/**
 * Get the current session from cookies
 * Validates the session exists and hasn't expired
 * @returns Session data with user info, or null if not authenticated
 */
export async function getSession(): Promise<SessionData | null> {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

        if (!uuidSchema.safeParse(sessionId).success) {
            return null;
        }

        // Query session with user data
        const result = await db.query<SessionData>(
            `SELECT s.id, s.user_id, s.expires_at, s.created_at, u.username
             FROM sessions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1 AND s.expires_at > NOW()`,
            [sessionId]
        );

        if (result.rows.length === 0) {
            // Session expired or doesn't exist.
            // NOTE: We intentionally do NOT delete the cookie here because cookie mutation
            // is only allowed in Server Actions/Route Handlers (not during SSR rendering).
            // The stale cookie is harmless — it won't match any valid DB session.
            return null;
        }

        return result.rows[0];
    } catch (error) {
        console.error('[Session] Error getting session:', error);
        return null;
    }
}

/**
 * Check if a session exists (lightweight check for middleware)
 * Only checks cookie presence, not database validity
 * @returns boolean indicating if session cookie exists
 */
export async function hasSessionCookie(): Promise<boolean> {
    const cookieStore = await cookies();
    return !!cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Destroy the current session (logout)
 * Removes from database and clears cookie
 */
export async function destroySession(): Promise<void> {
    try {
        const cookieStore = await cookies();
        const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

        if (sessionId) {
            // Delete from database
            await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
        }

        // Always clear the cookie
        cookieStore.delete(SESSION_COOKIE_NAME);
    } catch (error) {
        console.error('[Session] Error destroying session:', error);
        // Still try to delete the cookie even if DB delete fails
        const cookieStore = await cookies();
        cookieStore.delete(SESSION_COOKIE_NAME);
    }
}

/**
 * Extend the current session's expiration
 * Useful for "keep me logged in" functionality
 * @returns true if session was extended, false otherwise
 */
export async function extendSession(): Promise<boolean> {
    try {
        const session = await getSession();
        if (!session) return false;
        const cookieStore = await cookies();
        const sessionId = session.id;

        if (!sessionId) {
            return false;
        }

        const newExpiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

        // Update database
        const result = await db.query(
            'UPDATE sessions SET expires_at = $1 WHERE id = $2 AND user_id = $3 AND expires_at > NOW() RETURNING id',
            [newExpiresAt, sessionId, session.user_id]
        );

        if (result.rowCount === 0) {
            return false;
        }

        // Update cookie
        cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
            httpOnly: true,
            secure: shouldSecureCookies(),
            sameSite: 'lax',
            expires: newExpiresAt,
            path: '/',
        });

        return true;
    } catch (error) {
        console.error('[Session] Error extending session:', error);
        return false;
    }
}

/**
 * Get all active sessions for a user
 * Useful for "manage sessions" feature
 * @param userId The user's UUID
 * @returns Array of sessions
 */
export async function getUserSessions(userId: string): Promise<Array<{
    id: string;
    created_at: Date;
    expires_at: Date;
}>> {
    const result = await db.query<{ id: string; created_at: Date; expires_at: Date }>(
        'SELECT id, created_at, expires_at FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}

/**
 * Destroy all sessions for a user (logout everywhere)
 * @param userId The user's UUID
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/**
 * Session cookie name (exported for middleware use)
 */
export const SESSION_COOKIE = SESSION_COOKIE_NAME;
