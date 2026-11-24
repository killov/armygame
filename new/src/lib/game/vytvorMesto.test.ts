import { describe, expect, it, vi } from 'vitest';
import type { RandFn } from './mapGen';
import {
    HRANICE_SOUSEDE,
    banka,
    kvadrantWhere,
    najdiVolnePole,
    normalizujSmer,
    noveMestoData,
    produkceSuroviny,
    sklad,
} from './vytvorMesto';

/** Vrací hodnoty postupně a zapisuje rozsahy, se kterými byl volán. */
function scriptedRand(values: number[]) {
    const calls: Array<[number, number]> = [];
    let i = 0;
    const rand: RandFn = (min, max) => {
        calls.push([min, max]);
        return values[i++ % values.length];
    };
    return { rand, calls };
}

const vzdyVolne = async (x: number, y: number) => ({ x, y });
const nikdyVolne = async () => null;

describe('normalizujSmer', () => {
    it('0–3 nechá, 4 losuje rand(0,3), jiné padne na 0 jako PHP else', () => {
        expect([0, 1, 2, 3].map((s) => normalizujSmer(s))).toEqual([0, 1, 2, 3]);
        const { rand, calls } = scriptedRand([2]);
        expect(normalizujSmer(4, rand)).toBe(2);
        expect(calls).toEqual([[0, 3]]);
        expect(normalizujSmer(7)).toBe(0);
        expect(normalizujSmer(Number.NaN)).toBe(0);
    });
});

describe('kvadrantWhere', () => {
    it('hranice jako SELECT COUNT(*) ve vytvor_mesto', () => {
        expect(kvadrantWhere(0)).toEqual({ x: { gte: 0 }, y: { gte: 0 }, typ: 1 });
        expect(kvadrantWhere(1)).toEqual({ x: { gt: 0 }, y: { lt: 0 }, typ: 1 });
        expect(kvadrantWhere(2)).toEqual({ x: { lt: 0 }, y: { lt: 0 }, typ: 1 });
        expect(kvadrantWhere(3)).toEqual({ x: { lt: 0 }, y: { gt: 0 }, typ: 1 });
    });
});

describe('najdiVolnePole', () => {
    // pocet=2 → vz=21, x=2 → y=round(√17)=4
    it.each([
        [0, 2, 4],
        [1, 2, -4],
        [2, -2, -4],
        [3, -2, 4],
    ] as const)('směr %i dává znaménka [%i|%i]', async (smer, ex, ey) => {
        const { rand } = scriptedRand([2]);
        const r = await najdiVolnePole(smer, 2, vzdyVolne, rand);
        expect([r.x, r.y]).toEqual([ex, ey]);
        expect(r.pole).toEqual({ x: ex, y: ey });
    });

    it('pocet=0 → vz=1, vzd=1', async () => {
        const { rand, calls } = scriptedRand([1]);
        const r = await najdiVolnePole(0, 0, vzdyVolne, rand);
        expect(calls[0]).toEqual([0, 1]);
        expect([r.x, r.y]).toEqual([1, 0]);
    });

    it('po 51 neúspěších rozšíří rozsah x', async () => {
        const { rand, calls } = scriptedRand([0]);
        const isFree = vi.fn(async (x: number, y: number) => (calls.length > 51 ? { x, y } : null));
        await najdiVolnePole(0, 0, isFree, rand);
        expect(calls.slice(0, 51).every(([, max]) => max === 1)).toBe(true);
        expect(calls[51]).toEqual([0, 2]);
        expect(isFree).toHaveBeenCalledTimes(52);
    });

    it('při rozšíření roste i poloměr, takže nové x nedává NAN', async () => {
        // vz=1, vzd=1; x=2 je NAN, dokud se nerozšíří na vzd=2, vz=4 → [2|0]
        const { rand } = scriptedRand([2]);
        const isFree = vi.fn(vzdyVolne);
        const r = await najdiVolnePole(0, 0, isFree, rand);
        expect([r.x, r.y]).toEqual([2, 0]);
        expect(isFree).toHaveBeenCalledTimes(1);
    });

    it.each([1, 2, 3] as const)('směr %i najde pole i s obsazenými osami při pocet=0', async (smer) => {
        // QA: (0,±1) a (±1,0) obsazené, města na osách se do kvadrantu nepočítají → pocet zůstává 0
        const obsazene = new Set(['0,1', '0,-1', '1,0', '-1,0']);
        const isFree = vi.fn(async (x: number, y: number) => (obsazene.has(`${x},${y}`) ? null : { x, y }));
        const r = await najdiVolnePole(smer, 0, isFree);
        expect(obsazene.has(`${r.x},${r.y}`)).toBe(false);
        expect(Math.sign(r.x) * (smer === 1 ? 1 : -1)).toBeGreaterThanOrEqual(0);
        expect(Math.sign(r.y) * (smer === 3 ? 1 : -1)).toBeGreaterThanOrEqual(0);
    });

    it('kandidát s x² > vz (PHP NAN) do DB nejde', async () => {
        // vz=1: x=1 → y=0, x=2 by bylo √-3
        const vsechnyNaN = scriptedRand([2]);
        const isFree = vi.fn(nikdyVolne);
        await expect(najdiVolnePole(0, 0, isFree, vsechnyNaN.rand, 30)).rejects.toThrow();
        expect(isFree).not.toHaveBeenCalled();
    });

    it('po maxPokusu hodí chybu', async () => {
        const { rand } = scriptedRand([0]);
        const isFree = vi.fn(nikdyVolne);
        await expect(najdiVolnePole(1, 3, isFree, rand, 10)).rejects.toThrow(/10 attempts/);
        expect(isFree).toHaveBeenCalledTimes(10);
    });

    it('-0 se normalizuje na 0', async () => {
        // pocet=0, x=0 → y=1; směr 2 neguje obě složky
        const { rand } = scriptedRand([0]);
        const isFree = vi.fn(vzdyVolne);
        const r = await najdiVolnePole(2, 0, isFree, rand);
        expect(Object.is(r.x, 0)).toBe(true);
        expect(r.y).toBe(-1);
        expect(Object.is(isFree.mock.calls[0][0], 0)).toBe(true);
    });
});

