'use client';

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

// Hodiny hry (game.timeloop): jeden interval 500 ms pro celou stránku, odběratelé dostanou jen celé sekundy,
// takže se překreslují jednou za vteřinu a jen ti, kdo čas čtou. Stav je per-tab v prohlížeči.
let rozdil = 0;
let synchronizovano = false;
let ted = 0;
let interval: ReturnType<typeof setInterval> | undefined;
const odberatele = new Set<() => void>();

function tik() {
    const sekundy = Math.floor((Date.now() + rozdil) / 1000);
    if (sekundy === ted) return;
    ted = sekundy;
    odberatele.forEach((o) => o());
}

function subscribe(odberatel: () => void) {
    odberatele.add(odberatel);
    if (!interval) {
        tik();
        interval = setInterval(tik, 500);
    }
    return () => {
        odberatele.delete(odberatel);
        if (odberatele.size === 0) {
            clearInterval(interval);
            interval = undefined;
        }
    };
}

/** Čas serveru při renderu (ms) — první render na klientu ho použije taky, ať hydratace sedí. */
const ServerCas = createContext(0);

/**
 * game.time_rozdil: posun hodin klienta vůči serveru, jako originál jen jednou při načtení. Každý refresh rámu
 * by do něj započítal jinou latenci a hodiny by poskočily i dozadu.
 */
export function HerniHodiny({ serverNow, children }: { serverNow: number; children: React.ReactNode }) {
    useEffect(() => {
        if (synchronizovano) return;
        synchronizovano = true;
        rozdil = serverNow - Date.now();
        tik();
    }, [serverNow]);
    return <ServerCas.Provider value={serverNow}>{children}</ServerCas.Provider>;
}

/** Herní čas v unix sekundách; mění se po celých vteřinách. */
export function useHerniCas(): number {
    const server = Math.floor(useContext(ServerCas) / 1000);
    return useSyncExternalStore(
        subscribe,
        () => ted || server,
        () => server
    );
}
