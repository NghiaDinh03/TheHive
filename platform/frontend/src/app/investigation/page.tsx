'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, CheckCircle2, Clock3, Eye, Filter, Flag, Search, SlidersHorizontal, Tag } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { ApiError, apiFetch } from '@/lib/api';

type SortSpec = { field: string; order: 'ASC' | 'DESC' };
type Collection<T> = { values: T[]; total: number; mode: 'demo-read-only' | 'legacy-read-only' | 'postgres-read-only' | 'read-only'; range?: [number, number]; sort?: SortSpec; filters?: Record<string, string> };
type CaseSummary = { id: string; number: number; title: string; severity: number; tlp: number; pap: number; status: string; owner: string; assignee: string; tags: string[]; flag?: boolean; summary?: string; impact_status?: string; resolution_status?: string; case_template?: string; owning_organisation?: string; organisation_ids?: string[]; start_date?: string; end_date?: string; task_count: number; observable_count: number; alert_count: number; created_at: string; updated_at: string };
type AlertSummary = { id: string; title: string; type: string; source: string; source_ref: string; severity: number; tlp: number; pap?: number; status: string; read: boolean; follow?: boolean; flag?: boolean; external_link?: string; organisation_id?: string; case_template?: string; case_number?: number; observable_count: number; tags: string[]; last_sync_date?: string; created_at: string };
type ObservableSummary = { id: string; data_type: string; data: string; message: string; tlp: number; ioc: boolean; sighted: boolean; ignore_similarity?: boolean; attachment_id?: string; tags: string[]; case_id?: string; case_number: number; case_title: string; created_by: string; created_at: string };
type User = { login: string; name: string; permissions?: string[] };
type Tab = 'cases' | 'alerts' | 'observables';

export default function InvestigationPage() {
  return <Suspense fallback={<div className="thehive-empty m-4">Loading investigation workspace...</div>}><InvestigationWorkspace /></Suspense>;
}

