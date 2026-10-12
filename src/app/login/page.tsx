import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-utils';
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
    if (await getCurrentUser()) redirect('/dashboard');
    return <LoginClient />;
}