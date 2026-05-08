'use server';

import 'reflect-metadata';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { CityService } from '@/services/CityService';

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