const severityLabels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical', 4: 'Critical' };
const pageSize = 10;
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function InvestigationWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('cases');
  const [showFilters, setShowFilters] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortSpec>({ field: 'updated_at', order: 'DESC' });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'alerts' || tab === 'cases' || tab === 'observables') setActiveTab(tab);
  }, [searchParams]);

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

  const filteredCases = useMemo(() => localSearch(cases.data?.values ?? [], query, (item) => [item.title, item.summary ?? '', item.owner, item.assignee, item.status, item.case_template ?? '', ...item.tags]), [cases.data?.values, query]);
  const filteredAlerts = useMemo(() => localSearch(alerts.data?.values ?? [], query, (item) => [item.title, item.source, item.source_ref, item.status, item.type, item.case_template ?? '', ...item.tags]), [alerts.data?.values, query]);
  const filteredObservables = useMemo(() => localSearch(observables.data?.values ?? [], query, (item) => [item.data_type, item.data, item.message, item.case_title, item.created_by, ...item.tags]), [observables.data?.values, query]);

  const activeCollection = activeTab === 'cases' ? cases.data : activeTab === 'alerts' ? alerts.data : observables.data;
  const activeTotal = activeCollection?.total ?? 0;
  const activeValues = activeTab === 'cases' ? filteredCases.length : activeTab === 'alerts' ? filteredAlerts.length : filteredObservables.length;
  const mode = activeCollection?.mode ?? cases.data?.mode ?? alerts.data?.mode ?? observables.data?.mode ?? 'demo-read-only';
  const canBulk = hasAnyPermission(me.data, ['manageCase', 'manageAlert', 'manageObservable']);
  const selectedRows = selectedIds.length;

  function toggleSelected(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleSelectAll(values: { id: string }[]) {
    if (selectedIds.length === values.length) setSelectedIds([]);
    else setSelectedIds(values.map((v) => v.id));
  }
  function switchTab(tab: Tab) { setActiveTab(tab); router.replace(`/investigation?tab=${tab}`); }
  function updateFilter(key: string, value: string) { setPage(0); setFilters((current) => ({ ...current, [key]: value })); }
  function toggleSort(field: string) { setSort((current) => ({ field, order: current.field === field && current.order === 'ASC' ? 'DESC' : 'ASC' })); }
  function clearFilter(key: string) { setFilters((current) => { const next = { ...current }; delete next[key]; return next; }); }
  function clearAllFilters() { setFilters({}); }

  // Bulk close — mirrors legacy case bulk close
  const bulkClose = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedIds.map((id) => {
          if (activeTab === 'cases') return apiFetch(`/api/v1/cases/${id}/close`, { method: 'POST', json: { resolution_status: 'Indeterminate', summary: '' } });
          if (activeTab === 'alerts') return apiFetch(`/api/v1/alerts/${id}`, { method: 'PATCH', json: { status: 'Ignored' } });
          return apiFetch(`/api/v1/tasks/${id}`, { method: 'PATCH', json: { status: 'Cancel' } });
        })
      );
      const ok = results.filter(r => r.status === 'fulfilled').length;
      return { ok, total: selectedIds.length };
    },
    onSuccess: async (r) => {
      await queryClient.invalidateQueries();
      setSelectedIds([]);
      setBulkMessage(`Bulk close: ${r.ok}/${r.total} succeeded.`);
    },
    onError: () => setBulkMessage('Bulk close failed.'),
  });

  // Bulk export — download selected items as JSON
  const bulkExport = useCallback(async () => {
    const endpoint = activeTab === 'cases' ? '/api/v1/cases' : activeTab === 'alerts' ? '/api/v1/alerts' : '/api/v1/observables';
    const items = await Promise.all(selectedIds.map(id => apiFetch<Record<string, unknown>>(`${endpoint}/${id}`)));
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeTab}-export-${selectedIds.length}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setBulkMessage(`Exported ${selectedIds.length} ${activeTab}.`);
  }, [activeTab, selectedIds]);

  // Bulk assign
  const bulkAssign = useMutation({
    mutationFn: async () => {
      const endpoint = activeTab === 'cases' ? '/api/v1/cases' : '/api/v1/tasks';
      const results = await Promise.allSettled(
        selectedIds.map(id => apiFetch(`${endpoint}/${id}`, { method: 'PATCH', json: { assignee: bulkAssignee.trim() || null } }))
      );
      const ok = results.filter(r => r.status === 'fulfilled').length;
      return { ok, total: selectedIds.length };
    },
    onSuccess: async (r) => {
      await queryClient.invalidateQueries();
      setSelectedIds([]);
      setShowBulkAssign(false);
      setBulkAssignee('');
      setBulkMessage(`Bulk assign: ${r.ok}/${r.total} succeeded.`);
    },
    onError: () => setBulkMessage('Bulk assign failed.'),
  });

  if (!authedLogin) return null;

  const activeItems = activeTab === 'cases' ? filteredCases : activeTab === 'alerts' ? filteredAlerts : filteredObservables;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Investigation <small>cases, alerts and observables</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Investigation</li></ol>
          </section>
          <section className="content">
            {/* Mini stats panel — mirrors legacy mini-stats.html */}
            {showStats && (
              <div className="row stats-panel mb-s">
                <div className="col-md-4"><CounterCard icon={<Briefcase size={18} />} label="Cases" value={cases.data?.total ?? 0} tone="red" /></div>
                <div className="col-md-4"><CounterCard icon={<AlertTriangle size={18} />} label="Alerts" value={alerts.data?.total ?? 0} tone="orange" /></div>
                <div className="col-md-4"><CounterCard icon={<Eye size={18} />} label="Observables" value={observables.data?.total ?? 0} tone="blue" /></div>
              </div>
            )}

            <div className="row">
              <div className="col-md-12">
                <div className="box box-primary">
                  {/* Box header with tabs toolbar — mirrors legacy list/toolbar.html */}
                  <div className="box-header with-border">
                    <h3 className="box-title">
                      {activeTab === 'cases' && <>List of cases <span className="badge">{activeValues} of {activeTotal}</span></>}
                      {activeTab === 'alerts' && <>List of alerts <span className="badge">{activeValues} of {activeTotal}</span></>}
                      {activeTab === 'observables' && <>List of observables <span className="badge">{activeValues} of {activeTotal}</span></>}
                    </h3>
                    <div className="box-tools pull-right investigation-tools">
                      {/* Tab switcher */}
                      <div className="thehive-tabs compact">
                        <button className={activeTab === 'cases' ? 'active' : ''} onClick={() => switchTab('cases')}><Briefcase size={13} /> Cases</button>
                        <button className={activeTab === 'alerts' ? 'active' : ''} onClick={() => switchTab('alerts')}><AlertTriangle size={13} /> Alerts</button>
                        <button className={activeTab === 'observables' ? 'active' : ''} onClick={() => switchTab('observables')}><Eye size={13} /> Observables</button>
                      </div>
                      <button className={showStats ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-default'} onClick={() => setShowStats((v) => !v)}><SlidersHorizontal size={13} /> Stats</button>
                      <button className={showFilters ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-default'} onClick={() => setShowFilters((v) => !v)}><Filter size={13} /> Filters</button>
                      <div className="relative investigation-search">
                        <Search size={14} className="thehive-input-icon" />
                        <input className="thehive-input thehive-input-with-icon py-1.5" placeholder={`Search ${activeTab}`} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Bulk action toolbar — mirrors legacy toolbar bulk actions */}
                  <div className="thehive-filterbar adminlte-filterbar">
                    <span className="label label-default">{mode}</span>
                    <span>{activeValues} shown / {activeTotal} total</span>
                    <span>{selectedRows} selected</span>
                    <button className="btn btn-sm btn-default write-action" disabled={!canBulk || selectedRows === 0 || bulkClose.isPending} onClick={() => { if (confirm(`Close ${selectedRows} selected ${activeTab}?`)) bulkClose.mutate(); }}>
                      {bulkClose.isPending ? 'Closing…' : 'Close'}
                    </button>
                    <button className="btn btn-sm btn-default write-action" disabled={!canBulk || selectedRows === 0} onClick={() => setShowBulkAssign(!showBulkAssign)}>Assign</button>
                    <button className="btn btn-sm btn-default write-action" disabled={selectedRows === 0} onClick={() => void bulkExport()}>Export</button>
                    <button className="btn btn-sm btn-default" disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}>« Prev</button>
                    <button className="btn btn-sm btn-default" disabled={activeValues < pageSize} onClick={() => setPage((v) => v + 1)}>Next »</button>
                  </div>
                  {/* Bulk assign inline form */}
                  {showBulkAssign && (
                    <div className="filter-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px' }}>
                      <span className="text-sm">Assign {selectedRows} selected to:</span>
                      <input className="thehive-input py-1" placeholder="User login" value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)} style={{ maxWidth: 200 }} />
                      <button className="btn btn-sm btn-primary" disabled={!bulkAssignee.trim() || bulkAssign.isPending} onClick={() => bulkAssign.mutate()}>
                        {bulkAssign.isPending ? 'Assigning…' : 'Confirm'}
                      </button>
                      <button className="btn btn-sm btn-default" onClick={() => { setShowBulkAssign(false); setBulkAssignee(''); }}>Cancel</button>
                    </div>
                  )}
                  {/* Bulk message */}
                  {bulkMessage && (
                    <div className="alert alert-info alert-dismissible" style={{ margin: '4px 12px' }}>
                      {bulkMessage}
                      <button type="button" className="close" onClick={() => setBulkMessage(null)}>×</button>
                    </div>
                  )}

                  {/* Filter panel */}
                  {showFilters && <FilterPanel activeTab={activeTab} filters={filters} onChange={updateFilter} onClear={clearFilter} onClearAll={clearAllFilters} />}

                  {/* Active filter preview pills */}
                  {Object.keys(filters).filter((k) => filters[k]).length > 0 && (
                    <div className="row mt-xs">
                      <div className="col-md-12 clearfix">
                        <div className="filters-preview-pills">
                          {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} className="label label-info mr-xxs mb-xxs">
                              {k}: {v} <button className="label-close" onClick={() => clearFilter(k)}>×</button>
                            </span>
                          ))}
                          <button className="btn btn-xs btn-default" onClick={clearAllFilters}>Clear all</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data table */}
                  <div className="box-body no-padding overflow-x-auto">
                    {activeTab === 'cases' && (
                      cases.isLoading ? <div className="thehive-empty m-4">Loading cases...</div>
                      : cases.isError ? <LoadError entity="cases" error={cases.error} />
                      : <CaseTable values={filteredCases} selectedIds={selectedIds} onToggle={toggleSelected} onToggleAll={() => toggleSelectAll(filteredCases)} onSort={toggleSort} sortSpec={sort} />
                    )}
                    {activeTab === 'alerts' && (
                      alerts.isLoading ? <div className="thehive-empty m-4">Loading alerts...</div>
                      : alerts.isError ? <LoadError entity="alerts" error={alerts.error} />
                      : <AlertTable values={filteredAlerts} selectedIds={selectedIds} onToggle={toggleSelected} onToggleAll={() => toggleSelectAll(filteredAlerts)} onSort={toggleSort} sortSpec={sort} canManage={hasAnyPermission(me.data, ['manageAlert'])} />
                    )}
                    {activeTab === 'observables' && (
                      observables.isLoading ? <div className="thehive-empty m-4">Loading observables...</div>
                      : observables.isError ? <LoadError entity="observables" error={observables.error} />
                      : <ObservableTable values={filteredObservables} selectedIds={selectedIds} onToggle={toggleSelected} onToggleAll={() => toggleSelectAll(filteredObservables)} onSort={toggleSort} sortSpec={sort} />
                    )}
                  </div>

                  {/* Pagination footer */}
                  {activeItems.length > 0 && (
                    <div className="box-footer clearfix">
                      <ul className="pagination pagination-sm no-margin pull-right">
                        <li className={page === 0 ? 'disabled' : ''}><button onClick={() => setPage((v) => Math.max(0, v - 1))}>«</button></li>
                        <li className="active"><span>Page {page + 1}</span></li>
                        <li className={activeValues < pageSize ? 'disabled' : ''}><button onClick={() => setPage((v) => v + 1)}>»</button></li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

/* ─── Filter panel ─────────────────────────────────────────────────────────── */
function FilterPanel({ activeTab, filters, onChange, onClear, onClearAll }: {
  activeTab: Tab; filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: (key: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="thehive-filter-panel filter-panel">
      <div className="filter-title"><Filter size={14} /> Advanced filters
        <button className="btn btn-xs btn-default pull-right" onClick={onClearAll}>Clear all</button>
      </div>
      <div className="filter-grid">
        {activeTab === 'cases' && <>
          <SelectFilter label="Status" name="status" value={filters.status ?? ''} options={['Open', 'Resolved', 'Duplicated']} onChange={onChange} />
          <SelectFilter label="Severity" name="severity" value={filters.severity ?? ''} options={[['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <SelectFilter label="PAP" name="pap" value={filters.pap ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <TextFilter label="Assignee" name="assignee" value={filters.assignee ?? ''} onChange={onChange} />
          <TextFilter label="Owner" name="owner" value={filters.owner ?? ''} onChange={onChange} />
          <SelectFilter label="Flag" name="flag" value={filters.flag ?? ''} options={[['true', 'Flagged'], ['false', 'Not flagged']]} onChange={onChange} />
        </>}
        {activeTab === 'alerts' && <>
          <SelectFilter label="Status" name="status" value={filters.status ?? ''} options={['New', 'Updated', 'Imported', 'Ignored']} onChange={onChange} />
          <SelectFilter label="Severity" name="severity" value={filters.severity ?? ''} options={[['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <TextFilter label="Source" name="source" value={filters.source ?? ''} onChange={onChange} />
          <TextFilter label="Type" name="type" value={filters.type ?? ''} onChange={onChange} />
          <SelectFilter label="Read" name="read" value={filters.read ?? ''} options={[['true', 'Read'], ['false', 'Unread']]} onChange={onChange} />
          <SelectFilter label="Follow" name="follow" value={filters.follow ?? ''} options={[['true', 'Followed'], ['false', 'Not followed']]} onChange={onChange} />
        </>}
        {activeTab === 'observables' && <>
          <TextFilter label="Data type" name="dataType" value={filters.dataType ?? ''} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <SelectFilter label="IOC" name="ioc" value={filters.ioc ?? ''} options={[['true', 'IOC only'], ['false', 'Non IOC']]} onChange={onChange} />
          <SelectFilter label="Sighted" name="sighted" value={filters.sighted ?? ''} options={[['true', 'Sighted'], ['false', 'Not sighted']]} onChange={onChange} />
          <SelectFilter label="Similarity" name="ignoreSimilarity" value={filters.ignoreSimilarity ?? ''} options={[['false', 'Similarity on'], ['true', 'Ignore similarity']]} onChange={onChange} />
          <TextFilter label="Created by" name="createdBy" value={filters.createdBy ?? ''} onChange={onChange} />
        </>}
        <TextFilter label="Tags" name="tags" value={filters.tags ?? ''} onChange={onChange} />
        <DateFilter label="Created from" name="createdFrom" value={filters.createdFrom ?? ''} onChange={onChange} />
        <DateFilter label="Created to" name="createdTo" value={filters.createdTo ?? ''} onChange={onChange} />
        {activeTab === 'cases' && <>
          <DateFilter label="Updated from" name="updatedFrom" value={filters.updatedFrom ?? ''} onChange={onChange} />
          <DateFilter label="Updated to" name="updatedTo" value={filters.updatedTo ?? ''} onChange={onChange} />
        </>}
      </div>
    </div>
  );
}

function TextFilter({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (key: string, value: string) => void }) {
  return <label className="filter-control"><span>{label}</span><input className="thehive-input py-1.5" placeholder={label} value={value} onChange={(e) => onChange(name, e.target.value)} /></label>;
}
function DateFilter({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (key: string, value: string) => void }) {
  return <label className="filter-control"><span>{label}</span><input type="datetime-local" className="thehive-input py-1.5" value={toLocalDateInput(value)} onChange={(e) => onChange(name, e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>;
}
function SelectFilter({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: Array<string | [string, string]>; onChange: (key: string, value: string) => void }) {
  return <label className="filter-control"><span>{label}</span><select className="thehive-input py-1.5" value={value} onChange={(e) => onChange(name, e.target.value)}><option value="">Any</option>{options.map((o) => { const pair = Array.isArray(o) ? o : [o, o]; return <option key={pair[0]} value={pair[0]}>{pair[1]}</option>; })}</select></label>;
}

/* ─── Case table — mirrors case.list.html ───────────────────────────────────── */
function CaseTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec }: {
  values: CaseSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec;
}) {
  if (values.length === 0) return <div className="empty-message">No records</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <table className="table table-striped case-list">
      <thead>
        <tr>
          {/* TLP strip column */}
          <th style={{ width: 10 }} className="p-0"></th>
          <th style={{ width: 20 }}><input type="checkbox" checked={allSelected} onChange={onToggleAll} /></th>
          <th style={{ width: 100 }}><SortBtn field="status" label="Status" spec={sortSpec} onSort={onSort} /></th>
          <th>
            <SortBtn field="number" label="# Number" spec={sortSpec} onSort={onSort} />
            {' / '}
            <SortBtn field="title" label="Title" spec={sortSpec} onSort={onSort} />
          </th>
          <th style={{ width: 70 }}></th>
          <th style={{ width: 90, textAlign: 'center' }}><SortBtn field="severity" label="Severity" spec={sortSpec} onSort={onSort} /></th>
          <th style={{ width: 150 }}>Details</th>
          <th style={{ width: 90 }}><SortBtn field="assignee" label="Assignee" spec={sortSpec} onSort={onSort} /></th>
          <th style={{ width: 150 }}>
            Dates{' '}
            <SortBtn field="start_date" label="S." spec={sortSpec} onSort={onSort} />
            {' '}
            <SortBtn field="created_at" label="C." spec={sortSpec} onSort={onSort} />
            {' '}
            <SortBtn field="updated_at" label="U." spec={sortSpec} onSort={onSort} />
          </th>
        </tr>
      </thead>
      <tbody>
        {values.map((item) => (
          <tr key={item.id} className={item.flag ? 'tr-warning' : ''}>
            {/* TLP strip — bg-tlp-N left border */}
            <td className={`p-0 bg-tlp-${item.tlp} clickable`} style={{ width: 10 }}></td>
            <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>
            <td>
              <span className={caseStatusClass(item.status)}>{item.status}</span>
              <div className="duration text-muted"><Clock3 size={11} /> {ageLabel(item.updated_at)}</div>
            </td>
            <td>
              <div className="case-title wrap">
                <a href={`/cases/${item.id}`}>
                  {item.flag && <Flag size={12} className="inline text-red-600 mr-1" />}
                  #{item.number} - {item.title}
                </a>
              </div>
              {item.summary && <small className="case-summary text-muted">{item.summary}</small>}
              <TagList tags={item.tags} />
            </td>
            <td></td>
            <td className="text-center"><Severity value={item.severity} /></td>
            <td className="details-stack">
              <span>{item.task_count} tasks · {item.observable_count} obs · {item.alert_count} alerts</span>
              <span>TLP:{item.tlp} · PAP:{item.pap}</span>
              <span>{item.impact_status ?? 'NoImpact'} / {item.resolution_status ?? 'Indeterminate'}</span>
              <span className="text-muted">{item.case_template ?? 'No template'}</span>
            </td>
            <td>{item.assignee || item.owner || <em className="text-muted">None</em>}</td>
            <td className="date-stack">
              <div className={sortSpec.field === 'start_date' ? 'text-bold' : ''}>S. {formatDate(item.start_date ?? item.created_at)}</div>
              <div className={sortSpec.field === 'created_at' ? 'text-bold' : ''}>C. {formatDate(item.created_at)}</div>
              <div className={sortSpec.field === 'updated_at' ? 'text-bold' : ''}>U. {formatDate(item.updated_at)}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Alert table — mirrors alert/list.html ─────────────────────────────────── */
function AlertTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec, canManage }: {
  values: AlertSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec; canManage: boolean;
}) {
  if (values.length === 0) return <div className="empty-message">No records</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <table className="table tbody-stripped case-list">
      <thead>
        <tr>
          {canManage && <th style={{ width: 20 }}><input type="checkbox" checked={allSelected} onChange={onToggleAll} /></th>}
          <th style={{ width: 80 }}><SortBtn field="severity" label="Severity" spec={sortSpec} onSort={onSort} /></th>
          <th style={{ width: 80, textAlign: 'center' }}><SortBtn field="read" label="Read" spec={sortSpec} onSort={onSort} /></th>
          <th>Title</th>
          <th style={{ width: 80, textAlign: 'center' }}># Case</th>
          <th style={{ width: 80 }}><SortBtn field="type" label="Type" spec={sortSpec} onSort={onSort} /></th>
          <th style={{ width: 150 }}><SortBtn field="source" label="Source" spec={sortSpec} onSort={onSort} /></th>
          <th style={{ width: 150 }}><SortBtn field="sourceRef" label="Reference" spec={sortSpec} onSort={onSort} /></th>
          <th style={{ width: 80 }}>Observables</th>
          <th style={{ width: 150 }}>
            Dates{' '}
            <SortBtn field="date" label="O." spec={sortSpec} onSort={onSort} />
            {' '}
            <SortBtn field="created_at" label="C." spec={sortSpec} onSort={onSort} />
            {' '}
            <SortBtn field="updated_at" label="U." spec={sortSpec} onSort={onSort} />
          </th>
          <th style={{ width: 160 }}></th>
        </tr>
      </thead>
      <tbody>
        {values.map((item) => (
          <tr key={item.id}>
            {canManage && <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>}
            <td className="text-center"><Severity value={item.severity} /></td>
            <td className="text-center">
              <span className={item.read ? 'label label-default clickable' : 'label label-danger clickable'}>
                {item.read ? 'Read' : 'Unread'}
              </span>
            </td>
            <td className="wrap">
              <div className="case-title">
                {item.case_number
                  ? <a href={`/alerts/${item.id}`}>{item.flag && <Flag size={12} className="inline text-red-600 mr-1" />}{item.title}</a>
                  : <a href={`/alerts/${item.id}`}>{item.flag && <Flag size={12} className="inline text-red-600 mr-1" />}{item.title}</a>
                }
              </div>
              <TagList tags={item.tags} />
            </td>
            <td>
              {item.case_number
                ? <div className="text-center"><a href="#">#{item.case_number}</a></div>
                : <div className="text-center"><span className="label label-default clickable">None</span></div>
              }
            </td>
            <td><a href="#">{item.type}</a></td>
            <td><a href="#">{item.source}</a></td>
            <td className="wrap">
              <strong>
                {item.source_ref}
                {item.external_link && (
                  <span className="pl-xxs">
                    <a href={item.external_link} target="_blank" rel="noopener noreferrer" title="Open alert external link">
                      <i className="fa fa-external-link"></i>
                    </a>
                  </span>
                )}
              </strong>
            </td>
            <td className="text-center">{item.observable_count ?? 0}</td>
            <td>
              <div className={sortSpec.field === 'date' ? 'text-bold' : ''}>O. <a href="#">{formatDate(item.last_sync_date ?? item.created_at)}</a></div>
              <div className={sortSpec.field === 'created_at' ? 'text-bold' : ''}>C. <a href="#">{formatDate(item.created_at)}</a></div>
            </td>
            <td className="clearfix">
              {/* Action icons per row — mirrors legacy alert list action buttons */}
              <div className="pull-right">
                {canManage && (
                  <>
                    <button className="btn btn-icon btn-clear" title={item.follow ? 'Ignore new updates' : 'Track new updates'}>
                      {item.follow ? <Eye size={14} className="text-info" /> : <Eye size={14} className="text-muted" />}
                    </button>
                    {item.read
                      ? <button className="btn btn-icon btn-clear" title="Mark as unread"><i className="fa fa-envelope-open-o text-info"></i></button>
                      : <button className="btn btn-icon btn-clear" title="Mark as read"><i className="fa fa-envelope text-info"></i></button>
                    }
                  </>
                )}
                <a className="btn btn-icon btn-clear" href={`/alerts/${item.id}`} title={item.case_number ? 'Preview' : 'Preview and Import'}>
                  <i className="fa fa-file-text-o text-info"></i>
                </a>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Observable table ──────────────────────────────────────────────────────── */
function ObservableTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec }: {
  values: ObservableSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec;
}) {
  if (values.length === 0) return <div className="empty-message">No records</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <table className="table table-striped case-list">
      <thead>
        <tr>
          <th style={{ width: 20 }}><input type="checkbox" checked={allSelected} onChange={onToggleAll} /></th>
          <th><SortBtn field="tlp" label="TLP" spec={sortSpec} onSort={onSort} /></th>
          <th>Flags</th>
          <th><SortBtn field="data_type" label="Type" spec={sortSpec} onSort={onSort} /></th>
          <th><SortBtn field="data" label="Value" spec={sortSpec} onSort={onSort} /></th>
          <th>Case</th>
          <th><SortBtn field="created_by" label="Created by" spec={sortSpec} onSort={onSort} /></th>
          <th><SortBtn field="created_at" label="Dates" spec={sortSpec} onSort={onSort} /></th>
        </tr>
      </thead>
      <tbody>
        {values.map((item) => (
          <tr key={item.id} className={selectedIds.includes(item.id) ? 'selected-row' : ''}>
            <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>
            <td><span className={`tlp tlp-${item.tlp}`} /></td>
            <td className="details-stack">
              <span>{item.ioc ? <CheckCircle2 size={13} className="inline text-yellow-600 mr-1" /> : null}{item.ioc ? 'IOC' : 'Non IOC'}</span>
              <span>{item.sighted ? 'Sighted' : 'Not sighted'}</span>
              <span>{item.ignore_similarity ? 'Ignore similarity' : 'Similarity on'}</span>
            </td>
            <td>
              <a href={`/observables/${item.id}`}>{item.data_type}</a>
              {item.attachment_id && <div><span className="label label-default">file</span></div>}
            </td>
            <td>
              <div className="mono break-all">{item.data}</div>
              <small className="text-muted">{item.message}</small>
              <TagList tags={item.tags} />
            </td>
            <td>{item.case_id ? <a href={`/cases/${item.case_id}`}>#{item.case_number}</a> : <span>#{item.case_number}</span>}<br /><small className="text-muted">{item.case_title}</small></td>
            <td>{item.created_by}</td>
            <td className="date-stack"><div>C. {formatDate(item.created_at)}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Shared helpers ────────────────────────────────────────────────────────── */
function LoadError({ entity, error }: { entity: string; error: unknown }) {
  const detail = error instanceof ApiError && error.status === 401
    ? 'Session expired. Sign out and log in again.'
    : error instanceof Error ? error.message : `Unable to load ${entity}`;
  return <div className="empty-message m-4"><strong>Unable to load {entity}</strong><br /><span>{detail}</span></div>;
}

function CounterCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: 'red' | 'orange' | 'blue' }) {
  return (
    <div className={`thehive-card mini-stat mini-stat-${tone}`}>
      <div className="thehive-card-body flex items-center gap-3">
        <div className="mini-stat-icon">{icon}</div>
        <div><div className="text-xs uppercase tracking-wide">{label}</div><div className="text-xl font-light">{value}</div></div>
      </div>
    </div>
  );
}

function SortBtn({ field, label, spec, onSort }: { field: string; label: string; spec: SortSpec; onSort: (f: string) => void }) {
  const active = spec.field === field;
  return (
    <button className="text-default sort-btn" onClick={() => onSort(field)}>
      {label}{' '}
      {active
        ? spec.order === 'ASC' ? <i className="fa fa-caret-up"></i> : <i className="fa fa-caret-down"></i>
        : <i className="fa fa-sort"></i>
      }
    </button>
  );
}

function Severity({ value }: { value: number }) {
  return <span className={`severity severity-${value}`}>{severityLabels[value] ?? 'Unknown'}</span>;
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="case-tags flexwrap mt-1">
      <span className="tag-icon"><Tag size={11} /></span>
      {tags.map((tag) => <span key={tag} className="tag-item">{tag}</span>)}
    </div>
  );
}

function caseStatusClass(status: string) {
  if (status === 'Open') return 'label label-danger';
  if (status === 'Duplicated') return 'label label-warning';
  return 'label label-success';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'None';
  return dateFormatter.format(date);
}

function ageLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const hours = Math.max(1, Math.round((Date.now() - date.getTime()) / 36e5));
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function buildParams(page: number, sort: SortSpec, filters: Record<string, string>) {
  const params = new URLSearchParams();
  params.set('range', `${page * pageSize}:${page * pageSize + pageSize - 1}`);
  params.set('sort', `${sort.field}:${sort.order}`);
  Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
  return params.toString();
}

function localSearch<T>(values: T[], query: string, pick: (value: T) => string[]) {
  const q = query.toLowerCase().trim();
  if (!q) return values;
  return values.filter((item) => pick(item).some((v) => v.toLowerCase().includes(q)));
}

function toLocalDateInput(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function hasAnyPermission(user: User | undefined, permissions: string[]) {
  return !!user?.permissions?.some((p) => permissions.includes(p) || p === 'managePlatform');
}
