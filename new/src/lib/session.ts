import 'reflect-metadata';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { users } from '@prisma/client';
import { DatabaseService } from '../db/DatabaseService';
import { UserRepository } from '../repositories/UserRepository';
import { COOKIE_NAME, SESSION_DAYS, SessionPayload, signSession, verifySession } from './sessionToken';

export async function createSession(userId: number, jmeno: string): Promise<void> {
    const token = await signSession({ userId, jmeno });
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
        sameSite: 'lax',
    });
}

export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
}

/**
 * Platný JWT po resetu DB ukazuje na neexistujícího hráče — proto se ověřuje i proti DB.
 * cache(): layout i stránka v rámci jednoho requestu sdílí jeden dotaz.
 */
export const getCurrentUser = cache(async (): Promise<users | null> => {
    const session = await getSession();
    if (!session) return null;
    return new UserRepository(new DatabaseService()).getById(session.userId);
});

export async function deleteSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
