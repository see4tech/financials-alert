'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

const PROTECTED_PREFIXES = ['/dashboard', '/indicators', '/alerts'];
const PUBLIC_PATHS = ['/login', '/signup'];

function isProtectedPath(pathname: string): boolean {
  if (pathname === '/') return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function AuthRedirect({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    if (pathname === '/' || PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }
    if (!isProtectedPath(pathname)) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    getSupabaseBrowser()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) router.replace('/login');
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) {
          router.replace('/login');
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!checked && isProtectedPath(pathname ?? '')) {
    return null;
  }
  return <>{children}</>;
}
