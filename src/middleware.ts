/**
 * Next.js Middleware
 * 
 * Handles route protection based on session cookie presence.
 * Actual session validation happens in server actions via getSession().
 * 
 * Note: We inline the cookie name here to avoid importing from session.ts
 * which uses Node.js crypto module (not available in Edge Runtime).
 */

import { NextResponse, type NextRequest } from 'next/server';

// Inline the session cookie name to avoid importing from session.ts
// (session.ts uses crypto which isn't available in Edge Runtime)
const SESSION_COOKIE_NAME = 'sls_session';

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    const pathname = request.nextUrl.pathname;

    // Define route categories
    const isDashboard = pathname.startsWith('/dashboard');

    // Redirect to login if no session and trying to access protected routes
    if (!sessionCookie && isDashboard) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Login redirects require database session validation in the login page.

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
         * - api routes that don't need auth
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
