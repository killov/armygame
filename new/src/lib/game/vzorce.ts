// Port herních vzorců z inc/classes/Mesto.php a User.php. Jména 1:1 s PHP metodami, ať jde
// vzorec dohledat grepem a test ho může porovnat s výsledkem předlohy.
import { HODNOTY, type BudovaId, type JednotkaId, type SurovinaId, type VyzkumId } from './data';

/** $cfg["speed"] z config.php */
export const RYCHLOST = 1;

export const SUROVINA_IDS = [1, 2, 3, 4] as const satisfies readonly SurovinaId[];
export const BUDOVA_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const satisfies readonly BudovaId[];
export const VYZKUM_IDS = [1, 2, 3, 4, 5] as const satisfies readonly VyzkumId[];
export const JEDNOTKA_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const satisfies readonly JednotkaId[];
/** Hladomor i spotřeba (Mesto::jednotky_spotreba) počítají jen pěchotu j1–j4. */
export const PECHOTA_IDS = [1, 2, 3, 4] as const satisfies readonly JednotkaId[];

/** Mesto::produkce — hodinová produkce suroviny při dané úrovni budovy. */
export function produkce(sur: SurovinaId, lvl: number): number {
  const p = HODNOTY.produkce[sur];
  return Math.round(p.zaklad * (lvl + 1) * p.nasobek ** lvl * RYCHLOST);
}

/** Mesto::sklad — kapacita skladu (b6). */
export function sklad(lvl: number): number {
  return Math.round(HODNOTY.sklad.zaklad * (lvl + 1) * HODNOTY.sklad.nasobek ** lvl);
}

/** User::banka — kapacita banky (b8). Předloha bere násobek ze skladu, ne z banky. */
export function banka(lvl: number): number {
  return Math.round(HODNOTY.banka.zaklad * (lvl + 1) * HODNOTY.sklad.nasobek ** lvl);
}

/** Mesto::budova_obyvatele */
export function budovaObyvatele(budova: BudovaId, lvl: number): number {
  if (lvl === 0) return 0;
  const b = HODNOTY.budovy[budova];
  return Math.round(b.spotreba_zaklad * b.spotreba_nasobek ** (lvl - 1));
}

/** Mesto::surovina — stav suroviny v čase `time`, oříznutý kapacitou skladu. */
export function surovina(pocet: number, produkce: number, zmena: number, sklad: number, time: number): number {
  return Math.min(Math.floor(pocet + (produkce * (time - zmena)) / 3600), sklad);
}

/** User::penize — peníze nad kapacitu banky propadají. */
export function penize(pocet: number, banka: number): number {
  return Math.min(pocet, banka);
}
