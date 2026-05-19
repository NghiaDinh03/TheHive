'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Server, ShieldCheck } from '@/components/FaIcon';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

interface AppStatus { app: string; version: string; git_sha: string; build_time: string; db_schema_version?: number; db_schema_dirty?: boolean; }
interface User { login: string; name: string; organisation: string; profile: string; permissions: string[]; }
interface Readiness { status: 'ok' | 'degraded'; checks: Record<string, { status: string; error?: string }>; }

export default function MonitorPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  const status = useQuery({ queryKey: ['status'], queryFn: () => apiFetch<AppStatus>('/api/v1/status'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const ready = useQuery({ queryKey: ['ready'], queryFn: () => apiFetch<Readiness>('/readyz'), enabled: !!authedLogin, refetchInterval: 15_000 });

  if (!authedLogin) return null;

  const checks = Object.entries(ready.data?.checks ?? {});
  const okChecks = checks.filter(([, c]) => c.status === 'ok').length;
  const healthPct = checks.length ? Math.round((okChecks / checks.length) * 100) : 0;
  const sysOK = ready.data?.status === 'ok';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ncs-body)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="flex-1 overflow-auto" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ color: 'var(--ncs-text)', fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>System Monitor</h1>
            <p style={{ color: 'var(--ncs-muted)', fontSize: '0.85rem', marginTop: 4 }}>NCS Fusion Center — Infrastructure & Runtime Status</p>
          </div>

          <div style={{ background: 'var(--ncs-card)', border: '1px solid var(--ncs-divider)', borderRadius: 10, padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: sysOK ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sysOK ? '#22c55e' : '#f59e0b' }}>
                <Activity size={18} />
              </div>
              <div>
                <div style={{ color: 'var(--ncs-text)', fontWeight: 500 }}>{sysOK ? 'All services operational' : 'Service degradation detected'}</div>
                <div style={{ color: 'var(--ncs-muted)', fontSize: '0.8rem' }}>{okChecks}/{checks.length} checks passing · auto-refresh 15s</div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: sysOK ? '#22c55e' : '#f59e0b' }}>{healthPct}%</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--ncs-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Health</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--ncs-card)', border: '1px solid var(--ncs-divider)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ncs-divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={14} /><h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--ncs-text)' }}>Service Health</h3>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {checks.map(([name, check]) => (
                  <div key={name} style={{ background: 'var(--ncs-surface)', borderRadius: 6, padding: '10px 14px', border: `1px solid ${check.status === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Database size={12} /><strong style={{ fontSize: '0.85rem', color: 'var(--ncs-text)' }}>{name}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--ncs-muted)' }}>{check.error || 'operational'}</span>
                      <span style={{ background: check.status === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: check.status === 'ok' ? '#22c55e' : '#f59e0b', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}>{check.status.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
                {checks.length === 0 && <div style={{ color: 'var(--ncs-muted)', fontSize: '0.85rem' }}>Loading checks...</div>}
              </div>
            </div>

            <div style={{ background: 'var(--ncs-card)', border: '1px solid var(--ncs-divider)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ncs-divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={14} /><h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--ncs-text)' }}>Build Info</h3>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {status.data && (<>
                  <InfoRow label="App" value={status.data.app} />
                  <InfoRow label="Version" value={status.data.version} />
                  <InfoRow label="Git SHA" value={status.data.git_sha} mono />
                  <InfoRow label="Build Time" value={status.data.build_time} mono />
                  <InfoRow label="DB Schema" value={`v${status.data.db_schema_version ?? 'n/a'}${status.data.db_schema_dirty ? ' (dirty)' : ''}`} />
                </>)}
                {!status.data && <div style={{ color: 'var(--ncs-muted)', fontSize: '0.85rem' }}>Loading build info...</div>}
              </div>
            </div>

            <div style={{ background: 'var(--ncs-card)', border: '1px solid var(--ncs-divider)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ncs-divider)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={14} /><h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--ncs-text)' }}>Account Privileges</h3>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {me.data && (<>
                  <InfoRow label="Login" value={me.data.login} />
                  <InfoRow label="Name" value={me.data.name} />
                  <InfoRow label="Organisation" value={me.data.organisation} />
                  <InfoRow label="Profile" value={me.data.profile} />
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ncs-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Permissions</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {me.data.permissions.map(p => <span key={p} style={{ background: 'var(--ncs-surface)', color: 'var(--ncs-muted)', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem' }}>{p}</span>)}
                    </div>
                  </div>
                </>)}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--ncs-divider)' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--ncs-muted)' }}>{label}</span>
      <span style={{ fontSize: mono ? '0.8rem' : '0.85rem', color: 'var(--ncs-text)', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
