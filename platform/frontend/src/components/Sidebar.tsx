'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { LucideIcon } from '@/components/FaIcon';
import {
  Activity,
  Bell,
  Briefcase,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Link2,
  Radio,
  Search,
  Shield,
} from '@/components/FaIcon';
import { cn } from '@/lib/utils';
import type { Permission } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  requiredPermission?: Permission;
}

interface NavSection {
  section: string;
  items: NavItem[];
  requiredPermission?: Permission;
}

const NAV: NavSection[] = [
  {
    section: 'SOC Center',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, enabled: true },
      { label: 'Search', href: '/search', icon: Search, enabled: true },
    ],
  },
  {
    section: 'Threat Management',
    items: [
      { label: 'Investigation', href: '/investigation', icon: Briefcase, enabled: true, requiredPermission: 'manageCase' },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, enabled: true, requiredPermission: 'manageTask' },
    ],
  },
  {
    section: 'Knowledge & Intel',
    items: [
      { label: 'Dashboards', href: '/dashboards', icon: Activity, enabled: true },
      { label: 'Pages', href: '/pages', icon: FileText, enabled: true },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Integrations', href: '/misp', icon: Link2, enabled: true, requiredPermission: 'managePlatform' },
      { label: 'Notifications', href: '/notifications', icon: Bell, enabled: true, requiredPermission: 'managePlatform' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'System Audit', href: '/live', icon: Radio, enabled: true, requiredPermission: 'managePlatform' },
      { label: 'Admin', href: '/admin', icon: Shield, enabled: true, requiredPermission: 'manageUser' },
    ],
  },
];

function hasPermission(userPermissions: string[], required?: Permission): boolean {
  if (!required) return true;
  return userPermissions.includes(required) || userPermissions.includes('managePlatform');
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]!)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token =
      sessionStorage.getItem('thehive.token') ||
      localStorage.getItem('thehive.token') ||
      localStorage.getItem('token') ||
      '';
    if (!token) return;
    const payload = parseJwtPayload(token);
    if (payload) setUserPermissions((payload.permissions as string[]) || []);
  }, []);

  const visibleNav = NAV
    .filter(s => hasPermission(userPermissions, s.requiredPermission))
    .map(s => ({ ...s, items: s.items.filter(i => hasPermission(userPermissions, i.requiredPermission)) }))
    .filter(s => s.items.length > 0);

  return (
    <aside className={cn(
      'glass-sidebar flex flex-col w-56 min-h-screen shrink-0',
      'font-sans text-slate-300'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-2 pt-3 mb-2">
        <Image src="/logo-sidebar.png" alt="NCS Fusion Center" width={110} height={33} priority />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto glass-scroll px-2 py-3 space-y-4">
        {visibleNav.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const baseHref = item.href.split('?')[0];
                const active = pathname === baseHref || (baseHref !== '/' && pathname.startsWith(baseHref + '/'));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        active
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_rgba(37,99,235,0.15)]'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      )}
                    >
                      <Icon
                        size={15}
                        strokeWidth={active ? 2.2 : 1.8}
                        className={active ? 'text-blue-400' : 'text-slate-500'}
                      />
                      <span>{item.label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
        <span className="text-[11px] font-medium text-slate-500 tracking-wider">NCS Fusion Center</span>
        <span className="glass-badge text-[9px] px-1.5 py-0">v1.0</span>
      </div>
    </aside>
  );
}
