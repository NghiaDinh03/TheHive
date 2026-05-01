import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/dashboard-monitor.css';
import { QueryProvider } from '@/lib/query-provider';

export const metadata: Metadata = {
  title: 'TheHive Platform',
  description: 'TheHive re-platform — Phase 1 skeleton',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-thehive-body text-thehive-text">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
