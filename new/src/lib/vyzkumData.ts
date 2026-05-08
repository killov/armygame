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

export const VYZKUMY: Record<number, VyzkumConfig> = {
  1: {
    nazev: 'Taktika',
    emoji: '📋',
    popis: 'Zlepšuje bojovou efektivitu pěchoty',
    cenaNasobek: 1.5,
    casNasobek: 1.5,
    cenaZaklad: 100,
    casZaklad: 60,
    maximum: 10,
    pozadavkyBudova: { 1: 1 },
    pozadavkyVyzkum: {},
  },
  2: {
    nazev: 'Logistika',
    emoji: '🚚',
    popis: 'Urychluje pohyb jednotek',
    cenaNasobek: 1.5,
    casNasobek: 1.5,
    cenaZaklad: 100,
    casZaklad: 60,
    maximum: 10,
    pozadavkyBudova: { 1: 1 },
    pozadavkyVyzkum: { 3: 1 },
  },
  3: {
    nazev: 'Průzkum',
    emoji: '🔭',
    popis: 'Zlepšuje schopnosti špionáže',
    cenaNasobek: 1.5,
    casNasobek: 1.5,
    cenaZaklad: 100,
    casZaklad: 60,
    maximum: 10,
    pozadavkyBudova: { 1: 1 },
    pozadavkyVyzkum: {},
  },
  4: {
    nazev: 'Obrana',
    emoji: '🛡️',
    popis: 'Zvyšuje obranu města',
    cenaNasobek: 1.5,
    casNasobek: 1.5,
    cenaZaklad: 100,
    casZaklad: 60,
    maximum: 10,
    pozadavkyBudova: { 1: 1 },
    pozadavkyVyzkum: {},
  },
  5: {
    nazev: 'Výzbroj',
    emoji: '⚔️',
    popis: 'Zvyšuje útok jednotek',
    cenaNasobek: 1.5,
    casNasobek: 1.5,
    cenaZaklad: 100,
    casZaklad: 60,
    maximum: 10,
    pozadavkyBudova: { 1: 1 },
    pozadavkyVyzkum: {},
  },
};

export function vyzkumCena(id: number, currentLevel: number): number {
  const v = VYZKUMY[id];
  return Math.floor(v.cenaZaklad * Math.pow(v.cenaNasobek, currentLevel));
}

export function vyzkumCas(id: number, currentLevel: number): number {
  const v = VYZKUMY[id];
  return Math.floor(v.casZaklad * Math.pow(v.casNasobek, currentLevel));
}
