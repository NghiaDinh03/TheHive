'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, CheckCircle2, Clock3, Eye, Filter, Search, SlidersHorizontal, Tag } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type SortSpec = { field: string; order: 'ASC' | 'DESC' };
type Collection<T> = {
  values: T[];
  total: number;
  mode: 'demo-read-only' | 'legacy-read-only' | 'postgres-read-only' | 'read-only';
  range?: [number, number];
  sort?: SortSpec;
  filters?: Record<string, string>;
};

type CaseSummary = { id: string; number: number; title: string; severity: number; tlp: number; pap: number; status: string; owner: string; assignee: string; tags: string[]; task_count: number; observable_count: number; alert_count: number; created_at: string; updated_at: string; };
type AlertSummary = { id: string; title: string; type: string; source: string; source_ref: string; severity: number; tlp: number; status: string; read: boolean; case_number?: number; observable_count: number; tags: string[]; created_at: string; };
type ObservableSummary = { id: string; data_type: string; data: string; message: string; tlp: number; ioc: boolean; sighted: boolean; tags: string[]; case_number: number; case_title: string; created_by: string; created_at: string; };
type User = { login: string; name: string; permissions?: string[] };
type Tab = 'cases' | 'alerts' | 'observables';

const severityLabels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical', 4: 'Critical' };
const pageSize = 10;
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function InvestigationPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('cases');
  const [showFilters, setShowFilters] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortSpec>({ field: 'updated_at', order: 'DESC' });
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
    setSort({ field: activeTab === 'cases' ? 'updated_at' : 'created_at', order: 'DESC' });
    setFilters({});
  }, [activeTab]);

  const params = useMemo(() => buildParams(page, sort, filters), [page, sort, filters]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const cases = useQuery({ queryKey: ['cases', params], queryFn: () => apiFetch<Collection<CaseSummary>>(`/api/v1/cases?${params}`), enabled: !!authedLogin });
  const alerts = useQuery({ queryKey: ['alerts', params], queryFn: () => apiFetch<Collection<AlertSummary>>(`/api/v1/alerts?${params}`), enabled: !!authedLogin });
  const observables = useQuery({ queryKey: ['observables', params], queryFn: () => apiFetch<Collection<ObservableSummary>>(`/api/v1/observables?${params}`), enabled: !!authedLogin });

  const filteredCases = useMemo(() => localSearch(cases.data?.values ?? [], query, (item) => [item.title, item.owner, item.assignee, item.status, ...item.tags]), [cases.data?.values, query]);
  const filteredAlerts = useMemo(() => localSearch(alerts.data?.values ?? [], query, (item) => [item.title, item.source, item.source_ref, item.status, item.type, ...item.tags]), [alerts.data?.values, query]);
  const filteredObservables = useMemo(() => localSearch(observables.data?.values ?? [], query, (item) => [item.data_type, item.data, item.message, item.case_title, item.created_by, ...item.tags]), [observables.data?.values, query]);

  const activeCollection = activeTab === 'cases' ? cases.data : activeTab === 'alerts' ? alerts.data : observables.data;
  const activeTotal = activeCollection?.total ?? 0;
  const activeValues = activeTab === 'cases' ? filteredCases.length : activeTab === 'alerts' ? filteredAlerts.length : filteredObservables.length;
  const mode = activeCollection?.mode ?? cases.data?.mode ?? alerts.data?.mode ?? observables.data?.mode ?? 'demo-read-only';
  const canBulk = hasAnyPermission(me.data, ['manageCase', 'manageAlert', 'manageObservable']);

  function toggleSelected(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function switchTab(tab: Tab) { setActiveTab(tab); }
  function updateFilter(key: string, value: string) { setPage(0); setFilters((current) => ({ ...current, [key]: value })); }
  function toggleSort(field: string) { setSort((current) => ({ field, order: current.field === field && current.order === 'ASC' ? 'DESC' : 'ASC' })); }

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-none mx-auto">
            <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
              <div><h1 className="text-2xl font-light text-thehive-text">Investigation</h1><p className="text-sm text-thehive-muted mt-1">TheHive 4 parity workspace for cases, alerts, and observables.</p></div>
              <div className="flex items-center gap-2 flex-wrap"><span className="thehive-pill warn">Read-only shadow mode</span><span className="thehive-pill">{mode}</span></div>
            </div>
            {showStats && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 stats-panel"><CounterCard icon={<Briefcase size={18} />} label="Cases" value={cases.data?.total ?? 0} tone="red" /><CounterCard icon={<AlertTriangle size={18} />} label="Alerts" value={alerts.data?.total ?? 0} tone="orange" /><CounterCard icon={<Eye size={18} />} label="Observables" value={observables.data?.total ?? 0} tone="blue" /></div>}
            <div className="thehive-card mb-6">
              <div className="thehive-card-header flex items-center justify-between gap-3 flex-wrap">
                <div className="thehive-tabs"><button className={activeTab === 'cases' ? 'active' : ''} onClick={() => switchTab('cases')}>Cases</button><button className={activeTab === 'alerts' ? 'active' : ''} onClick={() => switchTab('alerts')}>Alerts</button><button className={activeTab === 'observables' ? 'active' : ''} onClick={() => switchTab('observables')}>Observables</button></div>
                <div className="thehive-toolbar"><button onClick={() => setShowStats((value) => !value)}><SlidersHorizontal size={13} /> Stats</button><button onClick={() => setShowFilters((value) => !value)}><Filter size={13} /> Filters</button><div className="relative w-full sm:w-80"><Search size={14} className="absolute left-3 top-2.5 text-thehive-muted" /><input className="thehive-input pl-9 py-1.5" placeholder={`Local search ${activeTab}`} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} /></div></div>
              </div>
              {showFilters && <FilterPanel activeTab={activeTab} filters={filters} onChange={updateFilter} />}
              <div className="thehive-filterbar"><span>{activeValues} shown / {activeTotal} total</span><span>range {(activeCollection?.range ?? [0, 0]).join(':')}</span><span>sort {activeCollection?.sort?.field ?? sort.field}:{activeCollection?.sort?.order ?? sort.order}</span><span>{selectedIds.length} selected</span><button disabled={!canBulk}>Merge</button><button disabled={!canBulk}>Close</button><button disabled={!canBulk}>Assign</button><button disabled={!canBulk}>Export</button><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button><button disabled={activeValues < pageSize} onClick={() => setPage((value) => value + 1)}>Next</button></div>
              <div className="thehive-card-body p-0 overflow-x-auto">
                {activeTab === 'cases' && (cases.isLoading ? <div className="thehive-empty m-4">Loading cases...</div> : cases.isError ? <div className="thehive-empty m-4">Unable to load cases</div> : <CaseTable values={filteredCases} selectedIds={selectedIds} onToggle={toggleSelected} onSort={toggleSort} />)}
                {activeTab === 'alerts' && (alerts.isLoading ? <div className="thehive-empty m-4">Loading alerts...</div> : alerts.isError ? <div className="thehive-empty m-4">Unable to load alerts</div> : <AlertTable values={filteredAlerts} selectedIds={selectedIds} onToggle={toggleSelected} onSort={toggleSort} />)}
                {activeTab === 'observables' && (observables.isLoading ? <div className="thehive-empty m-4">Loading observables...</div> : observables.isError ? <div className="thehive-empty m-4">Unable to load observables</div> : <ObservableTable values={filteredObservables} selectedIds={selectedIds} onToggle={toggleSelected} onSort={toggleSort} />)}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function FilterPanel({ activeTab, filters, onChange }: { activeTab: Tab; filters: Record<string, string>; onChange: (key: string, value: string) => void }) {
  return <div className="thehive-filter-panel"><div className="filter-title"><Filter size={14} /> Advanced filters</div><div className="filter-grid">
    {activeTab === 'cases' && <><SelectFilter label="Status" name="status" value={filters.status ?? ''} options={['Open', 'Resolved', 'Deleted']} onChange={onChange} /><SelectFilter label="Severity" name="severity" value={filters.severity ?? ''} options={[['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} /><SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} /><SelectFilter label="PAP" name="pap" value={filters.pap ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} /><TextFilter label="Assignee" name="assignee" value={filters.assignee ?? ''} onChange={onChange} /><TextFilter label="Owner" name="owner" value={filters.owner ?? ''} onChange={onChange} /></>}
    {activeTab === 'alerts' && <><SelectFilter label="Status" name="status" value={filters.status ?? ''} options={['New', 'Updated', 'Imported', 'Ignored']} onChange={onChange} /><SelectFilter label="Severity" name="severity" value={filters.severity ?? ''} options={[['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} /><SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} /><TextFilter label="Source" name="source" value={filters.source ?? ''} onChange={onChange} /><TextFilter label="Type" name="type" value={filters.type ?? ''} onChange={onChange} /></>}
    {activeTab === 'observables' && <><TextFilter label="Data type" name="dataType" value={filters.dataType ?? ''} onChange={onChange} /><SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} /><SelectFilter label="IOC" name="ioc" value={filters.ioc ?? ''} options={[['true', 'IOC only'], ['false', 'Non IOC']]} onChange={onChange} /><SelectFilter label="Sighted" name="sighted" value={filters.sighted ?? ''} options={[['true', 'Sighted'], ['false', 'Not sighted']]} onChange={onChange} /><TextFilter label="Created by" name="createdBy" value={filters.createdBy ?? ''} onChange={onChange} /></>}
    <TextFilter label="Tags" name="tags" value={filters.tags ?? ''} onChange={onChange} />
    <DateFilter label="Created from" name="createdFrom" value={filters.createdFrom ?? ''} onChange={onChange} />
    <DateFilter label="Created to" name="createdTo" value={filters.createdTo ?? ''} onChange={onChange} />
    {activeTab === 'cases' && <><DateFilter label="Updated from" name="updatedFrom" value={filters.updatedFrom ?? ''} onChange={onChange} /><DateFilter label="Updated to" name="updatedTo" value={filters.updatedTo ?? ''} onChange={onChange} /></>}
  </div><div className="filters-preview"><span><Tag size={13} /> Active backend filters</span>{Object.keys(filters).filter((key) => filters[key]).length ? <strong>{JSON.stringify(filters)}</strong> : <em>No backend filters</em>}</div></div>;
}

function TextFilter({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (key: string, value: string) => void }) { return <label className="filter-control"><span>{label}</span><input className="thehive-input py-1.5" placeholder={label} value={value} onChange={(event) => onChange(name, event.target.value)} /></label>; }
function DateFilter({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (key: string, value: string) => void }) { return <label className="filter-control"><span>{label}</span><input type="datetime-local" className="thehive-input py-1.5" value={toLocalDateInput(value)} onChange={(event) => onChange(name, event.target.value ? new Date(event.target.value).toISOString() : '')} /></label>; }
function SelectFilter({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: Array<string | [string, string]>; onChange: (key: string, value: string) => void }) { return <label className="filter-control"><span>{label}</span><select className="thehive-input py-1.5" value={value} onChange={(event) => onChange(name, event.target.value)}><option value="">Any</option>{options.map((option) => { const pair = Array.isArray(option) ? option : [option, option]; return <option key={pair[0]} value={pair[0]}>{pair[1]}</option>; })}</select></label>; }

function CaseTable({ values, selectedIds, onToggle, onSort }: { values: CaseSummary[]; selectedIds: string[]; onToggle: (id: string) => void; onSort: (field: string) => void }) {
  if (values.length === 0) return <div className="thehive-empty m-4">No records</div>;
  return <table className="thehive-table case-list legacy-case-list"><thead><tr><th className="tlp-head"></th><th className="w-10"><input type="checkbox" disabled /></th><th><button onClick={() => onSort('status')}>Status</button></th><th><button onClick={() => onSort('number')}># Number / Title</button></th><th className="text-center"><button onClick={() => onSort('severity')}>Severity</button></th><th>Details</th><th><button onClick={() => onSort('assignee')}>Assignee</button></th><th><button onClick={() => onSort('updated_at')}>Dates</button></th></tr></thead><tbody>{values.map((item) => <tr key={item.id}><td className={`tlp-bar bg-tlp-${item.tlp}`}></td><td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td><td className="case-status"><span className={item.status === 'Open' ? 'label label-danger' : 'label label-success'}>{item.status === 'Resolved' ? 'Closed' : item.status}</span><div className="duration"><Clock3 size={12} /> {ageLabel(item.updated_at)}</div></td><td><div className="case-title wrap"><a href="#">#{item.number} - {item.title}</a></div><TagList tags={item.tags} /></td><td className="text-center"><Severity value={item.severity} /></td><td className="details-stack"><span>{item.task_count} tasks</span><span>{item.observable_count} observables</span><span>{item.alert_count} alerts</span></td><td>{item.assignee || item.owner || 'None'}</td><td className="date-stack"><span>C. {formatDate(item.created_at)}</span><span>U. {formatDate(item.updated_at)}</span></td></tr>)}</tbody></table>;
}
function AlertTable({ values, selectedIds, onToggle, onSort }: { values: AlertSummary[]; selectedIds: string[]; onToggle: (id: string) => void; onSort: (field: string) => void }) {
  if (values.length === 0) return <div className="thehive-empty m-4">No records</div>;
  return <table className="thehive-table legacy-case-list"><thead><tr><th className="w-10"><input type="checkbox" disabled /></th><th><button onClick={() => onSort('severity')}>Severity</button></th><th>Read</th><th><button onClick={() => onSort('title')}>Title</button></th><th># Case</th><th><button onClick={() => onSort('type')}>Type</button></th><th><button onClick={() => onSort('source')}>Source</button></th><th>Reference</th><th>Observables</th><th><button onClick={() => onSort('created_at')}>Dates</button></th></tr></thead><tbody>{values.map((item) => <tr key={item.id}><td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td><td className="text-center"><Severity value={item.severity} /></td><td className="text-center"><span className={item.read ? 'label label-default' : 'label label-danger'}>{item.read ? 'Read' : 'Unread'}</span></td><td><div className="case-title wrap"><a href="#">{item.title}</a></div><TagList tags={item.tags} /></td><td className="text-center">{item.case_number ? <a href="#">#{item.case_number}</a> : <span className="label label-default">None</span>}</td><td><a href="#">{item.type}</a></td><td><a href="#">{item.source}</a></td><td><strong>{item.source_ref}</strong></td><td className="text-center">{item.observable_count}</td><td className="date-stack"><span>C. {formatDate(item.created_at)}</span><span>U. {formatDate(item.created_at)}</span></td></tr>)}</tbody></table>;
}
function ObservableTable({ values, selectedIds, onToggle, onSort }: { values: ObservableSummary[]; selectedIds: string[]; onToggle: (id: string) => void; onSort: (field: string) => void }) {
  if (values.length === 0) return <div className="thehive-empty m-4">No records</div>;
  return <table className="thehive-table legacy-case-list"><thead><tr><th className="w-10"><input type="checkbox" disabled /></th><th><button onClick={() => onSort('tlp')}>TLP</button></th><th>IOC</th><th><button onClick={() => onSort('data_type')}>Type</button></th><th><button onClick={() => onSort('data')}>Value</button></th><th>Case</th><th><button onClick={() => onSort('created_by')}>Created by</button></th><th><button onClick={() => onSort('created_at')}>Dates</button></th></tr></thead><tbody>{values.map((item) => <tr key={item.id}><td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td><td><span className={`tlp tlp-${item.tlp}`} /></td><td>{item.ioc && <CheckCircle2 size={14} className="inline text-yellow-600 mr-1" />}{item.sighted ? 'Sighted' : 'IOC'}</td><td><a href="#">{item.data_type}</a></td><td><div className="mono break-all">{item.data}</div><small>{item.message}</small><TagList tags={item.tags} /></td><td><a href="#">#{item.case_number}</a><br /><small>{item.case_title}</small></td><td>{item.created_by}</td><td className="date-stack"><span>C. {formatDate(item.created_at)}</span></td></tr>)}</tbody></table>;
}

function CounterCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: 'red' | 'orange' | 'blue' }) { return <div className={`thehive-card mini-stat mini-stat-${tone}`}><div className="thehive-card-body flex items-center gap-3"><div className="mini-stat-icon">{icon}</div><div><div className="text-xs uppercase tracking-wide">{label}</div><div className="text-xl font-light">{value}</div></div></div></div>; }
function Severity({ value }: { value: number }) { return <span className={`severity severity-${value}`}>{severityLabels[value] ?? 'Unknown'}</span>; }
function TagList({ tags }: { tags: string[] }) { return <div className="case-tags flexwrap mt-1"><span className="tag-icon"><Tag size={12} /></span>{tags.length === 0 ? <strong className="text-thehive-muted mr-1">None</strong> : tags.map((tag) => <span key={tag} className="tag-item">{tag}</span>)}</div>; }
function formatDate(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'None'; return dateFormatter.format(date); }
function ageLabel(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'unknown'; const hours = Math.max(1, Math.round((Date.now() - date.getTime()) / 36e5)); if (hours < 24) return `${hours}h`; return `${Math.round(hours / 24)}d`; }
function buildParams(page: number, sort: SortSpec, filters: Record<string, string>) { const params = new URLSearchParams(); params.set('range', `${page * pageSize}:${page * pageSize + pageSize - 1}`); params.set('sort', `${sort.field}:${sort.order}`); Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); }); return params.toString(); }
function localSearch<T>(values: T[], query: string, pick: (value: T) => string[]) { const q = query.toLowerCase().trim(); if (!q) return values; return values.filter((item) => pick(item).some((value) => value.toLowerCase().includes(q))); }
function toLocalDateInput(value: string) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function hasAnyPermission(user: User | undefined, permissions: string[]) { return !!user?.permissions?.some((permission) => permissions.includes(permission) || permission === 'manageConfig'); }
