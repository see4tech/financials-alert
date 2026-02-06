import type { Metadata } from 'next';
import { LocaleProvider } from '@/app/context/LocaleContext';
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
      <body className="min-h-screen antialiased">
        <LocaleProvider>
          <AuthRedirect>{children}</AuthRedirect>
        </LocaleProvider>
      </body>
    </html>
  );
}
