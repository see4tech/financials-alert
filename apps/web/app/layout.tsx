import type { Metadata } from 'next';
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
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
