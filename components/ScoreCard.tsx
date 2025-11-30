import React from 'react';
import clsx from 'clsx';

interface ScoreCardProps {
  label: string;
  score: number;
  icon?: React.ReactNode;
  rotation?: string; // e.g. 'rotate-1' or 'rotate-[-2deg]'
  color?: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ label, score, icon, rotation = 'rotate-0', color }) => {
  const getColor = (s: number) => {
    if (color) return color;
    if (s >= 8) return 'bg-[#86efac]'; // Green 300 equivalent
    if (s >= 5) return 'bg-[#fde047]'; // Yellow 300 equivalent
    return 'bg-[#fca5a5]'; // Red 300 equivalent
  };

  const bgClass = getColor(score);

  return (
    <div className={clsx(
      "relative flex flex-col items-center justify-center p-4 border-[3px] border-black hard-shadow transition-transform hover:scale-105 hover:z-10",
      bgClass,
      rotation
    )}>
      {/* Tape Visual */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-4 bg-white/50 border border-black/20 rotate-1 backdrop-blur-sm z-10"></div>
      
      {icon && <div className="mb-1 scale-90 text-black">{icon}</div>}
      <span className="text-5xl font-black tracking-tighter text-black drop-shadow-sm">{score}</span>
      <span className="text-xs font-black uppercase tracking-widest text-black border-t-[3px] border-black pt-1 mt-1 w-full text-center bg-white/30">
        {label}
      </span>
    </div>
  );
};