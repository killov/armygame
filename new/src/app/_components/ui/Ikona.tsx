import localFont from 'next/font/local';

const icomoon = localFont({ src: '../../../../public/fonts/icomoon.woff', display: 'block' });

/** Znaky ikonového fontu icomoon (www/css/styleg.css). Jen ty, které rám používá — další přidá, kdo je potřebuje. */
const ZNAKY = {
    menu: '',
    'hair-cross': '',
    home: '',
    globe: '',
    'v-card': '',
    cog: '',
    cross: '',
} as const;

export type IkonaNazev = keyof typeof ZNAKY;

export function Ikona({ nazev, className = '' }: { nazev: IkonaNazev; className?: string }) {
    return (
        <span className={`${icomoon.className} ${className}`} aria-hidden="true">
            {ZNAKY[nazev]}
        </span>
    );
}
