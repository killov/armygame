// Worker herních událostí, náhrada bin/daemon.php: v intervalu provádí splatné akce, hladomor
// a úlohy z tabulky tasks. Víc instancí naráz je bezpečných, akce si rozeberou přes zámky v DB.
import { setTimeout as sleep } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { dohonStav, zpracujUlohy } from '../src/services/engine';

const INTERVAL_MS = 5000;

const prisma = new PrismaClient();
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => stop.abort());

async function main(): Promise<void> {
  console.info('engine: start');
  while (!stop.signal.aborted) {
    try {
      await dohonStav(prisma);
      await zpracujUlohy(prisma);
    } catch (err) {
      console.error('engine: průchod selhal', err);
    }
    await sleep(INTERVAL_MS, undefined, { signal: stop.signal }).catch(() => undefined);
  }
  console.info('engine: stop');
}

main().finally(() => prisma.$disconnect());
