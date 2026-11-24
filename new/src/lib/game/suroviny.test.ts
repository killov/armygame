import { describe, expect, it } from 'vitest';
import { cas, penize, refreshCas, stripTags, surovina, validujPrejmenovani } from './suroviny';

describe('surovina', () => {
    it('roste podle hodinové produkce a floor jako PHP', () => {
        expect(surovina(100, 3600, 1000, 10_000, 1010)).toBe(110);
        expect(surovina(100, 100, 0, 10_000, 60)).toBe(101);
    });

    it('zastaví se na skladu', () => {
        expect(surovina(9_990, 3600, 0, 10_000, 3600)).toBe(10_000);
        expect(surovina(10_000, 3600, 0, 10_000, 0)).toBe(10_000);
    });

    it('záporná produkce klesá i pod nulu (jídlo při spotřebě)', () => {
        expect(surovina(10, -3600, 0, 10_000, 20)).toBe(-10);
        expect(surovina(10, -100, 0, 10_000, 1)).toBe(9);
    });
});

describe('penize', () => {
    it('strop bankou', () => {
        expect(penize(500, 1000)).toBe(500);
        expect(penize(1500, 1000)).toBe(1000);
    });
});

describe('refreshCas', () => {
    it('bez akce 300 s, jinak do nejbližší akce se stropem 300 s', () => {
        expect(refreshCas(null, 1000)).toBe(300);
        expect(refreshCas(1060, 1000)).toBe(60);
        expect(refreshCas(5000, 1000)).toBe(300);
    });
});

describe('cas', () => {
    it('hh:mm:ss', () => {
        expect(cas(0)).toBe('00:00:00');
        expect(cas(3661)).toBe('01:01:01');
        expect(cas(86_399)).toBe('23:59:59');
    });

    it('24 h a víc přeteče přes h % 24 jako originál', () => {
        expect(cas(86_400)).toBe('00:00:00');
        expect(cas(90_061)).toBe('01:01:01');
    });
});

describe('stripTags', () => {
    it('zahodí tagy, text nechá', () => {
        expect(stripTags('<b>Praha</b>')).toBe('Praha');
        expect(stripTags('a<script>x')).toBe('ax');
        expect(stripTags('Brno <i')).toBe('Brno ');
    });
});

describe('validujPrejmenovani', () => {
    it('prázdné nebo jen tagy → 1', () => {
        expect(validujPrejmenovani('').chyba).toBe(1);
        expect(validujPrejmenovani('   ').chyba).toBe(1);
        expect(validujPrejmenovani('<b></b>').chyba).toBe(1);
    });

    it('víc než 20 znaků → 2, diakritika se počítá po znacích', () => {
        expect(validujPrejmenovani('a'.repeat(21)).chyba).toBe(2);
        expect(validujPrejmenovani('ž'.repeat(20))).toEqual({ chyba: 0, jmeno: 'ž'.repeat(20) });
    });

    it('vrací očištěné jméno', () => {
        expect(validujPrejmenovani('  <b>Nová Ves</b> ')).toEqual({ chyba: 0, jmeno: 'Nová Ves' });
    });
});
