export interface JednotkaConfig {
  nazev: string;
  emoji: string;
  surovina2: number; // železo
  surovina3: number; // ropa (nebo 0)
  surovina4: number; // jídlo
  cas: number; // sekundy na 1 kus
  spotreba: number; // populace
  rychlost: number;
  nosnost: number;
  nosnostPechoty: number;
  vyzkumPozadavky: Record<number, number>;
}

export const JEDNOTKY: Record<number, JednotkaConfig> = {
  1: {
    nazev: 'Pěšák',
    emoji: '🪖',
    surovina2: 100,
    surovina3: 0,
    surovina4: 100,
    cas: 100,
    spotreba: 1,
    rychlost: 10,
    nosnost: 0,
    nosnostPechoty: 0,
    vyzkumPozadavky: { 1: 1 },
  },
  2: {
    nazev: 'Sniper',
    emoji: '🎯',
    surovina2: 100,
    surovina3: 0,
    surovina4: 100,
    cas: 100,
    spotreba: 1,
    rychlost: 12,
    nosnost: 0,
    nosnostPechoty: 0,
    vyzkumPozadavky: {},
  },
  3: {
    nazev: 'Spec. jednotka',
    emoji: '🥷',
    surovina2: 100,
    surovina3: 0,
    surovina4: 100,
    cas: 10,
    spotreba: 1,
    rychlost: 3,
    nosnost: 30,
    nosnostPechoty: 0,
    vyzkumPozadavky: {},
  },
  4: {
    nazev: 'Špión',
    emoji: '🕵️',
    surovina2: 100,
    surovina3: 0,
    surovina4: 100,
    cas: 100,
    spotreba: 1,
    rychlost: 6,
    nosnost: 0,
    nosnostPechoty: 0,
    vyzkumPozadavky: {},
  },
  5: {
    nazev: 'Nákl. vozidlo',
    emoji: '🚛',
    surovina2: 100,
    surovina3: 100,
    surovina4: 0,
    cas: 100,
    spotreba: 0,
    rychlost: 4,
    nosnost: 0,
    nosnostPechoty: 4,
    vyzkumPozadavky: {},
  },
  6: {
    nazev: 'Obrněné voz.',
    emoji: '🛡️',
    surovina2: 100,
    surovina3: 100,
    surovina4: 0,
    cas: 100,
    spotreba: 1,
    rychlost: 2,
    nosnost: 0,
    nosnostPechoty: 8,
    vyzkumPozadavky: {},
  },
  7: {
    nazev: 'Transportér',
    emoji: '🚌',
    surovina2: 100,
    surovina3: 100,
    surovina4: 0,
    cas: 100,
    spotreba: 1,
    rychlost: 5,
    nosnost: 0,
    nosnostPechoty: 5,
    vyzkumPozadavky: {},
  },
  8: {
    nazev: 'Tank',
    emoji: '🪖',
    surovina2: 100,
    surovina3: 100,
    surovina4: 0,
    cas: 100,
    spotreba: 1,
    rychlost: 6,
    nosnost: 0,
    nosnostPechoty: 0,
    vyzkumPozadavky: {},
  },
};
