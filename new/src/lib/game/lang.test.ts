import { describe, expect, it } from 'vitest';
import { LANG, LANG_BUDOVA, LANG_JEDNOTKY, LANG_VYZKUM, nazevBudovy, nazevJednotky, nazevVyzkumu } from './lang';
import { hasPhp, phpJson } from './phpSource';

describe('lang', () => {
  it('má délky jako lang/cz.php', () => {
    expect(LANG).toHaveLength(150);
    expect(LANG_BUDOVA).toHaveLength(11);
    expect(LANG_VYZKUM).toHaveLength(5);
    expect(LANG_JEDNOTKY).toHaveLength(8);
  });

  it('sedí na vzorku textů', () => {
    expect(LANG[0]).toBe('Přihlášení');
    expect(LANG[28]).toBe('surovina2olom');
    expect(LANG_BUDOVA[0]).toBe('Hlavní budova');
    expect(LANG_BUDOVA[10]).toBe('Dílna');
    expect(LANG_JEDNOTKY[7]).toBe('Tank');
  });

  it('helpery berou id od 1', () => {
    expect(nazevBudovy(1)).toBe('Hlavní budova');
    expect(nazevVyzkumu(5)).toBe('Vyzkum5');
    expect(nazevJednotky(8)).toBe('Tank');
    expect(() => nazevBudovy(0)).toThrow();
    expect(() => nazevJednotky(9)).toThrow();
  });

  describe.runIf(hasPhp)('proti lang/cz.php', () => {
    it('je 1:1 s $lang, $lang_budova, $lang_vyzkum, $lang_jednotky', () => {
      const php = phpJson('lang/cz.php', '[$lang, $lang_budova, $lang_vyzkum, $lang_jednotky]');
      expect([LANG, LANG_BUDOVA, LANG_VYZKUM, LANG_JEDNOTKY]).toStrictEqual(php);
    });
  });
});
