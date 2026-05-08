'use client';

import { useEffect, useState } from 'react';
import { fetchMapData, MapCity } from '@/app/actions/mapa';

const CANVAS_BG = '#0a0f0a';
const GRID_COLOR = 'rgba(30, 60, 30, 0.3)';
const GRID_SPACING = 40;
const CITY_RADIUS = 4;
const OWN_CITY_RADIUS = 6;
const MAP_WORLD_SIZE = 1000;

export default function MapBackground() {
  const [cities, setCities] = useState<MapCity[]>([]);
  const [myCity, setMyCity] = useState<MapCity | null>(null);

  useEffect(() => {
    fetchMapData().then((data) => {
      if (data) {
        setCities(data.cities);
        setMyCity(data.myCity);
      }
    });
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        background: CANVAS_BG,
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid pattern via SVG */}
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <pattern
            id="mapGrid"
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_SPACING} 0 L 0 0 0 ${GRID_SPACING}`}
              fill="none"
              stroke={GRID_COLOR}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" />

        {/* City dots - scale world coords to viewport */}
        {cities.map((city) => {
          const isOwn = myCity && city.id === myCity.id;
          const cx = `${(city.x / MAP_WORLD_SIZE) * 100}%`;
          const cy = `${(city.y / MAP_WORLD_SIZE) * 100}%`;
          return (
            <circle
              key={city.id}
              cx={cx}
              cy={cy}
              r={isOwn ? OWN_CITY_RADIUS : CITY_RADIUS}
              fill={isOwn ? '#22c55e' : '#3b82f6'}
              opacity={isOwn ? 0.9 : 0.5}
            />
          );
        })}

        {/* Glow ring around own city */}
        {myCity && (
          <circle
            cx={`${(myCity.x / MAP_WORLD_SIZE) * 100}%`}
            cy={`${(myCity.y / MAP_WORLD_SIZE) * 100}%`}
            r={OWN_CITY_RADIUS + 6}
            fill="none"
            stroke="#22c55e"
            strokeWidth="1.5"
            opacity={0.4}
          >
            <animate
              attributeName="r"
              values={`${OWN_CITY_RADIUS + 4};${OWN_CITY_RADIUS + 10};${OWN_CITY_RADIUS + 4}`}
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;0.15;0.4"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* Vignette overlay for atmosphere */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
