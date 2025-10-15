#!/usr/bin/env node
import { LatticeNextPlugin } from './index.js';
/**
 * CLI tool to run Lattice analysis and submission
 * Usage: lattice-next --service-name my-app --api-key xxx
 */
async function main() {
    const serviceName = process.env.LATTICE_SERVICE_NAME || process.argv.find(arg => arg.startsWith('--service-name='))?.split('=')[1];
    const apiKey = process.env.LATTICE_API_KEY || process.argv.find(arg => arg.startsWith('--api-key='))?.split('=')[1];
    const apiEndpoint = process.env.LATTICE_API_ENDPOINT || process.argv.find(arg => arg.startsWith('--api-endpoint='))?.split('=')[1];
    const environment = process.env.NODE_ENV || process.env.VERCEL_ENV || 'production';
    if (!serviceName) {
        console.error('❌ Error: --service-name is required');
        process.exit(1);
    }
    console.log('🔍 Running Lattice analysis...');
    try {
        const plugin = new LatticeNextPlugin({
            serviceName,
            apiKey,
            apiEndpoint,
            environment,
            enabled: true,
            autoSubmit: true,
        });
        await plugin.analyze();
        console.log('✅ Lattice analysis complete');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Lattice analysis failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=cli.js.map