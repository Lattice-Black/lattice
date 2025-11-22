'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button, Card, CardContent, Heading, Text, Input } from '@duro/core';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        return;
      }

      if (result?.ok) {
        router.refresh();
        router.push('/dashboard');
      }
    } catch {
      setError('Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-12 text-center">
          {/* Wireframe Icon */}
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center">
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

          <Heading level={1} className="mb-2 text-3xl uppercase tracking-tight">
            Lattice
          </Heading>
          <Text size="sm" className="uppercase tracking-wider text-gray-500">
            Service Discovery Platform
          </Text>
        </div>

        {/* Login Form */}
        <Card>
          <div className="border-b border-gray-800 p-6">
            <Text size="sm" className="uppercase tracking-wider text-gray-500">
              Sign In
            </Text>
          </div>

          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              {error && (
                <div className="border border-red-900 bg-red-950/20 p-4">
                  <Text size="sm" className="text-red-500">{error}</Text>
                </div>
              )}

              <div className="space-y-2">
                <Text size="sm" className="uppercase tracking-wider text-gray-500">
                  Email Address
                </Text>
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-2">
                <Text size="sm" className="uppercase tracking-wider text-gray-500">
                  Password
                </Text>
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>

              <div className="border-t border-gray-800 pt-6 text-center">
                <Text size="sm" className="text-gray-500">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="text-white hover:text-gray-300 transition-colors">
                    Sign up
                  </Link>
                </Text>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
