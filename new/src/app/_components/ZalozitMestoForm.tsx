'use client';

import { useActionState } from 'react';
import { zalozitMestoAction } from '@/app/actions/zalozitMesto';
import { LANG } from '@/lib/game/lang';
import { CHYBA_NENI_VOLNE_POLE, JMENO_MESTA_LANG } from '@/lib/auth/validace';
import styles from './PublicShell.module.scss';

const SMERY = [0, 1, 2, 3] as const;

/** inc/zalozitmesto.php — jméno města a světová strana (LANG 21–24). */
export function ZalozitMestoForm() {
    const [state, action, pending] = useActionState(zalozitMestoAction, { chyba: 0, jmeno: '', smer: 0 });

    return (
        <form action={action}>
            <label className={styles.chyba} id="chyba0" role="alert">
                {state.chyba === CHYBA_NENI_VOLNE_POLE
                    ? 'Na mapě se nepodařilo najít volné pole, zkuste jinou světovou stranu.'
                    : state.chyba
                      ? LANG[JMENO_MESTA_LANG[state.chyba]]
                      : ''}
            </label>
            <div className={styles.loginWrap}>
                <input
                    className={styles.loginInput}
                    type="text"
                    name="jmeno"
                    placeholder={LANG[2]}
                    defaultValue={state.jmeno}
                />
                <select className={styles.loginInput} name="smer" aria-label={LANG[20]} defaultValue={state.smer}>
                    {SMERY.map((smer) => (
                        <option key={smer} value={smer}>
                            {LANG[21 + smer]}
                        </option>
                    ))}
                </select>
            </div>
            <input className={styles.tryit} type="submit" value={LANG[18]} disabled={pending} />
        </form>
    );
}
