'use client';

import { useState, useEffect } from 'react';
import styles from './layout.module.scss';

interface ResourceBarProps {
  initialS1: number;
  initialS2: number;
  initialS3: number;
  initialS4: number;
  prodS1: number;
  prodS2: number;
  prodS3: number;
  prodS4: number;
  sklad: number;
  /** Unix timestamp (seconds) when resources were last calculated */
  surovinyTime: number;
}

export default function ResourceBar({
  initialS1,
  initialS2,
  initialS3,
  initialS4,
  prodS1,
  prodS2,
  prodS3,
  prodS4,
  sklad,
  surovinyTime,
}: ResourceBarProps) {
  const [resources, setResources] = useState({ s1: initialS1, s2: initialS2, s3: initialS3, s4: initialS4 });

  useEffect(() => {
    const tick = () => {
      const now = Date.now() / 1000;
      const elapsed = now - surovinyTime;

      setResources({
        s1: Math.min(Math.floor(initialS1 + (prodS1 / 3600) * elapsed), sklad),
        s2: Math.min(Math.floor(initialS2 + (prodS2 / 3600) * elapsed), sklad),
        s3: Math.min(Math.floor(initialS3 + (prodS3 / 3600) * elapsed), sklad),
        s4: Math.min(Math.floor(initialS4 + (prodS4 / 3600) * elapsed), sklad),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [initialS1, initialS2, initialS3, initialS4, prodS1, prodS2, prodS3, prodS4, sklad, surovinyTime]);

  const items = [
    { icon: '\u{1F9F1}', value: resources.s1, prod: prodS1 },
    { icon: '\u2699\uFE0F', value: resources.s2, prod: prodS2 },
    { icon: '\u{1F6E2}\uFE0F', value: resources.s3, prod: prodS3 },
    { icon: '\u{1F33E}', value: resources.s4, prod: prodS4 },
  ];

  return (
    <div className={styles.topResources}>
      {items.map((r) => (
        <span key={r.icon} className={styles.resourceBadge}>
          <span className={styles.resourceBadgeIcon}>{r.icon}</span>
          <span className={styles.resourceBadgeValue}>
            {r.value.toLocaleString('cs-CZ')}
          </span>
          <span className={styles.resourceBadgeProd}>
            +{r.prod.toLocaleString('cs-CZ')}/h
          </span>
        </span>
      ))}
    </div>
  );
}
