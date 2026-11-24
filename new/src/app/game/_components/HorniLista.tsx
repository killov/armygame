'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import { prejmenovatMestoAction, prepnoutMestoAction } from '@/app/actions/mesto';
import { KulateTlacitko } from '@/app/_components/ui/KulateTlacitko';
import { Tabulka } from '@/app/_components/ui/Tabulka';
import { useHerniCas } from '@/app/_components/ui/HerniHodiny';
import { JMENO_MESTA_LANG } from '@/lib/auth/validace';
import { LANG } from '@/lib/game/lang';
import { surovina } from '@/lib/game/suroviny';
import { useHlaska } from './Hlaska';
import type { RamData, RamMesto } from './HerniRam';
import styles from './ram.module.scss';

const SUROVINA_IKONA = [styles.surovina1, styles.surovina2, styles.surovina3, styles.surovina4];

/** .layout-left-top z inc/game.php: kulatá tlačítka, jméno města a suroviny. */
export function HorniLista({ data, onMapa, onOkno }: { data: RamData; onMapa: () => void; onOkno: () => void }) {
    return (
        <div className={styles.lista}>
            <JmenoMesta jmeno={data.mesto.jmeno} />
            <PrepinacMest mesta={data.mesta} aktualniId={data.mesto.id} />
            <KulateTlacitko ikona="hair-cross" popisek={LANG[66]} className={`${styles.but} ${styles.but2}`} onClick={onMapa} />
            <KulateTlacitko
                href="/game/mesto"
                ikona="home"
                popisek={LANG[25]}
                className={`${styles.but} ${styles.but3}`}
                onClick={onOkno}
            />
            <Suroviny penize={data.penize} mesto={data.mesto} />
            <KulateTlacitko
                href="/game/stat"
                ikona="globe"
                popisek={LANG[89]}
                className={`${styles.but} ${styles.but7}`}
                onClick={onOkno}
            />
            <KulateTlacitko
                href="/game/profil"
                ikona="v-card"
                popisek={LANG[33]}
                className={`${styles.but} ${styles.but6}`}
                onClick={onOkno}
            />
            <KulateTlacitko
                href="/game/statistika"
                ikona="cog"
                popisek={LANG[58]}
                className={`${styles.but} ${styles.but5}`}
                onClick={onOkno}
            />
            <form action={logoutAction} className={`${styles.but} ${styles.but4}`}>
                <KulateTlacitko type="submit" ikona="cross" popisek={LANG[19]} />
            </form>
        </div>
    );
}

/** #ren / #reg: klik na jméno → input, Enter přejmenuje, blur zruší (game.js). */
function JmenoMesta({ jmeno }: { jmeno: string }) {
    const [uprava, setUprava] = useState(false);
    const hlaska = useHlaska();

    async function prejmenovat(formData: FormData) {
        const { chyba } = await prejmenovatMestoAction(formData);
        setUprava(false);
        if (chyba !== 0) hlaska(LANG[JMENO_MESTA_LANG[chyba]], 2);
    }

    return (
        <div className={styles.jmeno}>
            {uprava ? (
                <form action={prejmenovat} className={styles.prejmenovani}>
                    <input
                        type="text"
                        name="jmeno"
                        id="in"
                        aria-label={LANG[2]}
                        defaultValue={jmeno}
                        autoFocus
                        onBlur={() => setUprava(false)}
                    />
                </form>
            ) : (
                <button type="button" id="ren" className={styles.ren} title={jmeno} onClick={() => setUprava(true)}>
                    {jmeno}
                </button>
            )}
        </div>
    );
}

/** but-1 (icon-menu): seznam měst hráče, výběr přepne users.mesto. */
function PrepinacMest({ mesta, aktualniId }: { mesta: RamData['mesta']; aktualniId: number }) {
    const pathname = usePathname();
    // Otevřený seznam patří stránce, na které se otevřel; navigace ho zavře bez efektu.
    const [otevrenoNa, setOtevrenoNa] = useState<string | null>(null);
    const otevreno = otevrenoNa === pathname;
    const [prepinani, startTransition] = useTransition();
    const hlaska = useHlaska();

    function prepni(id: number) {
        if (id === aktualniId) {
            setOtevrenoNa(null);
            return;
        }
        startTransition(async () => {
            const jmeno = await prepnoutMestoAction(id);
            setOtevrenoNa(null);
            if (jmeno === null) hlaska('Město se nepodařilo přepnout.', 2);
            else hlaska(`${LANG[25]}: ${jmeno}`, 1);
        });
    }

    return (
        <>
            <KulateTlacitko
                ikona="menu"
                popisek="Seznam měst"
                className={`${styles.but} ${styles.but1}`}
                expanded={otevreno}
                onClick={() => setOtevrenoNa(otevreno ? null : pathname)}
            />
            {otevreno && (
                <div className={styles.mesta} id="seznam-mest">
                    <Tabulka varianta="prehled">
                        <tbody>
                            {mesta.map((m) => (
                                <tr key={m.id} aria-current={m.id === aktualniId}>
                                    <td>
                                        <button
                                            type="button"
                                            className={styles.mestoVolba}
                                            disabled={prepinani}
                                            onClick={() => prepni(m.id)}
                                        >
                                            {m.jmeno}
                                        </button>
                                    </td>
                                    <td>
                                        [{m.x}|{m.y}]
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Tabulka>
                </div>
            )}
        </>
    );
}

/**
 * #suroviny: stav počítaný z výchozího bodu (suroviny_time) Mesto::surovina, takže se chyba nesčítá jako
 * u přičítání po 1/7200 v game.produkce. Záporné jídlo obnoví rám (data_load) — jednou, ne každou vteřinu.
 */
function Suroviny({ penize, mesto }: { penize: number; mesto: RamMesto }) {
    const router = useRouter();
    const ted = useHerniCas();
    const hodnoty = mesto.suroviny.map((s, i) => surovina(s, mesto.produkce[i], mesto.surovinyCas, mesto.sklad, ted));
    const hlad = hodnoty[3] < 0;

    useEffect(() => {
        if (hlad) router.refresh();
    }, [hlad, router]);

    return (
        <div id="suroviny" className={styles.suroviny}>
            <div className={`${styles.surovina} ${styles.surovina0}`} id="surovina0c">
                <div>
                    <span id="surovina0">{penize}</span>
                </div>
            </div>
            {hodnoty.map((hodnota, i) => (
                <div key={i} className={`${styles.surovina} ${SUROVINA_IKONA[i]}`} id={`surovina${i + 1}c`} tabIndex={0}>
                    <div>
                        <span id={`surovina${i + 1}`}>{hodnota}</span>
                    </div>
                    <div className={styles.tooltip} role="tooltip">
                        <b>{LANG[121 + i]}</b>
                        <br />
                        {LANG[120]}: {mesto.produkce[i]}
                        <br />
                        {LANG[59]}: {mesto.sklad}
                    </div>
                </div>
            ))}
        </div>
    );
}
