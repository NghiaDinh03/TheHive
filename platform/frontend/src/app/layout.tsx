import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import '@/styles/globals.css';
import { QueryProvider } from '@/lib/query-provider';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

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
    <html lang="en" className={roboto.variable}>
      <body className="font-sans antialiased min-h-screen bg-thehive-body text-thehive-text">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
