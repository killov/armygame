'use client';

import { useState } from 'react';
import { sellAction, buyAction } from '@/app/actions/trade';

interface MarketFormProps {
  mestoId: number;
  penize: number;
  surovina1: number;
  surovina2: number;
  surovina3: number;
  surovina4: number;
}

const RESOURCE_NAMES = ['Stav. materiál', 'Železo', 'Ropa', 'Jídlo'];
const RESOURCE_ICONS = ['🧱', '⚙️', '🛢️', '🌾'];

export default function MarketForm({ mestoId, penize, surovina1, surovina2, surovina3, surovina4 }: MarketFormProps) {
  const [tab, setTab] = useState<'sell' | 'buy'>('sell');
  const [sellAmounts, setSellAmounts] = useState([0, 0, 0, 0]);
  const [buyResource, setBuyResource] = useState(1);
  const [buyAmount, setBuyAmount] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resources = [surovina1, surovina2, surovina3, surovina4];
  const sellTotal = Math.floor(sellAmounts.reduce((a, b) => a + b, 0) * 0.8);
  const buyCost = Math.ceil(buyAmount * 1.25);

  async function handleSell() {
    setLoading(true);
    setMessage('');
    const result = await sellAction(mestoId, sellAmounts[0], sellAmounts[1], sellAmounts[2], sellAmounts[3]);
    if (result.success) {
      setMessage(`Prodáno! Získal jsi ${sellTotal} peněz.`);
      setSellAmounts([0, 0, 0, 0]);
    } else {
      setMessage(result.error || 'Chyba');
    }
    setLoading(false);
  }

  async function handleBuy() {
    setLoading(true);
    setMessage('');
    const result = await buyAction(mestoId, buyResource, buyAmount);
    if (result.success) {
      setMessage(`Nakoupeno! ${buyAmount}x ${RESOURCE_NAMES[buyResource - 1]} za ${buyCost} peněz.`);
      setBuyAmount(0);
    } else {
      setMessage(result.error || 'Chyba');
    }
    setLoading(false);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    cursor: 'pointer',
    background: active ? '#FF6600' : '#333',
    color: active ? '#fff' : '#aaa',
    border: '1px solid #555',
    borderBottom: active ? 'none' : '1px solid #555',
    borderRadius: '4px 4px 0 0',
    fontWeight: active ? 700 : 400,
    fontSize: '0.9rem',
  });

  const inputStyle: React.CSSProperties = {
    background: '#222',
    border: '1px solid #555',
    color: '#ddd',
    padding: '4px 8px',
    borderRadius: '3px',
    width: '100px',
    fontSize: '0.85rem',
  };

  const btnStyle: React.CSSProperties = {
    background: 'forestgreen',
    color: 'cornsilk',
    border: '1px solid #2a6e2a',
    padding: '6px 16px',
    borderRadius: '3px',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    marginTop: '8px',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0px' }}>
        <button style={tabStyle(tab === 'sell')} onClick={() => { setTab('sell'); setMessage(''); }}>
          Prodat
        </button>
        <button style={tabStyle(tab === 'buy')} onClick={() => { setTab('buy'); setMessage(''); }}>
          Nakoupit
        </button>
      </div>

      <div style={{ background: 'rgba(20,20,20,0.7)', border: '1px solid #555', borderRadius: '0 5px 5px 5px', padding: '12px' }}>
        <div style={{ marginBottom: '8px', color: '#aaa', fontSize: '0.85rem' }}>
          Tvoje peníze: <strong style={{ color: '#FFD700' }}>{penize.toLocaleString('cs-CZ')}</strong>
        </div>

        {tab === 'sell' && (
          <div>
            <p style={{ color: '#bbb', fontSize: '0.82rem', marginBottom: '8px' }}>
              Prodej suroviny za peníze (kurz: 0.8 - za 100 surovin dostaneš 80 peněz)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {RESOURCE_NAMES.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px' }}>{RESOURCE_ICONS[i]}</span>
                  <span style={{ width: '120px', color: '#ccc', fontSize: '0.85rem' }}>{name}</span>
                  <input
                    type="number"
                    min={0}
                    max={resources[i]}
                    value={sellAmounts[i]}
                    onChange={(e) => {
                      const v = [...sellAmounts];
                      v[i] = Math.min(resources[i], Math.max(0, Number(e.target.value)));
                      setSellAmounts(v);
                    }}
                    style={inputStyle}
                  />
                  <span style={{ color: '#777', fontSize: '0.78rem' }}>/ {resources[i]}</span>
                  <button
                    style={{ background: '#444', color: '#aaa', border: '1px solid #555', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '0.75rem' }}
                    onClick={() => {
                      const v = [...sellAmounts];
                      v[i] = resources[i];
                      setSellAmounts(v);
                    }}
                  >
                    Max
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '8px', color: '#ddd', fontSize: '0.85rem' }}>
              Získáš: <strong style={{ color: '#FFD700' }}>{sellTotal}</strong> peněz
            </div>
            <button style={btnStyle} onClick={handleSell} disabled={loading || sellTotal === 0}>
              {loading ? 'Prodávám...' : 'Prodat'}
            </button>
          </div>
        )}

        {tab === 'buy' && (
          <div>
            <p style={{ color: '#bbb', fontSize: '0.82rem', marginBottom: '8px' }}>
              Nakup suroviny za peníze (kurz: 1.25 - za 100 surovin zaplatíš 125 peněz)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Surovina:</span>
                <select
                  value={buyResource}
                  onChange={(e) => setBuyResource(Number(e.target.value))}
                  style={{ ...inputStyle, width: '160px' }}
                >
                  {RESOURCE_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{RESOURCE_ICONS[i]} {name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Množství:</span>
                <input
                  type="number"
                  min={0}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Math.max(0, Number(e.target.value)))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px', color: '#ddd', fontSize: '0.85rem' }}>
              Cena: <strong style={{ color: '#FFD700' }}>{buyCost}</strong> peněz
              {buyCost > penize && <span style={{ color: '#f85149', marginLeft: '8px' }}>(nedostatek)</span>}
            </div>
            <button style={btnStyle} onClick={handleBuy} disabled={loading || buyAmount === 0 || buyCost > penize}>
              {loading ? 'Nakupuji...' : 'Nakoupit'}
            </button>
          </div>
        )}

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
    </div>
  );
}
