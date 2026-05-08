'use client';

/**
 * Dashboards list page.
 * Mirrors legacy TheHive 4 dashboards list view (frontend/app/views/partials/dashboard/list.html).
 * Lists all dashboards with title, description, owner, shared status.
 * Allows create/delete/duplicate/export with sortable columns.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Copy, Download, Edit2, Filter, Plus, Search, Trash2 } from '@/components/FaIcon';
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

type SortField = 'title' | 'status' | 'created_by' | 'created_at' | 'updated_at';

export default function DashboardsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: 'Shared' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [importing, setImporting] = useState(false);

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

  const duplicateDashboard = useMutation({
    mutationFn: async (item: Dashboard) => {
      const detail = await apiFetch<Dashboard>(`/api/v1/dashboards/${item.id}`);
      return apiFetch<Dashboard>('/api/v1/dashboards', {
        method: 'POST',
        json: {
          title: `${item.title} (copy)`,
          description: item.description,
          status: item.status,
          definition: detail.definition || JSON.stringify({ widgets: [] }),
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      reportSuccess('Dashboard duplicated.');
    },
    onError: reportError,
  });

  function exportDashboard(item: Dashboard) {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dashboard-${item.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    reportSuccess(`Exported "${item.title}".`);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortField(field); setSortDir('ASC'); }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return <i className="fa fa-sort" style={{ marginLeft: 4, opacity: 0.3 }} />;
    return sortDir === 'ASC' ? <i className="fa fa-caret-up" style={{ marginLeft: 4 }} /> : <i className="fa fa-caret-down" style={{ marginLeft: 4 }} />;
  }

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { reportError('Title is required.'); return; }
    createDashboard.mutate();
  }

  const rawItems = useMemo(() => dashboards.data?.values ?? [], [dashboards.data]);
  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    const items = q ? rawItems.filter(d => d.title.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q) || d.created_by.toLowerCase().includes(q)) : rawItems;
    return [...items].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'ASC' ? cmp : -cmp;
    });
  }, [rawItems, filter, sortField, sortDir]);

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Dashboards <small>analytics & monitoring</small></h1>
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

            {/* Import dialog — mirrors legacy dashboard/import.dialog.html */}
            {importing && (
              <div className="box">
                <div className="box-header with-border">
                  <h3 className="box-title">Import Dashboard</h3>
                </div>
                <div className="box-body">
                  <p className="text-muted text-sm">Select a JSON file exported from TheHive 4 or this platform.</p>
                  <input
                    type="file"
                    accept=".json"
                    className="form-control"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text) as Partial<Dashboard>;
                        if (!data.title) { reportError('Invalid dashboard JSON: missing title.'); return; }
                        await apiFetch<Dashboard>('/api/v1/dashboards', {
                          method: 'POST',
                          json: {
                            title: data.title,
                            description: data.description || undefined,
                            status: data.status || 'Shared',
                            definition: data.definition || JSON.stringify({ widgets: [] }),
                          },
                        });
                        await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
                        reportSuccess(`Imported dashboard "${data.title}".`);
                        setImporting(false);
                      } catch (err) {
                        reportError(err instanceof Error ? err.message : 'Import failed.');
                      }
                    }}
                  />
                </div>
                <div className="box-footer">
                  <button type="button" className="btn btn-default" onClick={() => setImporting(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Dashboard list — mirrors legacy dashboard/list.html */}
            <div className="box">
              <div className="box-header with-border">
                <h3 className="box-title"><Activity size={14} className="mr-1" /> Dashboard List ({filtered.length} of {rawItems.length})</h3>
                <div className="box-tools pull-right">
                  <button type="button" className={`btn btn-sm btn-default ml-xs ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}>
                    <Filter size={13} /> Filters
                  </button>
                  <button type="button" className="btn btn-default btn-sm ml-xs" onClick={() => setImporting(true)}>
                    <Download size={13} /> Import
                  </button>
                  <button type="button" className="btn btn-primary btn-sm ml-xs" onClick={() => setCreating(true)}>
                    <Plus size={13} /> New dashboard
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="box-body filter-panel">
                  <div className="relative">
                    <Search size={13} className="thehive-input-icon" />
                    <input className="thehive-input thehive-input-with-icon py-1.5" placeholder="Search dashboards..." value={filter} onChange={e => setFilter(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="box-body p-0">
                {dashboards.isLoading && <div className="thehive-empty">Loading dashboards…</div>}
                {!dashboards.isLoading && filtered.length === 0 && (
                  <div className="thehive-empty">No records</div>
                )}
                {filtered.length > 0 && (
                  <table className="table table-striped case-list">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>
                          <button className="sort-btn text-default" onClick={() => toggleSort('status')}>
                            Status {sortIndicator('status')}
                          </button>
                        </th>
                        <th>
                          <button className="sort-btn text-default" onClick={() => toggleSort('title')}>
                            Title {sortIndicator('title')}
                          </button>
                        </th>
                        <th style={{ width: 180 }}>
                          <button className="sort-btn text-default" onClick={() => toggleSort('created_by')}>
                            Owned By {sortIndicator('created_by')}
                          </button>
                        </th>
                        <th style={{ width: 150 }}>
                          Dates
                          <button className="sort-btn text-default ml-xxxs" onClick={() => toggleSort('created_at')} title="Sort by creation date">
                            C. {sortIndicator('created_at')}
                          </button>
                          <button className="sort-btn text-default ml-xxxs" onClick={() => toggleSort('updated_at')} title="Sort by last update date">
                            U. {sortIndicator('updated_at')}
                          </button>
                        </th>
                        <th style={{ width: 160 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d) => (
                        <tr key={d.id}>
                          <td className="wrap">
                            <span className={`label label-default clickable`} onClick={() => setFilter(d.status)}>{d.status}</span>
                          </td>
                          <td className="wrap">
                            <h4 className="mt-0" style={{ marginBottom: 2 }}>
                              <a href={`/dashboards/${d.id}`}>{d.title}</a>
                            </h4>
                            <span className="text-muted">{d.description}</span>
                          </td>
                          <td className="nowrap">{d.created_by}</td>
                          <td>
                            <div>C. <a href="#" onClick={e => { e.preventDefault(); setFilter(fmt(d.created_at)); }}>{fmt(d.created_at)}</a></div>
                            <div>U. <a href="#" onClick={e => { e.preventDefault(); setFilter(fmt(d.updated_at)); }}>{fmt(d.updated_at)}</a></div>
                          </td>
                          <td>
                            <div className="media-right ph-xs text-center" style={{ display: 'inline-block', textAlign: 'center', padding: '0 6px' }}>
                              <a href={`/dashboards/${d.id}`}><i className="fa fa-area-chart" /> <br />View</a>
                            </div>
                            <div className="media-right ph-xs text-center" style={{ display: 'inline-block', textAlign: 'center', padding: '0 6px' }}>
                              <a href={`/dashboards/${d.id}`}><i className="fa fa-pencil" /> <br />Edit</a>
                            </div>
                            <div className="media-right ph-xs text-center" style={{ display: 'inline-block', textAlign: 'center', padding: '0 6px' }}>
                              <a href="#" onClick={e => { e.preventDefault(); duplicateDashboard.mutate(d); }}><i className="fa fa-copy" /> <br />Copy</a>
                            </div>
                            <div className="media-right ph-xs text-center" style={{ display: 'inline-block', textAlign: 'center', padding: '0 6px' }}>
                              <a href="#" onClick={e => { e.preventDefault(); exportDashboard(d); }}><i className="fa fa-download" /> <br />Export</a>
                            </div>
                            <div className="media-right ph-xs text-center" style={{ display: 'inline-block', textAlign: 'center', padding: '0 6px' }}>
                              <a href="#" className="text-danger" onClick={e => { e.preventDefault(); if (window.confirm('Delete this dashboard?')) deleteDashboard.mutate(d.id); }}>
                                <i className="fa fa-trash" /> <br />Delete
                              </a>
                            </div>
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
