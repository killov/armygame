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

export const BUDOVY: Record<number, BudovaConfig> = {
  1: {
    nazev: 'Hlavní budova',
    surovina1: 100,
    surovina2: 85,
    nasobek: 1.4,
    cas: 80,
    casNasobek: 1.5,
    maximum: 30,
    pozadavky: {},
  },
  2: {
    nazev: 'Stavebniny',
    surovina1: 50,
    surovina2: 40,
    nasobek: 1.6,
    cas: 40,
    casNasobek: 1.5,
    maximum: 30,
    pozadavky: {},
  },
  3: {
    nazev: 'Železné doly',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 38,
    casNasobek: 1.5,
    maximum: 30,
    pozadavky: {},
  },
  4: {
    nazev: 'Ropné doly',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 39,
    casNasobek: 1.5,
    maximum: 30,
    pozadavky: { 11: 1 },
  },
  5: {
    nazev: 'Zemědělství',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 45,
    casNasobek: 1.5,
    maximum: 10,
    pozadavky: { 1: 3 },
  },
  6: {
    nazev: 'Sklad',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 60,
    casNasobek: 1.5,
    maximum: 10,
    pozadavky: {},
  },
  7: {
    nazev: 'Výzkumná laboratoř',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 60,
    casNasobek: 1.5,
    maximum: 20,
    pozadavky: { 1: 3 },
  },
  8: {
    nazev: 'Banka',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 60,
    casNasobek: 1.5,
    maximum: 20,
    pozadavky: { 1: 1 },
  },
  9: {
    nazev: 'Tržiště',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 60,
    casNasobek: 1.5,
    maximum: 10,
    pozadavky: { 1: 1 },
  },
  10: {
    nazev: 'Kasárny',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 60,
    casNasobek: 1.5,
    maximum: 10,
    pozadavky: { 1: 3, 7: 1 },
  },
  11: {
    nazev: 'Dílna',
    surovina1: 100,
    surovina2: 100,
    nasobek: 1.5,
    cas: 60,
    casNasobek: 1.5,
    maximum: 10,
    pozadavky: { 1: 5, 7: 5 },
  },
};

export const PRODUKCE_BASE = 20;
export const PRODUKCE_NASOBEK = 1.2;
export const SKLAD_BASE = 1000;
export const SKLAD_NASOBEK = 1.1;

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
