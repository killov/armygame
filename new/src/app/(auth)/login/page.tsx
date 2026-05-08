'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { loginAction } from '../../actions/auth';
import styles from './page.module.scss';

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);

        startTransition(async () => {
            const result = await loginAction(formData);
            if (result?.error) {
                setError(result.error);
            }
        });
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Přihlášení</h1>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label htmlFor="jmeno">Jméno hráče</label>
                        <input
                            id="jmeno"
                            name="jmeno"
                            type="text"
                            required
                            autoComplete="username"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="password">Heslo</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            className={styles.input}
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button type="submit" disabled={isPending} className={styles.button}>
                        {isPending ? 'Přihlašuji...' : 'Přihlásit se'}
                    </button>
                </form>

                <p className={styles.link}>
                    Nemáte účet? <Link href="/register">Registrujte se</Link>
                </p>
            </div>
        </div>
    );
}
