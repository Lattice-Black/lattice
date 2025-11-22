'use client';

import Link from 'next/link';
import { DotGrid } from '@/components/DotGrid';
import { PublicNav } from '@/components/PublicNav';
import { Button, Card, CardContent, Heading, Text, Grid } from '@duro/core';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      <DotGrid />

      <div className="relative z-10">
        <PublicNav />

        {/* Hero Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="mx-auto max-w-4xl text-center">
            {/* Decorative Icon */}
            <div className="mx-auto mb-12 flex h-24 w-24 items-center justify-center">
              <div className="relative h-full w-full">
                <div className="absolute inset-0 border-2 border-gray-500" />
                <div className="absolute inset-4 border border-gray-500" />
                <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-gray-500" />
                <div className="absolute left-1/2 top-0 h-4 w-px bg-gray-500" />
                <div className="absolute bottom-0 left-1/2 h-4 w-px bg-gray-500" />
                <div className="absolute left-0 top-1/2 h-px w-4 bg-gray-500" />
                <div className="absolute right-0 top-1/2 h-px w-4 bg-gray-500" />
              </div>
            </div>

            <Heading level={1} className="mb-6 text-6xl uppercase tracking-tight">
              Service Discovery
              <br />
              Made Simple
            </Heading>
            <Text size="xl" className="mb-12 text-gray-500">
              Automatically discover, map, and monitor your microservices architecture.
              <br />
              Real-time visibility into your entire service ecosystem.
            </Text>

            <div className="flex gap-4 justify-center">
              <Link href="/signup">
                <Button variant="primary" size="lg">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="outline" size="lg">
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-gray-800 bg-black/50 backdrop-blur-sm py-24">
          <div className="container mx-auto px-6">
            <Grid className="gap-12 md:grid-cols-3">
              <Card>
                <CardContent>
                  <div className="mb-4 h-12 w-12 border border-gray-800" />
                  <Heading level={3} className="mb-3 uppercase tracking-wider">
                    Auto-Discovery
                  </Heading>
                  <Text size="sm" className="text-gray-500">
                    Plugins automatically detect and register your services, routes, and dependencies. No manual configuration required.
                  </Text>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="mb-4 h-12 w-12 border border-gray-800" />
                  <Heading level={3} className="mb-3 uppercase tracking-wider">
                    Real-Time Monitoring
                  </Heading>
                  <Text size="sm" className="text-gray-500">
                    Track service health, dependencies, and API routes in real-time. Visualize your architecture with interactive network graphs.
                  </Text>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="mb-4 h-12 w-12 border border-gray-800" />
                  <Heading level={3} className="mb-3 uppercase tracking-wider">
                    Framework Support
                  </Heading>
                  <Text size="sm" className="text-gray-500">
                    Works with Express, Next.js, and more. Drop-in plugins integrate with your existing stack in minutes.
                  </Text>
                </CardContent>
              </Card>
            </Grid>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-24">
          <Card className="p-16 text-center">
            <CardContent>
              <Heading level={2} className="mb-4 text-4xl uppercase tracking-tight">
                Ready to Get Started?
              </Heading>
              <Text size="lg" className="mb-8 text-gray-500">
                Start discovering your services in under 5 minutes.
              </Text>
              <Link href="/signup">
                <Button variant="primary" size="lg">
                  Create Free Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-black/50 backdrop-blur-sm py-12">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-6 w-6">
                  <div className="absolute inset-0 border border-gray-500" />
                </div>
                <Text size="sm" className="text-gray-600">
                  © 2025 Lattice. All rights reserved.
                </Text>
              </div>
              <div className="flex gap-6">
                <Link href="/docs" className="text-gray-600 hover:text-white transition-colors">
                  <Text size="sm">Documentation</Text>
                </Link>
                <Link href="/pricing" className="text-gray-600 hover:text-white transition-colors">
                  <Text size="sm">Pricing</Text>
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
