import React from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, max, unit = '%' }) => {
  const percentage = Math.min((value / max) * 100, 100);

  const getColor = (pct: number) => {
    if (pct < 60) return 'bg-emerald-500';
    if (pct < 85) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-sm font-medium text-slate-300">
          {value.toFixed(1)}{unit} / {max}{unit}
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${getColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
