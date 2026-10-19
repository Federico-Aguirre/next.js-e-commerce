import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Never expose server-only secrets through next.config.env.
  // DATABASE_URL is read directly by server code and must remain server-side.
  allowedDevOrigins: ['*.nip.io', '192.168.3.9.nip.io', '*.ngrok-free.app', '*.ngrok-free.dev'],
};

export default withNextIntl(nextConfig);
