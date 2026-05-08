import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { CityService } from '@/services/CityService';
import { VYZKUMY, vyzkumCena, vyzkumCas } from '@/lib/vyzkumData';
import { startResearchAction } from '@/app/actions/research';

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

export default async function VyzkumPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const userRepo = new UserRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  const cities = await mestoRepo.getByUserId(session.userId);
  const mesto = cities[0] ?? null;

  if (!mesto) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>⚗️ Výzkum</h1>
        <p>Nemáš žádné město.</p>
      </div>
    );
  }

  // Zpracuj dokončené výzkumy
  await cityService.processResearchActions(session.userId, mesto.id);

  // Načti aktuálního uživatele (po zpracování akcí)
  const user = await userRepo.getById(session.userId);
  if (!user) redirect('/login');

  // Načti frontu akcí
  const pending = await akceRepo.getPendingByMesto(mesto.id);
  const activeResearch = pending.find((a) => a.typ === 2) ?? null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>⚗️ Výzkum</h1>
      <div className={styles.wallet}>
        💰 Peníze: <strong>{user.penize.toLocaleString('cs-CZ')}</strong>
      </div>

      {activeResearch && (
        <div className={styles.activeResearch}>
          🔬 Probíhá: {VYZKUMY[activeResearch.budova!]?.nazev} →&nbsp;
          dokončení {new Date(activeResearch.dokonceni * 1000).toLocaleString('cs-CZ')}
        </div>
      )}

      <div className={styles.grid}>
        {Object.entries(VYZKUMY).map(([idStr, v]) => {
          const id = Number(idStr);
          const level = (user[`v${id}` as keyof typeof user] as number) ?? 0;
          const isMax = level >= v.maximum;
          const cena = !isMax ? vyzkumCena(id, level) : 0;
          const cas = !isMax ? vyzkumCas(id, level) : 0;
          const canAfford = user.penize >= cena;
          const hasBuilding = Object.entries(v.pozadavkyBudova).every(([budovaIdStr, minLevel]) => {
            const budovaId = Number(budovaIdStr);
            const budovaLevel = (mesto[`b${budovaId}` as keyof typeof mesto] as number) ?? 0;
            return budovaLevel >= minLevel;
          });
          const hasResearch = Object.entries(v.pozadavkyVyzkum).every(([reqId, reqLvl]) =>
            ((user[`v${reqId}` as keyof typeof user] as number) ?? 0) >= reqLvl
          );
          const canResearch = canAfford && hasBuilding && hasResearch && !isMax && !activeResearch;

          return (
            <div key={id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardEmoji}>{v.emoji}</span>
                <div>
                  <div className={styles.cardName}>{v.nazev}</div>
                  <div className={styles.cardLevel}>Level {level} / {v.maximum}</div>
                </div>
              </div>
              <div className={styles.progress}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${(level / v.maximum) * 100}%` }}
                />
              </div>
              <p className={styles.cardDesc}>{v.popis}</p>
              {!isMax && (
                <div className={styles.cardCost}>
                  💰 Cena:{' '}
                  <strong className={canAfford ? styles.ok : styles.notOk}>
                    {cena} peněz
                  </strong>
                  &nbsp;⏱ Čas: {Math.floor(cas / 60)}m {cas % 60}s
                </div>
              )}
              {!hasBuilding && (
                <p className={styles.req}>
                  ⚠ Vyžaduje Hlavní budovu level{' '}
                  {Object.entries(v.pozadavkyBudova)
                    .map(([bid, lvl]) => `b${bid} lvl ${lvl}`)
                    .join(', ')}
                </p>
              )}
              {!hasResearch && (
                <p className={styles.req}>⚠ Vyžaduje předchozí výzkumy</p>
              )}
              {!isMax ? (
                <form
                  action={async (fd) => {
                    'use server';
                    await startResearchAction(Number(fd.get('mestoId')), id);
                  }}
                >
                  <input type="hidden" name="mestoId" value={mesto?.id ?? 0} />
                  <button type="submit" className={styles.btn} disabled={!canResearch}>
                    {activeResearch ? '⏳ Probíhá výzkum...' : 'Zkoumat →'}
                  </button>
                </form>
              ) : (
                <div className={styles.maxBadge}>✓ Maximální úroveň</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
