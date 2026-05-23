'use client';

import dynamic from 'next/dynamic';

// ssr: false must live inside a 'use client' module.
// This prevents Firebase Auth SDK from initialising on the server
// (which would throw auth/invalid-api-key during `next build`).
const ClientLayout = dynamic(() => import('./ClientLayout'), { ssr: false });

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <ClientLayout>{children}</ClientLayout>;
}
