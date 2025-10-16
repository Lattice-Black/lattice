/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    // Keep these packages out of webpack bundle - they are server-only
    serverComponentsExternalPackages: [
      '@caryyon/plugin-nextjs',
      '@lattice.black/plugin-nextjs',
      '@caryyon/core',
      '@lattice.black/core',
      'glob',
      'path-scurry',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle node: protocol imports in server-side code
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'fs/promises': false,
        'fs': false,
      }
    }
    return config
  },
}

module.exports = nextConfig
