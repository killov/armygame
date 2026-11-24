'use server';

import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { DatabaseService } from '../../db/DatabaseService';
import { UserRepository } from '../../repositories/UserRepository';
import { MestoRepository } from '../../repositories/MestoRepository';
import { UserService } from '../../services/UserService';
import { createSession, deleteSession } from '../../lib/session';
import {
    RegistraceChyby,
    bezChyb,
    validujLogin,
    validujRegistraci,
} from '../../lib/auth/validace';

/** Kód chyby jako PHP inc/login/post/login.php (0 / 1 prázdné / 2 špatné jméno nebo heslo). */
export interface LoginState {
    chyba: number;
    jmeno: string;
}

/** Jméno a e-mail se vrací zpět, ať je reset formuláře po action nesmaže (hesla ne). */
export interface RegistraceState {
    chyby: RegistraceChyby;
    jmeno: string;
    email: string;
}

function buildServices() {
    const db = new DatabaseService();
    const userRepo = new UserRepository(db);
    const mestoRepo = new MestoRepository(db);
    const userService = new UserService(userRepo, mestoRepo);
    return { userService, userRepo };
}

function field(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
    const jmeno = field(formData, 'jmeno').trim();
    const heslo = field(formData, 'heslo');

    const chyba = validujLogin(jmeno);
    if (chyba !== 0) return { chyba, jmeno };

    const { userService } = buildServices();
    const user = await userService.login(jmeno, heslo);
    if (!user) return { chyba: 2, jmeno };

    await createSession(user.id, user.jmeno);
    // Bez města pošle /game layout dál na /zalozit-mesto.
    redirect('/game');
}

export async function registerAction(_prev: RegistraceState, formData: FormData): Promise<RegistraceState> {
    const input = {
        jmeno: field(formData, 'jmeno'),
        email: field(formData, 'email'),
        heslo: field(formData, 'heslo'),
        hesloZnovu: field(formData, 'heslo_znovu'),
    };
    const jmeno = input.jmeno.trim();

    // Do DB se sahá jen pro pole, která prošla formální validací.
    const formalni = validujRegistraci(input, { jmenoExistuje: false, emailExistuje: false });
    const { userRepo, userService } = buildServices();
    const [jmenoUser, emailUser] = await Promise.all([
        formalni[0] === 0 ? userRepo.getByJmeno(jmeno) : null,
        formalni[1] === 0 ? userRepo.getByEmail(input.email) : null,
    ]);
    const chyby = validujRegistraci(input, {
        jmenoExistuje: jmenoUser !== null,
        emailExistuje: emailUser !== null,
    });
    if (!bezChyb(chyby)) return { chyby, jmeno: input.jmeno, email: input.email };

    const user = await userRepo.create({
        jmeno,
        heslo: await userService.hashPassword(input.heslo),
        email: input.email,
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
    });

    await createSession(user.id, user.jmeno);
    redirect('/zalozit-mesto');
}

export async function logoutAction(): Promise<never> {
    await deleteSession();
    redirect('/');
}
