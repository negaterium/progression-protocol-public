/**
 * Authentication Utilities
 * 
 * Session-based authentication for Progression Protocol.
 * Managed via direct PostgreSQL session management.
 */

import { getSession } from './session';
import bcrypt from 'bcryptjs';
import db from './db';
import { z } from 'zod';

/**
 * Authenticated user object
 */
export interface AuthenticatedUser {
    id: string;
    username: string;
}

/**
 * Gets the authenticated user from the current session
 * Throws an error if not authenticated (use in protected actions)
 * 
 * @returns The authenticated user
 * @throws Error if no valid session exists
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
    const isDevAuth = process.env.NODE_ENV === 'development' && process.env.SLS_ENABLE_DEV_AUTH === 'true';
    const devUserId = z.string().uuid().safeParse(process.env.SLS_DEV_USER_ID);

    // DEV AUTH OVERRIDE
    if (isDevAuth && devUserId.success) {
        // Verify user exists in DB to avoid ghost user issues
        const devUser = await db.queryOne<{ id: string, username: string }>(
            "SELECT id, username FROM profiles WHERE id = $1",
            [devUserId.data]
        );

        if (devUser) {
            return {
                id: devUser.id,
                username: devUser.username
            };
        } else {
            console.warn('[Auth] Development user not found. Falling back to session.');
        }
    }

    const session = await getSession();

    if (!session) {
        throw new Error('Authentication required. Please log in.');
    }

    return {
        id: session.user_id,
        username: session.username,
    };
}

/**
 * Gets the current user if authenticated, or null if not
 * Does not throw - use for optional authentication scenarios
 * 
 * @returns The user or null
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
    const session = await getSession();

    if (!session) {
        return null;
    }

    return {
        id: session.user_id,
        username: session.username,
    };
}

/**
 * Check if the current request is authenticated
 * Lightweight check - use for quick auth status
 * 
 * @returns boolean indicating if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const session = await getSession();
    return session !== null;
}

// =============================================================================
// Password Hashing Utilities
// =============================================================================

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 * @param password Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password Plain text password to verify
 * @param hashedPassword Stored hash to compare against
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

/**
 * Validate password strength
 * @param password Password to validate
 * @returns Object with valid status and optional error message
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
    if (Buffer.byteLength(password, 'utf8') > 72) return { valid: false, error: 'Password must be at most 72 bytes long' };
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    // Optional: Add more validation rules
    // - At least one uppercase letter
    // - At least one number
    // - At least one special character

    return { valid: true };
}
