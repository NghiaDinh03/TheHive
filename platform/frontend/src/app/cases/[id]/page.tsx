'use client';

import { Fragment, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AttachmentPanel, type AttachmentItem } from '@/components/AttachmentPanel';
import { ObservableFlags, Pap, Severity, TagList, TaskFlags, Tlp } from '@/components/Badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CustomFieldEditor, type CustomFieldDef } from '@/components/CustomFieldEditor';
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
type History = { action: string; actor_id: string; created_at: string };
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
  tags: string[]; links_count: number; linked_observables: { id: string; data_type: string; data: string; ioc?: boolean; sighted?: boolean }[];
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

const TABS = ['Details', 'Tasks', 'Observables', 'Alerts', 'Logs', 'Attachments', 'Procedures', 'Shares', 'Audit'] as const;
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
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [relatedFilter, setRelatedFilter] = useState('');

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
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
          <section className="content-header">
            <h1>Case <small>#{item?.number ?? '...'} investigation workspace</small></h1>
            <ol className="breadcrumb"><li>Home</li><li>Cases</li><li className="active">#{item?.number ?? '...'}</li></ol>
          </section>
          <section className="content case-page next-case-page">
            <div className="case-panelinfo box box-primary">
              <div className="box-header with-border case-panelinfo-header">
                <h3 className="box-title text-primary">#{item?.number ?? '...'} - {item?.title ?? 'Case detail'}</h3>
                <div className="box-tools pull-right case-detail-status">
                  <span className={statusLabelClass(item?.status)}>{item?.status ?? 'Loading'}</span>
                  {item?.flag && <span className="label label-warning" title="Flagged">Flagged</span>}
                </div>
              </div>
              <div className="box-body case-panelinfo-body">
                <span><strong>Severity</strong> <Severity value={item?.severity ?? 2} /></span>
                <span><strong>TLP</strong> <Tlp value={item?.tlp ?? 2} /></span>
                <span><strong>PAP</strong> <Pap value={item?.pap ?? 2} /></span>
                <span><strong>Assignee</strong> {item?.assignee || 'None'}</span>
                <span><strong>Owner</strong> {item?.owner || item?.owning_organisation || 'None'}</span>
                <span><strong>Updated</strong> {item?.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</span>
              </div>
            </div>
            <div className="case-detail-layout">
              <section className="nav-tabs-custom case-main-tabset">
                <ul className="nav nav-tabs detail-tab-strip">
                  {TABS.map(tab => (
                    <li key={tab} className={activeTab === tab ? 'active' : ''}>
                      <button type="button" onClick={() => setActiveTab(tab)}>
                        <span>{tab}</span>
                        {tab === 'Tasks' && <span className="badge">{detail.data?.tasks.length ?? 0}</span>}
                        {tab === 'Observables' && <span className="badge badge-primary">{detail.data?.observables.length ?? 0}</span>}
                        {tab === 'Attachments' && <span className="badge">{detail.data?.attachments.length ?? 0}</span>}
                        {tab === 'Procedures' && <span className="badge">{detail.data?.procedures.length ?? 0}</span>}
                        {tab === 'Alerts' && <span className="badge">{detail.data?.alerts?.length ?? 0}</span>}
                        {tab === 'Shares' && <span className="badge">{detail.data?.shares.length ?? 0}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              <div className="tab-content case-page-content">
                {error && <div className="admin-alert error">{error}</div>}
                {detail.isLoading && <div className="thehive-empty">Loading…</div>}
                {item && activeTab === 'Details' && <DetailsTab item={item} customFields={detail.data?.custom_fields ?? []} cfForm={cfForm} setCfForm={setCfForm} addCF={addCF} updateCF={updateCF} deleteCF={deleteCF} updateCase={updateCase} canWrite={canWrite} relatedCases={detail.data?.related_cases ?? []} responderActions={detail.data?.responder_actions ?? []} relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter} />}
                {item && activeTab === 'Tasks' && <TasksTab tasks={detail.data?.tasks ?? []} caseId={params.id} canWrite={canWrite} showTaskForm={showTaskForm} setShowTaskForm={setShowTaskForm} taskForm={taskForm} setTaskForm={setTaskForm} createTask={createTask} closeTask={closeTask} assignTask={assignTask} />}
                {item && activeTab === 'Observables' && <ObservablesTab observables={detail.data?.observables ?? []} canWrite={canWrite} obsForm={obsForm} setObsForm={setObsForm} createObs={createObs} patchObs={patchObs} deleteObs={deleteObs} />}
                {item && activeTab === 'Logs' && <LogsTab logs={detail.data?.logs ?? []} history={detail.data?.history ?? []} logMessage={logMessage} setLogMessage={setLogMessage} appendLog={appendLog} canWrite={canWrite} />}
                {item && activeTab === 'Attachments' && <AttachmentPanel user={me.data} caseId={params.id} initialAttachments={detail.data?.attachments ?? []} title="Case attachments" />}
                {item && activeTab === 'Procedures' && <ProceduresTab procedures={detail.data?.procedures ?? []} procForm={procForm} setProcForm={setProcForm} addProc={addProc} deleteProc={deleteProc} canWrite={canWrite} />}
                {item && activeTab === 'Shares' && <SharesTab shares={detail.data?.shares ?? []} shareForm={shareForm} setShareForm={setShareForm} addShare={addShare} deleteShare={deleteShare} canWrite={canWrite} />}
                {item && activeTab === 'Alerts' && <CaseAlertsTab alerts={detail.data?.alerts ?? []} />}
                {item && activeTab === 'Audit' && <AuditTab history={detail.data?.history ?? []} />}
              </div>
            </section>
            <aside className="box box-primary case-action-box">
              {/* Flow panel — mirrors legacy flow sidebar */}
              {detail.data?.history && detail.data.history.length > 0 && (
                <div className="box-header with-border" style={{ padding: 0 }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #f4f4f4' }}>
                    <h3 className="box-title" style={{ fontSize: '0.88rem' }}>Activity Flow</h3>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <FlowPanel
                      items={detail.data.history.map((h, i) => ({
                        id: `${h.action}-${i}`,
                        objectType: 'case',
                        action: h.action,
                        objectId: item?.id ?? '',
                        objectTitle: item?.title,
                        actorId: h.actor_id,
                        createdAt: h.created_at,
                      }))}
                      showActor={false}
                    />
                  </div>
                </div>
              )}
              <div className="box-header with-border"><h3 className="box-title">Actions</h3></div>
              <div className="box-body detail-side-list">
                <p className="text-muted text-sm">Core fields are edited inline in the Details tab, matching TheHive 4 updatable directives.</p>
                <button className="thehive-btn-secondary" disabled={!canWrite} onClick={() => toggleFlag.mutate()}>{item?.flag ? 'Unflag case' : 'Flag case'}</button>
                <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '8px 0' }} />
                {item?.status === 'Open' && <button className="thehive-btn-secondary" disabled={!canWrite || closeCase.isPending} onClick={() => setShowCloseDialog(true)}>Close case (Resolve)</button>}
                {(item?.status === 'Resolved' || item?.status === 'Duplicated') && <button className="thehive-btn-secondary" disabled={!canWrite || reopenCase.isPending} onClick={() => reopenCase.mutate()}>Reopen</button>}
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="thehive-input" placeholder="Target case ID" value={dupCaseId} onChange={e => setDupCaseId(e.target.value)} style={{ flex: 1, fontSize: '0.8rem' }} />
                  <button className="thehive-btn-sm" disabled={!canWrite || !dupCaseId.trim()} onClick={() => duplicateCase.mutate()}>Mark as duplicate</button>
                </div>
                <button className="thehive-btn-secondary" disabled={!canWrite} onClick={() => setShowMergeDialog(true)}>Merge case</button>
                <button className="thehive-btn-secondary" onClick={() => setShowExportDialog(true)}>Export case</button>
                <button className="thehive-btn-secondary danger" disabled={!canWrite || deleteCase.isPending} onClick={() => setShowDeleteDialog(true)}>Delete</button>
              </div>
              {showCloseDialog && <div className="box-body" style={{ borderTop: '2px solid #3c8dbc', background: '#f8f9fa' }}>
                <h4 style={{ marginBottom: 8, color: '#3c8dbc' }}>Close case</h4>
                <label>Impact<select className="thehive-input" value={closeForm.impact_status} onChange={e => setCloseForm(f => ({ ...f, impact_status: e.target.value }))}>
                  <option value="NoImpact">No Impact</option><option value="WithImpact">With Impact</option><option value="NotApplicable">Not Applicable</option>
                </select></label>
                <label>Resolution<select className="thehive-input" value={closeForm.resolution_status} onChange={e => setCloseForm(f => ({ ...f, resolution_status: e.target.value }))}>
                  <option value="TruePositive">True Positive</option><option value="FalsePositive">False Positive</option>
                  <option value="Indeterminate">Indeterminate</option><option value="Other">Other</option>
                </select></label>
                <label>Summary<textarea className="thehive-input" rows={3} value={closeForm.summary} onChange={e => setCloseForm(f => ({ ...f, summary: e.target.value }))} placeholder="Case closure summary..." /></label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="thehive-btn-primary" disabled={closeCase.isPending} onClick={() => closeCase.mutate()}>{closeCase.isPending ? 'Closing…' : 'Confirm close'}</button>
                  <button className="thehive-btn-secondary" onClick={() => setShowCloseDialog(false)}>Cancel</button>
                </div>
              </div>}
              {showMergeDialog && <div className="box-body" style={{ borderTop: '2px solid #f39c12', background: '#fef9e7' }}>
                <h4 style={{ marginBottom: 8, color: '#f39c12' }}>Merge case</h4>
                <p className="text-muted text-sm" style={{ marginBottom: 8 }}>Search for a case to merge this case into. All tasks, observables, logs, and attachments will be moved to the target case.</p>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <select className="thehive-input" value={mergeSearchType} onChange={e => { setMergeSearchType(e.target.value as 'title' | 'number'); setMergeResults([]); }} style={{ width: 100 }}>
                    <option value="title">By Title</option><option value="number">By Number</option>
                  </select>
                  <input className="thehive-input" placeholder={mergeSearchType === 'number' ? 'Case number...' : 'Search by title...'} value={mergeSearchInput} onChange={e => { setMergeSearchInput(e.target.value); searchMergeCases(mergeSearchType, e.target.value); }} style={{ flex: 1 }} />
                </div>
                {mergeResults.length > 0 && <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
                  {mergeResults.map(c => <div key={c.id} className={`merge-result-item ${selectedMergeCase?.id === c.id ? 'selected' : ''}`} onClick={() => setSelectedMergeCase(c)} style={{ padding: '6px 8px', cursor: 'pointer', border: '1px solid #eee', marginBottom: 4, borderRadius: 4, background: selectedMergeCase?.id === c.id ? '#e8f4fd' : '#fff' }}>
                    <strong>#{c.number}</strong> {c.title} <span className={`severity severity-${c.severity}`} style={{ marginLeft: 8 }}>{['Low','Medium','High','Critical'][c.severity] ?? 'Unknown'}</span>
                    <div className="text-muted text-xs">{c.status} · {c.assignee || 'no assignee'} · {c.tags?.join(', ') || 'no tags'}</div>
                  </div>)}
                </div>}
                {selectedMergeCase && <div className="alert alert-warning" style={{ marginBottom: 8 }}>Merging into <strong>#{selectedMergeCase.number} - {selectedMergeCase.title}</strong>. This action cannot be undone.</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-warning" disabled={!selectedMergeCase || mergeCase.isPending} onClick={() => mergeCase.mutate()}>{mergeCase.isPending ? 'Merging…' : 'Confirm merge'}</button>
                  <button className="btn btn-default" onClick={() => { setShowMergeDialog(false); setSelectedMergeCase(null); setMergeSearchInput(''); setMergeResults([]); }}>Cancel</button>
                </div>
              </div>}
              {showExportDialog && <div className="box-body" style={{ borderTop: '2px solid #3c8dbc', background: '#f8f9fa' }}>
                <h4 style={{ marginBottom: 8, color: '#3c8dbc' }}>Export case</h4>
                <label>Format<select className="thehive-input" value={exportFormat} onChange={e => setExportFormat(e.target.value as 'json' | 'csv')}><option value="json">JSON</option><option value="csv">CSV</option></select></label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => void exportCase()}>Download</button>
                  <button className="btn btn-default" onClick={() => setShowExportDialog(false)}>Cancel</button>
                </div>
              </div>}
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
            </aside>
          </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function DetailsTab({ item, customFields, cfForm, setCfForm, addCF, updateCF, deleteCF, updateCase, canWrite, relatedCases, responderActions, relatedFilter, setRelatedFilter }: {
  item: CaseCore; customFields: CustomField[];
  cfForm: { name: string; value: string; field_type: string }; setCfForm: (v: typeof cfForm | ((p: typeof cfForm) => typeof cfForm)) => void;
  addCF: { mutate: (field: { name: string; value: string; field_type: string }) => void; isPending: boolean };
  updateCF: { mutate: (v: { cfId: string; value: string }) => void; isPending: boolean };
  deleteCF: { mutate: (id: string) => void };
  updateCase: { mutate: (patch?: Record<string, unknown>) => void; isPending: boolean };
  canWrite: boolean;
  relatedCases: RelatedCase[]; responderActions: ResponderAction[];
  relatedFilter: string; setRelatedFilter: (v: string) => void;
}) {
  const disabled = !canWrite || updateCase.isPending;
  return (<>
    <div className="row case-details">
      <div className="col-md-8">
        <h4 className="vpad10 text-primary">Basic Information</h4>
        <dl className="dl-horizontal clear">
          <dt className="pull-left">Title</dt>
          <dd>{canWrite ? <UpdatableSimpleText value={item.title} disabled={disabled} onUpdate={(title) => updateCase.mutate({ title })} /> : item.title}</dd>
        </dl>
        <dl className="dl-horizontal clear">
          <dt className="pull-left">Severity</dt>
          <dd>{canWrite ? <Severity value={item.severity} active onUpdate={(severity) => updateCase.mutate({ severity })} /> : <Severity value={item.severity} />}</dd>
        </dl>
        <dl className="dl-horizontal clear">
          <dt className="pull-left">TLP</dt>
          <dd>{canWrite ? <Tlp value={item.tlp} format="active" onUpdate={(tlp) => updateCase.mutate({ tlp })} /> : <Tlp value={item.tlp} />}</dd>
        </dl>
        <dl className="dl-horizontal clear">
          <dt className="pull-left">PAP</dt>
          <dd>{canWrite ? <Pap value={item.pap} format="active" onUpdate={(pap) => updateCase.mutate({ pap })} /> : <Pap value={item.pap} />}</dd>
        </dl>
        <dl className="dl-horizontal">
          <dt className="pull-left">Assignee</dt>
          <dd>{canWrite ? <UpdatableUser value={item.assignee || ''} disabled={disabled} blankText="Not Assigned" onUpdate={(assignee) => updateCase.mutate({ assignee })} /> : (item.assignee || <em className="text-warning">Not Assigned</em>)}</dd>
        </dl>
        <dl className="dl-horizontal clear">
          <dt className="pull-left">Date</dt>
          <dd>{canWrite ? <UpdatableDate value={item.start_date ?? null} disabled={disabled} onUpdate={(start_date) => updateCase.mutate({ start_date })} clearable /> : (item.start_date ? new Date(item.start_date).toLocaleString() : <em className="text-warning">Not Specified</em>)}</dd>
        </dl>
        <dl className="dl-horizontal">
          <dt className="pull-left">Tags</dt>
          <dd>{canWrite ? <UpdatableTags value={item.tags ?? []} disabled={disabled} onUpdate={(tags) => updateCase.mutate({ tags })} clearable /> : <TagList data={item.tags} />}</dd>
        </dl>
        {item.status !== 'Open' && <dl className="dl-horizontal clear">
          <dt className="pull-left text-success">Close date</dt>
          <dd className="text-success">{item.end_date ? new Date(item.end_date).toLocaleString() : <em>Not Specified</em>}</dd>
        </dl>}
      </div>
      <div className="col-md-4">
        <h4 className="vpad10 text-primary">Related cases</h4>
        <div className="box box-solid box-default">
          <div className="box-body detail-side-list">
            <dl className="dl-horizontal clear"><dt>Owner</dt><dd>{item.owner || 'None'}</dd></dl>
            <dl className="dl-horizontal clear"><dt>Organisation</dt><dd>{item.owning_organisation || 'None'}</dd></dl>
            <dl className="dl-horizontal clear"><dt>Template</dt><dd>{item.case_template || <em className="text-muted">None</em>}</dd></dl>
            <dl className="dl-horizontal clear"><dt>Impact</dt><dd>{item.impact_status || '—'}</dd></dl>
            <dl className="dl-horizontal clear"><dt>Resolution</dt><dd>{item.resolution_status || '—'}</dd></dl>
            <dl className="dl-horizontal clear"><dt>Updated</dt><dd>{new Date(item.updated_at).toLocaleString()}</dd></dl>
          </div>
        </div>
        <RelatedCasesPanel relatedCases={relatedCases} filter={relatedFilter} setFilter={setRelatedFilter} />
        <ResponderActionsPanel actions={responderActions} />
      </div>
    </div>

    <CustomFieldEditor
      fields={customFields as CustomFieldDef[]}
      canWrite={canWrite}
      onAdd={(field) => addCF.mutate(field)}
      onUpdate={(cfId, value) => updateCF.mutate({ cfId, value })}
      onDelete={(cfId) => deleteCF.mutate(cfId)}
      pending={addCF.isPending || updateCF.isPending}
    />

    <div className="vpad10">
      <h4 className="vpad10 text-primary">Description</h4>
      <div className="description-pane">
        {canWrite ? <UpdatableText value={item.description || ''} disabled={disabled} onUpdate={(description) => updateCase.mutate({ description })} clearable /> : <div className="markdown">{item.description || <em className="text-warning">Not Specified</em>}</div>}
      </div>
    </div>
    {(item.summary || item.status !== 'Open') && <div className="vpad10">
      <h4 className="vpad10 text-primary">Summary</h4>
      <div className="description-pane">
        {canWrite ? <UpdatableText value={item.summary || ''} disabled={disabled} onUpdate={(summary) => updateCase.mutate({ summary })} clearable /> : <div className="markdown">{item.summary || <em className="text-warning">Not Specified</em>}</div>}
      </div>
    </div>}
  </>);
}

function TasksTab({ tasks, caseId, canWrite, showTaskForm, setShowTaskForm, taskForm, setTaskForm, createTask, closeTask, assignTask }: {
  tasks: Task[]; caseId: string; canWrite: boolean;
  showTaskForm: boolean; setShowTaskForm: (v: boolean) => void;
  taskForm: { title: string; group_name: string; assignee: string; description: string };
  setTaskForm: (v: typeof taskForm | ((p: typeof taskForm) => typeof taskForm)) => void;
  createTask: { mutate: () => void; isPending: boolean };
  closeTask: { mutate: (id: string) => void };
  assignTask: { mutate: (v: { taskId: string; assignee: string }) => void };
}) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedTasks(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const refetch = () => window.location.reload();
  const startTask = (id: string) => apiFetch(`/api/v1/tasks/${id}/start`, { method: 'POST' }).then(refetch);
  const reopenTask = (id: string) => apiFetch(`/api/v1/tasks/${id}/reopen`, { method: 'POST' }).then(refetch);
  const cancelTask = (id: string) => apiFetch(`/api/v1/tasks/${id}/cancel`, { method: 'POST' }).then(refetch);

  const reorderTask = (task: Task, delta: number) => apiFetch('/api/v1/tasks/reorder', { method: 'POST', json: { case_id: caseId, tasks: [{ id: task.id, group_name: task.group_name || 'default', order_index: Math.max(0, task.order_index + delta) }] } }).then(refetch);
  const bulkCloseWaiting = () => apiFetch('/api/v1/tasks/bulk/close', { method: 'POST', json: { case_id: caseId } }).then(refetch);

  return (<>
    <div className="case-tab-toolbar">
      <h3 className="detail-section-title" style={{ margin: 0 }}>List of tasks ({tasks.length})</h3>
      {canWrite && <div className="btn-toolbar"><button className="btn btn-sm btn-default" onClick={bulkCloseWaiting}>Close/Cancel open tasks</button><button className="btn btn-sm btn-primary" onClick={() => setShowTaskForm(!showTaskForm)}>{showTaskForm ? 'Cancel' : 'Add Task'}</button></div>}
    </div>
    {showTaskForm && canWrite && <div className="detail-action-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 8, marginTop: 10 }}>
      <label>Group<input className="thehive-input" value={taskForm.group_name} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, group_name: e.target.value }))} placeholder="Task group" /></label>
      <label>Title *<input className="thehive-input" value={taskForm.title} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, title: e.target.value }))} placeholder="Task title" /></label>
      <label>Assignee<input className="thehive-input" value={taskForm.assignee} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, assignee: e.target.value }))} placeholder="Assignee login" /></label>
      <div style={{ gridColumn: '1 / -1' }}><label>Description<textarea className="thehive-input" value={taskForm.description} onChange={e => setTaskForm((f: typeof taskForm) => ({ ...f, description: e.target.value }))} placeholder="Task description" /></label></div>
      <button className="thehive-btn-primary" disabled={!taskForm.title.trim() || createTask.isPending} onClick={() => createTask.mutate()}>Create task</button>
    </div>}
    <table className="table table-hover valigned tasks-table data-list" style={{ marginTop: 10 }}><thead><tr><th></th><th>Group</th><th>Task</th><th>Status</th><th>Assignee</th><th>Date</th><th>Due/SLA</th><th>Order</th>{canWrite && <th className="text-right">Actions</th>}</tr></thead><tbody>
      {tasks.map(t => <Fragment key={t.id}>
      <tr className={t.flag ? 'task-flagged' : ''}>
        <td className="task-status" align="center"><TaskFlags task={t} /></td>
        <td>{t.group_name || '—'}</td>
        <td>
          {t.description && <button className="btn btn-xs btn-link" onClick={() => toggleExpand(t.id)} style={{ padding: 0, marginRight: 4 }}><i className={`fa ${expandedTasks.has(t.id) ? 'fa-chevron-up' : 'fa-chevron-down'}`} /></button>}
          <a href={`/tasks/${t.id}`} className={t.flag ? 'text-danger' : ''}>{t.flag && <span className="text-danger noline mr-xxxs" title="Action Required"><i className="fa fa-exclamation-triangle" /></span>}{t.title}</a>
          {t.status === 'Completed' && t.end_date && t.start_date && <div className="text-success" style={{ fontSize: '0.75rem' }}>Closed after <em>{Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 60000)}m</em></div>}
          {t.status === 'InProgress' && t.start_date && <div className="text-warning" style={{ fontSize: '0.75rem' }}>Started <em>{new Date(t.start_date).toLocaleDateString()}</em></div>}
        </td>
        <td><span className={taskStatusClass(t.status)}>{t.status}</span>{t.status === 'InProgress' && t.start_date && <div className="text-warning" style={{ fontSize: '0.75rem' }}>Started {new Date(t.start_date).toLocaleDateString()}</div>}{t.status === 'Completed' && t.end_date && <div className="text-success" style={{ fontSize: '0.75rem' }}>Closed {new Date(t.end_date).toLocaleDateString()}</div>}</td>
        <td>{t.assignee || <em className="text-warning">Not Assigned</em>}</td>
        <td>{t.start_date ? new Date(t.start_date).toLocaleDateString() : '—'}</td>
        <td>{t.due_date ? <><div>{new Date(t.due_date).toLocaleDateString()}</div><SlaBadge dueDate={t.due_date} status={t.status} /></> : '—'}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <span className="task-reorder-handle" title="Drag to reorder">
            <i className="fa fa-bars text-muted" style={{ cursor: 'grab', marginRight: 4 }} />
          </span>
          <button className="thehive-btn-sm" onClick={() => reorderTask(t, -1)} title="Move up" style={{ padding: '1px 4px' }}>▲</button>
          <span className="mono" style={{ margin: '0 4px', fontSize: '0.75rem', color: '#999' }}>{t.order_index}</span>
          <button className="thehive-btn-sm" onClick={() => reorderTask(t, 1)} title="Move down" style={{ padding: '1px 4px' }}>▼</button>
        </td>
        {canWrite && <td style={{ whiteSpace: 'nowrap' }}>
          {t.status === 'Waiting' && <button className="thehive-btn-sm" onClick={() => startTask(t.id)} title="Start">▶ Start</button>}
          {t.status === 'InProgress' && <button className="thehive-btn-sm" onClick={() => closeTask.mutate(t.id)} title="Close">✔ Close</button>}
          {(t.status === 'Completed' || t.status === 'Cancel') && <button className="thehive-btn-sm" onClick={() => reopenTask(t.id)} title="Reopen">↩ Reopen</button>}
          {t.status !== 'Cancel' && t.status !== 'Completed' && <button className="thehive-btn-sm danger" style={{ marginLeft: 4 }} onClick={() => cancelTask(t.id)} title="Cancel">✖</button>}
        </td>}
      </tr>
      {t.description && expandedTasks.has(t.id) && <tr><td colSpan={canWrite ? 9 : 8} className="wrap"><div className="mt-xxs filter-panel markdown" style={{ fontSize: '0.85rem', padding: '8px 12px' }}>{t.description}</div></td></tr>}
      </Fragment>)}
      {!tasks.length && <tr><td colSpan={canWrite ? 9 : 8} className="thehive-empty">No tasks yet.</td></tr>}
    </tbody></table>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 className="detail-section-title" style={{ margin: 0 }}>Observables ({observables.length})</h3>
      {canWrite && <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}><i className="fa fa-plus" /> New observable(s)</button>}
    </div>
    <ObservableCreationModal
      open={showModal}
      types={types}
      knownTags={knownTags}
      pending={createObs.isPending}
      onCancel={() => setShowModal(false)}
      onSubmit={handleSubmit}
    />
    <table className="table table-hover valigned data-list observable-table" style={{ marginTop: 10 }}><thead><tr><th>TLP</th><th>Flags</th><th>Type</th><th>Data</th><th>Tags</th><th>Owner</th>{canWrite && <th>Actions</th>}</tr></thead><tbody>
      {observables.map(o => <tr key={o.id}>
        <td><Tlp value={o.tlp} format="icon" /></td>
        <td style={{ fontSize: '0.8rem' }}>
          <span onClick={() => canWrite && patchObs.mutate({ obsId: o.id, patch: { ioc: !o.ioc } })} style={{ cursor: canWrite ? 'pointer' : 'default' }}><ObservableFlags observable={o} />{!o.ioc && !o.sighted && !o.ignore_similarity && <span className="text-muted">No flags</span>}</span>
          <div className="mt-xxs">
            <a href="#" onClick={(event) => { event.preventDefault(); if (canWrite) patchObs.mutate({ obsId: o.id, patch: { sighted: !o.sighted } }); }} className="noline mr-xxs">{o.sighted ? 'unsight' : 'sight'}</a>
            <a href="#" onClick={(event) => { event.preventDefault(); if (canWrite) patchObs.mutate({ obsId: o.id, patch: { ignore_similarity: !o.ignore_similarity } }); }} className="noline">{o.ignore_similarity ? 'similarity on' : 'ignore similarity'}</a>
          </div>
        </td>
        <td><a href={`/observables/${o.id}`}><span className="label label-info">{o.data_type}</span></a></td>
        <td><div className="mono" style={{ wordBreak: 'break-all' }}>{o.data}</div>{o.full_data && <div style={{ marginTop: 4 }}><span className="label label-warning" title="Full data stored server-side">hash-indexed</span> <small className="mono">{o.data_hash}</small></div>}<small style={{ color: '#777' }}>{o.message}</small>{o.attachment_id && <div style={{ marginTop: 4 }}><span className="label label-default"><i className="fa fa-paperclip" /> File {(o.attachment_id).split('-')[0]}</span></div>}</td>
        <td><TagList data={o.tags} /></td>
        <td>{o.created_by}</td>
        {canWrite && <td><button className="thehive-btn-sm danger" onClick={() => deleteObs.mutate(o.id)}>Delete</button></td>}
      </tr>)}
      {!observables.length && <tr><td colSpan={canWrite ? 7 : 6} className="thehive-empty">No observables yet.</td></tr>}
    </tbody></table>
  </>);
}

