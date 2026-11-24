import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { LANG } from '@/lib/game/lang';
import { PublicShell } from './_components/PublicShell';
import { LoginForm } from './_components/LoginForm';
import { RegisterForm } from './_components/RegisterForm';
import { Changelog } from './_components/Changelog';
import styles from './_components/PublicShell.module.scss';

const TABY = [
    { tab: 'login', label: LANG[0] },
    { tab: 'register', label: LANG[1] },
    { tab: 'changelog', label: 'Changelog' },
] as const;

type Tab = (typeof TABY)[number]['tab'];

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
    // Podle hráče v DB, ne podle samotné session — platný JWT bez hráče by jinak točil smyčku / ↔ /game.
    if (await getCurrentUser()) redirect('/game');

    const { tab: tabParam } = await searchParams;
    const tab: Tab = TABY.find((t) => t.tab === tabParam)?.tab ?? 'login';

    return (
        <PublicShell>
            <nav>
                <ul className={styles.menu}>
                    {TABY.map((t) => (
                        <li key={t.tab}>
                            <Link
                                href={`/?tab=${t.tab}`}
                                className={t.tab === tab ? styles.active : undefined}
                                aria-current={t.tab === tab ? 'page' : undefined}
                            >
                                {t.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className={styles.obsah}>
                {tab === 'login' && <LoginForm />}
                {tab === 'register' && <RegisterForm />}
                {tab === 'changelog' && <Changelog />}
            </div>
        </PublicShell>
    );
}
