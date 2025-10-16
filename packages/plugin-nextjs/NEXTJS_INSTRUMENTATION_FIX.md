# Next.js 14.2 Instrumentation Hook with Server-Only Packages

## Problem

When using Next.js 14.2's instrumentation hook with packages that depend on Node.js-specific modules (like `glob`, `fs`, `path`), webpack attempts to bundle these server-only packages, causing errors:

```
UnhandledSchemeError: Reading from "node:fs/promises" is not handled by plugins
Error: This module cannot be imported from a Client Component module. It should only be used from a Server Component.
```

## Root Cause

The `instrumentation.ts` file gets processed by webpack even though it only runs on the server. The `serverComponentsExternalPackages` configuration option **does not apply** to the instrumentation hook - it only applies to Server Components.

## Solution

Use **dynamic imports** in the instrumentation file instead of static imports. This prevents webpack from attempting to bundle the server-only package at build time.

### Before (Static Import - Causes Errors)

```typescript
import { LatticeNextPlugin } from '@lattice.black/plugin-nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const lattice = new LatticeNextPlugin({
      serviceName: 'my-app',
      // ... config
    });
    await lattice.analyze();
  }
}
```

### After (Dynamic Import - Works Correctly)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Use dynamic import to avoid webpack bundling
    const { LatticeNextPlugin } = await import('@lattice.black/plugin-nextjs');

    const lattice = new LatticeNextPlugin({
      serviceName: 'my-app',
      // ... config
    });
    await lattice.analyze();
  }
}
```

## Next.js Configuration

No special webpack configuration is needed with dynamic imports:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig;
```

## Why This Works

1. **Static imports** are processed at build time by webpack, which tries to bundle all dependencies
2. **Dynamic imports** (`await import()`) are resolved at runtime, after the build process
3. The instrumentation hook runs on the Node.js server, so Node.js-specific modules are available at runtime
4. Webpack doesn't attempt to bundle dynamically imported modules that are only used in server-side code

## Best Practices

1. Always use dynamic imports for server-only packages in `instrumentation.ts`
2. Keep the runtime check: `if (process.env.NEXT_RUNTIME === 'nodejs')`
3. Handle errors appropriately with try-catch blocks
4. This pattern applies to any package that uses Node.js built-ins:
   - File system operations (`fs`, `path`)
   - Network operations (`http`, `https`)
   - Process management (`child_process`)
   - Native modules

## References

- Next.js Instrumentation Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
- Dynamic Imports: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import
