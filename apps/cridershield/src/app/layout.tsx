import './globals.css';
import React from 'react';

export const metadata = {
  title: 'CriderShield',
  description: 'Network Engine and DNS Sinkhole',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
