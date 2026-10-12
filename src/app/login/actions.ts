'use server';

import db from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { verifyPassword } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isIP } from 'node:net';
import { randomBytes } from 'node:crypto';
import { hashSync } from 'bcryptjs';
import { z } from 'zod';
import { safeAction } from '@/lib/action-utils';
import { takeLoginAttempt } from '@/lib/server/login-rate-limit';
import { AchievementManager } from '@/lib/achievement-manager';

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long'),
}).strict();
const dummyHash = hashSync(randomBytes(32).toString('hex'), 12);

/**
 * Login action - validates credentials and creates session
 */
export async function login(formData: FormData) {
  const response = await safeAction(credentialsSchema, {
    username: formData.get('username') as string,
    password: formData.get('password') as string,
  }, async ({ username, password }) => {
    let trustedClientIp: string | undefined;
    if (process.env.SLS_TRUST_PROXY_HEADERS === 'true') {
      const ip = (await headers()).get('x-real-ip');
      if (ip && isIP(ip)) trustedClientIp = ip;
    }
    if (!takeLoginAttempt(username, trustedClientIp)) {
      return { error: 'Too many login attempts. Please try again later.' };
    }
    // Query user from database
    const result = await db.query<{ id: string; username: string; password_hash: string }>(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    const user = result.rows[0];

    // Verify password
    // Unknown accounts receive the same bcrypt work as known accounts.
    const isValid = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!user || !isValid) {
      return { error: 'Invalid credentials' };
    }

    // Create session
    await createSession(user.id);

    // Login is the explicit lifecycle boundary for retroactive achievement
    // grants. Keep this work out of read-only profile rendering.
    try {
      await new AchievementManager().checkAchievements(user.id, 'LOGIN', {});
    } catch (error) {
      console.error('Failed to sync login achievements', error);
    }

    return { error: '' };
  });
  if (!response.success) return { error: 'Unable to log in. Check your credentials and try again.' };
  if (response.data?.error) return response.data;

  // Redirect to dashboard (outside try-catch because redirect throws)
  redirect('/dashboard');
}

/**
 * Logout action - destroys current session
 */
export async function logout() {
  const result = await safeAction(z.void(), undefined, () => destroySession());
  if (!result.success) return { error: 'Unable to log out. Please try again.' };
  redirect('/login');
}
