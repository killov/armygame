import { describe, expect, it } from 'vitest';
import { MESTO_DOM, spocitejMapuStatu } from './mapaStatu';

describe('spocitejMapuStatu', () => {
  it('prázdná mapa nemá státy ani hranice', () => {
    expect(spocitejMapuStatu([]).pole(0, 0)).toEqual({ stat: 0, hranice: 0, dom: 0 });
  });

  describe('jedno město', () => {
    const mapa = spocitejMapuStatu([{ x: 0, y: 0, stat: 7, populace: 1 }]);

    it('město drží své pole a ovládá okolí podle vzdálenosti', () => {
      expect(mapa.pole(0, 0)).toEqual({ stat: 7, hranice: 0, dom: MESTO_DOM });
      expect(mapa.pole(1, 0)).toMatchObject({ stat: 7, dom: 40000 });
      expect(mapa.pole(2, 4)).toMatchObject({ stat: 7, dom: 5279 });
      // Pole ve vzdálenosti 5 má vahu 0, takže zůstane bez státu.
      expect(mapa.pole(5, 0)).toEqual({ stat: 0, hranice: 0, dom: 0 });
    });

    it('okraje území dostanou bity hranice', () => {
      expect(mapa.pole(-4, 0).hranice).toBe(4);
      expect(mapa.pole(4, 0).hranice).toBe(1);
      expect(mapa.pole(0, 4).hranice).toBe(8);
      expect(mapa.pole(0, -4).hranice).toBe(2);
      expect(mapa.pole(-2, 4).hranice).toBe(4 + 8);
      expect(mapa.pole(1, 1).hranice).toBe(0);
    });
  });

  it('na styku dvou států vyhrává silnější vliv a při shodě dřívější město', () => {
    const mapa = spocitejMapuStatu([
      { x: 0, y: 0, stat: 1, populace: 1 },
      { x: 6, y: 0, stat: 2, populace: 1 },
    ]);
    expect(mapa.pole(3, 0)).toMatchObject({ stat: 1, dom: 20000 });
    expect(mapa.pole(4, 0)).toMatchObject({ stat: 2, dom: 30000 });
    expect(mapa.pole(3, 0).hranice).toBe(1);
    expect(mapa.pole(4, 0).hranice).toBe(4);
  });

  it('pozdější město přepíše vliv na poli, kde samo stojí', () => {
    const mapa = spocitejMapuStatu([
      { x: 0, y: 0, stat: 1, populace: 100 },
      { x: 1, y: 0, stat: 2, populace: 1 },
    ]);
    expect(mapa.pole(1, 0)).toMatchObject({ stat: 2, dom: MESTO_DOM });
  });
});
