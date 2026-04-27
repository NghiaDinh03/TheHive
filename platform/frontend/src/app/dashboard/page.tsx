'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Database,
  Server,
  GitCommitHorizontal,
  Clock,
  ShieldCheck,
} from 'lucide-react';
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

interface User {
  login: string;
  name: string;
  organisation: string;
  profile: string;
  permissions: string[];
}

interface Readiness {
  status: 'ok' | 'degraded';
  checks: Record<string, { status: string; error?: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) {
      router.replace('/login');
    } else {
      setAuthedLogin(login);
    }
  }, [router]);

  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => apiFetch<AppStatus>('/api/v1/status'),
    enabled: !!authedLogin,
    refetchInterval: 30_000,
  });

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<User>('/api/v1/auth/me'),
    enabled: !!authedLogin,
  });

  const ready = useQuery({
    queryKey: ['ready'],
    queryFn: () => apiFetch<Readiness>('/readyz'),
    enabled: !!authedLogin,
    refetchInterval: 15_000,
  });

  if (!authedLogin) return null;

  const sysOK = ready.data?.status === 'ok';

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-light text-thehive-text">
                  Dashboard
                </h1>
                <p className="text-sm text-thehive-muted mt-1">
                  Phase 1 skeleton — case / alert / observable modules land in
                  Phase 3+.
                </p>
              </div>
              <span
                className={`thehive-pill ${sysOK ? '' : 'error'} self-end`}
                title="Readiness check"
              >
                <ShieldCheck size={13} />
                {sysOK ? 'All systems healthy' : 'Degraded'}
              </span>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Activity size={18} />}
                label="Backend"
                value={
                  ready.data?.checks?.postgres ? (status.data?.app ?? '—') : '—'
                }
                hint={status.data?.version ? `v${status.data.version}` : ''}
                ok={!!status.data}
              />
              <StatCard
                icon={<Database size={18} />}
                label="Database"
                value={
                  ready.data?.checks?.postgres?.status === 'ok'
                    ? 'PostgreSQL'
                    : 'Down'
                }
                hint={
                  status.data?.db_schema_version
                    ? `Schema v${status.data.db_schema_version}`
                    : ''
                }
                ok={ready.data?.checks?.postgres?.status === 'ok'}
              />
              <StatCard
                icon={<Server size={18} />}
                label="Message broker"
                value={
                  ready.data?.checks?.rabbitmq?.status === 'ok'
                    ? 'RabbitMQ'
                    : 'Down'
                }
                hint="3.13"
                ok={ready.data?.checks?.rabbitmq?.status === 'ok'}
              />
              <StatCard
                icon={<Clock size={18} />}
                label="Last status poll"
                value={
                  status.data?.timestamp
                    ? new Date(status.data.timestamp).toLocaleTimeString()
                    : '—'
                }
                hint="auto-refresh 30s"
                ok={!!status.data}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Backend status card */}
              <div className="thehive-card">
                <div className="thehive-card-header flex items-center gap-2">
                  <GitCommitHorizontal size={16} className="text-thehive-primary" />
                  <span>Backend status</span>
                </div>
                <div className="thehive-card-body">
                  {status.isLoading && (
                    <div className="thehive-empty">Loading…</div>
                  )}
                  {status.error && (
                    <div className="thehive-empty text-red-600">
                      {(status.error as Error).message}
                    </div>
                  )}
                  {status.data && (
                    <dl className="thehive-dl grid grid-cols-2 gap-x-4">
                      <div>
                        <dt>App</dt>
                        <dd>{status.data.app}</dd>
                      </div>
                      <div>
                        <dt>Version</dt>
                        <dd>{status.data.version}</dd>
                      </div>
                      <div>
                        <dt>Git SHA</dt>
                        <dd className="mono">{status.data.git_sha}</dd>
                      </div>
                      <div>
                        <dt>Build time</dt>
                        <dd className="mono">{status.data.build_time}</dd>
                      </div>
                      <div>
                        <dt>DB schema</dt>
                        <dd>
                          v{status.data.db_schema_version ?? 'n/a'}
                          {status.data.db_schema_dirty ? ' (dirty)' : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Server time</dt>
                        <dd className="mono">{status.data.timestamp}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>

              {/* Current user card */}
              <div className="thehive-card">
                <div className="thehive-card-header flex items-center gap-2">
                  <ShieldCheck size={16} className="text-thehive-primary" />
                  <span>Current user (mock)</span>
                </div>
                <div className="thehive-card-body">
                  {me.isLoading && (
                    <div className="thehive-empty">Loading…</div>
                  )}
                  {me.data && (
                    <dl className="thehive-dl grid grid-cols-2 gap-x-4">
                      <div>
                        <dt>Login</dt>
                        <dd>{me.data.login}</dd>
                      </div>
                      <div>
                        <dt>Name</dt>
                        <dd>{me.data.name}</dd>
                      </div>
                      <div>
                        <dt>Organisation</dt>
                        <dd>{me.data.organisation}</dd>
                      </div>
                      <div>
                        <dt>Profile</dt>
                        <dd>{me.data.profile}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt>Permissions</dt>
                        <dd>
                          {me.data.permissions.map((p) => (
                            <span
                              key={p}
                              className="inline-block bg-gray-100 text-thehive-text text-xs px-2 py-0.5 rounded mr-1.5 mb-1.5"
                            >
                              {p}
                            </span>
                          ))}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>
            </div>

            {/* Phase roadmap */}
            <div className="thehive-card mt-6">
              <div className="thehive-card-header">Phase roadmap</div>
              <div className="thehive-card-body">
                <ol className="text-sm space-y-2">
                  {[
                    ['v0.1.0 — Phase 1', 'Skeleton, Docker, mock auth, schema baseline.', true],
                    ['v0.2.0 — Phase 2', 'Real auth + user / org / profile / RBAC.', false],
                    ['v0.3.0 — Phase 3', 'Case + Alert core CRUD.', false],
                    ['v0.4.0 — Phase 4', 'Task / Log / Observable + S3 attachments.', false],
                    ['v0.5.0 — Phase 5', 'Cortex adapter via RabbitMQ worker.', false],
                    ['v0.6.0 — Phase 6', 'MISP adapter (event import + IOC export).', false],
                    ['v0.7.0 — Phase 7', 'Dashboard, search (OpenSearch), audit pipeline.', false],
                    ['v1.0.0 — Production pilot', '', false],
                  ].map(([title, desc, done]) => (
                    <li key={title as string} className="flex items-start gap-3">
                      <span
                        className={`mt-1 inline-block w-2 h-2 rounded-full ${done ? 'bg-thehive-primary' : 'bg-gray-300'}`}
                      />
                      <span className="font-medium w-44 shrink-0">{title}</span>
                      <span className="text-thehive-muted">{desc}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  ok: boolean;
}) {
  return (
    <div className="thehive-card">
      <div className="thehive-card-body flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded flex items-center justify-center ${
            ok ? 'bg-thehive-primary/10 text-thehive-primary' : 'bg-red-50 text-red-600'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-thehive-muted uppercase tracking-wide">
            {label}
          </div>
          <div className="text-sm font-medium truncate">{value}</div>
          {hint && (
            <div className="text-xs text-thehive-muted truncate">{hint}</div>
          )}
        </div>
      </div>
    </div>
  );
}
