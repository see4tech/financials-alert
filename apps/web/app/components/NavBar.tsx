'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '@/app/context/LocaleContext';
import { useTheme } from '@/app/context/ThemeContext';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.005 9.005 0 0012 21a9.005 9.005 0 008.354-5.646z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export function NavBar() {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const clientReady = useSupabaseAuthReady();
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!clientReady) return;
    const client = getSupabaseBrowser();
    if (!client) {
      setSession(true);
      return;
    }
    client.auth.getSession().then(({ data: { session: s } }) => setSession(!!s));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      client.auth.getSession().then(({ data: { session: s } }) => setSession(!!s));
    });
    return () => subscription.unsubscribe();
  }, [clientReady]);

  async function handleLogout() {
    setSession(false);
    const client = getSupabaseBrowser();
    if (client) {
      await client.auth.signOut();
    }
    router.push('/login');
  }

  const navLink = (href: string, label: string) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
        }`}
      >
        {label}
      </Link>
    );
  };

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const themeIcon = theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <MonitorIcon />;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 glass">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-1.5 sm:gap-2">
        {session === true && (
          <>
            {navLink('/dashboard', t('nav.dashboard'))}
            {navLink('/indicators', t('nav.indicators'))}
            {navLink('/alerts', t('nav.alerts'))}
            {navLink('/settings', t('nav.settings'))}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 transition-colors"
            >
              {t('nav.logout')}
            </button>
          </>
        )}
        {(session === false || session === null) && (
          <>
            {navLink('/login', t('nav.login'))}
            {navLink('/signup', t('nav.signup'))}
          </>
        )}

        {/* Spacer */}
        <span className="flex-1 min-w-0" />

        {/* Theme toggle */}
        <button
          type="button"
          onClick={cycleTheme}
          className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50 transition-colors"
          aria-label={`Theme: ${theme}`}
          title={`Theme: ${theme}`}
        >
          {themeIcon}
        </button>

        {/* Locale switcher */}
        <div className="shrink-0 flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setLocale('es')}
            className={`px-2 py-1 rounded transition-colors ${
              locale === 'es'
                ? 'font-semibold text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/20'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={locale === 'es'}
          >
            ES
          </button>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden>|</span>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`px-2 py-1 rounded transition-colors ${
              locale === 'en'
                ? 'font-semibold text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/20'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={locale === 'en'}
          >
            EN
          </button>
        </div>
      </div>
    </nav>
  );
}
