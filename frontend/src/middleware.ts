import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware that handles the root "/" redirect BEFORE any HTML is
 * sent to the browser. This completely eliminates any flash because the
 * browser never receives the wrong page content.
 *
 * Strategy:
 * - Check for the presence of the refresh_token cookie (httpOnly, set by backend)
 * - If present → redirect to /dashboard (user is likely authenticated)
 * - If absent → redirect to /welcome (user is a visitor)
 *
 * This is a "best guess" based on cookie presence. The actual token validation
 * still happens client-side. If the cookie is stale/expired, the dashboard page
 * will handle it gracefully (show skeleton → redirect to /welcome after refresh fails).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept the root path
  if (pathname !== '/') {
    return NextResponse.next();
  }

  const hasRefreshToken = request.cookies.has('refresh_token');

  const url = request.nextUrl.clone();
  url.pathname = hasRefreshToken ? '/dashboard' : '/welcome';

  return NextResponse.redirect(url);
}

export const config = {
  // Only run middleware on the root path
  matcher: ['/'],
};
