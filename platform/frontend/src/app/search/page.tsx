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

type CaseResult = { id: string; number: number; title: string; severity: number; status: string; assignee: string; tags: string[]; tlp: number; pap: number; created_at: string; organisation?: string };
type AlertResult = { id: string; title: string; source: string; source_ref: string; severity: number; status: string; tags: string[]; tlp: number; pap: number; created_at: string };
type ObservableResult = { id: string; data_type: string; data: string; ioc: boolean; sighted: boolean; case_number?: number; case_title?: string; tags: string[]; tlp: number; created_at: string };
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
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
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
          <section className="content p-6">
            <div className="flex flex-col">
              {/* Entity bar */}
              <div className="p-6 border-b border-slate-700 bg-slate-900/50">
                <h4 className="text-blue-500 font-medium text-lg mb-4">Search scope</h4>
                <div className="flex gap-2 flex-wrap">
                  {ENTITIES.map((e) => (
                    <button
                      key={e.name}
                      type="button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${entity === e.name ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                      onClick={() => switchEntity(e.name)}
                    >
                      {e.icon}
                      <span className="font-medium text-sm">{e.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="p-6 border-b border-slate-700 bg-slate-900/30">
                <h4 className="text-blue-500 font-medium text-lg mb-4 flex items-center gap-2">
                  Search filters
                  {filters.length > 0 && <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded-full">{filters.length} applied</span>}
                </h4>
                <form onSubmit={doSearch} className="space-y-4">
                  {/* Free text */}
                  <div className="w-full md:w-2/3 lg:w-1/2">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                      </div>
                      <input
                        type="text"
                        className="w-full pl-10 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        placeholder="Free text search…"
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                      />
                      {freeText && (
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200" onClick={() => setFreeText('')}>
                          <Times size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Field filters */}
                  <div className="space-y-2">
                    {filters.map((f, i) => (
                      <div key={i} className="flex flex-wrap md:flex-nowrap items-center gap-2">
                        <div className="flex bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
                          <button type="button" className="px-3 py-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-colors border-r border-slate-700" onClick={() => removeFilter(i)}>
                            <Times size={14} />
                          </button>
                          <select
                            className="px-3 py-2 bg-transparent text-sm text-slate-200 focus:outline-none w-32 md:w-40 cursor-pointer"
                            value={f.field}
                            onChange={(e) => updateFilter(i, 'field', e.target.value)}
                          >
                            {FILTER_FIELDS[entity].map((field) => (
                              <option key={field} value={field} className="bg-slate-800">{field}</option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          className="flex-1 md:flex-none md:w-64 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                          placeholder={`Value for ${f.field}…`}
                          value={f.value}
                          onChange={(e) => updateFilter(i, 'value', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 items-center flex-wrap">
                    <button type="button" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-slate-300 text-sm font-medium transition-colors flex items-center gap-1.5" onClick={addFilter}>
                      <Plus size={14} /> Add filter
                    </button>
                    {(filters.length > 0 || freeText) && (
                      <button type="button" className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-700/50 text-red-400 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5" onClick={clearFilters}>
                        <XCircle size={14} /> Clear filters
                      </button>
                    )}
                    <button type="submit" className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm">
                      <Search size={14} /> Search
                    </button>
                  </div>
                </form>
              </div>

              {/* Results */}
              {submitted && (
                <div className="p-6 bg-slate-800">
                  <h4 className="text-blue-500 font-medium text-lg mb-4 flex items-center gap-2">
                    Search Result
                    {results.isLoading ? <span className="text-slate-400 text-sm font-normal">loading…</span> : <span className="text-slate-400 text-sm font-normal">{total} record(s) found</span>}
                  </h4>

                  {results.isLoading && <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">Searching…</div>}
                  {!results.isLoading && values.length === 0 && (
                    <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No results found.</div>
                  )}

                  {!results.isLoading && values.length > 0 && (
                    <div className="flex flex-col gap-4">
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
  const baseCardClass = "block bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-sm hover:shadow-md hover:border-slate-500 transition-all duration-200 cursor-pointer relative overflow-hidden group";
  
  const badgeClass = "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider";

  if (entity === 'case') {
    const c = item as CaseResult;
    return (
      <a
        href={`/cases/${c.id}`}
        className={baseCardClass}
        onClick={(e) => { e.preventDefault(); router.push(`/cases/${c.id}`); }}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:w-1.5 transition-all"></div>
        <div className="flex items-start gap-4">
          <Briefcase size={22} className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-lg text-slate-200">#{String(c.number).padStart(7, '0')} {c.title}</span>
              <span className={`${badgeClass} bg-slate-700 text-slate-300`}>{severityLabels[c.severity] ?? c.severity}</span>
              <span className={`${badgeClass} bg-blue-900/50 text-blue-400 border border-blue-700/50`}>{c.status}</span>
              {c.tlp !== undefined && <span className={`${badgeClass} bg-slate-700 text-slate-300`}>TLP:{c.tlp}</span>}
            </div>
            {c.tags && c.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {c.tags.map(t => <span key={t} className="px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 rounded text-xs">{t}</span>)}
              </div>
            )}
            <div className="text-slate-500 text-sm mt-2 flex items-center gap-4">
              <span>Tenant: <strong className="text-slate-300">{c.organisation || 'Default Tenant'}</strong></span>
              <span>Assignee: <strong className="text-slate-300">{c.assignee || 'Unassigned'}</strong></span>
              <span>Created: {fmt(c.created_at)}</span>
            </div>
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
        className={baseCardClass}
        onClick={(e) => { e.preventDefault(); router.push(`/alerts/${a.id}`); }}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 group-hover:w-1.5 transition-all"></div>
        <div className="flex items-start gap-4">
          <AlertTriangle size={22} className="mt-0.5 text-orange-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-lg text-slate-200">{a.title}</span>
              <span className={`${badgeClass} bg-slate-700 text-slate-300`}>{severityLabels[a.severity] ?? a.severity}</span>
              <span className={`${badgeClass} bg-slate-800 text-slate-400 border border-slate-600`}>{a.source}</span>
              <span className={`${badgeClass} bg-blue-900/50 text-blue-400 border border-blue-700/50`}>{a.status}</span>
            </div>
            {a.tags && a.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {a.tags.map(t => <span key={t} className="px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 rounded text-xs">{t}</span>)}
              </div>
            )}
            <div className="text-slate-500 text-sm mt-2 flex items-center gap-4">
              <span>Ref: <strong className="text-slate-300">{a.source_ref || '-'}</strong></span>
              <span>Created: {fmt(a.created_at)}</span>
            </div>
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
        className={baseCardClass}
        onClick={(e) => { e.preventDefault(); router.push(`/observables/${o.id}`); }}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 group-hover:w-1.5 transition-all"></div>
        <div className="flex items-start gap-4">
          <Eye size={22} className="mt-0.5 text-teal-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`${badgeClass} bg-slate-800 text-slate-400 border border-slate-600`}>{o.data_type}</span>
              <span className="font-mono text-base text-slate-200">{o.data}</span>
              {o.ioc && <span className={`${badgeClass} bg-red-900/50 text-red-400 border border-red-700/50`}>IOC</span>}
              {o.sighted && <span className={`${badgeClass} bg-yellow-900/50 text-yellow-400 border border-yellow-700/50`}>Sighted</span>}
            </div>
            {o.tags && o.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {o.tags.map(t => <span key={t} className="px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 rounded text-xs">{t}</span>)}
              </div>
            )}
            <div className="text-slate-500 text-sm mt-2">
              {o.case_number ? `Linked to Case #${o.case_number} ${o.case_title ?? ''}` : 'Unlinked'} · {fmt(o.created_at)}
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
        className={baseCardClass}
        onClick={(e) => { e.preventDefault(); router.push(`/tasks/${t.id}`); }}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 group-hover:w-1.5 transition-all"></div>
        <div className="flex items-start gap-4">
          <CheckSquare size={22} className="mt-0.5 text-purple-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-lg text-slate-200">{t.title}</span>
              <span className={`${badgeClass} bg-blue-900/50 text-blue-400 border border-blue-700/50`}>{t.status}</span>
            </div>
            <div className="text-slate-500 text-sm mt-2 flex items-center gap-4">
              <span>Assignee: <strong className="text-slate-300">{t.assignee || 'Unassigned'}</strong></span>
              {t.case_number && <span>Case #{String(t.case_number).padStart(7, '0')}</span>}
              <span>Created: {fmt(t.created_at)}</span>
            </div>
          </div>
        </div>
      </a>
    );
  }
  // log
  const l = item as LogResult;
  return (
    <div className="block bg-slate-900 border border-slate-700 rounded-lg p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
      <div className="flex items-start gap-4">
        <FileText size={22} className="mt-0.5 text-slate-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="mb-3 text-base text-slate-300 whitespace-pre-wrap">{l.message}</p>
          <div className="text-slate-500 text-sm mt-2 pt-3 border-t border-slate-700/50">
            By <strong className="text-slate-300">{l.created_by}</strong> · {fmt(l.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

