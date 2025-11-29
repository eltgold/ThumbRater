import React from 'react';
import clsx from 'clsx';

interface ScoreCardProps {
  label: string;
  score: number;
  icon?: React.ReactNode;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ label, score, icon }) => {
  const getColor = (s: number) => {
    if (s >= 8) return 'bg-[#86efac]'; // Greenish
    if (s >= 5) return 'bg-[#fde047]'; // Yellowish
    return 'bg-[#fca5a5]'; // Reddish
  };

  const bgColor = getColor(score);

  return (
    <div className={clsx(
      "flex flex-col items-center justify-center p-4 border-[6px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:rotate-2",
      bgColor
    )}>
      {icon && <div className="mb-2 text-black transform scale-125">{icon}</div>}
      <span className="text-5xl font-black text-black drop-shadow-sm">{score}</span>
      <span className="text-xs font-black uppercase tracking-widest mt-2 text-center text-black bg-white border-2 border-black px-2 py-0.5">{label}</span>
    </div>
  );
};