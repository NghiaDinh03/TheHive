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
import clsx from 'clsx';
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
    const payload = JSON.parse(atob(parts[1]!));
    return payload as Record<string, unknown>;
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
    if (payload) {
      const perms = (payload.permissions as string[]) || [];
      setUserPermissions(perms);
    }
  }, []);

  const visibleNav = NAV
    .filter(section => hasPermission(userPermissions, section.requiredPermission))
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasPermission(userPermissions, item.requiredPermission)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className="ncs-sidebar">
      <div className="ncs-sidebar-logo">
        <Image src="/logo-sidebar.png" alt="NCS Fusion Center" width={130} height={40} priority />
      </div>

      <nav className="ncs-sidebar-nav">
        {visibleNav.map((group) => (
          <div key={group.section} className="ncs-nav-section">
            <div className="ncs-nav-section-title">{group.section}</div>
            <ul>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href.split('?')[0];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx('ncs-nav-link', active && 'active')}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="ncs-sidebar-footer">
        <span>NCS Fusion Center</span>
        <span className="ncs-version">v1.0</span>
      </div>
    </aside>
  );
}
