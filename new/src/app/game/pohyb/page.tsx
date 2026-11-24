import 'reflect-metadata';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { akce } from '@prisma/client';

export default async function PohybPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const db = new DatabaseService();
  const movements: akce[] = await db.client.akce.findMany({
    where: { user: session.userId, typ: 6 },
    orderBy: { dokonceni: 'asc' },
  });

  // Server Component se renderuje jednou na request, čas requestu je tu záměr.
  // eslint-disable-next-line react-hooks/purity
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>⚔️ Vojenské operace</h1>
      {movements.length === 0 ? (
        <p className={styles.empty}>Žádné aktivní operace.</p>
      ) : (
        <div className={styles.list}>
          {movements.map((m) => {
            const remaining = m.dokonceni - now;
            const unitCount = [1, 2, 3, 4, 5, 6, 7, 8].reduce(
              (s, i) => s + (((m as Record<string, unknown>)[`j${i}`] as number) ?? 0),
              0,
            );
            return (
              <div key={m.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span>⚔️ Útok na město ID {m.cil}</span>
                  <span className={styles.time}>
                    {remaining > 0
                      ? `Za ${Math.floor(remaining / 60)}m ${remaining % 60}s`
                      : 'Dorazilo'}
                  </span>
                </div>
                <div className={styles.units}>Jednotky: {unitCount} celkem</div>
                <div className={styles.meta}>
                  Ze města ID {m.mesto} &bull; Dokončení:{' '}
                  {new Date(m.dokonceni * 1000).toLocaleString('cs-CZ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
