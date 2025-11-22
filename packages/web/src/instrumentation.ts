/**
 * Next.js Instrumentation Hook
 *
 * This runs ONCE when the Next.js server starts, before any routes are loaded.
 * Perfect for initializing logging, service discovery, and monitoring.
 */

/**
 * register() - Called once when Next.js server starts
 * - Runs before any routes are initialized
 * - Can be async
 */
export async function register() {
  // Only run in Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Initializing Next.js server instrumentation...')

    try {
      // Initialize logging infrastructure
      await initializeLogging()

      // Initialize Lattice service discovery plugin
      await initializeLatticePlugin()

      console.log('✅ Server instrumentation complete')
    } catch (error) {
      // Don't throw - log and continue (server should still start)
      console.error('❌ Failed to initialize instrumentation:', error)
    }
  }
}

/**
 * Initialize logging infrastructure
 * - Must run BEFORE any other code that uses logging
 * - Sets up global logger instance
 */
async function initializeLogging() {
  try {
    // Dynamic import to avoid bundling issues
    const { initLogger } = await import('./lib/logging')

    initLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      service: 'lattice-web',
      environment: process.env.NODE_ENV || 'development',
    })

    console.log('📝 Logging initialized')
  } catch (error) {
    console.error('Failed to initialize logging:', error)
  }
}

/**
 * Initialize Lattice service discovery plugin
 * - Discovers API routes and dependencies
 * - Submits service metadata to Lattice API
 */
async function initializeLatticePlugin() {
  try {
    // Use eval('require') to bypass webpack's static analysis.
    // This is the standard pattern for loading server-only Node.js packages
    // in Next.js instrumentation files. The plugin uses fs/glob which can't be bundled.
    // eslint-disable-next-line no-eval
    const { LatticeNextPlugin } = eval("require('@lattice.black/plugin-nextjs')") as typeof import('@lattice.black/plugin-nextjs')

    const apiEndpoint = process.env.LATTICE_API_ENDPOINT || 'https://lattice-production.up.railway.app/api/v1'
    const apiKey = process.env.LATTICE_API_KEY

    if (!apiKey) {
      console.warn('⚠️  LATTICE_API_KEY not set - service discovery will submit without authentication')
    }

    const lattice = new LatticeNextPlugin({
      serviceName: 'lattice-web',
      environment: process.env.NODE_ENV || 'development',
      apiEndpoint,
      apiKey,
      enabled: true,
      autoSubmit: true,
      onAnalyzed: (metadata) => {
        console.log('📊 Service metadata analyzed:', {
          service: metadata.service.name,
          routes: metadata.routes?.length ?? 0,
          dependencies: metadata.dependencies?.length ?? 0,
        })
      },
      onSubmitted: (response: { serviceId: string }) => {
        console.log('✅ Metadata submitted to Lattice:', response.serviceId)
      },
      onError: (error) => {
        console.error('❌ Lattice plugin error:', error.message)
      },
    })

    await lattice.analyze()
    console.log('🔍 Lattice service discovery initialized')
  } catch (error) {
    console.error('Failed to initialize Lattice plugin:', error)
  }
}
