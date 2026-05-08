import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import Link from 'next/link';
import styles from './layout.module.scss';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { CityService } from '@/services/CityService';
import { produkce } from '@/lib/gameData';
import { JEDNOTKY } from '@/lib/armyData';
import ResourceBar from './ResourceBar';
import MapBackground from './MapBackground';

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

async function logoutAction() {
  'use server';
  const cookieStore = await cookies();
  cookieStore.delete('armygame_session');
  redirect('/login');
}

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  const cities = await mestoRepo.getByUserId(session.userId);
  const city = cities[0] ?? null;

  let resources = null;
  let resourceBarProps = null;
  if (city) {
    try {
      resources = await cityService.getResources(city.id);
      const surovinyTime = Math.floor(Date.now() / 1000);
      resourceBarProps = {
        initialS1: resources.s1,
        initialS2: resources.s2,
        initialS3: resources.s3,
        initialS4: resources.s4,
        prodS1: produkce(city.b2),
        prodS2: produkce(city.b3),
        prodS3: produkce(city.b4),
        prodS4: produkce(city.b5),
        sklad: resources.sklad,
        surovinyTime,
      };
    } catch {
      // Pokud selze nacteni surovin, pokracuj bez nich
    }
  }

  // Gather unit counts for sidebar
  const unitEntries = city
    ? Object.entries(JEDNOTKY)
        .map(([idStr, j]) => {
          const id = Number(idStr);
          const key = `j${id}` as keyof typeof city;
          const count = (city[key] as number) ?? 0;
          return { id, name: j.nazev, emoji: j.emoji, count };
        })
        .filter((u) => u.count > 0)
    : [];

  return (
    <div className={styles.gameLayout}>
      <MapBackground />

      {/* ===== TOP BAR ===== */}
      <div className={styles.topBar}>
        <Link href="/game" className={styles.logo}>
          ArmyGame
        </Link>

        <ul className={styles.navLinks}>
          <li>
            <Link href="/game/mesto" className={styles.navLink}>
              Mesto
            </Link>
          </li>
          <li><span className={styles.navSeparator}>|</span></li>
          <li>
            <Link href="/game/budovy" className={styles.navLink}>
              Budovy
            </Link>
          </li>
          <li><span className={styles.navSeparator}>|</span></li>
          <li>
            <Link href="/game/jednotky" className={styles.navLink}>
              Jednotky
            </Link>
          </li>
          <li><span className={styles.navSeparator}>|</span></li>
          <li>
            <Link href="/game/mapa" className={styles.navLink}>
              Mapa
            </Link>
          </li>
          <li><span className={styles.navSeparator}>|</span></li>
          <li>
            <Link href="/game/vyzkum" className={styles.navLink}>
              Vyzkum
            </Link>
          </li>
          <li><span className={styles.navSeparator}>|</span></li>
          <li>
            <Link href="/game/pohyb" className={styles.navLink}>
              Operace
            </Link>
          </li>
          <li><span className={styles.navSeparator}>|</span></li>
          <li>
            <Link href="/game/profil" className={styles.navLink}>
              Profil
            </Link>
          </li>
        </ul>

        {resourceBarProps ? (
          <ResourceBar {...resourceBarProps} />
        ) : (
          <div className={styles.topResources}>
            <span className={styles.resourceBadge}>---</span>
          </div>
        )}

        <form action={logoutAction}>
          <button type="submit" className={styles.logoutBtn}>
            Odhlasit
          </button>
        </form>
      </div>

      {/* ===== BODY: sidebar + main ===== */}
      <div className={styles.bodyWrapper}>
        {/* Left sidebar - units overview */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>
            {city ? city.jmeno : 'Zadne mesto'}
          </div>

          <div className={styles.sidebarTitle}>Jednotky</div>
          {unitEntries.length === 0 ? (
            <div className={styles.sidebarEmpty}>Zadne jednotky</div>
          ) : (
            unitEntries.map((u) => (
              <div key={u.id} className={styles.sidebarUnit}>
                <span className={styles.sidebarUnitName}>
                  {u.emoji} {u.name}
                </span>
                <span className={styles.sidebarUnitCount}>{u.count}</span>
              </div>
            ))
          )}

          {resources && (
            <div className={styles.sidebarResources}>
              <div className={styles.sidebarTitle}>Suroviny</div>
              <div className={styles.sidebarResItem}>
                <span className={styles.sidebarResName}>Material</span>
                <span className={styles.sidebarResValue}>
                  {resources.s1.toLocaleString('cs-CZ')}
                </span>
              </div>
              <div className={styles.sidebarResItem}>
                <span className={styles.sidebarResName}>Zelezo</span>
                <span className={styles.sidebarResValue}>
                  {resources.s2.toLocaleString('cs-CZ')}
                </span>
              </div>
              <div className={styles.sidebarResItem}>
                <span className={styles.sidebarResName}>Ropa</span>
                <span className={styles.sidebarResValue}>
                  {resources.s3.toLocaleString('cs-CZ')}
                </span>
              </div>
              <div className={styles.sidebarResItem}>
                <span className={styles.sidebarResName}>Jidlo</span>
                <span className={styles.sidebarResValue}>
                  {resources.s4.toLocaleString('cs-CZ')}
                </span>
              </div>
              <div className={styles.sidebarResItem}>
                <span className={styles.sidebarResName}>Sklad</span>
                <span className={styles.sidebarResValue}>
                  {resources.sklad.toLocaleString('cs-CZ')}
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* Main content area */}
        <main className={styles.main}>
          <div className={styles.contentInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
