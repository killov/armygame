import { describe, expect, it } from 'vitest';
import { hasPhp, phpGameJson } from './phpSource';
import { banka, BUDOVA_IDS, budovaObyvatele, penize, produkce, sklad, surovina } from './vzorce';

const LEVELS = Array.from({ length: 31 }, (_, i) => i);

describe('vzorce', () => {
  it('sedí na ručně spočítaných hodnotách', () => {
    expect(produkce(1, 0)).toBe(20);
    expect(produkce(4, 3)).toBe(138);
    expect(sklad(0)).toBe(1000);
    expect(sklad(5)).toBe(9663);
    expect(banka(0)).toBe(1000);
    expect(budovaObyvatele(1, 0)).toBe(0);
    expect(budovaObyvatele(1, 1)).toBe(3);
  });

  it('surovina přičte produkci za uplynulý čas a ořízne ji skladem', () => {
    expect(surovina(100, 3600, 1000, 5000, 1010)).toBe(110);
    expect(surovina(100, 3600, 1000, 105, 1010)).toBe(105);
    expect(surovina(100, -3600, 1000, 5000, 1200)).toBe(-100);
  });

  it('penize nepustí nad banku', () => {
    expect(penize(500, 1000)).toBe(500);
    expect(penize(1500, 1000)).toBe(1000);
  });

  describe.runIf(hasPhp)('proti inc/classes', () => {
    it('produkce, sklad, banka a obyvatelé budov jsou 1:1 s PHP', () => {
      const php = phpGameJson(`(function () {
        $m = new Mesto(); $u = new User(); $out = [];
        foreach (range(0, 30) as $l) {
          $out["produkce"][] = [$m->produkce(1, $l), $m->produkce(4, $l)];
          $out["sklad"][] = $m->sklad($l);
          $out["banka"][] = $u->banka($l);
          foreach (range(1, 11) as $b) $out["obyvatele"][] = $m->budova_obyvatele($b, $l);
        }
        return $out;
      })()`);
      expect({
        produkce: LEVELS.map((l) => [produkce(1, l), produkce(4, l)]),
        sklad: LEVELS.map(sklad),
        banka: LEVELS.map(banka),
        obyvatele: LEVELS.flatMap((l) => BUDOVA_IDS.map((b) => budovaObyvatele(b, l))),
      }).toStrictEqual(php);
    });
  });
});
