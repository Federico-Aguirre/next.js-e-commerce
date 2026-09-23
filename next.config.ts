import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL || '',
  },
  allowedDevOrigins: [
    '*.nip.io',
    '192.168.3.9.nip.io',
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
  ],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
