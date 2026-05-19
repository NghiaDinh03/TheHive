'use client';

/**
 * Dashboard detail page with widget renderer.
 * Mirrors legacy TheHive 4 dashboard detail view.
 * Renders widgets: counter, donut, bar, line, text.
 * Allows edit title/description and add/remove widgets.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BarChart3, Edit2, PieChart, Plus, Save, Trash2 } from '@/components/FaIcon';
import { DashboardWidgetEditor, type WidgetDefinition } from '@/components/DashboardWidgetEditor';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';

type UserInfo = { login: string; name: string; permissions?: string[] };
type Widget = {
  id: string;
  type: 'counter' | 'donut' | 'bar' | 'line' | 'text';
  title: string;
  query?: string;
  field?: string;
  text?: string;
  color?: string;
};
type DashboardDefinition = { widgets: Widget[] };
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
type WidgetData = { count?: number; values?: { key: string; count: number }[]; series?: { date: string; count: number }[] };

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

function parseDefinition(def?: string): DashboardDefinition {
  if (!def) return { widgets: [] };
  try { return JSON.parse(def) as DashboardDefinition; } catch { return { widgets: [] }; }
}

const WIDGET_COLORS: Record<string, string> = {
  counter: '#3c8dbc',
  donut: '#00a65a',
  bar: '#f39c12',
  line: '#00c0ef',
  text: '#777',
};

function WidgetCard({ widget, refetchInterval }: { widget: Widget; refetchInterval?: number | null }) {
  const query = useQuery({
    queryKey: ['widget-data', widget.id, widget.query],
    queryFn: () => apiFetch<WidgetData>(`/api/v1/dashboard/widget?type=${widget.type}&query=${encodeURIComponent(widget.query ?? '')}&field=${encodeURIComponent(widget.field ?? '')}`),
    enabled: widget.type !== 'text' && !!widget.query,
    refetchInterval: refetchInterval ? refetchInterval * 1000 : 30_000,
  });

  const color = widget.color || WIDGET_COLORS[widget.type] || '#3c8dbc';

  return (
    <div className="box" style={{ borderTop: `3px solid ${color}` }}>
      <div className="box-header with-border">
        <h3 className="box-title flex items-center gap-2">
          {widget.type === 'counter' && <Activity size={13} />}
          {(widget.type === 'donut' || widget.type === 'bar') && <BarChart3 size={13} />}
          {widget.type === 'line' && <Activity size={13} />}
          {widget.type === 'text' && <Edit2 size={13} />}
          {widget.title}
        </h3>
      </div>
      <div className="box-body">
        {widget.type === 'text' && (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{widget.text || <span className="text-muted">No content.</span>}</div>
        )}
        {widget.type === 'counter' && (
          <div className="text-center">
            {query.isLoading ? (
              <div className="text-muted">Loading…</div>
            ) : (
              <div style={{ fontSize: '3rem', fontWeight: 300, color }}>{query.data?.count ?? 0}</div>
            )}
          </div>
        )}
        {(widget.type === 'donut' || widget.type === 'bar') && (
          <div>
            {query.isLoading ? (
              <div className="text-muted">Loading…</div>
            ) : !query.data?.values?.length ? (
              <div className="thehive-empty">No data.</div>
            ) : (
              <table className="thehive-table" style={{ fontSize: '0.82rem' }}>
                <tbody>
                  {query.data.values.slice(0, 10).map((v) => (
                    <tr key={v.key}>
                      <td>{v.key}</td>
                      <td style={{ width: 60, textAlign: 'right', fontWeight: 600 }}>{v.count}</td>
                      <td style={{ width: 120 }}>
                        <div className="progress" style={{ marginBottom: 0 }}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${Math.round((v.count / Math.max(...(query.data?.values?.map((x) => x.count) ?? [1]))) * 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {widget.type === 'line' && (
          <div>
            {query.isLoading ? (
              <div className="text-muted">Loading…</div>
            ) : !query.data?.series?.length ? (
              <div className="thehive-empty">No data.</div>
            ) : (
              <div className="flex items-end gap-1" style={{ height: 80 }}>
                {query.data.series.slice(-20).map((s, i) => {
                  const max = Math.max(...(query.data?.series?.map((x) => x.count) ?? [1]));
                  return (
                    <div
                      key={i}
                      title={`${s.date}: ${s.count}`}
                      style={{
                        flex: 1,
                        height: `${Math.round((s.count / Math.max(max, 1)) * 100)}%`,
                        backgroundColor: color,
                        minHeight: 2,
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'Shared' });
  const [addingWidget, setAddingWidget] = useState(false);
  const [useAdvancedEditor, setUseAdvancedEditor] = useState(false);
  const [widgetForm, setWidgetForm] = useState({ type: 'counter' as Widget['type'], title: '', query: '', field: '', text: '', color: '' });
  const [advancedWidget, setAdvancedWidget] = useState<WidgetDefinition>({
    type: 'counter', title: '', entity: 'case', field: 'status',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Auto-refresh — mirrors legacy dashboard view.html auto-refresh buttons
  const [autoRefresh, setAutoRefresh] = useState<number | null>(null);
  // Period selector — mirrors legacy dashboard/view.html period selector
  const [period, setPeriod] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const dashboardPeriods = [
    { type: 'all', label: 'All time' },
    { type: '1d', label: '1 day' },
    { type: '7d', label: '7 days' },
    { type: '1m', label: '1 month' },
    { type: '3m', label: '3 months' },
    { type: '6m', label: '6 months' },
    { type: '1y', label: '1 year' },
  ];

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<UserInfo>('/api/v1/auth/me'), enabled: !!authedLogin });
  const detail = useQuery({
    queryKey: ['dashboard', params.id],
    queryFn: () => apiFetch<Dashboard>(`/api/v1/dashboards/${params.id}`),
    enabled: !!authedLogin && !!params.id,
  });

  const dash = detail.data;
  const definition = parseDefinition(dash?.definition);

  useEffect(() => {
    if (dash && !editing) {
      setEditForm({ title: dash.title, description: dash.description ?? '', status: dash.status });
    }
  }, [dash, editing]);

  function reportSuccess(msg: string) { setError(null); setMessage(msg); }
  function reportError(e: unknown) { setMessage(null); setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e)); }

  const updateDashboard = useMutation({
    mutationFn: (newDef?: DashboardDefinition) => apiFetch<Dashboard>(`/api/v1/dashboards/${params.id}`, {
      method: 'PATCH',
      json: {
        title: editForm.title.trim() || dash?.title,
        description: editForm.description.trim() || undefined,
        status: editForm.status,
        definition: JSON.stringify(newDef ?? definition),
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', params.id] });
      reportSuccess('Dashboard saved.');
      setEditing(false);
      setAddingWidget(false);
    },
    onError: reportError,
  });

  function addWidget() {
    if (useAdvancedEditor) {
      if (!advancedWidget.title.trim()) { reportError('Widget title is required.'); return; }
      const newWidget: Widget = {
        id: `w-${Date.now()}`,
        type: advancedWidget.type === 'multiline' ? 'line' : advancedWidget.type,
        title: advancedWidget.title.trim(),
        query: advancedWidget.entity || undefined,
        field: advancedWidget.field?.trim() || undefined,
        text: advancedWidget.text?.trim() || undefined,
        color: undefined,
      };
      const newDef: DashboardDefinition = { widgets: [...definition.widgets, newWidget] };
      updateDashboard.mutate(newDef);
      setAdvancedWidget({ type: 'counter', title: '', entity: 'case', field: 'status' });
    } else {
      if (!widgetForm.title.trim()) { reportError('Widget title is required.'); return; }
      const newWidget: Widget = {
        id: `w-${Date.now()}`,
        type: widgetForm.type,
        title: widgetForm.title.trim(),
        query: widgetForm.query.trim() || undefined,
        field: widgetForm.field.trim() || undefined,
        text: widgetForm.text.trim() || undefined,
        color: widgetForm.color || undefined,
      };
      const newDef: DashboardDefinition = { widgets: [...definition.widgets, newWidget] };
      updateDashboard.mutate(newDef);
      setWidgetForm({ type: 'counter', title: '', query: '', field: '', text: '', color: '' });
    }
  }

  function removeWidget(id: string) {
    const newDef: DashboardDefinition = { widgets: definition.widgets.filter((w) => w.id !== id) };
    updateDashboard.mutate(newDef);
  }

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>
              {dash?.title ?? 'Dashboard'}
              {' '}
              <small>{dash?.status}</small>
            </h1>
            <ol className="breadcrumb">
              <li>Home</li>
              <li><a href="/dashboards">Dashboards</a></li>
              <li className="active">{dash?.title ?? params.id}</li>
            </ol>
          </section>
          <section className="content">
            {message && <div className="alert alert-success alert-dismissible"><button type="button" className="close" onClick={() => setMessage(null)}>×</button>{message}</div>}
            {error && <div className="alert alert-danger alert-dismissible"><button type="button" className="close" onClick={() => setError(null)}>×</button>{error}</div>}

            {detail.isLoading && <div className="thehive-empty">Loading dashboard…</div>}

            {dash && (
              <>
                {/* Header actions */}
                <div className="box">
                  <div className="box-header with-border">
                    <h3 className="box-title"><Activity size={14} className="mr-1" /> {dash.title}</h3>
                    <div className="box-tools pull-right flex gap-2">
                      {/* Auto-refresh buttons — mirrors legacy dashboard/view.html */}
                      <div className="btn-group btn-group-sm">
                        <button type="button" className={`btn btn-sm ${autoRefresh === null ? 'btn-primary' : 'btn-default'}`} onClick={() => setAutoRefresh(null)}>Off</button>
                        <button type="button" className={`btn btn-sm ${autoRefresh === 60 ? 'btn-primary' : 'btn-default'}`} onClick={() => setAutoRefresh(60)}>1m</button>
                        <button type="button" className={`btn btn-sm ${autoRefresh === 300 ? 'btn-primary' : 'btn-default'}`} onClick={() => setAutoRefresh(300)}>5m</button>
                        <button type="button" className={`btn btn-sm ${autoRefresh === 600 ? 'btn-primary' : 'btn-default'}`} onClick={() => setAutoRefresh(600)}>10m</button>
                        <button type="button" className={`btn btn-sm ${autoRefresh === 900 ? 'btn-primary' : 'btn-default'}`} onClick={() => setAutoRefresh(900)}>15m</button>
                      </div>
                      <button type="button" className="btn btn-default btn-sm" onClick={() => setEditing((v) => !v)}>
                        <Edit2 size={12} className="mr-1" /> {editing ? 'Cancel edit' : 'Edit'}
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddingWidget((v) => !v)}>
                        <Plus size={12} className="mr-1" /> Add widget
                      </button>
                    </div>
                  </div>
                  {dash.description && (
                    <div className="box-body">
                      <p className="text-muted text-sm">{dash.description}</p>
                      <p className="text-muted text-xs">By {dash.created_by} · Updated {fmt(dash.updated_at)}</p>
                    </div>
                  )}
                </div>

                {/* Period selector — mirrors legacy dashboard/view.html period selector */}
                <div className="box" style={{ marginBottom: 0 }}>
                  <div className="box-body" style={{ padding: '8px 12px' }}>
                    <div className="dashboard-period">
                      <div className="mv-xxxs">
                        <span className="label label-lg mr-xs text-black">Select period</span>
                        {dashboardPeriods.map((p) => (
                          <button
                            key={p.type}
                            type="button"
                            className={`btn btn-xs ${period === p.type ? 'btn-primary' : 'btn-default'} mr-xxs`}
                            onClick={() => setPeriod(p.type)}
                          >
                            {p.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`btn btn-xs ${period === 'custom' ? 'btn-primary' : 'btn-default'} mr-xxs`}
                          onClick={() => setPeriod('custom')}
                        >
                          Custom period
                        </button>
                      </div>
                      {period === 'custom' && (
                        <div className="mv-xxxs form-inline" style={{ marginTop: 8 }}>
                          <div className="form-group" style={{ marginRight: 12 }}>
                            <label style={{ marginRight: 4 }}>From</label>
                            <input
                              type="date"
                              className="form-control input-sm"
                              value={customFrom}
                              onChange={(e) => setCustomFrom(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginRight: 12 }}>
                            <label style={{ marginRight: 4 }}>To</label>
                            <input
                              type="date"
                              className="form-control input-sm"
                              value={customTo}
                              onChange={(e) => setCustomTo(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit form */}
                {editing && (
                  <div className="box">
                    <div className="box-header with-border"><h3 className="box-title">Edit dashboard</h3></div>
                    <div className="box-body">
                      <div className="form-group">
                        <label className="control-label">Title</label>
                        <input type="text" className="form-control input-sm" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="control-label">Description</label>
                        <input type="text" className="form-control input-sm" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="control-label">Visibility</label>
                        <select className="form-control input-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                          <option value="Shared">Shared</option>
                          <option value="Private">Private</option>
                        </select>
                      </div>
                    </div>
                    <div className="box-footer">
                      <button type="button" className="btn btn-default" onClick={() => setEditing(false)}>Cancel</button>
                      <button type="button" className="btn btn-primary pull-right" onClick={() => updateDashboard.mutate(undefined)} disabled={updateDashboard.isPending}>
                        <Save size={13} className="mr-1" /> Save
                      </button>
                    </div>
                  </div>
                )}

                {/* Add widget form — simple or advanced editor */}
                {addingWidget && (
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title">Add widget</h3>
                      <div className="box-tools pull-right">
                        <div className="btn-group btn-group-xs">
                          <button type="button" className={`btn btn-xs ${!useAdvancedEditor ? 'btn-primary' : 'btn-default'}`} onClick={() => setUseAdvancedEditor(false)}>Simple</button>
                          <button type="button" className={`btn btn-xs ${useAdvancedEditor ? 'btn-primary' : 'btn-default'}`} onClick={() => setUseAdvancedEditor(true)}>Advanced</button>
                        </div>
                      </div>
                    </div>
                    <div className="box-body">
                      {useAdvancedEditor ? (
                        <DashboardWidgetEditor widget={advancedWidget} onChange={setAdvancedWidget} />
                      ) : (
                        <>
                          <div className="row">
                            <div className="col-md-3">
                              <div className="form-group">
                                <label className="control-label">Type</label>
                                <select className="form-control input-sm" value={widgetForm.type} onChange={(e) => setWidgetForm((f) => ({ ...f, type: e.target.value as Widget['type'] }))}>
                                  <option value="counter">Counter</option>
                                  <option value="donut">Donut / Bar</option>
                                  <option value="bar">Bar chart</option>
                                  <option value="line">Line / Trend</option>
                                  <option value="text">Text / Markdown</option>
                                </select>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div className="form-group">
                                <label className="control-label">Title <span className="text-danger">*</span></label>
                                <input type="text" className="form-control input-sm" value={widgetForm.title} onChange={(e) => setWidgetForm((f) => ({ ...f, title: e.target.value }))} />
                              </div>
                            </div>
                            <div className="col-md-2">
                              <div className="form-group">
                                <label className="control-label">Color</label>
                                <input type="color" className="form-control input-sm" value={widgetForm.color || '#3c8dbc'} onChange={(e) => setWidgetForm((f) => ({ ...f, color: e.target.value }))} />
                              </div>
                            </div>
                          </div>
                          {widgetForm.type !== 'text' && (
                            <div className="row">
                              <div className="col-md-5">
                                <div className="form-group">
                                  <label className="control-label">Query (entity type)</label>
                                  <select className="form-control input-sm" value={widgetForm.query} onChange={(e) => setWidgetForm((f) => ({ ...f, query: e.target.value }))}>
                                    <option value="">— Select entity —</option>
                                    <option value="case">Cases</option>
                                    <option value="alert">Alerts</option>
                                    <option value="observable">Observables</option>
                                    <option value="task">Tasks</option>
                                  </select>
                                </div>
                              </div>
                              <div className="col-md-4">
                                <div className="form-group">
                                  <label className="control-label">Group by field</label>
                                  <input type="text" className="form-control input-sm" placeholder="e.g. status, severity, tlp" value={widgetForm.field} onChange={(e) => setWidgetForm((f) => ({ ...f, field: e.target.value }))} />
                                </div>
                              </div>
                            </div>
                          )}
                          {widgetForm.type === 'text' && (
                            <div className="form-group">
                              <label className="control-label">Content</label>
                              <textarea className="form-control" rows={4} value={widgetForm.text} onChange={(e) => setWidgetForm((f) => ({ ...f, text: e.target.value }))} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="box-footer">
                      <button type="button" className="btn btn-default" onClick={() => setAddingWidget(false)}>Cancel</button>
                      <button type="button" className="btn btn-primary pull-right" onClick={addWidget} disabled={updateDashboard.isPending}>
                        <Plus size={13} className="mr-1" /> Add widget
                      </button>
                    </div>
                  </div>
                )}

                {/* Widgets grid */}
                {definition.widgets.length === 0 && (
                  <div className="thehive-empty">No widgets yet. Click &ldquo;Add widget&rdquo; to create the first one.</div>
                )}
                <div className="row">
                  {definition.widgets.map((widget) => (
                    <div key={widget.id} className="col-md-4">
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-xs"
                          style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                          onClick={() => { if (window.confirm('Remove this widget?')) removeWidget(widget.id); }}
                          title="Remove widget"
                        >
                          <Trash2 size={11} />
                        </button>
                        <WidgetCard widget={widget} refetchInterval={autoRefresh} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
