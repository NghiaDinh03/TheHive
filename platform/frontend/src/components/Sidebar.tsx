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
  Circle,
  Wifi,
  Clock,
} from '@/components/FaIcon';
import clsx from 'clsx';
import type { Permission } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  phase?: string;
  /** Permission required to see this nav item. If undefined, visible to all authenticated users. */
  requiredPermission?: Permission;
}

interface NavSection {
  section: string;
  items: NavItem[];
  /** Permission required to see this entire section. If undefined, visible to all authenticated users. */
  requiredPermission?: Permission;
}

const NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: true },
      { label: 'Search', href: '/search', icon: Search, enabled: true },
      { label: 'Live Stream', href: '/live', icon: Radio, enabled: true },
    ],
  },
  {
    section: 'Workspaces',
    items: [
      { label: 'Investigation', href: '/investigation', icon: Briefcase, enabled: true, requiredPermission: 'manageCase' },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, enabled: true, requiredPermission: 'manageTask' },
    ],
  },
  {
    section: 'Knowledge',
    items: [
      { label: 'Pages', href: '/pages', icon: FileText, enabled: true },
      { label: 'Dashboards', href: '/dashboards', icon: Activity, enabled: true },
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
    requiredPermission: 'manageUser',
    items: [
      { label: 'Admin', href: '/admin', icon: Shield, enabled: true, requiredPermission: 'manageUser' },
    ],
  },
];

/** Check if user has a specific permission (or managePlatform which is admin-all) */
function hasPermission(userPermissions: string[], required?: Permission): boolean {
  if (!required) return true; // no permission required = visible to all
  return userPermissions.includes(required) || userPermissions.includes('managePlatform');
}

/** Parse JWT payload from token string */
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
  const [userLogin, setUserLogin] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userOrg, setUserOrg] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token =
      sessionStorage.getItem('thehive.token') ||
      localStorage.getItem('thehive.token') ||
      localStorage.getItem('token') ||
      '';
    const fallbackLogin = sessionStorage.getItem('thehive.login') || '';

    if (!token) {
      setUserLogin(fallbackLogin);
      return;
    }

    const payload = parseJwtPayload(token);
    if (payload) {
      const perms = (payload.permissions as string[]) || [];
      setUserPermissions(perms);
      setUserLogin((payload.login as string) || (payload.sub as string) || fallbackLogin);
      setUserName((payload.name as string) || '');
      setUserOrg((payload.organisation as string) || '');
    }
  }, []);

  // Filter sections and items based on user permissions
  const visibleNav = NAV
    .filter(section => hasPermission(userPermissions, section.requiredPermission))
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasPermission(userPermissions, item.requiredPermission)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className="thehive-sidebar main-sidebar w-[230px] min-h-screen flex flex-col">
      <div className="thehive-logo h-[50px] flex items-center px-[15px]">
        <Image src="/logo-white.svg" alt="TheHive" width={108} height={36} priority />
      </div>

      {/* User panel — mirrors legacy TheHive 4 sidebar user panel with online status */}
      <div className="thehive-user-panel">
        <div className="thehive-user-avatar">
          <Circle size={10} fill="#3c763d" strokeWidth={0} />
        </div>
        <div className="thehive-user-info min-w-0">
          <div className="truncate" title={userName || userLogin || 'unknown'}>{userName || userLogin || 'unknown'}</div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Wifi size={9} style={{ color: '#3c763d' }} />
            Online
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {visibleNav.map((group) => (
          <div key={group.section} className="thehive-menu-section">
            <div className="thehive-sidebar-header">{group.section}</div>
            <ul className="sidebar-menu">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href.split('?')[0];
                return (
                  <li key={item.href} className={clsx(active && 'active')}>
                    {item.enabled ? (
                      <Link href={item.href}>
                        <Icon size={14} strokeWidth={2.2} />
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <span className="thehive-menu-disabled">
                        <Icon size={14} strokeWidth={2.2} />
                        <span className="flex-1">{item.label}</span>
                        <span className="thehive-menu-phase">{item.phase}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="thehive-sidebar-footer">
        <div>v0.6.x migration</div>
        <strong>TheHive 4 parity</strong>
      </div>
    </aside>
  );
}
