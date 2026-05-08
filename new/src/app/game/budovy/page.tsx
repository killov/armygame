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
import { BUDOVY, getBuildingUpgradeCost, getBuildingTime } from '@/lib/gameData';
import { startBuildingAction } from '@/app/actions/city';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'armygame-super-secret-jwt-key-2024-change-in-prod'
);

const BUDOVA_IKONY: Record<number, string> = {
  1: '🏛️',
  2: '🧱',
  3: '⚙️',
  4: '🛢️',
  5: '🌾',
  6: '📦',
  7: '🔬',
  8: '🏦',
  9: '🏪',
  10: '⚔️',
  11: '🔧',
};

export default async function BudovyPage() {
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

  // Zpracuj dokončené akce
  await cityService.processCompletedActions(city.id);

  // Suroviny (aktualizuje DB)
  const resources = await cityService.getResources(city.id);

  // Aktualizované město
  const updatedCity = await mestoRepo.getById(city.id);

  // Server Action
  async function handleUpgrade(formData: FormData) {
    'use server';
    const buildingId = Number(formData.get('buildingId'));
    const mestoId = Number(formData.get('mestoId'));
    await startBuildingAction(mestoId, buildingId);
    revalidatePath('/game/budovy');
    revalidatePath('/game/mesto');
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Budovy</h1>
      <div className={styles.grid}>
        {Object.entries(BUDOVY).map(([idStr, b]) => {
          const id = Number(idStr);
          const level =
            ((updatedCity?.[`b${id}` as keyof typeof updatedCity] as number) ?? 0);
          const isMax = level >= b.maximum;
          const cost = !isMax ? getBuildingUpgradeCost(id, level) : null;
          const buildTimeSec = !isMax ? getBuildingTime(id, level) : null;
          const buildTimeMin = buildTimeSec != null ? Math.floor(buildTimeSec / 60) : null;
          const buildTimeSecs = buildTimeSec != null ? buildTimeSec % 60 : null;

          // Požadavky
          const reqs = Object.entries(b.pozadavky);

          // Zkontroluj zda jsou splněny požadavky
          const reqsMet = reqs.every(([reqId, reqLevel]) => {
            const reqLvl = reqLevel as number;
            const actualLevel =
              ((updatedCity?.[`b${reqId}` as keyof typeof updatedCity] as number) ?? 0);
            return actualLevel >= reqLvl;
          });

          // Zkontroluj suroviny
          const hasResources =
            cost != null &&
            updatedCity != null &&
            updatedCity.surovina1 >= cost.surovina1 &&
            updatedCity.surovina2 >= cost.surovina2;

          const canUpgrade = !isMax && reqsMet && hasResources;

          return (
            <div key={id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>{BUDOVA_IKONY[id] ?? '🏗️'}</span>
                <div>
                  <div className={styles.cardName}>{b.nazev}</div>
                  <div className={styles.cardLevel}>
                    Level {level} / {b.maximum}
                  </div>
                </div>
              </div>

              <div className={styles.cardInfo}>
                {cost && (
                  <>
                    <div className={styles.cardInfoRow}>
                      <span className={styles.cardInfoLabel}>Cena upgradu:</span>
                      <span className={styles.cardInfoValue}>
                        {cost.surovina1} mat, {cost.surovina2} Fe
                      </span>
                    </div>
                    <div className={styles.cardInfoRow}>
                      <span className={styles.cardInfoLabel}>Čas stavby:</span>
                      <span className={styles.cardInfoValue}>
                        {buildTimeMin}m {buildTimeSecs}s
                      </span>
                    </div>
                  </>
                )}

                {reqs.length > 0 && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <span className={styles.cardInfoLabel}>Požadavky:</span>
                    {reqs.map(([reqId, reqLevel]) => {
                      const reqLvl = reqLevel as number;
                      const actualLevel =
                        ((updatedCity?.[`b${reqId}` as keyof typeof updatedCity] as number) ?? 0);
                      const met = actualLevel >= reqLvl;
                      const reqName = BUDOVY[Number(reqId)]?.nazev ?? `b${reqId}`;
                      return (
                        <div key={reqId} className={met ? styles.reqOk : styles.req}>
                          {met ? '✓' : '✗'} {reqName} lv.{reqLvl} (máš {actualLevel})
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isMax ? (
                <span className={styles.maxBadge}>MAX</span>
              ) : (
                <form action={handleUpgrade}>
                  <input type="hidden" name="buildingId" value={id} />
                  <input type="hidden" name="mestoId" value={city.id} />
                  <button
                    type="submit"
                    className={styles.upgradeBtn}
                    disabled={!canUpgrade}
                    title={
                      !reqsMet
                        ? 'Nesplněné požadavky'
                        : !hasResources
                        ? 'Nedostatek surovin'
                        : undefined
                    }
                  >
                    Vylepšit
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
