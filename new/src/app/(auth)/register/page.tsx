'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { registerAction } from '../../actions/auth';
import styles from './page.module.scss';

export default function RegisterPage() {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);

        const password = formData.get('password') as string;
        const passwordConfirm = formData.get('passwordConfirm') as string;

        if (password !== passwordConfirm) {
            setError('Hesla se neshodují.');
            return;
        }

        startTransition(async () => {
            const result = await registerAction(formData);
            if (result?.error) {
                setError(result.error);
            }
        });
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Registrace</h1>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label htmlFor="jmeno">Jméno hráče</label>
                        <input
                            id="jmeno"
                            name="jmeno"
                            type="text"
                            required
                            maxLength={20}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="mesto">Jméno města</label>
                        <input
                            id="mesto"
                            name="mesto"
                            type="text"
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="email">E-mail</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
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
                            autoComplete="new-password"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="passwordConfirm">Potvrzení hesla</label>
                        <input
                            id="passwordConfirm"
                            name="passwordConfirm"
                            type="password"
                            required
                            autoComplete="new-password"
                            className={styles.input}
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button type="submit" disabled={isPending} className={styles.button}>
                        {isPending ? 'Registruji...' : 'Zaregistrovat se'}
                    </button>
                </form>

                <p className={styles.link}>
                    Již máte účet? <Link href="/login">Přihlaste se</Link>
                </p>
            </div>
        </div>
    );
}
