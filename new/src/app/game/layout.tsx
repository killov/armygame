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

  // Načti suroviny prvního města uživatele
  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  const cities = await mestoRepo.getByUserId(session.userId);
  const city = cities[0] ?? null;

  let resources = null;
  if (city) {
    try {
      resources = await cityService.getResources(city.id);
    } catch {
      // Pokud selže načtení surovin, pokračuj bez nich
    }
  }

  const cityForProd = city;

  return (
    <div className={styles.gameLayout}>
      <nav className={styles.nav}>
        <Link href="/game" className={styles.logo}>
          ArmyGame
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/game/mesto" className={styles.navLink}>
              Město
            </Link>
          </li>
          <li>
            <Link href="/game/budovy" className={styles.navLink}>
              Budovy
            </Link>
          </li>
          <li>
            <Link href="/game/jednotky" className={styles.navLink}>
              Jednotky
            </Link>
          </li>
          <li>
            <Link href="/game/mapa" className={styles.navLink}>
              Mapa
            </Link>
          </li>
          <li>
            <Link href="/game/vyzkum" className={styles.navLink}>
              Výzkum
            </Link>
          </li>
          <li>
            <Link href="/game/profil" className={styles.navLink}>
              Profil
            </Link>
          </li>
        </ul>
        <form action={logoutAction}>
          <button type="submit" className={styles.logoutBtn}>
            Odhlásit
          </button>
        </form>
      </nav>

      <main className={styles.main}>{children}</main>

      <div className={styles.resourceBar}>
        <div className={styles.resourceItem}>
          <span className={styles.resourceIcon}>🧱</span>
          <div className={styles.resourceInfo}>
            <span className={styles.resourceLabel}>Stavební materiál</span>
            <span className={styles.resourceValue}>
              {resources ? resources.s1.toLocaleString('cs-CZ') : '—'}
            </span>
            {cityForProd && (
              <span className={styles.resourceProd}>
                +{produkce(cityForProd.b2).toLocaleString('cs-CZ')}/h
              </span>
            )}
          </div>
        </div>
        <div className={styles.resourceItem}>
          <span className={styles.resourceIcon}>⚙️</span>
          <div className={styles.resourceInfo}>
            <span className={styles.resourceLabel}>Železo</span>
            <span className={styles.resourceValue}>
              {resources ? resources.s2.toLocaleString('cs-CZ') : '—'}
            </span>
            {cityForProd && (
              <span className={styles.resourceProd}>
                +{produkce(cityForProd.b3).toLocaleString('cs-CZ')}/h
              </span>
            )}
          </div>
        </div>
        <div className={styles.resourceItem}>
          <span className={styles.resourceIcon}>🛢️</span>
          <div className={styles.resourceInfo}>
            <span className={styles.resourceLabel}>Ropa</span>
            <span className={styles.resourceValue}>
              {resources ? resources.s3.toLocaleString('cs-CZ') : '—'}
            </span>
            {cityForProd && (
              <span className={styles.resourceProd}>
                +{produkce(cityForProd.b4).toLocaleString('cs-CZ')}/h
              </span>
            )}
          </div>
        </div>
        <div className={styles.resourceItem}>
          <span className={styles.resourceIcon}>🌾</span>
          <div className={styles.resourceInfo}>
            <span className={styles.resourceLabel}>Jídlo</span>
            <span className={styles.resourceValue}>
              {resources ? resources.s4.toLocaleString('cs-CZ') : '—'}
            </span>
            {cityForProd && (
              <span className={styles.resourceProd}>
                +{produkce(cityForProd.b5).toLocaleString('cs-CZ')}/h
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
