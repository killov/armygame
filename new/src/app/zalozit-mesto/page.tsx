import 'reflect-metadata';
import { redirect } from 'next/navigation';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { getCurrentUser } from '@/lib/session';
import { LANG } from '@/lib/game/lang';
import { PublicShell } from '../_components/PublicShell';
import { ZalozitMestoForm } from '../_components/ZalozitMestoForm';
import styles from '../_components/PublicShell.module.scss';

export const metadata = { title: `ArmyGame | ${LANG[18]}` };

export default async function ZalozitMestoPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/');
    // Stejné kritérium jako game/layout (řádky v mesto), jinak hrozí smyčka mezi nimi.
    const mesta = await new MestoRepository(new DatabaseService()).getByUserId(user.id);
    if (mesta.length > 0) redirect('/game');

    return (
        <PublicShell>
            <div className={styles.obsah}>
                <h2>{LANG[18]}</h2>
                <ZalozitMestoForm />
            </div>
        </PublicShell>
    );
}
