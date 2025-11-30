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
    <div className="w-full h-full bg-white border-[3px] border-black p-2 font-sans relative">
      {/* Tape Visual */}
      <div className="absolute -top-4 right-1/2 translate-x-1/2 w-24 h-6 bg-[#fcd34d] opacity-80 border-2 border-black rotate-[-2deg] z-10"></div>
      
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          <PolarGrid stroke="#000" strokeWidth={2} />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#000', fontSize: 12, fontWeight: '900', fontFamily: '"Comic Neue", cursive', textTransform: 'uppercase' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="Score"
            dataKey="A"
            stroke="#000"
            strokeWidth={3}
            fill="#ec4899" /* Pink 500 */
            fillOpacity={0.8}
            isAnimationActive={true}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              borderColor: '#000', 
              borderWidth: '3px',
              color: '#000',
              borderRadius: '0px',
              fontWeight: 'bold',
              fontFamily: '"Comic Neue", cursive',
              boxShadow: '4px 4px 0px 0px #000'
            }}
            itemStyle={{ color: '#ec4899', fontWeight: '900' }}
            cursor={{ stroke: '#000', strokeWidth: 2 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};