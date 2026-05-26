'use client';

import type { ChangeEvent } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, CheckCircle2, Clock3, Eye, Filter, Flag, Search, Tag, Info, ChevronDown, ChevronUp, Copy, CheckCircle, SlidersHorizontal, List, Mail, MailOpen, FileText, Link, Times } from '@/components/FaIcon';
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
type Tab = 'cases' | 'alerts' | 'observables' | 'fields';

export default function InvestigationPage() {
  return <Suspense fallback={<div className="thehive-empty m-4">Loading investigation workspace...</div>}><InvestigationWorkspace /></Suspense>;
}

const severityLabels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical', 4: 'Critical' };
const dateFormatter = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const availableFields = [
  { key: 'number', label: 'Number' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'severity', label: 'Severity' },
  { key: 'tlp', label: 'TLP' },
  { key: 'pap', label: 'PAP' },
  { key: 'owner', label: 'Owner' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'tags', label: 'Tags' },
  { key: 'summary', label: 'Summary' },
  { key: 'case_template', label: 'Case template' },
  { key: 'impact_status', label: 'Impact' },
  { key: 'resolution_status', label: 'Resolution' },
  { key: 'created_at', label: 'Created at' },
  { key: 'updated_at', label: 'Updated at' }
];

const fieldWidths: Record<string, number> = {
  number: 110,
  title: 350,
  status: 130,
  severity: 110,
  tlp: 100,
  pap: 100,
  owner: 150,
  assignee: 150,
  tags: 220,
  summary: 350,
  case_template: 180,
  impact_status: 130,
  resolution_status: 160,
  created_at: 160,
  updated_at: 160
};

function InvestigationWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('cases');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('thehive.visible_columns');
      return saved ? JSON.parse(saved) : ['status', 'title', 'severity', 'details', 'assignee', 'updated'];
    }
    return ['status', 'title', 'severity', 'details', 'assignee', 'updated'];
  });
  const [selectedFields, setSelectedFields] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('thehive.selected_fields');
      return saved ? JSON.parse(saved) : ['number', 'title', 'status', 'severity', 'tlp', 'tags'];
    }
    return ['number', 'title', 'status', 'severity', 'tlp', 'tags'];
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
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
  const [fieldSearch, setFieldSearch] = useState('');
  const [bulkCloseReason, setBulkCloseReason] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [prevEntity, setPrevEntity] = useState<string>('cases');

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    status: 120,
    title: 400,
    severity: 100,
    details: 180,
    assignee: 150,
    updated: 140
  });

  const startResize = useCallback((columnKey: string, startEvent: React.MouseEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = colWidths[columnKey] || 150;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(80, startWidth + (e.clientX - startX));
      setColWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [colWidths]);

  useEffect(() => {
    localStorage.setItem('thehive.visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('thehive.selected_fields', JSON.stringify(selectedFields));
  }, [selectedFields]);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'alerts' || tab === 'cases' || tab === 'observables' || tab === 'fields') setActiveTab(tab as Tab);
  }, [searchParams]);

  useEffect(() => {
    const currentEntity = activeTab === 'fields' ? 'cases' : activeTab;
    if (currentEntity !== prevEntity) {
      setPage(0);
      setSelectedIds([]);
      setSort({ field: currentEntity === 'cases' ? 'number' : 'created_at', order: 'DESC' });
      setFilters(currentEntity === 'cases' ? { status: '_active' } : {});
      setPrevEntity(currentEntity);
    }
  }, [activeTab, prevEntity]);

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
  const activeValues = activeTab === 'cases' || activeTab === 'fields' ? filteredCases.length : activeTab === 'alerts' ? filteredAlerts.length : filteredObservables.length;
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
      setBulkMessage(`Bulk close: successfully closed ${r.ok}/${r.total} items.`);
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
    setBulkMessage(`Exported ${selectedIds.length} ${activeTab === 'cases' ? 'cases' : activeTab === 'alerts' ? 'alerts' : 'observables'}.`);
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
      setBulkMessage(`Bulk assign: successfully assigned ${r.ok}/${r.total} items.`);
    },
    onError: () => setBulkMessage('Bulk assign failed.'),
  });

  if (!authedLogin) return null;

  const activeItems = activeTab === 'cases' || activeTab === 'fields' ? filteredCases : activeTab === 'alerts' ? filteredAlerts : filteredObservables;

  const hasUnassignedCase = activeTab === 'cases' && filteredCases
    .filter(c => selectedIds.includes(c.id))
    .some(c => !c.assignee || c.assignee.trim() === "");

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
              <div className="glass-panel flex flex-col rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] anim-fade-in bg-slate-900/10">
                {/* Header: Title + Tabs + Search */}
                <div className="px-5 py-3 flex flex-wrap gap-2 justify-between items-center bg-slate-800/40">
                  <h3 className="text-blue-400 font-medium text-lg flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    {activeTab === 'cases' && <>Cases <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                    {activeTab === 'alerts' && <>Alerts <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                    {activeTab === 'observables' && <>Observables <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                    {activeTab === 'fields' && <>Flat SIEM Fields <span className="ml-2 px-2.5 py-0.5 text-xs glass-surface text-slate-300 rounded-full">{activeValues}/{activeTotal}</span></>}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex glass-surface rounded-lg p-1">
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'cases' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('cases')}><Briefcase size={14} /> Cases</button>
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'alerts' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('alerts')}><AlertTriangle size={14} /> Alerts</button>
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'observables' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('observables')}><Eye size={14} /> Observables</button>
                      <button className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2 font-medium ${activeTab === 'fields' ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} onClick={() => switchTab('fields')}><List size={14} /> SIEM Fields</button>
                    </div>
                    {(activeTab === 'cases' || activeTab === 'fields') && (
                      <button 
                        className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 font-medium border ${showColumnDropdown ? 'bg-blue-600 border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'glass-surface text-slate-400 hover:text-slate-200 border-slate-900/60'}`}
                        onClick={() => setShowColumnDropdown(true)}
                        title={activeTab === 'cases' ? "Select visible columns" : "Select SIEM fields"}
                      >
                        <SlidersHorizontal size={14} /> {activeTab === 'cases' ? 'Columns' : 'Fields'}
                      </button>
                    )}
                    {activeTab !== 'fields' && (
                      <button className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-2 font-medium border ${showFilters ? 'bg-blue-600 border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.3)] text-white' : 'glass-surface text-slate-400 hover:text-slate-200 border-slate-900/60'}`} onClick={() => setShowFilters((v) => !v)} title="Toggle advanced filters"><Filter size={14} /> Filters</button>
                    )}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input className="glass-input w-64 pl-9 pr-4 py-2" placeholder={`Search...`} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Advanced Filter Frame */}
                {activeTab !== 'fields' && (
                  <div className="flex flex-col bg-slate-900/40">
                    <div 
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors select-none"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <div className="flex items-center gap-2 text-blue-400">
                        <Filter size={16} />
                        <span className="font-bold text-base text-slate-200">Advanced filters</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {Object.keys(filters).length > 0 && (
                          <button 
                            className="px-3 py-1 glass-surface hover:bg-white/10 rounded-md text-slate-300 text-xs font-medium transition-colors"
                            onClick={(e) => { e.stopPropagation(); clearAllFilters(); }}
                          >
                            Clear filters
                          </button>
                        )}
                        {showFilters ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                      </div>
                    </div>
                    
                    {showFilters && (
                      <div className="px-5 py-5 glass-surface anim-slide-up">
                        <FilterPanel activeTab={activeTab} filters={filters} onChange={updateFilter} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* === FRAME 2 (BOTTOM): Action Toolbar & Data Table === */}
              <div className="glass-panel flex flex-col rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)] anim-slide-up bg-slate-950/20">
                
                {/* Unified Action Toolbar */}
                {activeTab !== 'fields' && (
                  <div className="bg-slate-800/40 px-5 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-sm text-slate-300">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <span className="font-medium text-slate-200">Showing {activeValues} rows <span className="mx-2 text-slate-600">|</span> <span className={selectedRows > 0 ? "text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]" : "text-slate-500"}>Selected {selectedRows} rows</span></span>
                      
                      {Object.keys(filters).filter((k) => filters[k] && !k.startsWith('_')).length > 0 && (
                        <>
                          <span className="text-slate-600 mx-1 hidden sm:inline">|</span>
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active filters:</span>
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
                      <Button variant="outline" size="sm" className={`font-medium transition-all shadow-sm ${selectedRows > 0 ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-slate-800/50 border-slate-900/60 text-slate-500 cursor-not-allowed opacity-60'}`} disabled={!canBulk || selectedRows === 0 || bulkClose.isPending} onClick={() => setShowBulkClose(true)} title="Close selected items">
                        {bulkClose.isPending ? 'Closing...' : 'Close cases'}
                      </Button>
                      <Button variant="outline" size="sm" className={`font-medium transition-all shadow-sm ${selectedRows > 0 ? 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-slate-800/50 border-slate-900/60 text-slate-500 cursor-not-allowed opacity-60'}`} disabled={!canBulk || selectedRows === 0} onClick={() => { if (!bulkAssignee) setBulkAssignee(authedLogin || ''); setShowBulkAssign(true); }} title="Assign selected items">Assign</Button>
                    </div>
                  </div>
                )}

                {/* Bulk Close Dialog */}
                <Dialog open={showBulkClose} onOpenChange={setShowBulkClose}>
                  <DialogContent showCloseButton={false} className="bg-slate-900/95 border border-slate-800/50 text-slate-300 sm:max-w-[460px] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] ring-1 ring-slate-800/30 p-6 anim-fade-in backdrop-blur-xl">
                    <button 
                      type="button" 
                      onClick={() => { setShowBulkClose(false); setBulkCloseReason(''); }} 
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-all p-1.5 rounded-lg hover:bg-white/5 focus:outline-none"
                    >
                      <Times size={14} />
                    </button>
                    <DialogHeader className="mb-1">
                      <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                        </svg>
                        Close {selectedRows} cases
                      </DialogTitle>
                      <DialogDescription className="text-slate-400 text-xs">
                        Please select a resolution status and enter a resolution summary.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <div className="grid gap-2">
                        <label className="text-[10px] font-bold text-slate-400/90 uppercase tracking-wider select-none">Resolution status</label>
                        {(() => {
                          const resolutionOptions = [
                            {
                              value: 'FalsePositive',
                              label: 'False Positive',
                              desc: 'False alarm due to normal activity or testing log',
                              icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-slate-400">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="15" y1="9" x2="9" y2="15"></line>
                                  <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                              )
                            },
                            {
                              value: 'TruePositive',
                              label: 'True Positive',
                              desc: 'Confirmed security incident or policy violation',
                              icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-green-400">
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                              )
                            },
                            {
                              value: 'NeedConfirm',
                              label: 'Need Confirm',
                              desc: 'Suspicious behavior requiring further investigation and deep analysis',
                              icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-orange-400">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                              )
                            },
                            {
                              value: 'Incident',
                              label: 'Incident',
                              desc: 'Requires immediate containment or response process activation',
                              icon: (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-red-400">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                  <line x1="12" y1="9" x2="12" y2="13"></line>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                              )
                            }
                          ];
                          const selectedOption = resolutionOptions.find(opt => opt.value === bulkCloseStatus) || resolutionOptions[1];
                          
                          return (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-800/80 rounded-xl text-left transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 shadow-inner"
                              >
                                <div className="flex items-center gap-3">
                                  {selectedOption.icon}
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-200 tracking-wide">{selectedOption.label}</span>
                                    <span className="text-[10px] text-slate-400/80">{selectedOption.desc}</span>
                                  </div>
                                </div>
                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {statusDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-[150]" onClick={() => setStatusDropdownOpen(false)} />
                                  <div className="absolute z-[200] w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                                    {resolutionOptions.map((opt) => {
                                      const isCurrent = opt.value === bulkCloseStatus;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => {
                                            setBulkCloseStatus(opt.value);
                                            setStatusDropdownOpen(false);
                                          }}
                                          className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-lg text-left transition-all duration-150 hover:bg-slate-900 ${
                                            isCurrent ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 font-semibold' : 'text-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            {opt.icon}
                                            <div className="flex flex-col">
                                              <span className={`text-xs font-bold tracking-wide ${isCurrent ? 'text-blue-400 font-semibold' : ''}`}>
                                                {opt.label}
                                              </span>
                                              <span className="text-[10.5px] text-slate-400/90">{opt.desc}</span>
                                            </div>
                                          </div>
                                          {isCurrent && (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5 text-blue-400">
                                              <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="grid gap-2">
                        <label className="text-[10px] font-bold text-slate-400/90 uppercase tracking-wider select-none">Resolution summary</label>
                        <textarea 
                          className="glass-input py-3 px-4 w-full h-24 text-xs resize-none focus:bg-slate-800/80 transition-all rounded-xl leading-relaxed border border-slate-800 focus:border-slate-800/80" 
                          placeholder="Enter details of the resolution process, containment measures, or investigation summary..." 
                          value={bulkCloseReason} 
                          onChange={e => setBulkCloseReason(e.target.value)} 
                        />
                      </div>
                      {hasUnassignedCase && (
                        <div className="p-3 mb-2 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-start gap-2.5 leading-relaxed shadow-inner">
                          <span className="text-sm mt-0.5">⚠️</span>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-red-200 tracking-wide uppercase text-[10px]">Action required</span>
                            <span>One or more selected cases are not assigned. Please assign an owner before closing cases.</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 flex items-center justify-end gap-3">
                      <Button 
                        variant="ghost" 
                        onClick={() => { setShowBulkClose(false); setBulkCloseReason(''); }} 
                        className="text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-slate-800 hover:border-slate-850 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200"
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        className={`rounded-xl px-6 py-2.5 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 border border-transparent ${
                          hasUnassignedCase
                            ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed opacity-50 border-slate-900/40'
                            : bulkCloseStatus === 'FalsePositive' 
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 shadow-[0_0_12px_rgba(148,163,184,0.1)]' 
                            : bulkCloseStatus === 'TruePositive'
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.35)] font-bold'
                            : bulkCloseStatus === 'NeedConfirm'
                            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.35)] font-bold'
                            : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] font-bold'
                        }`} 
                        disabled={bulkClose.isPending || hasUnassignedCase} 
                        onClick={() => { bulkClose.mutate(); setShowBulkClose(false); }}
                      >
                        {bulkClose.isPending ? 'Closing...' : 'Confirm Close'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Bulk Assign Dialog */}
                <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
                  <DialogContent showCloseButton={false} className="bg-slate-900/95 border border-slate-800/60 text-slate-300 sm:max-w-[425px] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] ring-1 ring-slate-800/30 p-6 anim-fade-in backdrop-blur-xl">
                    <button 
                      type="button" 
                      onClick={() => setShowBulkAssign(false)} 
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-all p-1.5 rounded-lg hover:bg-white/5 focus:outline-none"
                    >
                      <Times size={14} />
                    </button>
                    <DialogHeader className="mb-1">
                      <DialogTitle className="text-lg font-bold text-blue-400 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <line x1="20" y1="8" x2="20" y2="14"></line>
                          <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        Assign {selectedRows} {activeTab === 'cases' ? 'cases' : 'tasks'}
                      </DialogTitle>
                      <DialogDescription className="text-slate-400 text-xs">
                        Enter SOC analyst login name to assign work.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <div className="grid gap-2 relative">
                        <label className="text-[10px] font-bold text-slate-400/90 uppercase tracking-wider select-none">Assignee login</label>
                        <input 
                          className="glass-input py-2.5 px-4 w-full text-xs transition-all rounded-xl leading-relaxed border border-slate-800 focus:border-slate-800/80 focus:bg-slate-800/80" 
                          placeholder="Username (e.g. analyst@example.com)" 
                          value={bulkAssignee} 
                          onChange={e => { setBulkAssignee(e.target.value); setShowUserDropdown(true); }}
                          onFocus={() => setShowUserDropdown(true)}
                          onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                        />
                        {showUserDropdown && suggestedUsers.length > 0 && (
                          <div className="absolute top-[100%] left-0 w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-[100] max-h-48 overflow-y-auto glass-scroll p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                            {suggestedUsers.map(u => (
                              <div
                                key={u}
                                className="px-3.5 py-2 rounded-lg text-xs text-slate-300 hover:bg-blue-600/10 hover:text-blue-400 cursor-pointer transition-colors font-medium"
                                onMouseDown={(e) => { e.preventDefault(); setBulkAssignee(u); setShowUserDropdown(false); }}
                              >
                                {u}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-end gap-3">
                      <Button 
                        variant="ghost" 
                        onClick={() => setShowBulkAssign(false)} 
                        className="text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-slate-800 hover:border-slate-855 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200"
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 text-xs font-bold transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.35)]" 
                        disabled={!bulkAssignee.trim() || bulkAssign.isPending} 
                        onClick={() => { bulkAssign.mutate(); setShowBulkAssign(true); }}
                      >
                        {bulkAssign.isPending ? 'Assigning...' : 'Confirm'}
                      </Button>
                    </div>
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
                        cases.isLoading ? <div className="thehive-empty m-4">Loading cases list...</div>
                        : cases.isError ? <LoadError entity="case" error={cases.error} />
                        : <CaseTable values={filteredCases} selectedIds={selectedIds} onToggle={toggleSelected} onToggleAll={() => toggleSelectAll(filteredCases)} onSort={toggleSort} sortSpec={sort} visibleColumns={visibleColumns} colWidths={colWidths} onStartResize={startResize} />
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
                      {activeTab === 'fields' && (
                        cases.isLoading ? <div className="thehive-empty m-4">Loading fields...</div>
                        : cases.isError ? <LoadError entity="SIEM fields" error={cases.error} />
                        : <FieldsViewPanel values={filteredCases} selectedFields={selectedFields} />
                      )}
                    </div>

                    {/* Pagination footer */}
                    {activeItems.length > 0 && (
                      <div className="px-5 py-3 bg-slate-900/60 flex justify-between items-center border-t border-slate-900/80">
                        <span className="text-sm text-slate-500 font-medium">Page {page + 1}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <select className="glass-select py-1 pl-2 pr-6" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                              <option value={10}>10 rows</option>
                              <option value={20}>20 rows</option>
                              <option value={50}>50 rows</option>
                            </select>
                          </div>
                          <div className="flex glass-surface rounded-md overflow-hidden">
                            <button className={`px-3 py-1.5 text-sm font-medium ${page === 0 ? 'text-slate-600 cursor-not-allowed opacity-50' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}>« Previous</button>
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
           {/* Right-side Column/Field Selection Drawer */}
        {showColumnDropdown && (
          <div className="fixed inset-0 z-[9999] flex justify-end">
            {/* Backdrop overlay */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setShowColumnDropdown(false)}
            />
            
            {/* Drawer Panel */}
            <div className="relative w-85 max-w-full bg-slate-900/95 border-l border-slate-900/80 shadow-2xl h-full flex flex-col z-10 anim-slide-left p-6 text-slate-300">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-900/50 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="text-blue-400" size={18} />
                  <span className="font-bold text-lg text-slate-100">
                    {activeTab === 'cases' ? 'Configure columns' : 'Configure SIEM fields'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowColumnDropdown(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800/50 text-xl font-bold"
                >
                  &times;
                </button>
              </div>

              {activeTab === 'cases' ? (
                <>
                  {/* Cases Columns Config */}
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                    <p className="text-xs text-slate-400 mb-2 leading-relaxed">Configure the columns displayed in the case list table. Toggle checkboxes below to customize your interface.</p>
                    {['status', 'title', 'severity', 'details', 'assignee', 'updated'].map((col) => {
                      const labels: Record<string, string> = {
                        status: 'Status',
                        title: 'ID & Case Title',
                        severity: 'Severity',
                        details: 'Tasks & Details',
                        assignee: 'Assignee',
                        updated: 'Updated At'
                      };
                      const active = visibleColumns.includes(col);
                      return (
                        <label 
                          key={col} 
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${active ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                        >
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 bg-slate-950 border-slate-900 rounded text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              checked={active}
                              onChange={() => {
                                setVisibleColumns(prev => 
                                  prev.includes(col) 
                                    ? prev.filter(c => c !== col) 
                                    : [...prev, col]
                                );
                              }}
                            />
                            <span className="font-semibold text-sm select-none">{labels[col]}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Footer buttons */}
                  <div className="border-t border-slate-900/50 pt-6 mt-6 flex gap-3">
                    <button 
                      className="flex-1 py-2 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-755 text-slate-300 border border-slate-900/60 transition-colors"
                      onClick={() => setVisibleColumns(['status', 'title', 'severity', 'details', 'assignee', 'updated'])}
                    >
                      Reset to default
                    </button>
                    <button 
                      className="flex-1 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                      onClick={() => setShowColumnDropdown(false)}
                    >
                      Apply configuration
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* SIEM Fields Config */}
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">Select data fields to flatten and display in SIEM Grid mode. Use search to find specific fields.</p>
                  
                  {/* Search box inside drawer */}
                  <div className="relative mb-4">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      className="w-full bg-slate-950 border border-slate-900/50 rounded-md py-1.5 px-3 pl-8 text-xs text-slate-300 focus:border-blue-500/50 outline-none transition-all"
                      placeholder="Search data field..."
                      value={fieldSearch}
                      onChange={e => setFieldSearch(e.target.value)}
                    />
                  </div>

                  {/* Scrollable checklist */}
                  <div className="flex-1 overflow-y-auto glass-scroll flex flex-col gap-2 pr-1 mb-4">
                    {availableFields
                      .filter(f => f.key.toLowerCase().includes(fieldSearch.toLowerCase()) || f.label.toLowerCase().includes(fieldSearch.toLowerCase()))
                      .map(f => {
                        const active = selectedFields.includes(f.key);
                        return (
                          <label 
                            key={f.key} 
                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${active ? 'bg-blue-600/10 border-blue-500/30 text-blue-300' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 bg-slate-950 border-slate-900 rounded text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                checked={active}
                                onChange={() => {
                                  setSelectedFields(prev => 
                                    prev.includes(f.key) 
                                      ? prev.filter(key => key !== f.key) 
                                      : [...prev, f.key]
                                  );
                                }}
                              />
                              <span className="font-semibold text-xs select-none">{f.label}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 select-all">{f.key}</span>
                          </label>
                        );
                      })}
                  </div>

                  {/* Footer buttons with Clean All */}
                  <div className="border-t border-slate-900/50 pt-4 mt-auto flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        className="flex-1 py-2 text-xs font-semibold rounded-md bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-900/30 transition-colors"
                        onClick={() => setSelectedFields([])}
                        title="Deselect all fields"
                      >
                        Deselect all
                      </button>
                      <button 
                        className="flex-1 py-2 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-755 text-slate-300 border border-slate-900/60 transition-colors"
                        onClick={() => setSelectedFields(['number', 'title', 'status', 'severity', 'tlp', 'tags'])}
                        title="Restore default fields"
                      >
                        Restore default
                      </button>
                    </div>
                    <button 
                      className="w-full py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                      onClick={() => setShowColumnDropdown(false)}
                    >
                      Apply fields ({selectedFields.length})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        </TooltipProvider>
      </div>
    </div>
  );
}

function FilterPanel({ activeTab, filters, onChange }: {
  activeTab: Tab; filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-6">
        {activeTab === 'cases' && <>
          <SelectFilter label="Status" name="status" tooltip="Filter by SOC workflow status" value={filters.status ?? ''} options={[['_active', 'Active (not closed)'], ['Open', 'Open'], ['InProgress', 'In Progress'], ['Resolved', 'Resolved'], ['Closed', 'Closed'], ['Duplicated', 'Duplicated'], ['True positive', 'True Positive'], ['False positive', 'False Positive'], ['Need confirm', 'Need Confirm'], ['Incidents', 'Incident']]} onChange={onChange} />
          <SelectFilter label="Severity" name="severity" tooltip="Potential impact level of the case" value={filters.severity ?? ''} options={[['0', 'Low'], ['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" tooltip="Traffic Light Protocol (TLP) sharing constraint" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <SelectFilter label="PAP" name="pap" tooltip="Permissible Action Protocol (PAP) action constraint" value={filters.pap ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <TextFilter label="Assignee" name="assignee" value={filters.assignee ?? ''} onChange={onChange} />
          <TextFilter label="Owner" name="owner" value={filters.owner ?? ''} onChange={onChange} />
          <SelectFilter label="Flagged" name="flag" value={filters.flag ?? ''} options={[['true', 'Flagged'], ['false', 'Not flagged']]} onChange={onChange} />
        </>}
        {activeTab === 'alerts' && <>
          <SelectFilter label="Status" name="status" value={filters.status ?? ''} options={[['New', 'New'], ['Updated', 'Updated'], ['Imported', 'Imported to Case'], ['Ignored', 'Ignored']]} onChange={onChange} />
          <SelectFilter label="Severity" name="severity" value={filters.severity ?? ''} options={[['0', 'Low'], ['1', 'Medium'], ['2', 'High'], ['3', 'Critical']]} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <TextFilter label="Source" name="source" value={filters.source ?? ''} onChange={onChange} />
          <TextFilter label="Type" name="type" value={filters.type ?? ''} onChange={onChange} />
          <SelectFilter label="Read" name="read" value={filters.read ?? ''} options={[['true', 'Read'], ['false', 'Unread']]} onChange={onChange} />
          <SelectFilter label="Follow" name="follow" value={filters.follow ?? ''} options={[['true', 'Following'], ['false', 'Not following']]} onChange={onChange} />
        </>}
        {activeTab === 'observables' && <>
          <TextFilter label="Data type" name="dataType" value={filters.dataType ?? ''} onChange={onChange} />
          <SelectFilter label="TLP" name="tlp" value={filters.tlp ?? ''} options={[['0', 'White'], ['1', 'Green'], ['2', 'Amber'], ['3', 'Red']]} onChange={onChange} />
          <SelectFilter label="IOC Indicator" name="ioc" value={filters.ioc ?? ''} options={[['true', 'IOC only'], ['false', 'Non-IOC']]} onChange={onChange} />
          <SelectFilter label="Sighted" name="sighted" value={filters.sighted ?? ''} options={[['true', 'Sighted'], ['false', 'Not sighted']]} onChange={onChange} />
          <SelectFilter label="Similarity match" name="ignoreSimilarity" value={filters.ignoreSimilarity ?? ''} options={[['false', 'Enable match'], ['true', 'Ignore similarity']]} onChange={onChange} />
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
  return <label className="flex flex-col gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{label} {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}</span><input className="glass-input bg-slate-900/50 border-slate-900/60 text-sm py-2 px-3 focus:bg-slate-800 focus:border-blue-500/50 transition-all rounded-md w-full" placeholder={label} value={value} onChange={(e) => onChange(name, e.target.value)} /></label>;
}
function DateFilter({ label, name, value, tooltip, onChange }: { label: string; name: string; value: string; tooltip?: string; onChange: (key: string, value: string) => void }) {
  return <label className="flex flex-col gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{label} {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}</span><input type="datetime-local" className="glass-input bg-slate-900/50 border-slate-900/60 text-sm py-2 px-3 focus:bg-slate-800 focus:border-blue-500/50 transition-all rounded-md w-full" value={toLocalDateInput(value)} onChange={(e) => onChange(name, e.target.value ? new Date(e.target.value).toISOString() : '')} /></label>;
}
function SelectFilter({ label, name, value, options, tooltip, onChange }: { label: string; name: string; value: string; tooltip?: string; options: Array<string | [string, string]>; onChange: (key: string, value: string) => void }) {
  return <label className="flex flex-col gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">{label} {tooltip && <InfoTooltip content={tooltip}><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>}</span><select className="glass-select bg-slate-900/50 border-slate-900/60 text-sm py-2 px-3 focus:bg-slate-800 focus:border-blue-500/50 transition-all rounded-md w-full" value={value} onChange={(e) => onChange(name, e.target.value)}><option value="">All</option>{options.map((o) => { const pair = Array.isArray(o) ? o : [o, o]; return <option key={pair[0]} value={pair[0]}>{pair[1]}</option>; })}</select></label>;
}

/* ─── Case table — mirrors case.list.html ───────────────────────────────────── */
function CaseTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec, visibleColumns, colWidths, onStartResize }: {
  values: CaseSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec; visibleColumns: string[];
  colWidths: Record<string, number>;
  onStartResize: (columnKey: string, startEvent: React.MouseEvent) => void;
}) {
  if (values.length === 0) return <div className="text-center py-10 text-slate-500 font-medium">No cases found</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  
  const showStatus = visibleColumns.includes('status');
  const showTitle = visibleColumns.includes('title');
  const showSeverity = visibleColumns.includes('severity');
  const showDetails = visibleColumns.includes('details');
  const showAssignee = visibleColumns.includes('assignee');
  const showUpdated = visibleColumns.includes('updated');

  const totalWidth = 6 + 48 
    + (showStatus ? (colWidths.status ?? 120) : 0)
    + (showTitle ? (colWidths.title ?? 400) : 0)
    + (showSeverity ? (colWidths.severity ?? 100) : 0)
    + (showDetails ? (colWidths.details ?? 180) : 0)
    + (showAssignee ? (colWidths.assignee ?? 150) : 0)
    + (showUpdated ? (colWidths.updated ?? 140) : 0);

  return (
    <div className="ring-1 ring-slate-950 bg-slate-950/40 rounded-xl overflow-x-auto glass-scroll shadow-2xl">
      <table className="text-left border-collapse table-fixed" style={{ width: totalWidth, minWidth: '100%' }}>
        <colgroup>
          <col style={{ width: 6 }} />
          <col style={{ width: 48 }} />
          {showStatus && <col style={{ width: colWidths.status ?? 120 }} />}
          {showTitle && <col style={{ width: colWidths.title ?? 400 }} />}
          {showSeverity && <col style={{ width: colWidths.severity ?? 100 }} />}
          {showDetails && <col style={{ width: colWidths.details ?? 180 }} />}
          {showAssignee && <col style={{ width: colWidths.assignee ?? 150 }} />}
          {showUpdated && <col style={{ width: colWidths.updated ?? 140 }} />}
        </colgroup>
        <thead>
          <tr className="bg-slate-950/60 text-slate-300 text-sm font-bold uppercase tracking-wider">
            <th className="p-0"></th>
            <th className="px-4 py-4"><input type="checkbox" className="bg-slate-800/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={allSelected} onChange={onToggleAll} /></th>
            {showStatus && (
              <th className="px-4 py-4 relative">
                <SortBtn field="status" label="Status" tooltip="SOC workflow status" spec={sortSpec} onSort={onSort} />
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={(e) => onStartResize('status', e)} onClick={(e) => e.stopPropagation()} />
              </th>
            )}
            {showTitle && (
              <th className="px-4 py-4 relative">
                <div className="flex items-center gap-1.5">
                  <SortBtn field="number" label="# Case ID" tooltip="Unique case identifier" spec={sortSpec} onSort={onSort} />
                  <span className="text-slate-600">/</span>
                  <SortBtn field="title" label="Case Title" tooltip="Brief description of the case" spec={sortSpec} onSort={onSort} />
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={(e) => onStartResize('title', e)} onClick={(e) => e.stopPropagation()} />
              </th>
            )}
            {showSeverity && (
              <th className="px-4 py-4 text-center relative">
                <SortBtn field="severity" label="Severity" tooltip="Potential impact level" spec={sortSpec} onSort={onSort} />
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={(e) => onStartResize('severity', e)} onClick={(e) => e.stopPropagation()} />
              </th>
            )}
            {showDetails && (
              <th className="px-4 py-4 relative">
                <div className="flex items-center">
                  <span>Case Details</span>
                  <InfoTooltip content="Count of tasks, observables, and alerts"><span className="cursor-help inline-flex ml-1"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={(e) => onStartResize('details', e)} onClick={(e) => e.stopPropagation()} />
              </th>
            )}
            {showAssignee && (
              <th className="px-4 py-4 relative">
                <SortBtn field="assignee" label="Assignee" tooltip="SOC analyst handling the case" spec={sortSpec} onSort={onSort} />
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={(e) => onStartResize('assignee', e)} onClick={(e) => e.stopPropagation()} />
              </th>
            )}
            {showUpdated && (
              <th className="px-4 py-4 text-right relative">
                <SortBtn field="updated_at" label="Updated" tooltip="Last updated timestamp" spec={sortSpec} onSort={onSort} />
                <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10" onMouseDown={(e) => onStartResize('updated', e)} onClick={(e) => e.stopPropagation()} />
              </th>
            )}
          </tr>
        </thead>
        <tbody className="text-sm bg-slate-900/10">
          {values.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors group odd:bg-slate-950/5 even:bg-slate-900/5">
              <td className={`p-0 bg-tlp-${item.tlp} w-1.5`}></td>
              <td className="px-4 py-4"><input type="checkbox" className="bg-slate-900/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>
              {showStatus && (
                <td className="px-4 py-4">
                  <span className={caseStatusClass(item.status)}>{item.status}</span>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-2"><Clock3 size={12} /> {ageLabel(item.updated_at)}</div>
                </td>
              )}
              {showTitle && (
                <td className="px-4 py-4 whitespace-normal">
                  <div className="font-semibold text-base text-blue-400 hover:text-blue-300 transition-colors">
                    <a href={`/cases/${item.id}`}>
                      {item.flag && <Flag size={14} className="inline text-red-500 mr-1.5" />}
                      #{String(item.number).padStart(7, '0')} - {item.title}
                    </a>
                  </div>
                  <div className="text-slate-400 text-xs mt-1.5">
                    <span className="font-medium text-slate-300">{item.owning_organisation || 'Default Organisation'}</span>
                  </div>
                  {item.summary && <div className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">{item.summary}</div>}
                  <div className="mt-2"><TagList tags={item.tags} /></div>
                </td>
              )}
              {showSeverity && <td className="px-4 py-4 text-center"><Severity value={item.severity} /></td>}
              {showDetails && (
                <td className="px-4 py-4 text-slate-400">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-slate-300 font-medium">{item.task_count} tasks · {item.observable_count} observables · {item.alert_count} alerts</span>
                    <span className="text-xs text-slate-500">{item.impact_status ?? 'No impact status'} / {item.resolution_status ?? 'Unresolved'}</span>
                  </div>
                </td>
              )}
              {showAssignee && <td className="px-4 py-4 text-slate-300">{item.assignee || item.owner || <em className="text-slate-500">Unassigned</em>}</td>}
              {showUpdated && (
                <td className="px-4 py-4 text-right text-slate-400 whitespace-nowrap">
                  {formatDate(item.updated_at)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Alert table ───────────────────────────────────────────────────────────── */
function AlertTable({ values, selectedIds, onToggle, onToggleAll, onSort, sortSpec, canManage }: {
  values: AlertSummary[]; selectedIds: string[];
  onToggle: (id: string) => void; onToggleAll: () => void;
  onSort: (field: string) => void; sortSpec: SortSpec; canManage: boolean;
}) {
  if (values.length === 0) return <div className="text-center py-10 text-slate-500 font-medium">No alerts found</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <div className="ring-1 ring-slate-950 bg-slate-950/40 rounded-xl overflow-hidden shadow-2xl">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-950/60 text-slate-300 text-sm font-bold uppercase tracking-wider">
            {canManage && <th className="w-12 px-4 py-4"><input type="checkbox" className="bg-slate-800/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={allSelected} onChange={onToggleAll} /></th>}
            <th className="w-24 px-4 py-4 text-center"><SortBtn field="severity" label="Severity" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-20 px-4 py-4 text-center"><SortBtn field="read" label="Read" spec={sortSpec} onSort={onSort} /></th>
            <th className="px-4 py-4 min-w-[200px]">Alert Title</th>
            <th className="w-28 px-4 py-4 text-center">Case ID</th>
            <th className="w-32 px-4 py-4"><SortBtn field="type" label="Type" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-36 px-4 py-4"><SortBtn field="source" label="Source" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-48 px-4 py-4"><SortBtn field="sourceRef" label="Reference" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-28 px-4 py-4 text-center">Observables</th>
            <th className="w-32 px-4 py-4 text-right">
              <SortBtn field="created_at" label="Created at" spec={sortSpec} onSort={onSort} />
            </th>
            <th className="w-28 px-4 py-4"></th>
          </tr>
        </thead>
        <tbody className="text-sm bg-slate-900/10">
          {values.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors group odd:bg-slate-950/5 even:bg-slate-900/5">
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
                  : <span className="glass-badge px-2 py-0.5 text-slate-500">Unlinked</span>
                }
              </td>
              <td className="px-4 py-4 text-slate-300"><a href="#" className="hover:text-blue-400">{item.type}</a></td>
              <td className="px-4 py-4 text-slate-300"><a href="#" className="hover:text-blue-400">{item.source}</a></td>
              <td className="px-4 py-4 whitespace-normal">
                <strong className="text-slate-200 font-medium break-all flex items-center gap-1.5">
                  {item.source_ref}
                  {item.external_link && (
                    <a href={item.external_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400" title="Open external link">
                      <Link size={14} />
                    </a>
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
                      <button className="text-slate-400 hover:text-blue-400 transition-colors" title={item.follow ? 'Unfollow updates' : 'Follow updates'}>
                        {item.follow ? <Eye size={16} className="text-blue-500 drop-shadow-[0_0_4px_rgba(59,130,246,0.5)]" /> : <Eye size={16} />}
                      </button>
                      {item.read
                        ? <button className="text-slate-400 hover:text-blue-400 transition-colors" title="Mark as unread"><MailOpen size={16} /></button>
                        : <button className="text-slate-400 hover:text-blue-400 transition-colors" title="Mark as read"><Mail size={16} /></button>
                      }
                    </>
                  )}
                  <a className="text-slate-400 hover:text-blue-400 transition-colors" href={`/alerts/${item.id}`} title={item.case_number ? 'Preview' : 'Preview & Import to Case'}>
                    <FileText size={16} />
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
  if (values.length === 0) return <div className="text-center py-10 text-slate-500 font-medium">No observables found</div>;
  const allSelected = values.length > 0 && selectedIds.length === values.length;
  return (
    <div className="ring-1 ring-slate-950 bg-slate-950/40 rounded-xl overflow-hidden shadow-2xl">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-950/60 text-slate-300 text-sm font-bold uppercase tracking-wider">
            <th className="w-12 px-4 py-4"><input type="checkbox" className="bg-slate-800/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={allSelected} onChange={onToggleAll} /></th>
            <th className="w-20 px-4 py-4 text-center"><SortBtn field="tlp" label="TLP" tooltip="Traffic Light Protocol (TLP)" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-32 px-4 py-4 flex items-center gap-1.5">Attributes <InfoTooltip content="Detection indicator attributes"><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip></th>
            <th className="w-36 px-4 py-4"><SortBtn field="data_type" label="Data Type" tooltip="Data category type" spec={sortSpec} onSort={onSort} /></th>
            <th className="px-4 py-4 min-w-[250px]"><SortBtn field="data" label="Value" tooltip="Observed data value" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-48 px-4 py-4 flex items-center gap-1.5">Linked Case <InfoTooltip content="Associated investigation case"><span className="cursor-help"><Info size={12} className="text-slate-500 hover:text-blue-400" /></span></InfoTooltip></th>
            <th className="w-32 px-4 py-4"><SortBtn field="created_by" label="Created by" tooltip="SOC analyst who created" spec={sortSpec} onSort={onSort} /></th>
            <th className="w-40 px-4 py-4 text-right"><SortBtn field="created_at" label="Created at" tooltip="Time data was recorded" spec={sortSpec} onSort={onSort} /></th>
          </tr>
        </thead>
        <tbody className="text-sm bg-slate-900/10">
          {values.map((item) => (
            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors group odd:bg-slate-950/5 even:bg-slate-900/5">
              <td className="px-4 py-4"><input type="checkbox" className="bg-slate-900/50 border border-white/10 rounded text-blue-500 focus:ring-0" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} /></td>
              <td className="px-4 py-4 text-center"><span className={`inline-block w-4 h-4 rounded-full bg-tlp-${item.tlp} shadow-[0_0_6px_rgba(255,255,255,0.1)] border border-white/10`} /></td>
              <td className="px-4 py-4 text-xs text-slate-400">
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-medium">{item.ioc ? <CheckCircle2 size={14} className="text-yellow-500 drop-shadow-[0_0_3px_rgba(234,179,8,0.5)]" /> : null}{item.ioc ? 'IOC Indicator' : 'Standard Info'}</span>
                  <span>{item.sighted ? 'Sighted' : 'Not Sighted'}</span>
                  <span>{item.ignore_similarity ? 'Ignore Similarity' : 'Similarity Match'}</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <a href={`/observables/${item.id}`} className="text-blue-400 hover:text-blue-300 font-semibold text-base transition-colors">{item.data_type}</a>
                {item.attachment_id && <div className="mt-2"><span className="glass-badge px-2 py-0.5">Attachment</span></div>}
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
              <td className="px-4 py-4 text-right text-sm text-slate-400 whitespace-nowrap"><div>{formatDate(item.created_at)}</div></td>
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
    ? 'Session expired. Please log out and log in again.'
    : error instanceof Error ? error.message : `Failed to load ${entity}`;
  return <div className="empty-message m-4"><strong>Failed to load {entity}</strong><br /><span>{detail}</span></div>;
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
    0: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
    1: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.15)]',
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
  if (s === 'open' || s === 'incidents') return 'glass-status-pill glass-pill-danger shadow-[0_0_8px_rgba(239,68,68,0.2)]';
  if (s === 'need confirm') return 'glass-status-pill glass-pill-warning shadow-[0_0_8px_rgba(245,158,11,0.2)]';
  if (s === 'inprogress') return 'glass-status-pill glass-pill-blue shadow-[0_0_8px_rgba(59,130,246,0.2)]';
  if (s === 'duplicated') return 'glass-status-pill glass-pill-muted';
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

/* ─── ELK SIEM Fields View components ──────────────────────────────────────── */

function renderCellValue(item: CaseSummary, field: string) {
  const val = item[field as keyof CaseSummary];
  if (val === undefined || val === null) return <span className="text-slate-500">-</span>;

  switch (field) {
    case 'number':
      return <span className="font-mono text-slate-300">#{String(val).padStart(7, '0')}</span>;
    case 'title':
      return (
        <a href={`/cases/${item.id}`} className="text-blue-400 hover:text-blue-300 hover:underline font-semibold block truncate max-w-md">
          {item.flag && <Flag size={12} className="inline text-red-500 mr-1.5" />}
          {String(val)}
        </a>
      );
    case 'status':
      return <span className={caseStatusClass(String(val))}>{String(val)}</span>;
    case 'severity':
      return <Severity value={Number(val)} />;
    case 'tlp':
      return <span className={`px-2 py-0.5 rounded text-xs font-bold text-white bg-tlp-${val}`}>TLP:{val}</span>;
    case 'pap':
      return <span className={`px-2 py-0.5 rounded text-xs font-bold text-white bg-tlp-${val}`}>PAP:{val}</span>;
    case 'tags':
      return <TagList tags={val as string[]} />;
    case 'created_at':
    case 'updated_at':
      return <span className="text-xs text-slate-400 font-mono">{formatDate(String(val))}</span>;
    default:
      if (Array.isArray(val)) return <span className="text-slate-300">{val.join(', ')}</span>;
      if (typeof val === 'boolean') return <span className={val ? "text-green-400 font-bold" : "text-slate-500"}>{val ? 'True' : 'False'}</span>;
      return <span className="text-slate-300 truncate block max-w-xs">{String(val)}</span>;
  }
}

function FieldsViewPanel({ values, selectedFields }: {
  values: CaseSummary[];
  selectedFields: string[];
}) {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const totalWidth = 48 + selectedFields.reduce((sum, fKey) => sum + (fieldWidths[fKey] ?? 150), 0);

  return (
    <div className="w-full min-h-[500px] flex flex-col">
      {/* Flat Grid Table Container */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/20 ring-1 ring-slate-950 rounded-xl shadow-lg">
        {values.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-medium flex-1 flex items-center justify-center">No case data found</div>
        ) : (
          <div className="overflow-x-auto glass-scroll w-full flex-1">
            <table className="text-left border-collapse table-fixed" style={{ width: totalWidth, minWidth: '100%' }}>
              <colgroup>
                <col style={{ width: 48 }} />
                {selectedFields.map((fKey) => (
                  <col key={fKey} style={{ width: fieldWidths[fKey] ?? 150 }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-950/60 text-slate-300 text-sm font-bold uppercase tracking-wider">
                  <th className="px-4 py-4 text-center">#</th>
                  {selectedFields.map((fKey) => {
                    const matched = availableFields.find(af => af.key === fKey);
                    return (
                      <th key={fKey} className="px-4 py-4 truncate">
                        {matched ? matched.label : fKey}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="text-sm bg-slate-900/10">
                {values.map((item, idx) => {
                  const expanded = expandedRows.includes(item.id);
                  return (
                    <Fragment key={item.id}>
                      <tr 
                        className={`hover:bg-slate-800/40 transition-colors group cursor-pointer odd:bg-slate-950/5 even:bg-slate-900/5 ${expanded ? 'bg-slate-800/20' : ''}`} 
                        onClick={() => toggleRow(item.id)}
                      >
                        <td className="px-4 py-4 text-center text-slate-500 font-medium" onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="text-slate-400 hover:text-blue-400 transition-colors p-1"
                            onClick={() => toggleRow(item.id)}
                          >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        {selectedFields.map((fKey, i) => (
                          <td key={fKey} className={`px-4 py-4 truncate ${i === 0 ? 'font-semibold text-slate-200' : 'text-slate-300'}`}>
                            {renderCellValue(item, fKey)}
                          </td>
                        ))}
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={selectedFields.length + 1} className="bg-slate-950/70 p-0">
                            <div className="py-4 px-0 w-full">
                              <RowDetailPanel item={item} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RowFieldItem({ field, label, value, rawValue }: { field: string; label: string; value: React.ReactNode; rawValue: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(rawValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-4 hover:bg-slate-900/30 group transition-all duration-200 items-start border-none" style={{ border: 'none' }}>
      <div className="col-span-1 font-mono text-sm text-slate-400 font-semibold select-all truncate pr-2" title={label}>
        {field}
      </div>
      <div className="col-span-3 text-slate-200 text-sm relative pr-12 break-all whitespace-normal">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">{value}</div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute right-0 top-0">
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded hover:bg-slate-800 transition-all border ${
                copied 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]' 
                  : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
              title="Copy value"
            >
              {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function RowDetailPanel({ item }: { item: CaseSummary }) {
  const [viewMode, setViewMode] = useState<'fields' | 'json'>('fields');
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyRawLog = () => {
    const rawLog = item.summary || (item as any).message || (item as any).rawlog || (item as any).raw_log || JSON.stringify(item, null, 2);
    navigator.clipboard.writeText(rawLog);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const allFields = [
    { 
      field: '_id', 
      label: 'ID', 
      value: <span className="font-mono text-slate-400 select-all">{item.id}</span>, 
      rawValue: item.id 
    },
    { 
      field: 'number', 
      label: 'Case Number', 
      value: <span className="font-mono text-blue-400 font-semibold">#{String(item.number).padStart(7, '0')}</span>, 
      rawValue: `#${String(item.number).padStart(7, '0')}` 
    },
    { 
      field: 'title', 
      label: 'Title', 
      value: <span className="text-slate-100 font-medium whitespace-pre-wrap leading-relaxed">{item.title}</span>, 
      rawValue: item.title 
    },
    { 
      field: 'status', 
      label: 'Status', 
      value: <span className={caseStatusClass(item.status)}>{item.status}</span>, 
      rawValue: item.status 
    },
    { 
      field: 'severity', 
      label: 'Severity', 
      value: <Severity value={item.severity} />, 
      rawValue: severityLabels[item.severity] || String(item.severity) 
    },
    { 
      field: 'tlp', 
      label: 'TLP', 
      value: <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold text-white bg-tlp-${item.tlp} shadow-sm shadow-black/20`}>TLP:{item.tlp}</span>, 
      rawValue: `TLP:${item.tlp}` 
    },
    { 
      field: 'pap', 
      label: 'PAP', 
      value: <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold text-white bg-tlp-${item.pap} shadow-sm shadow-black/20`}>PAP:{item.pap}</span>, 
      rawValue: `PAP:${item.pap}` 
    },
    { 
      field: 'owner', 
      label: 'Owner', 
      value: item.owner ? <span className="text-slate-200">{item.owner}</span> : <span className="text-slate-500 italic">Unknown</span>, 
      rawValue: item.owner || '' 
    },
    { 
      field: 'assignee', 
      label: 'Assignee', 
      value: item.assignee ? <span className="text-slate-200">{item.assignee}</span> : <span className="text-slate-500 italic">Unassigned</span>, 
      rawValue: item.assignee || '' 
    },
    { 
      field: 'tags', 
      label: 'Tags', 
      value: <TagList tags={item.tags} />, 
      rawValue: item.tags.join(', ') 
    },
    { 
      field: 'case_template', 
      label: 'Case Template', 
      value: item.case_template ? <span className="text-slate-200">{item.case_template}</span> : <span className="text-slate-500 italic">-</span>, 
      rawValue: item.case_template || '' 
    },
    { 
      field: 'summary', 
      label: 'Summary', 
      value: item.summary ? <div className="text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto glass-scroll pr-2">{item.summary}</div> : <span className="text-slate-500 italic">No description</span>, 
      rawValue: item.summary || '' 
    },
    { 
      field: 'impact_status', 
      label: 'Impact', 
      value: item.impact_status ? <span className="text-slate-200">{item.impact_status}</span> : <span className="text-slate-500 italic">-</span>, 
      rawValue: item.impact_status || '' 
    },
    { 
      field: 'resolution_status', 
      label: 'Resolution', 
      value: item.resolution_status ? <span className="text-slate-200">{item.resolution_status}</span> : <span className="text-slate-500 italic">-</span>, 
      rawValue: item.resolution_status || '' 
    },
    { 
      field: 'created_at', 
      label: 'Created at', 
      value: <span className="font-mono text-slate-400">{formatDate(item.created_at)}</span>, 
      rawValue: formatDate(item.created_at) 
    },
    { 
      field: 'updated_at', 
      label: 'Updated at', 
      value: <span className="font-mono text-slate-400">{formatDate(item.updated_at)}</span>, 
      rawValue: formatDate(item.updated_at) 
    }
  ];

  const filteredFields = allFields.filter(f => 
    f.field.toLowerCase().includes(filterQuery.toLowerCase()) || 
    f.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
    f.rawValue.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col bg-slate-950/65 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/5 backdrop-blur-md w-full overflow-hidden transition-all duration-300 hover:border-white/10">
      {/* Thanh Điều Hướng Chế Độ Xem */}
      <div className="flex justify-between items-center gap-3 border-b border-slate-900 px-6 py-4 bg-slate-950/20">
        <div className="flex gap-2 bg-slate-900/60 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setViewMode('fields')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              viewMode === 'fields'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List size={14} /> Details
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              viewMode === 'json'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} /> Raw JSON Data
          </button>
        </div>

        {/* Nút Sao Chép Nhanh (chỉ hiển thị khi ở tab JSON) */}
        {viewMode === 'json' && (
          <div className="flex gap-2">
            <button 
              onClick={handleCopyRawLog}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1.5 shadow-md ${
                copiedRaw 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.2)] font-bold'
                  : 'bg-slate-850 hover:bg-slate-800 active:bg-slate-900 text-slate-300 border border-white/5'
              }`}
            >
              {copiedRaw ? (
                <span>✓ Copied Raw Log</span>
              ) : (
                <>
                  <Copy size={10} /> Copy Raw Log
                </>
              )}
            </button>
            <button 
              onClick={handleCopyJson}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1.5 shadow-md ${
                copiedJson 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.2)] font-bold'
                  : 'bg-slate-850 hover:bg-slate-800 active:bg-slate-900 text-slate-300 border border-white/5'
              }`}
            >
              {copiedJson ? (
                <span>✓ Copied JSON</span>
              ) : (
                <>
                  <Copy size={10} /> Copy JSON
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Nội Dung Tương Ứng Chế Độ Xem */}
      <div className="w-full">
        {viewMode === 'fields' && (
          <div className="flex flex-col gap-4 p-6 border-t border-slate-900/80 bg-slate-950/45 rounded-b-2xl">
            {/* Thanh tìm kiếm và bộ lọc trường */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-900/30 p-3 rounded-xl !border-none" style={{ border: 'none' }}>
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Filter fields (name, label, or value)..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-900/50 focus:border-blue-500/50 rounded-lg pl-10 pr-9 py-2.5 text-sm text-slate-200 placeholder-slate-500 transition-all focus:outline-none focus:ring-0"
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title="Clear search"
                  >
                    <Times size={12} />
                  </button>
                )}
              </div>
              
              <div className="text-xs text-slate-400 font-medium px-1 flex items-center gap-1.5 select-none">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Showing <strong className="text-blue-400 font-semibold font-mono">{filteredFields.length}</strong> / <span className="font-mono">{allFields.length}</span> fields
              </div>
            </div>

            {/* Bảng danh sách các trường dạng Div Grid phẳng và sạch sẽ */}
            <div className="overflow-hidden bg-slate-950/40 rounded-xl shadow-inner border-none" style={{ border: 'none' }}>
              <div className="max-h-[480px] overflow-y-auto glass-scroll">
                <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-slate-900/40 text-xs font-bold uppercase tracking-wider text-slate-400 select-none border-none" style={{ border: 'none' }}>
                  <div className="col-span-1">Field Name</div>
                  <div className="col-span-3">Property Value</div>
                </div>
                <div className="flex flex-col border-none" style={{ border: 'none' }}>
                  {filteredFields.length > 0 ? (
                    filteredFields.map((f) => (
                      <RowFieldItem 
                        key={f.field} 
                        field={f.field} 
                        label={f.label} 
                        value={f.value} 
                        rawValue={f.rawValue} 
                      />
                    ))
                  ) : (
                    <div className="text-center py-10 text-slate-500 font-medium">
                      No fields match the keyword
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'json' && (
          <div className="w-full">
            <div className="bg-slate-950/80 p-6 font-mono text-sm leading-relaxed text-slate-100 h-[520px] max-h-[550px] overflow-auto glass-scroll select-all shadow-inner w-full border-t border-slate-900 rounded-b-2xl">
              <pre className="whitespace-pre text-left">{JSON.stringify(item, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
