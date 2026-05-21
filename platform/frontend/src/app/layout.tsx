import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/dashboard-monitor.css';
import '@/styles/glass-system.css';

import { QueryProvider } from '@/lib/query-provider';
import { Force2FAOverlay } from '@/components/Force2FAOverlay';
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'NCS Fusion Center',
  description: 'NCS Fusion Center — Security Incident Response Platform',
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
    <html lang="en" className={cn("dark font-sans", inter.variable)}>
      <body className="min-h-screen bg-thehive-body text-thehive-text">
        <QueryProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Force2FAOverlay />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
