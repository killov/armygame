import { HODNOTY } from './game/data';
import { nazevJednotky } from './game/lang';

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

// Emoji je čistě UI, v PHP předloze nemá obdobu.
const EMOJI: Record<number, string> = {
  1: '🪖',
  2: '🎯',
  3: '🥷',
  4: '🕵️',
  5: '🚛',
  6: '🛡️',
  7: '🚌',
  8: '🪖',
};

export const JEDNOTKY: Record<number, JednotkaConfig> = Object.fromEntries(
  Object.entries(HODNOTY.jednotky).map(([id, j]) => [
    id,
    {
      nazev: nazevJednotky(Number(id)),
      emoji: EMOJI[Number(id)],
      surovina2: j.surovina2,
      surovina3: j.surovina3,
      surovina4: j.surovina4,
      cas: j.cas,
      spotreba: j.spotreba,
      rychlost: j.rychlost,
      nosnost: j.nosnost,
      nosnostPechoty: j.nosnost_pechoty,
      vyzkumPozadavky: j.vyzkum_pozadavky_vyzkum,
    },
  ]),
);
