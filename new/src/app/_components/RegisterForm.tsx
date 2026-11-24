'use client';

import { useActionState } from 'react';
import { type RegistraceState, registerAction } from '@/app/actions/auth';
import { LANG } from '@/lib/game/lang';
import { REGISTRACE_LANG } from '@/lib/auth/validace';
import styles from './PublicShell.module.scss';

const INITIAL: RegistraceState = { chyby: [0, 0, 0, 0], jmeno: '', email: '' };

const POLE = [
    { name: 'jmeno', type: 'text', placeholder: LANG[2], autoComplete: 'username' },
    { name: 'email', type: 'text', placeholder: LANG[3], autoComplete: 'email' },
    { name: 'heslo', type: 'password', placeholder: LANG[4], autoComplete: 'new-password' },
    { name: 'heslo_znovu', type: 'password', placeholder: LANG[5], autoComplete: 'new-password' },
] as const;

/** inc/login/register.php — chyba0–chyba3 u jednotlivých polí. */
export function RegisterForm() {
    const [state, action, pending] = useActionState(registerAction, INITIAL);

    return (
        <form action={action}>
            <div className={styles.regWrap}>
                {POLE.map((pole, i) => (
                    <div key={pole.name} className={styles.regRow}>
                        <input
                            className={styles.regInput}
                            type={pole.type}
                            name={pole.name}
                            placeholder={pole.placeholder}
                            autoComplete={pole.autoComplete}
                            defaultValue={pole.name === 'jmeno' ? state.jmeno : pole.name === 'email' ? state.email : undefined}
                        />{' '}
                        <label className={styles.chyba} id={`chyba${i}`}>
                            {state.chyby[i] ? LANG[REGISTRACE_LANG[i][state.chyby[i]]] : ''}
                        </label>
                    </div>
                ))}
            </div>
            <input className={styles.tryit} type="submit" value={LANG[6]} disabled={pending} />
        </form>
    );
}
