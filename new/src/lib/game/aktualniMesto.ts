import 'reflect-metadata';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { DatabaseService } from '../../db/DatabaseService';
import { MestoRepository } from '../../repositories/MestoRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { AktualniMesto, MestoRamService } from '../../services/MestoRamService';
import { getCurrentUser } from '../session';

export function mestoRamService(): MestoRamService {
    const db = new DatabaseService();
    return new MestoRamService(new MestoRepository(db), new UserRepository(db));
}

/**
 * Hráč a jeho aktuální město (users.mesto, port www/index.php). Bez session → login, bez města → založení.
 * cache(): layout rámu i stránka v rámci jednoho requestu sdílí jeden dotaz.
 */
export const getAktualniMesto = cache(async (): Promise<AktualniMesto> => {
    const user = await getCurrentUser();
    if (!user) redirect('/');
    const aktualni = await mestoRamService().aktualniMesto(user);
    if (!aktualni) redirect('/zalozit-mesto');
    return aktualni;
});
