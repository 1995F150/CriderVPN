import React from 'react';

export const StatCard = ({ title, value, icon: Icon, status }: any) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <p className={`text-2xl font-bold mt-1 ${status === 'green' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      </div>
      {Icon && <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"><Icon className="w-6 h-6 text-blue-500 dark:text-blue-400" /></div>}
    </div>
  );
};
