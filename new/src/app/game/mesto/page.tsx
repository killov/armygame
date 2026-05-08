import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { CityService } from '@/services/CityService';
import { BUDOVY, getBuildingUpgradeCost, getBuildingTime, produkce, skladKapacita } from '@/lib/gameData';
import { startBuildingAction } from '@/app/actions/city';
import { BattleService } from '@/services/BattleService';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'armygame-super-secret-jwt-key-2024-change-in-prod'
);

export default async function MestoPage() {
  // 1. Session
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

  // 2. Services
  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  // 3. Města
  const cities = await mestoRepo.getByUserId(session.userId);
  const city = cities[0] ?? null;

  if (!city) {
    return <div className={styles.noCity}>Nemáš žádné město...</div>;
  }

  // 4. Zpracuj dokončené akce
  await cityService.processCompletedActions(city.id);

  // Zpracuj příchozí útoky
  const battleService = new BattleService(mestoRepo, akceRepo, db);
  await battleService.processArrivals(city.id);

  // 5. Suroviny
  const resources = await cityService.getResources(city.id);

  // 6. Aktualizované město
  const updatedCity = await mestoRepo.getById(city.id);

  // 7. Fronta
  const queue = await akceRepo.getPendingByMesto(city.id);

  // Server Action pro stavbu
  async function handleUpgrade(formData: FormData) {
    'use server';
    const buildingId = Number(formData.get('buildingId'));
    const mestoId = Number(formData.get('mestoId'));
    await startBuildingAction(mestoId, buildingId);
    revalidatePath('/game/mesto');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.cityName}>{city.jmeno}</h1>
        <p className={styles.cityPos}>
          Pozice: [{city.x}, {city.y}] | Populace: {updatedCity?.populace ?? city.populace}
        </p>
      </div>

      {/* 4 resource cards */}
      <div className={styles.resourcesGrid}>
        {[
          { icon: '🧱', label: 'Stav. materiál', value: resources.s1, prod: produkce(updatedCity?.b2 ?? 0) },
          { icon: '⚙️', label: 'Železo', value: resources.s2, prod: produkce(updatedCity?.b3 ?? 0) },
          { icon: '🛢️', label: 'Ropa', value: resources.s3, prod: produkce(updatedCity?.b4 ?? 0) },
          { icon: '🌾', label: 'Jídlo', value: resources.s4, prod: produkce(updatedCity?.b5 ?? 0) },
        ].map((r) => (
          <div key={r.label} className={styles.resourceCard}>
            <span className={styles.resourceCardIcon}>{r.icon}</span>
            <span className={styles.resourceCardName}>{r.label}</span>
            <span className={styles.resourceCardValue}>{r.value.toLocaleString('cs-CZ')}</span>
            <span className={styles.resourceCardProd}>+{r.prod.toLocaleString('cs-CZ')}/h</span>
            <span className={styles.resourceCardCap}>Sklad: {resources.sklad.toLocaleString('cs-CZ')}</span>
          </div>
        ))}
      </div>

      {/* Fronta staveb */}
      <h2 className={styles.sectionTitle}>Fronta staveb</h2>
      <div className={styles.queue}>
        {queue.filter((a) => a.typ === 1).length === 0 ? (
          <p className={styles.queueEmpty}>Fronta je prázdná</p>
        ) : (
          <ul className={styles.queueList}>
            {queue
              .filter((a) => a.typ === 1)
              .map((a) => (
                <li key={a.id} className={styles.queueItem}>
                  <span className={styles.queueIcon}>🏗️</span>
                  <span className={styles.queueName}>
                    {BUDOVY[a.budova ?? 0]?.nazev ?? 'Budova'} → level{' '}
                    {((updatedCity?.[`b${a.budova}` as keyof typeof updatedCity] as number) ?? 0) + 1}
                  </span>
                  <span className={styles.queueTime}>
                    Hotovo: {new Date(a.dokonceni * 1000).toLocaleString('cs-CZ')}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Tabulka budov */}
      <h2 className={styles.sectionTitle}>Budovy</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Budova</th>
              <th>Level</th>
              <th>Max</th>
              <th>Cena upgradu</th>
              <th>Čas</th>
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(BUDOVY).map(([idStr, b]) => {
              const id = Number(idStr);
              const level =
                ((updatedCity?.[`b${id}` as keyof typeof updatedCity] as number) ?? 0);
              const isMax = level >= b.maximum;
              const cost = !isMax ? getBuildingUpgradeCost(id, level) : null;
              const buildTime = !isMax ? getBuildingTime(id, level) : null;
              const canUpgrade =
                cost &&
                updatedCity &&
                updatedCity.surovina1 >= cost.surovina1 &&
                updatedCity.surovina2 >= cost.surovina2;
              return (
                <tr key={id}>
                  <td>{b.nazev}</td>
                  <td>
                    {isMax ? (
                      <span className={styles.maxBadge}>MAX</span>
                    ) : (
                      <span className={styles.levelBadge}>{level}</span>
                    )}
                  </td>
                  <td>{b.maximum}</td>
                  <td>{cost ? `${cost.surovina1} mat, ${cost.surovina2} Fe` : '—'}</td>
                  <td>{buildTime ? `${buildTime}s` : '—'}</td>
                  <td>
                    {!isMax && (
                      <form action={handleUpgrade}>
                        <input type="hidden" name="buildingId" value={id} />
                        <input type="hidden" name="mestoId" value={city.id} />
                        <button
                          type="submit"
                          className={styles.upgradeBtn}
                          disabled={!canUpgrade}
                          title={!canUpgrade ? 'Nedostatek surovin' : undefined}
                        >
                          Vylepšit
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
