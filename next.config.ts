import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Obligamos al compilador a incrustar la variable directamente en el servidor de desarrollo
  env: {
    DATABASE_URL: process.env.DATABASE_URL || "",
  },
};

export default nextConfig;