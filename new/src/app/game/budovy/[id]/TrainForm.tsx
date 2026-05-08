'use client';

import { useState } from 'react';
import { trainUnitsAction } from '@/app/actions/army';

interface UnitInfo {
  id: number;
  nazev: string;
  emoji: string;
  surovina2: number;
  surovina3: number;
  surovina4: number;
  cas: number;
}

interface TrainFormProps {
  mestoId: number;
  units: UnitInfo[];
}

export default function TrainForm({ mestoId, units }: TrainFormProps) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTrain(unitId: number) {
    const pocet = quantities[unitId] || 0;
    if (pocet < 1) return;
    setLoading(true);
    setMessage('');
    const result = await trainUnitsAction(mestoId, unitId, pocet);
    if (result.success) {
      setMessage(`Trénink zahájen: ${pocet}x ${units.find(u => u.id === unitId)?.nazev}`);
      setQuantities(q => ({ ...q, [unitId]: 0 }));
    } else {
      setMessage(result.error || 'Chyba');
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    background: '#222',
    border: '1px solid #555',
    color: '#ddd',
    padding: '4px 8px',
    borderRadius: '3px',
    width: '70px',
    fontSize: '0.85rem',
  };

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

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {units.map((u) => (
          <div key={u.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
            padding: '8px 10px',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '1.2rem' }}>{u.emoji}</span>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div style={{ fontWeight: 600, color: '#FF6600', fontSize: '0.9rem' }}>{u.nazev}</div>
              <div style={{ color: '#999', fontSize: '0.75rem' }}>
                {u.surovina2 > 0 && `${u.surovina2} Fe`}
                {u.surovina3 > 0 && ` | ${u.surovina3} ropa`}
                {u.surovina4 > 0 && ` | ${u.surovina4} jídlo`}
                {` | ${u.cas}s/ks`}
              </div>
            </div>
            <input
              type="number"
              min={1}
              max={50}
              value={quantities[u.id] || ''}
              placeholder="ks"
              onChange={(e) => setQuantities(q => ({ ...q, [u.id]: Math.min(50, Math.max(0, Number(e.target.value))) }))}
              style={inputStyle}
            />
            <button
              style={btnStyle}
              disabled={loading || !quantities[u.id] || quantities[u.id]! < 1}
              onClick={() => handleTrain(u.id)}
            >
              {loading ? '...' : 'Trénovat'}
            </button>
          </div>
        ))}
      </div>

      {message && (
        <div style={{
          marginTop: '8px',
          padding: '6px 10px',
          borderRadius: '3px',
          background: message.includes('Chyba') || message.includes('Nedostatek') ? 'rgba(248,81,73,0.2)' : 'rgba(102,187,106,0.2)',
          color: message.includes('Chyba') || message.includes('Nedostatek') ? '#f85149' : '#66bb6a',
          fontSize: '0.85rem',
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
