'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button, Text, Heading } from '@duro/core';

export function Header() {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = () => {
    void signOut({ callbackUrl: '/login' });
  };

  return (
    <>
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="w-8 h-8 border-2 border-white relative">
                  <div className="absolute inset-1 border border-gray-400" />
                </div>
                <Heading level={1} className="text-2xl tracking-tighter group-hover:text-gray-300 transition-colors">
                  LATTICE
                </Heading>
              </Link>

              {/* Desktop Navigation */}
              {session && (
                <nav className="hidden md:flex gap-6">
                  <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Services
                  </Link>
                  <Link href="/dashboard/metrics" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Metrics
                  </Link>
                  <Link href="/dashboard/errors" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Errors
                  </Link>
                  <Link href="/dashboard/performance" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Performance
                  </Link>
                  <Link href="/dashboard/health" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Health
                  </Link>
                  <Link href="/dashboard/alerts" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Alerts
                  </Link>
                  <Link href="/dashboard/graph" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Network Graph
                  </Link>
                  <Link href="/dashboard/settings" className="text-sm text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                    Settings
                  </Link>
                </nav>
              )}
            </div>

            {/* Desktop Right Section */}
            <div className="hidden md:flex items-center gap-4">
              {session ? (
                <>
                  <Text size="xs" className="text-gray-400">
                    {session.user?.email}
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <Text size="xs" className="text-gray-500 uppercase tracking-wider">
                  Service Discovery Platform
                </Text>
              )}
            </div>

            {/* Mobile Menu Button */}
            {session && (
              <button
                onClick={toggleMobileMenu}
                className="md:hidden flex flex-col gap-1.5 p-2"
                aria-label="Toggle menu"
              >
                <span className="w-6 h-0.5 bg-white transition-all" />
                <span className="w-6 h-0.5 bg-white transition-all" />
                <span className="w-6 h-0.5 bg-white transition-all" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && session && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={closeMobileMenu}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Menu Panel */}
          <div
            className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-black border-l border-gray-800 animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <div className="flex justify-end p-6">
              <button
                onClick={closeMobileMenu}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User Info */}
            <div className="px-6 pb-6 border-b border-gray-800">
              <Text size="xs" className="text-gray-400 break-all">
                {session.user?.email}
              </Text>
            </div>

            {/* Menu Items */}
            <nav className="flex flex-col gap-6 px-6 py-8">
              <Link href="/dashboard" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Services
              </Link>
              <Link href="/dashboard/metrics" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Metrics
              </Link>
              <Link href="/dashboard/errors" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Errors
              </Link>
              <Link href="/dashboard/performance" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Performance
              </Link>
              <Link href="/dashboard/health" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Health
              </Link>
              <Link href="/dashboard/alerts" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Alerts
              </Link>
              <Link href="/dashboard/graph" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Network Graph
              </Link>
              <Link href="/dashboard/settings" onClick={closeMobileMenu} className="text-lg text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                Settings
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  closeMobileMenu();
                  handleSignOut();
                }}
                className="text-left justify-start"
              >
                Sign Out
              </Button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
