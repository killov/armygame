'use server';

import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/session';
import { mestoRamService } from '@/lib/game/aktualniMesto';

/** Výsledek inc/hra/post/rename.php: chyba 0 = přejmenováno, 1 prázdné, 2 delší než 20 (JMENO_MESTA_LANG). */
export interface PrejmenovatVysledek {
    chyba: number;
    jmeno: string;
}

// revalidatePath('/game') bez 'layout' by rám s lištou neobnovil.
export async function prejmenovatMestoAction(formData: FormData): Promise<PrejmenovatVysledek> {
    const user = await getCurrentUser();
    if (!user) redirect('/');

    const jmeno = formData.get('jmeno');
    const vysledek = await mestoRamService().prejmenuj(user, typeof jmeno === 'string' ? jmeno : '');
    if (vysledek.chyba === 0) revalidatePath('/game', 'layout');
    return vysledek;
}

/** Vrací jméno nového aktuálního města, null když město hráči nepatří. */
export async function prepnoutMestoAction(mestoId: number): Promise<string | null> {
    const user = await getCurrentUser();
    if (!user) redirect('/');

    const mesto = await mestoRamService().prepni(user, mestoId);
    if (!mesto) return null;
    revalidatePath('/game', 'layout');
    return mesto.jmeno;
}
