/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    instrumentationHook: true,
    // Keep these packages out of webpack bundle for better performance
    serverComponentsExternalPackages: [
      'pino',
      'pino-pretty',
      'thread-stream',
      'real-require',
      '@lattice.black/plugin-nextjs',
      '@lattice.black/core',
      'glob',
    ],
  },
  webpack: (config, { isServer }) => {
    // Alias @duro/core to @caryyon/duro
    config.resolve.alias = {
      ...config.resolve.alias,
      '@duro/core': '@caryyon/duro',
    };

    // Prevent client-side bundling of server-only packages
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        glob: false,
      };
      // Point server-only packages to their browser stubs for client builds
      config.resolve.alias = {
        ...config.resolve.alias,
        '@duro/core': '@caryyon/duro',
        '@lattice.black/plugin-nextjs': '@lattice.black/plugin-nextjs/dist/browser.js',
      };
    }
    return config;
  },
}

module.exports = nextConfig
