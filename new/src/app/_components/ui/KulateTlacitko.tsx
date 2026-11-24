import Link from 'next/link';
import { Ikona, IkonaNazev } from './Ikona';
import styles from './ui.module.scss';

interface Spolecne {
    ikona: IkonaNazev;
    /** Přístupný název; originál má jen ikonu. */
    popisek: string;
    className?: string;
    onClick?: () => void;
}

type KulateTlacitkoProps = Spolecne & ({ href: string } | { type?: 'button' | 'submit'; expanded?: boolean });

/** Kulaté tlačítko lišty (.but-out-s / .but-in-s / .but-hov-s) — odkaz, nebo tlačítko. */
export function KulateTlacitko(props: KulateTlacitkoProps) {
    const { ikona, popisek, className = '', onClick } = props;
    const vnitrek = (
        <span className={styles.kulateIn}>
            <span className={styles.kulateHov} />
            <Ikona nazev={ikona} className={styles.kulateIkona} />
        </span>
    );
    const trida = `${styles.kulate} ${className}`;

    if ('href' in props) {
        return (
            <Link href={props.href} className={trida} aria-label={popisek} title={popisek} onClick={onClick}>
                {vnitrek}
            </Link>
        );
    }
    return (
        <button
            type={props.type ?? 'button'}
            className={trida}
            aria-label={popisek}
            title={popisek}
            aria-expanded={props.expanded}
            onClick={onClick}
        >
            {vnitrek}
        </button>
    );
}
