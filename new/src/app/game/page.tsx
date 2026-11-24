import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { getCurrentUser } from '@/lib/session';
import { logoutAction } from '@/app/actions/auth';
import { LANG } from '@/lib/game/lang';

// Minimální cíl po založení města a po loginu; herní přehled je ARM-4.
export default async function GamePage() {
    const user = await getCurrentUser();
    if (!user) redirect('/');

    const [mesto] = await new MestoRepository(new DatabaseService()).getByUserId(user.id);
    if (!mesto) redirect('/zalozit-mesto');

    return (
        <section>
            <h1>{mesto.jmeno}</h1>
            <p>
                [{mesto.x}|{mesto.y}]
            </p>
            <p>
                {LANG[32]}: {user.jmeno}
            </p>
            <form action={logoutAction}>
                <button type="submit">{LANG[19]}</button>
            </form>
        </section>
    );
}
