import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { akce } from '@prisma/client';

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

export default async function PohybPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = new DatabaseService();
  const movements: akce[] = await db.client.akce.findMany({
    where: { user: session.userId, typ: 6 },
    orderBy: { dokonceni: 'asc' },
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>⚔️ Vojenské operace</h1>
      {movements.length === 0 ? (
        <p className={styles.empty}>Žádné aktivní operace.</p>
      ) : (
        <div className={styles.list}>
          {movements.map((m) => {
            const now = Math.floor(Date.now() / 1000);
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
