import type { ComponentProps } from 'react';
import styles from './ui.module.scss';

/**
 * Herní tabulka: `dorucene` (šedé th, jednotky a zprávy), `prehled` (řádky s hoverem, seznamy budov a měst).
 * Aktuální řádek přehledu se značí `aria-current` na `<tr>` (.prehled tr.akt v originále).
 */
export function Tabulka({ varianta, className = '', ...props }: ComponentProps<'table'> & { varianta: 'dorucene' | 'prehled' }) {
    return <table {...props} className={`${styles[varianta]} ${className}`} />;
}
