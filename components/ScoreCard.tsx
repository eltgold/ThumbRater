import React from 'react';
import clsx from 'clsx';

interface ScoreCardProps {
  label: string;
  score: number;
  icon?: React.ReactNode;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ label, score, icon }) => {
  const getColor = (s: number) => {
    if (s >= 8) return 'bg-green-300';
    if (s >= 5) return 'bg-yellow-300';
    return 'bg-red-300';
  };

  const bgClass = getColor(score);

  return (
    <div className={clsx(
      "flex flex-col items-center justify-center p-3 rounded-xl border-thick transition-all duration-300 hard-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
      bgClass
    )}>
      {icon && <div className="mb-1 scale-90 text-black">{icon}</div>}
      <span className="text-4xl font-bold tracking-tighter text-black">{score}</span>
      <span className="text-xs font-bold uppercase tracking-wider text-black border-t-2 border-black pt-1 mt-1 w-full text-center">{label}</span>
    </div>
  );
};