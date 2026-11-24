'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HerniHodiny } from '@/app/_components/ui/HerniHodiny';
import { Okno } from '@/app/_components/ui/Okno';
import { Tlacitko } from '@/app/_components/ui/Tlacitko';
import { LANG } from '@/lib/game/lang';
import { HlaskaProvider } from './Hlaska';
import { HorniLista } from './HorniLista';
import { LevyPanel } from './LevyPanel';
import { MapaPozadi } from './MapaPozadi';
import styles from './ram.module.scss';

type Ctverice = [number, number, number, number];

export interface RamMesto {
    id: number;
    jmeno: string;
    /** surovina1–4 v DB k času surovinyCas, ne přepočtené. */
    suroviny: Ctverice;
    produkce: Ctverice;
    surovinyCas: number;
    sklad: number;
}

export interface RamData {
    /** Čas serveru při renderu (ms). */
    serverNow: number;
    /** Za kolik sekund rám obnovit (Mesto::refresh_time). */
    refresh: number;
    penize: number;
    mesto: RamMesto;
    mesta: { id: number; jmeno: string; x: number; y: number }[];
    /** j1–j8 včetně podpor. */
    jednotky: number[];
    vlastniJednotky: number[];
}

/**
 * Rám inc/game.php: mapa, lišta, levý panel a okno stránky. Je v layoutu, takže při navigaci zůstává
 * namountovaný i s mapou a tikajícími surovinami; mění se jen obsah okna.
 */
export function HerniRam({ data, children }: { data: RamData; children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    // Mapa (skryté okno) a otevřený levý panel patří stránce, na které se zapnuly — navigace je vypne
    // bez efektu (game.hidemap v page_go).
    const [mapaNa, setMapaNa] = useState<string | null>(null);
    const [levoNa, setLevoNa] = useState<string | null>(null);
    const mapa = mapaNa === pathname;
    const levo = levoNa === pathname;

    // game.data_load po refresh sekundách; nový render ze serveru časovač natáhne znovu.
    useEffect(() => {
        const casovac = setTimeout(() => router.refresh(), Math.max(data.refresh, 1) * 1000);
        return () => clearTimeout(casovac);
    }, [data.serverNow, data.refresh, router]);

    return (
        <HerniHodiny serverNow={data.serverNow}>
            <HlaskaProvider>
                <MapaPozadi />
                <HorniLista data={data} onMapa={() => setMapaNa(pathname)} onOkno={() => setMapaNa(null)} />
                <div id="celek" className={`${styles.celek} ${mapa ? styles.celekSkryty : ''}`}>
                    <Okno id="obsah">{children}</Okno>
                    <div id="rip" className={styles.rip} onClick={() => setMapaNa(pathname)} />
                </div>
                <LevyPanel jednotky={data.jednotky} vlastniJednotky={data.vlastniJednotky} otevreny={levo} />
                <div className={styles.levoTlacitko}>
                    <Tlacitko aria-expanded={levo} onClick={() => setLevoNa(levo ? null : pathname)}>
                        {LANG[147]}
                    </Tlacitko>
                </div>
            </HlaskaProvider>
        </HerniHodiny>
    );
}
