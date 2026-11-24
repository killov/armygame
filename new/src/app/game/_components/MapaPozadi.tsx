import styles from './ram.module.scss';

/** #back — místo pro mapu světa (ARM-9). Je v layoutu, takže navigace mezi stránkami ho nepřemountuje. */
export function MapaPozadi() {
    return <div id="back" className={styles.back} data-testid="mapa-pozadi" />;
}
