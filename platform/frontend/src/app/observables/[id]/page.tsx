'use client';

/**
 * Observable detail page.
 * Mirrors legacy frontend/app/views/partials/observables/details/ (summary, analysers, responders, sharing).
 * Uses GET /api/v1/observables/:id (new endpoint added in this session).
 * Tabs: Summary | Analyzers | Sharing
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, Eye, Link, Play, Share2, Star, StarOff, ToggleLeft, ToggleRight, Trash2, Unlink } from '@/components/FaIcon';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { ObservableFlags, TagList, Tlp } from '@/components/Badges';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';
import { canUse } from '@/lib/permissions';

type User = { login: string; name: string; permissions?: string[] };
type ObservableItem = {
  id: string; data_type: string; data: string; full_data?: string; data_hash?: string;
  message: string; tlp: number; ioc: boolean; sighted: boolean; ignore_similarity?: boolean;
  attachment_id?: string; tags: string[]; case_id?: string; alert_id?: string;
  created_by: string; created_at: string; updated_at?: string;
};
type CortexJob = {
  id: string; analyzer_id: string; status: string;
  report?: string; started_at?: string; finished_at?: string; created_at: string;
};
type CortexAnalyzer = { id: string; analyzer_id: string; name: string; version: string; data_types: string[]; enabled: boolean };
type ObservableDetail = { observable: ObservableItem; jobs: CortexJob[] };

const TABS = ['Summary', 'Analyzers', 'Sharing', 'Attachments'] as const;
type TabName = typeof TABS[number];

function tlpLabel(tlp: number) {
  const map: Record<number, string> = { 0: 'WHITE', 1: 'GREEN', 2: 'AMBER', 3: 'RED' };
  return map[tlp] ?? String(tlp);
}

export default function ObservableDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Summary');
  const [selectedAnalyzer, setSelectedAnalyzer] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editingMeta, setEditingMeta] = useState(false);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const detail = useQuery({
    queryKey: ['observable-detail', params.id],
    queryFn: () => apiFetch<ObservableDetail>(`/api/v1/observables/${params.id}`),
    enabled: !!authedLogin && !!params.id,
  });
  const obs = detail.data?.observable;
  const jobs = detail.data?.jobs ?? [];

  const analyzers = useQuery({
    queryKey: ['cortex-analyzers', obs?.data_type],
    queryFn: () => apiFetch<CortexAnalyzer[]>(`/api/v1/cortex/analyzers?data_type=${obs?.data_type}`),
    enabled: !!obs?.data_type,
  });

  useEffect(() => {
    if (obs) {
      setEditTags(obs.tags?.join(', ') ?? '');
      setEditMessage(obs.message ?? '');
    }
  }, [obs]);

  const refetch = () => void detail.refetch();

  const canEdit = canUse(me.data, 'observableUpdate');
  const canDelete = canUse(me.data, 'observableDelete');
  const canAnalyze = canUse(me.data, 'observableAnalyze') || canUse(me.data, 'manageAnalyse');

  const patchObs = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch(`/api/v1/observables/${params.id}`, { method: 'PATCH', json: patch }),
    onSuccess: refetch,
  });

  const deleteObs = useMutation({
    mutationFn: () => apiFetch(`/api/v1/observables/${params.id}`, { method: 'DELETE' }),
    onSuccess: () => router.replace('/investigation?tab=observables'),
  });

  const analyzeMut = useMutation({
    mutationFn: (analyzerID: string) =>
      apiFetch(`/api/v1/observables/${params.id}/analyze`, { method: 'POST', json: { analyzer_id: analyzerID } }),
    onSuccess: refetch,
  });

  const actionError = [patchObs, deleteObs, analyzeMut]
    .map(m => (m.error as Error | undefined)?.message)
    .find(Boolean);

  const toggleField = (field: 'ioc' | 'sighted' | 'ignore_similarity') => {
    if (!canEdit || !obs) return;
    patchObs.mutate({ [field]: !obs[field] });
  };

  const saveMeta = () => {
    patchObs.mutate({
      message: editMessage,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setEditingMeta(false);
  };

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ?? { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>
              {obs?.data_type && <span className="label label-primary mr-1">{obs.data_type}</span>}
              {obs?.full_data || obs?.data || 'Observable'}
              <small> observable detail</small>
            </h1>
            <ol className="breadcrumb">
              <li>Home</li>
              <li>Investigation</li>
              <li>Observables</li>
              <li className="active">{obs?.data || params.id}</li>
            </ol>
          </section>

          <section className="content observable-detail-page">
            {actionError && <div className="admin-alert error">{actionError}</div>}

            <div className="case-detail-layout">
              {/* Main content */}
              <section className="nav-tabs-custom case-main-tabset">
                {/* Observable banner */}
                <div className="box box-primary observable-banner">
                  <div className="box-header with-border case-panelinfo-header">
                    <h3 className="box-title text-primary">
                      <Eye size={15} className="mr-1" />
                      {obs?.data_type && <span className="label label-primary mr-1">{obs.data_type}</span>}
                      {obs?.full_data || obs?.data || '…'}
                    </h3>
                    <div className="box-tools pull-right">
                      <ObservableFlags observable={{ ioc: obs?.ioc, sighted: obs?.sighted, ignore_similarity: obs?.ignore_similarity }} />
                      <Tlp value={obs?.tlp ?? 2} />
                    </div>
                  </div>
                  <div className="box-body case-panelinfo-body">
                    <span><strong>Type</strong> {obs?.data_type || '—'}</span>
                    <span><strong>TLP</strong> TLP:{tlpLabel(obs?.tlp ?? 2)}</span>
                    <span><strong>IOC</strong> {obs?.ioc ? 'Yes' : 'No'}</span>
                    <span><strong>Sighted</strong> {obs?.sighted ? 'Yes' : 'No'}</span>
                    <span><strong>Added</strong> {obs ? new Date(obs.created_at).toLocaleString() : '—'}</span>
                    <span><strong>By</strong> {obs?.created_by || '—'}</span>
                  </div>
                </div>

                {/* Tabs */}
                <ul className="nav nav-tabs detail-tab-strip">
                  {TABS.map(tab => (
                    <li key={tab} className={activeTab === tab ? 'active' : ''}>
                      <button type="button" onClick={() => setActiveTab(tab)}>
                        {tab}
                        {tab === 'Analyzers' && <span className="badge">{jobs.length}</span>}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="tab-content case-page-content">

                  {/* ── Summary tab ── */}
                  {activeTab === 'Summary' && (
                    <div className="observable-summary-tab">
                      <h4 className="vpad10 text-primary">
                        Basic Information
                        <div className="task-actions pull-right">
                          {canEdit && (
                            <button className="btn btn-xs btn-default" onClick={() => setEditingMeta(v => !v)}>
                              {editingMeta ? 'Cancel' : 'Edit'}
                            </button>
                          )}
                          {canDelete && (
                            <button className="btn btn-xs btn-danger ml-1" disabled={deleteObs.isPending} onClick={() => deleteObs.mutate()}>
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </h4>

                      <dl className="dl-horizontal clear">
                        <dt>TLP</dt>
                        <dd>
                          {canEdit ? (
                            <span className="clickable" onClick={() => patchObs.mutate({ tlp: ((obs?.tlp ?? 2) + 1) % 4 })}>
                              <Tlp value={obs?.tlp ?? 2} />
                            </span>
                          ) : (
                            <Tlp value={obs?.tlp ?? 2} />
                          )}
                        </dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Data type</dt>
                        <dd><span className="label label-primary">{obs?.data_type || '—'}</span></dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Data</dt>
                        <dd className="mono wrap">{obs?.data || '—'}</dd>
                      </dl>

                      {obs?.full_data && (
                        <dl className="dl-horizontal clear">
                          <dt>Full data</dt>
                          <dd className="mono wrap text-muted">{obs.full_data}</dd>
                        </dl>
                      )}

                      {obs?.data_hash && (
                        <dl className="dl-horizontal clear">
                          <dt>Hash</dt>
                          <dd className="mono">{obs.data_hash}</dd>
                        </dl>
                      )}

                      <dl className="dl-horizontal clear">
                        <dt>Date added</dt>
                        <dd>{obs ? new Date(obs.created_at).toLocaleString() : '—'}</dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Is IOC</dt>
                        <dd>
                          {canEdit ? (
                            <span className="clickable" title="Toggle IOC" onClick={() => toggleField('ioc')}>
                              {obs?.ioc ? <Star size={16} className="text-primary" /> : <StarOff size={16} className="text-muted" />}
                            </span>
                          ) : (
                            obs?.ioc ? <Star size={16} className="text-primary" /> : <StarOff size={16} className="text-muted" />
                          )}
                        </dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Has been sighted</dt>
                        <dd>
                          {canEdit ? (
                            <span className="clickable" title="Toggle sighted" onClick={() => toggleField('sighted')}>
                              {obs?.sighted ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-muted" />}
                            </span>
                          ) : (
                            obs?.sighted ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-muted" />
                          )}
                        </dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Ignored for similarity</dt>
                        <dd>
                          {canEdit ? (
                            <span className="clickable" title="Toggle ignore similarity" onClick={() => toggleField('ignore_similarity')}>
                              {obs?.ignore_similarity ? <Unlink size={16} className="text-warning" /> : <Link size={16} className="text-muted" />}
                            </span>
                          ) : (
                            obs?.ignore_similarity ? <Unlink size={16} className="text-warning" /> : <Link size={16} className="text-muted" />
                          )}
                        </dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Tags</dt>
                        <dd>
                          {editingMeta ? (
                            <input className="thehive-input" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2" />
                          ) : (
                            <TagList data={obs?.tags ?? []} />
                          )}
                        </dd>
                      </dl>

                      <dl className="dl-horizontal clear">
                        <dt>Message</dt>
                        <dd>
                          {editingMeta ? (
                            <textarea className="thehive-input" rows={3} value={editMessage} onChange={e => setEditMessage(e.target.value)} />
                          ) : (
                            <span className="description-pane">{obs?.message || <em className="text-muted">No message</em>}</span>
                          )}
                        </dd>
                      </dl>

                      {editingMeta && (
                        <div className="btn-toolbar mt-2">
                          <button className="btn btn-primary btn-sm" disabled={patchObs.isPending} onClick={saveMeta}>Save</button>
                          <button className="btn btn-default btn-sm ml-1" onClick={() => setEditingMeta(false)}>Cancel</button>
                        </div>
                      )}

                      {obs?.attachment_id && (
                        <dl className="dl-horizontal clear">
                          <dt>Attachment</dt>
                          <dd className="mono">{obs.attachment_id}</dd>
                        </dl>
                      )}
                    </div>
                  )}

                  {/* ── Analyzers tab ── */}
                  {activeTab === 'Analyzers' && (
                    <div className="observable-analyzers-tab">
                      {canAnalyze && (
                        <div className="box box-default analyzer-run-box">
                          <div className="box-header with-border">
                            <h3 className="box-title"><Play size={14} /> Run analyzer</h3>
                          </div>
                          <div className="box-body integration-form-grid">
                            <select
                              className="thehive-input"
                              value={selectedAnalyzer}
                              onChange={e => setSelectedAnalyzer(e.target.value)}
                            >
                              <option value="">Select analyzer…</option>
                              {(analyzers.data ?? []).map(a => (
                                <option key={a.analyzer_id} value={a.analyzer_id}>
                                  {a.name} ({a.version})
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary"
                              disabled={!selectedAnalyzer || analyzeMut.isPending}
                              onClick={() => analyzeMut.mutate(selectedAnalyzer)}
                            >
                              {analyzeMut.isPending ? 'Submitting…' : 'Analyze'}
                            </button>
                          </div>
                        </div>
                      )}

                      <table className="thehive-table adminlte-table observable-report-table">
                        <thead>
                          <tr>
                            <th>Analyzer</th>
                            <th>Status</th>
                            <th>Started</th>
                            <th>Finished</th>
                            <th>Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobs.map(j => (
                            <tr key={j.id}>
                              <td>{j.analyzer_id}</td>
                              <td>
                                <span className={
                                  j.status === 'Success' ? 'label label-success' :
                                  j.status === 'Failure' ? 'label label-danger' :
                                  j.status === 'InProgress' ? 'label label-warning' :
                                  'label label-default'
                                }>{j.status}</span>
                              </td>
                              <td>{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
                              <td>{j.finished_at ? new Date(j.finished_at).toLocaleString() : '—'}</td>
                              <td className="wrap mono text-xs">
                                {j.report ? (() => {
                                  try {
                                    const r = JSON.parse(j.report);
                                    return r?.summary?.taxonomies?.map((t: { level: string; namespace: string; predicate: string; value: string }, i: number) => (
                                      <span key={i} className={`label label-${t.level === 'malicious' ? 'danger' : t.level === 'suspicious' ? 'warning' : 'info'} mr-1`}>
                                        {t.namespace}:{t.predicate}={t.value}
                                      </span>
                                    )) ?? j.report.slice(0, 200);
                                  } catch { return j.report.slice(0, 200); }
                                })() : '—'}
                              </td>
                            </tr>
                          ))}
                          {!jobs.length && (
                            <tr><td colSpan={5} className="empty-message">No analyzer reports yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Sharing tab ── */}
                  {activeTab === 'Sharing' && (
                    <div className="observable-sharing-tab">
                      <div className="box box-default">
                        <div className="box-header with-border">
                          <h3 className="box-title"><Share2 size={14} /> Observable sharing</h3>
                        </div>
                        <div className="box-body">
                          <p className="text-muted">
                            Observable sharing follows the parent case sharing rules.
                            {obs?.case_id && (
                              <> See <a href={`/cases/${obs.case_id}`}>case shares</a> to manage access.</>
                            )}
                          </p>
                          <dl className="dl-horizontal">
                            <dt>Case ID</dt>
                            <dd>{obs?.case_id ? <a href={`/cases/${obs.case_id}`}>{obs.case_id}</a> : '—'}</dd>
                            <dt>Alert ID</dt>
                            <dd>{obs?.alert_id || '—'}</dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Attachments tab ── */}
                  {activeTab === 'Attachments' && (
                    <AttachmentPanel user={me.data} observableId={params.id} title="Observable attachments" />
                  )}
                </div>
              </section>

              {/* Side panel */}
              <aside className="box box-primary observable-side-box">
                <div className="box-header with-border">
                  <h3 className="box-title"><Activity size={14} /> Flags &amp; tags</h3>
                </div>
                <div className="box-body detail-side-list">
                  <div className="mb-2">
                    <span
                      className={`label ${obs?.ioc ? 'label-danger' : 'label-default'} clickable`}
                      title="Toggle IOC"
                      onClick={() => canEdit && toggleField('ioc')}
                    >
                      {obs?.ioc ? '★ IOC' : '☆ Not IOC'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span
                      className={`label ${obs?.sighted ? 'label-info' : 'label-default'} clickable`}
                      title="Toggle sighted"
                      onClick={() => canEdit && toggleField('sighted')}
                    >
                      {obs?.sighted ? '● Sighted' : '○ Not sighted'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span
                      className={`label ${obs?.ignore_similarity ? 'label-warning' : 'label-default'} clickable`}
                      title="Toggle ignore similarity"
                      onClick={() => canEdit && toggleField('ignore_similarity')}
                    >
                      {obs?.ignore_similarity ? '⛓ Ignore similarity' : '🔗 Similarity on'}
                    </span>
                  </div>
                  <hr />
                  <div className="mb-1"><strong>TLP</strong></div>
                  <Tlp value={obs?.tlp ?? 2} />
                  <hr />
                  <div className="mb-1"><strong>Tags</strong></div>
                  <TagList data={obs?.tags ?? []} />
                </div>
              </aside>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
