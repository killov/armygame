import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '../lib/session';
import styles from './page.module.scss';

export default async function Home() {
    const session = await getSession();
    if (session) {
        redirect('/game/mesto');
    }

    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <h1>Vítejte v Armygame</h1>
                <p>Strategická hra v prohlížeči</p>
                <div className={styles.actions}>
                    <Link href="/login" className={styles.btnPrimary}>Přihlásit se</Link>
                    <Link href="/register" className={styles.btnSecondary}>Registrovat se</Link>
                </div>
            </main>
        </div>
    );
}
