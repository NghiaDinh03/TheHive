'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, Briefcase, CheckSquare, Clock,
  Database, Eye, Server, ShieldCheck,
} from '@/components/FaIcon';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

interface AppStatus { app: string; version: string; git_sha: string; build_time: string; db_schema_version?: number; db_schema_dirty?: boolean; }
interface User { login: string; name: string; organisation: string; profile: string; permissions: string[]; }
interface Readiness { status: 'ok' | 'degraded'; checks: Record<string, { status: string; error?: string }>; }
type Collection<T> = { values: T[]; total: number };
type CaseSummary = { id: string; number: number; title: string; severity: number; status: string; assignee: string; tags: string[]; organisation?: string; created_at: string; updated_at: string };
type AlertSummary = { id: string; title: string; severity: number; status: string; source: string; created_at: string };
type ObsSummary = { id: string; data_type: string; data: string; ioc: boolean; sighted: boolean; created_at: string };
type TaskSummary = { id: string; title: string; status: string; assignee: string; };

const sevLabel: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
const sevColor: Record<number, string> = { 1: '#06b6d4', 2: '#f59e0b', 3: '#f97316', 4: '#ef4444' };

function fmtDate(v: string) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  const status = useQuery({ queryKey: ['status'], queryFn: () => apiFetch<AppStatus>('/api/v1/status'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const ready = useQuery({ queryKey: ['ready'], queryFn: () => apiFetch<Readiness>('/readyz'), enabled: !!authedLogin, refetchInterval: 15_000 });
  const cases = useQuery({ queryKey: ['dash-cases'], queryFn: () => apiFetch<Collection<CaseSummary>>('/api/v1/cases?range=0:10&sort=updated_at:DESC'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const alerts = useQuery({ queryKey: ['dash-alerts'], queryFn: () => apiFetch<Collection<AlertSummary>>('/api/v1/alerts?range=0:10&sort=created_at:DESC'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const observables = useQuery({ queryKey: ['dash-obs'], queryFn: () => apiFetch<Collection<ObsSummary>>('/api/v1/observables?range=0:20&sort=created_at:DESC'), enabled: !!authedLogin, refetchInterval: 30_000 });
  const tasks = useQuery({ queryKey: ['dash-tasks'], queryFn: () => apiFetch<Collection<TaskSummary>>('/api/v1/tasks?range=0:20'), enabled: !!authedLogin, refetchInterval: 30_000 });

  if (!authedLogin) return null;

  const caseList = cases.data?.values ?? [];
  const alertList = alerts.data?.values ?? [];
  const obsList = observables.data?.values ?? [];
  const taskList = tasks.data?.values ?? [];
  const checks = Object.entries(ready.data?.checks ?? {});
  const okChecks = checks.filter(([, c]) => c.status === 'ok').length;
  const healthPct = checks.length ? Math.round((okChecks / checks.length) * 100) : 0;
  const sysOK = ready.data?.status === 'ok';

  const openCases = caseList.filter(c => c.status === 'Open').length;
  const resolvedCases = caseList.filter(c => c.status !== 'Open').length;
  const newAlerts = alertList.filter(a => a.status === 'New' || a.status === 'Updated').length;
  const iocCount = obsList.filter(o => o.ioc).length;
  const tasksDone = taskList.filter(t => t.status === 'Completed').length;
  const tasksActive = taskList.filter(t => t.status === 'InProgress').length;

  const caseSevDist = [1, 2, 3, 4].map(s => ({ sev: s, count: caseList.filter(c => c.severity === s).length }));
  const alertSevDist = [1, 2, 3, 4].map(s => ({ sev: s, count: alertList.filter(a => a.severity === s).length }));
  const maxCaseSev = Math.max(1, ...caseSevDist.map(d => d.count));
  const maxAlertSev = Math.max(1, ...alertSevDist.map(d => d.count));

  const obsTypes: Record<string, number> = {};
  obsList.forEach(o => { obsTypes[o.data_type] = (obsTypes[o.data_type] || 0) + 1; });
  const obsTypeEntries = Object.entries(obsTypes).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxObsType = Math.max(1, ...obsTypeEntries.map(e => e[1]));

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ncs-body)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="flex-1 overflow-auto" style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ color: 'var(--ncs-text)', fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>Overview</h1>
            <p style={{ color: 'var(--ncs-muted)', fontSize: '0.85rem', marginTop: 4 }}>NCS Fusion Center — Command Dashboard</p>
          </div>

          {/* Health Banner */}
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

          {/* Stat Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <KPI icon={<Briefcase size={20} />} label="Cases" value={cases.data?.total ?? 0} sub={`${openCases} open · ${resolvedCases} resolved`} color="#2563eb" href="/investigation?tab=cases" />
            <KPI icon={<AlertTriangle size={20} />} label="Alerts" value={alerts.data?.total ?? 0} sub={`${newAlerts} new/updated`} color="#f59e0b" href="/investigation?tab=alerts" />
            <KPI icon={<Eye size={20} />} label="Observables" value={observables.data?.total ?? 0} sub={`${iocCount} IOC flagged`} color="#06b6d4" href="/investigation?tab=observables" />
            <KPI icon={<CheckSquare size={20} />} label="Tasks" value={taskList.length} sub={`${tasksActive} active · ${tasksDone} done`} color="#22c55e" href="/tasks" />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Card title="Case Severity" icon={<Briefcase size={14} />}>
              <div style={{ padding: '16px 20px' }}>
                {caseSevDist.map(d => (
                  <div key={d.sev} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 60, fontSize: '0.78rem', color: 'var(--ncs-muted)' }}>{sevLabel[d.sev]}</span>
                    <div style={{ flex: 1, height: 22, background: 'var(--ncs-surface)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(d.count / maxCaseSev) * 100}%`, height: '100%', background: sevColor[d.sev], borderRadius: 4, transition: 'width 0.5s', minWidth: d.count > 0 ? 20 : 0 }} />
                    </div>
                    <span style={{ width: 24, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: 'var(--ncs-text)' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Alert Severity" icon={<AlertTriangle size={14} />}>
              <div style={{ padding: '16px 20px' }}>
                {alertSevDist.map(d => (
                  <div key={d.sev} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 60, fontSize: '0.78rem', color: 'var(--ncs-muted)' }}>{sevLabel[d.sev]}</span>
                    <div style={{ flex: 1, height: 22, background: 'var(--ncs-surface)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(d.count / maxAlertSev) * 100}%`, height: '100%', background: sevColor[d.sev], borderRadius: 4, transition: 'width 0.5s', minWidth: d.count > 0 ? 20 : 0 }} />
                    </div>
                    <span style={{ width: 24, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: 'var(--ncs-text)' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Observable Types" icon={<Eye size={14} />}>
              <div style={{ padding: '16px 20px' }}>
                {obsTypeEntries.length === 0 && <div style={{ color: 'var(--ncs-muted)', fontSize: '0.85rem' }}>No data</div>}
                {obsTypeEntries.map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 80, fontSize: '0.78rem', color: 'var(--ncs-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
                    <div style={{ flex: 1, height: 22, background: 'var(--ncs-surface)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / maxObsType) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 4, transition: 'width 0.5s', minWidth: 20 }} />
                    </div>
                    <span style={{ width: 24, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: 'var(--ncs-text)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Tables Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Card title="Recent Cases" icon={<Briefcase size={14} />} action={{ label: 'View all', href: '/investigation?tab=cases' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={thStyle}>Status</th><th style={thStyle}>Case</th><th style={thStyle}>Severity</th><th style={thStyle}>Updated</th>
                </tr></thead>
                <tbody>
                  {caseList.slice(0, 6).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--ncs-divider)' }}>
                      <td style={tdStyle}><Badge type={c.status === 'Open' ? 'danger' : 'success'}>{c.status}</Badge></td>
                      <td style={tdStyle}><a href={`/cases/${c.id}`} style={{ color: 'var(--ncs-primary)', textDecoration: 'none' }}>#{String(c.number).padStart(7, '0')} {c.title}</a><div style={{ color: 'var(--ncs-muted)', fontSize: '0.75rem', marginTop: '4px' }}><span style={{ color: '#94a3b8', marginRight: '8px', fontWeight: 500 }}>{c.organisation || 'Default Tenant'}</span> {c.assignee || 'Unassigned'}</div></td>
                      <td style={tdStyle}><Badge type={sevBadge(c.severity)}>{sevLabel[c.severity] ?? c.severity}</Badge></td>
                      <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'var(--ncs-muted)', whiteSpace: 'nowrap' }}>{fmtDate(c.updated_at)}</td>
                    </tr>
                  ))}
                  {caseList.length === 0 && <tr><td colSpan={4} style={{ ...tdStyle, color: 'var(--ncs-muted)', textAlign: 'center' }}>No cases</td></tr>}
                </tbody>
              </table>
            </Card>
            <Card title="Recent Alerts" icon={<AlertTriangle size={14} />} action={{ label: 'View all', href: '/investigation?tab=alerts' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={thStyle}>Status</th><th style={thStyle}>Alert</th><th style={thStyle}>Severity</th><th style={thStyle}>Created</th>
                </tr></thead>
                <tbody>
                  {alertList.slice(0, 6).map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--ncs-divider)' }}>
                      <td style={tdStyle}><Badge type={a.status === 'New' ? 'danger' : a.status === 'Updated' ? 'warning' : 'default'}>{a.status}</Badge></td>
                      <td style={tdStyle}><a href={`/alerts/${a.id}`} style={{ color: 'var(--ncs-primary)', textDecoration: 'none' }}>{a.title}</a><div style={{ color: 'var(--ncs-muted)', fontSize: '0.75rem' }}>{a.source}</div></td>
                      <td style={tdStyle}><Badge type={sevBadge(a.severity)}>{sevLabel[a.severity] ?? a.severity}</Badge></td>
                      <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'var(--ncs-muted)', whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
                  {alertList.length === 0 && <tr><td colSpan={4} style={{ ...tdStyle, color: 'var(--ncs-muted)', textAlign: 'center' }}>No alerts</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Bottom Row removed: System Monitor moved to /admin/monitor */}
        </main>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '10px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ncs-muted)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--ncs-divider)' };
const tdStyle: React.CSSProperties = { padding: '10px 16px', fontSize: '0.85rem', color: 'var(--ncs-text)', verticalAlign: 'middle' };

function sevBadge(v: number): string { return v >= 4 ? 'danger' : v >= 3 ? 'warning' : v >= 2 ? 'warning' : 'info'; }

function KPI({ icon, label, value, sub, color, href }: { icon: ReactNode; label: string; value: number; sub: string; color: string; href: string }) {
  return (
    <a href={href} style={{ background: 'var(--ncs-card)', border: '1px solid var(--ncs-divider)', borderRadius: 10, padding: '20px 22px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color 0.2s, box-shadow 0.2s', borderLeft: `4px solid ${color}` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${color}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ncs-divider)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderLeftColor = color; }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ncs-text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ncs-text)', marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--ncs-muted)' }}>{sub}</div>
      </div>
    </a>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: ReactNode; action?: { label: string; href: string }; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--ncs-card)', border: '1px solid var(--ncs-divider)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ncs-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--ncs-text)', display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{title}</h3>
        {action && <a href={action.href} style={{ fontSize: '0.78rem', color: 'var(--ncs-primary)', textDecoration: 'none' }}>{action.label}</a>}
      </div>
      {children}
    </div>
  );
}

function Badge({ type, children }: { type: string; children: ReactNode }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    danger: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
    success: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
    info: { bg: 'rgba(6,182,212,0.15)', fg: '#06b6d4' },
    default: { bg: 'var(--ncs-surface)', fg: 'var(--ncs-muted)' },
  };
  const c = colors[type] ?? colors.default;
  return <span style={{ background: c.bg, color: c.fg, padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{children}</span>;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--ncs-divider)' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--ncs-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: mono ? '0.78rem' : '0.85rem', color: 'var(--ncs-text)', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}
