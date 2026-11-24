import { HODNOTY } from './game/data';
import { nazevBudovy } from './game/lang';

export interface BudovaConfig {
  nazev: string;
  surovina1: number;
  surovina2: number;
  nasobek: number;
  cas: number;
  casNasobek: number;
  maximum: number;
  pozadavky: Record<number, number>;
}

export const BUDOVY: Record<number, BudovaConfig> = Object.fromEntries(
  Object.entries(HODNOTY.budovy).map(([id, b]) => [
    id,
    {
      nazev: nazevBudovy(Number(id)),
      surovina1: b.surovina1,
      surovina2: b.surovina2,
      nasobek: b.nasobek,
      cas: b.cas,
      casNasobek: b.cas_nasobek,
      maximum: b.maximum,
      pozadavky: b.pozadavky,
    },
  ]),
);

export const PRODUKCE_BASE = HODNOTY.produkce[1].zaklad;
export const PRODUKCE_NASOBEK = HODNOTY.produkce[1].nasobek;
export const SKLAD_BASE = HODNOTY.sklad.zaklad;
export const SKLAD_NASOBEK = HODNOTY.sklad.nasobek;

/** Produkce dané suroviny za hodinu pro daný level budovy */
export function produkce(level: number): number {
  return Math.floor(PRODUKCE_BASE * Math.pow(PRODUKCE_NASOBEK, level));
}

/** Kapacita skladu pro daný level b6 */
export function skladKapacita(b6Level: number): number {
  return Math.floor(SKLAD_BASE * Math.pow(SKLAD_NASOBEK, b6Level));
}

/** Cena upgradu budovy na nový level (currentLevel -> currentLevel+1) */
export function getBuildingUpgradeCost(
  buildingId: number,
  currentLevel: number
): { surovina1: number; surovina2: number } {
  const b = BUDOVY[buildingId];
  if (!b) throw new Error(`Neznámá budova: ${buildingId}`);
  return {
    surovina1: Math.floor(b.surovina1 * Math.pow(b.nasobek, currentLevel)),
    surovina2: Math.floor(b.surovina2 * Math.pow(b.nasobek, currentLevel)),
  };
}

/** Čas stavby v sekundách pro upgrade na nový level */
export function getBuildingTime(buildingId: number, currentLevel: number): number {
  const b = BUDOVY[buildingId];
  if (!b) throw new Error(`Neznámá budova: ${buildingId}`);
  return Math.floor(b.cas * Math.pow(b.casNasobek, currentLevel));
}
