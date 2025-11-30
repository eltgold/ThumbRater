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
    <div className="w-full h-full bg-yellow-100 border-thick rounded-xl p-2 font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#000" strokeWidth={2} />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#000', fontSize: 13, fontWeight: '900', fontFamily: 'Comic Neue, Comic Sans MS' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
          <Radar
            name="Score"
            dataKey="A"
            stroke="#ec4899" /* Pink 500 */
            strokeWidth={4}
            fill="#ec4899"
            fillOpacity={0.6}
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
              fontFamily: 'Comic Neue, Comic Sans MS',
              boxShadow: '4px 4px 0px 0px #000'
            }}
            itemStyle={{ color: '#ec4899' }}
            cursor={{ stroke: '#000', strokeWidth: 2 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};