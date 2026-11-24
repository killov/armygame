// Port generátoru mapy z install.php. Čistá funkce bez DB, RNG se injektuje kvůli testům.

export const MAP_MIN = -200;
export const MAP_MAX = 199;
export const BLOK_MIN = -20;
export const BLOK_MAX = 19;
export const BLOK_SIZE = 10;

/** Celé číslo v uzavřeném intervalu [min, max], stejně jako PHP rand(). */
export type RandFn = (min: number, max: number) => number;

export interface MapaPole {
  x: number;
  y: number;
  blokx: number;
  bloky: number;
  typ: number;
  hrana: number;
}

export interface MapaBlok {
  x: number;
  y: number;
}

export const mathRand: RandFn = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const HRANA_PRAVO = 1;
const HRANA_DOLE = 2;
const HRANA_LEVO = 4;
const HRANA_NAHORE = 8;

/**
 * Pořadí řádků i volání RNG drží PHP předlohu (y od MAP_MAX dolů, x zleva), takže
 * zápisy shluku do ještě nenavštívených polí se při jejich návštěvě přepíšou na 0
 * stejně jako v install.php. Zápisy mimo mřížku PHP tiše založí a nikdy nevloží, tady se ořežou.
 */
export function generateMapa(rand: RandFn = mathRand): MapaPole[] {
  const size = MAP_MAX - MAP_MIN + 1;
  const typ = new Uint8Array(size * size);
  const hrana = new Uint8Array(size * size);
  const inRange = (x: number, y: number) => x >= MAP_MIN && x <= MAP_MAX && y >= MAP_MIN && y <= MAP_MAX;
  const idx = (x: number, y: number) => (y - MAP_MIN) * size + (x - MAP_MIN);
  const setTyp = (x: number, y: number, h: number) => {
    if (inRange(x, y)) typ[idx(x, y)] = h;
  };

  for (let y = MAP_MAX; y >= MAP_MIN; y--) {
    for (let x = MAP_MIN; x <= MAP_MAX; x++) {
      typ[idx(x, y)] = 0;
      const r1 = rand(0, 20);
      const r2 = rand(0, 70);
      const r3 = rand(0, 100);
      const h = r1 === 0 ? 2 : r2 === 0 ? 3 : r3 === 0 ? 4 : 0;
      if (h === 0) continue;

      const tvar = rand(0, 3);
      if (tvar === 0) {
        setTyp(x, y, h);
        setTyp(x - 1, y, h);
        setTyp(x - 2, y, h);
        setTyp(x - 1, y + 1, h);
      } else if (tvar === 1) {
        setTyp(x, y, h);
        setTyp(x - 1, y + 1, h);
        setTyp(x - 1, y - 1, h);
        setTyp(x - 2, y - 1, h);
        setTyp(x, y + 1, h);
      } else if (tvar === 2) {
        setTyp(x, y, h);
        setTyp(x + 1, y, h);
        setTyp(x, y - 1, h);
        setTyp(x - 1, y, h);
        setTyp(x, y + 1, h);
      } else if (h !== 4) {
        for (let dy = 1; dy <= 4; dy++) {
          setTyp(x, y + dy, h);
          setTyp(x - 1, y + dy, h);
        }
      }
    }
  }

  // Hrana vzniká na přechodu mezi různými typy; přechod do typu 0 hranu nového pole nedělá.
  for (let y = MAP_MAX; y >= MAP_MIN; y--) {
    let pos = 0;
    for (let x = MAP_MIN; x <= MAP_MAX; x++) {
      const t = typ[idx(x, y)];
      if (t !== pos) {
        if (t !== 0) hrana[idx(x, y)] |= HRANA_LEVO;
        if (pos !== 0) hrana[idx(x - 1, y)] |= HRANA_PRAVO;
      }
      pos = t;
    }
  }
  for (let x = MAP_MIN; x <= MAP_MAX; x++) {
    let pos = 0;
    for (let y = MAP_MAX; y >= MAP_MIN; y--) {
      const t = typ[idx(x, y)];
      if (t !== pos) {
        if (t !== 0) hrana[idx(x, y)] |= HRANA_NAHORE;
        if (pos !== 0) hrana[idx(x, y + 1)] |= HRANA_DOLE;
      }
      pos = t;
    }
  }

  const pole: MapaPole[] = [];
  for (let y = MAP_MAX; y >= MAP_MIN; y--) {
    for (let x = MAP_MIN; x <= MAP_MAX; x++) {
      pole.push({
        x,
        y,
        // Math.floor, ne |0: pro záporné x musí -1 padnout do bloku -1 jako PHP floor().
        blokx: Math.floor(x / BLOK_SIZE),
        bloky: Math.floor(y / BLOK_SIZE),
        typ: typ[idx(x, y)],
        hrana: hrana[idx(x, y)],
      });
    }
  }
  return pole;
}

export function generateMapaBloky(): MapaBlok[] {
  const bloky: MapaBlok[] = [];
  for (let y = BLOK_MAX; y >= BLOK_MIN; y--) {
    for (let x = BLOK_MIN; x <= BLOK_MAX; x++) {
      bloky.push({ x, y });
    }
  }
  return bloky;
}
