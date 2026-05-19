'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AttachmentPanel, type AttachmentItem } from '@/components/AttachmentPanel';
import { ObservableFlags, Pap, Severity, TagList, TaskFlags, Tlp } from '@/components/Badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CustomFieldEditor, type CustomFieldDef } from '@/components/CustomFieldEditor';
import { InfoTooltip } from '@/components/ui/TooltipHelper';
import { Dropzone } from '@/components/Dropzone';
import { FlowPanel, type FlowItem } from '@/components/FlowPanel';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ObservableCreationModal, type ObservableCreationPayload } from '@/components/ObservableCreationModal';
import { PageSizer } from '@/components/PageSizer';
import { SharingModal, type ShareItem } from '@/components/SharingModal';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { UpdatableDate, UpdatableSelect, UpdatableSimpleText, UpdatableTags, UpdatableText, UpdatableUser } from '@/components/Updatable';
import { apiFetch } from '@/lib/api';
import { canUse } from '@/lib/permissions';

type User = { login: string; name: string; permissions?: string[] };
type CaseCore = {
  id: string; number: number; title: string; description: string;
  severity: number; tlp: number; pap: number; status: string;
  owner: string; assignee: string; tags: string[];
  flag?: boolean; summary?: string; impact_status?: string; resolution_status?: string;
  case_template?: string; owning_organisation?: string; organisation_ids?: string[];
  start_date?: string | null; end_date?: string | null;
  created_at: string; updated_at: string;
};
type Task = {
  id: string; title: string; description?: string; status: string;
  assignee: string; group_name: string; order_index: number;
  flag?: boolean; start_date?: string | null; end_date?: string | null;
  due_date?: string | null; organisation_ids?: string[];
  created_at: string; updated_at: string;
};
type CaseLog = { id: string; message: string; attachment_id?: string; created_by: string; created_at: string };
type History = { action: string; actor_id: string; entity_type: string; created_at: string; before_json?: string; after_json?: string };
type Observable = {
  id: string; data_type: string; data: string; full_data?: string; data_hash?: string; message: string;
  tlp: number; ioc: boolean; sighted: boolean; ignore_similarity?: boolean;
  attachment_id?: string; tags: string[];
  created_by: string; created_at: string;
};
type CaseProcedure = {
  id: string; case_id: string; description: string; pattern_id: string;
  pattern_name: string; tactic: string; occurred_at?: string | null;
  created_by: string; created_at: string;
};
type CaseShare = {
  id: string; case_id: string; organisation: string; profile: string;
  task_rule: string; observable_rule: string; owner?: boolean;
  task_action_required?: boolean; created_by: string; created_at: string;
};
type CustomField = { id?: string; name: string; value: string };
type RelatedCase = {
  id: string; number: number; title: string; severity: number; tlp: number;
  status: string; resolution_status?: string; start_date?: string; end_date?: string;
  tags: string[]; links_count: number; merged_from?: string[];
  linked_observables: { id: string; data_type: string; data: string; ioc?: boolean; sighted?: boolean }[];
};
type ResponderAction = {
  id: string; responder_id: string; responder_name: string; status: string;
  object_type: string; object_id: string; start_date?: string; end_date?: string;
  operations?: { message?: string }[];
};
type CaseAlert = {
  id: string; title: string; type: string; source: string; source_ref: string;
  severity: number; status: string; tags: string[];
  created_at: string;
};
type CaseDetail = {
  case: CaseCore; tasks: Task[]; logs: CaseLog[]; attachments: AttachmentItem[];
  custom_fields: CustomField[]; observables: Observable[];
  procedures: CaseProcedure[]; shares: CaseShare[]; history: History[];
  related_cases?: RelatedCase[]; responder_actions?: ResponderAction[];
  alerts?: CaseAlert[];
};

