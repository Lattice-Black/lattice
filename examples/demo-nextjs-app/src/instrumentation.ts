export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔍 Initializing Lattice plugin for Next.js...');

    // Use dynamic import to avoid webpack bundling server-only code
    const { LatticeNextPlugin } = await import('@caryyon/plugin-nextjs');

    const lattice = new LatticeNextPlugin({
      serviceName: 'demo-nextjs-app',
      environment: 'development',
      apiEndpoint: 'http://localhost:8100/api/v1',
      enabled: true,
      autoSubmit: false, // Disabled to avoid hitting service limit on free plan
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
