'use client';

/**
 * Alert detail / triage page.
 * Mirrors legacy frontend/app/views/partials/observables/list/observables.html,
 * alert detail partials, and alert triage flow from TheHive 4.
 * Tabs: Overview | Observables | Similar | Audit
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, Bell, Download, Eye, EyeOff, FileText, Flag, GitMerge, Link2, Mail, MailOpen, Search, ShieldAlert, Tag, Trash2 } from '@/components/FaIcon';
import { ObservableFlags, Pap, Severity, TagList, Tlp } from '@/components/Badges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';
import { canUse } from '@/lib/permissions';

type User = { login: string; name: string; permissions?: string[] };
type AlertObservable = {
  id: string; data_type: string; data: string; message: string;
  tlp: number; ioc: boolean; sighted: boolean; attachment_id?: string;
  tags: string[]; created_by: string; created_at: string;
};
type SimilarAlert = {
  id: string; title: string; source: string; source_ref: string;
  score?: number; reason?: string; severity?: number; status?: string;
  observable_overlap?: number; ioc_overlap?: number; tag_overlap?: number; created_at?: string;
};
type History = { action: string; actor_id: string; created_at: string };
type AlertCustomField = { id?: string; name: string; value: string; field_type?: string };
type AlertItem = {
  id: string; title: string; description?: string; type: string;
  source: string; source_ref: string; external_link?: string;
  severity: number; tlp: number; pap?: number; status: string;
  read: boolean; follow?: boolean; flag?: boolean;
  organisation_id?: string; case_template?: string;
  case_id?: string; case_number?: number; case_title?: string;
  tags: string[]; occurred_at?: string; last_sync_date?: string;
  created_at: string; updated_at?: string;
  observables?: AlertObservable[];
  similar_alerts?: SimilarAlert[];
  history?: History[];
  custom_fields?: AlertCustomField[];
};
type AlertObservableCopy = {
  source_observable_id: string; observable_id: string; action: string;
  data_type: string; data: string; attachment_id?: string;
};
type AlertMergeReport = {
  policy: string; copied_count: number; deduplicated_count: number;
  conflicting_observable_ids: string[]; similar_alerts: SimilarAlert[]; notes: string[];
};
type AlertActionResult = {
  alert?: AlertItem; source_alert?: AlertItem;
  case?: { id: string; number: number; title: string };
  target_case?: string; status?: string;
  observables?: AlertObservableCopy[];
  report?: AlertMergeReport;
};

const TABS = ['Overview', 'Observables', 'Similar', 'Audit'] as const;
type TabName = typeof TABS[number];

function formatScore(score: number | undefined): string {
  return typeof score === 'number' ? `${Math.round(score * 100)}%` : '0%';
}

function alertStatusClass(status: string | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'new': return 'label label-danger';
    case 'updated': return 'label label-warning';
    case 'imported': return 'label label-success';
    case 'merged': return 'label label-success';
    case 'ignored': return 'label label-default';
    default: return 'label label-info';
  }
}

export default function AlertDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [caseId, setCaseId] = useState('');
  const [targetAlertId, setTargetAlertId] = useState('');
  const [lastResult, setLastResult] = useState<AlertActionResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', description: '', severity: 2, tlp: 2, pap: 2,
    case_template: '', external_link: '', tags: '',
  });

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<User>('/api/v1/auth/me'),
    enabled: !!authedLogin,
  });
  const alertDetail = useQuery({
    queryKey: ['alert-detail', params.id],
    queryFn: () => apiFetch<AlertItem>(`/api/v1/alerts/${params.id}`),
    enabled: !!authedLogin && !!params.id,
  });
  const item = alertDetail.data;
  const canWrite = canUse(me.data, 'alertUpdate') || canUse(me.data, 'alertImport');
  const refetch = () => void alertDetail.refetch();

  useEffect(() => {
    if (item) setEditForm({
      title: item.title,
      description: item.description || '',
      severity: item.severity,
      tlp: item.tlp,
      pap: item.pap ?? 2,
      case_template: item.case_template || '',
      external_link: item.external_link || '',
      tags: item.tags?.join(', ') || '',
    });
  }, [item]);

  const importMutation = useMutation({
    mutationFn: () => apiFetch<AlertActionResult>(`/api/v1/alerts/${params.id}/import`, { method: 'POST' }),
    onSuccess: (data) => { setLastResult(data); refetch(); },
  });
  const mergeMutation = useMutation({
    mutationFn: () => apiFetch<AlertActionResult>(`/api/v1/alerts/${params.id}/merge`, {
      method: 'POST',
      json: { case_id: caseId.trim(), target_alert_id: targetAlertId.trim() },
    }),
    onSuccess: (data) => { setLastResult(data); refetch(); },
  });
  const toggleFollow = useMutation({
    mutationFn: () => apiFetch(`/api/v1/alerts/${params.id}/follow`, { method: 'POST' }),
    onSuccess: refetch,
  });
  const toggleRead = useMutation({
    mutationFn: () => apiFetch(`/api/v1/alerts/${params.id}/read`, { method: 'POST' }),
    onSuccess: refetch,
  });
  const toggleFlag = useMutation({
    mutationFn: () => apiFetch(`/api/v1/alerts/${params.id}`, { method: 'PATCH', json: { flag: !item?.flag } }),
    onSuccess: refetch,
  });
  const deleteAlert = useMutation({
    mutationFn: () => apiFetch(`/api/v1/alerts/${params.id}`, { method: 'DELETE' }),
    onSuccess: () => router.replace('/investigation?tab=alerts'),
  });
  const updateAlert = useMutation({
    mutationFn: () => apiFetch(`/api/v1/alerts/${params.id}`, {
      method: 'PATCH',
      json: {
        title: editForm.title,
        description: editForm.description,
        severity: editForm.severity,
        tlp: editForm.tlp,
        pap: editForm.pap,
        case_template: editForm.case_template,
        external_link: editForm.external_link,
        tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      },
    }),
    onSuccess: () => { setEditing(false); refetch(); },
  });

  const actionError = [importMutation, mergeMutation, deleteAlert, updateAlert]
    .map(m => (m.error as Error | undefined)?.message)
    .find(Boolean);

  const report = lastResult?.report;
  const observables = useMemo(() => lastResult?.observables ?? [], [lastResult]);

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ?? { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Alert <small>{item?.source ?? 'source'} / {item?.source_ref ?? 'ref'}</small></h1>
            <ol className="breadcrumb">
              <li>Home</li>
              <li>Alerts</li>
              <li className="active">{item?.title ?? '…'}</li>
            </ol>
          </section>

          <section className="content case-page next-case-page alert-triage-page">
            {/* Alert preview banner */}
            <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex flex-wrap gap-4 justify-between items-center">
                <h3 className="text-blue-500 font-medium text-lg flex items-center">
                  <ShieldAlert size={16} className="mr-2" />
                  Alert Preview: {item?.title ?? 'Alert detail'}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  {item?.follow && <span className="px-2 py-0.5 rounded text-[10px] bg-blue-900 text-blue-300 font-bold uppercase tracking-wider" title="Following">Follow</span>}
                  {item?.flag && <span className="px-2 py-0.5 rounded text-[10px] bg-orange-900 text-orange-300 font-bold uppercase tracking-wider" title="Flagged">Flagged</span>}
                  {item?.read === false && <span className="px-2 py-0.5 rounded text-[10px] bg-red-900 text-red-300 font-bold uppercase tracking-wider">Unread</span>}
                  <span className={alertStatusClass(item?.status)}>{item?.status ?? 'Loading'}</span>
                </div>
              </div>
              <div className="px-6 py-4 flex flex-wrap gap-6 text-sm">
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">Severity</span> <Severity value={item?.severity ?? 2} /></div>
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">TLP</span> <Tlp value={item?.tlp ?? 2} /></div>
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">PAP</span> <Pap value={item?.pap ?? 2} /></div>
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">Type</span> <span className="font-medium text-slate-200">{item?.type || '—'}</span></div>
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">Source</span> <span className="font-medium text-slate-200">{item?.source || '—'}</span></div>
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">Reference</span> <span className="font-medium text-slate-200">{item?.source_ref || '—'}</span></div>
                <div className="flex flex-col"><span className="text-slate-400 text-xs mb-1">Created</span> <span className="font-medium text-slate-200">{item?.created_at ? new Date(item.created_at).toLocaleString() : '—'}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
              {/* Main tabset */}
              <section className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden flex flex-col">
                <ul className="flex bg-slate-900 border-b border-slate-700">
                  {TABS.map(tab => (
                    <li key={tab} className="flex-1">
                      <button 
                        type="button" 
                        onClick={() => setActiveTab(tab)}
                        className={`w-full py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === tab ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                      >
                        <span>{tab}</span>
                        {tab === 'Observables' && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">{item?.observables?.length ?? 0}</span>}
                        {tab === 'Similar' && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">{item?.similar_alerts?.length ?? 0}</span>}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="p-6 overflow-hidden">
                  {actionError && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-md mb-6">{actionError}</div>}

                  {/* ── Overview tab ── */}
                  {activeTab === 'Overview' && item && (
                    <>
                      <div className="mb-8">
                        <h4 className="text-xl font-semibold text-slate-200 flex items-center gap-3 mb-4">
                          <Severity value={item.severity} /> <span>{item.title}</span>
                        </h4>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-400 bg-slate-900/50 p-4 rounded-md border border-slate-700 mb-6">
                          <span className="flex items-center gap-1.5"><FileText size={14} className="text-slate-500" /> <strong className="text-slate-300">ID:</strong> <code className="bg-slate-950 px-1.5 py-0.5 rounded">{item.id}</code></span>
                          <span className="flex items-center gap-1.5"><Bell size={14} className="text-slate-500" /> <strong className="text-slate-300">Date:</strong> {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : new Date(item.created_at).toLocaleString()}</span>
                          <span className="flex items-center gap-1.5"><Tag size={14} className="text-slate-500" /> <strong className="text-slate-300">Type:</strong> {item.type}</span>
                          <span className="flex items-center gap-1.5"><BarChart3 size={14} className="text-slate-500" /> <strong className="text-slate-300">Reference:</strong> {item.source_ref}</span>
                          <span className="flex items-center gap-1.5"><Search size={14} className="text-slate-500" /> <strong className="text-slate-300">Source:</strong> {item.source}</span>
                        </div>

                        <div className="grid grid-cols-[120px_1fr] gap-y-4 gap-x-4 text-sm">
                          <div className="text-slate-400 font-medium pt-1">Tags</div>
                          <div>
                            <TagList data={item.tags} />
                          </div>
                          <div className="text-slate-400 font-medium pt-1">Description</div>
                          <div className="bg-slate-900/50 p-4 rounded-md border border-slate-700 prose prose-invert max-w-none text-slate-300">
                            {item.description || <em className="text-slate-500">Not specified</em>}
                          </div>
                          <div className="text-slate-400 font-medium pt-1">Case template</div>
                          <div className="text-slate-300 pt-1">{item.case_template || <em className="text-slate-500">Empty case</em>}</div>
                          <div className="text-slate-400 font-medium pt-1">Linked case</div>
                          <div className="pt-1">
                            {item.case_number
                              ? <a href={`/cases/${item.case_id}`} className="text-blue-400 hover:text-blue-300">#{String(item.case_number).padStart(7, '0')} {item.case_title}</a>
                              : <em className="text-slate-500">Not imported</em>}
                          </div>
                          {item.external_link && (
                            <>
                              <div className="text-slate-400 font-medium pt-1">External link</div>
                              <div className="pt-1"><a href={item.external_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{item.external_link}</a></div>
                            </>
                          )}
                        </div>

                        {/* Custom fields */}
                        {item.custom_fields && item.custom_fields.length > 0 && (
                          <div className="mt-8">
                            <h4 className="text-blue-400 font-medium mb-4 pb-2 border-b border-slate-700">Custom fields</h4>
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead><tr className="text-slate-400 border-b border-slate-700"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Value</th><th className="pb-2 font-medium">Type</th></tr></thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {item.custom_fields.map((cf, i) => (
                                  <tr key={cf.id || i} className="hover:bg-slate-800/30">
                                    <td className="py-2 text-slate-300">{cf.name}</td>
                                    <td className="py-2 text-slate-300">{cf.value || <em className="text-slate-500">—</em>}</td>
                                    <td className="py-2">{cf.field_type && <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] uppercase">{cf.field_type}</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Edit form */}
                      {editing ? (
                        <div className="bg-slate-900 border border-slate-700 rounded-md p-6 mb-8">
                          <h3 className="text-blue-500 font-medium mb-4">Edit alert</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1 md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Title</label>
                              <input className="thehive-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
                              <textarea className="thehive-input" rows={4} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Severity</label>
                              <Severity value={editForm.severity} active onUpdate={v => setEditForm(f => ({ ...f, severity: v }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">TLP</label>
                              <Tlp value={editForm.tlp} format="active" onUpdate={v => setEditForm(f => ({ ...f, tlp: v }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">PAP</label>
                              <Pap value={editForm.pap} format="active" onUpdate={v => setEditForm(f => ({ ...f, pap: v }))} />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Case template</label>
                              <input className="thehive-input" value={editForm.case_template} onChange={e => setEditForm(f => ({ ...f, case_template: e.target.value }))} />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Tags <span className="text-slate-500 lowercase normal-case">(comma-separated)</span></label>
                              <input className="thehive-input" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-6">
                            <button className="thehive-btn-primary" disabled={updateAlert.isPending} onClick={() => updateAlert.mutate()}>
                              {updateAlert.isPending ? 'Saving…' : 'Save changes'}
                            </button>
                            <button className="thehive-btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                          </div>
                        </div>
                      ) : null}

                      {/* Import / merge section */}
                      <div className="mt-8 pt-6 border-t border-slate-700">
                        <h3 className="text-blue-400 font-medium mb-4">Import / merge</h3>
                        <div className="flex flex-wrap gap-4 items-center bg-slate-900/50 p-4 rounded-md border border-slate-700">
                          <button
                            className="thehive-btn-primary flex items-center gap-2"
                            disabled={!canWrite || importMutation.isPending || !!item.case_id}
                            onClick={() => importMutation.mutate()}
                          >
                            <Download size={14} /> {importMutation.isPending ? 'Importing…' : 'Import as new case'}
                          </button>
                          <div className="w-px h-8 bg-slate-700 mx-2 hidden sm:block"></div>
                          <div className="flex flex-wrap items-center gap-2 flex-1">
                            <input
                              className="thehive-input max-w-[200px]"
                              placeholder="Target case UUID"
                              value={caseId}
                              onChange={e => setCaseId(e.target.value)}
                            />
                            <input
                              className="thehive-input max-w-[200px]"
                              placeholder="Target alert UUID (optional)"
                              value={targetAlertId}
                              onChange={e => setTargetAlertId(e.target.value)}
                            />
                            <button
                              className="thehive-btn-secondary flex items-center gap-2"
                              disabled={!canWrite || mergeMutation.isPending || (!caseId.trim() && !targetAlertId.trim())}
                              onClick={() => mergeMutation.mutate()}
                            >
                              <GitMerge size={14} /> Merge into case
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Merge/import result */}
                      {lastResult && (
                        <div className="mt-8 pt-6 border-t border-slate-700">
                          <h3 className="text-blue-400 font-medium mb-4">Import / merge result</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-900/50 p-4 rounded border border-slate-700"><div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Policy</div><div className="font-medium text-slate-200">{report?.policy ?? 'n/a'}</div></div>
                            <div className="bg-slate-900/50 p-4 rounded border border-slate-700"><div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Copied</div><div className="font-medium text-slate-200">{report?.copied_count ?? 0}</div></div>
                            <div className="bg-slate-900/50 p-4 rounded border border-slate-700"><div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Deduplicated</div><div className="font-medium text-slate-200">{report?.deduplicated_count ?? 0}</div></div>
                            <div className="bg-slate-900/50 p-4 rounded border border-slate-700"><div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Target case</div><div className="font-medium text-slate-200">{lastResult.case ? `#${lastResult.case.number} ${lastResult.case.title}` : lastResult.target_case ?? 'n/a'}</div></div>
                          </div>
                          {observables.length > 0 && (
                            <table className="w-full text-left text-sm whitespace-nowrap mb-6">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-700"><th className="pb-2 font-medium">Action</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Data</th><th className="pb-2 font-medium">Attachment</th><th className="pb-2 font-medium">Observable ID</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {observables.map(o => (
                                  <tr key={`${o.source_observable_id}-${o.observable_id}`} className="hover:bg-slate-800/30">
                                    <td className="py-2"><span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${o.action === 'copied' ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-300'}`}>{o.action}</span></td>
                                    <td className="py-2 text-slate-300">{o.data_type}</td>
                                    <td className="py-2 font-mono text-slate-400">{o.data}</td>
                                    <td className="py-2">{o.attachment_id ? <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">📎 {o.attachment_id.split('-')[0]}</span> : <span className="text-slate-500">—</span>}</td>
                                    <td className="py-2 font-mono text-slate-500 text-xs">{o.observable_id}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {report?.similar_alerts?.length ? (
                            <>
                              <h4 className="text-slate-300 font-medium mb-3">Similar scoring details</h4>
                              <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead><tr className="text-slate-400 border-b border-slate-700"><th className="pb-2 font-medium">Alert</th><th className="pb-2 font-medium">Score</th><th className="pb-2 font-medium">Overlap</th><th className="pb-2 font-medium">Reason</th></tr></thead>
                                <tbody className="divide-y divide-slate-800">
                                  {report.similar_alerts.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-800/30">
                                      <td className="py-2"><a href={`/alerts/${s.id}`} className="text-blue-400 hover:text-blue-300">{s.title}</a></td>
                                      <td className="py-2 text-slate-300">{formatScore(s.score)}</td>
                                      <td className="py-2 text-slate-400">obs {s.observable_overlap ?? 0} · IOC {s.ioc_overlap ?? 0} · tags {s.tag_overlap ?? 0}</td>
                                      <td className="py-2 text-slate-500">{s.reason || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          ) : null}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Observables tab ── */}
                  {activeTab === 'Observables' && (
                    <>
                      <h3 className="text-xl font-semibold text-slate-200 mb-4">Alert observables</h3>
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-700 bg-slate-900/50">
                            <th className="px-4 py-3 font-medium">TLP</th>
                            <th className="px-4 py-3 font-medium">Flags</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Data</th>
                            <th className="px-4 py-3 font-medium">Tags</th>
                            <th className="px-4 py-3 font-medium">Created by</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {(item?.observables ?? []).map(o => (
                            <tr key={o.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3"><Tlp value={o.tlp} format="icon" /></td>
                              <td className="px-4 py-3"><ObservableFlags observable={{ ioc: o.ioc, sighted: o.sighted }} /></td>
                              <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-900 text-blue-300 rounded text-[10px] tracking-wider uppercase">{o.data_type}</span></td>
                              <td className="px-4 py-3 font-mono text-slate-300 whitespace-normal break-all">
                                {o.data}
                                {o.attachment_id && (
                                  <div className="mt-1"><span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">📎 {o.attachment_id.split('-')[0]}</span></div>
                                )}
                              </td>
                              <td className="px-4 py-3"><TagList data={o.tags} /></td>
                              <td className="px-4 py-3 text-slate-400">{o.created_by}</td>
                            </tr>
                          ))}
                          {!item?.observables?.length && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No observables.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── Similar tab ── */}
                  {activeTab === 'Similar' && (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-slate-200">Similar cases</h3>
                        <span className="px-3 py-1 bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded-full text-xs font-bold uppercase tracking-wider">All ({item?.similar_alerts?.length ?? 0})</span>
                      </div>
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-700 bg-slate-900/50">
                            <th className="px-4 py-3 font-medium">Title</th><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 font-medium">Observables</th><th className="px-4 py-3 font-medium">IOCs</th><th className="px-4 py-3 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {(item?.similar_alerts ?? []).map(s => (
                            <tr key={s.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 whitespace-normal">
                                <a href={`/alerts/${s.id}`} className="text-blue-400 hover:text-blue-300 font-medium">{s.title}</a>
                                <div className="text-slate-500 text-xs mt-1">{s.reason ?? s.status ?? '—'}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-300">{s.source}/{s.source_ref}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-200">{formatScore(s.score)}</strong>
                                  <div className="w-16 h-1.5 bg-slate-700 rounded overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: formatScore(s.score) }} />
                                  </div>
                                </div>
                                <div className="text-slate-500 text-xs mt-1">{s.observable_overlap ?? 0} observables</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <strong className="text-slate-200">{s.ioc_overlap ?? 0}</strong>
                                  <div className="w-16 h-1.5 bg-slate-700 rounded overflow-hidden">
                                    <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (s.ioc_overlap ?? 0) * 20)}%` }} />
                                  </div>
                                </div>
                                <div className="text-slate-500 text-xs mt-1">{s.tag_overlap ?? 0} tag overlap</div>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  className="thehive-btn-primary py-1 px-3 text-xs"
                                  disabled={!canWrite}
                                  onClick={() => { setTargetAlertId(s.id); setActiveTab('Overview'); }}
                                >
                                  Merge in this case
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!item?.similar_alerts?.length && (
                            <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No similar alerts found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── Audit tab ── */}
                  {activeTab === 'Audit' && (
                    <>
                      <h3 className="text-xl font-semibold text-slate-200 mb-6">History</h3>
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                        {(item?.history ?? []).map((h, i) => (
                          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active" key={`${h.action}-${i}`}>
                            <div className="flex items-center justify-center w-5 h-5 rounded-full border border-slate-700 bg-slate-900 text-slate-500 group-[.is-active]:text-blue-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            </div>
                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-slate-900/50 p-4 rounded border border-slate-700 shadow">
                              <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-bold text-slate-200">{h.action}</div>
                                <time className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</time>
                              </div>
                              <div className="text-slate-400 text-sm">{h.actor_id || 'system'}</div>
                            </div>
                          </div>
                        ))}
                        {!item?.history?.length && (
                          <div className="text-center py-10 text-slate-500 relative z-10">No history yet.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Side action box */}
              <aside className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden sticky top-6">
                <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
                  <h3 className="text-slate-200 font-medium text-sm uppercase tracking-wider">Actions</h3>
                </div>
                <div className="p-4 space-y-2">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canWrite}
                    onClick={() => toggleFollow.mutate()}
                  >
                    {item?.follow ? <EyeOff size={14} className="text-blue-400" /> : <Eye size={14} />}
                    <span className="flex-1 text-left">{item?.follow ? 'Ignore new updates' : 'Track new updates'}</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canWrite}
                    onClick={() => toggleRead.mutate()}
                  >
                    {item?.read ? <MailOpen size={14} className="text-blue-400" /> : <Mail size={14} />}
                    <span className="flex-1 text-left">{item?.read ? 'Mark as unread' : 'Mark as read'}</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canWrite}
                    onClick={() => toggleFlag.mutate()}
                  >
                    <Flag size={14} className={item?.flag ? 'text-red-500' : ''} /> 
                    <span className="flex-1 text-left">{item?.flag ? 'Unflag' : 'Flag'}</span>
                  </button>
                  
                  <hr className="border-slate-700 my-4" />
                  
                  {!editing ? (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canWrite}
                      onClick={() => setEditing(true)}
                    >
                      <FileText size={14} /> <span className="flex-1 text-left">Edit alert</span>
                    </button>
                  ) : (
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded transition-colors" onClick={() => setEditing(false)}>
                      Cancel edit
                    </button>
                  )}
                  
                  <hr className="border-slate-700 my-4" />
                  
                  {item?.case_id && (
                    <a href={`/cases/${item.case_id}`} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded transition-colors">
                      <Link2 size={14} /> <span className="flex-1 text-left">View case #{String(item.case_number).padStart(7, '0')}</span>
                    </a>
                  )}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canWrite || deleteAlert.isPending}
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 size={14} /> <span className="flex-1 text-left">Delete</span>
                  </button>
                </div>
              </aside>
            </div>
          </section>
        </main>
      </div>
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete alert"
        message={`Are you sure you want to permanently delete alert "${item?.title ?? ''}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete alert"
        cancelLabel="Keep alert"
        pending={deleteAlert.isPending}
        onConfirm={() => { deleteAlert.mutate(); setShowDeleteDialog(false); }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
