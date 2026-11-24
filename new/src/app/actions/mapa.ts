'use server';
import 'reflect-metadata';
import { getSession } from '@/lib/session';
import { DatabaseService } from '@/db/DatabaseService';

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
