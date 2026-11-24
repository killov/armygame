import type { ReactNode } from 'react';
import styles from './ui.module.scss';

/** surovina0 = peníze, 1–4 suroviny, cas = doba, spotreba = obyvatelé. */
export type CenaDruh = 'surovina0' | 'surovina1' | 'surovina2' | 'surovina3' | 'surovina4' | 'cas' | 'spotreba';

/** Buňka ceny (.bunka) s ikonou suroviny; obsahem je číslo, nebo vstup. */
export function Cena({ druh, children }: { druh: CenaDruh; children: ReactNode }) {
    return <span className={`${styles.bunka} ${styles[druh]}`}>{children}</span>;
}
