'use client';

/**
 * About page.
 * Mirrors legacy `frontend/app/views/partials/about.html` with AdminLTE boxes and version/status blocks.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Info, Server, ShieldCheck } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type Me = { login: string; name: string };
type Status = { version?: string; build?: string; versions?: Record<string, string>; capabilities?: string[] };

export default function AboutPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<Me>('/api/v1/auth/me'), enabled: !!authedLogin });
  const status = useQuery({
    queryKey: ['about-status'],
    queryFn: async () => {
      try {
        return await apiFetch<Status>('/api/v1/status');
      } catch {
        return {} as Status;
      }
    },
    enabled: !!authedLogin,
  });

  if (!authedLogin) return null;
  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ?? { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>About <small>TheHive 4 parity platform</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">About</li></ol>
          </section>
          <section className="content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="box box-primary md:col-span-2">
                <div className="box-header with-border"><h3 className="box-title"><Info size={14} /> TheHive</h3></div>
                <div className="box-body">
                  <div className="about-card">
                    <h2 className="text-xl font-light mb-2">TheHive 4 re-platform migration</h2>
                    <p className="text-muted mb-2">This interface preserves TheHive 4 AdminLTE skin-blue workflows while the backend is migrated to Go, PostgreSQL, MinIO and OpenSearch.</p>
                    <p className="text-muted">Legacy TheHive 4 remains the source of truth for UI density, fields, permissions, and SOC analyst workflows until all parity gates pass.</p>
                  </div>
                </div>
              </div>
              <div className="box box-primary">
                <div className="box-header with-border"><h3 className="box-title"><Server size={14} /> Version</h3></div>
                <div className="box-body">
                  <dl className="thehive-dl">
                    <dt>Version</dt><dd>{status.data?.version || status.data?.versions?.TheHive || 'migration-dev'}</dd>
                    <dt>Build</dt><dd>{status.data?.build || status.data?.versions?.build || 'local'}</dd>
                    <dt>Mode</dt><dd><span className="label label-warning">parity migration</span></dd>
                  </dl>
                </div>
              </div>
              <div className="box box-success md:col-span-3">
                <div className="box-header with-border"><h3 className="box-title"><ShieldCheck size={14} /> Capabilities</h3></div>
                <div className="box-body">
                  {(status.data?.capabilities ?? []).length === 0 ? <em className="text-muted">No capabilities reported by backend.</em> : (status.data?.capabilities ?? []).map((cap) => <span key={cap} className="label label-default mr-xxs mb-xxs">{cap}</span>)}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
