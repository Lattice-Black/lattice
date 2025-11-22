'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Heading,
  Text,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@duro/core';

interface ApiKeyInfo {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsed: string | null;
  hasKey: boolean;
  keyPreview?: string;
  message?: string;
}

interface RegenerateResponse {
  apiKey: {
    id: string;
    name: string | null;
    key: string;
    createdAt: string;
  };
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [apiKeyInfo, setApiKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Fetch current API key info
  useEffect(() => {
    const fetchApiKeyInfo = async () => {
      if (status !== 'authenticated') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/api-keys');

        if (response.ok) {
          const data = await response.json() as { apiKey: { id: string; name: string | null; createdAt: string; lastUsed: string | null; keyPreview?: string } };
          setApiKeyInfo({
            id: data.apiKey.id,
            name: data.apiKey.name,
            createdAt: data.apiKey.createdAt,
            lastUsed: data.apiKey.lastUsed,
            hasKey: true,
            keyPreview: data.apiKey.keyPreview,
          });
        } else if (response.status === 404) {
          // No API key exists yet
          setApiKeyInfo({
            id: '',
            name: null,
            createdAt: '',
            lastUsed: null,
            hasKey: false,
            message: 'No API key found. Please generate one.',
          });
        } else {
          const errorData = await response.json() as { error?: string };
          setError(errorData.error || 'Failed to fetch API key info');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch API key info');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchApiKeyInfo();
  }, [status]);

  const handleRegenerateConfirm = async () => {
    try {
      setIsRegenerating(true);
      setError(null);
      setShowConfirmModal(false);

      const response = await fetch('/api/api-keys/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to regenerate API key');
      }

      const data = await response.json() as RegenerateResponse;

      // Set the new API key to display it once
      setNewApiKey(data.apiKey.key);

      // Update the info
      setApiKeyInfo({
        id: data.apiKey.id,
        name: data.apiKey.name,
        createdAt: data.apiKey.createdAt,
        lastUsed: null,
        hasKey: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate API key');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCloseNewKey = () => {
    setNewApiKey(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-16 h-16 border-2 border-gray-800 relative">
          <div className="absolute inset-2 border border-gray-700 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-24 h-24 border-2 border-gray-800 mb-6 mx-auto relative">
            <div className="absolute inset-4 border border-gray-800" />
          </div>
          <Heading level={3} className="mb-2">
            Authentication Required
          </Heading>
          <Text size="sm" className="text-gray-500 font-mono">
            Please sign in to view settings
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <Heading level={1} className="text-4xl mb-2 tracking-tight">
          Settings
        </Heading>
        <Text size="sm" className="text-gray-500">
          Manage your API keys and account settings
        </Text>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* New API Key Display (one-time) */}
      {newApiKey && (
        <Alert variant="success">
          <AlertTitle>New API Key Generated</AlertTitle>
          <AlertDescription>
            <div className="space-y-4 mt-2">
              <Text size="xs" className="text-gray-400">
                Copy this key now - you won&apos;t be able to see it again!
              </Text>
              <div className="flex gap-2">
                <div className="flex-1 border border-gray-800 bg-black p-3 font-mono text-sm text-white break-all">
                  {newApiKey}
                </div>
                <Button
                  onClick={() => void handleCopyKey()}
                  variant="primary"
                  size="md"
                >
                  {copySuccess ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <Button
                onClick={handleCloseNewKey}
                variant="ghost"
                size="sm"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* API Key Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-12 h-12 border-2 border-gray-800 relative">
                <div className="absolute inset-2 border border-gray-700 animate-pulse" />
              </div>
            </div>
          ) : apiKeyInfo?.hasKey ? (
            <>
              <div className="space-y-4">
                <div>
                  <Text size="xs" className="uppercase tracking-wider text-gray-500 block mb-2">
                    Current API Key
                  </Text>
                  <div className="border border-gray-800 bg-black p-3 font-mono text-sm text-gray-400">
                    {apiKeyInfo.keyPreview || 'ltc_****...****'}
                  </div>
                  <Text size="xs" className="text-gray-600 mt-2">
                    API keys are hashed and cannot be retrieved. Generate a new one to get a visible key.
                  </Text>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text size="xs" className="uppercase tracking-wider text-gray-500 block mb-2">
                      Created
                    </Text>
                    <Text size="sm" className="text-white font-mono">
                      {formatDate(apiKeyInfo.createdAt)}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" className="uppercase tracking-wider text-gray-500 block mb-2">
                      Last Used
                    </Text>
                    <Text size="sm" className="text-white font-mono">
                      {formatDate(apiKeyInfo.lastUsed || '')}
                    </Text>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => setShowConfirmModal(true)}
                  variant="ghost"
                  size="md"
                  disabled={isRegenerating}
                >
                  {isRegenerating ? 'Regenerating...' : 'Regenerate API Key'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 space-y-4">
              <Text size="sm" className="text-gray-500">
                No API key found. Generate one to get started.
              </Text>
              <Button
                onClick={() => setShowConfirmModal(true)}
                variant="primary"
                size="md"
                disabled={isRegenerating}
              >
                {isRegenerating ? 'Generating...' : 'Generate API Key'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          />

          {/* Modal */}
          <Card className="relative max-w-md w-full">
            <CardHeader>
              <CardTitle>
                {apiKeyInfo?.hasKey ? 'Regenerate API Key?' : 'Generate API Key?'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeyInfo?.hasKey && (
                  <Alert variant="warning">
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      This will invalidate your current API key immediately. Any applications using the old key will stop working.
                    </AlertDescription>
                  </Alert>
                )}

                <Text size="sm" className="text-gray-400">
                  {apiKeyInfo?.hasKey
                    ? 'A new API key will be generated and the old one will be revoked.'
                    : 'A new API key will be generated for your account.'}
                </Text>

                <div className="flex gap-3 pt-4 border-t border-gray-800">
                  <Button
                    onClick={() => void handleRegenerateConfirm()}
                    variant="primary"
                    size="md"
                    disabled={isRegenerating}
                    className="flex-1"
                  >
                    {isRegenerating ? 'Processing...' : (apiKeyInfo?.hasKey ? 'Regenerate' : 'Generate')}
                  </Button>
                  <Button
                    onClick={() => setShowConfirmModal(false)}
                    variant="ghost"
                    size="md"
                    disabled={isRegenerating}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
