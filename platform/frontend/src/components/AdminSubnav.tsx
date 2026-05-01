'use client';

/**
 * Admin sub-navigation tabs.
 * Mirrors legacy `frontend/app/views/components/main-sidebar.component.html` Administration block.
 * Source: TheHive 4 admin nav (organisations, profiles, custom fields, observables types, taxonomy, attack patterns, analyzer templates, case templates, ui settings, platform status).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  Building2,
  Shield,
  ListChecks,
  Database,
  Tags,
  Crosshair,
  FileCode2,
  ClipboardList,
  Settings,
  Activity,
} from '@/components/FaIcon';

const TABS = [
  { href: '/admin?tab=users', label: 'Users', icon: Users, match: /^\/admin(\?tab=users)?$/ },
  { href: '/admin/organisations', label: 'Organisations', icon: Building2, match: /^\/admin\/organisations/ },
  { href: '/admin/profiles', label: 'Profiles', icon: Shield, match: /^\/admin\/profiles/ },
  { href: '/admin/case-templates', label: 'Case templates', icon: ClipboardList, match: /^\/admin\/case-templates/ },
  { href: '/admin/custom-fields', label: 'Custom fields', icon: ListChecks, match: /^\/admin\/custom-fields/ },
  { href: '/admin/observable-types', label: 'Observable types', icon: Database, match: /^\/admin\/observable-types/ },
  { href: '/admin/taxonomy', label: 'Taxonomies', icon: Tags, match: /^\/admin\/taxonomy/ },
  { href: '/admin/attack', label: 'MITRE ATT&CK', icon: Crosshair, match: /^\/admin\/attack/ },
  { href: '/admin/analyzer-templates', label: 'Analyzer templates', icon: FileCode2, match: /^\/admin\/analyzer-templates/ },
  { href: '/admin/ui-settings', label: 'UI settings', icon: Settings, match: /^\/admin\/ui-settings/ },
  { href: '/admin/platform-status', label: 'Platform status', icon: Activity, match: /^\/admin\/platform-status/ },
];

export function AdminSubnav() {
  const pathname = usePathname() || '';
  return (
    <nav className="admin-subnav" aria-label="Administration sections">
      <ul>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match.test(pathname);
          return (
            <li key={tab.href}>
              <Link href={tab.href} className={active ? 'active' : ''}>
                <Icon size={14} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
