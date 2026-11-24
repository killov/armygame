import type { ComponentProps } from 'react';
import styles from './ui.module.scss';

/** Bílé okno stránky (#obsah) s nadpisy h2/h3 v šedém gradientu. */
export function Okno({ className = '', ...props }: ComponentProps<'div'>) {
    return <div {...props} className={`${styles.okno} ${className}`} />;
}
