# @lattice.black/plugin-nextjs

Lattice plugin for Next.js applications. Automatically discovers API routes and dependencies, then submits to the Lattice collector for visualization.

**⚠️ Server-Only Package**: This plugin uses Node.js file system APIs and can only run on the server. It should be used in:
- `instrumentation.ts` (recommended)
- Server Components
- API Routes
- Server Actions

## Installation

```bash
yarn add @lattice.black/plugin-nextjs
# or
npm install @lattice.black/plugin-nextjs
```

## Configuration

### 1. Configure next.config.js

Enable the instrumentation hook in your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig;
```

### 2. Create Instrumentation File (Recommended)

Create `src/instrumentation.ts` in your Next.js project:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔍 Initializing Lattice plugin for Next.js...');

    // Use dynamic import to avoid webpack bundling server-only code
    const { LatticeNextPlugin } = await import('@lattice.black/plugin-nextjs');

    const lattice = new LatticeNextPlugin({
      serviceName: 'my-nextjs-app',
      environment: 'development',
      apiEndpoint: 'http://localhost:3000/api/v1',
      enabled: true,
      autoSubmit: true,
      onAnalyzed: (metadata) => {
        console.log('📊 Service metadata analyzed:', {
          service: metadata.service.name,
          routes: metadata.routes?.length,
          dependencies: metadata.dependencies?.length,
        });
      },
      onSubmitted: (response) => {
        console.log('✅ Metadata submitted to Lattice:', response.serviceId);
      },
      onError: (error) => {
        console.error('❌ Lattice error:', error.message);
      },
    });

    try {
      await lattice.analyze();
    } catch (error) {
      console.error('Failed to analyze service:', error);
    }
  }
}
```

**Important**: Always use dynamic `import()` in `instrumentation.ts` to avoid webpack bundling issues with Node.js-specific packages. This is the recommended pattern for Next.js 14+.

## Quick Start (Alternative Methods)

### App Router with Manual Import

Create a file in your Next.js project (e.g., `lib/lattice.ts`):

```typescript
import { LatticeNextPlugin } from '@lattice.black/plugin-nextjs';

const lattice = new LatticePlugin({
  serviceName: 'my-nextjs-app',
  apiKey: process.env.LATTICE_API_KEY,
});

export async function registerLattice() {
  await lattice.analyze();
  return lattice;
}
```

Then in your root layout or startup file:

```typescript
import { registerLattice } from '@/lib/lattice';

// In server component or API route
registerLattice().catch(console.error);
```

### Pages Router (Next.js 12 and below)

Add to `pages/_app.tsx`:

```typescript
import { LatticePlugin } from '@lattice/plugin-nextjs';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      const lattice = new LatticePlugin();
      lattice.analyze().catch(console.error);
    }
  }, []);

  return <Component {...pageProps} />;
}
```

## Configuration

```typescript
const lattice = new LatticePlugin({
  // Service identity
  serviceName: 'my-nextjs-app',       // Auto-detected if not provided
  environment: 'production',           // Defaults to NODE_ENV

  // API connection
  apiEndpoint: 'https://lattice-production.up.railway.app/api/v1',
  apiKey: process.env.LATTICE_API_KEY,

  // Behavior
  enabled: true,                       // Enable/disable plugin
  autoSubmit: true,                    // Auto-submit on analyze
  submitInterval: 300000,              // Re-submit every 5 minutes

  // Discovery options
  discoverRoutes: true,
  discoverDependencies: true,

  // Next.js specific
  appDir: 'app',                       // App Router directory
  pagesDir: 'pages',                   // Pages Router directory

  // Callbacks
  onAnalyzed: (metadata) => {
    console.log(`Discovered ${metadata.routes.length} routes`);
  },
  onSubmitted: (response) => {
    console.log(`Submitted: ${response.serviceId}`);
  },
  onError: (error) => {
    console.error('Lattice error:', error);
  },
});
```

## Environment Variables

```bash
LATTICE_SERVICE_NAME=my-nextjs-app
LATTICE_API_ENDPOINT=https://lattice-production.up.railway.app/api/v1
LATTICE_API_KEY=your-api-key
LATTICE_ENABLED=true
```

## API

### `analyze(): Promise<ServiceMetadataSubmission>`

Analyze Next.js app and discover API routes and dependencies.

### `submit(metadata?: ServiceMetadataSubmission): Promise<SubmissionResponse>`

Submit metadata to Lattice collector API.

### `getMetadata(): ServiceMetadataSubmission | null`

Get currently analyzed metadata.

### `start(): void`

Start auto-submit interval.

### `stop(): void`

Stop auto-submit interval.

## Supported Route Patterns

The plugin automatically discovers:

- **App Router**: `app/api/**/*.ts` route handlers
- **Pages Router**: `pages/api/**/*.ts` API routes
- Dynamic routes: `[param]`, `[...slug]`
- Route groups: `(group)`
- Catch-all routes

## License

MIT
