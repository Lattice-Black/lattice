'use client';

import { SessionProvider } from 'next-auth/react';
import { DuroProvider } from '@duro/core';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DuroProvider colorMode="dark">
        {children}
      </DuroProvider>
    </SessionProvider>
  );
}
