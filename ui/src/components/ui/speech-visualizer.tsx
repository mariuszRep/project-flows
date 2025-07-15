import React, { useEffect, useState } from "react";

interface SpeechVisualizerProps {
  isActive: boolean;
  className?: string;
  barCount?: number;
}

export const SpeechVisualizer: React.FC<SpeechVisualizerProps> = ({ 
  isActive, 
  className = "",
  barCount = 16
}) => {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(5));

  useEffect(() => {
    if (!isActive) {
      setBars(Array(barCount).fill(5));
      return;
    }

    const interval = setInterval(() => {
      setBars(
        Array(barCount).fill(0).map(() => isActive ? Math.floor(Math.random() * 15) + 5 : 5)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, barCount]);

  return (
    <div className={`flex items-center justify-center gap-1 h-5 ${className}`}>
      {bars.map((height, index) => (
        <div
          key={index}
          className="w-1 rounded-full bg-current transition-all duration-100"
          style={{
            height: `${height}px`,
            opacity: isActive ? 1 : 0.5,
          }}
        ></div>
      ))}
    </div>
  );
};

export default SpeechVisualizer;
