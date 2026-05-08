'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CountdownTimerProps {
  /** Unix timestamp (seconds) when the action finishes */
  dokonceni: number;
}

export default function CountdownTimer({ dokonceni }: CountdownTimerProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, dokonceni - Math.floor(Date.now() / 1000));
  });

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, dokonceni - Math.floor(Date.now() / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [dokonceni, router]);

  if (remaining <= 0) {
    return <span>Hotovo!</span>;
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (minutes > 0) {
    return <span>{minutes}m {seconds}s</span>;
  }
  return <span>{seconds}s</span>;
}
