/**
 * @file global-error.tsx
 * @description Root global error boundary for Next.js App Router.
 * Catches unhandled exceptions—including errors inside the root layout—and renders a fallback recovery UI.
 */

'use client';

import NextError from 'next/error';

import { routing } from '@/lib/I18nRouting';

export default function GlobalError() {
  return (
    <html lang={routing.defaultLocale}>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
