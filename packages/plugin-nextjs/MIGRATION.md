# Migration Guide: Fixing Webpack Bundling Issues

If you're experiencing webpack errors like "Module not found: Can't resolve 'node:fs'" or "Can't resolve 'node:path'", this guide will help you fix them.

## The Problem

Versions prior to 0.2.0 used CommonJS format, which Next.js webpack would sometimes try to bundle for client-side code, even when the package should only run on the server. This caused errors like:

```
Module not found: Can't resolve 'node:fs'
Module not found: Can't resolve 'node:path'
```

## The Solution

Version 0.2.0+ uses ESM format and proper package.json exports that tell Next.js to never bundle this package for the browser.

## Migration Steps

### 1. Update the Package

```bash
yarn add @lattice.black/plugin-nextjs@latest
# or
npm install @lattice.black/plugin-nextjs@latest
```

### 2. Update next.config.js

**Add `serverComponentsExternalPackages` to your config:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // ADD THIS LINE:
  serverComponentsExternalPackages: ['@lattice.black/plugin-nextjs'],
};

export default nextConfig;
```

### 3. Update Your Code (If Needed)

Your `src/instrumentation.ts` should look like this:

```typescript
import { LatticeNextPlugin } from '@lattice.black/plugin-nextjs';

export async function register() {
  // IMPORTANT: Only run on Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const lattice = new LatticeNextPlugin({
      serviceName: 'my-nextjs-app',
      environment: process.env.NODE_ENV || 'development',
      apiEndpoint: process.env.LATTICE_API_ENDPOINT,
      enabled: process.env.LATTICE_ENABLED === 'true',
      autoSubmit: true,
    });

    try {
      await lattice.analyze();
    } catch (error) {
      console.error('Failed to analyze service:', error);
    }
  }
}
```

### 4. Verify Your TypeScript Config

Make sure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "esModuleInterop": true
  }
}
```

### 5. Clean Build

After making these changes, clean your Next.js build:

```bash
rm -rf .next
yarn build
# or
npm run build
```

## What Changed?

### Before (v0.1.x - CommonJS)

```json
{
  "main": "dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

**Output format:** CommonJS
```javascript
const path = require('node:path');
exports.LatticeNextPlugin = class LatticeNextPlugin { ... }
```

### After (v0.2.0+ - ESM)

```json
{
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "node": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

**Output format:** ESM
```javascript
import path from 'node:path';
export class LatticeNextPlugin { ... }
```

## Why This Fixes the Issue

1. **ESM Format**: Modern bundlers handle ESM better and respect export conditions
2. **"node" Export Condition**: Tells bundlers this code is Node.js-only
3. **"type": "module"**: Declares the package as ESM at the package level
4. **serverComponentsExternalPackages**: Explicitly tells Next.js to NOT bundle this package

## Troubleshooting

### Still Getting Webpack Errors?

1. Clear your `.next` directory: `rm -rf .next`
2. Clear node_modules and reinstall: `rm -rf node_modules && yarn install`
3. Verify `serverComponentsExternalPackages` is in your next.config.js
4. Ensure you're checking `NEXT_RUNTIME === 'nodejs'` in instrumentation.ts

### TypeScript Errors?

If you see TypeScript errors about module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Edge Runtime Support

This package ONLY works with Node.js runtime. If you're using Edge runtime for some routes, the plugin will skip execution when `NEXT_RUNTIME !== 'nodejs'`.

## Getting Help

If you're still experiencing issues:

1. Check the [USER_GUIDE.md](./USER_GUIDE.md) for detailed setup instructions
2. Open an issue on [GitHub](https://github.com/Lattice-Black/lattice-plugins/issues)
3. Include your Next.js version, node version, and the full error message
