import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Flowid.ai — AI Fluid System Engineering for Malaysia',
  description:
    'Generate a complete industrial fluid system specification in minutes — full BOM with Malaysian supplier pricing in MYR, HAZOP risk register, DOSH compliance, and PDF engineering report. Built for Malaysian plant engineers and EPC contractors.',
  keywords: [
    'fluid system engineering Malaysia',
    'industrial BOM Malaysia',
    'process engineering software Malaysia',
    'DOSH compliance',
    'PETRONAS PTS',
    'palm oil fluid system',
    'piping design Malaysia',
    'AI engineering tool',
    'MYR equipment pricing',
    'plant engineering Malaysia',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-white antialiased`}>
        <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
      </body>
    </html>
  );
}
