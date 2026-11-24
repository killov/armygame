import { SignJWT, jwtVerify } from 'jose';

// Bez next/headers — sdílí ho proxy i lib/session.ts.

export const COOKIE_NAME = 'armygame_session';
export const SESSION_DAYS = 7;

export interface SessionPayload {
    userId: number;
    jmeno: string;
}

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set');
    return new TextEncoder().encode(secret);
}

export async function signSession({ userId, jmeno }: SessionPayload): Promise<string> {
    return new SignJWT({ userId, jmeno })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DAYS}d`)
        .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
    const secret = getSecret();
    try {
        const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
        if (typeof payload.userId !== 'number' || typeof payload.jmeno !== 'string') return null;
        return { userId: payload.userId, jmeno: payload.jmeno };
    } catch {
        return null;
    }
}
