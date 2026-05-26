import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://flowid-ai.vercel.app'),
  title: 'Flowid.ai — AI Fluid System Engineering for Malaysia',
  description:
    'Generate a complete industrial fluid system specification in minutes — full BOM with Malaysian supplier pricing in MYR, HAZOP risk register, P&ID diagram, server-verified engineering calculations, and PDF report. Built for Malaysian plant engineers and EPC contractors.',
  keywords: [
    'fluid system engineering Malaysia',
    'industrial BOM Malaysia',
    'process engineering software Malaysia',
    'DOSH compliance',
    'BOMBA compliance',
    'PETRONAS PTS',
    'palm oil fluid system',
    'piping design Malaysia',
    'AI engineering tool',
    'MYR equipment pricing',
    'plant engineering Malaysia',
    'P&ID generator',
    'HAZOP risk register',
    'AACE Class 4-5 cost estimate',
  ],
  authors: [{ name: 'Ali Ghalab' }, { name: 'Amr Ghalab' }],
  openGraph: {
    title: 'Flowid.ai — AI Fluid System Engineering for Malaysia',
    description:
      'Feasibility-grade fluid system specifications in under 4 minutes. AACE Class 4-5 cost estimates, HAZOP risk registers, P&ID diagrams, and PDF engineering reports — built for Malaysian industry.',
    url: 'https://flowid-ai.vercel.app',
    siteName: 'Flowid.ai',
    locale: 'en_MY',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowid.ai — AI Fluid System Engineering for Malaysia',
    description: 'Feasibility-grade fluid system documentation in under 4 minutes. For Malaysian engineers.',
  },
  themeColor: '#020817',
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
