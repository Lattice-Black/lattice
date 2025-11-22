'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DotGrid } from '@/components/DotGrid';
import { PublicNav } from '@/components/PublicNav';
import { Button, Card, CardContent, Heading, Text } from '@duro/core';

type SubscriptionTier = 'basic' | 'pro' | 'enterprise';

interface PricingTier {
  id: SubscriptionTier;
  name: string;
  price: number;
  description: string;
  features: string[];
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 10,
    description: 'Essential service discovery for small teams',
    features: [
      'Up to 10 services',
      'Basic metrics',
      'API access',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 25,
    description: 'Advanced features for growing teams',
    features: [
      'Up to 50 services',
      'Advanced metrics & analytics',
      'Real-time monitoring',
      'Priority support',
      'Custom integrations',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    description: 'Complete solution for large organizations',
    features: [
      'Unlimited services',
      'Advanced analytics & insights',
      'Custom SLA',
      'Dedicated support',
      'On-premise deployment',
      'Custom features',
    ],
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubscribe = async (tier: SubscriptionTier) => {
    setError(null);
    setLoadingTier(tier);

    try {
      if (status !== 'authenticated' || !session) {
        // Redirect to login if not authenticated
        router.push(`/login?redirect=/pricing`);
        return;
      }

      // Call checkout API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${apiUrl}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': session.user?.id || '',
        },
        body: JSON.stringify({
          tier,
          successUrl: `${window.location.origin}/dashboard`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || 'Failed to create checkout session');
      }

      const data = await response.json() as { url: string };

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <DotGrid />

      <div className="relative z-10">
        <PublicNav />

        {/* Main Content */}
        <main className="container mx-auto px-6 py-16">
          {/* Page Header */}
          <div className="mb-16 text-center">
            <Heading level={1} className="mb-4 text-5xl uppercase tracking-tight">
              Pricing
            </Heading>
            <Text size="sm" className="mx-auto max-w-2xl text-gray-500">
              Choose the perfect plan for your team. All plans include a 14-day free trial.
            </Text>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-auto mb-8 max-w-4xl border border-red-900 bg-red-950/20 p-4">
              <Text size="sm" className="text-red-500">{error}</Text>
            </div>
          )}

          {/* Pricing Cards */}
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className="flex flex-col transition-colors hover:border-gray-700"
              >
                {/* Card Header */}
                <div className="border-b border-gray-800 p-8">
                  <Text size="sm" className="mb-2 uppercase tracking-wider text-gray-500">
                    {tier.name}
                  </Text>
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">
                      ${tier.price}
                    </span>
                    <Text size="sm" className="text-gray-500">/year</Text>
                  </div>
                  <Text size="xs" className="text-gray-500">
                    {tier.description}
                  </Text>
                </div>

                {/* Features List */}
                <CardContent className="flex flex-1 flex-col">
                  <ul className="mb-8 space-y-3">
                    {tier.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-gray-400"
                      >
                        <span className="mt-1 text-white">→</span>
                        <Text size="sm">{feature}</Text>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant="primary"
                    size="lg"
                    className="mt-auto w-full"
                    onClick={() => void handleSubscribe(tier.id)}
                    disabled={loadingTier !== null}
                  >
                    {loadingTier === tier.id ? 'Processing...' : 'Subscribe'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-16 text-center">
            <Text size="xs" className="text-gray-600">
              All plans include a 14-day free trial. No charges until trial ends.
            </Text>
            <Text size="xs" className="mt-2 text-gray-600">
              Need a custom plan?{' '}
              <a href="mailto:sales@lattice.dev" className="text-white hover:text-gray-300">
                Contact us
              </a>
            </Text>
          </div>
        </main>
      </div>
    </div>
  );
}
