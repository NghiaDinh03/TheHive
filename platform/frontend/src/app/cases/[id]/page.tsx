'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';
import { canUse } from '@/lib/permissions';
import { Users, Activity } from 'lucide-react';

// Import our new clean subcomponents
import DetailsTab from '@/components/case-detail/DetailsTab';
import TasksTab from '@/components/case-detail/TasksTab';
import ObservablesTab from '@/components/case-detail/ObservablesTab';
import LiveChatTab from '@/components/case-detail/LiveChatTab';
import AIAssistantTab from './AIAssistantTab';
import SmartCloseCaseDialog from '@/components/case-detail/SmartCloseCaseDialog';
import ThreatMap from '@/components/ThreatMap';
import ClusteredAlertsTab from '@/components/case-detail/ClusteredAlertsTab';

// Import types
import { CaseDetail, CaseCore, User, History } from '@/components/case-detail/types';
import { Severity, Tlp } from '@/components/Badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FlowPanel } from '@/components/FlowPanel';
import IncidentReportModal from '@/components/IncidentReportModal';

const TABS = ['Details', 'Tasks', 'Observables', 'Live Chat', 'Threat Map', 'Clustered Alerts', 'CyberAI Analyst'] as const;
type TabName = typeof TABS[number];

const TAB_LABELS: Record<TabName, string> = {
  'Details': 'Details',
  'Tasks': 'Tasks',
  'Observables': 'Observables',
  'Live Chat': 'Live Chat',
  'Threat Map': 'Threat Map',
  'Clustered Alerts': 'Clustered Alerts',
  'CyberAI Analyst': 'CyberAI Analyst'
};

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Details');
  
  // Dialog States
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dupCaseId, setDupCaseId] = useState('');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeSearchType, setMergeSearchType] = useState<'title' | 'number'>('title');
  const [mergeSearchInput, setMergeSearchInput] = useState('');
  const [mergeResults, setMergeResults] = useState<CaseCore[]>([]);
  const [selectedMergeCase, setSelectedMergeCase] = useState<CaseCore | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAuditPopup, setShowAuditPopup] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [relatedFilter, setRelatedFilter] = useState('');
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignForm, setReassignForm] = useState({ assignee: '', reason: '' });
  
  // Anti-Noise Audit Log Filter States
  const [showAllAudits, setShowAllAudits] = useState(false);

  // Forms passed to children (maintaining API state structure)
  const [logMessage, setLogMessage] = useState('');
  const [cfForm, setCfForm] = useState({ name: '', value: '', field_type: 'string' });
  const [obsForm, setObsForm] = useState({ data_type: 'ip', data: '', message: '', tlp: 2, ioc: false, sighted: false, tags: '' });

  const searchUsers = async (q: string) => {
    try {
      const data = await apiFetch<{ login: string; name: string }[]>(`/api/v1/users/search?query=${encodeURIComponent(q)}`);
      return data;
    } catch { return []; }
  };

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const [activeAnalysts, setActiveAnalysts] = useState<string[]>([]);
  const [wsNotifications, setWsNotifications] = useState<{ id: string; message: string }[]>([]);

  // Web Audio API to play soft ping sound on event
  const playSoftPing = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  useEffect(() => {
    if (!authedLogin || !params.id) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectDelay = 1000;

    const connect = () => {
      const token = sessionStorage.getItem('thehive.token') || localStorage.getItem('thehive.token') || '';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8089' : window.location.host;
      const wsUrl = `${protocol}//${host}/api/v1/cases/${params.id}/room?token=${encodeURIComponent(token)}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectDelay = 1000;
        console.log('WebSocket Case Room connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'presence') {
            setActiveAnalysts(msg.payload || []);
          } else if (msg.type === 'activity') {
            const act = msg.payload?.action || 'updated';
            const user = msg.username || 'Someone';
            const notificationMsg = `Phân tích viên ${user} vừa ${act} sự cố!`;
            
            const notifId = Math.random().toString(36).substr(2, 9);
            setWsNotifications(prev => [...prev, { id: notifId, message: notificationMsg }]);
            
            setTimeout(() => {
              setWsNotifications(prev => prev.filter(n => n.id !== notifId));
            }, 5000);

            playSoftPing();
            void detail.refetch();
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log(`WebSocket disconnected. Retrying in ${reconnectDelay}ms...`);
        reconnectTimeout = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws?.close();
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [authedLogin, params.id]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const detail = useQuery({ queryKey: ['case-detail-full', params.id], queryFn: () => apiFetch<CaseDetail>(`/api/v1/cases/${params.id}`), enabled: !!authedLogin && !!params.id });
  const item = detail.data?.case;

  const canWrite = canUse(me.data, 'caseUpdate');
  const refetch = () => void detail.refetch();

  const updateCase = useMutation({
    mutationFn: (patch?: Record<string, unknown>) =>
      apiFetch(`/api/v1/cases/${params.id}`, { method: 'PATCH', json: patch }),
    onSuccess: refetch
  });

  const closeCase = useMutation({
    mutationFn: (payload: { impact_status: string; resolution_status: string; summary: string }) =>
      apiFetch(`/api/v1/cases/${params.id}/close`, { method: 'POST', json: payload }),
    onSuccess: () => { setShowCloseDialog(false); refetch(); }
  });

  const reopenCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/reopen`, { method: 'POST' }), onSuccess: refetch });
  const deleteCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}`, { method: 'DELETE' }), onSuccess: () => router.replace('/investigation?tab=cases') });
  const toggleFlag = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}`, { method: 'PATCH', json: { flag: !item?.flag } }), onSuccess: refetch });
  const duplicateCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/duplicate`, { method: 'POST', json: { target_case_id: dupCaseId } }), onSuccess: () => { setDupCaseId(''); refetch(); } });
  
  const mergeCase = useMutation({
    mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/merge`, { method: 'POST', json: { target_case_id: selectedMergeCase?.id } }),
    onSuccess: () => { setShowMergeDialog(false); setSelectedMergeCase(null); setMergeSearchInput(''); setMergeResults([]); refetch(); }
  });

  const searchMergeCases = async (type: string, input: string) => {
    if (!input.trim() || input.trim().length < 2) { setMergeResults([]); return; }
    try {
      const p = new URLSearchParams({ range: '0:9' });
      if (type === 'number') p.set('number', input.trim());
      else p.set('title', input.trim());
      const data = await apiFetch<{ values: CaseCore[] }>(`/api/v1/cases?${p}`);
      setMergeResults((data.values ?? []).filter(c => c.id !== item?.id));
    } catch { setMergeResults([]); }
  };

  const exportCase = async () => {
    try {
      const data = await apiFetch<CaseDetail>(`/api/v1/cases/${params.id}`);
      const blob = exportFormat === 'json'
        ? new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        : new Blob([caseToCsv(data)], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `case-${item?.number ?? params.id}.${exportFormat}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch { /* ignore */ }
  };

  const appendLog = useMutation({
    mutationFn: async (file: File | null) => {
      let attachment_id = '';
      if (file) {
        const init = await apiFetch<{ id: string; upload_url: string }>('/api/v1/attachments/upload', {
          method: 'POST',
          json: { case_id: params.id, file_name: file.name, content_type: file.type || 'application/octet-stream', size_bytes: file.size }
        });
        const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!put.ok) throw new Error('Upload failed');
        await apiFetch(`/api/v1/attachments/${init.id}/scan`, { method: 'POST', json: { status: 'clean', engine: 'manual-ui-smoke' } });
        attachment_id = init.id;
      }
      return apiFetch(`/api/v1/cases/${params.id}/logs`, { method: 'POST', json: { message: logMessage, attachment_id } });
    },
    onSuccess: () => { setLogMessage(''); refetch(); }
  });

  const createObs = useMutation({
    mutationFn: async (file: File | null) => {
      let attachment_id = '';
      let data = obsForm.data;
      let data_type = obsForm.data_type;
      if (file) {
        data_type = 'file';
        data = data.trim() || file.name;
        const init = await apiFetch<{ id: string; upload_url: string }>('/api/v1/attachments/upload', {
          method: 'POST',
          json: { case_id: params.id, file_name: file.name, content_type: file.type || 'application/octet-stream', size_bytes: file.size }
        });
        const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!put.ok) throw new Error('Observable file upload failed');
        await apiFetch(`/api/v1/attachments/${init.id}/scan`, { method: 'POST', json: { status: 'clean', engine: 'manual-ui-smoke' } });
        attachment_id = init.id;
      }
      return apiFetch(`/api/v1/observables`, {
        method: 'POST',
        json: {
          case_id: params.id,
          data_type,
          data,
          message: obsForm.message,
          tlp: obsForm.tlp,
          ioc: obsForm.ioc,
          sighted: obsForm.sighted,
          attachment_id,
          tags: obsForm.tags ? obsForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
        }
      });
    },
    onSuccess: () => { setObsForm({ data_type: 'ip', data: '', message: '', tlp: 2, ioc: false, sighted: false, tags: '' }); refetch(); }
  });

  const patchObs = useMutation({ mutationFn: ({ obsId, patch }: { obsId: string; patch: Record<string, unknown> }) => apiFetch(`/api/v1/observables/${obsId}`, { method: 'PATCH', json: patch }), onSuccess: refetch });
  const deleteObs = useMutation({ mutationFn: (obsId: string) => apiFetch(`/api/v1/observables/${obsId}`, { method: 'DELETE' }), onSuccess: refetch });

  const error = [updateCase, closeCase, reopenCase, deleteCase, appendLog, createObs].map(m => (m.error as Error | undefined)?.message).find(Boolean);

  // Anti-Noise filter for Audit log sidebar
  const coreAuditActions = ['case.create', 'case.close', 'case.reopen', 'case.update', 'observable.create', 'task.create'];
  const rawHistory = detail.data?.history ?? [];
  const filteredHistory = showAllAudits
    ? rawHistory
    : rawHistory.filter(h => coreAuditActions.includes(h.action) || h.action.toLowerCase().includes('assign'));

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ?? { login: authedLogin }} />
        <main className="content-wrapper flex-1 overflow-y-auto">
          <section className="p-6">
            {/* Action Bar Header */}
            <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl mb-6 z-20 relative">
              <div className="px-6 py-4 flex justify-between items-center">
                <h3 className="text-blue-400 font-bold text-base flex items-center gap-2">
                  #{item?.number ? String(item.number).padStart(7, '0') : '...'} - <span className="text-slate-200">{item?.title ?? 'Case Details'}</span>
                </h3>
                <div className="flex bg-slate-900/50 ring-1 ring-slate-800 rounded-xl p-1 items-stretch shadow-inner">
                  <div className="flex items-center px-3">
                    <span className={statusLabelClass(item?.status)}>{item?.status === 'Open' ? 'Open' : item?.status === 'Resolved' ? 'Closed' : item?.status === 'Duplicated' ? 'Duplicated' : item?.status ?? 'Loading'}</span>
                  </div>
                  {item?.flag && (
                    <div className="flex items-center px-2">
                      <span className="px-2 py-0.5 rounded-lg text-[9.5px] bg-red-900/20 text-red-400 border border-red-800/20 uppercase font-bold tracking-wider" title="Case is flagged">Flagged</span>
                    </div>
                  )}
                  <div className="w-px bg-slate-800 mx-1 my-1"></div>
                  <button className="px-4 py-1.5 mx-1 bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-bold uppercase transition-all shadow-sm flex items-center gap-1.5" onClick={() => setShowReportModal(true)} title="Generate PDF Report">
                    Report PDF
                  </button>
                  <div className="w-px bg-slate-800 mx-1 my-1"></div>
                  {item?.status === 'Open' ? (
                    <button className="px-4 py-1.5 mx-1 bg-red-600/15 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-bold uppercase transition-all shadow-sm flex items-center" onClick={() => setShowCloseDialog(true)} title="Close this case">Close Case</button>
                  ) : (
                    <button className={`px-4 py-1.5 mx-1 bg-yellow-600/15 hover:bg-yellow-600/30 text-yellow-400 rounded-lg text-xs font-bold uppercase transition-all shadow-sm flex items-center ${!canWrite || reopenCase.isPending ? 'opacity-30 cursor-not-allowed' : ''}`} disabled={!canWrite || reopenCase.isPending} onClick={() => reopenCase.mutate()} title="Reopen this case">Reopen</button>
                  )}
                  <div className="w-px bg-slate-800 mx-1 my-1"></div>
                  <div className="relative flex">
                    <button className="px-4 py-1.5 bg-slate-900/50 hover:bg-slate-900 text-slate-300 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1 shadow-sm" onClick={() => setShowActionsDropdown(!showActionsDropdown)} title="Other actions">
                      Actions <span className="text-[9px]">▼</span>
                    </button>
                    {showActionsDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-44 bg-slate-950 border border-slate-900 rounded-xl shadow-2xl z-50 overflow-hidden text-left p-1 animate-in fade-in duration-100">
                        <button className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 rounded-lg transition-colors" disabled={!canWrite} onClick={() => { setShowActionsDropdown(false); toggleFlag.mutate(); }} title="Change flag status">{item?.flag ? 'Unflag' : 'Flag case'}</button>
                        <button className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 rounded-lg transition-colors" disabled={!canWrite} onClick={() => { setShowActionsDropdown(false); setShowMergeDialog(true); }} title="Merge into another case">Merge case</button>
                        <button className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 rounded-lg transition-colors" onClick={() => { setShowActionsDropdown(false); setShowExportDialog(true); }} title="Export case data">Export data</button>
                        <div className="border-t border-slate-900 my-1"></div>
                        <button className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/20 rounded-lg transition-colors" disabled={!canWrite || deleteCase.isPending} onClick={() => { setShowActionsDropdown(false); setShowDeleteDialog(true); }} title="Permanently delete this case">Delete case</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Inner Tabs navigation */}
            <div className="flex gap-6 items-stretch">
              <section className="flex-1 flex flex-col min-w-0">
                <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl px-6 py-1 mb-6 flex items-center shrink-0">
                  <ul className="flex flex-wrap text-xs font-bold uppercase tracking-wider text-slate-500 w-full gap-6">
                    {TABS.map(tab => (
                      <li key={tab}>
                        <button 
                          type="button" 
                          onClick={() => setActiveTab(tab)}
                          className={`inline-block py-3 border-b-2 transition-all duration-150 ${activeTab === tab ? 'text-blue-400 border-blue-500 font-extrabold shadow-sm' : 'border-transparent hover:text-slate-300'}`}
                        >
                          <span className="flex items-center gap-1.5 select-none">
                            {TAB_LABELS[tab]}
                            {tab === 'Tasks' && <span className="px-1.5 py-0.5 rounded-lg text-[9px] bg-slate-900 text-slate-400 ring-1 ring-slate-800">{detail.data?.tasks.length ?? 0}</span>}
                            {tab === 'Observables' && <span className="px-1.5 py-0.5 rounded-lg text-[9px] bg-blue-950 text-blue-400 ring-1 ring-blue-900/20">{detail.data?.observables.length ?? 0}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              
              {/* Tab Contents */}
              <div className="flex flex-col gap-6 flex-1">
                {error && <div className="p-3 text-xs text-red-400 rounded-xl bg-red-950/25 border border-red-900/30">{error}</div>}
                {detail.isLoading && <div className="text-slate-500 text-xs italic py-12 select-none text-center">Loading case records...</div>}
                {detail.isError && (
                  <div className="p-6 text-center border border-red-900/30 rounded-2xl bg-red-950/20 shadow-md my-4">
                    <p className="font-semibold text-red-400 text-sm mb-2">An error occurred while loading case details</p>
                    <p className="text-xs text-slate-500">{(detail.error as Error)?.message || 'Unknown backend API connection error.'}</p>
                    <button onClick={() => refetch()} className="mt-4 px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 ring-1 ring-blue-500/20 rounded-lg text-xs font-bold uppercase transition-all">Retry Connection</button>
                  </div>
                )}
                {item && activeTab === 'Details' && (
                  <DetailsTab
                    item={item}
                    customFields={detail.data?.custom_fields ?? []}
                    updateCase={updateCase}
                    canWrite={canWrite}
                    relatedCases={detail.data?.related_cases ?? []}
                    responderActions={detail.data?.responder_actions ?? []}
                    relatedFilter={relatedFilter}
                    setRelatedFilter={setRelatedFilter}
                    searchUsers={searchUsers}
                    meLogin={me.data?.login}
                    triggerReassign={(newAssignee) => { setReassignForm({ assignee: newAssignee, reason: '' }); setShowReassignDialog(true); }}
                  />
                )}
                {item && activeTab === 'Tasks' && (
                  <TasksTab
                    tasks={detail.data?.tasks ?? []}
                    attachments={detail.data?.attachments ?? []}
                    user={me.data}
                    caseId={params.id}
                    canWrite={canWrite}
                    searchUsers={searchUsers}
                    refetch={refetch}
                  />
                )}
                {item && activeTab === 'Observables' && (
                  <ObservablesTab
                    observables={detail.data?.observables ?? []}
                    canWrite={canWrite}
                    obsForm={obsForm}
                    setObsForm={setObsForm}
                    createObs={createObs}
                    patchObs={patchObs}
                    deleteObs={deleteObs}
                    caseId={params.id}
                  />
                )}
                {item && activeTab === 'Live Chat' && (
                  <LiveChatTab
                    logs={detail.data?.logs ?? []}
                    logMessage={logMessage}
                    setLogMessage={setLogMessage}
                    appendLog={appendLog}
                    canWrite={canWrite}
                    me={me.data?.login}
                  />
                )}
                {item && activeTab === 'Threat Map' && (
                  <ThreatMap caseId={params.id} />
                )}
                {item && activeTab === 'Clustered Alerts' && (
                  <ClusteredAlertsTab caseId={params.id} />
                )}
                {item && activeTab === 'CyberAI Analyst' && (
                  <AIAssistantTab
                    caseId={params.id}
                    initialAssessment={item.ai_assessment}
                    canWrite={canWrite}
                  />
                )}
              </div>
            </section>
            
            {/* Sidebar Columns drawer (Context and Audits) */}
            <aside className="w-[320px] shrink-0 flex flex-col gap-6 ml-6">
              {/* Case Context — Quick Control Panel */}
              <div className="glass-panel flex-none flex flex-col min-h-0 shadow-2xl rounded-2xl bg-slate-950/40 overflow-hidden ring-1 ring-slate-900/60">
                <div className="px-5 py-3.5 bg-slate-900/40 shrink-0 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                  </svg>
                  <h3 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">Case Context</h3>
                </div>
                <div className="px-5 py-4 flex-1 flex flex-col gap-3.5 text-xs overflow-y-auto">
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]">Case number</span><span className="text-slate-300 font-semibold">#{item?.number ? String(item.number).padStart(7, '0') : '...'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]">Status</span><span className={statusLabelClass(item?.status)}>{item?.status === 'Open' ? 'Open' : item?.status === 'Resolved' ? 'Closed' : item?.status === 'Duplicated' ? 'Duplicated' : item?.status}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]" title="Case severity">Severity</span><span className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 ring-1 ring-slate-800 text-[10px] font-bold uppercase">{item?.severity === 0 ? 'Low' : item?.severity === 1 ? 'Medium' : item?.severity === 2 ? 'High' : 'Critical'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]">Assignee</span><span className="text-slate-300 font-semibold">{item?.assignee || <em className="text-yellow-500/80">Unassigned</em>}</span></div>
                  {item?.status !== 'Open' && <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]" title="Case resolution status">Resolution</span><span className="text-slate-300 font-semibold">{item?.resolution_status || <em className="text-slate-600">—</em>}</span></div>}
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]">Created at</span><span className="text-slate-400 font-mono text-[10px]">{item?.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-bold uppercase text-[10px]">Updated at</span><span className="text-slate-400 font-mono text-[10px]">{item?.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}</span></div>
                  
                  <button className="w-full mt-2 shrink-0 px-3 py-2 bg-blue-600/15 hover:bg-blue-600/30 ring-1 ring-blue-500/20 text-blue-400 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 shadow-sm" onClick={() => {
                    const sevMap = {1:'Low', 2:'Medium', 3:'High', 4:'Critical'};
                    const copyText = `Case ID: #${item?.number ? String(item.number).padStart(7, '0') : 'Unknown'}\nTitle: ${item?.title}\nSeverity: ${sevMap[item?.severity as keyof typeof sevMap] || 'Unknown'}\nStatus: ${item?.status}\nAssignee: ${item?.assignee || 'Unassigned'}`;
                    navigator.clipboard.writeText(copyText);
                  }} title="Copy Case details">
                    Copy Details
                  </button>
                </div>
              </div>

              {/* Active Analysts Panel */}
              <div className="glass-panel flex-none flex flex-col min-h-0 shadow-2xl rounded-2xl bg-slate-950/40 overflow-hidden ring-1 ring-slate-900/60">
                <div className="px-5 py-3.5 bg-slate-900/40 shrink-0 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <h3 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">Active Analysts ({activeAnalysts.length})</h3>
                </div>
                <div className="px-5 py-3 flex-1 flex flex-col gap-2 text-xs overflow-y-auto max-h-[140px]">
                  {activeAnalysts.length > 0 ? (
                    activeAnalysts.map(user => (
                      <div key={user} className="flex justify-between items-center bg-slate-900/30 px-3 py-2 rounded-lg ring-1 ring-slate-900/60">
                        <span className="text-slate-300 font-semibold">{user}</span>
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-[10.5px] text-center py-4 italic select-none">No active analysts in room.</div>
                  )}
                </div>
              </div>

              {/* Audit History Sidebar (Compact and Anti-Noise Filter) */}
              <div className="glass-panel flex-1 flex flex-col min-h-0 shadow-2xl rounded-2xl bg-slate-950/40 overflow-hidden ring-1 ring-slate-900/60">
                <div className="px-5 py-3.5 bg-slate-900/40 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    <h3 className="text-slate-200 font-bold text-xs uppercase tracking-wider select-none">Audit History</h3>
                  </div>
                  <button 
                    onClick={() => setShowAllAudits(!showAllAudits)}
                    className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {showAllAudits ? 'Hide Noise' : 'Show All'}
                  </button>
                </div>
                <div className="px-5 py-4 flex-1 overflow-y-auto pr-2">
                  {filteredHistory.length > 0 ? (
                    <FlowPanel
                      items={filteredHistory.slice(0, 8).map((h, i) => ({
                        id: `${h.action}-${i}`,
                        objectType: h.entity_type || 'case',
                        action: h.action,
                        objectId: item?.id ?? '',
                        objectTitle: item?.title,
                        actorId: h.actor_id,
                        createdAt: h.created_at,
                        beforeJson: h.before_json,
                        afterJson: h.after_json,
                      }))}
                      showActor={false}
                    />
                  ) : (
                    <div className="text-slate-500 text-[10.5px] text-center py-8 italic select-none">No relevant activity records.</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
          </section>
        </main>
      </div>

      {/* Smart Close Dialog */}
      {showCloseDialog && item && (
        <SmartCloseCaseDialog
          item={item}
          tasks={detail.data?.tasks ?? []}
          observables={detail.data?.observables ?? []}
          onClose={() => setShowCloseDialog(false)}
          confirmClose={closeCase}
        />
      )}

      {/* Reassign Dialog */}
      {showReassignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 bg-slate-950/95 ring-1 ring-slate-900/60 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-slate-300">
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2">Re-assign Case</h4>
            <p className="text-slate-400 text-xs mb-4">You are re-assigning this Case to <strong className="text-blue-400">{reassignForm.assignee}</strong>. Please provide a reason for escalation or shift handover.</p>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 select-none">Reason</label>
            <textarea autoFocus className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 shadow-inner" rows={3} value={reassignForm.reason} onChange={e => setReassignForm(f => ({ ...f, reason: e.target.value }))} placeholder="Provide details..." />
            <div className="flex gap-3 mt-6 justify-end">
              <button className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold uppercase transition-all" onClick={() => setShowReassignDialog(false)}>Cancel</button>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50" disabled={updateCase.isPending || !reassignForm.reason.trim()} onClick={async () => {
                if (!reassignForm.reason.trim()) return;
                setShowReassignDialog(false);
                try {
                  await apiFetch(`/api/v1/cases/${item?.id}/logs`, { method: 'POST', json: { message: `Re-assigned from **${item?.assignee}** to **${reassignForm.assignee}**.\n\n**Reason:** ${reassignForm.reason}` } });
                  updateCase.mutate({ assignee: reassignForm.assignee });
                } catch { updateCase.mutate({ assignee: reassignForm.assignee }); }
              }}>Confirm Re-assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <ConfirmDialog open={showDeleteDialog} title="Delete Case" message="Are you absolutely sure you want to permanently delete this Case? This action is irreversible and all logs, tasks, observables will be lost forever." pending={deleteCase.isPending} onCancel={() => setShowDeleteDialog(false)} onConfirm={() => deleteCase.mutate()} />
      
      {/* Merge Dialog */}
      {showMergeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 bg-slate-950/95 ring-1 ring-slate-900/60 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-slate-300">
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2">Merge Case</h4>
            <p className="text-slate-400 text-xs mb-4">Merge tasks, observables, and logs of this Case into another target Case. This Case will be marked as Duplicated.</p>
            <div className="flex gap-2 mb-4 bg-slate-900/50 p-1 rounded-xl ring-1 ring-slate-800">
              <button className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${mergeSearchType === 'title' ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/20' : 'text-slate-400'}`} onClick={() => setMergeSearchType('title')}>Search Title</button>
              <button className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${mergeSearchType === 'number' ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/20' : 'text-slate-400'}`} onClick={() => setMergeSearchType('number')}>Search Number</button>
            </div>
            <input type="text" className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/40" placeholder="Type at least 2 chars..." value={mergeSearchInput} onChange={e => { setMergeSearchInput(e.target.value); searchMergeCases(mergeSearchType, e.target.value); }} />
            {mergeResults.length > 0 && (
              <ul className="mt-3 bg-slate-900/80 rounded-xl ring-1 ring-slate-800 max-h-40 overflow-y-auto divide-y divide-slate-850 p-1">
                {mergeResults.map(c => (
                  <li key={c.id}>
                    <button className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-850 transition-colors flex justify-between ${selectedMergeCase?.id === c.id ? 'bg-blue-600/10 text-blue-400 font-bold' : 'text-slate-300'}`} onClick={() => setSelectedMergeCase(c)}>
                      <span className="truncate max-w-[200px]">#{c.number} - {c.title}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{c.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 mt-6 justify-end">
              <button className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold uppercase transition-all" onClick={() => setShowMergeDialog(false)}>Cancel</button>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50" disabled={!selectedMergeCase || mergeCase.isPending} onClick={() => mergeCase.mutate()}>Confirm Merge</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 bg-slate-950/95 ring-1 ring-slate-900/60 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-slate-300">
            <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-4 pb-2">Export Incident Data</h4>
            <div className="flex gap-4 mb-6">
              <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer"><input type="radio" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} className="accent-blue-500" /> Export JSON Format</label>
              <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer"><input type="radio" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} className="accent-blue-500" /> Export CSV Format</label>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold uppercase transition-all" onClick={() => setShowExportDialog(false)}>Cancel</button>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all" onClick={exportCase}>Download File</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {item && (
        <IncidentReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          caseId={item.id}
          caseNumber={item.number}
          caseTitle={item.title}
        />
      )}

      {/* WebSocket Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-none">
        {wsNotifications.map(notif => (
          <div key={notif.id} className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-md shadow-2xl text-xs font-medium text-slate-200 animate-in slide-in-from-bottom-5 duration-300 w-80">
            <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
            <div className="flex-1 break-words">{notif.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabelClass(status: string | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'open': return 'px-2.5 py-0.5 rounded-lg text-[9.5px] bg-red-500/10 text-red-400 uppercase font-bold tracking-wider ring-1 ring-red-500/20';
    case 'resolved': return 'px-2.5 py-0.5 rounded-lg text-[9.5px] bg-green-500/10 text-green-400 uppercase font-bold tracking-wider ring-1 ring-green-500/20';
    case 'duplicated': return 'px-2.5 py-0.5 rounded-lg text-[9.5px] bg-yellow-500/10 text-yellow-400 uppercase font-bold tracking-wider ring-1 ring-yellow-500/20';
    default: return 'px-2.5 py-0.5 rounded-lg text-[9.5px] bg-slate-800 text-slate-400 uppercase font-bold tracking-wider ring-1 ring-slate-800';
  }
}

function caseToCsv(data: CaseDetail): string {
  const c = data.case;
  const rows = [
    ['Field', 'Value'],
    ['Number', String(c.number)],
    ['Title', c.title],
    ['Description', c.description],
    ['Severity', String(c.severity)],
    ['TLP', String(c.tlp)],
    ['PAP', String(c.pap)],
    ['Status', c.status],
    ['Owner', c.owner],
    ['Assignee', c.assignee],
    ['Tags', c.tags?.join('; ') ?? ''],
    ['Impact', c.impact_status ?? ''],
    ['Resolution', c.resolution_status ?? ''],
    ['Template', c.case_template ?? ''],
    ['Start date', c.start_date ?? ''],
    ['End date', c.end_date ?? ''],
    ['Created', c.created_at],
    ['Updated', c.updated_at],
  ];
  data.tasks?.forEach((t, i) => {
    rows.push([`Task ${i + 1}`, `${t.title} [${t.status}] assignee=${t.assignee || 'none'} group=${t.group_name || 'default'}`]);
  });
  data.observables?.forEach((o, i) => {
    rows.push([`Observable ${i + 1}`, `[${o.data_type}] ${o.data} IOC=${o.ioc} sighted=${o.sighted}`]);
  });
  return rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
}
