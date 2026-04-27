'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  AlertTriangle,
  Briefcase,
  Eye,
  CheckSquare,
  Users,
  Building2,
  Settings,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  phase?: string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: true },
    ],
  },
  {
    section: 'Investigation',
    items: [
      { label: 'Investigation', href: '/investigation', icon: Briefcase, enabled: true },
      { label: 'Alerts', href: '/investigation?tab=alerts', icon: AlertTriangle, enabled: true },
      { label: 'Cases', href: '/investigation?tab=cases', icon: Briefcase, enabled: true },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, enabled: false, phase: 'Phase 4' },
      { label: 'Observables', href: '/investigation?tab=observables', icon: Eye, enabled: true },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Admin', href: '/admin', icon: Users, enabled: true },
      { label: 'Users', href: '/admin?tab=users', icon: Users, enabled: true },
      { label: 'Organisations', href: '/admin?tab=organisations', icon: Building2, enabled: true },
      { label: 'Settings', href: '/settings', icon: Settings, enabled: false, phase: 'Phase 2' },
      { label: 'Health', href: '/health', icon: Activity, enabled: false, phase: 'Phase 2' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="thehive-sidebar w-60 min-h-screen flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-black/20 bg-thehive-sidebar-header">
        <Image src="/logo-white.svg" alt="TheHive" width={110} height={36} priority />
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.section} className="mb-2">
            <div className="thehive-sidebar-header">{group.section}</div>
            <ul>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href.split('?')[0];
                return (
                  <li key={item.href}>
                    {item.enabled ? (
                      <Link href={item.href} className={clsx(active && 'active')}>
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <span className="thehive-sidebar a disabled flex items-center gap-2.5 px-4 py-3 text-sm">
                        <Icon size={16} />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-[10px] uppercase tracking-wider text-thehive-sidebar-sub">
                          {item.phase}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-black/20 text-[11px] text-thehive-sidebar-sub">
        v0.2.2 · Phase 2.1.3
      </div>
    </aside>
  );
}
