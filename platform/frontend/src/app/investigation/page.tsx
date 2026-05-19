'use client';

import type { ChangeEvent } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, CheckCircle2, Clock3, Eye, Filter, Flag, Search, Tag, Info } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { InfoTooltip } from '@/components/ui/TooltipHelper';
import { TooltipProvider } from '@/components/ui/tooltip';
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
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function InvestigationWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('cases');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortSpec>({ field: 'updated_at', order: 'DESC' });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [showBulkClose, setShowBulkClose] = useState(false);
  const [bulkCloseStatus, setBulkCloseStatus] = useState('TruePositive');
  const [bulkCloseReason, setBulkCloseReason] = useState('');

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'alerts' || tab === 'cases' || tab === 'observables') setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
    setSort({ field: activeTab === 'cases' ? 'number' : 'created_at', order: 'DESC' });
    setFilters(activeTab === 'cases' ? { status: '_active' } : {});
  }, [activeTab]);

  const params = useMemo(() => buildParams(page, pageSize, sort, filters), [page, pageSize, sort, filters]);
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const cases = useQuery({ queryKey: ['cases', params], queryFn: () => apiFetch<Collection<CaseSummary>>(`/api/v1/cases?${params}`), enabled: !!authedLogin });
  const alerts = useQuery({ queryKey: ['alerts', params], queryFn: () => apiFetch<Collection<AlertSummary>>(`/api/v1/alerts?${params}`), enabled: !!authedLogin });
  const observables = useQuery({ queryKey: ['observables', params], queryFn: () => apiFetch<Collection<ObservableSummary>>(`/api/v1/observables?${params}`), enabled: !!authedLogin });

  const closedStatuses = ['closed', 'resolved', 'true positive', 'false positive'];
  const filteredCases = useMemo(() => {
    let items = localSearch(cases.data?.values ?? [], query, (item) => [item.title, item.summary ?? '', item.owner, item.assignee, item.status, item.case_template ?? '', ...item.tags]);
    if (filters.status === '_active') items = items.filter(c => !closedStatuses.includes(c.status.toLowerCase()));
    return items;
  }, [cases.data?.values, query, filters.status]);
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

  const searchUsersQuery = useQuery({ 
    queryKey: ['users', bulkAssignee], 
    queryFn: () => apiFetch<{login: string; name: string}[]>(`/api/v1/users/search?query=${encodeURIComponent(bulkAssignee)}`), 
    enabled: !!authedLogin && showBulkAssign 
  });

  const suggestedUsers = useMemo(() => {
    const users = new Set<string>();
    
    // Add users from the API search results (already filtered for locked=false by backend)
    if (searchUsersQuery.data) {
      searchUsersQuery.data.forEach(u => users.add(u.login));
    }
    
    // Add current user as fallback if it matches the search term
    if (authedLogin && authedLogin.toLowerCase().includes(bulkAssignee.toLowerCase())) {
      users.add(authedLogin);
    }
    
    return Array.from(users).filter(Boolean).sort();
  }, [searchUsersQuery.data, authedLogin, bulkAssignee]);

  // Bulk close — mirrors legacy case bulk close
  const bulkClose = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedIds.map((id) => {
          if (activeTab === 'cases') return apiFetch(`/api/v1/cases/${id}/close`, { method: 'POST', json: { resolution_status: bulkCloseStatus, summary: bulkCloseReason } });
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
      setShowBulkClose(false);
      setBulkCloseReason('');
      setBulkMessage(`Bulk close: ${r.ok}/${r.total} succeeded.`);
    },
    onError: () => setBulkMessage('Bulk close failed.'),
  });

  // Bulk export — download selected items as JSON
  const bulkExport = useCallback(async () => {
    const endpoint = activeTab === 'cases' ? '/api/v1/cases' : activeTab === 'alerts' ? '/api/v1/alerts' : '/api/v1/observables';
    const items = await Promise.all(selectedIds.map(id => apiFetch<any>(`${endpoint}/${id}`)));
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
    <div className="flex min-h-screen bg-transparent relative">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 z-0">
        <TooltipProvider delayDuration={200}>
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="flex-1 overflow-x-hidden">
          <section className="p-6 max-w-[1600px] mx-auto w-full">


            <div className="flex flex-col gap-6">
              
              {/* === FRAME 1 (TOP): Header & Advanced Filters === */}
              <div className="glass-panel flex flex-col rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] border border-slate-700/80 anim-fade-in bg-slate-800/20">
                {/* Header: Title + Tabs + Search */}
                <div className="px-5 py-3 flex flex-wrap gap-2 justify-between items-center bg-slate-800/40">
                  <h3 className="text-blue-400 font-medium text-lg flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    {activeTab === 'cases' && <>Cases <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                    {activeTab === 'alerts' && <>Alerts <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                    {activeTab === 'observables' && <>Observables <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex glass-surface rounded-lg p-1">
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'cases' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('cases')}><Briefcase size={14} /> Cases</button>
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'alerts' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('alerts')}><AlertTriangle size={14} /> Alerts</button>
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'observables' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('observables')}><Eye size={14} /> Observables</button>
                    </div>
                    <button className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 font-medium border ${showFilters ? 'bg-blue-600 border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'glass-surface text-slate-400 hover:text-slate-200'}`} onClick={() => setShowFilters((v) => !v)} title="Toggle advanced filter panel"><Filter size={14} /> Filters</button>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input className="glass-input w-64 pl-9 pr-4 py-2" placeholder={`Search ${activeTab}...`} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Advanced Filter Frame */}
                <div className="flex flex-col bg-slate-900/40">
                  <div 
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors select-none"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <div className="flex items-center gap-2 text-blue-400">
                      <Filter size={16} />
                      <span className="font-bold text-base text-slate-200">Advanced filters</span>
                      {Object.keys(filters).length > 0 && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                          {Object.keys(filters).length} active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {Object.keys(filters).length > 0 && (
                        <button 
                          className="px-3 py-1 glass-surface hover:bg-white/10 rounded-md text-slate-300 text-xs font-medium transition-colors"
                          onClick={(e) => { e.stopPropagation(); clearAllFilters(); }}
                        >
                          Clear all
                        </button>
                      )}
                      <i className={`fa fa-chevron-${showFilters ? 'up' : 'down'} text-slate-500 text-xs`}></i>
                    </div>
                  </div>
                  
                  {showFilters && (
                    <div className="px-5 py-5 glass-surface anim-slide-up">
                      <FilterPanel activeTab={activeTab} filters={filters} onChange={updateFilter} />
                    </div>
                  )}
                </div>
              </div>

              {/* === FRAME 2 (BOTTOM): Action Toolbar & Data Table === */}
              <div className="glass-panel flex flex-col rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] border border-slate-700/80 anim-slide-up bg-slate-900/40">
                
                {/* Unified Action Toolbar */}
                <div className="bg-slate-800/40 px-5 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-sm text-slate-300">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    <span className="font-medium text-slate-200">{activeValues} shown <span className="mx-2 text-slate-600">|</span> <span className={selectedRows > 0 ? "text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]" : "text-slate-500"}>{selectedRows} selected</span></span>
                    
                    {Object.keys(filters).filter((k) => filters[k] && !k.startsWith('_')).length > 0 && (
                      <>
                        <span className="text-slate-600 mx-1 hidden sm:inline">|</span>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active:</span>
                          {Object.entries(filters).filter(([k, v]) => v && !k.startsWith('_')).map(([k, v]) => (
                            <span key={k} className="flex items-center gap-1.5 px-2 py-0.5 text-xs bg-blue-500/20 border border-blue-500/30 text-blue-200 rounded-full font-medium shadow-[0_0_8px_rgba(59,130,246,0.15)]">
                              {k}: {v} <button className="hover:text-white ml-0.5" onClick={() => clearFilter(k)}>×</button>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className={`font-medium transition-all shadow-sm ${selectedRows > 0 ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-60'}`} disabled={!canBulk || selectedRows === 0 || bulkClose.isPending} onClick={() => setShowBulkClose(true)} title="Close selected items">
                      {bulkClose.isPending ? 'Closing…' : 'Close'}
                    </Button>
                    <Button variant="outline" size="sm" className={`font-medium transition-all shadow-sm ${selectedRows > 0 ? 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-60'}`} disabled={!canBulk || selectedRows === 0} onClick={() => { if (!bulkAssignee) setBulkAssignee(authedLogin || ''); setShowBulkAssign(true); }} title="Assign selected items to a user">Assign</Button>
                    <Button variant="outline" size="sm" className={`font-medium transition-all shadow-sm ${selectedRows > 0 ? 'bg-slate-700/80 hover:bg-slate-600 border-slate-500 text-white' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-60'}`} disabled={selectedRows === 0} onClick={() => void bulkExport()} title="Export selected items as JSON">Export</Button>
                  </div>
                </div>

                {/* Bulk Close Dialog */}
                <Dialog open={showBulkClose} onOpenChange={setShowBulkClose}>
                  <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-300 sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-red-400">Close {selectedRows} {activeTab}</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Select a resolution status and provide a summary reason.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                        <select className="glass-select py-2 w-full" value={bulkCloseStatus} onChange={e => setBulkCloseStatus(e.target.value)}>
                          <option value="True positive">True positive</option>
                          <option value="False positive">False positive</option>
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reason (Summary)</label>
                        <input className="glass-input py-2 w-full" placeholder="Resolution summary" value={bulkCloseReason} onChange={e => setBulkCloseReason(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => { setShowBulkClose(false); setBulkCloseReason(''); }} className="text-slate-400 hover:text-slate-300 hover:bg-white/10">Cancel</Button>
                      <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white shadow-sm" disabled={bulkClose.isPending} onClick={() => { bulkClose.mutate(); setShowBulkClose(false); }}>
                        {bulkClose.isPending ? 'Processing…' : 'Confirm Close'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Bulk Assign Dialog */}
                <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
                  <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-300 sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-blue-400">Assign {selectedRows} {activeTab}</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Enter the user login to assign these items to.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2 relative">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assignee Login</label>
                        <input 
                          className="glass-input py-2 w-full" 
                          placeholder="User login (e.g. admin@ncsgroup.vn)" 
                          value={bulkAssignee} 
                          onChange={e => { setBulkAssignee(e.target.value); setShowUserDropdown(true); }}
                          onFocus={() => setShowUserDropdown(true)}
                          onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                        />
                        {showUserDropdown && suggestedUsers.length > 0 && (
                          <div className="absolute top-[100%] left-0 w-full mt-1 bg-slate-800 border border-slate-700/80 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-[100] max-h-48 overflow-y-auto glass-scroll py-1">
                            {suggestedUsers.map(u => (
                              <div
                                key={u}
                                className="px-3 py-2 text-sm text-slate-300 hover:bg-blue-600/30 hover:text-blue-300 cursor-pointer transition-colors"
                                onMouseDown={(e) => { e.preventDefault(); setBulkAssignee(u); setShowUserDropdown(false); }}
                              >
                                {u}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setShowBulkAssign(false)} className="text-slate-400 hover:text-slate-300 hover:bg-white/10">Cancel</Button>
                      <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" disabled={!bulkAssignee.trim() || bulkAssign.isPending} onClick={() => { bulkAssign.mutate(); setShowBulkAssign(false); }}>
                        {bulkAssign.isPending ? 'Assigning…' : 'Confirm Assign'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                {/* Bulk message */}
                {bulkMessage && (
                  <div className="mb-4 px-4 py-3 glass-surface border border-blue-500/30 text-blue-300 rounded-md text-sm flex justify-between items-center anim-fade-in">
                    <span>{bulkMessage}</span>
                    <button type="button" className="text-blue-400 hover:text-blue-200 ml-3 text-lg" onClick={() => setBulkMessage(null)}>&times;</button>
                  </div>
                )}

                  {/* Data table & Pagination Container */}
                  <div className="flex flex-col overflow-hidden">
                    <div className="overflow-x-auto glass-scroll flex-1">
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
                      <div className="px-5 py-3 bg-slate-900/60 flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Page {page + 1}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <select className="glass-select py-1 pl-2 pr-6" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                          </div>
                          <div className="flex glass-surface rounded-md overflow-hidden">
                            <button className={`px-3 py-1.5 text-sm font-medium ${page === 0 ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}>« Prev</button>
                            <button className={`px-3 py-1.5 text-sm font-medium border-l border-white/10 ${activeValues < pageSize ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} disabled={activeValues < pageSize} onClick={() => setPage((v) => v + 1)}>Next »</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </section>
        </main>
        </TooltipProvider>
      </div>
    </div>
  );
}

/* ─── Filter panel ─────────────────────────────────────────────────────────── */
function FilterPanel({ activeTab, filters, onChange }: {
  activeTab: Tab; filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-6">
        {activeTab === 'cases' && <>
          <SelectFilter label="Status" name="status" tooltip="Filter by current SOC workflow state" value={filters.status ?? ''} options={[['_active', 'Active (non-closed)'], 'Open', 'InProgress', 'Resolved', 'Closed', 'Duplicated', 'True positive', 'False positive', 'Need confirm', 'Incidents']} onChange={onChange} />
          <SelectFilter label="Severity" name="severity" tooltip="The potential impact level of the case" value={filters.severity ?? ''} options={[['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" tooltip="Traffic Light Protocol sharing boundaries" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <SelectFilter label="PAP" name="pap" tooltip="Permissible Actions Protocol constraints" value={filters.pap ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
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

function TextFilter({ label, name, value, tooltip, onChange }: { label: string; name: string; value: string; tooltip?: string; onChange: (key: string, value: string) => void }) {
  return <label className="flex flex-col gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{label} {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}</span><input className="glass-input bg-slate-900/50 border-slate-700/50 text-sm py-2 px-3 focus:bg-slate-800 focus:border-blue-500/50 transition-all rounded-md w-full" placeholder={label} value={value} onChange={(e) => onChange(name, e.target.value)} /></label>;
}
function DateFilter({ label, name, value, tooltip, onChange }: { label: string; name: string; value: string; tooltip?: string; onChange: (key: string, value: string) => void }) {
  return <label className="flex flex-col gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{label} {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}</span><input type="datetime-local" className="glass-input bg-slate-900/50 border-slate-700/50 text-sm py-2 px-3 focus:bg-slate-800 focus:border-blue-500/50 transition-all rounded-md w-full" value={toLocalDateInput(value)} onChange={(e) => onChange(name, e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>;
}
function SelectFilter({ label, name, value, options, tooltip, onChange }: { label: string; name: string; value: string; tooltip?: string; options: Array<string | [string, string]>; onChange: (key: string, value: string) => void }) {
  return <label className="flex flex-col gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{label} {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}</span><select className="glass-select bg-slate-900/50 border-slate-700/50 text-sm py-2 px-3 focus:bg-slate-800 focus:border-blue-500/50 transition-all rounded-md w-full" value={value} onChange={(e) => onChange(name, e.target.value)}><option value="">Any</option>{options.map((o) => { const pair = Array.isArray(o) ? o : [o, o]; return <option key={pair[0]} value={pair[0]}>{pair[1]}</option>; })}</select></label>;
}

/* ─── Case table — mirrors case.list.html ───────────────────────────────────── */
function CaseTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec }: {
  values: CaseSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec;
}) {
  if (values.length === 0) return <div className="text-center py-10 text-slate-500">No records</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-950/60 border-b-0 text-slate-300 text-sm font-bold uppercase tracking-wider">
            <th className="w-1.5 p-0"></th>
            <th className="w-12 px-4 py-4"><input type="checkbox" className="bg-slate-800/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={allSelected} onChange={onToggleAll} /></th>
            <th className="w-32 px-4 py-4"><SortBtn field="status" label="Status" tooltip="Current SOC workflow phase" spec={sortSpec} onSort={onSort} /></th>
            <th className="px-4 py-4 min-w-[300px]">
              <div className="flex items-center gap-1.5">
                <SortBtn field="number" label="# Number" tooltip="Unique case identifier" spec={sortSpec} onSort={onSort} />
                <span className="text-slate-600">/</span>
                <SortBtn field="title" label="Title" tooltip="Brief incident description" spec={sortSpec} onSort={onSort} />
              </div>
            </th>
            <th className="w-24 px-4 py-4 text-center"><SortBtn field="severity" label="Severity" tooltip="Potential impact level" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-48 px-4 py-4">Details <InfoTooltip content="Tasks, observables, and impact summary"><span className="cursor-help inline-flex ml-0.5"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip></th>
            <th className="w-40 px-4 py-4"><SortBtn field="assignee" label="Assignee" tooltip="SOC Analyst handling this case" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-32 px-4 py-4 text-right">
              <SortBtn field="updated_at" label="Updated" tooltip="Last modification timestamp" spec={sortSpec} onSort={onSort} />
            </th>
          </tr>
        </thead>
        <tbody className="text-sm bg-slate-900/40">
          {values.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/60 transition-colors group">
              <td className={`p-0 bg-tlp-${item.tlp} w-1.5`}></td>
              <td className="px-4 py-4"><input type="checkbox" className="bg-slate-900/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>
              <td className="px-4 py-4">
                <span className={caseStatusClass(item.status)}>{item.status}</span>
                <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-2"><Clock3 size={12} /> {ageLabel(item.updated_at)}</div>
              </td>
              <td className="px-4 py-4 whitespace-normal">
                <div className="font-semibold text-base text-blue-400 hover:text-blue-300 transition-colors">
                  <a href={`/cases/${item.id}`}>
                    {item.flag && <Flag size={14} className="inline text-red-500 mr-1.5" />}
                    #{String(item.number).padStart(7, '0')} - {item.title}
                  </a>
                </div>
                <div className="text-slate-400 text-xs mt-1.5">
                  <span className="font-medium text-slate-300">{item.owning_organisation || 'Default Tenant'}</span>
                </div>
                {item.summary && <div className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">{item.summary}</div>}
                <div className="mt-2"><TagList tags={item.tags} /></div>
              </td>
              <td className="px-4 py-4 text-center"><Severity value={item.severity} /></td>
              <td className="px-4 py-4 text-slate-400">
                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-300 font-medium">{item.task_count} tasks · {item.observable_count} obs · {item.alert_count} alerts</span>
                  <span className="text-xs text-slate-500">{item.impact_status ?? 'NoImpact'} / {item.resolution_status ?? 'Indeterminate'}</span>
                </div>
              </td>
              <td className="px-4 py-4 text-slate-300">{item.assignee || item.owner || <em className="text-slate-500">None</em>}</td>
              <td className="px-4 py-4 text-right text-slate-400 whitespace-nowrap">
                {formatDate(item.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Alert table — mirrors alert/list.html ─────────────────────────────────── */
function AlertTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec, canManage }: {
  values: AlertSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec; canManage: boolean;
}) {
  if (values.length === 0) return <div className="text-center py-10 text-slate-500">No records</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-950/60 border-b-0 text-slate-300 text-sm font-bold uppercase tracking-wider">
            {canManage && <th className="w-12 px-4 py-4"><input type="checkbox" className="bg-slate-800/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={allSelected} onChange={onToggleAll} /></th>}
            <th className="w-24 px-4 py-4 text-center"><SortBtn field="severity" label="Severity" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-20 px-4 py-4 text-center"><SortBtn field="read" label="Read" spec={sortSpec} onSort={onSort} /></th>
            <th className="px-4 py-4 min-w-[200px]">Title</th>
            <th className="w-28 px-4 py-4 text-center"># Case</th>
            <th className="w-32 px-4 py-4"><SortBtn field="type" label="Type" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-36 px-4 py-4"><SortBtn field="source" label="Source" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-48 px-4 py-4"><SortBtn field="sourceRef" label="Reference" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-28 px-4 py-4 text-center">Observables</th>
            <th className="w-32 px-4 py-4 text-right">
              <SortBtn field="created_at" label="Created" spec={sortSpec} onSort={onSort} />
            </th>
            <th className="w-28 px-4 py-4"></th>
          </tr>
        </thead>
        <tbody className="text-sm bg-slate-900/40">
          {values.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/60 transition-colors group">
              {canManage && <td className="px-4 py-4"><input type="checkbox" className="bg-slate-900/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>}
              <td className="px-4 py-4 text-center"><Severity value={item.severity} /></td>
              <td className="px-4 py-4 text-center">
                <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${item.read ? 'bg-slate-700/40 text-slate-400 border border-white/5' : 'bg-red-600 border border-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}>
                  {item.read ? 'Read' : 'Unread'}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-normal">
                <div className="font-semibold text-base text-blue-400 hover:text-blue-300 transition-colors">
                  <a href={`/alerts/${item.id}`}>{item.flag && <Flag size={14} className="inline text-red-500 mr-1.5" />}{item.title}</a>
                </div>
                <div className="mt-2"><TagList tags={item.tags} /></div>
              </td>
              <td className="px-4 py-4 text-center">
                {item.case_number
                  ? <a href="#" className="text-blue-400 hover:text-blue-300 font-medium">#{String(item.case_number).padStart(7, '0')}</a>
                  : <span className="glass-badge px-2 py-0.5">None</span>
                }
              </td>
              <td className="px-4 py-4 text-slate-300"><a href="#" className="hover:text-blue-400">{item.type}</a></td>
              <td className="px-4 py-4 text-slate-300"><a href="#" className="hover:text-blue-400">{item.source}</a></td>
              <td className="px-4 py-4 whitespace-normal">
                <strong className="text-slate-200 font-medium break-all">
                  {item.source_ref}
                  {item.external_link && (
                    <span className="ml-2">
                      <a href={item.external_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400" title="Open alert external link">
                        <i className="fa fa-external-link text-base"></i>
                      </a>
                    </span>
                  )}
                </strong>
              </td>
              <td className="px-4 py-4 text-center text-slate-300">{item.observable_count ?? 0}</td>
              <td className="px-4 py-4 text-right text-slate-400 whitespace-nowrap">
                <a href="#" className="hover:text-blue-400">{formatDate(item.created_at)}</a>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex items-center justify-end gap-3">
                  {canManage && (
                    <>
                      <button className="text-slate-400 hover:text-blue-400 transition-colors" title={item.follow ? 'Ignore new updates' : 'Track new updates'}>
                        {item.follow ? <Eye size={16} className="text-blue-500 drop-shadow-[0_0_4px_rgba(59,130,246,0.5)]" /> : <Eye size={16} />}
                      </button>
                      {item.read
                        ? <button className="text-slate-400 hover:text-blue-400 transition-colors" title="Mark as unread"><i className="fa fa-envelope-open-o text-base"></i></button>
                        : <button className="text-slate-400 hover:text-blue-400 transition-colors" title="Mark as read"><i className="fa fa-envelope text-base"></i></button>
                      }
                    </>
                  )}
                  <a className="text-slate-400 hover:text-blue-400 transition-colors" href={`/alerts/${item.id}`} title={item.case_number ? 'Preview' : 'Preview and Import'}>
                    <i className="fa fa-file-text-o text-base"></i>
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Observable table ──────────────────────────────────────────────────────── */
function ObservableTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec }: {
  values: ObservableSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec;
}) {
  if (values.length === 0) return <div className="text-center py-10 text-slate-500">No records</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-950/60 border-b-0 text-slate-300 text-sm font-bold uppercase tracking-wider">
            <th className="w-12 px-4 py-4"><input type="checkbox" className="bg-slate-800/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={allSelected} onChange={onToggleAll} /></th>
            <th className="w-20 px-4 py-4 text-center"><SortBtn field="tlp" label="TLP" tooltip="Traffic Light Protocol" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-32 px-4 py-4 flex items-center gap-1.5">Flags <InfoTooltip content="Indicator properties"><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip></th>
            <th className="w-32 px-4 py-4"><SortBtn field="data_type" label="Type" tooltip="Data category" spec={sortSpec} onSort={onSort} /></th>
            <th className="px-4 py-4 min-w-[250px]"><SortBtn field="data" label="Value" tooltip="The actual observable data" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-48 px-4 py-4 flex items-center gap-1.5">Case <InfoTooltip content="Linked investigation case"><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip></th>
            <th className="w-32 px-4 py-4"><SortBtn field="created_by" label="Created by" tooltip="User who submitted it" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-40 px-4 py-4 text-right"><SortBtn field="created_at" label="Dates" tooltip="Creation timestamp" spec={sortSpec} onSort={onSort} /></th>
          </tr>
        </thead>
        <tbody className="text-sm bg-slate-900/40">
          {values.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/60 transition-colors group">
              <td className="px-4 py-4"><input type="checkbox" className="bg-slate-900/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>
              <td className="px-4 py-4 text-center"><span className={`inline-block w-4 h-4 rounded-full bg-tlp-${item.tlp} shadow-[0_0_6px_rgba(255,255,255,0.1)] border border-white/10`} /></td>
              <td className="px-4 py-4 text-xs text-slate-400">
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-medium">{item.ioc ? <CheckCircle2 size={14} className="text-yellow-500 drop-shadow-[0_0_3px_rgba(234,179,8,0.5)]" /> : null}{item.ioc ? 'IOC' : 'Non IOC'}</span>
                  <span>{item.sighted ? 'Sighted' : 'Not sighted'}</span>
                  <span>{item.ignore_similarity ? 'Ignore similarity' : 'Similarity on'}</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <a href={`/observables/${item.id}`} className="text-blue-400 hover:text-blue-300 font-semibold text-base transition-colors">{item.data_type}</a>
                {item.attachment_id && <div className="mt-2"><span className="glass-badge px-2 py-0.5">file</span></div>}
              </td>
              <td className="px-4 py-4 whitespace-normal">
                <div className="font-mono text-slate-200 break-all">{item.data}</div>
                <div className="text-slate-500 text-sm mt-1.5">{item.message}</div>
                <div className="mt-2"><TagList tags={item.tags} /></div>
              </td>
              <td className="px-4 py-4">
                {item.case_id ? <a href={`/cases/${item.case_id}`} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">#{item.case_number}</a> : <span className="font-medium">#{item.case_number}</span>}<br />
                <div className="text-slate-400 text-xs mt-1.5 truncate max-w-[200px]">{item.case_title}</div>
              </td>
              <td className="px-4 py-4 text-slate-300">{item.created_by}</td>
              <td className="px-4 py-4 text-right text-sm text-slate-400 whitespace-nowrap"><div>C. {formatDate(item.created_at)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Shared helpers ────────────────────────────────────────────────────────── */
function LoadError({ entity, error }: { entity: string; error: unknown }) {
  const detail = error instanceof ApiError && error.status === 401
    ? 'Session expired. Sign out and log in again.'
    : error instanceof Error ? error.message : `Unable to load ${entity}`;
  return <div className="empty-message m-4"><strong>Unable to load {entity}</strong><br /><span>{detail}</span></div>;
}



function SortBtn({ field, label, tooltip, spec, onSort }: { field: string; label: string; tooltip?: string; spec: SortSpec; onSort: (f: string) => void }) {
  const active = spec.field === field;
  return (
    <button className="hover:text-white transition-colors flex items-center gap-1" onClick={() => onSort(field)}>
      {label}{' '}
      {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help inline-flex"><Info size={11} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}
      {active
        ? spec.order === 'ASC' ? <span className="text-blue-400 font-bold ml-1">↑</span> : <span className="text-blue-400 font-bold ml-1">↓</span>
        : <span className="text-slate-600 ml-1">↕</span>
      }
    </button>
  );
}

function Severity({ value }: { value: number }) {
  const classes: Record<number, string> = {
    0: 'bg-slate-800/80 text-slate-400 border border-slate-700',
    1: 'bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.15)]',
    2: 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]',
    3: 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold shadow-[0_0_12px_rgba(239,68,68,0.3)]',
    4: 'bg-red-600 text-white border border-red-500 font-extrabold shadow-[0_0_16px_rgba(239,68,68,0.6)]',
  };
  const cls = classes[value] || 'bg-slate-800 text-slate-400';
  return <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] uppercase tracking-widest ${cls}`}>{severityLabels[value] ?? 'Unknown'}</span>;
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className="text-slate-500 mt-0.5"><Tag size={12} /></span>
      {tags.map((tag) => <span key={tag} className="glass-badge border border-white/10 px-2 py-0.5 rounded text-xs">{tag}</span>)}
    </div>
  );
}

function caseStatusClass(status: string) {
  const s = status.toLowerCase();
  // Khách báo không thực hiện -> Incident -> Mở (Open - Red)
  if (s === 'open' || s === 'incidents') return 'glass-status-pill glass-pill-danger shadow-[0_0_8px_rgba(239,68,68,0.2)]';
  // Khách cần xác nhận -> Need confirm -> Mở (Open - Orange)
  if (s === 'need confirm') return 'glass-status-pill glass-pill-warning shadow-[0_0_8px_rgba(245,158,11,0.2)]';
  // Đang điều tra -> InProgress -> Xanh dương (Blue)
  if (s === 'inprogress') return 'glass-status-pill glass-pill-blue shadow-[0_0_8px_rgba(59,130,246,0.2)]';
  // Các status khác như Duplicated -> Vàng xám
  if (s === 'duplicated') return 'glass-status-pill glass-pill-muted';
  // Mặc định (Resolved, Closed, True positive, False positive) -> Đóng (Closed - Green)
  return 'glass-status-pill glass-pill-success';
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

function buildParams(page: number, pageSize: number, sort: SortSpec, filters: Record<string, string>) {
  const params = new URLSearchParams();
  params.set('range', `${page * pageSize}:${page * pageSize + pageSize - 1}`);
  params.set('sort', `${sort.field}:${sort.order}`);
  const closedStatuses = ['closed', 'resolved', 'true positive', 'false positive'];
  Object.entries(filters).forEach(([key, value]) => {
    if (!value.trim()) return;
    if (key === 'status' && value === '_active') return;
    params.set(key, value.trim());
  });
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
