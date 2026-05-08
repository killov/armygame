import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'armygame_session';
const EXPIRY_DAYS = 7;

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set');
    return new TextEncoder().encode(secret);
}

export async function createSession(userId: number, jmeno: string): Promise<string> {
    const token = await new SignJWT({ userId, jmeno })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${EXPIRY_DAYS}d`)
        .sign(getSecret());

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        maxAge: EXPIRY_DAYS * 24 * 60 * 60,
        sameSite: 'lax',
    });

    return token;
}

export async function getSession(): Promise<{ userId: number; jmeno: string } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, getSecret());
        const { userId, jmeno } = payload as { userId: number; jmeno: string };
        return { userId, jmeno };
    } catch {
        return null;
    }
}

export async function deleteSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
