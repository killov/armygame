import { HODNOTY } from './game/data';

export interface VyzkumConfig {
  nazev: string;
  emoji: string;
  popis: string;
  cenaNasobek: number;
  casNasobek: number;
  cenaZaklad: number;
  casZaklad: number;
  maximum: number;
  pozadavkyBudova: Record<number, number>; // { budovaId: minLevel }
  pozadavkyVyzkum: Record<number, number>; // { vyzkumId: minLevel }
}

// Názvy zůstávají lokálně: lang/cz.php má pro výzkumy jen zástupné "Vyzkum1".."Vyzkum5" a popis se váže k těmhle.
const UI: Record<number, Pick<VyzkumConfig, 'nazev' | 'emoji' | 'popis'>> = {
  1: { nazev: 'Taktika', emoji: '📋', popis: 'Zlepšuje bojovou efektivitu pěchoty' },
  2: { nazev: 'Logistika', emoji: '🚚', popis: 'Urychluje pohyb jednotek' },
  3: { nazev: 'Průzkum', emoji: '🔭', popis: 'Zlepšuje schopnosti špionáže' },
  4: { nazev: 'Obrana', emoji: '🛡️', popis: 'Zvyšuje obranu města' },
  5: { nazev: 'Výzbroj', emoji: '⚔️', popis: 'Zvyšuje útok jednotek' },
};

export const VYZKUMY: Record<number, VyzkumConfig> = Object.fromEntries(
  Object.entries(HODNOTY.vyzkum).map(([id, v]) => [
    id,
    {
      ...UI[Number(id)],
      cenaNasobek: v.nasobek,
      casNasobek: v.cas_nasobek,
      cenaZaklad: v.cena,
      casZaklad: v.cas,
      maximum: v.maximum,
      pozadavkyBudova: v.pozadavky_budova,
      pozadavkyVyzkum: v.pozadavky,
    },
  ]),
);

export function vyzkumCena(id: number, currentLevel: number): number {
  const v = VYZKUMY[id];
  return Math.floor(v.cenaZaklad * Math.pow(v.cenaNasobek, currentLevel));
}

export function vyzkumCas(id: number, currentLevel: number): number {
  const v = VYZKUMY[id];
  return Math.floor(v.casZaklad * Math.pow(v.casNasobek, currentLevel));
}
