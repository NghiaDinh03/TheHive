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
    const login = sessionStorage.getItem('thehive.login');
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
            <div className="alert-preview-banner box box-primary">
              <div className="box-header with-border case-panelinfo-header">
                <h3 className="box-title text-primary">
                  <ShieldAlert size={16} className="mr-1" />
                  Alert Preview: {item?.title ?? 'Alert detail'}
                </h3>
                <div className="box-tools pull-right case-detail-status">
                  {item?.follow && <span className="label label-info mr-1" title="Following">Follow</span>}
                  {item?.flag && <span className="label label-warning mr-1" title="Flagged">Flagged</span>}
                  {item?.read === false && <span className="label label-danger mr-1">Unread</span>}
                  <span className={alertStatusClass(item?.status)}>{item?.status ?? 'Loading'}</span>
                </div>
              </div>
              <div className="box-body case-panelinfo-body">
                <span><strong>Severity</strong> <Severity value={item?.severity ?? 2} /></span>
                <span><strong>TLP</strong> <Tlp value={item?.tlp ?? 2} /></span>
                <span><strong>PAP</strong> <Pap value={item?.pap ?? 2} /></span>
                <span><strong>Type</strong> {item?.type || '—'}</span>
                <span><strong>Source</strong> {item?.source || '—'}</span>
                <span><strong>Reference</strong> {item?.source_ref || '—'}</span>
                <span><strong>Created</strong> {item?.created_at ? new Date(item.created_at).toLocaleString() : '—'}</span>
              </div>
            </div>

            <div className="case-detail-layout">
              {/* Main tabset */}
              <section className="nav-tabs-custom case-main-tabset">
                <ul className="nav nav-tabs detail-tab-strip">
                  {TABS.map(tab => (
                    <li key={tab} className={activeTab === tab ? 'active' : ''}>
                      <button type="button" onClick={() => setActiveTab(tab)}>
                        <span>{tab}</span>
                        {tab === 'Observables' && <span className="badge">{item?.observables?.length ?? 0}</span>}
                        {tab === 'Similar' && <span className="badge">{item?.similar_alerts?.length ?? 0}</span>}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="tab-content case-page-content">
                  {actionError && <div className="admin-alert error">{actionError}</div>}

                  {/* ── Overview tab ── */}
                  {activeTab === 'Overview' && item && (
                    <>
                      <div className="alert-legacy-summary">
                        <h4 className="text-primary">
                          <Severity value={item.severity} /> <span>{item.title}</span>
                        </h4>
                        <div className="alert-meta-line">
                          <span><FileText size={13} /> <strong>ID:</strong> <code>{item.id}</code></span>
                          <span><Bell size={13} /> <strong>Date:</strong> {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : new Date(item.created_at).toLocaleString()}</span>
                          <span><Tag size={13} /> <strong>Type:</strong> {item.type}</span>
                          <span><BarChart3 size={13} /> <strong>Reference:</strong> {item.source_ref}</span>
                          <span><Search size={13} /> <strong>Source:</strong> {item.source}</span>
                        </div>

                        <dl className="dl-horizontal alert-basic-info">
                          <dt>Tags</dt>
                          <dd>
                            <TagList data={item.tags} />
                          </dd>
                          <dt>Description</dt>
                          <dd>
                            <div className="description-pane detail-markdown">
                              {item.description || <em className="text-warning">Not specified</em>}
                            </div>
                          </dd>
                          <dt>Case template</dt>
                          <dd>{item.case_template || <em className="text-muted">Empty case</em>}</dd>
                          <dt>Linked case</dt>
                          <dd>
                            {item.case_number
                              ? <a href={`/cases/${item.case_id}`}>#{item.case_number} {item.case_title}</a>
                              : <em className="text-muted">Not imported</em>}
                          </dd>
                          {item.external_link && (
                            <>
                              <dt>External link</dt>
                              <dd><a href={item.external_link} target="_blank" rel="noopener noreferrer">{item.external_link}</a></dd>
                            </>
                          )}
                        </dl>

                        {/* Custom fields — mirrors legacy alert/custom.fields.html */}
                        {item.custom_fields && item.custom_fields.length > 0 && (
                          <>
                            <h4 className="text-primary" style={{ marginTop: 12 }}>Custom fields</h4>
                            <table className="table table-striped table-condensed">
                              <thead><tr><th>Name</th><th>Value</th><th>Type</th></tr></thead>
                              <tbody>
                                {item.custom_fields.map((cf, i) => (
                                  <tr key={cf.id || i}>
                                    <td>{cf.name}</td>
                                    <td>{cf.value || <em className="text-muted">—</em>}</td>
                                    <td>{cf.field_type && <span className="label label-info">{cf.field_type}</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>

                      {/* Edit form (inline, TheHive 4 style) */}
                      {editing ? (
                        <div className="box box-default alert-edit-box">
                          <div className="box-header with-border">
                            <h3 className="box-title">Edit alert</h3>
                          </div>
                          <div className="box-body">
                            <div className="form-group">
                              <label>Title</label>
                              <input className="form-control" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label>Description</label>
                              <textarea className="form-control" rows={4} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label>Severity</label>
                              <Severity value={editForm.severity} active onUpdate={v => setEditForm(f => ({ ...f, severity: v }))} />
                            </div>
                            <div className="form-group">
                              <label>TLP</label>
                              <Tlp value={editForm.tlp} format="active" onUpdate={v => setEditForm(f => ({ ...f, tlp: v }))} />
                            </div>
                            <div className="form-group">
                              <label>PAP</label>
                              <Pap value={editForm.pap} format="active" onUpdate={v => setEditForm(f => ({ ...f, pap: v }))} />
                            </div>
                            <div className="form-group">
                              <label>Case template</label>
                              <input className="form-control" value={editForm.case_template} onChange={e => setEditForm(f => ({ ...f, case_template: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label>Tags <small className="text-muted">(comma-separated)</small></label>
                              <input className="form-control" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2" />
                            </div>
                            <div className="btn-toolbar">
                              <button className="btn btn-primary" disabled={updateAlert.isPending} onClick={() => updateAlert.mutate()}>
                                {updateAlert.isPending ? 'Saving…' : 'Save'}
                              </button>
                              <button className="btn btn-default ml-1" onClick={() => setEditing(false)}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Import / merge section */}
                      <h3 className="detail-section-title">Import / merge</h3>
                      <div className="alert-import-strip">
                        <button
                          className="btn btn-primary"
                          disabled={!canWrite || importMutation.isPending || !!item.case_id}
                          onClick={() => importMutation.mutate()}
                        >
                          <Download size={14} /> {importMutation.isPending ? 'Importing…' : 'Import as new case'}
                        </button>
                        <div className="alert-merge-inline">
                          <input
                            className="form-control input-sm"
                            placeholder="Target case UUID"
                            value={caseId}
                            onChange={e => setCaseId(e.target.value)}
                          />
                          <input
                            className="form-control input-sm"
                            placeholder="Target alert UUID (optional)"
                            value={targetAlertId}
                            onChange={e => setTargetAlertId(e.target.value)}
                          />
                          <button
                            className="btn btn-sm btn-default"
                            disabled={!canWrite || mergeMutation.isPending || (!caseId.trim() && !targetAlertId.trim())}
                            onClick={() => mergeMutation.mutate()}
                          >
                            <GitMerge size={14} /> Merge into case
                          </button>
                        </div>
                      </div>

                      {/* Merge/import result */}
                      {lastResult && (
                        <>
                          <h3 className="detail-section-title">Import / merge result</h3>
                          <div className="merge-report">
                            <div className="detail-info"><span>Policy</span><strong>{report?.policy ?? 'n/a'}</strong></div>
                            <div className="detail-info"><span>Copied</span><strong>{report?.copied_count ?? 0}</strong></div>
                            <div className="detail-info"><span>Deduplicated</span><strong>{report?.deduplicated_count ?? 0}</strong></div>
                            <div className="detail-info"><span>Target case</span><strong>{lastResult.case ? `#${lastResult.case.number} ${lastResult.case.title}` : lastResult.target_case ?? 'n/a'}</strong></div>
                          </div>
                          {observables.length > 0 && (
                            <table className="thehive-table mt-3">
                              <thead>
                                <tr><th>Action</th><th>Type</th><th>Data</th><th>Attachment</th><th>Observable ID</th></tr>
                              </thead>
                              <tbody>
                                {observables.map(o => (
                                  <tr key={`${o.source_observable_id}-${o.observable_id}`}>
                                    <td><span className={o.action === 'copied' ? 'label label-success' : 'label label-default'}>{o.action}</span></td>
                                    <td>{o.data_type}</td>
                                    <td className="mono">{o.data}</td>
                                    <td>{o.attachment_id ? <span className="label label-default">📎 {o.attachment_id.split('-')[0]}</span> : '—'}</td>
                                    <td className="mono">{o.observable_id}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {report?.similar_alerts?.length ? (
                            <>
                              <h4 className="mt-3">Similar scoring details</h4>
                              <table className="thehive-table">
                                <thead><tr><th>Alert</th><th>Score</th><th>Overlap</th><th>Reason</th></tr></thead>
                                <tbody>
                                  {report.similar_alerts.map(s => (
                                    <tr key={s.id}>
                                      <td><a href={`/alerts/${s.id}`}>{s.title}</a></td>
                                      <td>{formatScore(s.score)}</td>
                                      <td>obs {s.observable_overlap ?? 0} · IOC {s.ioc_overlap ?? 0} · tags {s.tag_overlap ?? 0}</td>
                                      <td>{s.reason || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          ) : null}
                        </>
                      )}
                    </>
                  )}

                  {/* ── Observables tab ── */}
                  {activeTab === 'Observables' && (
                    <>
                      <h3 className="detail-section-title">Alert observables</h3>
                      <table className="thehive-table adminlte-table">
                        <thead>
                          <tr>
                            <th>TLP</th>
                            <th>Flags</th>
                            <th>Type</th>
                            <th>Data</th>
                            <th>Tags</th>
                            <th>Created by</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(item?.observables ?? []).map(o => (
                            <tr key={o.id}>
                              <td><Tlp value={o.tlp} format="icon" /></td>
                              <td><ObservableFlags observable={{ ioc: o.ioc, sighted: o.sighted }} /></td>
                              <td><span className="label label-primary">{o.data_type}</span></td>
                              <td className="mono wrap">
                                {o.data}
                                {o.attachment_id && (
                                  <div><span className="label label-default">📎 {o.attachment_id.split('-')[0]}</span></div>
                                )}
                              </td>
                              <td><TagList data={o.tags} /></td>
                              <td>{o.created_by}</td>
                            </tr>
                          ))}
                          {!item?.observables?.length && (
                            <tr><td colSpan={6} className="empty-message">No observables.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── Similar tab ── */}
                  {activeTab === 'Similar' && (
                    <>
                      <h3 className="detail-section-title">Similar cases</h3>
                      <div className="similar-filter-strip">
                        <span className="label label-lg label-primary">All ({item?.similar_alerts?.length ?? 0})</span>
                      </div>
                      <table className="thehive-table alert-similar-table">
                        <thead>
                          <tr><th>Title</th><th>Source</th><th>Observables</th><th>IOCs</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {(item?.similar_alerts ?? []).map(s => (
                            <tr key={s.id}>
                              <td>
                                <a href={`/alerts/${s.id}`}>{s.title}</a>
                                <div className="text-muted small">{s.reason ?? s.status ?? '—'}</div>
                              </td>
                              <td>{s.source}/{s.source_ref}</td>
                              <td>
                                <strong>{formatScore(s.score)}</strong>
                                <div className="progress progress-sm">
                                  <div className="progress-bar" style={{ width: formatScore(s.score) }} />
                                </div>
                                <small>{s.observable_overlap ?? 0} observables</small>
                              </td>
                              <td>
                                <strong>{s.ioc_overlap ?? 0}</strong>
                                <div className="progress progress-sm">
                                  <div className="progress-bar progress-bar-danger" style={{ width: `${Math.min(100, (s.ioc_overlap ?? 0) * 20)}%` }} />
                                </div>
                                <small>{s.tag_overlap ?? 0} tag overlap</small>
                              </td>
                              <td>
                                <button
                                  className="btn btn-sm btn-primary"
                                  disabled={!canWrite}
                                  onClick={() => { setTargetAlertId(s.id); setActiveTab('Overview'); }}
                                >
                                  Merge in this case
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!item?.similar_alerts?.length && (
                            <tr><td colSpan={5} className="empty-message">No similar alerts found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* ── Audit tab ── */}
                  {activeTab === 'Audit' && (
                    <>
                      <h3 className="detail-section-title">History</h3>
                      <div className="timeline">
                        {(item?.history ?? []).map((h, i) => (
                          <div className="timeline-item" key={`${h.action}-${i}`}>
                            <span className="timeline-dot" />
                            <strong>{h.action}</strong>
                            <p>{h.actor_id || 'system'}</p>
                            <small>{new Date(h.created_at).toLocaleString()}</small>
                          </div>
                        ))}
                        {!item?.history?.length && (
                          <div className="empty-message">No history yet.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Side action box */}
              <aside className="box box-primary case-action-box">
                <div className="box-header with-border">
                  <h3 className="box-title">Actions</h3>
                </div>
                <div className="box-body detail-side-list">
                  <button
                    className="btn btn-default btn-block"
                    disabled={!canWrite}
                    onClick={() => toggleFollow.mutate()}
                  >
                    {item?.follow ? <EyeOff size={14} /> : <Eye size={14} />}
                    {' '}{item?.follow ? 'Ignore new updates' : 'Track new updates'}
                  </button>
                  <button
                    className="btn btn-default btn-block"
                    disabled={!canWrite}
                    onClick={() => toggleRead.mutate()}
                  >
                    {item?.read ? <MailOpen size={14} /> : <Mail size={14} />}
                    {' '}{item?.read ? 'Mark as unread' : 'Mark as read'}
                  </button>
                  <button
                    className="btn btn-default btn-block"
                    disabled={!canWrite}
                    onClick={() => toggleFlag.mutate()}
                  >
                    <Flag size={14} /> {item?.flag ? 'Unflag' : 'Flag'}
                  </button>
                  <hr />
                  {!editing ? (
                    <button
                      className="btn btn-default btn-block"
                      disabled={!canWrite}
                      onClick={() => setEditing(true)}
                    >
                      ✏️ Edit alert
                    </button>
                  ) : (
                    <button className="btn btn-default btn-block" onClick={() => setEditing(false)}>
                      Cancel edit
                    </button>
                  )}
                  <hr />
                  {item?.case_id && (
                    <a href={`/cases/${item.case_id}`} className="btn btn-default btn-block">
                      <Link2 size={14} /> View case #{item.case_number}
                    </a>
                  )}
                  <button
                    className="btn btn-danger btn-block"
                    disabled={!canWrite || deleteAlert.isPending}
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 size={14} /> Delete
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
