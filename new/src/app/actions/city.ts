'use server';

import 'reflect-metadata';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { CityService } from '@/services/CityService';

export async function startBuildingAction(
  mestoId: number,
  buildingId: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Nejsi přihlášen' };

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  const result = await cityService.startBuilding(session.userId, mestoId, buildingId);

  if (result.success) {
    revalidatePath('/game/mesto');
    revalidatePath('/game/budovy');
    revalidatePath('/game');
  }

  return result;
}
