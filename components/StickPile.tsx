import React from 'react';

interface StickPileProps {
  count: number;
  x: number;
  y: number;
  isPlayer1: boolean;
}

const StickPile: React.FC<StickPileProps> = ({ count, x, y, isPlayer1 }) => {
  if (count <= 0) return null;

  return (
    <div
      className="absolute flex flex-col items-center justify-end"
      style={{
        left: x,
        top: y - 40,
        width: 60,
        height: 40,
        transform: 'translate(-50%, 0)',
      }}
    >
        <div className="text-xs font-bold text-amber-800 bg-amber-200 px-2 rounded mb-1 opacity-80 whitespace-nowrap">
            {isPlayer1 ? "Get Sticks (A/D)" : "Get Sticks (Arrows)"}
        </div>
      {/* Render sticks in a messy pile */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute bg-amber-700 border border-amber-900 rounded-sm"
          style={{
            width: 40,
            height: 6,
            bottom: i * 4,
            left: (i % 2 === 0 ? -5 : 5) + (Math.random() * 4 - 2),
            transform: `rotate(${Math.random() * 20 - 10}deg)`,
          }}
        />
      ))}
    </div>
  );
};

export default StickPile;