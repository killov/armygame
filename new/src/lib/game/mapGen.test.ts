import { describe, expect, it } from 'vitest';
import { generateMapa, generateMapaBloky, MAP_MAX, MAP_MIN, type MapaPole, type RandFn } from './mapGen';

// mulberry32: deterministický PRNG, ať test nezávisí na Math.random.
function seededRand(seed: number): RandFn {
  let a = seed;
  return (min, max) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const f = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return min + Math.floor(f * (max - min + 1));
  };
}

const at = (mapa: MapaPole[], x: number, y: number) => mapa.find((p) => p.x === x && p.y === y)!;

describe('generateMapa', () => {
  const mapa = generateMapa(seededRand(42));

  it('pokryje mřížku 400×400 v pořadí install.php', () => {
    expect(mapa).toHaveLength(160_000);
    expect(mapa[0]).toMatchObject({ x: MAP_MIN, y: MAP_MAX });
    expect(mapa[mapa.length - 1]).toMatchObject({ x: MAP_MAX, y: MAP_MIN });
    expect(mapa.every((p) => p.x >= MAP_MIN && p.x <= MAP_MAX && p.y >= MAP_MIN && p.y <= MAP_MAX)).toBe(true);
  });

  it('počítá bloky přes floor i pro záporné souřadnice', () => {
    expect(at(mapa, -1, 0).blokx).toBe(-1);
    expect(at(mapa, -10, 0).blokx).toBe(-1);
    expect(at(mapa, -11, 0).blokx).toBe(-2);
    expect(at(mapa, 0, -1).bloky).toBe(-1);
    expect(at(mapa, 9, 10)).toMatchObject({ blokx: 0, bloky: 1 });
  });

  it('drží typ i hranu v platném rozsahu', () => {
    const typy = new Set(mapa.map((p) => p.typ));
    expect([...typy].sort()).toEqual([0, 2, 3, 4]);
    expect(mapa.every((p) => p.hrana >= 0 && p.hrana <= 15)).toBe(true);
  });

  it('je deterministický pro stejný RNG', () => {
    expect(generateMapa(seededRand(42))).toEqual(mapa);
  });

  it('bez shluků dá prázdnou mapu bez hran', () => {
    const empty = generateMapa((_min, max) => max);
    expect(empty.every((p) => p.typ === 0 && p.hrana === 0)).toBe(true);
  });

  it('samé shluky typu 2 dají hranu jen na levém a horním okraji', () => {
    const full = generateMapa(() => 0);
    expect(full.every((p) => p.typ === 2)).toBe(true);
    expect(at(full, MAP_MIN, MAP_MAX).hrana).toBe(4 + 8);
    expect(at(full, MAP_MIN, 0).hrana).toBe(4);
    expect(at(full, 0, MAP_MAX).hrana).toBe(8);
    expect(at(full, MAP_MAX, MAP_MIN).hrana).toBe(0);
  });

  it('osamělý shluk tvaru 2 přežije jen v už navštívených polích', () => {
    // Shluk jen v (0,0): typ 2, tvar 2 (kříž). (1,0) a (0,-1) se při své návštěvě přepíšou na 0 jako v PHP.
    const target = (MAP_MAX - 0) * 400 + (0 - MAP_MIN);
    let cell = -1;
    const rand: RandFn = (_min, max) => {
      if (max === 20) cell++;
      if (cell !== target) return max;
      return max === 3 ? 2 : 0;
    };
    const m = generateMapa(rand);
    expect(m.filter((p) => p.typ !== 0).map((p) => [p.x, p.y])).toEqual([
      [0, 1],
      [-1, 0],
      [0, 0],
    ]);
    expect(at(m, 0, 1).hrana).toBe(4 + 1 + 8);
    expect(at(m, -1, 0).hrana).toBe(4 + 8 + 2);
    expect(at(m, 0, 0).hrana).toBe(1 + 2);
  });
});

describe('generateMapaBloky', () => {
  it('vytvoří 40×40 bloků od [-20, 19] dolů', () => {
    const bloky = generateMapaBloky();
    expect(bloky).toHaveLength(1600);
    expect(bloky[0]).toEqual({ x: -20, y: 19 });
    expect(bloky[1599]).toEqual({ x: 19, y: -20 });
  });
});
