'use client';

/**
 * System Audit page.
 * Mirrors legacy TheHive 4 live stream / audit feed.
 * Shows real-time audit events with auto-refresh.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bell, Briefcase, CheckSquare, Eye, RefreshCw, User } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type UserInfo = { login: string; name: string; permissions?: string[] };
type AuditEvent = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
};
type Collection<T> = { values: T[]; total: number };

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

function entityIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'case': return <Briefcase size={13} />;
    case 'alert': return <Bell size={13} />;
    case 'task': return <CheckSquare size={13} />;
    case 'observable': return <Eye size={13} />;
    case 'user': return <User size={13} />;
    default: return <Activity size={13} />;
  }
}

function actionClass(action: string): string {
  switch (action.toLowerCase()) {
    case 'create': return 'label-success';
    case 'update': case 'patch': return 'label-info';
    case 'delete': return 'label-danger';
    case 'login': return 'label-primary';
    case 'close': return 'label-warning';
    default: return 'label-default';
  }
}

function hasPermission(userPermissions: string[], required: string): boolean {
  return userPermissions.includes(required) || userPermissions.includes('managePlatform');
}

export default function LivePage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<UserInfo>('/api/v1/auth/me'), enabled: !!authedLogin });
  const events = useQuery({
    queryKey: ['live-events', limit],
    queryFn: () => apiFetch<Collection<AuditEvent>>(`/api/v1/audit?limit=${limit}&sort=created_at:DESC`),
    enabled: !!authedLogin,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  if (!authedLogin) return null;

  if (me.data && !hasPermission(me.data.permissions || [], 'managePlatform')) {
    return (
      <div className="flex min-h-screen thehive-app-shell">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar user={{ login: me.data.login, name: me.data.name }} />
          <main className="content-wrapper flex-1">
            <section className="content-header">
              <h1>Access Denied</h1>
            </section>
            <section className="content">
              <div className="alert alert-danger">
                <h4><Activity size={15} className="mr-2" />Permission Error</h4>
                <p>You do not have the required permissions (managePlatform) to view the System Audit feed.</p>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  const items = events.data?.values ?? [];
  const total = events.data?.total ?? 0;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>System Audit <small>real-time audit events</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">System Audit</li></ol>
          </section>
          <section className="content">
            <div className="box">
              <div className="box-header with-border">
                <h3 className="box-title">
                  <Activity size={15} className="mr-1" />
                  Audit Events
                  {events.isFetching && <span className="ml-2 text-muted text-xs">refreshing…</span>}
                </h3>
                <div className="box-tools pull-right flex items-center gap-3">
                  <label className="flex items-center gap-1 text-sm font-normal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    Auto-refresh (5s)
                  </label>
                  <select
                    className="form-control input-sm"
                    style={{ width: 'auto' }}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                  >
                    <option value={25}>Last 25</option>
                    <option value={50}>Last 50</option>
                    <option value={100}>Last 100</option>
                    <option value={200}>Last 200</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-default btn-sm"
                    onClick={() => void events.refetch()}
                    disabled={events.isFetching}
                  >
                    <RefreshCw size={13} className="mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="box-body p-0">
                {events.isLoading && <div className="thehive-empty">Loading events…</div>}
                {!events.isLoading && items.length === 0 && (
                  <div className="thehive-empty">No audit events found.</div>
                )}
                {items.length > 0 && (
                  <table className="thehive-table">
                    <thead>
                      <tr>
                        <th style={{ width: 160 }}>Time</th>
                        <th style={{ width: 120 }}>Actor</th>
                        <th style={{ width: 90 }}>Action</th>
                        <th style={{ width: 110 }}>Entity type</th>
                        <th>Entity ID</th>
                        <th style={{ width: 120 }}>Request ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((ev) => (
                        <tr key={ev.id}>
                          <td className="text-xs text-muted">{fmt(ev.created_at)}</td>
                          <td>
                            <span className="flex items-center gap-1">
                              <User size={12} className="text-muted" />
                              <span className="text-sm">{ev.actor_id}</span>
                            </span>
                          </td>
                          <td>
                            <span className={`label ${actionClass(ev.action)}`}>{ev.action}</span>
                          </td>
                          <td>
                            <span className="flex items-center gap-1 text-sm">
                              {entityIcon(ev.entity_type)}
                              {ev.entity_type}
                            </span>
                          </td>
                          <td className="font-mono text-xs">{ev.entity_id}</td>
                          <td className="font-mono text-xs text-muted">{ev.request_id ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {total > limit && (
                <div className="box-footer text-muted text-sm">
                  Showing {items.length} of {total} total events. Increase limit to see more.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
