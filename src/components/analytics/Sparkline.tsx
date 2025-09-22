// SPDX-License-Identifier: Apache-2.0
interface SparklineData {
  day: string;
  views: number;
}

interface SparklineProps {
  data: SparklineData[];
  width?: number;
  height?: number;
  className?: string;
}

export default function Sparkline({ 
  data, 
  width = 120, 
  height = 32, 
  className = "" 
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <div 
        className={`inline-block bg-muted/20 rounded ${className}`}
        style={{ width, height }}
      />
    );
  }

  const values = data.map(d => d.views);
  const max = Math.max(...values, 1); // Avoid division by zero
  const min = Math.min(...values);
  const range = max - min || 1;

  // Create SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - 8) + 4; // 4px padding on each side
    const y = height - 4 - ((d.views - min) / range) * (height - 8); // 4px padding top/bottom
    return `${x},${y}`;
  }).join(' ');

  const pathData = `M ${points}`;

  return (
    <svg 
      width={width} 
      height={height} 
      className={`inline-block ${className}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Background */}
      <rect 
        width={width} 
        height={height} 
        fill="currentColor" 
        opacity="0.05" 
        rx="4"
      />
      
      {/* Sparkline */}
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Data points */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - 8) + 4;
        const y = height - 4 - ((d.views - min) / range) * (height - 8);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1.5"
            fill="currentColor"
            opacity="0.8"
          />
        );
      })}
    </svg>
  );
}