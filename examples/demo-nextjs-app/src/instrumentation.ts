import { LatticeNextPlugin } from '@caryyon/plugin-nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔍 Initializing Lattice plugin for Next.js...');

    const lattice = new LatticeNextPlugin({
      serviceName: 'demo-nextjs-app',
      environment: 'development',
      apiEndpoint: 'http://localhost:8100/api/v1',
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
