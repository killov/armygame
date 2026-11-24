import 'reflect-metadata';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { jednotkyMesta } from '@/services/MestoRamService';
import { getAktualniMesto } from '@/lib/game/aktualniMesto';
import { penize, refreshCas } from '@/lib/game/suroviny';
import { dohonStavRequestu } from '@/services/engine/request';
import { HerniRam } from './_components/HerniRam';

// Rám jen čte: suroviny se počítají na klientu z výchozího bodu, přepočet se zápisem do DB je ARM-5.
export default async function GameLayout({ children }: { children: React.ReactNode }) {
    // Engine nejdřív dožene akce, ať rám ukazuje aktuální suroviny/jednotky.
    await dohonStavRequestu();
    const { user, mesto, mesta } = await getAktualniMesto();
    // Server Component se renderuje jednou na request, čas requestu je tu záměr.
    // eslint-disable-next-line react-hooks/purity
    const serverNow = Date.now();
    const ted = Math.floor(serverNow / 1000);
    const mestoRepo = new MestoRepository(new DatabaseService());
    const [podpory, nejblizsiAkce] = await Promise.all([
        mestoRepo.soucetPodpor(mesto.id),
        mestoRepo.nejblizsiAkceCas(mesto.id, ted),
    ]);

    return (
        <HerniRam
            data={{
                serverNow,
                refresh: refreshCas(nejblizsiAkce, ted),
                penize: penize(user.penize, user.banka),
                mesto: {
                    id: mesto.id,
                    jmeno: mesto.jmeno,
                    suroviny: [mesto.surovina1, mesto.surovina2, mesto.surovina3, mesto.surovina4],
                    produkce: [
                        mesto.surovina1_produkce,
                        mesto.surovina2_produkce,
                        mesto.surovina3_produkce,
                        mesto.surovina4_produkce,
                    ],
                    surovinyCas: mesto.suroviny_time,
                    sklad: mesto.sklad,
                },
                mesta: mesta.map(({ id, jmeno, x, y }) => ({ id, jmeno, x, y })),
                jednotky: jednotkyMesta(mesto, podpory),
                vlastniJednotky: jednotkyMesta(mesto, []),
            }}
        >
            {children}
        </HerniRam>
    );
}
