'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getUserPreferences, saveUserPreferences } from '@/lib/api';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const VALID: Theme[] = ['light', 'dark', 'system'];

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID.includes(stored as Theme)) return stored as Theme;
  return 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function applyThemeClass(resolved: 'light' | 'dark') {
  const el = document.documentElement;
  if (resolved === 'dark') {
    el.classList.add('dark');
    el.classList.remove('light');
  } else {
    el.classList.add('light');
    el.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemPref, setSystemPref] = useState<'light' | 'dark'>('light');
  const [dbLoaded, setDbLoaded] = useState(false);
  const clientReady = useSupabaseAuthReady();

  // Resolve the actual theme
  const resolvedTheme = theme === 'system' ? systemPref : theme;

  // Initial mount: read from localStorage + detect system preference
  useEffect(() => {
    setThemeState(getInitialTheme());
    setSystemPref(getSystemTheme());
  }, []);

  // Listen for OS preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Apply class to <html> whenever resolved theme changes
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  // When Supabase auth is ready, load theme from DB
  useEffect(() => {
    if (!clientReady || dbLoaded) return;
    async function loadFromDb() {
      const client = getSupabaseBrowser();
      if (!client) return;
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session?.access_token) return;
        const prefs = await getUserPreferences(session.access_token);
        if (prefs.theme && VALID.includes(prefs.theme as Theme)) {
          const t = prefs.theme as Theme;
          setThemeState(t);
          if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, t);
        }
      } catch {
        // Ignore – use local preference
      } finally {
        setDbLoaded(true);
      }
    }
    loadFromDb();
  }, [clientReady, dbLoaded]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
    // Persist to DB if logged in
    (async () => {
      try {
        const client = getSupabaseBrowser();
        if (!client) return;
        const { data: { session } } = await client.auth.getSession();
        if (!session?.access_token) return;
        await saveUserPreferences(session.access_token, { theme: next });
      } catch {
        // Ignore – localStorage is the fallback
      }
    })();
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