const TABS = ['Details', 'Tasks', 'Observables', 'Live Chat'] as const;
type TabName = typeof TABS[number];

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Details');
  const [patchForm, setPatchForm] = useState({ title: '', assignee: '', severity: '2', description: '' });
  const [logMessage, setLogMessage] = useState('');
  const [cfForm, setCfForm] = useState({ name: '', value: '', field_type: 'string' });
  const [procForm, setProcForm] = useState({ pattern_id: '', pattern_name: '', tactic: '', description: '' });
  const [shareForm, setShareForm] = useState({ organisation: '', profile: '', task_rule: 'all', observable_rule: 'all', owner: false, task_action_required: false });
  const [taskForm, setTaskForm] = useState({ title: '', group_name: '', assignee: '', description: '' });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [obsForm, setObsForm] = useState({ data_type: 'ip', data: '', message: '', tlp: 2, ioc: false, sighted: false, tags: '' });
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [closeForm, setCloseForm] = useState({ impact_status: 'NoImpact', resolution_status: 'TruePositive', summary: '' });
  const [dupCaseId, setDupCaseId] = useState('');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeSearchType, setMergeSearchType] = useState<'title' | 'number'>('title');
  const [mergeSearchInput, setMergeSearchInput] = useState('');
  const [mergeResults, setMergeResults] = useState<CaseCore[]>([]);
  const [selectedMergeCase, setSelectedMergeCase] = useState<CaseCore | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAuditPopup, setShowAuditPopup] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [relatedFilter, setRelatedFilter] = useState('');
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignForm, setReassignForm] = useState({ assignee: '', reason: '' });

  const searchUsers = async (q: string) => {
    try {
      const data = await apiFetch<{login: string; name: string}[]>(`/api/v1/users/search?query=${encodeURIComponent(q)}`);
      return data;
    } catch { return []; }
  };

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const detail = useQuery({ queryKey: ['case-detail-full', params.id], queryFn: () => apiFetch<CaseDetail>(`/api/v1/cases/${params.id}`), enabled: !!authedLogin && !!params.id });
  const item = detail.data?.case;

  useEffect(() => {
    if (item) setPatchForm({ title: item.title, assignee: item.assignee, severity: String(item.severity), description: item.description });
  }, [item]);

  const canWrite = canUse(me.data, 'caseUpdate');
  const refetch = () => void detail.refetch();
  const updateCase = useMutation({ mutationFn: (patch?: Record<string, unknown>) => apiFetch(`/api/v1/cases/${params.id}`, { method: 'PATCH', json: patch ?? { title: patchForm.title, assignee: patchForm.assignee, severity: Number(patchForm.severity), description: patchForm.description } }), onSuccess: refetch });
  const closeCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/close`, { method: 'POST', json: { impact_status: closeForm.impact_status, resolution_status: closeForm.resolution_status, summary: closeForm.summary } }), onSuccess: () => { setShowCloseDialog(false); refetch(); } });
  const reopenCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/reopen`, { method: 'POST' }), onSuccess: refetch });
  const deleteCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}`, { method: 'DELETE' }), onSuccess: () => router.replace('/investigation?tab=cases') });
  const toggleFlag = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}`, { method: 'PATCH', json: { flag: !item?.flag } }), onSuccess: refetch });
  const duplicateCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/duplicate`, { method: 'POST', json: { target_case_id: dupCaseId } }), onSuccess: () => { setDupCaseId(''); refetch(); } });
  const mergeCase = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/merge`, { method: 'POST', json: { target_case_id: selectedMergeCase?.id } }), onSuccess: () => { setShowMergeDialog(false); setSelectedMergeCase(null); setMergeSearchInput(''); setMergeResults([]); refetch(); } });
  const searchMergeCases = async (type: string, input: string) => {
    if (!input.trim() || input.trim().length < 2) { setMergeResults([]); return; }
    try {
      const params = new URLSearchParams({ range: '0:9' });
      if (type === 'number') params.set('number', input.trim());
      else params.set('title', input.trim());
      const data = await apiFetch<{ values: CaseCore[] }>(`/api/v1/cases?${params}`);
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
        const init = await apiFetch<{ attachment: AttachmentItem; upload_url: string }>('/api/v1/attachments/upload', {
          method: 'POST',
          json: { case_id: params.id, file_name: file.name, content_type: file.type || 'application/octet-stream', size_bytes: file.size }
        });
        const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!put.ok) throw new Error('Upload failed');
        await apiFetch(`/api/v1/attachments/${init.attachment.id}/scan`, { method: 'POST', json: { status: 'clean', engine: 'manual-ui-smoke' } });
        attachment_id = init.attachment.id;
      }
      return apiFetch<CaseLog>(`/api/v1/cases/${params.id}/logs`, { method: 'POST', json: { message: logMessage, attachment_id } });
    },
    onSuccess: () => { setLogMessage(''); refetch(); }
  });
  const addCF = useMutation({ mutationFn: (field: { name: string; value: string; field_type: string }) => apiFetch(`/api/v1/cases/${params.id}/custom-fields`, { method: 'POST', json: field }), onSuccess: () => { setCfForm({ name: '', value: '', field_type: 'string' }); refetch(); } });
  const updateCF = useMutation({ mutationFn: ({ cfId, value }: { cfId: string; value: string }) => apiFetch(`/api/v1/cases/${params.id}/custom-fields/${cfId}`, { method: 'PATCH', json: { value } }), onSuccess: refetch });
  const deleteCF = useMutation({ mutationFn: (cfId: string) => apiFetch(`/api/v1/cases/${params.id}/custom-fields/${cfId}`, { method: 'DELETE' }), onSuccess: refetch });
  const addProc = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/procedures`, { method: 'POST', json: procForm }), onSuccess: () => { setProcForm({ pattern_id: '', pattern_name: '', tactic: '', description: '' }); refetch(); } });
  const deleteProc = useMutation({ mutationFn: (procId: string) => apiFetch(`/api/v1/cases/${params.id}/procedures/${procId}`, { method: 'DELETE' }), onSuccess: refetch });
  const addShare = useMutation({ mutationFn: () => apiFetch(`/api/v1/cases/${params.id}/shares`, { method: 'POST', json: shareForm }), onSuccess: () => { setShareForm({ organisation: '', profile: '', task_rule: 'all', observable_rule: 'all', owner: false, task_action_required: false }); refetch(); } });
  const deleteShare = useMutation({ mutationFn: (shareId: string) => apiFetch(`/api/v1/cases/${params.id}/shares/${shareId}`, { method: 'DELETE' }), onSuccess: refetch });
  const createTask = useMutation({ mutationFn: () => apiFetch(`/api/v1/tasks`, { method: 'POST', json: { case_id: params.id, title: taskForm.title, group_name: taskForm.group_name, assignee: taskForm.assignee, description: taskForm.description } }), onSuccess: () => { setTaskForm({ title: '', group_name: '', assignee: '', description: '' }); setShowTaskForm(false); refetch(); } });
  const closeTask = useMutation({ mutationFn: (taskId: string) => apiFetch(`/api/v1/tasks/${taskId}/close`, { method: 'POST' }), onSuccess: refetch });
  const assignTask = useMutation({ mutationFn: ({ taskId, assignee: a }: { taskId: string; assignee: string }) => apiFetch(`/api/v1/tasks/${taskId}/assign`, { method: 'POST', json: { assignee: a } }), onSuccess: refetch });
  const createObs = useMutation({
    mutationFn: async (file: File | null) => {
      let attachment_id = '';
      let data = obsForm.data;
      let data_type = obsForm.data_type;
      if (file) {
        data_type = 'file';
        data = data.trim() || file.name;
        const init = await apiFetch<{ attachment: AttachmentItem; upload_url: string }>('/api/v1/attachments/upload', {
          method: 'POST',
          json: { case_id: params.id, file_name: file.name, content_type: file.type || 'application/octet-stream', size_bytes: file.size }
        });
        const put = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!put.ok) throw new Error('Observable file upload failed');
        await apiFetch(`/api/v1/attachments/${init.attachment.id}/scan`, { method: 'POST', json: { status: 'clean', engine: 'manual-ui-smoke' } });
        attachment_id = init.attachment.id;
      }
      return apiFetch(`/api/v1/observables`, { method: 'POST', json: { case_id: params.id, data_type, data, message: obsForm.message, tlp: obsForm.tlp, ioc: obsForm.ioc, sighted: obsForm.sighted, attachment_id, tags: obsForm.tags ? obsForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [] } });
    },
    onSuccess: () => { setObsForm({ data_type: 'ip', data: '', message: '', tlp: 2, ioc: false, sighted: false, tags: '' }); refetch(); }
  });
  const patchObs = useMutation({ mutationFn: ({ obsId, patch }: { obsId: string; patch: Record<string, unknown> }) => apiFetch(`/api/v1/observables/${obsId}`, { method: 'PATCH', json: patch }), onSuccess: refetch });
  const deleteObs = useMutation({ mutationFn: (obsId: string) => apiFetch(`/api/v1/observables/${obsId}`, { method: 'DELETE' }), onSuccess: refetch });

  const error = [updateCase, closeCase, reopenCase, deleteCase, appendLog, addCF, addProc, addShare].map(m => (m.error as Error | undefined)?.message).find(Boolean);

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ?? { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="p-6">
            <div className="glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.5)] rounded-xl bg-slate-800/50 mb-6 relative z-20">
              <div className="px-6 py-5 flex justify-between items-center">
                <h3 className="text-blue-400 font-semibold text-lg flex items-center gap-2">#{item?.number ? String(item.number).padStart(7, '0') : '...'} - <span className="text-slate-200">{item?.title ?? 'Case detail'}</span></h3>
                <div className="flex bg-slate-900/50 border border-slate-700/50 rounded-lg p-1 items-stretch shadow-inner">
                  <div className="flex items-center px-3">
                    <span className={statusLabelClass(item?.status)}>{item?.status ?? 'Loading'}</span>
                  </div>
                  {item?.flag && (
                    <div className="flex items-center px-2">
                      <span className="px-2 py-1.5 rounded-md text-[10px] bg-yellow-900/40 text-yellow-400/90 uppercase font-bold tracking-wider" title="Case is flagged for attention">Flagged</span>
                    </div>
                  )}
                  <div className="w-px bg-slate-700/80 mx-1 my-1"></div>
                  {item?.status === 'Open' ? (
                    <button className={`px-4 py-1.5 mx-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center ${!canWrite || closeCase.isPending ? 'opacity-30 cursor-not-allowed ncs-disabled' : ''}`} disabled={!canWrite || closeCase.isPending} onClick={() => setShowCloseDialog(true)} title="Close this case with a resolution">Close Case</button>
                  ) : (
                    <button className={`px-4 py-1.5 mx-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center ${!canWrite || reopenCase.isPending ? 'opacity-30 cursor-not-allowed ncs-disabled' : ''}`} disabled={!canWrite || reopenCase.isPending} onClick={() => reopenCase.mutate()} title="Reopen this closed case">Reopen</button>
                  )}
                  <div className="w-px bg-slate-700/80 mx-1 my-1"></div>
                  <div className="relative flex">
                    <button className="px-4 py-1.5 bg-slate-700/50 hover:bg-slate-600/60 text-slate-300 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm" onClick={() => setShowActionsDropdown(!showActionsDropdown)} title="More actions">
                      Actions <span className="text-[10px]">▼</span>
                    </button>
                    {showActionsDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 rounded-lg shadow-xl z-50 overflow-hidden text-left border border-slate-700/50">
                        <button className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors" disabled={!canWrite} onClick={() => { setShowActionsDropdown(false); toggleFlag.mutate(); }} title="Toggle flag status">{item?.flag ? 'Unflag case' : 'Flag case'}</button>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors" disabled={!canWrite} onClick={() => { setShowActionsDropdown(false); setShowMergeDialog(true); }} title="Merge into another case">Merge case</button>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors" onClick={() => { setShowActionsDropdown(false); setShowExportDialog(true); }} title="Export case data">Export case</button>
                        <div className="border-t border-slate-700/50 my-1"></div>
                        <button className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors" disabled={!canWrite || deleteCase.isPending} onClick={() => { setShowActionsDropdown(false); setShowDeleteDialog(true); }} title="Permanently delete this case">Delete case</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-6 items-stretch">
              <section className="flex-1 flex flex-col min-w-0">
                <div className="glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.6)] rounded-xl bg-slate-800/60 px-6 py-1 mb-6 flex items-center">
                  <ul className="flex flex-wrap text-sm font-semibold text-slate-500 w-full gap-8">
                    {TABS.map(tab => (
                      <li key={tab} className="mr-5">
                        <button 
                          type="button" 
                          onClick={() => setActiveTab(tab)}
                          className={`inline-block py-2.5 border-b-2 transition-colors ${activeTab === tab ? 'text-blue-400 border-blue-500 font-bold' : 'border-transparent hover:text-slate-300 hover:border-slate-600'}`}
                        >
                          <span className="flex items-center gap-1.5">
                            {tab}
                            {tab === 'Tasks' && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800/80 text-slate-400 border border-slate-700/30">{detail.data?.tasks.length ?? 0}</span>}
                            {tab === 'Observables' && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-900/20 text-blue-400/80 border border-blue-800/30">{detail.data?.observables.length ?? 0}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              <div className="flex flex-col gap-6">
                {error && <div className="p-3 mb-3 text-xs text-red-400 rounded bg-red-900/15 border border-red-900/30">{error}</div>}
                {detail.isLoading && <div className="thehive-empty">Loading…</div>}
                {item && activeTab === 'Details' && <DetailsTab item={item} customFields={detail.data?.custom_fields ?? []} cfForm={cfForm} setCfForm={setCfForm} addCF={addCF} updateCF={updateCF} deleteCF={deleteCF} updateCase={updateCase} canWrite={canWrite} relatedCases={detail.data?.related_cases ?? []} responderActions={detail.data?.responder_actions ?? []} relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter} searchUsers={searchUsers} meLogin={me.data?.login} triggerReassign={(newAssignee) => { setReassignForm({ assignee: newAssignee, reason: '' }); setShowReassignDialog(true); }} />}
                {item && activeTab === 'Tasks' && <TasksTab tasks={detail.data?.tasks ?? []} attachments={detail.data?.attachments ?? []} user={me.data} caseId={params.id} canWrite={canWrite} showTaskForm={showTaskForm} setShowTaskForm={setShowTaskForm} taskForm={taskForm} setTaskForm={setTaskForm} createTask={createTask} closeTask={closeTask} assignTask={assignTask} searchUsers={searchUsers} />}
                {item && activeTab === 'Observables' && <ObservablesTab observables={detail.data?.observables ?? []} canWrite={canWrite} obsForm={obsForm} setObsForm={setObsForm} createObs={createObs} patchObs={patchObs} deleteObs={deleteObs} />}
                {item && activeTab === 'Live Chat' && <LogsTab logs={detail.data?.logs ?? []} history={detail.data?.history ?? []} logMessage={logMessage} setLogMessage={setLogMessage} appendLog={appendLog} canWrite={canWrite} me={me.data?.login} />}

              </div>
            </section>
            <aside className="w-[320px] shrink-0 flex flex-col gap-6">
              {/* Case Context — Quick Control Panel */}
              <div className="glass-panel flex-none flex flex-col min-h-0 shadow-[0_8px_30px_rgba(0,0,0,0.6)] rounded-xl bg-slate-800/60 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-800/60 border-b border-slate-700/30 shrink-0">
                  <h3 className="text-blue-400 font-semibold text-sm flex items-center gap-2"><i className="fa fa-info-circle"></i> Case Context</h3>
                </div>
                <div className="px-5 py-4 flex-1 flex flex-col gap-3.5 text-sm overflow-y-auto">
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">ID</span><span className="text-slate-200 font-semibold">#{item?.number ? String(item.number).padStart(7, '0') : '...'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Status</span><span className={statusLabelClass(item?.status)}>{item?.status}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium" title="Impact severity rating">Severity</span><Severity value={item?.severity ?? 2} /></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Assignee</span><span className="text-slate-300">{item?.assignee || <em className="text-slate-600">None</em>}</span></div>
                  {item?.status !== 'Open' && <div className="flex justify-between items-center"><span className="text-slate-500 font-medium" title="Case resolution status">Resolution</span><span className="text-slate-300">{item?.resolution_status || <em className="text-slate-600">-</em>}</span></div>}
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Created</span><span className="text-slate-400 text-xs">{item?.created_at ? new Date(item.created_at).toLocaleString() : '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Updated</span><span className="text-slate-400 text-xs">{item?.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</span></div>
                  {item?.start_date && <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Start</span><span className="text-slate-400 text-xs">{new Date(item.start_date).toLocaleString()}</span></div>}
                  {item?.end_date && <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">End</span><span className="text-slate-400 text-xs">{new Date(item.end_date).toLocaleString()}</span></div>}
                  
                  <button className="w-full mt-auto shrink-0 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm" onClick={() => {
                    const sevMap = {1:'Low', 2:'Medium', 3:'High', 4:'Critical'};
                    const copyText = `Case ID: #${item?.number ? String(item.number).padStart(7, '0') : 'Unknown'}\nTitle: ${item?.title}\nSeverity: ${sevMap[item?.severity as keyof typeof sevMap] || 'Unknown'}\nStatus: ${item?.status}\nAssignee: ${item?.assignee || 'None'}`;
                    navigator.clipboard.writeText(copyText);
                  }} title="Copy case details for reporting">
                    <i className="fa fa-copy"></i> Copy Details
                  </button>
                </div>
              </div>

              {/* Audit History */}
              <div className="glass-panel flex-1 flex flex-col min-h-0 shadow-[0_8px_30px_rgba(0,0,0,0.6)] rounded-xl bg-slate-800/60 overflow-hidden mt-6">
                <div className="px-5 py-3.5 bg-slate-800/60 border-b border-slate-700/30 flex justify-between items-center shrink-0">
                  <h3 className="text-blue-400 font-semibold text-sm flex items-center gap-2"><i className="fa fa-history"></i> Audit History</h3>
                  {detail.data?.history && detail.data.history.length > 0 && (
                    <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors" onClick={() => setShowAuditPopup(true)}>View All</button>
                  )}
                </div>
                <div className="px-5 py-4 flex-1 overflow-y-auto">
                  {detail.data?.history && detail.data.history.length > 0 ? (
                    <FlowPanel
                      items={detail.data.history.slice(0, 4).map((h, i) => ({
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
                    <div className="text-slate-500 text-sm text-center py-4 italic">No history recorded yet.</div>
                  )}
                </div>
              </div>
            </aside>

            {/* Reassign Dialog */}
            {showReassignDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md p-6 border-t-2 border-orange-500 bg-slate-900 rounded-md shadow-2xl">
                  <h4 className="mb-3 text-base text-orange-400/80 font-medium">Re-assign case</h4>
                  <p className="text-slate-400 text-sm mb-4">You are re-assigning this case to <strong className="text-orange-400">{reassignForm.assignee}</strong>. Please provide a reason for this change.</p>
                  <label className="block text-sm text-slate-400 mb-1">Reason for Re-assignment</label>
                  <textarea autoFocus className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:ring-1 focus:ring-orange-500" rows={3} value={reassignForm.reason} onChange={e => setReassignForm(f => ({ ...f, reason: e.target.value }))} placeholder="E.g., Escalation, Shift handover..." />
                  <div className="flex gap-3 mt-6">
                    <button className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm transition-colors" disabled={updateCase.isPending || !reassignForm.reason.trim()} onClick={async () => {
                      if (!reassignForm.reason.trim()) return;
                      setShowReassignDialog(false);
                      try {
                        await apiFetch(`/api/v1/cases/${item?.id}/logs`, { method: 'POST', json: { message: `Re-assigned from **${item?.assignee}** to **${reassignForm.assignee}**.\n\n**Reason:** ${reassignForm.reason}` } });
                        updateCase.mutate({ assignee: reassignForm.assignee });
                      } catch { updateCase.mutate({ assignee: reassignForm.assignee }); }
                    }}>Confirm Re-assign</button>
                    <button className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors" onClick={() => setShowReassignDialog(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Overlays */}
            {showCloseDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md p-6 border-t-2 border-blue-500 bg-slate-900 rounded-md shadow-2xl">
                  <h4 className="mb-3 text-base text-blue-400/80 font-medium">Close case</h4>
                  <label className="block text-sm text-slate-400 mb-1 mt-2">Impact</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={closeForm.impact_status} onChange={e => setCloseForm(f => ({ ...f, impact_status: e.target.value }))}>
                    <option value="NoImpact">No Impact</option><option value="WithImpact">With Impact</option><option value="NotApplicable">Not Applicable</option>
                  </select>
                  <label className="block text-sm text-slate-400 mb-1 mt-3">Resolution</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={closeForm.resolution_status} onChange={e => setCloseForm(f => ({ ...f, resolution_status: e.target.value }))}>
                    <option value="TruePositive">True Positive</option><option value="FalsePositive">False Positive</option>
                    <option value="Indeterminate">Indeterminate</option><option value="Other">Other</option>
                  </select>
                  <label className="block text-sm text-slate-400 mb-1 mt-3">Summary</label>
                  <textarea className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={3} value={closeForm.summary} onChange={e => setCloseForm(f => ({ ...f, summary: e.target.value }))} placeholder="Case closure summary..." />
                  <div className="flex gap-3 mt-6">
                    <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors" disabled={closeCase.isPending} onClick={() => closeCase.mutate()}>{closeCase.isPending ? 'Closing…' : 'Confirm close'}</button>
                    <button className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors" onClick={() => setShowCloseDialog(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            
            {showMergeDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-lg p-6 border-t-2 border-orange-500 bg-slate-900 rounded-md shadow-2xl">
                  <h4 className="mb-2 text-xl text-orange-500 font-medium">Merge case</h4>
                  <p className="text-slate-400 text-sm mb-4">Search for a case to merge this case into. All tasks, observables, logs, and attachments will be moved to the target case.</p>
                  <div className="flex gap-2 mb-4">
                    <select className="w-32 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" value={mergeSearchType} onChange={e => { setMergeSearchType(e.target.value as 'title' | 'number'); setMergeResults([]); }}>
                      <option value="title">By Title</option><option value="number">By Number</option>
                    </select>
                    <input className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" placeholder={mergeSearchType === 'number' ? 'Case number...' : 'Search by title...'} value={mergeSearchInput} onChange={e => { setMergeSearchInput(e.target.value); searchMergeCases(mergeSearchType, e.target.value); }} />
                  </div>
                  {mergeResults.length > 0 && (
                    <div className="max-h-60 overflow-y-auto mb-4 space-y-2 border border-slate-700 rounded-md p-2 bg-slate-900/50">
                      {mergeResults.map(c => <div key={c.id} className={`p-3 cursor-pointer border rounded-md transition-colors ${selectedMergeCase?.id === c.id ? 'bg-orange-900/40 border-orange-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`} onClick={() => setSelectedMergeCase(c)}>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-200">#{String(c.number).padStart(7, '0')}</strong>
                          <span className="text-sm truncate flex-1 text-slate-300">{c.title}</span>
                          <SeverityInline value={c.severity} />
                        </div>
                        <div className="text-slate-400 text-xs mt-1.5">{c.status} · {c.assignee || 'no assignee'} · {c.tags?.join(', ') || 'no tags'}</div>
                      </div>)}
                    </div>
                  )}
                  {selectedMergeCase && <div className="p-3 bg-orange-900/30 border border-orange-700/50 rounded-md text-orange-200 text-sm mb-4">Merging into <strong className="text-orange-400">#{String(selectedMergeCase.number).padStart(7, '0')} - {selectedMergeCase.title}</strong>. This action cannot be undone.</div>}
                  <div className="flex gap-3 mt-2">
                    <button className={`flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-sm transition-colors ${!selectedMergeCase || mergeCase.isPending ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!selectedMergeCase || mergeCase.isPending} onClick={() => mergeCase.mutate()}>{mergeCase.isPending ? 'Merging…' : 'Confirm merge'}</button>
                    <button className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors" onClick={() => { setShowMergeDialog(false); setSelectedMergeCase(null); setMergeSearchInput(''); setMergeResults([]); }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            
            {showExportDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-sm p-6 border-t-2 border-blue-500 bg-slate-900 rounded-md shadow-2xl">
                  <h4 className="mb-3 text-base text-blue-400/80 font-medium">Export case</h4>
                  <label className="block text-sm text-slate-400 mb-1 mt-2">Format</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={exportFormat} onChange={e => setExportFormat(e.target.value as 'json' | 'csv')}><option value="json">JSON</option><option value="csv">CSV</option></select>
                  <div className="flex gap-3 mt-6">
                    <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors" onClick={() => { void exportCase(); setShowExportDialog(false); }}>Download</button>
                    <button className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors" onClick={() => setShowExportDialog(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
              <ConfirmDialog
                open={showDeleteDialog}
                title="Delete case"
                message={`Are you sure you want to permanently delete case #${item?.number ?? ''}? This action cannot be undone. All tasks, observables, logs, and attachments will be removed.`}
                variant="danger"
                confirmLabel="Delete case"
                cancelLabel="Keep case"
                pending={deleteCase.isPending}
                onConfirm={() => { deleteCase.mutate(); setShowDeleteDialog(false); }}
                onCancel={() => setShowDeleteDialog(false)}
              />
              
              {showAuditPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-4xl max-h-[85vh] flex flex-col border-t-2 border-blue-500 bg-slate-900 rounded-lg shadow-2xl overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700/50 bg-slate-800/50 shrink-0">
                      <h4 className="text-xl text-blue-400 font-semibold flex items-center gap-2"><i className="fa fa-history"></i> Full Audit History</h4>
                      <button className="text-slate-400 hover:text-slate-200 transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700" onClick={() => setShowAuditPopup(false)}><i className="fa fa-times"></i></button>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1 max-h-[320px]">
                      {detail.data?.history && detail.data.history.length > 0 ? (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-800/80 sticky top-0 z-10 shadow-sm">
                            <tr className="border-b border-slate-700 text-slate-400">
                              <th className="px-6 py-3 font-medium w-[180px]">Time</th>
                              <th className="px-6 py-3 font-medium w-[200px]">User</th>
                              <th className="px-6 py-3 font-medium w-[150px]">Action</th>
                              <th className="px-6 py-3 font-medium">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {detail.data.history.map((h, i) => (
                              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-3 text-slate-400 text-xs">{new Date(h.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="px-6 py-3 text-slate-300 flex items-center gap-2"><i className="fa fa-user text-slate-500"></i> {h.actor_id || 'System'}</td>
                                <td className="px-6 py-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-700/50 text-slate-300 border border-slate-600/50 mr-2">
                                    {h.action}
                                  </span>
                                  <span className="text-slate-500 text-[10px] uppercase tracking-wider">{h.entity_type || 'case'}</span>
                                </td>
                                <td className="px-6 py-3 whitespace-normal">
                                  {(() => {
                                    if (h.action.toLowerCase() === 'create' || !h.before_json || h.before_json === h.after_json) {
                                      if (!h.after_json) return <span className="text-slate-500 text-xs italic">No details</span>;
                                      try {
                                        const after = JSON.parse(h.after_json);
                                        const keys = Object.keys(after).filter(k => !['id', 'created_at', 'updated_at'].includes(k));
                                        if (keys.length === 0) return <span className="text-slate-500 text-xs italic">No details</span>;
                                        return <div className="text-xs text-slate-300">Created with: {keys.map(k => <span key={k} className="mr-2"><strong className="text-slate-400">{k}:</strong> {String(after[k])}</span>)}</div>;
                                      } catch { return <span className="text-slate-500 text-xs italic">No details</span>; }
                                    }
                                    try {
                                      const before = JSON.parse(h.before_json);
                                      const after = JSON.parse(h.after_json || '{}');
                                      const changes: { field: string, old: any, new: any }[] = [];
                                      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
                                      for (const key of allKeys) {
                                        if (['id', 'created_at', 'updated_at'].includes(key)) continue;
                                        if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
                                          changes.push({ field: key, old: before[key], new: after[key] });
                                        }
                                      }
                                      if (changes.length === 0) return <span className="text-slate-500 text-xs italic">No data changed</span>;
                                      return (
                                        <div className="flex flex-col gap-1 text-xs">
                                          {changes.map(c => (
                                            <div key={c.field} className="text-slate-300">
                                              Changed <strong className="text-blue-400">{c.field}</strong> from <code className="bg-slate-900 px-1 rounded text-slate-400 line-through">{String(c.old ?? 'empty')}</code> to <code className="bg-slate-900 px-1 rounded text-orange-300">{String(c.new ?? 'empty')}</code>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    } catch { return <span className="text-slate-500 text-xs italic">Parse error</span>; }
                                  })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center text-slate-500 py-12 italic border-b border-slate-700/50">No history recorded yet.</div>
                      )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 flex justify-end shrink-0">
                      <button className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm font-medium transition-colors shadow-sm" onClick={() => setShowAuditPopup(false)}>Close</button>
                    </div>
                  </div>
                </div>
              )}
          </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function DetailsTab({ item, customFields, cfForm, setCfForm, addCF, updateCF, deleteCF, updateCase, canWrite, relatedCases, responderActions, relatedFilter, setRelatedFilter, searchUsers, meLogin, triggerReassign }: {
  item: CaseCore; customFields: CustomField[];
  cfForm: { name: string; value: string; field_type: string }; setCfForm: (v: typeof cfForm | ((p: typeof cfForm) => typeof cfForm)) => void;
  addCF: { mutate: (field: { name: string; value: string; field_type: string }) => void; isPending: boolean };
  updateCF: { mutate: (v: { cfId: string; value: string }) => void; isPending: boolean };
  deleteCF: { mutate: (id: string) => void };
  updateCase: { mutate: (patch?: Record<string, unknown>) => void; isPending: boolean };
  canWrite: boolean;
  relatedCases: RelatedCase[]; responderActions: ResponderAction[];
  relatedFilter: string; setRelatedFilter: (v: string) => void;
  searchUsers: (q: string) => Promise<{login: string; name: string}[]>;
  meLogin?: string;
  triggerReassign: (newAssignee: string) => void;
}) {
  const disabled = !canWrite || updateCase.isPending;
  return (<>
    <div className="glass-panel flex flex-col xl:flex-row shadow-[0_8px_30px_rgba(0,0,0,0.6)] rounded-xl bg-slate-800/60 overflow-hidden case-details">
      {/* Left Column: Basic Information */}
      <div className="flex-1 flex flex-col">
        <div className="px-8 py-5 border-b border-slate-700/30 bg-slate-800/30">
          <h4 className="text-slate-100 font-semibold text-lg flex items-center gap-2"><i className="fa fa-id-card-o text-blue-500"></i> Basic Information</h4>
        </div>
        <div className="p-8 flex-1">
            <div className="grid grid-cols-[160px_1fr] gap-x-8 gap-y-5 items-center">
              <InfoTooltip content="Title of the incident"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">Title</div></InfoTooltip>
              <div className="text-base">{canWrite ? <UpdatableSimpleText value={item.title} disabled={disabled} onUpdate={(title) => updateCase.mutate({ title })} /> : <span className="text-slate-200">{item.title}</span>}</div>
              
              <InfoTooltip content="Incident severity level"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">Severity</div></InfoTooltip>
              <div>{canWrite ? <Severity value={item.severity} active onUpdate={(severity) => updateCase.mutate({ severity })} /> : <Severity value={item.severity} />}</div>
              
              <InfoTooltip content="Traffic Light Protocol"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">TLP</div></InfoTooltip>
              <div>{canWrite ? <Tlp value={item.tlp} format="active" onUpdate={(tlp) => updateCase.mutate({ tlp })} /> : <Tlp value={item.tlp} />}</div>
              
              <InfoTooltip content="Permissible Actions Protocol"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">PAP</div></InfoTooltip>
              <div>{canWrite ? <Pap value={item.pap} format="active" onUpdate={(pap) => updateCase.mutate({ pap })} /> : <Pap value={item.pap} />}</div>
              
              <InfoTooltip content="User assigned to investigate"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">Assignee</div></InfoTooltip>
              <div>{canWrite ? <UpdatableUser value={item.assignee || ''} disabled={disabled} blankText="Not Assigned" query={searchUsers} defaultUser={meLogin} onUpdate={(newAssignee) => {
                if (item.assignee && newAssignee !== item.assignee && newAssignee !== '') {
                  triggerReassign(newAssignee);
                } else {
                  updateCase.mutate({ assignee: newAssignee });
                }
              }} /> : (item.assignee ? <span className="text-slate-200">{item.assignee}</span> : <em className="text-yellow-500">Not Assigned</em>)}</div>
              
              <InfoTooltip content="Date of incident occurrence"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">Date</div></InfoTooltip>
              <div>{canWrite ? <UpdatableDate value={item.start_date ?? null} disabled={disabled} onUpdate={(start_date) => updateCase.mutate({ start_date })} clearable /> : (item.start_date ? <span className="text-slate-200">{new Date(item.start_date).toLocaleString()}</span> : <em className="text-yellow-500">Not Specified</em>)}</div>
              
              <InfoTooltip content="Categorization tags"><div className="text-slate-500 text-sm font-medium uppercase tracking-wider cursor-help">Tags</div></InfoTooltip>
              <div>{canWrite ? <UpdatableTags value={item.tags ?? []} disabled={disabled} onUpdate={(tags) => updateCase.mutate({ tags })} clearable /> : <TagList data={item.tags} />}</div>
              
              {item.status !== 'Open' && (
                <>
                  <div className="text-green-500 text-sm font-medium uppercase tracking-wider">Close date</div>
                  <div className="text-green-500 text-base">{item.end_date ? new Date(item.end_date).toLocaleString() : <em>Not Specified</em>}</div>
                </>
              )}
            </div>
        </div>

        <div className="px-8 py-5 mt-4 border-b border-slate-700/30 bg-slate-800/30">
          <h4 className="text-slate-100 font-semibold text-lg flex items-center gap-2"><i className="fa fa-align-left text-blue-500"></i> Description & Summary</h4>
        </div>
        <div className="p-8 flex-1 flex flex-col gap-6">
          <div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Description</div>
            {canWrite ? <UpdatableText value={item.description || ''} disabled={disabled} onUpdate={(description) => updateCase.mutate({ description })} clearable /> : <div className="prose prose-invert max-w-none text-slate-300">{item.description || <em className="text-yellow-500">Not Specified</em>}</div>}
          </div>
          {(item.summary || item.status !== 'Open') && (
            <div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Summary</div>
              {canWrite ? <UpdatableText value={item.summary || ''} disabled={disabled} onUpdate={(summary) => updateCase.mutate({ summary })} clearable /> : <div className="prose prose-invert max-w-none text-slate-300">{item.summary || <em className="text-yellow-500">Not Specified</em>}</div>}
            </div>
          )}
        </div>
      </div>
      
      {/* Right Column: Case Metadata & Linked cases & Responder Actions */}
      <div className="w-full xl:w-[450px] shrink-0 flex flex-col bg-slate-900/40">
        <div className="flex flex-col mb-4">
          <div className="px-6 py-5 border-b border-slate-700/30 bg-slate-800/30">
            <h4 className="text-slate-100 font-semibold text-lg flex items-center gap-2"><i className="fa fa-database text-blue-500"></i> Case Metadata</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-4 items-center text-sm">
              <div className="text-slate-400 font-medium">Owner</div>
              <div className="text-slate-200 bg-slate-800/50 px-3 py-1.5 rounded">{item.owner || 'None'}</div>
              <div className="text-slate-400 font-medium">Organisation</div>
              <div className="text-slate-200 bg-slate-800/50 px-3 py-1.5 rounded">{item.owning_organisation || 'None'}</div>
              <div className="text-slate-400 font-medium">Template</div>
              <div className="text-slate-200 bg-slate-800/50 px-3 py-1.5 rounded truncate">{item.case_template || <em className="text-slate-500">None</em>}</div>
              <div className="text-slate-400 font-medium">Impact</div>
              <div className="text-slate-200 bg-slate-800/50 px-3 py-1.5 rounded">{item.impact_status || '—'}</div>
              <div className="text-slate-400 font-medium">Resolution</div>
              <div className="text-slate-200 bg-slate-800/50 px-3 py-1.5 rounded">{item.resolution_status || '—'}</div>
              <div className="text-slate-400 font-medium">Updated</div>
              <div className="text-slate-400 text-xs bg-slate-800/50 px-3 py-1.5 rounded">{new Date(item.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-col mb-4">
          <RelatedCasesPanel relatedCases={relatedCases} filter={relatedFilter} setFilter={setRelatedFilter} />
        </div>
        <div className="flex flex-col">
          <ResponderActionsPanel actions={responderActions} />
        </div>
      </div>
    </div>
  </>);
}

function TasksTab({ tasks, attachments, user, caseId, canWrite, showTaskForm, setShowTaskForm, taskForm, setTaskForm, createTask, closeTask, assignTask, searchUsers }: {
  tasks: Task[]; attachments: AttachmentItem[]; user: User | undefined; caseId: string; canWrite: boolean;
  showTaskForm: boolean; setShowTaskForm: (v: boolean) => void;
  taskForm: { title: string; group_name: string; assignee: string; description: string };
  setTaskForm: (v: typeof taskForm | ((p: typeof taskForm) => typeof taskForm)) => void;
  createTask: { mutate: () => void; isPending: boolean };
  closeTask: { mutate: (id: string) => void };
  assignTask: { mutate: (v: { taskId: string; assignee: string }) => void };
  searchUsers: (q: string) => Promise<{login: string; name: string}[]>;
}) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [userSuggestions, setUserSuggestions] = useState<{login: string; name: string}[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const toggleExpand = (id: string) => setExpandedTasks(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const refetch = () => window.location.reload();
  const startTask = (id: string) => apiFetch(`/api/v1/tasks/${id}/start`, { method: 'POST' }).then(refetch);
  const reopenTask = (id: string) => apiFetch(`/api/v1/tasks/${id}/reopen`, { method: 'POST' }).then(refetch);
  const cancelTask = (id: string) => apiFetch(`/api/v1/tasks/${id}/cancel`, { method: 'POST' }).then(refetch);

  const reorderTask = (task: Task, delta: number) => apiFetch('/api/v1/tasks/reorder', { method: 'POST', json: { case_id: caseId, tasks: [{ id: task.id, group_name: task.group_name || 'default', order_index: Math.max(0, task.order_index + delta) }] } }).then(refetch);
  const bulkCloseWaiting = () => apiFetch('/api/v1/tasks/bulk/close', { method: 'POST', json: { case_id: caseId } }).then(refetch);

  return (<>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-blue-400/80 font-medium text-sm m-0">List of tasks ({tasks.length})</h3>
      {canWrite && <div className="flex gap-2"><button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-md text-sm transition-colors" onClick={bulkCloseWaiting}>Close/Cancel open tasks</button><button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm" onClick={() => setShowTaskForm(!showTaskForm)}>{showTaskForm ? 'Cancel' : 'Add Task'}</button></div>}
    </div>
    {showTaskForm && canWrite && (
      <div className="mb-6 bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden relative">
        <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/50">
          <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2"><i className="fa fa-plus-circle" /> Create New Task</h4>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          <div className="w-full">
            <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-full">
              <span>Task Title <span className="text-red-400">*</span></span>
              <input autoFocus className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner" value={taskForm.title} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, title: e.target.value }))} placeholder="Enter a clear, actionable title..." />
            </label>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 w-full">
            <div className="flex-1 w-full">
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-full">
                Task Group
                <input className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner" value={taskForm.group_name} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, group_name: e.target.value }))} placeholder="e.g. Investigation, Containment" />
              </label>
            </div>
            
            <div className="flex-1 w-full relative">
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-full">
                Assignee
                <input className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner" value={taskForm.assignee} onChange={e => {
                  const val = e.target.value;
                  setTaskForm((f: typeof taskForm) => ({ ...f, assignee: val }));
                  if (val.length >= 2) {
                    searchUsers(val).then(res => { setUserSuggestions(res); setShowUserDropdown(true); });
                  } else {
                    setShowUserDropdown(false);
                  }
                }} onFocus={() => { if (userSuggestions.length > 0) setShowUserDropdown(true); }} onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)} placeholder="Search user login..." />
              </label>
              {showUserDropdown && userSuggestions.length > 0 && (
                <ul className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded-md shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                  {userSuggestions.map(u => (
                    <li key={u.login}>
                      <button type="button" className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors flex flex-col" onClick={() => { setTaskForm((f: typeof taskForm) => ({ ...f, assignee: u.login })); setShowUserDropdown(false); }}>
                        <span className="font-medium text-slate-200">{u.login}</span>
                        {u.name && <span className="text-slate-500 text-[11px]">{u.name}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div className="w-full">
            <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-full">
              Description
              <textarea className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner" value={taskForm.description} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, description: e.target.value }))} placeholder="Provide details, context, or steps required to complete the task..." rows={3} />
            </label>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-700/60 flex justify-end gap-3">
          <button className="px-5 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-md text-sm font-medium transition-colors" onClick={() => { setShowTaskForm(false); setTaskForm({ title: '', group_name: '', assignee: '', description: '' }); }}>Cancel</button>
          <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={!taskForm.title.trim() || createTask.isPending} onClick={() => createTask.mutate()}>{createTask.isPending ? 'Creating...' : 'Create Task'}</button>
        </div>
      </div>
    )}
    <table className="w-full text-left border-collapse whitespace-nowrap mt-4">
      <thead>
        <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-sm">
          <th className="px-4 py-3 w-10"></th>
          <th className="px-4 py-3">Group</th>
          <th className="px-4 py-3 w-1/3">Task</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Assignee</th>
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Due/SLA</th>
          <th className="px-4 py-3">Order</th>
          {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
        </tr>
      </thead>
      <tbody className="text-sm divide-y divide-slate-800">
      {tasks.map(t => <Fragment key={t.id}>
      <tr
        className={`hover:bg-slate-800/50 transition-colors ${t.flag ? 'bg-red-900/10' : ''}`}
        draggable={canWrite}
        onDragStart={(e) => e.dataTransfer.setData('taskId', t.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData('taskId');
          if (sourceId && sourceId !== t.id) {
            const sourceTask = tasks.find(x => x.id === sourceId);
            if (sourceTask) {
              apiFetch('/api/v1/tasks/reorder', {
                method: 'POST',
                json: { case_id: caseId, tasks: [{ id: sourceTask.id, group_name: sourceTask.group_name || 'default', order_index: t.order_index }] }
              }).then(() => window.location.reload());
            }
          }
        }}
      >
        <td className="px-4 py-3 text-center"><TaskFlags task={t} /></td>
        <td className="px-4 py-3 text-slate-300">{t.group_name || '—'}</td>
        <td className="px-4 py-3 whitespace-normal">
          {t.description && <button className="text-slate-400 hover:text-blue-400 p-0 mr-2 focus:outline-none" onClick={() => toggleExpand(t.id)}><i className={`fa ${expandedTasks.has(t.id) ? 'fa-chevron-up' : 'fa-chevron-down'}`} /></button>}
          <a href={`/tasks/${t.id}`} className={`font-medium hover:underline ${t.flag ? 'text-red-400' : 'text-blue-400'}`}>{t.flag && <span className="text-red-500 mr-1" title="Action Required"><i className="fa fa-exclamation-triangle" /></span>}{t.title}</a>
        </td>
        <td className="px-4 py-3">
          <span className={taskStatusClass(t.status)}>{t.status}</span>
          {t.status === 'InProgress' && t.start_date && <div className="text-yellow-500/80 text-[11px] mt-1.5 font-medium">Started {new Date(t.start_date).toLocaleDateString()}</div>}
          {t.status === 'Completed' && t.end_date && <div className="text-green-500/80 text-[11px] mt-1.5 font-medium">Closed {new Date(t.end_date).toLocaleDateString()}</div>}
        </td>
        <td className="px-4 py-3">{t.assignee ? <span className="text-slate-300">{t.assignee}</span> : <em className="text-yellow-500">Not Assigned</em>}</td>
        <td className="px-4 py-3 text-slate-300">{t.start_date ? new Date(t.start_date).toLocaleDateString() : '—'}</td>
        <td className="px-4 py-3 flex flex-col gap-1">{t.due_date ? <><div className="text-slate-300">{new Date(t.due_date).toLocaleDateString()}</div><SlaBadge dueDate={t.due_date} status={t.status} /></> : <span className="text-slate-500">—</span>}</td>
        <td className="px-4 py-3">
          <div className="flex items-center">
            <span className="text-slate-500 cursor-grab mr-2 hover:text-slate-300" title="Drag to reorder">
              <i className="fa fa-bars" />
            </span>
            <button className="text-slate-400 hover:text-slate-200 p-1" onClick={() => reorderTask(t, -1)} title="Move up">▲</button>
            <span className="font-mono text-xs text-slate-500 mx-1 w-4 text-center">{t.order_index}</span>
            <button className="text-slate-400 hover:text-slate-200 p-1" onClick={() => reorderTask(t, 1)} title="Move down">▼</button>
          </div>
        </td>
        {canWrite && <td className="px-4 py-3 text-right">
          <div className="flex gap-1 justify-end">
            {t.status === 'Waiting' && <button className="px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-700/50 rounded text-xs transition-colors" onClick={() => startTask(t.id)} title="Start">▶ Start</button>}
            {t.status === 'InProgress' && <button className="px-2 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-700/50 rounded text-xs transition-colors" onClick={() => closeTask.mutate(t.id)} title="Close">✔ Close</button>}
            {(t.status === 'Completed' || t.status === 'Cancel') && <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded text-xs transition-colors" onClick={() => reopenTask(t.id)} title="Reopen">↩ Reopen</button>}
            {t.status !== 'Cancel' && t.status !== 'Completed' && <button className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/50 rounded text-xs transition-colors ml-1" onClick={() => cancelTask(t.id)} title="Cancel">✖</button>}
          </div>
        </td>}
      </tr>
      {t.description && expandedTasks.has(t.id) && <tr><td colSpan={canWrite ? 9 : 8} className="px-4 py-3 whitespace-normal bg-slate-900/30"><div className="prose prose-invert max-w-none text-slate-300 text-sm p-2 border-l-2 border-blue-500">{t.description}</div></td></tr>}
      </Fragment>)}
      {!tasks.length && <tr><td colSpan={canWrite ? 9 : 8} className="px-4 py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No tasks yet.</td></tr>}
    </tbody></table>
    <div className="mt-8">
      <AttachmentPanel user={user} caseId={caseId} initialAttachments={attachments} title="Case Attachments" />
    </div>
  </>);
}

function ObservablesTab({ observables, canWrite, obsForm, setObsForm, createObs, patchObs, deleteObs }: {
  observables: Observable[]; canWrite: boolean;
  obsForm: { data_type: string; data: string; message: string; tlp: number; ioc: boolean; sighted: boolean; tags: string };
  setObsForm: (v: typeof obsForm | ((p: typeof obsForm) => typeof obsForm)) => void;
  createObs: { mutate: (file: File | null) => void; isPending: boolean };
  patchObs: { mutate: (v: { obsId: string; patch: Record<string, unknown> }) => void };
  deleteObs: { mutate: (id: string) => void };
}) {
  const [showModal, setShowModal] = useState(false);
  const [drawerObs, setDrawerObs] = useState<Observable | null>(null);
  const [drawerTab, setDrawerTab] = useState<'parsed' | 'raw'>('parsed');
  const types = ['ip', 'domain', 'url', 'mail', 'hash', 'filename', 'fqdn', 'uri_path', 'user-agent', 'regexp', 'file', 'other'];
  const knownTags = Array.from(new Set(observables.flatMap((o) => o.tags))).sort();

  function handleSubmit(payload: ObservableCreationPayload) {
    setObsForm({
      data_type: payload.data_type,
      data: payload.data,
      message: payload.message,
      tlp: payload.tlp,
      ioc: payload.ioc,
      sighted: payload.sighted,
      tags: payload.tags.join(', '),
    });
    createObs.mutate(payload.file ?? null);
    setShowModal(false);
  }

  return (<>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-blue-400/80 font-medium text-sm m-0">Observables ({observables.length})</h3>
      {canWrite && <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm flex items-center gap-1.5" onClick={() => setShowModal(true)}><i className="fa fa-plus" /> New observable(s)</button>}
    </div>
    <ObservableCreationModal
      open={showModal}
      types={types}
      knownTags={knownTags}
      pending={createObs.isPending}
      onCancel={() => setShowModal(false)}
      onSubmit={handleSubmit}
    />
    <table className="w-full text-left border-collapse whitespace-nowrap mt-4">
      <thead>
        <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-sm">
          <th className="px-4 py-3 w-10">TLP</th>
          <th className="px-4 py-3 w-32">Flags</th>
          <th className="px-4 py-3 w-32">Type</th>
          <th className="px-4 py-3 w-1/3">Data</th>
          <th className="px-4 py-3">Tags</th>
          <th className="px-4 py-3">Owner</th>
          {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
        </tr>
      </thead>
      <tbody className="text-sm divide-y divide-slate-800">
      {observables.map(o => <tr key={o.id} className="hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setDrawerObs(o)}>
        <td className="px-4 py-3 text-center"><Tlp value={o.tlp} format="icon" /></td>
        <td className="px-4 py-3 flex flex-col gap-1.5 text-xs">
          <span onClick={() => canWrite && patchObs.mutate({ obsId: o.id, patch: { ioc: !o.ioc } })} className={canWrite ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}><ObservableFlags observable={o} />{!o.ioc && !o.sighted && !o.ignore_similarity && <span className="text-slate-500">No flags</span>}</span>
          <div className="flex gap-2">
            <a href="#" onClick={(event) => { event.preventDefault(); if (canWrite) patchObs.mutate({ obsId: o.id, patch: { sighted: !o.sighted } }); }} className="text-blue-400 hover:text-blue-300 hover:underline">{o.sighted ? 'unsight' : 'sight'}</a>
            <a href="#" onClick={(event) => { event.preventDefault(); if (canWrite) patchObs.mutate({ obsId: o.id, patch: { ignore_similarity: !o.ignore_similarity } }); }} className="text-blue-400 hover:text-blue-300 hover:underline">{o.ignore_similarity ? 'similarity on' : 'ignore similarity'}</a>
          </div>
        </td>
        <td className="px-4 py-3"><a href={`/observables/${o.id}`} className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-600 rounded text-xs hover:bg-slate-700 transition-colors">{o.data_type}</a></td>
        <td className="px-4 py-3 whitespace-normal">
          <div className="font-mono text-slate-200 break-all">{o.data}</div>
          {o.full_data && <div className="mt-1"><span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 mr-1" title="Full data stored server-side">hash-indexed</span> <small className="font-mono text-slate-400">{o.data_hash}</small></div>}
          <div className="text-slate-500 text-xs mt-1">{o.message}</div>
          {o.attachment_id && <div className="mt-1"><span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]"><i className="fa fa-paperclip mr-1" /> File {(o.attachment_id).split('-')[0]}</span></div>}
        </td>
        <td className="px-4 py-3"><TagList data={o.tags} /></td>
        <td className="px-4 py-3 text-slate-300">{o.created_by}</td>
        {canWrite && <td className="px-4 py-3 text-right"><button className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/50 rounded text-xs transition-colors" onClick={(e) => { e.stopPropagation(); deleteObs.mutate(o.id); }}>Delete</button></td>}
      </tr>)}
      {!observables.length && <tr><td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No observables yet.</td></tr>}
    </tbody></table>

    {/* Side Drawer Overlay */}
    {drawerObs && (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 transition-opacity">
        <div className="w-[600px] h-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform">
          <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
            <h3 className="text-base text-blue-400/80 font-medium flex items-center gap-2">
              <i className="fa fa-eye"></i> Observable Details
            </h3>
            <button className="text-slate-400 hover:text-slate-200" onClick={() => setDrawerObs(null)}>
              <i className="fa fa-times text-xl"></i>
            </button>
          </div>
          
          <div className="flex border-b border-slate-700 bg-slate-800">
            <button className={`flex-1 py-3 text-sm font-medium transition-colors ${drawerTab === 'parsed' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`} onClick={() => setDrawerTab('parsed')}>Parsed Details</button>
            <button className={`flex-1 py-3 text-sm font-medium transition-colors ${drawerTab === 'raw' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`} onClick={() => setDrawerTab('raw')}>Raw JSON</button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            {drawerTab === 'parsed' ? (
              <div className="space-y-6">
                <div>
                  <span className="block text-xs text-slate-500 mb-1">Data</span>
                  <div className="font-mono text-sm text-slate-200 bg-slate-800 p-3 rounded border border-slate-700 break-all">{drawerObs.data}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="block text-xs text-slate-500 mb-1">Type</span><span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-600 text-sm">{drawerObs.data_type}</span></div>
                  <div><span className="block text-xs text-slate-500 mb-1">TLP</span><Tlp value={drawerObs.tlp} /></div>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 mb-1">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1"><TagList data={drawerObs.tags} /></div>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 mb-1">Message</span>
                  <p className="text-sm text-slate-300">{drawerObs.message || <em className="text-slate-500">None</em>}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="block text-xs text-slate-500 mb-1">Created By</span><span className="text-sm text-slate-300">{drawerObs.created_by}</span></div>
                  <div><span className="block text-xs text-slate-500 mb-1">Created At</span><span className="text-sm text-slate-300">{new Date(drawerObs.created_at).toLocaleString()}</span></div>
                </div>
              </div>
            ) : (
              <pre className="text-xs font-mono text-slate-300 bg-slate-900 p-4 rounded border border-slate-700 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(drawerObs, null, 2)}</pre>
            )}
          </div>
          <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end">
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors" onClick={() => setDrawerObs(null)}>Close Drawer</button>
          </div>
        </div>
      </div>
    )}
  </>);
}

function LogsTab({ logs, history, logMessage, setLogMessage, appendLog, canWrite, me }: {
  logs: CaseLog[]; history: History[]; logMessage: string; setLogMessage: (v: string) => void;
  appendLog: { mutate: (f: File | null) => void; isPending: boolean }; canWrite: boolean; me?: string;
}) {
  const [file, setFile] = useState<File | null>(null);

  const events = [
    ...logs.map(l => ({ ...l, type: 'log' as const, date: new Date(l.created_at).getTime() })),
    ...history.map(h => ({ ...h, type: 'audit' as const, date: new Date(h.created_at).getTime() }))
  ].sort((a, b) => a.date - b.date);

  return (
    <div className="flex flex-col h-[700px]">
      <div className="flex-1 overflow-y-auto p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-inner mb-4 space-y-4">
        {events.length === 0 && <div className="text-center text-slate-500 my-8">No messages yet. Start the conversation.</div>}
        {events.map((ev, i) => {
          if (ev.type === 'audit') {
            return (
              <div key={`audit-${i}`} className="flex justify-center my-2">
                <span className="px-3 py-1 bg-slate-800 text-slate-500 rounded-full text-[10px] border border-slate-700 uppercase tracking-wider">
                  {(ev as any).action} by {(ev as any).actor_id || 'system'} • {new Date(ev.date).toLocaleTimeString()}
                </span>
              </div>
            );
          }
          
          const isMe = (ev as any).created_by === me;
          
          return (
            <div key={`log-${i}`} className={`flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                <strong className={`text-sm ${isMe ? 'text-orange-400' : 'text-blue-400'}`}>{(ev as any).created_by}</strong>
                <span className="text-slate-500 text-xs">{new Date(ev.date).toLocaleString()}</span>
              </div>
              <div className={`border rounded-xl p-3 max-w-[85%] shadow-sm relative ${
                isMe 
                  ? 'bg-slate-800/80 border-orange-500/20 text-slate-200 rounded-tr-none' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 rounded-tl-none'
              }`}>
                <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: renderBasicMarkdown((ev as any).message) }} />
                {(ev as any).attachment_id && (
                  <div className={`mt-3 inline-block ${isMe ? 'text-right w-full' : ''}`}>
                    <span className={`px-2 py-1 bg-slate-900 rounded text-xs border flex items-center gap-1 cursor-pointer hover:bg-slate-800 inline-flex ${isMe ? 'text-orange-400 border-orange-900/50' : 'text-blue-400 border-blue-900/50'}`} title="Attachment">
                      <i className="fa fa-paperclip" /> {(ev as any).attachment_id.split('-')[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {canWrite && (
        <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <MarkdownEditor value={logMessage} onChange={setLogMessage} placeholder="Type a message... (Markdown supported)" rows={3} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="flex gap-2 items-center">
              <Dropzone onFile={(f) => setFile(f)} compact />
              {file && <span className="text-slate-400 text-xs flex items-center bg-slate-900 px-2 py-1 rounded"><i className="fa fa-paperclip mr-1" /> {file.name} <button className="ml-2 text-red-400 hover:text-red-300 focus:outline-none" onClick={() => setFile(null)}>×</button></span>}
            </div>
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 font-medium" disabled={!logMessage.trim() || appendLog.isPending} onClick={() => { appendLog.mutate(file); setFile(null); setLogMessage(''); }}>
              {appendLog.isPending ? 'Sending…' : <><i className="fa fa-paper-plane" /> Send</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProceduresTab({ procedures, procForm, setProcForm, addProc, deleteProc, canWrite }: {
  procedures: CaseProcedure[];
  procForm: { pattern_id: string; pattern_name: string; tactic: string; description: string };
  setProcForm: (v: typeof procForm | ((p: typeof procForm) => typeof procForm)) => void;
  addProc: { mutate: () => void; isPending: boolean }; deleteProc: { mutate: (id: string) => void };
  canWrite: boolean;
}) {
  return (<>
    <h3 className="text-blue-400/80 font-medium text-sm mb-4">MITRE ATT&CK Procedures</h3>
    <table className="w-full text-left border-collapse whitespace-nowrap mb-6">
      <thead>
        <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-sm">
          <th className="px-4 py-3">Pattern</th>
          <th className="px-4 py-3">Tactic</th>
          <th className="px-4 py-3">Description</th>
          <th className="px-4 py-3">Time</th>
          <th className="px-4 py-3">Created by</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="text-sm divide-y divide-slate-800">
      {procedures.map(p => <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
        <td className="px-4 py-3 text-slate-200">{p.pattern_name || p.pattern_id}</td>
        <td className="px-4 py-3 text-slate-300">{p.tactic || '—'}</td>
        <td className="px-4 py-3 text-slate-300 whitespace-normal">{p.description || '—'}</td>
        <td className="px-4 py-3 text-slate-400">{p.occurred_at ? new Date(p.occurred_at).toLocaleString() : '—'}</td>
        <td className="px-4 py-3 text-slate-400">{p.created_by}</td>
        <td className="px-4 py-3 text-right">{canWrite && <button className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/50 rounded text-xs transition-colors" onClick={() => deleteProc.mutate(p.id)}>Delete</button>}</td>
      </tr>)}
      {!procedures.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No procedures yet.</td></tr>}
    </tbody></table>
    {canWrite && <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-800 border border-slate-700 rounded-lg shadow-sm">
      <label className="flex flex-col gap-1 text-sm text-slate-400">Pattern ID<input className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={procForm.pattern_id} onChange={e => setProcForm((f: typeof procForm) => ({ ...f, pattern_id: e.target.value }))} /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-400">Name<input className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={procForm.pattern_name} onChange={e => setProcForm((f: typeof procForm) => ({ ...f, pattern_name: e.target.value }))} /></label>
      <label className="flex flex-col gap-1 text-sm text-slate-400">Tactic<input className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" value={procForm.tactic} onChange={e => setProcForm((f: typeof procForm) => ({ ...f, tactic: e.target.value }))} /></label>
      <div className="flex items-end"><button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!procForm.pattern_id.trim() || addProc.isPending} onClick={() => addProc.mutate()}>Add Procedure</button></div>
    </div>}
  </>);
}

function SharesTab({ shares, shareForm, setShareForm, addShare, deleteShare, canWrite }: {
  shares: CaseShare[];
  shareForm: { organisation: string; profile: string; task_rule: string; observable_rule: string; owner: boolean; task_action_required: boolean };
  setShareForm: (v: typeof shareForm | ((p: typeof shareForm) => typeof shareForm)) => void;
  addShare: { mutate: () => void; isPending: boolean }; deleteShare: { mutate: (id: string) => void };
  canWrite: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const organisations = Array.from(new Set(shares.map((s) => s.organisation))).filter(Boolean);
  const profiles = Array.from(new Set(shares.map((s) => s.profile))).filter(Boolean);

  function handleSave(next: ShareItem[]) {
    const existing = new Set(shares.map((s) => s.id));
    const nextIds = new Set(next.filter((x) => x.id).map((x) => x.id!));
    shares.filter((s) => s.id && !nextIds.has(s.id)).forEach((s) => deleteShare.mutate(s.id));
    next.filter((x) => !x.id || !existing.has(x.id)).forEach((x) => {
      setShareForm({ organisation: x.organisation, profile: x.profile, task_rule: x.task_rule, observable_rule: x.observable_rule, owner: !!x.owner, task_action_required: !!x.task_action_required });
      addShare.mutate();
    });
    setShowModal(false);
  }

  return (<>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-blue-400/80 font-medium text-sm m-0">Sharing ({shares.length})</h3>
      {canWrite && <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm flex items-center gap-1.5" onClick={() => setShowModal(true)}><i className="fa fa-share-square" /> Manage shares</button>}
    </div>
    <table className="w-full text-left border-collapse whitespace-nowrap mt-4">
      <thead>
        <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 text-sm">
          <th className="px-4 py-3">Organisation</th>
          <th className="px-4 py-3">Owner</th>
          <th className="px-4 py-3">Profile</th>
          <th className="px-4 py-3">Task rule</th>
          <th className="px-4 py-3">Observable rule</th>
          <th className="px-4 py-3 text-center">Action req.</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="text-sm divide-y divide-slate-800">
      {shares.map(s => <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
        <td className="px-4 py-3 text-slate-200">{s.organisation}{s.owner && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-blue-900/50 text-blue-400 uppercase tracking-wider border border-blue-700/50">Owner</span>}</td>
        <td className="px-4 py-3 text-slate-400">{s.owner ? <i className="fa fa-check text-green-500" /> : '—'}</td>
        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{s.profile}</span></td>
        <td className="px-4 py-3 text-slate-300">{s.task_rule}</td>
        <td className="px-4 py-3 text-slate-300">{s.observable_rule}</td>
        <td className="px-4 py-3 text-center">{s.task_action_required ? <i className="fa fa-exclamation-triangle text-yellow-500" title="Action required" /> : <span className="text-slate-500">—</span>}</td>
        <td className="px-4 py-3 text-right">{canWrite && <button className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/50 rounded text-xs transition-colors" onClick={() => deleteShare.mutate(s.id)}>Revoke</button>}</td>
      </tr>)}
      {!shares.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No shares yet.</td></tr>}
    </tbody></table>
    <SharingModal
      open={showModal}
      shares={shares.map((s) => ({ id: s.id, organisation: s.organisation, profile: s.profile, task_rule: s.task_rule as ShareItem['task_rule'], observable_rule: s.observable_rule as ShareItem['observable_rule'], owner: s.owner, task_action_required: s.task_action_required }))}
      organisations={organisations.length > 0 ? organisations : ['admin']}
      profiles={profiles.length > 0 ? profiles : ['analyst', 'org-admin', 'read-only']}
      onCancel={() => setShowModal(false)}
      onSave={handleSave}
      pending={addShare.isPending}
    />
  </>);
}

function AuditTab({ history }: { history: History[] }) {
  return (<>
    <h3 className="text-blue-400/80 font-medium text-sm mb-6">History</h3>
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
      {history.map((h, i) => <div className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active" key={`${h.action}-${h.created_at}-${i}`}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-700 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
          <i className="fa fa-history"></i>
        </div>
        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <strong className="text-slate-200 block">{h.action}</strong>
              <span className="text-slate-400 text-sm">{h.actor_id || 'system'}</span>
            </div>
            <small className="text-slate-500">{new Date(h.created_at).toLocaleString()}</small>
          </div>
        </div>
      </div>)}
      {!history.length && <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No history yet.</div>}
    </div>
  </>);
}

function Info({ label, value }: { label: string; value: unknown }) { 
  return <div className="flex gap-2 text-sm"><span className="text-slate-400">{label}:</span><strong className="text-slate-200">{String(value ?? '—')}</strong></div>; 
}

function SeverityInline({ value }: { value: number }) {
  const labels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical', 4: 'Critical' };
  const klass: Record<number, string> = { 0: 'bg-blue-900/50 text-blue-400 border-blue-700/50', 1: 'bg-blue-900/50 text-blue-400 border-blue-700/50', 2: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50', 3: 'bg-red-900/50 text-red-400 border-red-700/50', 4: 'bg-red-900/50 text-red-400 border-red-700/50' };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${klass[value] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>{labels[value] ?? `S${value}`}</span>;
}

function statusLabelClass(status: string | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'open': return 'px-2 py-0.5 rounded text-[10px] bg-red-900/50 text-red-400 uppercase font-bold tracking-wider border border-red-700/50';
    case 'resolved': return 'px-2 py-0.5 rounded text-[10px] bg-green-900/50 text-green-400 uppercase font-bold tracking-wider border border-green-700/50';
    case 'duplicated': return 'px-2 py-0.5 rounded text-[10px] bg-yellow-900/50 text-yellow-400 uppercase font-bold tracking-wider border border-yellow-700/50';
    default: return 'px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 uppercase font-bold tracking-wider border border-slate-600';
  }
}

function taskStatusClass(status: string): string {
  switch (status) {
    case 'Completed': return 'px-2 py-0.5 rounded text-[10px] bg-green-900/50 text-green-400 uppercase tracking-wider border border-green-700/50';
    case 'InProgress': return 'px-2 py-0.5 rounded text-[10px] bg-yellow-900/50 text-yellow-400 uppercase tracking-wider border border-yellow-700/50';
    case 'Cancel': return 'px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 uppercase tracking-wider border border-slate-600';
    case 'Waiting': default: return 'px-2 py-0.5 rounded text-[10px] bg-blue-900/50 text-blue-400 uppercase tracking-wider border border-blue-700/50';
  }
}

function SlaBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'Completed' || status === 'Cancel') return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 border border-slate-600 uppercase">closed</span>;
  const due = new Date(dueDate).getTime();
  const diffDays = Math.ceil((due - Date.now()) / 86400000);
  if (diffDays < 0) return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/50 text-red-400 border border-red-700/50 uppercase">overdue {Math.abs(diffDays)}d</span>;
  if (diffDays <= 1) return <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 uppercase">due soon</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-900/50 text-green-400 border border-green-700/50 uppercase">{diffDays}d left</span>;
}

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'Completed': return <span title="Completed" style={{ color: '#00a65a' }}>✔</span>;
    case 'InProgress': return <span title="In Progress" style={{ color: '#f39c12' }}>▶</span>;
    case 'Cancel': return <span title="Cancelled" style={{ color: '#777' }}>✖</span>;
    case 'Waiting': default: return <span title="Waiting" style={{ color: '#3c8dbc' }}>⏳</span>;
  }
}

function renderBasicMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
  if (html.includes('<li>')) {
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul style="margin:4px 0;padding-left:20px">$1</ul>');
  }
  return html;
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

/* ─── Related Cases Panel — mirrors case.links.html ─────────────────────────── */
function RelatedCasesPanel({ relatedCases, filter, setFilter }: {
  relatedCases: RelatedCase[]; filter: string; setFilter: (v: string) => void;
}) {
  const filtered = filter ? relatedCases.filter(c => c.resolution_status === filter || c.status === filter) : relatedCases;
  const stats = relatedCases.reduce<Record<string, number>>((acc, c) => {
    const key = c.resolution_status || c.status || 'Unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  function caseDuration(start?: string, end?: string) {
    if (!start) return null;
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const hours = Math.max(0, Math.round((e.getTime() - s.getTime()) / 36e5));
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  }

  return (
    <div className="p-6">
      <h4 className="text-blue-400 font-semibold text-base flex items-center gap-2 mb-6"><i className="fa fa-link"></i> Linked cases ({relatedCases.length})</h4>
      {relatedCases.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === '' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}`} onClick={() => setFilter('')}>All ({relatedCases.length})</button>
          {Object.entries(stats).map(([key, count]) => (
            <button key={key} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}`} onClick={() => setFilter(key)}>{key} ({count})</button>
          ))}
        </div>
      )}
      {filtered.length === 0 && <div className="p-4 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No linked cases</div>}
      <div className="space-y-3">
        {filtered.map(rc => (
          <div key={rc.id} className="relative bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-sm hover:border-slate-600 transition-colors pl-5 overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-tlp-${rc.tlp}`} />
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <a href={`/cases/${rc.id}`} className="font-medium text-blue-400 hover:text-blue-300 hover:underline">#{String(rc.number).padStart(7, '0')} - {rc.title}</a>
              <SeverityInline value={rc.severity} />
              {rc.status !== 'Open' && (
                <small className="text-green-500 ml-auto">
                  (Closed at {rc.end_date ? new Date(rc.end_date).toLocaleDateString() : '?'} as <strong className="font-bold">{rc.resolution_status ?? rc.status}</strong>)
                </small>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-400 text-xs mb-2">
              {rc.start_date && <span className="flex items-center gap-1"><i className="fa fa-clock-o" /> {caseDuration(rc.start_date, rc.end_date)}</span>}
              <span className="flex items-center gap-1"><i className="fa fa-link" /> {rc.links_count} linked observable(s)</span>
            </div>
            {rc.merged_from && rc.merged_from.length > 0 && (
              <div className="text-red-400 text-xs mb-2 p-2 bg-red-900/10 border border-red-900/30 rounded">
                Merged from {rc.merged_from.map((mf, i) => <span key={mf}>{i > 0 ? ' and ' : ''}<a href={`/cases/${mf}`} className="hover:underline">Case #{mf.slice(0, 8)}</a></span>)}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {rc.linked_observables?.slice(0, 3).map(lo => (
                <div key={lo.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300">
                  <span className="px-1 py-0.5 bg-blue-900/50 text-blue-400 rounded text-[10px] leading-none uppercase tracking-wider">{lo.data_type}</span>
                  <span className="truncate max-w-[150px]">{lo.data}</span>
                  {lo.ioc && <i className="fa fa-bullseye text-red-500" title="IOC" />}
                </div>
              ))}
              {rc.linked_observables && rc.linked_observables.length > 3 && <div className="inline-flex items-center px-2 py-1 text-xs text-slate-500">+{rc.linked_observables.length - 3} more</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Responder Actions Panel — mirrors responder-actions.html ──────────────── */
function ResponderActionsPanel({ actions }: { actions: ResponderAction[] }) {
  if (!actions.length) return null;
  const statusClass = (s: string) => {
    switch (s) {
      case 'Success': return 'px-2 py-0.5 bg-green-900/30 text-green-400 border border-green-700/50 rounded text-[10px] uppercase tracking-wider';
      case 'InProgress': return 'px-2 py-0.5 bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded text-[10px] uppercase tracking-wider';
      case 'Waiting': return 'px-2 py-0.5 bg-blue-900/30 text-blue-400 border border-blue-700/50 rounded text-[10px] uppercase tracking-wider';
      case 'Failure': return 'px-2 py-0.5 bg-red-900/30 text-red-400 border border-red-700/50 rounded text-[10px] uppercase tracking-wider';
      default: return 'px-2 py-0.5 bg-slate-700 text-slate-300 border border-slate-600 rounded text-[10px] uppercase tracking-wider';
    }
  };
  return (
    <div className="mt-6">
      <h4 className="text-blue-400/80 font-medium text-sm mb-3">Responder jobs ({actions.length})</h4>
      <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700 text-slate-400">
              <th className="px-4 py-3">Responder</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {actions.map(a => (
              <tr key={a.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 text-slate-200">{a.responder_name || a.responder_id}</td>
                <td className="px-4 py-3"><span className={statusClass(a.status)}>{a.status}</span></td>
                <td className="px-4 py-3 text-slate-400">{a.start_date ? new Date(a.start_date).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-slate-300 whitespace-normal">{a.operations?.map(o => o.message).filter(Boolean).join('; ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Case Alerts Tab — mirrors case.alerts.html ───────────────────────────── */
function CaseAlertsTab({ alerts }: { alerts: CaseAlert[] }) {
  const [filter, setFilter] = useState('');
  const [sortField, setSortField] = useState<'source_ref' | 'type' | 'title' | 'source' | 'severity' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');

  const filtered = filter ? alerts.filter(a => a.type === filter || a.source === filter) : alerts;
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === 'ASC' ? cmp : -cmp;
  });

  const typeStats = alerts.reduce<Record<string, number>>((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {});
  const sourceStats = alerts.reduce<Record<string, number>>((acc, a) => { acc[a.source] = (acc[a.source] ?? 0) + 1; return acc; }, {});

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortField(field); setSortDir('ASC'); }
  }

  return (<>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-blue-400/80 font-medium text-sm m-0">Linked alerts ({alerts.length})</h3>
    </div>
    {alerts.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <button className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === '' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}`} onClick={() => setFilter('')}>All ({alerts.length})</button>
        <span className="text-slate-500 text-sm ml-2 mr-1 font-medium">Type:</span>
        {Object.entries(typeStats).map(([k, v]) => (
          <button key={k} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}`} onClick={() => setFilter(k)}>{k} ({v})</button>
        ))}
        <span className="text-slate-500 text-sm ml-2 mr-1 font-medium">Source:</span>
        {Object.entries(sourceStats).map(([k, v]) => (
          <button key={k} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}`} onClick={() => setFilter(k)}>{k} ({v})</button>
        ))}
      </div>
    )}
    {sorted.length === 0 && <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">No alerts linked to this case.</div>}
    {sorted.length > 0 && (
      <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700 text-slate-400">
              <th className="px-4 py-3"><button className="text-slate-400 hover:text-blue-400 font-medium" onClick={() => toggleSort('source_ref')}>Reference {sortField === 'source_ref' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
              <th className="px-4 py-3"><button className="text-slate-400 hover:text-blue-400 font-medium" onClick={() => toggleSort('type')}>Type {sortField === 'type' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
              <th className="px-4 py-3"><button className="text-slate-400 hover:text-blue-400 font-medium" onClick={() => toggleSort('title')}>Title {sortField === 'title' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
              <th className="px-4 py-3"><button className="text-slate-400 hover:text-blue-400 font-medium" onClick={() => toggleSort('source')}>Source {sortField === 'source' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
              <th className="px-4 py-3"><button className="text-slate-400 hover:text-blue-400 font-medium" onClick={() => toggleSort('severity')}>Severity {sortField === 'severity' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
              <th className="px-4 py-3 text-center text-slate-400 font-medium">Attributes</th>
              <th className="px-4 py-3"><button className="text-slate-400 hover:text-blue-400 font-medium" onClick={() => toggleSort('created_at')}>Date {sortField === 'created_at' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map(a => (
              <tr key={a.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 text-slate-200 font-medium whitespace-normal break-words max-w-[150px]">{a.source_ref}</td>
                <td className="px-4 py-3"><a href={`/alerts/${a.id}`} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600 transition-colors">{a.type}</a></td>
                <td className="px-4 py-3 whitespace-normal break-words max-w-sm"><a href={`/alerts/${a.id}`} className="font-medium text-blue-400 hover:text-blue-300 hover:underline">{a.title}</a><div className="mt-1"><TagList data={a.tags} /></div></td>
                <td className="px-4 py-3 text-slate-300">{a.source}</td>
                <td className="px-4 py-3"><SeverityInline value={a.severity} /></td>
                <td className="px-4 py-3 text-center text-slate-400">{a.tags?.length ?? 0}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </>);
}
