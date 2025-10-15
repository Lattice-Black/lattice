/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  // Keep these packages out of webpack bundle - they are server-only
  serverComponentsExternalPackages: [
    '@caryyon/plugin-nextjs',
    '@lattice.black/plugin-nextjs',
    '@caryyon/core',
    '@lattice.black/core',
    'glob',
  ],
}

module.exports = nextConfig
