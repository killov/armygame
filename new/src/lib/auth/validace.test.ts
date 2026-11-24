import { describe, expect, it } from 'vitest';
import { LANG } from '../game/lang';
import {
    JMENO_MESTA_LANG,
    LOGIN_LANG,
    REGISTRACE_LANG,
    type RegistraceInput,
    isValidEmail,
    validujJmenoMesta,
    validujLogin,
    validujRegistraci,
} from './validace';

const OK: RegistraceInput = { jmeno: 'Pepa', email: 'pepa@example.cz', heslo: 'tajne', hesloZnovu: 'tajne' };
const NIKDO = { jmenoExistuje: false, emailExistuje: false };
const OBA = { jmenoExistuje: true, emailExistuje: true };

const reg = (patch: Partial<RegistraceInput>, existence = NIKDO) => validujRegistraci({ ...OK, ...patch }, existence);

describe('validujRegistraci', () => {
    it('validní vstup projde', () => {
        expect(reg({})).toEqual([0, 0, 0, 0]);
    });

    it('prázdná pole → 1 u všech', () => {
        expect(reg({ jmeno: '', email: '', heslo: '', hesloZnovu: '' }, OBA)).toEqual([1, 1, 1, 1]);
    });

    it('"0" je prázdné jako v PHP empty()', () => {
        expect(reg({ jmeno: '0', email: '0', heslo: '0', hesloZnovu: '0' })).toEqual([1, 1, 1, 1]);
    });

    describe('jméno', () => {
        it('trimuje se — samé mezery jsou prázdné', () => {
            expect(reg({ jmeno: '   ' })[0]).toBe(1);
        });

        it('20 znaků projde, 21 → 2, mezery okolo se nepočítají', () => {
            expect(reg({ jmeno: 'a'.repeat(20) })[0]).toBe(0);
            expect(reg({ jmeno: `  ${'a'.repeat(20)}  ` })[0]).toBe(0);
            expect(reg({ jmeno: 'a'.repeat(21) })[0]).toBe(2);
        });

        it('délka ve znacích, ne v bajtech', () => {
            expect(reg({ jmeno: 'ř'.repeat(20) })[0]).toBe(0);
        });

        it('délka má přednost před existencí', () => {
            expect(reg({ jmeno: 'a'.repeat(21) }, OBA)[0]).toBe(2);
        });

        it('existující → 3', () => {
            expect(reg({}, { jmenoExistuje: true, emailExistuje: false })).toEqual([3, 0, 0, 0]);
        });
    });

    describe('e-mail', () => {
        it('31 znaků → 2, i když je neplatný a existuje', () => {
            expect(reg({ email: `${'a'.repeat(20)}@example.czz` })[1]).toBe(2);
            expect(reg({ email: 'x'.repeat(31) }, OBA)[1]).toBe(2);
        });

        it('neplatný formát → 3, má přednost před existencí', () => {
            expect(reg({ email: 'a@b' })[1]).toBe(3);
            expect(reg({ email: 'a@b' }, OBA)[1]).toBe(3);
        });

        it('existující → 4', () => {
            expect(reg({}, { jmenoExistuje: false, emailExistuje: true })).toEqual([0, 4, 0, 0]);
        });
    });

    describe('heslo', () => {
        it('kratší než 4 → 2, 4 projde', () => {
            expect(reg({ heslo: 'abc', hesloZnovu: 'abc' })[2]).toBe(2);
            expect(reg({ heslo: 'abcd', hesloZnovu: 'abcd' })[2]).toBe(0);
        });

        it('heslo znovu: prázdné → 1, nesoulad → 2', () => {
            expect(reg({ hesloZnovu: '' })[3]).toBe(1);
            expect(reg({ hesloZnovu: 'jine' })[3]).toBe(2);
        });

        it('krátké heslo a nesoulad se hlásí naráz', () => {
            expect(reg({ heslo: 'abc', hesloZnovu: 'abcd' })).toEqual([0, 0, 2, 2]);
        });
    });

    it('kódy mapují na texty z PHP', () => {
        expect(REGISTRACE_LANG.map((kody) => kody.slice(1).map((k) => LANG[k]))).toEqual([
            ['Musíte vyplnit!', 'Jméno může mít maximálně 20 znaků!', 'Jméno už existuje, zvolte si jiné!'],
            ['Musíte vyplnit!', 'Email může mít maximálně 30 znaků!', 'Email není platný!', 'Email už existuje, zvolte si jiný!'],
            ['Musíte vyplnit!', 'Heslo musí mít minimálně 4 znaky!'],
            ['Musíte vyplnit!', 'Hesla se neshodují!'],
        ]);
    });
});

describe('isValidEmail', () => {
    it.each(['pepa@example.cz', 'a.b-c+tag@sub.example.com', 'X_Y@domena.travel', "o'neil@example.org"])(
        'platný: %s',
        (email) => expect(isValidEmail(email)).toBe(true),
    );

    it.each([
        'a@b',
        'pepa',
        '@example.cz',
        'pepa@',
        'pe pa@example.cz',
        'pepa@exa mple.cz',
        'pepa..novak@example.cz',
        '.pepa@example.cz',
        'pepa.@example.cz',
        'pepa@example..cz',
        'pepa@-example.cz',
        'pepa@example.c',
        'pepa@example.123',
        'a@b@example.cz',
        ' pepa@example.cz',
    ])('neplatný: %s', (email) => expect(isValidEmail(email)).toBe(false));
});

describe('validujLogin', () => {
    it('prázdné jméno → 1, jinak rozhoduje DB', () => {
        expect(validujLogin('')).toBe(1);
        expect(validujLogin('Pepa')).toBe(0);
    });

    it('kód 2 je "špatné jméno nebo heslo"', () => {
        expect(LANG[LOGIN_LANG[2]]).toBe('Jméno nebo heslo nejsou správné.');
    });
});

describe('validujJmenoMesta', () => {
    it('prázdné → 1, 21 znaků po trimu → 2, jinak OK', () => {
        expect(validujJmenoMesta('')).toBe(1);
        expect(validujJmenoMesta('   ')).toBe(1);
        expect(validujJmenoMesta('m'.repeat(21))).toBe(2);
        expect(validujJmenoMesta(` ${'m'.repeat(20)} `)).toBe(0);
        expect(validujJmenoMesta('Praha')).toBe(0);
        expect(LANG[JMENO_MESTA_LANG[2]]).toBe('Jméno může mít maximálně 20 znaků!');
    });
});
