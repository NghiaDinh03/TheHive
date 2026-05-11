'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckSquare,
  Clock,
  Database,
  Eye,
  HardDrive,
  Search,
  Server,
  ShieldCheck,
} from '@/components/FaIcon';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface AppStatus {
  app: string;
  version: string;
  git_sha: string;
  build_time: string;
  timestamp: string;
  db_schema_version?: number;
  db_schema_dirty?: boolean;
}
interface User { login: string; name: string; organisation: string; profile: string; permissions: string[]; }
interface Readiness { status: 'ok' | 'degraded'; checks: Record<string, { status: string; error?: string }>; }
type Collection<T> = { values: T[]; total: number };
type CaseSummary = { id: string; number: number; title: string; severity: number; status: string; assignee: string; tags: string[]; created_at: string; updated_at: string };
type AlertSummary = { id: string; title: string; severity: number; status: string; source: string; created_at: string };
type ObsSummary = { id: string; data_type: string; data: string; ioc: boolean; sighted: boolean; created_at: string };

export default function DashboardPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const status = useQuery({ queryKey: ['status'], queryFn: () => apiFetch<AppStatus>('/api/v1/status'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const ready = useQuery({ queryKey: ['ready'], queryFn: () => apiFetch<Readiness>('/readyz'), enabled: !!authedLogin, refetchInterval: 15_000 });
  const cases = useQuery({ queryKey: ['dash-cases'], queryFn: () => apiFetch<Collection<CaseSummary>>('/api/v1/cases?range=0:4&sort=updated_at:DESC'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const alerts = useQuery({ queryKey: ['dash-alerts'], queryFn: () => apiFetch<Collection<AlertSummary>>('/api/v1/alerts?range=0:4&sort=created_at:DESC'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const observables = useQuery({ queryKey: ['dash-obs'], queryFn: () => apiFetch<Collection<ObsSummary>>('/api/v1/observables?range=0:4&sort=created_at:DESC'), enabled: !!authedLogin, refetchInterval: 30_000 });

  if (!authedLogin) return null;

  const sysOK = ready.data?.status === 'ok';
  const openCases = (cases.data?.values ?? []).filter(c => c.status === 'Open').length;
  const newAlerts = (alerts.data?.values ?? []).filter(a => a.status === 'New' || a.status === 'Updated').length;
  const iocCount = (observables.data?.values ?? []).filter(o => o.ioc).length;
  const checks = Object.entries(ready.data?.checks ?? {});
  const okChecks = checks.filter(([, check]) => check.status === 'ok').length;
  const serviceScore = checks.length ? Math.round((okChecks / checks.length) * 100) : 0;

  const [layout, setLayout] = useState([
    { i: 'banner', x: 0, y: 0, w: 12, h: 3, static: true },
    { i: 'stat-cases', x: 0, y: 3, w: 3, h: 3 },
    { i: 'stat-alerts', x: 3, y: 3, w: 3, h: 3 },
    { i: 'stat-obs', x: 6, y: 3, w: 3, h: 3 },
    { i: 'stat-tasks', x: 9, y: 3, w: 3, h: 3 },
    { i: 'matrix', x: 0, y: 6, w: 8, h: 6 },
    { i: 'signal', x: 8, y: 6, w: 4, h: 6 },
    { i: 'recent-cases', x: 0, y: 12, w: 6, h: 8 },
    { i: 'recent-alerts', x: 6, y: 12, w: 6, h: 8 },
    { i: 'account', x: 0, y: 20, w: 6, h: 6 },
    { i: 'progress', x: 6, y: 20, w: 6, h: 6 },
  ]);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ncs-body)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--ncs-text)' }}>Overview</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--ncs-muted)' }}>NCS Fusion Center — Command Dashboard</p>
            </div>
            <div className="text-sm text-gray-400"><i className="fa fa-arrows"></i> Drag widgets to rearrange</div>
          </div>

          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={30}
            width={1200}
            onLayoutChange={(newLayout) => setLayout(newLayout)}
            draggableHandle=".ncs-dark-card-header, .drag-handle"
          >
            {/* System status banner */}
            <div key="banner" className="ncs-dark-card ncs-status-banner drag-handle">
              <div className="flex items-center gap-3">
                <div className={`ncs-status-orb ${sysOK ? 'ok' : 'warn'}`}>
                  <Activity size={14} />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--ncs-muted)' }}>Runtime status</div>
                  <div className="font-medium" style={{ color: 'var(--ncs-text)' }}>
                    {sysOK ? 'All monitored services are operational' : 'Service degradation detected'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--ncs-muted)' }}>
                    {okChecks}/{checks.length || 0} checks passing · refreshed every 15s
                  </div>
                </div>
              </div>
              <div className="ncs-score-badge">
                <strong>{serviceScore}%</strong>
                <span>health</span>
              </div>
            </div>

            {/* Stat cards */}
            <div key="stat-cases" className="drag-handle"><StatCard icon={<Briefcase size={20} />} label="Cases" value={String(cases.data?.total ?? 0)} sub={`${openCases} open`} color="var(--ncs-primary)" href="/investigation?tab=cases" /></div>
            <div key="stat-alerts" className="drag-handle"><StatCard icon={<AlertTriangle size={20} />} label="Alerts" value={String(alerts.data?.total ?? 0)} sub={`${newAlerts} new or updated`} color="var(--ncs-warning)" href="/investigation?tab=alerts" /></div>
            <div key="stat-obs" className="drag-handle"><StatCard icon={<Eye size={20} />} label="Observables" value={String(observables.data?.total ?? 0)} sub={`${iocCount} marked as IOC`} color="var(--ncs-info)" href="/investigation?tab=observables" /></div>
            <div key="stat-tasks" className="drag-handle"><StatCard icon={<CheckSquare size={20} />} label="Tasks" value="—" sub="Open task workbench" color="var(--ncs-success)" href="/tasks" /></div>

            {/* Service matrix + build signal */}
            <div key="matrix">
              <DarkCard title="Service Matrix" icon={<Database size={14} />} className="h-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 h-full overflow-auto">
                  {checks.length === 0 && <div className="text-sm" style={{ color: 'var(--ncs-muted)' }}>Loading readiness checks...</div>}
                  {checks.map(([name, check]) => (
                    <ServiceTile key={name} name={name} status={check.status} error={check.error} />
                  ))}
                </div>
              </DarkCard>
            </div>
            <div key="signal">
              <DarkCard title="Build Signal" icon={<Server size={14} />} className="h-full">
                {status.isLoading && <div className="p-4 text-sm" style={{ color: 'var(--ncs-muted)' }}>Loading status...</div>}
                {status.data && (
                  <div className="p-4 space-y-3 h-full overflow-auto">
                    <InfoRow label="App" value={status.data.app} />
                    <InfoRow label="Version" value={status.data.version} />
                    <InfoRow label="Git SHA" value={status.data.git_sha} mono />
                    <InfoRow label="Build" value={status.data.build_time} mono />
                    <InfoRow label="DB Schema" value={`v${status.data.db_schema_version ?? 'n/a'}${status.data.db_schema_dirty ? ' (dirty)' : ''}`} />
                  </div>
                )}
              </DarkCard>
            </div>

            {/* Recent cases + alerts */}
            <div key="recent-cases">
              <DarkCard title="Recent Cases" icon={<Briefcase size={14} />} actionHref="/investigation?tab=cases" className="h-full">
                <div className="p-0 h-full overflow-auto">
                  {cases.isLoading && <div className="p-4 text-sm" style={{ color: 'var(--ncs-muted)' }}>Loading cases...</div>}
                  {(cases.data?.values ?? []).length === 0 && !cases.isLoading && <div className="p-4 text-sm" style={{ color: 'var(--ncs-muted)' }}>No cases found.</div>}
                  <table className="ncs-dark-table">
                    <tbody>
                      {(cases.data?.values ?? []).map(c => (
                        <tr key={c.id}>
                          <td className="w-16">
                            <span className={`ncs-badge ${c.status === 'Open' ? 'danger' : 'success'}`}>{c.status}</span>
                          </td>
                          <td>
                            <a href={`/cases/${c.id}`} className="ncs-link">#{c.number} {c.title}</a>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--ncs-muted)' }}>Assignee: {c.assignee || 'none'}</div>
                          </td>
                          <td><SeverityBadge value={c.severity} /></td>
                          <td className="text-xs whitespace-nowrap" style={{ color: 'var(--ncs-muted)' }}>{formatDate(c.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DarkCard>
            </div>

            <div key="recent-alerts">
              <DarkCard title="Recent Alerts" icon={<AlertTriangle size={14} />} actionHref="/investigation?tab=alerts" className="h-full">
                <div className="p-0 h-full overflow-auto">
                  {alerts.isLoading && <div className="p-4 text-sm" style={{ color: 'var(--ncs-muted)' }}>Loading alerts...</div>}
                  {(alerts.data?.values ?? []).length === 0 && !alerts.isLoading && <div className="p-4 text-sm" style={{ color: 'var(--ncs-muted)' }}>No alerts found.</div>}
                  <table className="ncs-dark-table">
                    <tbody>
                      {(alerts.data?.values ?? []).map(a => (
                        <tr key={a.id}>
                          <td className="w-16">
                            <span className={`ncs-badge ${a.status === 'New' ? 'danger' : a.status === 'Updated' ? 'warning' : 'default'}`}>{a.status}</span>
                          </td>
                          <td>
                            <a href={`/alerts/${a.id}`} className="ncs-link">{a.title}</a>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--ncs-muted)' }}>Source: {a.source || 'unknown'}</div>
                          </td>
                          <td><SeverityBadge value={a.severity} /></td>
                          <td className="text-xs whitespace-nowrap" style={{ color: 'var(--ncs-muted)' }}>{formatDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DarkCard>
            </div>

            {/* Account + migration */}
            <div key="account">
              <DarkCard title="Current Account" icon={<ShieldCheck size={14} />} className="h-full">
                {me.isLoading && <div className="p-4 text-sm" style={{ color: 'var(--ncs-muted)' }}>Loading account...</div>}
                {me.data && (
                  <div className="p-4 space-y-3 h-full overflow-auto">
                    <InfoRow label="Login" value={me.data.login} />
                    <InfoRow label="Name" value={me.data.name} />
                    <InfoRow label="Organisation" value={me.data.organisation} />
                    <InfoRow label="Profile" value={me.data.profile} />
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--ncs-muted)' }}>Permissions</div>
                      <div className="flex flex-wrap gap-1.5">
                        {me.data.permissions.map(p => <span key={p} className="ncs-badge default">{p}</span>)}
                      </div>
                    </div>
                  </div>
                )}
              </DarkCard>
            </div>
            <div key="progress">
              <DarkCard title="Platform Progress" icon={<Clock size={14} />} className="h-full">
                <div className="p-4 h-full overflow-auto">
                  <ol className="ncs-timeline">
                    {([
                      ['v0.1–0.2', 'Foundation, Docker, auth, RBAC', true],
                      ['v0.3', 'Case and alert write workflow', true],
                      ['v0.4', 'Task, log and observable workbench', true],
                      ['v0.5–0.6', 'MinIO, Case detail parity', true],
                      ['v0.7', 'NCS Fusion Center UI overhaul', true],
                      ['v0.8+', 'RBAC multi-tenant, i18n', false],
                    ] as [string, string, boolean][]).map(([title, desc, done]) => (
                      <li key={title} className={done ? 'done' : ''}>
                        <span className="ncs-timeline-marker" />
                        <div className="ncs-timeline-content">
                          <strong>{title}</strong>
                          <p>{desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </DarkCard>
            </div>
          </GridLayout>
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, href }: {
  icon: ReactNode; label: string; value: string; sub: string; color: string; href: string;
}) {
  return (
    <div className={`ncs-stat-card h-full m-0`} style={{ '--stat-color': color } as React.CSSProperties}>
      <div className="ncs-stat-icon">{icon}</div>
      <div className="ncs-stat-body">
        <div className="ncs-stat-value">{value}</div>
        <div className="ncs-stat-label">{label}</div>
      </div>
      <a href={href} className="ncs-stat-sub hover:underline">{sub}</a>
    </div>
  );
}

function DarkCard({ title, icon, actionHref, className = '', children }: {
  title: string; icon: ReactNode; actionHref?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`ncs-dark-card ${className}`}>
      <div className="ncs-dark-card-header cursor-move">
        <h3 className="ncs-dark-card-title">{icon}{title}</h3>
        {actionHref && <a href={actionHref} className="ncs-card-action">View all</a>}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function ServiceTile({ name, status, error }: { name: string; status: string; error?: string }) {
  const ok = status === 'ok';
  return (
    <div className={`ncs-service-tile ${ok ? 'ok' : 'warn'}`}>
      <div className="flex items-center gap-2">
        <Database size={14} />
        <strong>{name}</strong>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--ncs-muted)' }}>{error || (ok ? 'operational' : status)}</span>
        <span className={`ncs-badge ${ok ? 'success' : 'warning'}`}>{status}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs font-medium uppercase tracking-wider shrink-0" style={{ color: 'var(--ncs-muted)' }}>{label}</span>
      <span className={`text-sm text-right truncate ${mono ? 'font-mono text-xs' : ''}`} style={{ color: 'var(--ncs-text)' }}>{value}</span>
    </div>
  );
}

function SeverityBadge({ value }: { value: number }) {
  const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
  const colors: Record<number, string> = { 1: 'info', 2: 'warning', 3: 'warning', 4: 'danger' };
  return <span className={`ncs-badge ${colors[value] ?? 'default'}`}>{labels[value] ?? `S${value}`}</span>;
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
