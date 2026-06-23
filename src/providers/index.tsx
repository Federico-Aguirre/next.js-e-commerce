'use client';

import React, { PropsWithChildren } from 'react';
import { SessionProvider } from 'next-auth/react';
import { PostHogProvider } from './PostHogProvider'; // Importación limpia de un archivo vecino

export default function Providers({ children }: PropsWithChildren) {
  return (
    <SessionProvider>
      <PostHogProvider>
        {children}
      </PostHogProvider>
    </SessionProvider>
  );
}