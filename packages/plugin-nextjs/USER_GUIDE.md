# Using @lattice.black/plugin-nextjs

This guide shows you how to properly integrate the Lattice Next.js plugin into your Next.js application.

## Installation

```bash
npm install @lattice.black/plugin-nextjs
# or
yarn add @lattice.black/plugin-nextjs
```

## Important: This is a Server-Only Package

The `@lattice.black/plugin-nextjs` package uses Node.js APIs (`fs`, `path`, `glob`) and is designed to run **ONLY on the server**. It will not work in client-side code or browser environments.

## Setup

### Step 1: Configure next.config.js

Enable the instrumentation hook in your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

### Step 2: Create instrumentation.ts

Create a file at `src/instrumentation.ts` (or `instrumentation.ts` in your project root):

```typescript
export async function register() {
  // Only run on Node.js server runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Use dynamic import to avoid webpack bundling server-only code
    const { LatticeNextPlugin } = await import('@lattice.black/plugin-nextjs');

    const lattice = new LatticeNextPlugin({
      serviceName: 'my-nextjs-app',
      environment: process.env.NODE_ENV || 'development',
      apiEndpoint: process.env.LATTICE_API_ENDPOINT,
      enabled: process.env.LATTICE_ENABLED === 'true',
      autoSubmit: true,
      appDir: './src/app', // Adjust if your app directory is elsewhere
      onAnalyzed: (metadata) => {
        console.log('Service metadata analyzed:', metadata);
      },
      onError: (error) => {
        console.error('Lattice error:', error);
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

**Important**: Always use dynamic `import()` in `instrumentation.ts` to prevent webpack from trying to bundle Node.js-specific packages. This is the recommended pattern for Next.js 14+.

### Step 3: Environment Variables

Add these to your `.env.local`:

```env
LATTICE_ENABLED=true
LATTICE_API_ENDPOINT=http://localhost:3000/api/v1
```

## Configuration Options

```typescript
interface LatticeNextConfig {
  serviceName: string;           // Required: Your service name
  environment?: string;           // Optional: 'development', 'production', etc.
  apiEndpoint?: string;           // Optional: Lattice API endpoint
  enabled?: boolean;              // Optional: Enable/disable the plugin
  autoSubmit?: boolean;           // Optional: Auto-submit metadata (default: true)
  appDir?: string;                // Optional: Path to app directory (default: 'src/app')
  onAnalyzed?: (metadata) => void;    // Optional: Callback after analysis
  onSubmitted?: (response) => void;   // Optional: Callback after submission
  onError?: (error: Error) => void;   // Optional: Error handler
}
```

## How It Works

1. **Instrumentation Hook**: Next.js calls `register()` during server startup
2. **Runtime Check**: The plugin only runs when `NEXT_RUNTIME === 'nodejs'`
3. **Route Discovery**: Scans your `app/api` directory for route handlers
4. **Dependency Analysis**: Reads your `package.json` to discover dependencies
5. **Metadata Submission**: Sends discovered metadata to your Lattice control plane

## What Gets Discovered

### Routes
- Scans `app/api/**/route.{ts,js}` files
- Extracts HTTP methods (GET, POST, PUT, DELETE, etc.)
- Maps routes to their file paths

### Dependencies
- Production dependencies from `package.json`
- Development dependencies
- Version ranges and scopes

## Troubleshooting

### "Module not found: Can't resolve 'node:fs'" or "UnhandledSchemeError: Reading from 'node:fs/promises'"

This error means Next.js webpack is trying to bundle the package. Make sure:

1. You're using dynamic `import()` in your instrumentation file (not static imports)
2. You're using the instrumentation hook correctly
3. You're checking for `process.env.NEXT_RUNTIME === 'nodejs'`

### Package Not Analyzing Routes

1. Verify your `appDir` configuration points to the correct directory
2. Ensure route files follow Next.js naming conventions: `route.ts` or `route.js`
3. Check console logs for any error messages

### TypeScript Errors

Make sure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "esModuleInterop": true
  }
}
```

## Example Project Structure

```
my-nextjs-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── users/
│   │   │   │   └── route.ts
│   │   │   └── posts/
│   │   │       └── route.ts
│   │   └── page.tsx
│   └── instrumentation.ts
├── next.config.js
├── package.json
└── .env.local
```

## Best Practices

1. **Use Environment Variables**: Control the plugin with environment variables for different environments
2. **Error Handling**: Always wrap the `analyze()` call in try-catch
3. **Conditional Execution**: Only enable in production or specific environments
4. **Logging**: Use the callback functions to monitor plugin behavior

## Support

For issues, questions, or contributions:
- GitHub: https://github.com/Lattice-Black/lattice-plugins
- Package: https://www.npmjs.com/package/@lattice.black/plugin-nextjs
