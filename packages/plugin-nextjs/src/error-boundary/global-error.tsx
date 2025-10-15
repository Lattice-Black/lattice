'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Error will be captured by browser SDK if initialized
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
          <h2>Something went wrong!</h2>
          <p style={{ color: '#666' }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
