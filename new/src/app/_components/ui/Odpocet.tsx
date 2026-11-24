'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cas } from '@/lib/game/suroviny';
import { useHerniCas } from './HerniHodiny';

/** Odpočet do `konec` (unix s) ve formátu cas(); doběhnutím obnoví stránku, ať server akci zpracuje. */
export function Odpocet({ konec }: { konec: number }) {
    const router = useRouter();
    const zbyva = Math.max(0, konec - useHerniCas());
    const hotovo = zbyva === 0;
    // Akce, která skončila už před mountem, refresh nespouští — jinak by nezpracovaná akce obnovovala stránku dokola.
    const bezelo = useRef(!hotovo);

    useEffect(() => {
        if (!hotovo || !bezelo.current) return;
        bezelo.current = false;
        router.refresh();
    }, [hotovo, router]);

    return <span>{cas(zbyva)}</span>;
}
