import type { ComponentProps } from 'react';
import styles from './ui.module.scss';

/** Zelené akční tlačítko (.postav / input[type=submit]). */
export function Tlacitko({ className = '', type = 'button', ...props }: ComponentProps<'button'>) {
    return <button {...props} type={type} className={`${styles.tlacitko} ${className}`} />;
}
