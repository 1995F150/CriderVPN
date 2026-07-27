import './globals.css';
import React from 'react';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'CriderShield',
  description: 'Network Engine and DNS Sinkhole',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
