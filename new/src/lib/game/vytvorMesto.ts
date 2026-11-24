// Port Mesto::vytvor_mesto a opravhranice (inc/classes/Mesto.php). Čisté funkce bez DB,
// dotazy na volné pole a RNG se injektují kvůli testům.

import type { Prisma, mesto } from '@prisma/client';
import { HODNOTY, type SurovinaId } from './data';
import { mathRand, type RandFn } from './mapGen';

/** $cfg["speed"] z config.php. */
export const SPEED = 1;

/** 0 = SV, 1 = JV, 2 = JZ, 3 = SZ (LANG 21–24), 4 = náhodně. */
export type Smer = 0 | 1 | 2 | 3;

export const MAX_POKUSU = 100_000;

/** 4 → rand(0,3); cokoli mimo 1–3 padá v PHP do else větve, tj. SV. */
export function normalizujSmer(smer: number, rand: RandFn = mathRand): Smer {
    const s = smer === 4 ? rand(0, 3) : smer;
    return s === 1 || s === 2 || s === 3 ? s : 0;
}

/** WHERE pro SELECT COUNT(*) FROM mesto podle kvadrantu; hranice (> vs >=) přesně jako PHP. */
export function kvadrantWhere(smer: Smer): Prisma.mestoWhereInput {
    switch (smer) {
        case 1:
            return { x: { gt: 0 }, y: { lt: 0 }, typ: 1 };
        case 2:
            return { x: { lt: 0 }, y: { lt: 0 }, typ: 1 };
        case 3:
            return { x: { lt: 0 }, y: { gt: 0 }, typ: 1 };
        default:
            return { x: { gte: 0 }, y: { gte: 0 }, typ: 1 };
    }
}

/** Hledání vyčerpalo maxPokusu — action to ukáže ve formuláři místo 500. */
export class NeniVolnePoleError extends Error {
    override name = 'NeniVolnePoleError';
}

export interface VolnePole<T> {
    x: number;
    y: number;
    pole: T;
}

/**
 * Kandidáti leží na kružnici o poloměru √(10·počet+1) kolem [0,0]; po 51 neúspěších se
 * rozsah x rozšíří. Kandidát s x² > vz dá v PHP NAN, dotaz nic nenajde — tady se do DB nejde vůbec.
 *
 * Vědomá odchylka od PHP: s rozsahem x roste i poloměr (vz = vzd²). PHP zvětšuje jen vzd, takže
 * při obsazené kružnici dávají nová x jen NAN a `while(1)` se zacyklí. Typicky JV/JZ/SZ při
 * počtu 0 — kvadrant v COUNT(*) má ostré nerovnosti, města na osách se nepočítají a vz zůstává 1.
 */
export async function najdiVolnePole<T>(
    smer: Smer,
    pocet: number,
    isFree: (x: number, y: number) => Promise<T | null>,
    rand: RandFn = mathRand,
    maxPokusu: number = MAX_POKUSU,
): Promise<VolnePole<T>> {
    let vz = 10 * pocet + 1;
    let vzd = Math.ceil(Math.sqrt(vz));
    let bod = 0;

    for (let pokus = 0; pokus < maxPokusu; pokus++) {
        if (bod > 50) {
            vzd++;
            vz = vzd * vzd;
            bod = 0;
        }
        let x = rand(0, vzd);
        let y = Math.round(Math.sqrt(vz - x * x));
        if (smer === 1) {
            y = -y;
        } else if (smer === 2) {
            x = -x;
            y = -y;
        } else if (smer === 3) {
            x = -x;
        }

        if (!Number.isNaN(y)) {
            // Negace nuly dává -0; ven ho nepouštět.
            x = x + 0;
            y = y + 0;
            const pole = await isFree(x, y);
            if (pole !== null) return { x, y, pole };
        }
        bod++;
    }
    throw new NeniVolnePoleError(`najdiVolnePole: no free field after ${maxPokusu} attempts (smer ${smer}, pocet ${pocet})`);
}

export interface HraniceSoused {
    dx: number;
    dy: number;
    add: number;
}

const TOP: HraniceSoused = { dx: 0, dy: 1, add: 2 };
const BOT: HraniceSoused = { dx: 0, dy: -1, add: 8 };
const LEFT: HraniceSoused = { dx: -1, dy: 0, add: 1 };
const RIGHT: HraniceSoused = { dx: 1, dy: 0, add: 4 };

/** switch($h) z Mesto::opravhranice: kterým sousedům se k hranici přičte bit. Jiné h nic. */
export const HRANICE_SOUSEDE: Readonly<Record<number, readonly HraniceSoused[]>> = {
    0: [TOP, BOT, LEFT, RIGHT],
    1: [TOP, BOT, LEFT],
    2: [TOP, LEFT, RIGHT],
    3: [TOP, LEFT],
    4: [TOP, BOT, RIGHT],
    5: [TOP, BOT],
    6: [TOP, RIGHT],
    7: [TOP],
    8: [BOT, LEFT, RIGHT],
    9: [BOT, LEFT],
    10: [LEFT, RIGHT],
    11: [LEFT],
    12: [BOT, RIGHT],
    13: [BOT],
    14: [RIGHT],
};

/** Mesto::produkce — jiný vzorec než gameData.produkce (ta zůstává, mimo scope). */
export function produkceSuroviny(sur: SurovinaId, lvl: number): number {
    const { zaklad, nasobek } = HODNOTY.produkce[sur];
    return Math.round(zaklad * (lvl + 1) * nasobek ** lvl * SPEED);
}

export function sklad(lvl: number): number {
    return Math.round(HODNOTY.sklad.zaklad * (lvl + 1) * HODNOTY.sklad.nasobek ** lvl);
}

/** User::banka — násobek bere ze skladu, převzato 1:1 z PHP. */
export function banka(lvl: number): number {
    return Math.round(HODNOTY.banka.zaklad * (lvl + 1) * HODNOTY.sklad.nasobek ** lvl);
}

export interface NoveMestoInput {
    poleId: number;
    x: number;
    y: number;
    jmeno: string;
    userId: number;
    userjmeno: string;
    now: number;
}

/**
 * Řádek mesto pro nové město; MySQL strict bez defaultů, proto všechny sloupce.
 * Jméno raw — PHP ho htmlspecialchars-uje, React escapuje při renderu sám.
 */
export function noveMestoData({ poleId, x, y, jmeno, userId, userjmeno, now }: NoveMestoInput): mesto {
    return {
        id: poleId,
        x,
        y,
        typ: 1,
        stat: 0,
        statjmeno: '',
        user: userId,
        userjmeno,
        jmeno,
        surovina1: 1000,
        surovina1_produkce: produkceSuroviny(1, 0),
        surovina2: 1000,
        surovina2_produkce: produkceSuroviny(2, 0),
        surovina3: 1000,
        surovina3_produkce: produkceSuroviny(3, 0),
        surovina4: 1000,
        surovina4_produkce: produkceSuroviny(4, 0),
        suroviny_time: now,
        sklad: sklad(0),
        populace: 2,
        b1: 1,
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
    };
}
