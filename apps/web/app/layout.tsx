import type { Metadata } from 'next';
import { LocaleProvider } from '@/app/context/LocaleContext';
import { ThemeProvider } from '@/app/context/ThemeContext';
import { SupabaseAuthProvider } from '@/app/context/SupabaseAuthContext';
import { AuthRedirect } from '@/app/components/AuthRedirect';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Health Checklist',
  description: 'Weekly score and real-time alerts for market health indicators',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply dark class before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='system'?window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light':t;document.documentElement.classList.add(d);document.documentElement.classList.add('no-transitions');requestAnimationFrame(function(){requestAnimationFrame(function(){document.documentElement.classList.remove('no-transitions')})});}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <SupabaseAuthProvider>
          <ThemeProvider>
            <LocaleProvider>
              <AuthRedirect>{children}</AuthRedirect>
            </LocaleProvider>
          </ThemeProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
