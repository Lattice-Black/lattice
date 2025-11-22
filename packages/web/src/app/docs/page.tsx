'use client';

/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react/jsx-no-comment-textnodes */
import Link from 'next/link';
import { DotGrid } from '@/components/DotGrid';
import { PublicNav } from '@/components/PublicNav';
import { Button, Card, Heading, Text } from '@duro/core';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black">
      <DotGrid />

      <div className="relative z-10">
        <PublicNav />

        {/* Main Content */}
        <main className="container mx-auto px-6 py-16">
          <div className="mx-auto max-w-4xl">
            {/* Page Header */}
            <div className="mb-16">
              <Heading level={1} className="mb-4 text-5xl uppercase tracking-tight">
                Documentation
              </Heading>
              <Text size="sm" className="text-gray-500">
                Complete guide to integrating Lattice into your microservices architecture
              </Text>
            </div>

            {/* Table of Contents */}
            <Card className="mb-16 p-8">
              <Text size="sm" className="mb-4 uppercase tracking-wider text-gray-500">
                Contents
              </Text>
              <ul className="space-y-2 font-mono text-sm text-gray-400">
                <li>
                  <a href="#introduction" className="hover:text-white transition-colors">
                    → Introduction
                  </a>
                </li>
                <li>
                  <a href="#quick-start" className="hover:text-white transition-colors">
                    → Quick Start
                  </a>
                </li>
                <li>
                  <a href="#express" className="hover:text-white transition-colors">
                    → Express.js Plugin
                  </a>
                </li>
                <li>
                  <a href="#nextjs" className="hover:text-white transition-colors">
                    → Next.js Plugin
                  </a>
                </li>
                <li>
                  <a href="#configuration" className="hover:text-white transition-colors">
                    → Configuration
                  </a>
                </li>
                <li>
                  <a href="#api" className="hover:text-white transition-colors">
                    → API Reference
                  </a>
                </li>
              </ul>
            </Card>

            {/* Introduction */}
            <section id="introduction" className="mb-16">
              <Heading level={2} className="mb-6 text-3xl uppercase tracking-tight">
                Introduction
              </Heading>
              <div className="space-y-4">
                <Text size="sm" className="text-gray-500">
                  Lattice is a service discovery platform that automatically maps your microservices architecture.
                  Drop-in plugins analyze your applications at runtime, discovering routes, dependencies, and service relationships.
                </Text>
                <Text size="sm" className="text-gray-500">
                  No manual configuration required. Lattice plugins integrate with your existing framework in minutes,
                  providing real-time visibility into your entire service ecosystem.
                </Text>
              </div>
            </section>

            {/* Quick Start */}
            <section id="quick-start" className="mb-16">
              <Heading level={2} className="mb-6 text-3xl uppercase tracking-tight">
                Quick Start
              </Heading>
              <div className="space-y-6">
                <div>
                  <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                    1. Create Account
                  </Heading>
                  <Text size="sm" className="mb-3 text-gray-500">
                    Sign up for a Lattice account and get your API key:
                  </Text>
                  <div className="border border-gray-800 bg-black p-4">
                    <code className="font-mono text-xs text-gray-400">
                      Visit https://lattice.black/signup
                    </code>
                  </div>
                </div>

                <div>
                  <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                    2. Install Plugin
                  </Heading>
                  <Text size="sm" className="mb-3 text-gray-500">
                    Choose your framework and install the appropriate plugin:
                  </Text>
                  <div className="space-y-2">
                    <div className="border border-gray-800 bg-black p-4">
                      <code className="font-mono text-xs text-gray-400">
                        yarn add @lattice.black/plugin-express
                      </code>
                    </div>
                    <div className="border border-gray-800 bg-black p-4">
                      <code className="font-mono text-xs text-gray-400">
                        yarn add @lattice.black/plugin-nextjs
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                    3. Configure
                  </Heading>
                  <Text size="sm" className="mb-3 text-gray-500">
                    Set your API key from the dashboard:
                  </Text>
                  <div className="border border-gray-800 bg-black p-4">
                    <pre className="font-mono text-xs overflow-x-auto">
                      <code>
                        <span className="text-cyan-300">LATTICE_API_KEY</span>=<span className="text-green-400">your_api_key_here</span>
                      </code>
                    </pre>
                  </div>
                </div>

                <div>
                  <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                    4. Start Discovery
                  </Heading>
                  <Text size="sm" className="text-gray-500">
                    Your services will begin appearing in the Lattice dashboard within minutes.
                  </Text>
                </div>
              </div>
            </section>

            {/* Express Plugin */}
            <section id="express" className="mb-16">
              <Heading level={2} className="mb-6 text-3xl uppercase tracking-tight">
                Express.js Plugin
              </Heading>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Installation
                </Heading>
                <div className="border border-gray-800 bg-black p-4">
                  <code className="font-mono text-xs text-gray-400">
                    yarn add @lattice.black/plugin-express
                  </code>
                </div>
              </div>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Basic Usage
                </Heading>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      <span className="text-purple-400">import</span> <span className="text-white">express</span> <span className="text-purple-400">from</span> <span className="text-green-400">'express'</span>;{'\n'}
                      <span className="text-purple-400">import</span> {'{ '}<span className="text-white">LatticePlugin</span> {'} '}<span className="text-purple-400">from</span> <span className="text-green-400">'@lattice.black/plugin-express'</span>;{'\n'}
                      {'\n'}
                      <span className="text-purple-400">const</span> <span className="text-cyan-300">app</span> = <span className="text-yellow-400">express</span>();{'\n'}
                      {'\n'}
                      <span className="text-gray-600">// Initialize Lattice plugin</span>{'\n'}
                      <span className="text-purple-400">const</span> <span className="text-cyan-300">lattice</span> = <span className="text-purple-400">new</span> <span className="text-yellow-400">LatticePlugin</span>{'({'}{'\n'}
                      {'  '}<span className="text-cyan-300">serviceName</span>: <span className="text-green-400">'my-api'</span>,{'\n'}
                      {'  '}<span className="text-cyan-300">apiKey</span>: <span className="text-white">process</span>.<span className="text-cyan-300">env</span>.<span className="text-white">LATTICE_API_KEY</span>,{'\n'}
                      {'});'}{'\n'}
                      {'\n'}
                      <span className="text-gray-600">// Define your routes</span>{'\n'}
                      <span className="text-cyan-300">app</span>.<span className="text-yellow-400">get</span>(<span className="text-green-400">'/api/users'</span>, (<span className="text-white">req</span>, <span className="text-white">res</span>) {'=>'} {'{'}{'\n'}
                      {'  '}<span className="text-white">res</span>.<span className="text-yellow-400">json</span>{'({ '}<span className="text-cyan-300">users</span>: [] {'});'}{'\n'}
                      {'});'}{'\n'}
                      {'\n'}
                      <span className="text-cyan-300">app</span>.<span className="text-yellow-400">post</span>(<span className="text-green-400">'/api/users'</span>, (<span className="text-white">req</span>, <span className="text-white">res</span>) {'=>'} {'{'}{'\n'}
                      {'  '}<span className="text-white">res</span>.<span className="text-yellow-400">json</span>{'({ '}<span className="text-cyan-300">created</span>: <span className="text-purple-400">true</span> {'});'}{'\n'}
                      {'});'}{'\n'}
                      {'\n'}
                      <span className="text-gray-600">// Analyze and start discovery</span>{'\n'}
                      <span className="text-purple-400">await</span> <span className="text-cyan-300">lattice</span>.<span className="text-yellow-400">analyze</span>(<span className="text-cyan-300">app</span>);{'\n'}
                      {'\n'}
                      <span className="text-gray-600">// Optional: Add metrics tracking middleware</span>{'\n'}
                      <span className="text-cyan-300">app</span>.<span className="text-yellow-400">use</span>(<span className="text-cyan-300">lattice</span>.<span className="text-yellow-400">createMetricsMiddleware</span>());{'\n'}
                      {'\n'}
                      <span className="text-cyan-300">app</span>.<span className="text-yellow-400">listen</span>(<span className="text-blue-400">3000</span>, () {'=>'} {'{'}{'\n'}
                      {'  '}<span className="text-white">console</span>.<span className="text-yellow-400">log</span>(<span className="text-green-400">'Server running on port 3000'</span>);{'\n'}
                      {'});'}
                    </code>
                  </pre>
                </div>
              </div>

              <div>
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Configuration Options
                </Heading>
                <Card>
                  <table className="w-full">
                    <thead className="border-b border-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase text-gray-500">
                          Option
                        </th>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase text-gray-500">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase text-gray-500">
                          Default
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          serviceName
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          string
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          Auto-detected
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          apiKey
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          string
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          process.env.LATTICE_API_KEY
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          enabled
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          boolean
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          true
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          autoSubmit
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          boolean
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          true
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          submitInterval
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          number
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          300000 (5 min)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          discoverRoutes
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          boolean
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          true
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          discoverDependencies
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          boolean
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          true
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Card>
              </div>
            </section>

            {/* Next.js Plugin */}
            <section id="nextjs" className="mb-16">
              <Heading level={2} className="mb-6 text-3xl uppercase tracking-tight">
                Next.js Plugin
              </Heading>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Installation
                </Heading>
                <div className="border border-gray-800 bg-black p-4">
                  <code className="font-mono text-xs text-gray-400">
                    yarn add @lattice.black/plugin-nextjs
                  </code>
                </div>
              </div>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Basic Usage
                </Heading>
                <Text size="sm" className="mb-3 text-gray-500">
                  Create a discovery script and run it during your build or startup:
                </Text>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      <span className="text-gray-600">// scripts/discover.ts</span>{'\n'}
                      <span className="text-purple-400">import</span> {'{ '}<span className="text-white">LatticeNextPlugin</span> {'} '}<span className="text-purple-400">from</span> <span className="text-green-400">'@lattice.black/plugin-nextjs'</span>;{'\n'}
                      {'\n'}
                      <span className="text-purple-400">const</span> <span className="text-cyan-300">lattice</span> = <span className="text-purple-400">new</span> <span className="text-yellow-400">LatticeNextPlugin</span>{'({'}{'\n'}
                      {'  '}<span className="text-cyan-300">serviceName</span>: <span className="text-green-400">'my-nextjs-app'</span>,{'\n'}
                      {'  '}<span className="text-cyan-300">apiKey</span>: <span className="text-white">process</span>.<span className="text-cyan-300">env</span>.<span className="text-white">LATTICE_API_KEY</span>,{'\n'}
                      {'  '}<span className="text-cyan-300">appDir</span>: <span className="text-green-400">'./src/app'</span>, <span className="text-gray-600">// Path to your Next.js app directory</span>{'\n'}
                      {'});'}{'\n'}
                      {'\n'}
                      <span className="text-purple-400">await</span> <span className="text-cyan-300">lattice</span>.<span className="text-yellow-400">analyze</span>();
                    </code>
                  </pre>
                </div>
              </div>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Package.json Script
                </Heading>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      {'{'}{'\n'}
                      {'  '}<span className="text-cyan-300">"scripts"</span>: {'{'}{'\n'}
                      {'    '}<span className="text-cyan-300">"discover"</span>: <span className="text-green-400">"tsx scripts/discover.ts"</span>,{'\n'}
                      {'    '}<span className="text-cyan-300">"build"</span>: <span className="text-green-400">"yarn discover && next build"</span>{'\n'}
                      {'  }'}{'\n'}
                      {'}'}
                    </code>
                  </pre>
                </div>
              </div>

              <div>
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Configuration Options
                </Heading>
                <Card>
                  <table className="w-full">
                    <thead className="border-b border-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase text-gray-500">
                          Option
                        </th>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase text-gray-500">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-mono text-xs uppercase text-gray-500">
                          Default
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          serviceName
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          string
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          Required
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          appDir
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          string
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          ./src/app
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          enabled
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          boolean
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          true
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-mono text-xs text-white">
                          autoSubmit
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          boolean
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          true
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Card>
              </div>
            </section>

            {/* Configuration */}
            <section id="configuration" className="mb-16">
              <Heading level={2} className="mb-6 text-3xl uppercase tracking-tight">
                Configuration
              </Heading>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Environment Variables
                </Heading>
                <Text size="sm" className="mb-3 text-gray-500">
                  Configure the plugin with your API key:
                </Text>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      <span className="text-cyan-300">LATTICE_API_KEY</span>=<span className="text-green-400">your_api_key_from_dashboard</span>{'\n'}
                      <span className="text-cyan-300">LATTICE_ENABLED</span>=<span className="text-purple-400">true</span>{'\n'}
                      <span className="text-cyan-300">LATTICE_AUTO_SUBMIT</span>=<span className="text-purple-400">true</span>{'\n'}
                      <span className="text-cyan-300">LATTICE_SUBMIT_INTERVAL</span>=<span className="text-blue-400">300000</span>
                    </code>
                  </pre>
                </div>
              </div>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Callbacks
                </Heading>
                <Text size="sm" className="mb-3 text-gray-500">
                  Hook into the discovery lifecycle with callbacks:
                </Text>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      <span className="text-purple-400">const</span> <span className="text-cyan-300">lattice</span> = <span className="text-purple-400">new</span> <span className="text-yellow-400">LatticePlugin</span>{'({'}{'\n'}
                      {'  '}<span className="text-cyan-300">serviceName</span>: <span className="text-green-400">'my-api'</span>,{'\n'}
                      {'  '}<span className="text-cyan-300">onAnalyzed</span>: (<span className="text-white">metadata</span>) {'=>'} {'{'}{'\n'}
                      {'    '}<span className="text-white">console</span>.<span className="text-yellow-400">log</span>(<span className="text-green-400">{`\`Discovered \${`}<span className="text-white">metadata</span>.<span className="text-cyan-300">routes</span>.<span className="text-cyan-300">length</span>{'} routes`'}</span>);{'\n'}
                      {'  },'}{'\n'}
                      {'  '}<span className="text-cyan-300">onSubmitted</span>: (<span className="text-white">response</span>) {'=>'} {'{'}{'\n'}
                      {'    '}<span className="text-white">console</span>.<span className="text-yellow-400">log</span>(<span className="text-green-400">{`\`Submitted: \${`}<span className="text-white">response</span>.<span className="text-cyan-300">serviceId</span>{'}`'}</span>);{'\n'}
                      {'  },'}{'\n'}
                      {'  '}<span className="text-cyan-300">onError</span>: (<span className="text-white">error</span>) {'=>'} {'{'}{'\n'}
                      {'    '}<span className="text-white">console</span>.<span className="text-yellow-400">error</span>(<span className="text-green-400">'Discovery error:'</span>, <span className="text-white">error</span>);{'\n'}
                      {'  },'}{'\n'}
                      {'});'}
                    </code>
                  </pre>
                </div>
              </div>

              <div>
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Disabling in Production
                </Heading>
                <Text size="sm" className="mb-3 text-gray-500">
                  Control discovery behavior per environment:
                </Text>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      <span className="text-purple-400">const</span> <span className="text-cyan-300">lattice</span> = <span className="text-purple-400">new</span> <span className="text-yellow-400">LatticePlugin</span>{'({'}{'\n'}
                      {'  '}<span className="text-cyan-300">serviceName</span>: <span className="text-green-400">'my-api'</span>,{'\n'}
                      {'  '}<span className="text-cyan-300">enabled</span>: <span className="text-white">process</span>.<span className="text-cyan-300">env</span>.<span className="text-white">NODE_ENV</span> !== <span className="text-green-400">'production'</span>,{'\n'}
                      {'});'}
                    </code>
                  </pre>
                </div>
              </div>
            </section>

            {/* API Reference */}
            <section id="api" className="mb-16">
              <Heading level={2} className="mb-6 text-3xl uppercase tracking-tight">
                API Reference
              </Heading>

              <div className="mb-8">
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Collector API Endpoints
                </Heading>
                <div className="space-y-4">
                  <Card className="p-6">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="border border-gray-700 bg-black px-2 py-1 font-mono text-xs text-gray-400">
                        POST
                      </span>
                      <code className="font-mono text-sm text-white">
                        /api/v1/ingest/metadata
                      </code>
                    </div>
                    <Text size="xs" className="text-gray-500">
                      Submit service metadata, routes, and dependencies
                    </Text>
                  </Card>

                  <Card className="p-6">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="border border-gray-700 bg-black px-2 py-1 font-mono text-xs text-gray-400">
                        GET
                      </span>
                      <code className="font-mono text-sm text-white">
                        /api/v1/services
                      </code>
                    </div>
                    <Text size="xs" className="text-gray-500">
                      List all discovered services
                    </Text>
                  </Card>

                  <Card className="p-6">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="border border-gray-700 bg-black px-2 py-1 font-mono text-xs text-gray-400">
                        GET
                      </span>
                      <code className="font-mono text-sm text-white">
                        /api/v1/services/:id
                      </code>
                    </div>
                    <Text size="xs" className="text-gray-500">
                      Get service details including routes and dependencies
                    </Text>
                  </Card>
                </div>
              </div>

              <div>
                <Heading level={3} className="mb-3 text-lg uppercase tracking-wider">
                  Authentication
                </Heading>
                <Text size="sm" className="mb-3 text-gray-500">
                  All API requests require an API key in the Authorization header:
                </Text>
                <div className="border border-gray-800 bg-black p-4">
                  <pre className="font-mono text-xs overflow-x-auto">
                    <code>
                      <span className="text-cyan-300">Authorization</span>: <span className="text-white">Bearer</span> <span className="text-green-400">YOUR_API_KEY</span>
                    </code>
                  </pre>
                </div>
              </div>
            </section>

            {/* Footer CTA */}
            <Card className="p-12 text-center">
              <Heading level={3} className="mb-3 text-2xl uppercase tracking-tight">
                Ready to Start?
              </Heading>
              <Text size="sm" className="mb-6 text-gray-500">
                Get your API key and start discovering services in minutes
              </Text>
              <Link href="/signup">
                <Button variant="primary" size="lg">
                  Create Free Account
                </Button>
              </Link>
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-black/50 backdrop-blur-sm py-12 mt-24">
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
                <Link href="/docs" className="text-white">
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
