'use server';
import 'reflect-metadata';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { DatabaseService } from '@/db/DatabaseService';

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

export interface MapCity {
  id: number;
  x: number;
  y: number;
  jmeno: string;
  userjmeno: string;
  userId: number;
  populace: number;
  statjmeno: string;
  j1: number;
  j2: number;
  j3: number;
  j4: number;
  j5: number;
  j6: number;
  j7: number;
  j8: number;
}

export interface MapData {
  cities: MapCity[];
  myCity: MapCity | null;
  userId: number;
}

export async function fetchMapData(): Promise<MapData | null> {
  const session = await getSession();
  if (!session) return null;

  const db = new DatabaseService();
  const prisma = db.client;

  const allMesta = await prisma.mesto.findMany();

  const cities: MapCity[] = allMesta.map((m) => ({
    id: m.id,
    x: m.x,
    y: m.y,
    jmeno: m.jmeno,
    userjmeno: m.userjmeno,
    userId: m.user,
    populace: m.populace,
    statjmeno: m.statjmeno,
    j1: m.j1,
    j2: m.j2,
    j3: m.j3,
    j4: m.j4,
    j5: m.j5,
    j6: m.j6,
    j7: m.j7,
    j8: m.j8,
  }));

  const myCity = cities.find((c) => c.userId === session.userId) ?? null;

  return { cities, myCity, userId: session.userId };
}
