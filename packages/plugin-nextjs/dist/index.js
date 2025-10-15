import { glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs';
import { ServiceStatus, HttpMethod, DependencyType, generateId, } from '@lattice.black/core';
// Re-export error capture utilities
export { initLatticeMonitoring, captureError, addBreadcrumb, getBreadcrumbs, clearBreadcrumbs, } from './client/browser-sdk';
export { default as GlobalError } from './error-boundary/global-error';
export { default as Error } from './error-boundary/error';
export class LatticeNextPlugin {
    constructor(config) {
        this.config = {
            environment: process.env.NODE_ENV || 'development',
            apiEndpoint: process.env.LATTICE_API_ENDPOINT || 'http://localhost:3000/api/v1',
            apiKey: config.apiKey || process.env.LATTICE_API_KEY || '',
            enabled: config.enabled ?? true,
            autoSubmit: config.autoSubmit ?? true,
            appDir: config.appDir || path.join(process.cwd(), 'src/app'),
            onAnalyzed: config.onAnalyzed || (() => { }),
            onSubmitted: config.onSubmitted || (() => { }),
            onError: config.onError || (() => { }),
            ...config,
        };
    }
    async analyze() {
        try {
            const serviceId = generateId();
            const routes = await this.discoverRoutes(serviceId);
            const dependencies = await this.discoverDependencies(serviceId);
            const service = {
                id: serviceId,
                name: this.config.serviceName,
                version: this.getPackageVersion(),
                environment: this.config.environment,
                language: 'typescript',
                framework: 'nextjs',
                runtime: `node-${process.version}`,
                status: ServiceStatus.Active,
                firstSeen: new Date(),
                lastSeen: new Date(),
                discoveredBy: {
                    pluginName: '@lattice/plugin-nextjs',
                    pluginVersion: '0.1.0',
                    schemaVersion: '1.0.0',
                },
            };
            const metadata = {
                service,
                routes,
                dependencies,
            };
            console.log(`✅ Lattice discovered service "${this.config.serviceName}" with ${routes.length} routes and ${dependencies.length} dependencies`);
            this.config.onAnalyzed(metadata);
            if (this.config.autoSubmit) {
                await this.submit(metadata);
            }
            return metadata;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.config.onError(err);
            throw err;
        }
    }
    async discoverRoutes(serviceId) {
        const routes = [];
        // Find all route.ts/route.js files in app/api directory
        const appDir = this.config.appDir;
        const apiDir = path.join(appDir, 'api');
        if (!fs.existsSync(apiDir)) {
            console.log(`ℹ️  No API directory found at ${apiDir}`);
            return routes;
        }
        const routeFiles = await glob('**/route.{ts,js}', {
            cwd: apiDir,
            absolute: true,
        });
        for (const file of routeFiles) {
            const content = fs.readFileSync(file, 'utf-8');
            const relativePath = path.relative(apiDir, file);
            const routePath = '/' + path.dirname(relativePath).replace(/\\/g, '/');
            // Extract HTTP methods from the file
            const methods = this.extractHTTPMethods(content);
            for (const method of methods) {
                routes.push({
                    id: generateId(),
                    serviceId,
                    method,
                    path: routePath === '/' ? '/api' : `/api${routePath}`,
                    middlewareChain: ['nextjs-app-router'],
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                });
            }
        }
        return routes;
    }
    extractHTTPMethods(content) {
        const methods = [];
        const httpMethods = [
            HttpMethod.GET,
            HttpMethod.POST,
            HttpMethod.PUT,
            HttpMethod.DELETE,
            HttpMethod.PATCH,
            HttpMethod.OPTIONS,
            HttpMethod.HEAD,
        ];
        for (const method of httpMethods) {
            // Look for "export async function GET" or "export function GET"
            if (new RegExp(`export\\s+(async\\s+)?function\\s+${method}`, 'g').test(content)) {
                methods.push(method);
            }
        }
        return methods;
    }
    async discoverDependencies(serviceId) {
        const dependencies = [];
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return dependencies;
        }
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};
        // Add production dependencies
        for (const [name, version] of Object.entries(deps)) {
            dependencies.push({
                id: generateId(),
                serviceId,
                packageName: name,
                version: String(version).replace(/^[\^~]/, ''),
                versionRange: String(version),
                dependencyType: DependencyType.Direct,
                scope: name.startsWith('@') ? name.split('/')[0] : undefined,
                firstSeen: new Date(),
                lastSeen: new Date(),
            });
        }
        // Add dev dependencies
        for (const [name, version] of Object.entries(devDeps)) {
            dependencies.push({
                id: generateId(),
                serviceId,
                packageName: name,
                version: String(version).replace(/^[\^~]/, ''),
                versionRange: String(version),
                dependencyType: DependencyType.Dev,
                scope: name.startsWith('@') ? name.split('/')[0] : undefined,
                firstSeen: new Date(),
                lastSeen: new Date(),
            });
        }
        return dependencies;
    }
    getPackageVersion() {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            return packageJson.version || '1.0.0';
        }
        return '1.0.0';
    }
    async submit(metadata) {
        if (!this.config.enabled)
            return;
        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            if (this.config.apiKey) {
                headers['X-Lattice-API-Key'] = this.config.apiKey;
            }
            const response = await fetch(`${this.config.apiEndpoint}/ingest/metadata`, {
                method: 'POST',
                headers,
                body: JSON.stringify(metadata),
            });
            if (!response.ok) {
                throw new Error(`Failed to submit: ${response.statusText}`);
            }
            const result = (await response.json());
            console.log(`✅ Lattice metadata submitted: ${result.serviceId}`);
            this.config.onSubmitted(result);
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.config.onError(err);
        }
    }
}
//# sourceMappingURL=index.js.map