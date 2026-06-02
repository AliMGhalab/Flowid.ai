import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  // pdf-parse uses an old `pdfjs-dist` build that fails server-bundling unless
  // we keep it external. canvas is a transitive dep we don't actually use.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  async headers() {
    return [
      {
        // Never cache auth pages — they need fresh Firebase/Google scripts every time
        source: '/(login|signup)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
