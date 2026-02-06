'use client';

import Link from 'next/link';
import { useLocale } from '@/app/context/LocaleContext';
export function NavBar() {
  const { t, locale, setLocale } = useLocale();
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-4">
      <Link href="/" className="text-blue-600 hover:underline">
        {t('nav.home')}
      </Link>
      <Link href="/dashboard" className="text-blue-600 hover:underline">
        {t('nav.dashboard')}
      </Link>
      <Link href="/indicators" className="text-blue-600 hover:underline">
        {t('nav.indicators')}
      </Link>
      <Link href="/alerts" className="text-blue-600 hover:underline">
        {t('nav.alerts')}
      </Link>
      <span className="ml-auto flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setLocale('es')}
          className={locale === 'es' ? 'font-semibold text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}
          aria-pressed={locale === 'es'}
        >
          ES
        </button>
        <span className="text-gray-400" aria-hidden>
          |
        </span>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={locale === 'en' ? 'font-semibold text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}
          aria-pressed={locale === 'en'}
        >
          EN
        </button>
      </span>
    </nav>
  );
}