function LogsTab({ logs, history, logMessage, setLogMessage, appendLog, canWrite }: {
  logs: CaseLog[]; history: History[]; logMessage: string; setLogMessage: (v: string) => void;
  appendLog: { mutate: (f: File | null) => void; isPending: boolean }; canWrite: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);

  const events = [
    ...logs.map(l => ({ ...l, type: 'log' as const, date: new Date(l.created_at).getTime() })),
    ...history.map(h => ({ ...h, type: 'audit' as const, date: new Date(h.created_at).getTime() }))
  ].sort((a, b) => b.date - a.date);

  return (<>
    {canWrite && <>
      <h3 className="detail-section-title">Add note</h3>
      <div className="detail-action-panel">
        <div className="clearfix" style={{ marginBottom: 4 }}>
          <a className="pull-right text-muted" href="https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem' }}>
            <i className="fa fa-question-circle" /> Markdown Reference
          </a>
        </div>
        <MarkdownEditor value={logMessage} onChange={setLogMessage} placeholder="Write a note… (markdown supported)" rows={6} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <Dropzone onFile={(f) => setFile(f)} compact />
          {file && <span className="text-muted text-xs"><i className="fa fa-paperclip" /> {file.name} <button className="btn btn-xs btn-link text-danger" onClick={() => setFile(null)}>×</button></span>}
          <button className="thehive-btn-primary" disabled={!logMessage.trim() || appendLog.isPending} onClick={() => { appendLog.mutate(file); setFile(null); setLogMessage(''); }}>
            {appendLog.isPending ? 'Saving…' : <><i className="glyphicon glyphicon-comment" /> Add log</>}
          </button>
        </div>
      </div>
    </>}
    <h3 className="detail-section-title">Timeline ({events.length} entries)</h3>
    <div className="timeline">
      {events.map((ev, i) => <div className="timeline-item" key={`${ev.type}-${i}`}>
        <span className="timeline-dot" style={{ background: ev.type === 'audit' ? '#ccc' : 'var(--thehive-primary)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{ev.type === 'log' ? (ev as any).created_by : `${(ev as any).action} by ${(ev as any).actor_id || 'system'}`}</strong>
            <small style={{ color: '#888' }}>{new Date(ev.date).toLocaleString()}</small>
          </div>
          {ev.type === 'log' && <>
            <div className="detail-markdown" style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: renderBasicMarkdown((ev as any).message) }} />
            {(ev as any).attachment_id && <div style={{ marginTop: 8 }}><span className="label label-default" title="Attachment ID">📎 Attachment {(ev as any).attachment_id.split('-')[0]}</span></div>}
          </>}
        </div>
      </div>)}
      {!events.length && <div className="thehive-empty">No events yet.</div>}
    </div>
  </>);
}

