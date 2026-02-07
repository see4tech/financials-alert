'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { en } from '@/lib/i18n/en';
import { es, translateExplanation } from '@/lib/i18n/es';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getUserPreferences, saveUserPreferences } from '@/lib/api';

export type Locale = 'es' | 'en';

const STORAGE_KEY = 'locale';

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'es' || stored === 'en') return stored;
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  return lang.startsWith('es') ? 'es' : 'en';
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current == null || typeof current !== 'object') return undefined;
    const rest = parts.slice(i).join('.');
    const o = current as Record<string, unknown>;
    if (rest in o) return o[rest];
    current = o[parts[i]];
  }
  return current;
}

const dicts = { en, es };

type Dict = typeof en;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  translateExplain: (explain: string) => string;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const clientReady = useSupabaseAuthReady();

  // Initial mount: read from localStorage
  React.useEffect(() => {
    setLocaleState(getInitialLocale());
    setMounted(true);
  }, []);

  // When Supabase auth is ready, load locale from DB (overrides localStorage if logged in)
  React.useEffect(() => {
    if (!clientReady || dbLoaded) return;
    async function loadFromDb() {
      const client = getSupabaseBrowser();
      if (!client) return;
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.access_token) return;
        const prefs = await getUserPreferences(session.access_token);
        if (prefs.locale === 'en' || prefs.locale === 'es') {
          setLocaleState(prefs.locale);
          if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, prefs.locale);
        }
      } catch {
        // Ignore – use local preference
      } finally {
        setDbLoaded(true);
      }
    }
    loadFromDb();
  }, [clientReady, dbLoaded]);

  React.useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
    // Also persist to DB if user is logged in
    (async () => {
      try {
        const client = getSupabaseBrowser();
        if (!client) return;
        const { data: { session } } = await client.auth.getSession();
        if (!session?.access_token) return;
        await saveUserPreferences(session.access_token, { locale: next });
      } catch {
        // Ignore – localStorage is the fallback
      }
    })();
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const dict = dicts[locale] as Dict;
    return {
      locale,
      setLocale,
      t(key: string): string {
        if (!mounted) return key;
        const v = getByPath(dict as unknown as Record<string, unknown>, key);
        return typeof v === 'string' ? v : key;
      },
      translateExplain(explain: string): string {
        if (!mounted || !explain) return explain;
        if (locale === 'en') return explain;
        return translateExplanation(explain, es);
      },
    };
  }, [locale, setLocale, mounted]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
