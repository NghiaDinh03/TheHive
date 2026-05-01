'use client';

/**
 * Shared admin page shell (sidebar + topbar + content header + admin subnav).
 * Mirrors legacy `frontend/app/views/components/main-content.component.html` admin layout.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { AdminSubnav } from '@/components/AdminSubnav';
import { apiFetch } from '@/lib/api';

type Me = { login: string; name: string; permissions?: string[] };

export function AdminShell({
  title,
  small,
  breadcrumb,
  children,
}: {
  title: string;
  small?: string;
  breadcrumb?: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<Me>('/api/v1/auth/me'),
    enabled: !!authedLogin,
  });

  if (!authedLogin) return null;

  const crumbs = breadcrumb ?? ['Home', 'Administration', title];

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>
              {title}
              {small && <small>{small}</small>}
            </h1>
            <ol className="breadcrumb">
              {crumbs.map((crumb, idx) => (
                <li key={`${crumb}-${idx}`} className={idx === crumbs.length - 1 ? 'active' : ''}>
                  {crumb}
                </li>
              ))}
            </ol>
          </section>
          <section className="content">
            <AdminSubnav />
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