describe('HRANICE_SOUSEDE', () => {
    // Ručně přepsaný switch z Mesto::opravhranice: [top, bot, left, right] = (+2, +8, +1, +4).
    const PHP_SWITCH: Record<number, string[]> = {
        0: ['top', 'bot', 'left', 'right'],
        1: ['top', 'bot', 'left'],
        2: ['top', 'left', 'right'],
        3: ['top', 'left'],
        4: ['top', 'bot', 'right'],
        5: ['top', 'bot'],
        6: ['top', 'right'],
        7: ['top'],
        8: ['bot', 'left', 'right'],
        9: ['bot', 'left'],
        10: ['left', 'right'],
        11: ['left'],
        12: ['bot', 'right'],
        13: ['bot'],
        14: ['right'],
    };
    const SOUSED = {
        top: { dx: 0, dy: 1, add: 2 },
        bot: { dx: 0, dy: -1, add: 8 },
        left: { dx: -1, dy: 0, add: 1 },
        right: { dx: 1, dy: 0, add: 4 },
    } as const;

    it.each(Object.keys(PHP_SWITCH).map(Number))('hranice %i', (h) => {
        expect(HRANICE_SOUSEDE[h]).toEqual(PHP_SWITCH[h].map((s) => SOUSED[s as keyof typeof SOUSED]));
    });

    it('jiné hodnoty nic', () => {
        expect(HRANICE_SOUSEDE[15]).toBeUndefined();
        expect(Object.keys(HRANICE_SOUSEDE)).toHaveLength(15);
    });
});

describe('PHP vzorce', () => {
    it('produkce, sklad, banka na úrovni 0', () => {
        expect(produkceSuroviny(1, 0)).toBe(20);
        expect(sklad(0)).toBe(1000);
        expect(banka(0)).toBe(1000);
    });

    it('vyšší úrovně: round(zaklad*(lvl+1)*nasobek^lvl)', () => {
        expect(produkceSuroviny(2, 3)).toBe(Math.round(20 * 4 * 1.2 ** 3));
        expect(sklad(2)).toBe(3630);
        expect(banka(2)).toBe(3630);
    });
});

describe('noveMestoData', () => {
    it('výchozí hodnoty nového města jako vytvor_mesto', () => {
        const m = noveMestoData({ poleId: 42, x: -3, y: -1, jmeno: '<Praha>', userId: 7, userjmeno: 'Pepa', now: 1000 });
        expect(m).toMatchObject({
            id: 42,
            x: -3,
            y: -1,
            typ: 1,
            stat: 0,
            statjmeno: '',
            user: 7,
            userjmeno: 'Pepa',
            jmeno: '<Praha>',
            surovina1: 1000,
            surovina1_produkce: 20,
            surovina4_produkce: 20,
            sklad: 1000,
            suroviny_time: 1000,
            b1: 1,
            populace: 2,
            b2: 0,
            b11: 0,
            v8: 0,
            j8: 0,
            smrt: 0,
        });
    });
});
