'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cena } from '@/app/_components/ui/Cena';
import { Tlacitko } from '@/app/_components/ui/Tlacitko';
import { LANG, LANG_JEDNOTKY } from '@/lib/game/lang';
import styles from './ram.module.scss';

/** Řádky hlavičky formuláře poslání jednotek (#su_city … #su_capacity). */
const POHYB_INFO = [25, 32, 89, 138, 139, 80, 148, 140] as const;
const SUROVINY = [1, 2, 3, 4] as const;

/**
 * #levo: „Jednotky" (vlastní + podpory, Mesto::jednotky) a kostra „Poslat jednotky" (#cont). Odeslání z mapy
 * je ARM-9; originál #cont schovává, dokud se neposílá — tady je sbalený pod nadpisem.
 */
export function LevyPanel({
    jednotky,
    vlastniJednotky,
    otevreny,
}: {
    jednotky: readonly number[];
    vlastniJednotky: readonly number[];
    otevreny: boolean;
}) {
    const [pohyb, setPohyb] = useState(false);
    const radky = LANG_JEDNOTKY.map((nazev, i) => ({ nazev, pocet: jednotky[i] })).filter((j) => j.pocet > 0);

    return (
        <aside id="levo" className={`${styles.levo} ${otevreny ? styles.levoOtevrene : ''}`}>
            <div className={styles.jednotky} id="jed">
                <h2>
                    <Link href="/game/jednotky">{LANG[147]}</Link>
                </h2>
                <table id="jednotky">
                    <tbody>
                        {radky.length > 0 ? (
                            radky.map((j) => (
                                <tr key={j.nazev}>
                                    <td>{j.nazev}</td>
                                    <td>{j.pocet}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td>Žádné</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className={styles.jednotky} id="cont">
                <h2>
                    <button type="button" aria-expanded={pohyb} onClick={() => setPohyb(!pohyb)}>
                        {LANG[137]}
                    </button>
                </h2>
                {pohyb && (
                    <form id="su_form">
                        <table>
                            <tbody>
                                {POHYB_INFO.map((i) => (
                                    <tr key={i}>
                                        <td>{LANG[i]}</td>
                                        <td />
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <select id="su_source" aria-label={LANG[25]}>
                            <option value="0">{LANG[25]}</option>
                        </select>
                        <table>
                            <tbody>
                                {LANG_JEDNOTKY.map((nazev, i) => (
                                    <tr key={nazev}>
                                        <td>{nazev}</td>
                                        <td>
                                            <input id={`pj${i + 1}`} size={5} aria-label={nazev} />
                                        </td>
                                        <td>{vlastniJednotky[i]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p>
                            {SUROVINY.map((s) => (
                                <Cena key={s} druh={`surovina${s}`}>
                                    <input id={`su_sur${s}`} size={5} aria-label={LANG[120 + s]} />
                                </Cena>
                            ))}
                        </p>
                        {/* Vypnuté submit tlačítko blokuje i odeslání Enterem z inputu. */}
                        <Tlacitko type="submit" disabled>
                            {LANG[137]}
                        </Tlacitko>
                    </form>
                )}
            </div>
        </aside>
    );
}
