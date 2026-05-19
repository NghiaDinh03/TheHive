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
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
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
                {events.isLoading && (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <Activity className="text-gray-600 animate-pulse mb-3" size={32} />
                    <p className="text-gray-400">Loading audit events...</p>
                  </div>
                )}
                {!events.isLoading && items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-4 m-4 border border-dashed border-gray-700 bg-gray-900/50 rounded-xl">
                    <Activity className="text-gray-600 mb-3" size={32} />
                    <h4 className="text-gray-300 font-medium mb-1">No Events Found</h4>
                    <p className="text-gray-500 text-sm">System audit events will appear here in real-time.</p>
                  </div>
                )}
                {items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs uppercase bg-gray-800 text-gray-400 border-b border-gray-700">
                        <tr>
                          <th className="px-4 py-3 font-medium" style={{ width: 160 }}>Time</th>
                          <th className="px-4 py-3 font-medium" style={{ width: 120 }}>Actor</th>
                          <th className="px-4 py-3 font-medium" style={{ width: 90 }}>Action</th>
                          <th className="px-4 py-3 font-medium" style={{ width: 110 }}>Entity type</th>
                          <th className="px-4 py-3 font-medium">Entity ID</th>
                          <th className="px-4 py-3 font-medium" style={{ width: 120 }}>Request ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((ev) => (
                          <tr key={ev.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors bg-gray-900">
                            <td className="px-4 py-3 text-xs text-gray-500">{fmt(ev.created_at)}</td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1">
                                <User size={12} className="text-gray-500" />
                                <span className="text-sm font-medium text-white">{ev.actor_id}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${actionClass(ev.action)}`}>{ev.action}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5 text-sm">
                                <span className="text-blue-400">{entityIcon(ev.entity_type)}</span>
                                {ev.entity_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-cyan-400">{ev.entity_id}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{ev.request_id ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
