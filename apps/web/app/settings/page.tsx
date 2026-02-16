'use client';

import { useCallback, useEffect, useState } from 'react';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import { useTheme, type Theme } from '@/app/context/ThemeContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getLlmSettings, saveLlmSettings, getEtoroSettings, saveEtoroSettings, getUserPreferences, saveUserPreferences } from '@/lib/api';

const PROVIDERS = [
  { value: 'openai', labelKey: 'settings.llmProviderOpenAI' },
  { value: 'claude', labelKey: 'settings.llmProviderClaude' },
  { value: 'gemini', labelKey: 'settings.llmProviderGemini' },
] as const;

const THEME_OPTIONS: { value: Theme; labelKey: string; icon: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight', icon: 'sun' },
  { value: 'dark', labelKey: 'settings.themeDark', icon: 'moon' },
  { value: 'system', labelKey: 'settings.themeSystem', icon: 'monitor' },
];

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.005 9.005 0 0012 21a9.005 9.005 0 008.354-5.646z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

const ICON_MAP: Record<string, () => React.JSX.Element> = {
  sun: SunIcon,
  moon: MoonIcon,
  monitor: MonitorIcon,
};

export default function SettingsPage() {
  const { t } = useLocale();
  const { theme, setTheme } = useTheme();
  const clientReady = useSupabaseAuthReady();
  const [provider, setProvider] = useState<string>('openai');
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [etoroApiKey, setEtoroApiKey] = useState('');
  const [etoroUserKey, setEtoroUserKey] = useState('');
  const [etoroTradingMode, setEtoroTradingMode] = useState<'demo' | 'real'>('demo');
  const [etoroSaving, setEtoroSaving] = useState(false);

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
      const prefs = await getUserPreferences(session.access_token);
      setEtoroTradingMode((prefs.etoro_trading_mode === 'real' ? 'real' : 'demo'));
      const etoro = await getEtoroSettings(session.access_token);
      if (etoro.configured) {
        setEtoroApiKey('');
        setEtoroUserKey('');
      }
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
      <main className="min-h-screen pt-16 px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 max-w-2xl mx-auto">
        <NavBar />
        <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-16 px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 max-w-2xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">{t('settings.title')}</h1>

      {/* Theme selector */}
      <section className="cb-card p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('settings.theme')}</h2>
        <div className="flex gap-3">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value;
            const Icon = ICON_MAP[opt.icon];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                    : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                {Icon && <Icon />}
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </section>

      {/* LLM settings */}
      <section className="cb-card p-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('settings.llmSectionTitle')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('settings.llmSectionHint')}</p>
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="mb-3 text-sm text-green-600 dark:text-green-400">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="llm-provider" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('settings.llmProvider')}
            </label>
            <select
              id="llm-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PROVIDERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="llm-api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('settings.llmApiKey')}
            </label>
            <input
              id="llm-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? t('settings.llmApiKeyPlaceholderSaved') : t('settings.llmApiKeyPlaceholder')}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoComplete="off"
            />
            {hasKey && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('settings.llmApiKeySaved')}</p>}
          </div>
          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? t('common.loading') : t('settings.save')}
          </button>
        </form>
      </section>

      {/* eToro settings */}
      <section className="cb-card p-5 mt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('settings.etoroSectionTitle')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('settings.etoroSectionHint')}</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="etoro-api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('settings.etoroApiKey')}
            </label>
            <input
              id="etoro-api-key"
              type="password"
              value={etoroApiKey}
              onChange={(e) => setEtoroApiKey(e.target.value)}
              placeholder={t('settings.etoroApiKeyPlaceholder')}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="etoro-user-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('settings.etoroUserKey')}
            </label>
            <input
              id="etoro-user-key"
              type="password"
              value={etoroUserKey}
              onChange={(e) => setEtoroUserKey(e.target.value)}
              placeholder={t('settings.etoroUserKeyPlaceholder')}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            disabled={etoroSaving || !etoroApiKey.trim() || !etoroUserKey.trim()}
            onClick={async () => {
              const client = getSupabaseBrowser();
              if (!client) return;
              const { data: { session } } = await client.auth.getSession();
              if (!session?.access_token) return;
              setEtoroSaving(true);
              setError(null);
              try {
                await saveEtoroSettings(session.access_token, { apiKey: etoroApiKey.trim(), userKey: etoroUserKey.trim() });
                setEtoroApiKey('');
                setEtoroUserKey('');
                setSuccess(t('settings.etoroSaved'));
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setEtoroSaving(false);
              }
            }}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {etoroSaving ? t('common.loading') : t('settings.save')}
          </button>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-600">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('settings.etoroTradingAccount')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="etoro-mode"
                  checked={etoroTradingMode === 'demo'}
                  onChange={() => {
                    setEtoroTradingMode('demo');
                    const client = getSupabaseBrowser();
                    if (!client) return;
                    client.auth.getSession().then(({ data: { session } }) => {
                      if (session?.access_token) saveUserPreferences(session.access_token, { etoro_trading_mode: 'demo' });
                    });
                  }}
                  className="rounded-full border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('settings.etoroDemo')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="etoro-mode"
                  checked={etoroTradingMode === 'real'}
                  onChange={() => {
                    setEtoroTradingMode('real');
                    const client = getSupabaseBrowser();
                    if (!client) return;
                    client.auth.getSession().then(({ data: { session } }) => {
                      if (session?.access_token) saveUserPreferences(session.access_token, { etoro_trading_mode: 'real' });
                    });
                  }}
                  className="rounded-full border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('settings.etoroReal')}</span>
              </label>
            </div>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t('settings.etoroRealWarning')}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
