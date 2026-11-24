import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from './lib/sessionToken';

// Jen hrubé síto nad podpisem JWT; existenci hráče v DB ověřuje až game/layout a zalozit-mesto.
export async function proxy(request: NextRequest) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token && (await verifySession(token))) return NextResponse.next();
    return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
    matcher: ['/game/:path*', '/zalozit-mesto'],
};
