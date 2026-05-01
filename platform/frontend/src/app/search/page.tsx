'use client';

/**
 * Search page.
 * Mirrors legacy frontend/app/views/partials/search/list.html
 * Entity bar: cases, alerts, observables, tasks, logs.
 * Filter builder: add/remove field filters, search button.
 * Results: typed result cards per entity.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, CheckSquare, Eye, FileText, Plus, Search, Times, XCircle } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string; permissions?: string[] };
type EntityType = 'case' | 'alert' | 'observable' | 'task' | 'log';

type FilterField = { field: string; value: string };

type CaseResult = { id: string; number: number; title: string; severity: number; status: string; assignee: string; tags: string[]; created_at: string };
type AlertResult = { id: string; title: string; source: string; source_ref: string; severity: number; status: string; created_at: string };
type ObservableResult = { id: string; data_type: string; data: string; ioc: boolean; sighted: boolean; case_number?: number; case_title?: string; created_at: string };
type TaskResult = { id: string; title: string; status: string; assignee: string; case_number?: number; case_title?: string; created_at: string };
type LogResult = { id: string; message: string; created_by: string; task_id?: string; created_at: string };

type SearchResult =
  | { _type: 'case'; value: CaseResult }
  | { _type: 'alert'; value: AlertResult }
  | { _type: 'observable'; value: ObservableResult }
  | { _type: 'task'; value: TaskResult }
  | { _type: 'log'; value: LogResult };

type Collection<T> = { values: T[]; total: number };

const ENTITIES: { name: EntityType; label: string; icon: React.ReactNode }[] = [
  { name: 'case', label: 'Cases', icon: <Briefcase size={18} /> },
  { name: 'alert', label: 'Alerts', icon: <AlertTriangle size={18} /> },
  { name: 'observable', label: 'Observables', icon: <Eye size={18} /> },
  { name: 'task', label: 'Tasks', icon: <CheckSquare size={18} /> },
  { name: 'log', label: 'Logs', icon: <FileText size={18} /> },
];

const FILTER_FIELDS: Record<EntityType, string[]> = {
  case: ['title', 'status', 'severity', 'assignee', 'owner', 'tag', 'tlp', 'pap'],
  alert: ['title', 'source', 'source_ref', 'status', 'severity', 'tag', 'type'],
  observable: ['data_type', 'data', 'ioc', 'sighted', 'tag', 'tlp'],
  task: ['title', 'status', 'assignee', 'group_name'],
  log: ['message', 'created_by'],
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

const severityLabels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical' };
const severityClass: Record<number, string> = { 0: 'label-success', 1: 'label-warning', 2: 'label-danger', 3: 'label-danger' };

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="thehive-empty m-4">Loading search…</div>}>
      <SearchWorkspace />
    </Suspense>
  );
}

function SearchWorkspace() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [entity, setEntity] = useState<EntityType>('case');
  const [filters, setFilters] = useState<FilterField[]>([]);
  const [freeText, setFreeText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });

  // Build query params from filters + free text
  function buildParams() {
    const parts: string[] = [];
    if (freeText.trim()) parts.push(`q=${encodeURIComponent(freeText.trim())}`);
    for (const f of filters) {
      if (f.field && f.value) parts.push(`${encodeURIComponent(f.field)}=${encodeURIComponent(f.value)}`);
    }
    parts.push('range=0:50');
    return parts.join('&');
  }

  const endpoint: Record<EntityType, string> = {
    case: '/api/v1/cases',
    alert: '/api/v1/alerts',
    observable: '/api/v1/observables',
    task: '/api/v1/tasks',
    log: '/api/v1/logs',
  };

  const results = useQuery({
    queryKey: ['search', entity, freeText, filters],
    queryFn: () => apiFetch<Collection<unknown>>(`${endpoint[entity]}?${buildParams()}`),
    enabled: !!authedLogin && submitted,
  });

  function addFilter() { setFilters((f) => [...f, { field: FILTER_FIELDS[entity][0] ?? '', value: '' }]); }
  function removeFilter(i: number) { setFilters((f) => f.filter((_, idx) => idx !== i)); }
  function updateFilter(i: number, key: 'field' | 'value', val: string) {
    setFilters((f) => f.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  }
  function clearFilters() { setFilters([]); setFreeText(''); setSubmitted(false); }
  function doSearch(e: React.FormEvent) { e.preventDefault(); setSubmitted(true); void results.refetch(); }

  function switchEntity(e: EntityType) { setEntity(e); setFilters([]); setFreeText(''); setSubmitted(false); }

  if (!authedLogin) return null;

  const values = (results.data?.values ?? []) as Record<string, unknown>[];
  const total = results.data?.total ?? 0;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Search <small>cases, alerts, observables, tasks, logs</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Search</li></ol>
          </section>
          <section className="content">
            <div className="box search-list">
              {/* Entity bar */}
              <div className="box-body" style={{ paddingBottom: 0 }}>
                <h4 className="text-primary" style={{ marginTop: 0 }}>Search scope</h4>
                <div className="entity-bar">
                  {ENTITIES.map((e) => (
                    <button
                      key={e.name}
                      type="button"
                      className={`entity-item${entity === e.name ? ' active' : ''}`}
                      onClick={() => switchEntity(e.name)}
                    >
                      <div className="entity-item-icon">{e.icon}</div>
                      <div className="entity-item-text">{e.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="box-body">
                <h4 className="text-primary">
                  Search filters{' '}
                  {filters.length > 0 && <small>{filters.length} filter(s) applied</small>}
                </h4>
                <form onSubmit={doSearch}>
                  {/* Free text */}
                  <div className="row mb-2">
                    <div className="col-sm-12 col-md-8">
                      <div className="input-group">
                        <span className="input-group-addon"><Search size={14} /></span>
                        <input
                          type="text"
                          className="form-control input-sm"
                          placeholder="Free text search…"
                          value={freeText}
                          onChange={(e) => setFreeText(e.target.value)}
                        />
                        {freeText && (
                          <span className="input-group-btn">
                            <button type="button" className="btn btn-default btn-sm" onClick={() => setFreeText('')}>
                              <Times size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Field filters */}
                  {filters.map((f, i) => (
                    <div key={i} className="row mb-1">
                      <div className="col-sm-4 col-md-3">
                        <div className="input-group">
                          <span className="input-group-btn">
                            <button type="button" className="btn btn-default btn-sm" onClick={() => removeFilter(i)}>
                              <Times size={12} className="text-danger" />
                            </button>
                          </span>
                          <select
                            className="form-control input-sm"
                            value={f.field}
                            onChange={(e) => updateFilter(i, 'field', e.target.value)}
                          >
                            {FILTER_FIELDS[entity].map((field) => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-sm-8 col-md-5">
                        <input
                          type="text"
                          className="form-control input-sm"
                          placeholder={`Value for ${f.field}…`}
                          value={f.value}
                          onChange={(e) => updateFilter(i, 'value', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="row mt-2">
                    <div className="col-sm-12 col-md-8 flex gap-2 flex-wrap">
                      <button type="button" className="btn btn-default btn-sm" onClick={addFilter}>
                        <Plus size={13} className="mr-1" /> Add filter
                      </button>
                      {(filters.length > 0 || freeText) && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={clearFilters}>
                          <Times size={13} className="mr-1" /> Clear filters
                        </button>
                      )}
                      <button type="submit" className="btn btn-primary btn-sm ml-auto">
                        <Search size={13} className="mr-1" /> Search
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Results */}
              {submitted && (
                <div className="box-body" style={{ paddingTop: 0 }}>
                  <h4 className="text-primary">
                    Search Result{' '}
                    {results.isLoading ? <small>loading…</small> : <small>{total} record(s) found</small>}
                  </h4>

                  {results.isLoading && <div className="thehive-empty">Searching…</div>}
                  {!results.isLoading && values.length === 0 && (
                    <div className="thehive-empty">No results found.</div>
                  )}

                  {!results.isLoading && values.length > 0 && (
                    <div className="list-group">
                      {values.map((item, idx) => (
                        <SearchResultCard key={idx} entity={entity} item={item} router={router} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function SearchResultCard({ entity, item, router }: { entity: EntityType; item: Record<string, unknown>; router: ReturnType<typeof useRouter> }) {
  if (entity === 'case') {
    const c = item as CaseResult;
    return (
      <a
        href={`/cases/${c.id}`}
        className="list-group-item list-group-item-action"
        onClick={(e) => { e.preventDefault(); router.push(`/cases/${c.id}`); }}
      >
        <div className="flex items-start gap-2">
          <Briefcase size={14} className="mt-1 text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">#{c.number} {c.title}</span>
              <span className={`label ${severityClass[c.severity] ?? 'label-default'}`}>{severityLabels[c.severity] ?? c.severity}</span>
              <span className="label label-info">{c.status}</span>
            </div>
            <div className="text-muted text-xs mt-1">Assignee: {c.assignee || '-'} · {fmt(c.created_at)}</div>
          </div>
        </div>
      </a>
    );
  }
  if (entity === 'alert') {
    const a = item as AlertResult;
    return (
      <a
        href={`/alerts/${a.id}`}
        className="list-group-item list-group-item-action"
        onClick={(e) => { e.preventDefault(); router.push(`/alerts/${a.id}`); }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-1 text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{a.title}</span>
              <span className="label label-default">{a.source}</span>
              <span className="label label-info">{a.status}</span>
            </div>
            <div className="text-muted text-xs mt-1">Ref: {a.source_ref} · {fmt(a.created_at)}</div>
          </div>
        </div>
      </a>
    );
  }
  if (entity === 'observable') {
    const o = item as ObservableResult;
    return (
      <a
        href={`/observables/${o.id}`}
        className="list-group-item list-group-item-action"
        onClick={(e) => { e.preventDefault(); router.push(`/observables/${o.id}`); }}
      >
        <div className="flex items-start gap-2">
          <Eye size={14} className="mt-1 text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label label-default">{o.data_type}</span>
              <span className="font-medium font-mono text-sm">{o.data}</span>
              {o.ioc && <span className="label label-danger">IOC</span>}
              {o.sighted && <span className="label label-warning">Sighted</span>}
            </div>
            <div className="text-muted text-xs mt-1">
              {o.case_number ? `Case #${o.case_number} ${o.case_title ?? ''}` : ''} · {fmt(o.created_at)}
            </div>
          </div>
        </div>
      </a>
    );
  }
  if (entity === 'task') {
    const t = item as TaskResult;
    return (
      <a
        href={`/tasks/${t.id}`}
        className="list-group-item list-group-item-action"
        onClick={(e) => { e.preventDefault(); router.push(`/tasks/${t.id}`); }}
      >
        <div className="flex items-start gap-2">
          <CheckSquare size={14} className="mt-1 text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{t.title}</span>
              <span className="label label-info">{t.status}</span>
            </div>
            <div className="text-muted text-xs mt-1">
              Assignee: {t.assignee || '-'} · {t.case_number ? `Case #${t.case_number}` : ''} · {fmt(t.created_at)}
            </div>
          </div>
        </div>
      </a>
    );
  }
  // log
  const l = item as LogResult;
  return (
    <div className="list-group-item">
      <div className="flex items-start gap-2">
        <FileText size={14} className="mt-1 text-muted flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="mb-0 text-sm">{l.message}</p>
          <div className="text-muted text-xs mt-1">By {l.created_by} · {fmt(l.created_at)}</div>
        </div>
      </div>
    </div>
  );
}
