// Engine herních událostí — náhrada inc/akce.php a bin/daemon.php. Pouští ho worker (scripts/worker.ts)
// v intervalu a herní stránky při requestu, ať hráč vidí aktuální stav i bez běžícího workeru.
import type { PrismaClient } from '@prisma/client';
import { zpracujAkce } from './akce';
import { zpracujHladomor } from './hladomor';

export { zpracujUlohy } from './ulohy';

export const unixNow = () => Math.floor(Date.now() / 1000);

/** Provede splatné akce a pak zkontroluje hladomor — stejné pořadí jako inc/akce.php. */
export async function dohonStav(prisma: PrismaClient, now = unixNow()): Promise<void> {
  await zpracujAkce(prisma, now);
  await zpracujHladomor(prisma, now);
}