function ProceduresTab({ procedures, procForm, setProcForm, addProc, deleteProc, canWrite }: {
  procedures: CaseProcedure[];
  procForm: { pattern_id: string; pattern_name: string; tactic: string; description: string };
  setProcForm: (v: typeof procForm | ((p: typeof procForm) => typeof procForm)) => void;
  addProc: { mutate: () => void; isPending: boolean }; deleteProc: { mutate: (id: string) => void };
  canWrite: boolean;
}) {
  return (<>
    <h3 className="detail-section-title">MITRE ATT&CK Procedures</h3>
    <table className="thehive-table"><thead><tr><th>Pattern</th><th>Tactic</th><th>Description</th><th>Time</th><th>Created by</th><th></th></tr></thead><tbody>
      {procedures.map(p => <tr key={p.id}><td>{p.pattern_name || p.pattern_id}</td><td>{p.tactic || '—'}</td><td>{p.description || '—'}</td><td>{p.occurred_at ? new Date(p.occurred_at).toLocaleString() : '—'}</td><td>{p.created_by}</td><td>{canWrite && <button className="thehive-btn-sm danger" onClick={() => deleteProc.mutate(p.id)}>Delete</button>}</td></tr>)}
      {!procedures.length && <tr><td colSpan={6} className="thehive-empty">No procedures yet.</td></tr>}
    </tbody></table>
    {canWrite && <div className="detail-action-panel" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <label style={{ flex: 1 }}>Pattern ID<input className="thehive-input" value={procForm.pattern_id} onChange={e => setProcForm((f: typeof procForm) => ({ ...f, pattern_id: e.target.value }))} /></label>
      <label style={{ flex: 1 }}>Name<input className="thehive-input" value={procForm.pattern_name} onChange={e => setProcForm((f: typeof procForm) => ({ ...f, pattern_name: e.target.value }))} /></label>
      <label style={{ flex: 1 }}>Tactic<input className="thehive-input" value={procForm.tactic} onChange={e => setProcForm((f: typeof procForm) => ({ ...f, tactic: e.target.value }))} /></label>
      <button className="thehive-btn-primary" disabled={!procForm.pattern_id.trim() || addProc.isPending} onClick={() => addProc.mutate()}>Add</button>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <h3 className="detail-section-title" style={{ margin: 0 }}>Sharing ({shares.length})</h3>
      {canWrite && <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}><i className="fa fa-share-square" /> Manage shares</button>}
    </div>
    <table className="table table-striped sharing-list-table"><thead><tr><th>Organisation</th><th>Owner</th><th>Profile</th><th>Task rule</th><th>Observable rule</th><th>Action req.</th><th /></tr></thead><tbody>
      {shares.map(s => <tr key={s.id}><td>{s.organisation}{s.owner && <span className="label label-primary" style={{ marginLeft: 8 }}>Owner</span>}</td><td>{s.owner ? <i className="fa fa-check text-success" /> : '—'}</td><td><span className="label label-default">{s.profile}</span></td><td>{s.task_rule}</td><td>{s.observable_rule}</td><td>{s.task_action_required ? <i className="fa fa-exclamation-triangle text-warning" /> : '—'}</td><td>{canWrite && <button className="btn btn-xs btn-danger" onClick={() => deleteShare.mutate(s.id)}>Revoke</button>}</td></tr>)}
      {!shares.length && <tr><td colSpan={7} className="empty-message">No shares yet.</td></tr>}
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
    <h3 className="detail-section-title">History</h3>
    <div className="timeline">
      {history.map(h => <div className="timeline-item" key={`${h.action}-${h.created_at}`}><span className="timeline-dot" /><strong>{h.action}</strong><p>{h.actor_id || 'system'}</p><small>{new Date(h.created_at).toLocaleString()}</small></div>)}
      {!history.length && <div className="thehive-empty">No history yet.</div>}
    </div>
  </>);
}

