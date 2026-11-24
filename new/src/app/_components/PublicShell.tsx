import { Noto_Sans } from 'next/font/google';
import styles from './PublicShell.module.scss';

const notoSans = Noto_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'] });

/** Kostra veřejných stránek podle inc/main.php: header s logem, obsah, pruh mapy, kontakty, patička. */
export function PublicShell({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${styles.shell} ${notoSans.className}`}>
            <header className={`${styles.main} ${styles.header}`}>
                <div className={styles.logo} role="img" aria-label="ArmyGame" />
            </header>

            <div className={`${styles.center} ${styles.description}`}>{children}</div>

            <div className={styles.map} />
            <div className={`${styles.center} ${styles.contact}`}>
                <div className={styles.cont}>
                    <a href="mailto:support@armygame.eu">support@armygame.eu</a>
                </div>
                <div className={styles.cont}>
                    <a href="https://www.facebook.com/webarmygame/" target="_blank" rel="noreferrer">
                        ArmyGame
                    </a>
                </div>
            </div>
            <footer className={`${styles.main} ${styles.footer}`}>
                <div className={styles.center}>
                    &copy; 2017 | Zdeněk Mazurák &amp;{' '}
                    <a href="http://aloushweb.cz/" target="_blank" rel="noreferrer">
                        Aleš Dopita
                    </a>
                </div>
            </footer>
        </div>
    );
}
