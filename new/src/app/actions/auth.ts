'use server';

import 'reflect-metadata';
import { createHash } from 'crypto';
import { redirect } from 'next/navigation';
import { DatabaseService } from '../../db/DatabaseService';
import { UserRepository } from '../../repositories/UserRepository';
import { MestoRepository } from '../../repositories/MestoRepository';
import { UserService } from '../../services/UserService';
import { createSession, deleteSession } from '../../lib/session';

function buildServices() {
    const db = new DatabaseService();
    const userRepo = new UserRepository(db);
    const mestoRepo = new MestoRepository(db);
    const userService = new UserService(userRepo, mestoRepo);
    return { userService, mestoRepo, userRepo };
}

function md5(value: string): string {
    return createHash('md5').update(value).digest('hex');
}

export async function loginAction(formData: FormData): Promise<{ error: string } | never> {
    const jmeno = (formData.get('jmeno') as string | null)?.trim() ?? '';
    const password = (formData.get('password') as string | null) ?? '';

    try {
        const { userService } = buildServices();
        const user = await userService.getUserByUsername(jmeno);
        if (!user) {
            return { error: 'Uživatel neexistuje.' };
        }

        const hashedPassword = md5(password);
        if (user.heslo !== hashedPassword) {
            return { error: 'Nesprávné heslo.' };
        }

        await createSession(user.id, user.jmeno);
    } catch (err) {
        console.error('loginAction error:', err);
        return { error: 'Chyba při přihlášení. Zkuste to znovu.' };
    }

    redirect('/game/mesto');
}

export async function registerAction(formData: FormData): Promise<{ error: string } | never> {
    const jmeno = (formData.get('jmeno') as string | null)?.trim() ?? '';
    const mestoJmeno = (formData.get('mesto') as string | null)?.trim() ?? '';
    const email = (formData.get('email') as string | null)?.trim() ?? '';
    const password = (formData.get('password') as string | null) ?? '';
    const passwordConfirm = (formData.get('passwordConfirm') as string | null) ?? '';

    if (!jmeno || !mestoJmeno || !email || !password) {
        return { error: 'Vyplňte všechna povinná pole.' };
    }

    if (password !== passwordConfirm) {
        return { error: 'Hesla se neshodují.' };
    }

    try {
        const { userRepo, mestoRepo } = buildServices();

        const existing = await userRepo.getByJmeno(jmeno);
        if (existing) {
            return { error: 'Hráč s tímto jménem již existuje.' };
        }

        const hashedPassword = md5(password);

        const user = await userRepo.create({
            jmeno,
            heslo: hashedPassword,
            email,
            mesto: 0,
            pop: 0,
            mest: 0,
            poradi: 0,
            zprava: 0,
            stat: 0,
            statjmeno: '',
            sp_all: 0,
            penize: 0,
            v1: 0,
            v2: 0,
            v3: 0,
            v4: 0,
            v5: 0,
            banka: 0,
        } as never);

        const now = Math.floor(Date.now() / 1000);

        await mestoRepo.create({
            x: 50,
            y: 50,
            typ: 1,
            stat: 0,
            statjmeno: '',
            user: user.id,
            userjmeno: jmeno,
            jmeno: mestoJmeno,
            surovina1: 2000,
            surovina2: 2000,
            surovina3: 2000,
            surovina4: 2000,
            surovina1_produkce: 100,
            surovina2_produkce: 100,
            surovina3_produkce: 100,
            surovina4_produkce: 100,
            suroviny_time: now,
            sklad: 1000,
            populace: 10,
            b1: 0,
            b2: 0,
            b3: 0,
            b4: 0,
            b5: 0,
            b6: 0,
            b7: 0,
            b8: 0,
            b9: 0,
            b10: 0,
            b11: 0,
            v1: 0,
            v2: 0,
            v3: 0,
            v4: 0,
            v5: 0,
            v6: 0,
            v7: 0,
            v8: 0,
            j1: 0,
            j2: 0,
            j3: 0,
            j4: 0,
            j5: 0,
            j6: 0,
            j7: 0,
            j8: 0,
            smrt: 0,
        } as never);

        await createSession(user.id, user.jmeno);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('registerAction error:', msg);
        return { error: `Chyba při registraci: ${msg}` };
    }

    redirect('/game/mesto');
}

export async function logoutAction(): Promise<never> {
    await deleteSession();
    redirect('/login');
}
