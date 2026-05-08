'use server';

import 'reflect-metadata';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { UserRepository } from '@/repositories/UserRepository';

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

const SELL_RATE = 0.8;
const BUY_RATE = 1.25; // 1 / 0.8

export async function sellAction(
  mestoId: number,
  s1: number,
  s2: number,
  s3: number,
  s4: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Nejsi přihlášen' };

  s1 = Math.floor(Math.max(0, s1));
  s2 = Math.floor(Math.max(0, s2));
  s3 = Math.floor(Math.max(0, s3));
  s4 = Math.floor(Math.max(0, s4));

  if (s1 + s2 + s3 + s4 === 0) {
    return { success: false, error: 'Musíš zadat alespoň jednu surovinu k prodeji' };
  }

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const userRepo = new UserRepository(db);

  const mesto = await mestoRepo.getById(mestoId);
  if (!mesto) return { success: false, error: 'Město nenalezeno' };
  if (mesto.user !== session.userId) return { success: false, error: 'Nemáš přístup k tomuto městu' };

  // Check building level
  if (mesto.b9 < 1) return { success: false, error: 'Tržiště není postaveno' };

  // Check resources
  if (mesto.surovina1 < s1) return { success: false, error: `Nedostatek stav. materiálu (máš ${mesto.surovina1})` };
  if (mesto.surovina2 < s2) return { success: false, error: `Nedostatek železa (máš ${mesto.surovina2})` };
  if (mesto.surovina3 < s3) return { success: false, error: `Nedostatek ropy (máš ${mesto.surovina3})` };
  if (mesto.surovina4 < s4) return { success: false, error: `Nedostatek jídla (máš ${mesto.surovina4})` };

  const totalMoney = Math.floor((s1 + s2 + s3 + s4) * SELL_RATE);

  // Deduct resources
  await mestoRepo.update(mestoId, {
    surovina1: mesto.surovina1 - s1,
    surovina2: mesto.surovina2 - s2,
    surovina3: mesto.surovina3 - s3,
    surovina4: mesto.surovina4 - s4,
  });

  // Add money to user
  const user = await userRepo.getById(session.userId);
  if (!user) return { success: false, error: 'Uživatel nenalezen' };
  await userRepo.updatePenize(session.userId, user.penize + totalMoney);

  revalidatePath('/game/budovy');
  revalidatePath('/game/mesto');

  return { success: true };
}

export async function buyAction(
  mestoId: number,
  resourceType: number,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Nejsi přihlášen' };

  amount = Math.floor(Math.max(0, amount));
  if (amount === 0) return { success: false, error: 'Musíš zadat množství' };
  if (resourceType < 1 || resourceType > 4) return { success: false, error: 'Neplatný typ suroviny' };

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const userRepo = new UserRepository(db);

  const mesto = await mestoRepo.getById(mestoId);
  if (!mesto) return { success: false, error: 'Město nenalezeno' };
  if (mesto.user !== session.userId) return { success: false, error: 'Nemáš přístup k tomuto městu' };

  if (mesto.b9 < 1) return { success: false, error: 'Tržiště není postaveno' };

  const cost = Math.ceil(amount * BUY_RATE);

  const user = await userRepo.getById(session.userId);
  if (!user) return { success: false, error: 'Uživatel nenalezen' };

  if (user.penize < cost) {
    return { success: false, error: `Nedostatek peněz (máš ${user.penize}, potřebuješ ${cost})` };
  }

  // Deduct money
  await userRepo.updatePenize(session.userId, user.penize - cost);

  // Add resources
  const resourceKey = `surovina${resourceType}` as keyof typeof mesto;
  const currentAmount = mesto[resourceKey] as number;
  await mestoRepo.update(mestoId, {
    [resourceKey]: currentAmount + amount,
  });

  revalidatePath('/game/budovy');
  revalidatePath('/game/mesto');

  return { success: true };
}
