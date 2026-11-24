import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { mesto, users } from '@prisma/client';
import type { MestoRepository } from '../repositories/MestoRepository';
import type { UserRepository } from '../repositories/UserRepository';
import { MestoRamService, jednotkyMesta } from './MestoRamService';

const HRAC = 7;

function m(id: number, user: number, extra: Partial<mesto> = {}): mesto {
    return { id, user, jmeno: `M${id}`, j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0, j7: 0, j8: 0, ...extra } as mesto;
}

function setup(mesta: mesto[], aktualni: number) {
    const user = { id: HRAC, mesto: aktualni } as users;
    const mestoRepo = {
        getByUserId: vi.fn(async (userId: number) => mesta.filter((x) => x.user === userId)),
        getById: vi.fn(async (id: number) => mesta.find((x) => x.id === id) ?? null),
        update: vi.fn(async (id: number, data: Partial<mesto>) => ({ ...m(id, HRAC), ...data })),
    };
    const userRepo = { update: vi.fn(async (id: number, data: Partial<users>) => ({ ...user, ...data })) };
    const service = new MestoRamService(mestoRepo as unknown as MestoRepository, userRepo as unknown as UserRepository);
    return { service, user, mestoRepo, userRepo };
}

describe('aktualniMesto', () => {
    it('users.mesto na vlastní město se jen načte', async () => {
        const { service, user, userRepo } = setup([m(10, HRAC), m(20, HRAC)], 20);
        const r = await service.aktualniMesto(user);
        expect(r?.mesto.id).toBe(20);
        expect(r?.mesta.map((x) => x.id)).toEqual([10, 20]);
        expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('users.mesto na cizí město spadne na první vlastní a zapíše ho (pridel)', async () => {
        const { service, user, userRepo } = setup([m(5, 99), m(10, HRAC), m(20, HRAC)], 5);
        const r = await service.aktualniMesto(user);
        expect(r?.mesto.id).toBe(10);
        expect(r?.user.mesto).toBe(10);
        expect(userRepo.update).toHaveBeenCalledWith(HRAC, { mesto: 10 });
    });

    it('bez měst vrací null', async () => {
        const { service, user } = setup([m(5, 99)], 5);
        expect(await service.aktualniMesto(user)).toBeNull();
    });
});

describe('prepni', () => {
    it('cizí město → null, nic se nezapíše', async () => {
        const { service, user, userRepo } = setup([m(5, 99), m(10, HRAC)], 10);
        expect(await service.prepni(user, 5)).toBeNull();
        expect(await service.prepni(user, 404)).toBeNull();
        expect(await service.prepni(user, Number.NaN)).toBeNull();
        expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('vlastní město → users.mesto', async () => {
        const { service, user, userRepo } = setup([m(10, HRAC), m(20, HRAC)], 10);
        expect((await service.prepni(user, 20))?.id).toBe(20);
        expect(userRepo.update).toHaveBeenCalledWith(HRAC, { mesto: 20 });
    });
});

describe('prejmenuj', () => {
    it('mění jen aktuální město hráče', async () => {
        const { service, user, mestoRepo } = setup([m(10, HRAC), m(20, HRAC)], 20);
        expect(await service.prejmenuj(user, ' <b>Nové</b> ')).toEqual({ chyba: 0, jmeno: 'Nové' });
        expect(mestoRepo.update).toHaveBeenCalledTimes(1);
        expect(mestoRepo.update).toHaveBeenCalledWith(20, { jmeno: 'Nové' });
    });

    it('neplatné jméno nic nezapíše', async () => {
        const { service, user, mestoRepo } = setup([m(10, HRAC)], 10);
        expect((await service.prejmenuj(user, '<i></i>')).chyba).toBe(1);
        expect((await service.prejmenuj(user, 'x'.repeat(21))).chyba).toBe(2);
        expect(mestoRepo.update).not.toHaveBeenCalled();
    });
});

describe('jednotkyMesta', () => {
    it('vlastní jednotky + podpory', () => {
        expect(jednotkyMesta(m(1, HRAC, { j1: 3, j8: 1 }), [2, 0, 0, 0, 0, 0, 0, 4])).toEqual([5, 0, 0, 0, 0, 0, 0, 5]);
    });
});
