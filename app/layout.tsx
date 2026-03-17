import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import '@/styles/sprites.css';

export const metadata: Metadata = {
  title: 'Agent HQ',
  description: 'Watch your CI agents work in real time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 font-sans antialiased">{children}</body>
    </html>
  );
}
