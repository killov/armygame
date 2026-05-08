import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { CityService } from '@/services/CityService';
import { JEDNOTKY } from '@/lib/armyData';
import { trainUnitsAction } from '@/app/actions/army';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'armygame-super-secret-jwt-key-2024-change-in-prod'
);

export default async function JednotkyPage() {
  // Session
  const cookieStore = await cookies();
  const token = cookieStore.get('armygame_session')?.value;
  let session: { userId: number; jmeno: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = payload as { userId: number; jmeno: string };
    } catch {
      session = null;
    }
  }
  if (!session) redirect('/login');

  // Services
  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  // Město
  const cities = await mestoRepo.getByUserId(session.userId);
  const city = cities[0] ?? null;

  if (!city) {
    return <div className={styles.noCity}>Nemáš žádné město...</div>;
  }

  // Zpracuj dokončené stavby a jednotky
  await cityService.processCompletedActions(city.id);
  await cityService.processUnitActions(city.id);

  // Suroviny (aktualizuje DB)
  const resources = await cityService.getResources(city.id);

  // Aktualizované město po zpracování akcí
  const updatedCity = await mestoRepo.getById(city.id);

  // Fronta výcviku (nezpracované akce typ=5)
  const allPending = await akceRepo.getPendingByMesto(city.id);
  const trainQueue = allPending.filter((a) => a.typ === 5);

  // Server Action wrapper
  async function handleTrain(formData: FormData) {
    'use server';
    const mestoId = Number(formData.get('mestoId'));
    const jednotkaId = Number(formData.get('jednotkaId'));
    const pocet = Number(formData.get('pocet'));
    await trainUnitsAction(mestoId, jednotkaId, pocet);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Jednotky</h1>

      {/* ===== Přehled jednotek ===== */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Přehled jednotek v městě</h2>
        {(() => {
          const unitsInCity = Object.entries(JEDNOTKY).filter(([idStr]) => {
            const key = `j${idStr}` as keyof typeof updatedCity;
            return updatedCity && ((updatedCity[key] as number) ?? 0) > 0;
          });

          if (unitsInCity.length === 0) {
            return <p className={styles.noUnits}>Žádné jednotky v městě.</p>;
          }

          return (
            <table className={styles.overviewTable}>
              <thead>
                <tr>
                  <th>Jednotka</th>
                  <th>Počet</th>
                  <th>Rychlost</th>
                  <th>Nosnost</th>
                  <th>Nosnost pěchoty</th>
                </tr>
              </thead>
              <tbody>
                {unitsInCity.map(([idStr, j]) => {
                  const id = Number(idStr);
                  const key = `j${id}` as keyof typeof updatedCity;
                  const count = updatedCity ? ((updatedCity[key] as number) ?? 0) : 0;
                  return (
                    <tr key={id}>
                      <td>
                        <span className={styles.unitEmoji}>{j.emoji}</span>{' '}
                        {j.nazev}
                      </td>
                      <td>
                        <span className={styles.unitCount}>{count}</span>
                      </td>
                      <td>{j.rychlost}</td>
                      <td>{j.nosnost > 0 ? j.nosnost : '—'}</td>
                      <td>{j.nosnostPechoty > 0 ? j.nosnostPechoty : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>

      {/* ===== Výcvik jednotek ===== */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Výcvik jednotek</h2>
        <div className={styles.trainGrid}>
          {Object.entries(JEDNOTKY).map(([idStr, j]) => {
            const id = Number(idStr);
            const hasS2 = resources.s2 >= j.surovina2;
            const hasS3 = j.surovina3 === 0 || resources.s3 >= j.surovina3;
            const hasS4 = j.surovina4 === 0 || resources.s4 >= j.surovina4;
            const canTrain = hasS2 && hasS3 && hasS4;

            const trainTime = j.cas >= 60
              ? `${Math.floor(j.cas / 60)}m ${j.cas % 60}s`
              : `${j.cas}s`;

            return (
              <div key={id} className={styles.trainCard}>
                <div className={styles.trainCardHeader}>
                  <span className={styles.trainIcon}>{j.emoji}</span>
                  <span className={styles.trainName}>{j.nazev}</span>
                </div>

                <div className={styles.trainCost}>
                  <span className={hasS2 ? styles.trainCostItem : styles.trainCostItemMissing}>
                    ⚙️ <strong>{j.surovina2}</strong> Fe
                  </span>
                  {j.surovina3 > 0 && (
                    <span className={hasS3 ? styles.trainCostItem : styles.trainCostItemMissing}>
                      🛢️ <strong>{j.surovina3}</strong> Ropa
                    </span>
                  )}
                  {j.surovina4 > 0 && (
                    <span className={hasS4 ? styles.trainCostItem : styles.trainCostItemMissing}>
                      🌾 <strong>{j.surovina4}</strong> Jídlo
                    </span>
                  )}
                </div>

                <div className={styles.trainTimeRow}>
                  <span>⏱ {trainTime}/ks</span>
                  {j.rychlost > 0 && <span>🏃 {j.rychlost}</span>}
                  {j.nosnostPechoty > 0 && <span>👥 {j.nosnostPechoty} pěch.</span>}
                </div>

                <form action={handleTrain} className={styles.trainForm}>
                  <input type="hidden" name="mestoId" value={city.id} />
                  <input type="hidden" name="jednotkaId" value={id} />
                  <input
                    type="number"
                    name="pocet"
                    min={1}
                    max={50}
                    defaultValue={1}
                    className={styles.trainInput}
                  />
                  <button
                    type="submit"
                    className={styles.trainBtn}
                    disabled={!canTrain}
                    title={!canTrain ? 'Nedostatek surovin' : undefined}
                  >
                    Vycvičit
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Fronta výcviku ===== */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Fronta výcviku</h2>
        {trainQueue.length === 0 ? (
          <p className={styles.noQueue}>Fronta výcviku je prázdná.</p>
        ) : (
          <div className={styles.queueList}>
            {trainQueue.map((akce) => {
              const j = JEDNOTKY[akce.typ_jednotky];
              const countKey = `j${akce.typ_jednotky}` as keyof typeof akce;
              const count = (akce[countKey] as number) ?? 0;
              const dokonceniDate = new Date(akce.dokonceni * 1000);
              const timeStr = dokonceniDate.toLocaleTimeString('cs-CZ', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div key={akce.id} className={styles.queueItem}>
                  <span className={styles.queueEmoji}>{j?.emoji ?? '❓'}</span>
                  <span className={styles.queueText}>
                    {j?.nazev ?? `Jednotka ${akce.typ_jednotky}`}{' '}
                    <span className={styles.queueCount}>×{count}</span>
                  </span>
                  <span className={styles.queueTime}>Hotovo: {timeStr}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
