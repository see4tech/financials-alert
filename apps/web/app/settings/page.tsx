'use client';

import { useCallback, useEffect, useState } from 'react';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getLlmSettings, saveLlmSettings } from '@/lib/api';

const PROVIDERS = [
  { value: 'openai', labelKey: 'settings.llmProviderOpenAI' },
  { value: 'claude', labelKey: 'settings.llmProviderClaude' },
  { value: 'gemini', labelKey: 'settings.llmProviderGemini' },
] as const;

export default function SettingsPage() {
  const { t } = useLocale();
  const clientReady = useSupabaseAuthReady();
  const [provider, setProvider] = useState<string>('openai');
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const client = getSupabaseBrowser();
    if (!client) {
      setLoading(false);
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const data = await getLlmSettings(session.access_token);
      setProvider(data.provider ?? 'openai');
      setHasKey(data.hasKey);
      setApiKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientReady) return;
    loadSettings();
  }, [clientReady, loadSettings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const client = getSupabaseBrowser();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) {
      setError(t('settings.signInRequired'));
      return;
    }
    const keyToSave = apiKey.trim();
    if (!keyToSave) {
      setError(t('settings.apiKeyRequired'));
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await saveLlmSettings(session.access_token, { provider, api_key: keyToSave });
      setHasKey(true);
      setApiKey('');
      setSuccess(t('settings.llmSaved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!clientReady || loading) {
    return (
      <main className="min-h-screen p-8 max-w-2xl mx-auto">
        <NavBar />
        <p className="text-gray-500">{t('common.loading')}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-3">{t('settings.llmSectionTitle')}</h2>
        <p className="text-sm text-gray-600 mb-4">{t('settings.llmSectionHint')}</p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {success && <p className="mb-3 text-sm text-green-600">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="llm-provider" className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.llmProvider')}
            </label>
            <select
              id="llm-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {PROVIDERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="llm-api-key" className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.llmApiKey')}
            </label>
            <input
              id="llm-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? t('settings.llmApiKeyPlaceholderSaved') : t('settings.llmApiKeyPlaceholder')}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              autoComplete="off"
            />
            {hasKey && <p className="mt-1 text-xs text-gray-500">{t('settings.llmApiKeySaved')}</p>}
          </div>
          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('settings.save')}
          </button>
        </form>
      </section>
    </main>
  );
}
