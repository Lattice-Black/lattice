/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    instrumentationHook: true,
  },
  // Keep these packages out of webpack bundle for better performance
  serverComponentsExternalPackages: [
    'pino',
    'pino-pretty',
    'thread-stream',
    'real-require',
  ],
}

module.exports = nextConfig
