// Čisté porty výpočtů herního rámu: Mesto::surovina, User::penize (inc/classes), cas() z www/js/script.js
// a validace přejmenování města z inc/hra/post/rename.php.

import { validujJmenoMesta } from '../auth/validace';

/** Mesto::surovina — floor stavu k času `time` (s), pak strop skladem. */
export function surovina(pocet: number, produkce: number, zmena: number, sklad: number, time: number): number {
    return Math.min(Math.floor(pocet + (produkce * (time - zmena)) / 3600), sklad);
}

/** User::penize — peníze nad kapacitu banky se nezobrazují ani neutrácí. */
export function penize(pocet: number, banka: number): number {
    return Math.min(pocet, banka);
}

/** Strop automatického obnovení rámu (s), Mesto::refresh_time. */
export const REFRESH_MAX = 300;

/** Mesto::refresh_time — za kolik sekund se má rám obnovit: nejbližší akce města, nejvýš 5 minut. */
export function refreshCas(nejblizsiAkce: number | null, now: number): number {
    return nejblizsiAkce === null ? REFRESH_MAX : Math.min(nejblizsiAkce - now, REFRESH_MAX);
}

function dveCislice(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

/** cas() ze script.js — hh:mm:ss, hodiny jako originál přetečou přes 24 (h % 24). */
export function cas(sekundy: number): string {
    const h = Math.floor(sekundy / 3600) % 24;
    const m = Math.floor((sekundy % 3600) / 60);
    const s = sekundy % 60;
    return `${dveCislice(h)}:${dveCislice(m)}:${dveCislice(s)}`;
}

/** PHP strip_tags pro jednoduchý text: zahodí `<...>` i neuzavřený tag až do konce. */
export function stripTags(value: string): string {
    return value.replace(/<[^>]*(>|$)/g, '');
}

/** rename.php: trim(strip_tags()) a délka 1–20 znaků; kód chyby jako validujJmenoMesta (1 prázdné, 2 dlouhé). */
export function validujPrejmenovani(vstup: string): { chyba: number; jmeno: string } {
    const jmeno = stripTags(vstup).trim();
    return { chyba: validujJmenoMesta(jmeno), jmeno };
}
