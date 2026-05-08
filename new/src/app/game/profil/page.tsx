import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import styles from './page.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { UserRepository } from '@/repositories/UserRepository';
import { MestoRepository } from '@/repositories/MestoRepository';

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

const RESEARCH_NAMES: Record<number, string> = {
  1: 'Ekonomika',
  2: 'Armáda',
  3: 'Obrana',
  4: 'Technologie',
  5: 'Diplomacie',
};

export default async function ProfilPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = new DatabaseService();
  const userRepo = new UserRepository(db);
  const mestoRepo = new MestoRepository(db);

  const user = await userRepo.getById(session.userId);
  if (!user) redirect('/login');

  const mesta = await mestoRepo.getByUserId(session.userId);

  const totalPop = mesta.reduce((sum, m) => sum + m.populace, 0);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.avatar}>⚔️</div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{user.jmeno}</h1>
          <p className={styles.subtitle}>{user.statjmeno || 'Bez státu'}</p>
        </div>
      </div>

      {/* Statistiky */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Statistiky</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>💰</span>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Peníze</span>
              <span className={styles.statValue}>{user.penize.toLocaleString('cs-CZ')}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>🏦</span>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Banka</span>
              <span className={styles.statValue}>{user.banka.toLocaleString('cs-CZ')}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>🏰</span>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Měst</span>
              <span className={styles.statValue}>{mesta.length}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>👥</span>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Populace</span>
              <span className={styles.statValue}>{totalPop.toLocaleString('cs-CZ')}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>📊</span>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Pořadí</span>
              <span className={styles.statValue}>#{user.poradi}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>🌐</span>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Spojenectví</span>
              <span className={styles.statValue}>{user.sp_all}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Výzkumy */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Výzkumy</h2>
        <div className={styles.researchGrid}>
          {([1, 2, 3, 4, 5] as const).map((i) => {
            const level = user[`v${i}` as 'v1' | 'v2' | 'v3' | 'v4' | 'v5'];
            return (
              <div key={i} className={styles.researchCard}>
                <div className={styles.researchHeader}>
                  <span className={styles.researchIcon}>🔬</span>
                  <span className={styles.researchName}>{RESEARCH_NAMES[i]}</span>
                </div>
                <div className={styles.researchLevel}>
                  <span className={styles.researchLevelLabel}>Úroveň</span>
                  <span className={styles.researchLevelValue}>{level}</span>
                </div>
                <div className={styles.researchBar}>
                  <div
                    className={styles.researchBarFill}
                    style={{ width: `${Math.min(100, (level / 10) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Moje města */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Moje města ({mesta.length})</h2>
        {mesta.length === 0 ? (
          <p className={styles.noData}>Nemáte žádné město.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Název</th>
                  <th>Pozice</th>
                  <th>Populace</th>
                  <th>Typ</th>
                  <th>Stát</th>
                </tr>
              </thead>
              <tbody>
                {mesta.map((m) => (
                  <tr key={m.id}>
                    <td className={styles.cityName}>{m.jmeno}</td>
                    <td>({m.x}, {m.y})</td>
                    <td>{m.populace.toLocaleString('cs-CZ')}</td>
                    <td>{m.typ}</td>
                    <td>{m.statjmeno || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
