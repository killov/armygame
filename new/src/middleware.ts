import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'armygame_session';

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET ?? 'armygame-super-secret-jwt-key-2024-change-in-prod';
    return new TextEncoder().encode(secret);
}

async function verifyToken(token: string): Promise<boolean> {
    try {
        await jwtVerify(token, getSecret());
        return true;
    } catch {
        return false;
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const isAuthenticated = token ? await verifyToken(token) : false;

    const isGameRoute = pathname.startsWith('/game');
    const isAuthRoute = pathname === '/login' || pathname === '/register';

    if (isGameRoute && !isAuthenticated) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthRoute && isAuthenticated) {
        return NextResponse.redirect(new URL('/game/mesto', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/game/:path*', '/login', '/register'],
};
