'use server';

import 'reflect-metadata';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { VYZKUMY, vyzkumCena, vyzkumCas } from '@/lib/vyzkumData';

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

export async function startResearchAction(
  mestoId: number,
  vyzkumId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Nejsi přihlášen' };

  const vConfig = VYZKUMY[vyzkumId];
  if (!vConfig) return { success: false, error: 'Neznámý výzkum' };

  const db = new DatabaseService();
  const userRepo = new UserRepository(db);
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);

  // Načti uživatele
  const user = await userRepo.getById(session.userId);
  if (!user) return { success: false, error: 'Uživatel nenalezen' };

  const currentLevel = (user[`v${vyzkumId}` as keyof typeof user] as number) ?? 0;

  if (currentLevel >= vConfig.maximum) {
    return { success: false, error: 'Výzkum je na maximálním levelu' };
  }

  const cena = vyzkumCena(vyzkumId, currentLevel);
  const cas = vyzkumCas(vyzkumId, currentLevel);

  // Zkontroluj peníze
  if (user.penize < cena) {
    return { success: false, error: `Nedostatek peněz (máš ${user.penize}, potřebuješ ${cena})` };
  }

  // Zkontroluj podmínky budov
  const mesto = await mestoRepo.getById(mestoId);
  if (!mesto) return { success: false, error: 'Město nenalezeno' };
  if (mesto.user !== session.userId) return { success: false, error: 'Nemáš přístup k tomuto městu' };

  for (const [budovaIdStr, minLevel] of Object.entries(vConfig.pozadavkyBudova)) {
    const budovaId = Number(budovaIdStr);
    const budovaLevel = (mesto[`b${budovaId}` as keyof typeof mesto] as number) ?? 0;
    if (budovaLevel < minLevel) {
      return { success: false, error: `Vyžaduje budovu b${budovaId} na levelu ${minLevel}` };
    }
  }

  // Zkontroluj podmínky výzkumů
  for (const [reqIdStr, reqLevel] of Object.entries(vConfig.pozadavkyVyzkum)) {
    const reqId = Number(reqIdStr);
    const reqCurrentLevel = (user[`v${reqId}` as keyof typeof user] as number) ?? 0;
    if (reqCurrentLevel < reqLevel) {
      return { success: false, error: `Vyžaduje výzkum v${reqId} na levelu ${reqLevel}` };
    }
  }

  // Zkontroluj aktivní výzkum (typ=2)
  const pending = await akceRepo.getPendingByMesto(mestoId);
  const activeResearch = pending.find((a) => a.typ === 2);
  if (activeResearch) {
    return { success: false, error: 'Již probíhá výzkum' };
  }

  // Odečti peníze
  await userRepo.updatePenize(session.userId, user.penize - cena);

  // Vytvoř akci
  const now = Math.floor(Date.now() / 1000);
  await akceRepo.create({
    user: session.userId,
    mesto: mestoId,
    cil: mestoId,
    budova: vyzkumId,
    delka: cas,
    cas: now,
    dokonceni: now + cas,
    typ: 2,
    typ_jednotky: 0,
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
  });

  revalidatePath('/game/vyzkum');
  return { success: true };
}
