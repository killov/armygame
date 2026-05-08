'use server';

import 'reflect-metadata';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { JEDNOTKY } from '@/lib/armyData';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'armygame-super-secret-jwt-key-2024-change-in-prod'
);

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('armygame_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number; jmeno: string };
  } catch {
    return null;
  }
}

export async function trainUnitsAction(
  mestoId: number,
  jednotkaId: number,
  pocet: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Nejsi přihlášen' };

  const j = JEDNOTKY[jednotkaId];
  if (!j) return { success: false, error: 'Neznámý typ jednotky' };
  if (pocet < 1 || pocet > 50) return { success: false, error: 'Neplatný počet (1–50)' };

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);

  const mesto = await mestoRepo.getById(mestoId);
  if (!mesto) return { success: false, error: 'Město nenalezeno' };
  if (mesto.user !== session.userId) return { success: false, error: 'Nemáš přístup k tomuto městu' };

  // Zkontroluj dostatek surovin
  const cenaS2 = j.surovina2 * pocet;
  const cenaS3 = j.surovina3 * pocet;
  const cenaS4 = j.surovina4 * pocet;

  if (mesto.surovina2 < cenaS2) {
    return { success: false, error: `Nedostatek železa (máš ${mesto.surovina2}, potřebuješ ${cenaS2})` };
  }
  if (j.surovina3 > 0 && mesto.surovina3 < cenaS3) {
    return { success: false, error: `Nedostatek ropy (máš ${mesto.surovina3}, potřebuješ ${cenaS3})` };
  }
  if (j.surovina4 > 0 && mesto.surovina4 < cenaS4) {
    return { success: false, error: `Nedostatek jídla (máš ${mesto.surovina4}, potřebuješ ${cenaS4})` };
  }

  // Odečti suroviny
  await mestoRepo.update(mestoId, {
    surovina2: mesto.surovina2 - cenaS2,
    surovina3: j.surovina3 > 0 ? mesto.surovina3 - cenaS3 : mesto.surovina3,
    surovina4: j.surovina4 > 0 ? mesto.surovina4 - cenaS4 : mesto.surovina4,
  });

  const now = Math.floor(Date.now() / 1000);
  const delka = j.cas * pocet;

  // Vytvoř akci typ=5
  await akceRepo.create({
    user: session.userId,
    mesto: mestoId,
    cil: mestoId,
    budova: 0,
    delka,
    cas: now,
    dokonceni: now + delka,
    typ: 5,
    typ_jednotky: jednotkaId,
    obchodniku: 0,
    surovina1: 0,
    surovina2: 0,
    surovina3: 0,
    surovina4: 0,
    j1: 0,
    j2: 0,
    j3: 0,
    j4: 0,
    j5: 0,
    j6: 0,
    j7: 0,
    j8: 0,
    [`j${jednotkaId}`]: pocet,
  } as Parameters<typeof akceRepo.create>[0]);

  revalidatePath('/game/jednotky');

  return { success: true };
}