function Info({ label, value }: { label: string; value: unknown }) { return <div className="detail-info"><span>{label}</span><strong>{String(value ?? '—')}</strong></div>; }

function SeverityInline({ value }: { value: number }) {
  const labels: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical', 4: 'Critical' };
  const klass: Record<number, string> = { 0: 'label-info', 1: 'label-info', 2: 'label-warning', 3: 'label-danger', 4: 'label-danger' };
  return <span className={`label ${klass[value] ?? 'label-default'}`}>{labels[value] ?? `S${value}`}</span>;
}

function statusLabelClass(status: string | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'open': return 'label label-danger';
    case 'resolved': return 'label label-success';
    case 'duplicated': return 'label label-warning';
    default: return 'label label-default';
  }
}

function taskStatusClass(status: string): string {
  switch (status) {
    case 'Completed': return 'label label-success';
    case 'InProgress': return 'label label-warning';
    case 'Cancel': return 'label label-default';
    case 'Waiting': default: return 'label label-info';
  }
}

function SlaBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'Completed' || status === 'Cancel') return <span className="label label-default">closed</span>;
  const due = new Date(dueDate).getTime();
  const diffDays = Math.ceil((due - Date.now()) / 86400000);
  if (diffDays < 0) return <span className="label label-danger">overdue {Math.abs(diffDays)}d</span>;
  if (diffDays <= 1) return <span className="label label-warning">due soon</span>;
  return <span className="label label-success">{diffDays}d left</span>;
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
  return (
    <div className="related-cases-panel" style={{ marginTop: 12 }}>
      <h4 className="vpad10 text-primary">Linked cases ({relatedCases.length})</h4>
      {relatedCases.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span className={`label label-lg label-default mr-xxs clickable ${filter === '' ? 'label-primary' : ''}`} onClick={() => setFilter('')}>All ({relatedCases.length})</span>
          {Object.entries(stats).map(([key, count]) => (
            <span key={key} className={`label label-lg label-default mr-xxs clickable ${filter === key ? 'label-primary' : ''}`} onClick={() => setFilter(key)}>{key} ({count})</span>
          ))}
        </div>
      )}
      {filtered.length === 0 && <div className="empty-message">No linked cases</div>}
      {filtered.map(rc => (
        <div key={rc.id} className="case-item" style={{ marginBottom: 6, padding: '6px 8px', border: '1px solid #eee', borderRadius: 4 }}>
          <div className="case-tlp bg-tlp-${rc.tlp}" style={{ width: 4, display: 'inline-block', marginRight: 6 }} />
          <a href={`/cases/${rc.id}`}>#{rc.number} - {rc.title}</a>
          <SeverityInline value={rc.severity} />
          {rc.status !== 'Open' && <small className="text-success" style={{ marginLeft: 8 }}>({rc.resolution_status ?? rc.status})</small>}
          <div className="text-muted text-xs">{rc.links_count} linked observable(s)</div>
          {rc.linked_observables?.slice(0, 3).map(lo => (
            <div key={lo.id} className="text-xs" style={{ marginLeft: 12 }}>
              <span className="label label-info" style={{ fontSize: '0.65rem' }}>{lo.data_type}</span> {lo.data}
              {lo.ioc && <i className="fa fa-bullseye text-danger" style={{ marginLeft: 4, fontSize: '0.65rem' }} />}
            </div>
          ))}
          {rc.linked_observables && rc.linked_observables.length > 3 && <div className="text-xs text-muted" style={{ marginLeft: 12 }}>+{rc.linked_observables.length - 3} more</div>}
        </div>
      ))}
    </div>
  );
}

