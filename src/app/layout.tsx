import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Flowid.ai — AI Fluid System Engineering',
  description:
    'AI-powered industrial fluid system design. Input your process parameters and receive complete component specifications, risk assessments, and maintenance schedules.',
  keywords: ['fluid system', 'AI engineering', 'process design', 'industrial automation'],
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
