// Port validací z inc/login/post/register.php, login.php a inc/zalozitmestopost.php.
// Funkce vrací PHP kódy chyb (0 = OK), texty se k nim berou z LANG přes *_LANG tabulky.
// Délky se počítají ve znacích (VARCHAR), ne v bajtech jako PHP strlen — vědomá odchylka.

export type RegistraceChyby = [number, number, number, number];

export interface RegistraceInput {
    jmeno: string;
    email: string;
    heslo: string;
    hesloZnovu: string;
}

export interface RegistraceExistence {
    jmenoExistuje: boolean;
    emailExistuje: boolean;
}

/** Kód chyby → index LANG, per pole registrace (chyba0–chyba3 v inc/login/register.php). */
export const REGISTRACE_LANG: readonly (readonly number[])[] = [
    [0, 7, 8, 9],
    [0, 7, 10, 11, 12],
    [0, 7, 13],
    [0, 7, 14],
];
export const LOGIN_LANG: readonly number[] = [0, 7, 17];
export const JMENO_MESTA_LANG: readonly number[] = [0, 7, 8];
/** Kód nad rámec PHP (tam se `while(1)` zacyklí) — LANG pro něj text nemá. */
export const CHYBA_NENI_VOLNE_POLE = 3;

export const JMENO_MAX = 20;
export const EMAIL_MAX = 30;
export const HESLO_MIN = 4;

/** PHP empty() na řetězci z $_POST: "" i "0". */
function phpEmpty(value: string): boolean {
    return value === '' || value === '0';
}

function delka(value: string): number {
    return [...value].length;
}

const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const EMAIL_LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;

/** Aproximace PHP FILTER_VALIDATE_EMAIL: local@domena.tld, bez mezer a dvou teček za sebou. */
export function isValidEmail(email: string): boolean {
    const at = email.lastIndexOf('@');
    if (at <= 0) return false;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (local.length > 64 || !EMAIL_LOCAL.test(local)) return false;
    const labels = domain.split('.');
    if (labels.length < 2 || !labels.every((l) => l.length <= 63 && EMAIL_LABEL.test(l))) return false;
    return /^[A-Za-z]{2,}$/.test(labels[labels.length - 1]);
}

export function validujRegistraci(input: RegistraceInput, existence: RegistraceExistence): RegistraceChyby {
    const jmeno = input.jmeno.trim();
    const chyby: RegistraceChyby = [0, 0, 0, 0];

    if (phpEmpty(jmeno)) chyby[0] = 1;
    else if (delka(jmeno) > JMENO_MAX) chyby[0] = 2;
    else if (existence.jmenoExistuje) chyby[0] = 3;

    if (phpEmpty(input.email)) chyby[1] = 1;
    else if (delka(input.email) > EMAIL_MAX) chyby[1] = 2;
    else if (!isValidEmail(input.email)) chyby[1] = 3;
    else if (existence.emailExistuje) chyby[1] = 4;

    if (phpEmpty(input.heslo)) chyby[2] = 1;
    else if (delka(input.heslo) < HESLO_MIN) chyby[2] = 2;

    if (phpEmpty(input.hesloZnovu)) chyby[3] = 1;
    else if (input.heslo !== input.hesloZnovu) chyby[3] = 2;

    return chyby;
}

export function bezChyb(chyby: readonly number[]): boolean {
    return chyby.every((c) => c === 0);
}

/** 0 = jméno vyplněné, o správnosti hesla rozhoduje až DB (kód 2). */
export function validujLogin(jmeno: string): number {
    return phpEmpty(jmeno) ? 1 : 0;
}

export function validujJmenoMesta(jmeno: string): number {
    const trimmed = jmeno.trim();
    if (phpEmpty(trimmed)) return 1;
    if (delka(trimmed) > JMENO_MAX) return 2;
    return 0;
}