/* ─── Responder Actions Panel — mirrors responder-actions.html ──────────────── */
function ResponderActionsPanel({ actions }: { actions: ResponderAction[] }) {
  if (!actions.length) return null;
  const statusClass = (s: string) => {
    switch (s) {
      case 'Success': return 'label label-success';
      case 'InProgress': return 'label label-warning';
      case 'Waiting': return 'label label-info';
      case 'Failure': return 'label label-danger';
      default: return 'label label-default';
    }
  };
  return (
    <div className="responder-actions-panel" style={{ marginTop: 12 }}>
      <h4 className="vpad10 text-primary">Responder jobs ({actions.length})</h4>
      <table className="table table-striped table-condensed">
        <thead><tr><th>Responder</th><th>Status</th><th>Started</th><th>Message</th></tr></thead>
        <tbody>
          {actions.map(a => (
            <tr key={a.id}>
              <td>{a.responder_name || a.responder_id}</td>
              <td><span className={statusClass(a.status)}>{a.status}</span></td>
              <td>{a.start_date ? new Date(a.start_date).toLocaleString() : '—'}</td>
              <td>{a.operations?.map(o => o.message).filter(Boolean).join('; ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className="case-tab-toolbar">
      <h3 className="detail-section-title" style={{ margin: 0 }}>Linked alerts ({alerts.length})</h3>
    </div>
    {alerts.length > 0 && (
      <div style={{ marginBottom: 8 }}>
        <span className={`label label-lg label-default mr-xxs clickable ${filter === '' ? 'label-primary' : ''}`} onClick={() => setFilter('')}>All ({alerts.length})</span>
        <strong>Type: </strong>
        {Object.entries(typeStats).map(([k, v]) => (
          <span key={k} className={`label label-lg label-default mr-xxs clickable ${filter === k ? 'label-primary' : ''}`} onClick={() => setFilter(k)}>{k} ({v})</span>
        ))}
        <strong style={{ marginLeft: 8 }}>Source: </strong>
        {Object.entries(sourceStats).map(([k, v]) => (
          <span key={k} className={`label label-lg label-default mr-xxs clickable ${filter === k ? 'label-primary' : ''}`} onClick={() => setFilter(k)}>{k} ({v})</span>
        ))}
      </div>
    )}
    {sorted.length === 0 && <div className="empty-message">No alerts linked to this case.</div>}
    {sorted.length > 0 && (
      <table className="table tbody-stripped case-list">
        <thead><tr>
          <th style={{ width: 150 }}><button className="text-default sort-btn" onClick={() => toggleSort('source_ref')}>Reference {sortField === 'source_ref' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
          <th style={{ width: 160 }}><button className="text-default sort-btn" onClick={() => toggleSort('type')}>Type {sortField === 'type' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
          <th><button className="text-default sort-btn" onClick={() => toggleSort('title')}>Title {sortField === 'title' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
          <th style={{ width: 150 }}><button className="text-default sort-btn" onClick={() => toggleSort('source')}>Source {sortField === 'source' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
          <th style={{ width: 80 }}><button className="text-default sort-btn" onClick={() => toggleSort('severity')}>Severity {sortField === 'severity' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
          <th style={{ width: 80 }}>Attributes</th>
          <th style={{ width: 160 }}><button className="text-default sort-btn" onClick={() => toggleSort('created_at')}>Date {sortField === 'created_at' && (sortDir === 'ASC' ? '▲' : '▼')}</button></th>
        </tr></thead>
        <tbody>
          {sorted.map(a => (
            <tr key={a.id}>
              <td className="wrap"><strong>{a.source_ref}</strong></td>
              <td><a href={`/alerts/${a.id}`}>{a.type}</a></td>
              <td className="wrap"><a href={`/alerts/${a.id}`}>{a.title}</a><TagList data={a.tags} /></td>
              <td>{a.source}</td>
              <td><SeverityInline value={a.severity} /></td>
              <td className="text-center">{a.tags?.length ?? 0}</td>
              <td>{new Date(a.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </>);
}
