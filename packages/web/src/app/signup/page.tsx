'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button, Card, CardContent, Heading, Text, Input } from '@duro/core';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: fullName }),
      });

      const data = await response.json() as { error?: string; apiKey?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      // Store the API key to display
      setApiKey(data.apiKey ?? null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    // Sign in the user automatically
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md">
          <Card className="p-8 text-center">
            <CardContent className="space-y-6">
              {/* Success Icon */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                <div className="relative h-full w-full">
                  <div className="absolute inset-0 border-2 border-green-900" />
                  <div className="absolute inset-2 border border-green-900" />
                </div>
              </div>

              <div className="space-y-2">
                <Heading level={2} className="uppercase tracking-wider">
                  Account Created
                </Heading>
                <Text size="sm" className="text-gray-500">
                  Save your API key below - it will only be shown once
                </Text>
              </div>

              {apiKey && (
                <div className="border border-yellow-900 bg-yellow-950/20 p-4 rounded">
                  <Text size="sm" className="uppercase tracking-wider text-yellow-500 mb-2">
                    Your API Key
                  </Text>
                  <code className="block text-xs text-white bg-black p-2 rounded break-all font-mono">
                    {apiKey}
                  </code>
                  <button
                    onClick={() => void navigator.clipboard.writeText(apiKey)}
                    className="mt-2 text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    Click to copy
                  </button>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => void handleContinue()}
              >
                Continue to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
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

        {/* Signup Form */}
        <Card>
          <div className="border-b border-gray-800 p-6">
            <Text size="sm" className="uppercase tracking-wider text-gray-500">
              Create Account
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
                  Full Name
                </Text>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
              </div>

              <div className="space-y-2">
                <Text size="sm" className="uppercase tracking-wider text-gray-500">
                  Confirm Password
                </Text>
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <div className="border-t border-gray-800 pt-6 text-center">
                <Text size="sm" className="text-gray-500">
                  Already have an account?{' '}
                  <Link href="/login" className="text-white hover:text-gray-300 transition-colors">
                    Sign in
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
