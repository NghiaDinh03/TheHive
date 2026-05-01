'use client';

/**
 * Dashboards list page.
 * Mirrors legacy TheHive 4 dashboards list view.
 * Lists all dashboards with title, description, owner, shared status.
 * Allows create/delete.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Plus, Trash2 } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';

type UserInfo = { login: string; name: string; permissions?: string[] };
type Dashboard = {
  id: string;
  title: string;
  description?: string;
  status: string;
  definition?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};
type Collection<T> = { values: T[]; total: number };

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

export default function DashboardsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: 'Shared' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<UserInfo>('/api/v1/auth/me'), enabled: !!authedLogin });
  const dashboards = useQuery({
    queryKey: ['dashboards'],
    queryFn: () => apiFetch<Collection<Dashboard>>('/api/v1/dashboards?range=0:100&sort=updated_at:DESC'),
    enabled: !!authedLogin,
  });

  function reportSuccess(msg: string) { setError(null); setMessage(msg); }
  function reportError(e: unknown) { setMessage(null); setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e)); }

  const createDashboard = useMutation({
    mutationFn: () => apiFetch<Dashboard>('/api/v1/dashboards', {
      method: 'POST',
      json: {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        definition: JSON.stringify({ widgets: [] }),
      },
    }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      reportSuccess('Dashboard created.');
      setCreating(false);
      setForm({ title: '', description: '', status: 'Shared' });
      router.push(`/dashboards/${data.id}`);
    },
    onError: reportError,
  });

  const deleteDashboard = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/dashboards/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      reportSuccess('Dashboard deleted.');
    },
    onError: reportError,
  });

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { reportError('Title is required.'); return; }
    createDashboard.mutate();
  }

  if (!authedLogin) return null;

  const items = dashboards.data?.values ?? [];

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Dashboards <small>analytics &amp; monitoring</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Dashboards</li></ol>
          </section>
          <section className="content">
            {message && <div className="alert alert-success alert-dismissible"><button type="button" className="close" onClick={() => setMessage(null)}>×</button>{message}</div>}
            {error && <div className="alert alert-danger alert-dismissible"><button type="button" className="close" onClick={() => setError(null)}>×</button>{error}</div>}

            {/* Create form */}
            {creating && (
              <div className="box">
                <div className="box-header with-border">
                  <h3 className="box-title">New Dashboard</h3>
                </div>
                <form onSubmit={submitCreate}>
                  <div className="box-body">
                    <div className="form-group">
                      <label className="control-label">Title <span className="text-danger">*</span></label>
                      <input type="text" className="form-control input-sm" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required autoFocus />
                    </div>
                    <div className="form-group">
                      <label className="control-label">Description</label>
                      <input type="text" className="form-control input-sm" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="control-label">Visibility</label>
                      <select className="form-control input-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                        <option value="Shared">Shared (visible to all)</option>
                        <option value="Private">Private (only me)</option>
                      </select>
                    </div>
                  </div>
                  <div className="box-footer">
                    <button type="button" className="btn btn-default" onClick={() => setCreating(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary pull-right" disabled={createDashboard.isPending}>
                      {createDashboard.isPending ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Dashboard list */}
            <div className="box">
              <div className="box-header with-border">
                <h3 className="box-title"><Activity size={14} className="mr-1" /> Dashboards</h3>
                <div className="box-tools pull-right">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
                    <Plus size={13} className="mr-1" /> New dashboard
                  </button>
                </div>
              </div>
              <div className="box-body p-0">
                {dashboards.isLoading && <div className="thehive-empty">Loading dashboards…</div>}
                {!dashboards.isLoading && items.length === 0 && (
                  <div className="thehive-empty">No dashboards yet. Create the first one.</div>
                )}
                {items.length > 0 && (
                  <table className="thehive-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th style={{ width: 200 }}>Description</th>
                        <th style={{ width: 90 }}>Visibility</th>
                        <th style={{ width: 120 }}>Owner</th>
                        <th style={{ width: 100 }}>Updated</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d) => (
                        <tr key={d.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/dashboards/${d.id}`)}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Activity size={13} className="text-muted flex-shrink-0" />
                              <span className="font-medium text-sm">{d.title}</span>
                            </div>
                          </td>
                          <td className="text-sm text-muted truncate" style={{ maxWidth: 200 }}>{d.description || '—'}</td>
                          <td>
                            <span className={`label ${d.status === 'Shared' ? 'label-success' : 'label-default'}`}>{d.status}</span>
                          </td>
                          <td className="text-sm">{d.created_by}</td>
                          <td className="text-xs text-muted">{fmt(d.updated_at)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger btn-xs"
                              onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this dashboard?')) deleteDashboard.mutate(d.id); }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
