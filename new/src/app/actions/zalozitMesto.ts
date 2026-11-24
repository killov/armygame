'use server';

import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { DatabaseService } from '@/db/DatabaseService';
import { MapaRepository } from '@/repositories/MapaRepository';
import { MestoRepository } from '@/repositories/MestoRepository';
import { CityFoundingService } from '@/services/CityFoundingService';
import { getCurrentUser } from '@/lib/session';
import { CHYBA_NENI_VOLNE_POLE, validujJmenoMesta } from '@/lib/auth/validace';
import { NeniVolnePoleError, normalizujSmer } from '@/lib/game/vytvorMesto';

/** Kód chyby jako PHP inc/zalozitmestopost.php (0 / 1 prázdné / 2 delší než 20), navíc 3 = mapa nemá volné pole. */
export interface ZalozitMestoState {
    chyba: number;
    jmeno: string;
    smer: number;
}

export async function zalozitMestoAction(_prev: ZalozitMestoState, formData: FormData): Promise<ZalozitMestoState> {
    const user = await getCurrentUser();
    if (!user) redirect('/');

    const jmeno = String(formData.get('jmeno') ?? '');
    const smer = Number(formData.get('smer'));
    const chyba = validujJmenoMesta(jmeno);
    if (chyba !== 0) return { chyba, jmeno, smer };

    const db = new DatabaseService();
    const service = new CityFoundingService(new MestoRepository(db), new MapaRepository(db), db);
    try {
        await service.zalozMesto(user.id, user.jmeno, jmeno.trim(), normalizujSmer(smer));
    } catch (e) {
        if (e instanceof NeniVolnePoleError) return { chyba: CHYBA_NENI_VOLNE_POLE, jmeno, smer };
        throw e;
    }

    redirect('/game');
}
