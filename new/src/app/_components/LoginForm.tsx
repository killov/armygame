'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { LANG } from '@/lib/game/lang';
import { LOGIN_LANG } from '@/lib/auth/validace';
import styles from './PublicShell.module.scss';

/** inc/login/login.php */
export function LoginForm() {
    const [state, action, pending] = useActionState(loginAction, { chyba: 0, jmeno: '' });

    return (
        <form action={action}>
            <label className={styles.chyba} id="chyba0" role="alert">
                {state.chyba ? LANG[LOGIN_LANG[state.chyba]] : ''}
            </label>
            <div className={styles.loginWrap}>
                <input
                    className={styles.loginInput}
                    type="text"
                    name="jmeno"
                    placeholder={LANG[2]}
                    defaultValue={state.jmeno}
                    autoComplete="username"
                />
                <input
                    className={styles.loginInput}
                    type="password"
                    name="heslo"
                    placeholder={LANG[4]}
                    autoComplete="current-password"
                />
            </div>
            <input className={styles.tryit} type="submit" value={LANG[16]} disabled={pending} />
        </form>
    );
}
