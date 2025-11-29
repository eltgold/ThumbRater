import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { ThumbnailScores } from '../types';

interface AnalysisChartProps {
  scores: ThumbnailScores;
}

export const AnalysisChart: React.FC<AnalysisChartProps> = ({ scores }) => {
  const data = [
    { subject: 'Clarity', A: scores.clarity, fullMark: 10 },
    { subject: 'Curiosity', A: scores.curiosity, fullMark: 10 },
    { subject: 'Text', A: scores.text_readability, fullMark: 10 },
    { subject: 'Emotion', A: scores.emotion, fullMark: 10 },
    { subject: 'Overall', A: scores.overall, fullMark: 10 },
  ];

  return (
    <div className="w-full h-64 sm:h-80 font-bold bg-white border-4 border-black p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          <PolarGrid stroke="#000" strokeWidth={3} strokeDasharray="5 5" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#000', fontSize: 16, fontWeight: '900', fontFamily: 'Comic Sans MS' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="Score"
            dataKey="A"
            stroke="#000"
            strokeWidth={4}
            fill="#ec4899" // Hot pink
            fillOpacity={0.9}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fef08a', // Yellow
              borderColor: '#000', 
              borderWidth: '4px',
              color: '#000',
              fontFamily: 'Comic Sans MS',
              fontWeight: 'bold',
              boxShadow: '6px 6px 0px 0px #000'
            }}
            itemStyle={{ color: '#000' }}
            cursor={{ stroke: '#000', strokeWidth: 2 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};