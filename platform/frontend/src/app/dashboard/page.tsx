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

const serviceIcons: Record<string, ReactNode> = {
  postgres: <Database size={15} />,
  database: <Database size={15} />,
  minio: <HardDrive size={15} />,
  opensearch: <Search size={15} />,
  backend: <Server size={15} />,
  api: <Server size={15} />,
};

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

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Dashboard <small>SOC command center and platform monitoring</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Dashboard</li></ol>
          </section>

          <section className="content dashboard-monitor-page">
            {/* System health hero */}
            <div className="monitor-hero box box-primary">
              <div className="monitor-hero-main">
                <div className={`monitor-orb ${sysOK ? 'ok' : 'warn'}`}><Activity size={14} /></div>
                <div>
                  <div className="monitor-eyebrow">Runtime status</div>
                  <h2>{sysOK ? 'All monitored services are operational' : 'Service degradation detected'}</h2>
                  <p>{okChecks}/{checks.length || 0} readiness checks passing · refreshed every 15 seconds</p>
                </div>
              </div>
              <div className="monitor-score">
                <strong>{serviceScore}%</strong>
                <span>health score</span>
              </div>
            </div>

            {/* Stats row — AdminLTE small-box */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[15px]">
              <SmallBox icon={<Briefcase size={54} />} label="Cases" value={String(cases.data?.total ?? 0)} footer={`${openCases} open cases`} tone="aqua" href="/investigation?tab=cases" />
              <SmallBox icon={<AlertTriangle size={54} />} label="Alerts" value={String(alerts.data?.total ?? 0)} footer={`${newAlerts} new or updated`} tone="yellow" href="/investigation?tab=alerts" />
              <SmallBox icon={<Eye size={54} />} label="Observables" value={String(observables.data?.total ?? 0)} footer={`${iocCount} marked as IOC`} tone="blue" href="/investigation?tab=observables" />
              <SmallBox icon={<CheckSquare size={54} />} label="Tasks" value="—" footer="Open task workbench" tone="green" href="/tasks" />
            </div>

            {/* Service matrix + build signal */}
            <div className="grid lg:grid-cols-3 gap-[15px] mb-[15px]">
              <AdminBox title="Service Matrix" icon={<Database size={14} />} className="lg:col-span-2">
                <div className="service-matrix">
                  {checks.length === 0 && <div className="empty-message">Loading readiness checks...</div>}
                  {checks.map(([name, check]) => <ServiceTile key={name} name={name} status={check.status} error={check.error} />)}
                </div>
              </AdminBox>
              <AdminBox title="Build Signal" icon={<Server size={14} />}>
                {status.isLoading && <div className="empty-message">Loading status...</div>}
                {status.data && <dl className="dl-horizontal dashboard-dl monitor-dl">
                  <dt>App</dt><dd>{status.data.app}</dd>
                  <dt>Version</dt><dd>{status.data.version}</dd>
                  <dt>Git SHA</dt><dd className="mono">{status.data.git_sha}</dd>
                  <dt>Build</dt><dd className="mono">{status.data.build_time}</dd>
                  <dt>DB Schema</dt><dd>v{status.data.db_schema_version ?? 'n/a'}{status.data.db_schema_dirty ? ' (dirty)' : ''}</dd>
                  <dt>Server time</dt><dd className="mono">{status.data.timestamp}</dd>
                </dl>}
              </AdminBox>
            </div>

            {/* Recent cases + alerts */}
            <div className="grid lg:grid-cols-2 gap-[15px] mb-[15px]">
              <AdminBox title="Recent Cases" icon={<Briefcase size={14} />} href="/investigation?tab=cases">
                {cases.isLoading && <div className="empty-message">Loading cases...</div>}
                {(cases.data?.values ?? []).length === 0 && !cases.isLoading && <div className="empty-message">No cases found.</div>}
                <table className="thehive-table adminlte-table">
                  <tbody>
                    {(cases.data?.values ?? []).map(c => (
                      <tr key={c.id}>
                        <td className="w-16">
                          <span className={c.status === 'Open' ? 'label label-danger' : 'label label-success'}>{c.status}</span>
                        </td>
                        <td>
                          <a href={`/cases/${c.id}`}>#{c.number} {c.title}</a>
                          <div className="table-subtext">Assignee: {c.assignee || 'none'}</div>
                        </td>
                        <td><SeverityBadge value={c.severity} /></td>
                        <td className="table-date">{formatDate(c.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminBox>

              <AdminBox title="Recent Alerts" icon={<AlertTriangle size={14} />} href="/investigation?tab=alerts">
                {alerts.isLoading && <div className="empty-message">Loading alerts...</div>}
                {(alerts.data?.values ?? []).length === 0 && !alerts.isLoading && <div className="empty-message">No alerts found.</div>}
                <table className="thehive-table adminlte-table">
                  <tbody>
                    {(alerts.data?.values ?? []).map(a => (
                      <tr key={a.id}>
                        <td className="w-16">
                          <span className={a.status === 'New' ? 'label label-danger' : a.status === 'Updated' ? 'label label-warning' : 'label label-default'}>{a.status}</span>
                        </td>
                        <td>
                          <a href={`/alerts/${a.id}`}>{a.title}</a>
                          <div className="table-subtext">Source: {a.source || 'unknown'}</div>
                        </td>
                        <td><SeverityBadge value={a.severity} /></td>
                        <td className="table-date">{formatDate(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminBox>
            </div>

            {/* Account info + migration progress */}
            <div className="grid lg:grid-cols-2 gap-[15px]">
              <AdminBox title="Current Account" icon={<ShieldCheck size={14} />}>
                {me.isLoading && <div className="empty-message">Loading account...</div>}
                {me.data && (
                  <dl className="dl-horizontal dashboard-dl">
                    <dt>Login</dt><dd>{me.data.login}</dd>
                    <dt>Name</dt><dd>{me.data.name}</dd>
                    <dt>Organisation</dt><dd>{me.data.organisation}</dd>
                    <dt>Profile</dt><dd>{me.data.profile}</dd>
                    <dt>Permissions</dt>
                    <dd>{me.data.permissions.map(p => <span key={p} className="label label-default mr-1 mb-1 inline-block">{p}</span>)}</dd>
                  </dl>
                )}
              </AdminBox>
              <AdminBox title="Migration Progress" icon={<Clock size={14} />}>
                <ol className="migration-timeline">
                  {([
                    ['v0.1–0.2', 'Foundation, Docker, auth, RBAC, admin.', true],
                    ['v0.3', 'Case and alert write workflow.', true],
                    ['v0.4', 'Task, log and observable workbench.', true],
                    ['v0.5', 'MinIO/S3 attachment foundation.', true],
                    ['v0.6', 'Case detail parity foundation.', true],
                    ['v0.7+', 'Cortex, MISP, OpenSearch, runtime evidence.', false],
                  ] as [string, string, boolean][]).map(([title, desc, done]) => (
                    <li key={title} className={done ? 'done' : ''}>
                      <span>{title}</span>
                      <p>{desc}</p>
                    </li>
                  ))}
                </ol>
              </AdminBox>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function SmallBox({ icon, label, value, footer, tone, href }: {
  icon: ReactNode;
  label: string;
  value: string;
  footer: string;
  tone: 'red' | 'yellow' | 'aqua' | 'green' | 'blue';
  href: string;
}) {
  return (
    <div className={`small-box bg-${tone}`}>
      <div className="inner">
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
      <div className="icon">{icon}</div>
      <a className="small-box-footer" href={href}>{footer}</a>
    </div>
  );
}

function AdminBox({ title, icon, href, className = '', children }: {
  title: string;
  icon: ReactNode;
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`box box-primary ${className}`}>
      <div className="box-header with-border">
        <h3 className="box-title flex items-center gap-2">{icon}{title}</h3>
        {href && (
          <div className="box-tools pull-right">
            <a href={href} className="btn btn-box-tool btn-sm">View all</a>
          </div>
        )}
      </div>
      <div className="box-body no-padding">{children}</div>
    </div>
  );
}

function ServiceTile({ name, status, error }: { name: string; status: string; error?: string }) {
  const key = name.toLowerCase();
  const icon = serviceIcons[key] ?? <Activity size={15} />;
  const ok = status === 'ok';
  return (
    <div className={`service-tile ${ok ? 'ok' : 'warn'}`}>
      <div className="service-icon">{icon}</div>
      <div>
        <strong>{name}</strong>
        <span>{error || (ok ? 'operational' : status)}</span>
      </div>
      <span className={ok ? 'label label-success' : 'label label-warning'}>{status}</span>
    </div>
  );
}

function SeverityBadge({ value }: { value: number }) {
  const labels: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
  const classes: Record<number, string> = { 1: 'label-info', 2: 'label-warning', 3: 'label-warning', 4: 'label-danger' };
  return <span className={`label ${classes[value] ?? 'label-default'}`}>{labels[value] ?? `S${value}`}</span>;
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
