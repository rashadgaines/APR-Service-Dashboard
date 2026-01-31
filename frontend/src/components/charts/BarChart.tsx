import React from 'react';


interface BarChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  barColor?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, width = 300, height = 80, barColor = 'var(--primary)' }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barWidth = width / data.length;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {data.map((d, i) => {
        const barHeight = (d.value / maxValue) * (height - 20);
        return (
          <g key={d.label}>
            <rect
              x={i * barWidth + 2}
              y={height - barHeight - 10}
              width={barWidth - 4}
              height={barHeight}
              fill={barColor}
              rx={2}
            />
            <text
              x={i * barWidth + barWidth / 2}
              y={height - 2}
              textAnchor="middle"
              fontSize={8}
              fill="#888"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
