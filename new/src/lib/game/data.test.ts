import { describe, expect, it } from 'vitest';
import { HODNOTY } from './data';
import { emptyArraysToObjects, hasPhp, phpJson } from './phpSource';

describe('HODNOTY', () => {
  it('má všechny položky z inc/data.php', () => {
    expect(Object.keys(HODNOTY.produkce)).toHaveLength(4);
    expect(Object.keys(HODNOTY.budovy)).toHaveLength(11);
    expect(Object.keys(HODNOTY.vyzkum)).toHaveLength(5);
    expect(Object.keys(HODNOTY.jednotky)).toHaveLength(8);
  });

  it('sedí na vzorku hodnot z PHP', () => {
    expect(HODNOTY.budovy[1]).toMatchObject({ surovina1: 100, surovina2: 85, nasobek: 1.4, cas: 80, maximum: 30 });
    expect(HODNOTY.budovy[4].pozadavky).toEqual({ 11: 1 });
    expect(HODNOTY.budovy[5].pozadavky).toEqual({ 1: 3 });
    expect(HODNOTY.budovy[11].pozadavky).toEqual({ 1: 5, 7: 5 });
    expect(HODNOTY.sklad).toEqual({ zaklad: 1000, nasobek: 1.1 });
    expect(HODNOTY.trziste.pomer).toBe(0.8);
    expect(HODNOTY.jednotky[1].vyzkum_pozadavky_vyzkum).toEqual({ 1: 1 });
    expect(HODNOTY.jednotky[3]).toMatchObject({ nosnost: 30, rychlost: 3 });
    expect(HODNOTY.vyzkum[5].pozadavky_budova).toEqual({ 1: 1 });
  });

  describe.runIf(hasPhp)('proti inc/data.php', () => {
    it('je 1:1 s $hodnoty', () => {
      const php = emptyArraysToObjects(phpJson('inc/data.php', '$hodnoty'));
      expect(JSON.parse(JSON.stringify(HODNOTY))).toStrictEqual(php);
    });
  });
});
