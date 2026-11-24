'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import styles from './ram.module.scss';

/** 1 = úspěch (zelená), 2 = chyba (červená) jako game.hlaska(x, typ). */
export type HlaskaTyp = 1 | 2;
type HlaskaFn = (text: string, typ: HlaskaTyp) => void;

const HlaskaContext = createContext<HlaskaFn | null>(null);

export function useHlaska(): HlaskaFn {
    const hlaska = useContext(HlaskaContext);
    if (!hlaska) throw new Error('useHlaska mimo herní rám');
    return hlaska;
}

/**
 * #hlaska: 2 s vidět, pak 1 s fade (CSS animace). Nová hláška přepíše starou a díky novému `key` začne
 * animace znovu od začátku — žádný časovač, který by šlo zapomenout zrušit.
 */
export function HlaskaProvider({ children }: { children: React.ReactNode }) {
    const [stav, setStav] = useState<{ text: string; typ: HlaskaTyp; id: number } | null>(null);
    const hlaska = useCallback<HlaskaFn>((text, typ) => setStav((s) => ({ text, typ, id: (s?.id ?? 0) + 1 })), []);

    return (
        <HlaskaContext.Provider value={hlaska}>
            {children}
            {stav && (
                <div
                    key={stav.id}
                    id="hlaska"
                    role="status"
                    className={`${styles.hlaska} ${stav.typ === 1 ? styles.hlaskaOk : styles.hlaskaChyba}`}
                >
                    {stav.text}
                </div>
            )}
        </HlaskaContext.Provider>
    );
}
