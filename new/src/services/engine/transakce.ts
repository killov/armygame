import { Prisma, type PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

const MAX_POKUSU = 3;
// InnoDB deadlock a lock wait timeout — transakci zabije celou, takže ji jde bezpečně zopakovat.
const MYSQL_KONFLIKTY = new Set(['1213', '1205']);

export function jeKonflikt(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return err.code === 'P2034' || (err.code === 'P2010' && MYSQL_KONFLIKTY.has(String(err.meta?.code)));
}

/** Interaktivní transakce, která při deadlocku (dva workery nad stejnými městy) zkusí znovu. */
export async function vTransakci<T>(
  prisma: PrismaClient,
  fn: (tx: Tx) => Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  for (let pokus = 1; ; pokus++) {
    try {
      return await prisma.$transaction(fn, options);
    } catch (err) {
      if (pokus >= MAX_POKUSU || !jeKonflikt(err)) throw err;
    }
  }
}
