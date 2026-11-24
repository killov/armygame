import { getAktualniMesto } from '@/lib/game/aktualniMesto';
import { LANG } from '@/lib/game/lang';

// Minimální přehled aktuálního města; odhlášení je v liště rámu (but-4).
export default async function GamePage() {
    const { user, mesto } = await getAktualniMesto();

    return (
        <section>
            <h1>{mesto.jmeno}</h1>
            <p>
                [{mesto.x}|{mesto.y}]
            </p>
            <p>
                {LANG[32]}: {user.jmeno}
            </p>
        </section>
    );
}
