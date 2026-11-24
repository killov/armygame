import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signSession, verifySession } from './sessionToken';

describe('sessionToken', () => {
    beforeEach(() => vi.stubEnv('JWT_SECRET', 'test-secret'));
    afterEach(() => vi.unstubAllEnvs());

    it('roundtrip', async () => {
        const token = await signSession({ userId: 7, jmeno: 'Pepa' });
        expect(await verifySession(token)).toEqual({ userId: 7, jmeno: 'Pepa' });
    });

    it('odmítne token podepsaný cizím secretem', async () => {
        const token = await new SignJWT({ userId: 7, jmeno: 'Pepa' })
            .setProtectedHeader({ alg: 'HS256' })
            .sign(new TextEncoder().encode('jiny-secret'));
        expect(await verifySession(token)).toBeNull();
        expect(await verifySession('nesmysl')).toBeNull();
    });

    it('odmítne payload se špatnými typy', async () => {
        const token = await new SignJWT({ userId: '7', jmeno: 'Pepa' })
            .setProtectedHeader({ alg: 'HS256' })
            .sign(new TextEncoder().encode('test-secret'));
        expect(await verifySession(token)).toBeNull();
    });

    it('bez JWT_SECRET hází, žádný fallback', async () => {
        vi.stubEnv('JWT_SECRET', '');
        await expect(signSession({ userId: 1, jmeno: 'x' })).rejects.toThrow('JWT_SECRET');
        await expect(verifySession('x')).rejects.toThrow('JWT_SECRET');
    });
});
