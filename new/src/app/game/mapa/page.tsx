import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { mapa, mesto } from '@prisma/client';
import { sendAttackAction } from '@/app/actions/battle';

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
  } catch { return null; }
}

export default async function MapaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);

  const prisma = db.client;

  // Moje města
  const myMesta = await mestoRepo.getByUserId(session.userId);
  const myCity = myMesta[0] ?? null;
  const myCityIds = new Set(myMesta.map((m) => m.id));

  // Všechna města na mapě (typ=1)
  const mapaCities: mapa[] = await prisma.mapa.findMany({ where: { typ: 1 } });

  // Všechna města pro detail (max 200)
  const allMesta: mesto[] = await prisma.mesto.findMany({ take: 200 });
  const mestaMap = new Map<number, mesto>(allMesta.map((m) => [m.id, m]));

  // Mřížka 20×20 bloků (každý blok = rozsah 10 souřadnic)
  type CellCity = { mapRow: mapa; mesto: mesto | null };
  const cellMap = new Map<string, CellCity>();
  for (const mc of mapaCities) {
    const col = Math.min(19, Math.max(0, Math.floor(mc.x / 10)));
    const row = Math.min(19, Math.max(0, Math.floor(mc.y / 10)));
    const key = `${row}-${col}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { mapRow: mc, mesto: mestaMap.get(mc.dom) ?? null });
    }
  }

  async function sendAttackFormAction(formData: FormData) {
    'use server';
    const fromMestoId = Number(formData.get('fromMestoId'));
    const toMestoId = Number(formData.get('toMestoId'));
    const units: Record<number, number> = {};
    for (let i = 1; i <= 8; i++) {
      const v = Number(formData.get(`j${i}`)) || 0;
      if (v > 0) units[i] = v;
    }
    await sendAttackAction(fromMestoId, toMestoId, units);
    revalidatePath('/game/mapa');
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Mapa světa</h1>

      <div className={styles.mapContainer}>
        <div>
          <div className={styles.grid}>
            {Array.from({ length: 20 }, (_, row) =>
              Array.from({ length: 20 }, (_, col) => {
                const key = `${row}-${col}`;
                const cell = cellMap.get(key);
                const isMyCity = cell ? myCityIds.has(cell.mapRow.dom) : false;
                const cityName = cell?.mesto?.jmeno ?? `#${cell?.mapRow.dom}`;
                const ownerName = cell?.mesto?.userjmeno ?? '?';

                let cellClass = styles.cell;
                if (cell) cellClass += ` ${isMyCity ? styles.myCity : styles.cityCell}`;

                return (
                  <div
                    key={key}
                    className={cellClass}
                    title={
                      cell
                        ? `${cityName} (${cell.mapRow.x},${cell.mapRow.y}) – ${ownerName}`
                        : ''
                    }
                  >
                    {cell ? (isMyCity ? '🏠' : '🏰') : ''}
                  </div>
                );
              })
            )}
          </div>
          <div className={styles.legend}>
            <div><span className={`${styles.dot} ${styles.myDot}`}></span> Moje město</div>
            <div><span className={`${styles.dot} ${styles.cityDot}`}></span> Cizí město</div>
            <div><span className={`${styles.dot} ${styles.emptyDot}`}></span> Prázdné</div>
          </div>
        </div>

        <div className={styles.infoPanel}>
          <p className={styles.infoPanelHint}>Najeď myší na město pro detail.</p>
          {myCity && (
            <div className={styles.myInfo}>
              <h3>Moje město</h3>
              <p><strong>{myCity.jmeno}</strong></p>
              <p>Pozice: ({myCity.x}, {myCity.y})</p>
              <p>Stát: {myCity.statjmeno || '—'}</p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cityList}>
        <h2 className={styles.sectionTitle}>Města na mapě ({mapaCities.length})</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Název</th>
                <th>Vlastník</th>
                <th>Pozice</th>
                <th>Stát</th>
                <th>Populace</th>
              </tr>
            </thead>
            <tbody>
              {mapaCities.map((mc) => {
                const m = mestaMap.get(mc.dom);
                const isOwn = myCityIds.has(mc.dom);
                return (
                  <tr key={mc.id} className={isOwn ? styles.ownRow : undefined}>
                    <td>{m?.jmeno ?? `#${mc.dom}`}</td>
                    <td>{m?.userjmeno ?? '?'}</td>
                    <td>({mc.x}, {mc.y})</td>
                    <td>{m?.statjmeno || '—'}</td>
                    <td>{m?.populace?.toLocaleString('cs-CZ') ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.attackSection}>
        <h2>Zaútočit na město</h2>
        <form action={sendAttackFormAction}>
          <div className={styles.formRow}>
            <label>Cílové město ID:</label>
            <input type="number" name="toMestoId" className={styles.input} required />
          </div>
          <div className={styles.formRow}>
            <label>Jednotky (počty):</label>
            <div className={styles.unitsGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className={styles.unitInput}>
                  <label>j{i}:</label>
                  <input
                    type="number"
                    name={`j${i}`}
                    min="0"
                    defaultValue="0"
                    className={styles.smallInput}
                  />
                  <span>/{String((myCity as Record<string, unknown>)?.[`j${i}`] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
          <input type="hidden" name="fromMestoId" value={myCity?.id ?? 0} />
          <button type="submit" className={styles.attackBtn}>⚔️ Zaútočit</button>
        </form>
      </div>
    </div>
  );
}
