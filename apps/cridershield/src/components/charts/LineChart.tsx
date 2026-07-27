import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type TrendChartDataPoint = {
  time: string;
  queries: number;
  blocked: number;
};

type TrendChartProps = {
  data: TrendChartDataPoint[];
};

export const TrendChart = ({ data }: TrendChartProps) => (
  <div className="h-64 w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
    <h3 className="text-sm font-medium text-gray-500 mb-4">Query Trend (24h)</h3>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} />
        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: '#fff' }} />
        <Line type="monotone" dataKey="queries" stroke="#3B82F6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="blocked" stroke="#EF4444" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
