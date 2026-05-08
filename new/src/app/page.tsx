import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '../lib/session';

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect('/game/mesto');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background elements */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(212,160,23,0.05) 0%, transparent 50%), ' +
            'radial-gradient(circle at 80% 20%, rgba(88,166,255,0.05) 0%, transparent 40%)',
          pointerEvents: 'none',
        }}
      />

      <main
        style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          maxWidth: '560px',
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '3rem', lineHeight: 1 }}>⚔️</span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            fontWeight: 900,
            color: '#d4a017',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: '0 0 0.5rem',
            textShadow: '0 0 40px rgba(212,160,23,0.3)',
          }}
        >
          ArmyGame
        </h1>
        <p
          style={{
            color: '#8b949e',
            fontSize: '1.1rem',
            marginBottom: '3rem',
            letterSpacing: '0.05em',
          }}
        >
          Strategická browserová hra
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              background: '#d4a017',
              color: '#0d1117',
              padding: '0.85rem 2.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.04em',
              transition: 'background 0.2s',
              display: 'inline-block',
              boxShadow: '0 4px 16px rgba(212,160,23,0.25)',
            }}
          >
            Přihlásit se
          </Link>
          <Link
            href="/register"
            style={{
              background: 'transparent',
              color: '#d4a017',
              padding: '0.85rem 2.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.04em',
              border: '2px solid #d4a017',
              display: 'inline-block',
              transition: 'background 0.2s',
            }}
          >
            Registrovat
          </Link>
        </div>

        <p style={{ marginTop: '3rem', color: '#484f58', fontSize: '0.8rem' }}>
          Buduj impérium · Ovládni svět · Poraž soupeře
        </p>
      </main>
    </div>
  );
}
