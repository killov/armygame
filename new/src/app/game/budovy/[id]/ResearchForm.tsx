'use client';

import { useState } from 'react';
import { startResearchAction } from '@/app/actions/research';

interface ResearchInfo {
  id: number;
  nazev: string;
  emoji: string;
  popis: string;
  currentLevel: number;
  maximum: number;
  cena: number;
  cas: number;
  canResearch: boolean;
}

interface ResearchFormProps {
  mestoId: number;
  researches: ResearchInfo[];
  penize: number;
  activeResearch: boolean;
}

export default function ResearchForm({ mestoId, researches, penize, activeResearch }: ResearchFormProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResearch(vyzkumId: number) {
    setLoading(true);
    setMessage('');
    const result = await startResearchAction(mestoId, vyzkumId);
    if (result.success) {
      setMessage('Výzkum zahájen!');
    } else {
      setMessage(result.error || 'Chyba');
    }
    setLoading(false);
  }

  const btnStyle: React.CSSProperties = {
    background: 'forestgreen',
    color: 'cornsilk',
    border: '1px solid #2a6e2a',
    padding: '4px 10px',
    borderRadius: '3px',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
  };

  const disabledBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: '#555',
    color: '#888',
    cursor: 'not-allowed',
    borderColor: '#666',
  };

  return (
    <div>
      {activeResearch && (
        <div style={{ marginBottom: '8px', padding: '6px 10px', background: 'rgba(255,165,0,0.15)', borderRadius: '3px', color: '#FF6600', fontSize: '0.85rem' }}>
          Probíhá výzkum...
        </div>
      )}
      <div style={{ marginBottom: '8px', color: '#aaa', fontSize: '0.85rem' }}>
        Tvoje peníze: <strong style={{ color: '#FFD700' }}>{penize.toLocaleString('cs-CZ')}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {researches.map((r) => {
          const isMax = r.currentLevel >= r.maximum;
          const canDo = r.canResearch && !activeResearch && !isMax && penize >= r.cena;
          const casMin = Math.floor(r.cas / 60);
          const casSec = r.cas % 60;
          return (
            <div key={r.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
              padding: '8px 10px',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{r.emoji}</span>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontWeight: 600, color: '#FF6600', fontSize: '0.9rem' }}>{r.nazev}</div>
                <div style={{ color: '#999', fontSize: '0.75rem' }}>{r.popis}</div>
                <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: '2px' }}>
                  Level {r.currentLevel}/{r.maximum}
                  {!isMax && <> | Cena: <strong style={{ color: '#FFD700' }}>{r.cena}</strong> | Čas: {casMin}m {casSec}s</>}
                </div>
              </div>
              {isMax ? (
                <span style={{ background: 'forestgreen', color: 'cornsilk', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', fontSize: '0.78rem' }}>MAX</span>
              ) : (
                <button
                  style={canDo ? btnStyle : disabledBtnStyle}
                  disabled={!canDo || loading}
                  onClick={() => handleResearch(r.id)}
                  title={
                    activeResearch ? 'Již probíhá výzkum' :
                    penize < r.cena ? 'Nedostatek peněz' :
                    !r.canResearch ? 'Nesplněné požadavky' : undefined
                  }
                >
                  {loading ? '...' : 'Zkoumat'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <div style={{
          marginTop: '8px',
          padding: '6px 10px',
          borderRadius: '3px',
          background: message.includes('Chyba') || message.includes('Nedostatek') || message.includes('Vyžaduje') || message.includes('probíhá') ? 'rgba(248,81,73,0.2)' : 'rgba(102,187,106,0.2)',
          color: message.includes('Chyba') || message.includes('Nedostatek') || message.includes('Vyžaduje') || message.includes('probíhá') ? '#f85149' : '#66bb6a',
          fontSize: '0.85rem',
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
