import styles from './PublicShell.module.scss';

/** Statický port inc/login/changelog.php. */
export function Changelog() {
    return (
        <>
            <h2>Changelog</h2>
            <table className={styles.changelog}>
                <tbody>
                    <tr>
                        <th>21.4.2015 [0.1.0]</th>
                    </tr>
                    <tr>
                        <td>
                            <h3>Mapa</h3>
                            <ul>
                                <li>Přidán slider pro oddalování mapy</li>
                                <li>Opraveno oddalování mapy kolečkem</li>
                                <li>Opravena chyba při kliku na města na mapě</li>
                            </ul>
                            <h3>Tržiště</h3>
                            <ul>
                                <li>Přidáno tržiště</li>
                                <li>Přidáno základní posílání surovin</li>
                            </ul>
                            <h3>UI</h3>
                            <ul>
                                <li>Přidán pravý ovládací panel</li>
                                <li>Přidána notifikace</li>
                            </ul>
                        </td>
                    </tr>

                    <tr>
                        <th>10.4.2015</th>
                    </tr>
                    <tr>
                        <td>
                            <h3>Mapa</h3>
                            <ul>
                                <li>Přidáno přibližování/oddalování mapy</li>
                                <li>Pro optimalizaci mapa zahazuje zbytečné bloky mapy</li>
                            </ul>
                        </td>
                    </tr>

                    <tr>
                        <th>9.4.2015</th>
                    </tr>
                    <tr>
                        <td>
                            <h3>Vzhled</h3>
                            <ul>
                                <li>Přepracován header, přidáná průhlednostm přemístění prvků</li>
                                <li>U lišt souřadnic odstraněno pozadí</li>
                                <li>Přidány tooltipy (po najetí myší na tlačítka se zobrazí text)</li>
                            </ul>
                            <h3>Mapa</h3>
                            <ul>
                                <li>Po najetí na město se zobrazí informace</li>
                                <li>Odstraněn problém u posouvání mapy po označení textu</li>
                                <li>Mapa lze táhnout i po přetažení hranice mapy</li>
                                <li>Přidán plynulý přechod na centrované město</li>
                                <li>Na tlačitko mapa přídáno vycentrování vlastního města</li>
                            </ul>
                        </td>
                    </tr>

                    <tr>
                        <th>7.4.2015</th>
                    </tr>
                    <tr>
                        <td>
                            <h3>Mapa</h3>
                            <ul>
                                <li>Přidány lišty souřadnic</li>
                                <li>Přidána možnost zobrazit informace o městě</li>
                                <li>Přidána podpora dotykových zařízení</li>
                            </ul>
                        </td>
                    </tr>
                </tbody>
            </table>
        </>
    );
}
