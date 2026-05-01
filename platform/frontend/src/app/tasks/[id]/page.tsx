'use client';

/**
 * Task detail / timeline page.
 * Mirrors legacy `frontend/app/views/partials/case/tasklogs/add-task-log.modal.html`,
 * `directives/log-entry.html`, `directives/task-progress.html`.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AttachmentPanel, type AttachmentItem } from '@/components/AttachmentPanel';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';
import { canUse } from '@/lib/permissions';
import { CheckCircle, Clock, Flag, Play, RotateCcw, Send, XCircle } from '@/components/FaIcon';

type User = { login: string; name: string; permissions?: string[] };
type Task = {
  id: string; case_id: string; case_number?: number; case_title?: string;
  title: string; description?: string; status: string; assignee: string;
  group_name: string; order_index: number; flag?: boolean;
  start_date?: string | null; end_date?: string | null; due_date?: string | null;
  created_at: string; updated_at: string;
};
type TaskLog = { id: string; message: string; created_by: string; created_at: string };
type TaskHistory = { action: string; actor_id: string; created_at: string };
type TaskDetail = { task: Task; logs: TaskLog[]; attachments: AttachmentItem[]; history: TaskHistory[] };

const TABS = ['Timeline', 'Logs', 'Attachments', 'Audit'] as const;
type TabName = typeof TABS[number];

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

export default function TaskTimelinePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Timeline');
  const [assignee, setAssignee] = useState('');
  const [title, setTitle] = useState('');
  const [logMessage, setLogMessage] = useState('');

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const detail = useQuery({
    queryKey: ['task-detail', params.id],
    queryFn: () => apiFetch<TaskDetail>(`/api/v1/tasks/${params.id}`),
    enabled: !!authedLogin && !!params.id,
  });

  const canTask = canUse(me.data, 'taskUpdate') || canUse(me.data, 'taskClose');

  const patch = useMutation({
    mutationFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}`, { method: 'PATCH', json: { title: title.trim() || undefined } }),
    onSuccess: () => { setTitle(''); void detail.refetch(); },
  });
  const assign = useMutation({
    mutationFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}/assign`, { method: 'POST', json: { assignee } }),
    onSuccess: () => { setAssignee(''); void detail.refetch(); },
  });
  const start = useMutation({ mutationFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}/start`, { method: 'POST' }), onSuccess: () => void detail.refetch() });
  const close = useMutation({ mutationFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}/close`, { method: 'POST' }), onSuccess: () => void detail.refetch() });
  const reopen = useMutation({ mutationFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}/reopen`, { method: 'POST' }), onSuccess: () => void detail.refetch() });
  const cancel = useMutation({ mutationFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}/cancel`, { method: 'POST' }), onSuccess: () => void detail.refetch() });
  const addLog = useMutation({
    mutationFn: () => apiFetch(`/api/v1/tasks/${params.id}/logs`, { method: 'POST', json: { message: logMessage.trim() } }),
    onSuccess: () => { setLogMessage(''); void detail.refetch(); },
  });

  const current = close.data ?? assign.data ?? patch.data ?? start.data ?? reopen.data ?? cancel.data ?? detail.data?.task;
  const error = [patch, assign, close, start, reopen, cancel, addLog].map((m) => (m.error as Error | undefined)?.message).find(Boolean) ?? (detail.error as Error | undefined)?.message;

  function submitLog(e: FormEvent) {
    e.preventDefault();
    if (logMessage.trim()) addLog.mutate();
  }

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ?? { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Task <small>{current?.case_number ? `Case #${current.case_number}` : 'analyst workbench'}</small></h1>
            <ol className="breadcrumb">
              <li>Home</li>
              <li><a href="/tasks">Tasks</a></li>
              <li className="active">{current?.title ?? params.id}</li>
            </ol>
          </section>
          <section className="content task-detail-page">
            <div className="case-detail-layout">
              {/* Main panel */}
              <section className="box box-primary task-detail-main">
                <div className="box-header with-border task-detail-heading">
                  <h3 className="box-title text-primary">
                    {current?.flag && <Flag size={13} className="inline text-red-600 mr-1" />}
                    {current?.title ?? `Task ${params.id}`}
                  </h3>
                  <div className="box-tools pull-right">
                    <TaskStatusBadge status={current?.status} />
                  </div>
                </div>
                <div className="box-body">
                  {error && <div className="admin-alert error">{error}</div>}

                  {/* Tab strip */}
                  <ul className="nav nav-tabs detail-tab-strip">
                    {TABS.map((tab) => (
                      <li key={tab} className={activeTab === tab ? 'active' : ''}>
                        <button type="button" onClick={() => setActiveTab(tab)}>
                          {tab}
                          {tab === 'Logs' && <span className="badge ml-xs">{detail.data?.logs.length ?? 0}</span>}
                          {tab === 'Attachments' && <span className="badge ml-xs">{detail.data?.attachments.length ?? 0}</span>}
                          {tab === 'Audit' && <span className="badge ml-xs">{detail.data?.history.length ?? 0}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Timeline tab — combined logs + audit */}
                  {activeTab === 'Timeline' && (
                    <div className="tab-content">
                      <h4 className="vpad10 text-primary">Basic Information</h4>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Title</dt>
                        <dd>{current?.title ?? '…'}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Case</dt>
                        <dd>
                          {current?.case_number
                            ? <a href={`/cases/${current.case_id}`}>#{current.case_number} {current.case_title}</a>
                            : current?.case_id ?? '—'
                          }
                        </dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Status</dt>
                        <dd><TaskStatusBadge status={current?.status} /></dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Assignee</dt>
                        <dd>{current?.assignee || <em className="text-muted">Not assigned</em>}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Group</dt>
                        <dd>{current?.group_name || 'default'}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Due date</dt>
                        <dd>{current?.due_date ? <span className="text-warning"><Clock size={12} /> {fmt(current.due_date)}</span> : <em className="text-muted">None</em>}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Start date</dt>
                        <dd>{fmt(current?.start_date)}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">End date</dt>
                        <dd>{fmt(current?.end_date)}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Created</dt>
                        <dd>{fmt(current?.created_at)}</dd>
                      </dl>
                      <dl className="dl-horizontal clear">
                        <dt className="pull-left">Updated</dt>
                        <dd>{fmt(current?.updated_at)}</dd>
                      </dl>

                      {/* Task progress bar */}
                      <div className="task-progress mt-s">
                        <div className="progress">
                          <div
                            className={`progress-bar ${current?.status === 'Completed' ? 'progress-bar-success' : current?.status === 'InProgress' ? 'progress-bar-info' : current?.status === 'Cancel' ? 'progress-bar-danger' : ''}`}
                            style={{ width: current?.status === 'Completed' ? '100%' : current?.status === 'InProgress' ? '50%' : '0%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logs tab — append-only log entries */}
                  {activeTab === 'Logs' && (
                    <div className="tab-content">
                      {/* Add log form — mirrors add-task-log.modal.html */}
                      {canTask && (
                        <form className="log-entry-form mb-s" onSubmit={submitLog}>
                          <div className="input-group">
                            <textarea
                              className="form-control"
                              rows={3}
                              placeholder="Add a log entry (markdown supported)…"
                              value={logMessage}
                              onChange={(e) => setLogMessage(e.target.value)}
                            />
                            <span className="input-group-btn">
                              <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!logMessage.trim() || addLog.isPending}
                                title="Add log"
                              >
                                <Send size={14} />
                              </button>
                            </span>
                          </div>
                        </form>
                      )}

                      {/* Log entries — mirrors log-entry.html */}
                      <div className="timeline">
                        {(detail.data?.logs ?? []).length === 0 && (
                          <div className="empty-message">No task logs yet.</div>
                        )}
                        {(detail.data?.logs ?? []).map((log) => (
                          <div className="timeline-item" key={log.id}>
                            <span className="timeline-dot" />
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <strong>{log.created_by || 'system'}</strong>
                                <span className="timeline-time text-muted ml-xs">{fmt(log.created_at)}</span>
                              </div>
                              <div className="timeline-body">
                                <pre className="log-message">{log.message}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments tab */}
                  {activeTab === 'Attachments' && (
                    <div className="tab-content">
                      <AttachmentPanel
                        user={me.data}
                        logId={detail.data?.logs?.[0]?.id}
                        initialAttachments={detail.data?.attachments ?? []}
                        title="Task/log attachments"
                      />
                    </div>
                  )}

                  {/* Audit tab */}
                  {activeTab === 'Audit' && (
                    <div className="tab-content">
                      <div className="timeline">
                        {(detail.data?.history ?? []).length === 0 && (
                          <div className="empty-message">No audit events yet.</div>
                        )}
                        {(detail.data?.history ?? []).map((h, i) => (
                          <div className="timeline-item" key={`${h.action}-${h.created_at}-${i}`}>
                            <span className="timeline-dot" />
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <strong>{h.action}</strong>
                                <span className="timeline-time text-muted ml-xs">{fmt(h.created_at)}</span>
                              </div>
                              <div className="timeline-body text-muted">{h.actor_id || 'system'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Action sidebar */}
              <aside className="box box-primary case-action-box task-action-box">
                <div className="box-header with-border"><h3 className="box-title">Task actions</h3></div>
                <div className="box-body detail-tabs">
                  {/* Lifecycle actions */}
                  <div className="btn-group-vertical w-full mb-s">
                    {current?.status === 'Waiting' && (
                      <button className="btn btn-success" disabled={!canTask || start.isPending} onClick={() => start.mutate()}>
                        <Play size={13} /> Start task
                      </button>
                    )}
                    {current?.status === 'InProgress' && (
                      <button className="btn btn-primary" disabled={!canTask || close.isPending} onClick={() => close.mutate()}>
                        <CheckCircle size={13} /> Close task
                      </button>
                    )}
                    {(current?.status === 'Completed' || current?.status === 'Cancel') && (
                      <button className="btn btn-default" disabled={!canTask || reopen.isPending} onClick={() => reopen.mutate()}>
                        <RotateCcw size={13} /> Reopen task
                      </button>
                    )}
                    {current?.status !== 'Cancel' && current?.status !== 'Completed' && (
                      <button className="btn btn-danger" disabled={!canTask || cancel.isPending} onClick={() => cancel.mutate()}>
                        <XCircle size={13} /> Cancel task
                      </button>
                    )}
                  </div>

                  <hr />

                  {/* Update title */}
                  <div className="form-group">
                    <label className="control-label">Update title</label>
                    <input
                      className="form-control input-sm"
                      placeholder="New task title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <button
                      className="btn btn-sm btn-default mt-xs w-full"
                      disabled={!canTask || patch.isPending || !title.trim()}
                      onClick={() => patch.mutate()}
                    >
                      Update title
                    </button>
                  </div>

                  {/* Assign */}
                  <div className="form-group">
                    <label className="control-label">Assign to</label>
                    <input
                      className="form-control input-sm"
                      placeholder="Assignee login"
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                    />
                    <button
                      className="btn btn-sm btn-default mt-xs w-full"
                      disabled={!canTask || assign.isPending || !assignee.trim()}
                      onClick={() => assign.mutate()}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function TaskStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="label label-default">Loading</span>;
  if (status === 'Waiting') return <span className="label label-default"><Clock size={11} /> Waiting</span>;
  if (status === 'InProgress') return <span className="label label-primary"><Play size={11} /> In Progress</span>;
  if (status === 'Completed') return <span className="label label-success"><CheckCircle size={11} /> Completed</span>;
  if (status === 'Cancel') return <span className="label label-danger"><XCircle size={11} /> Cancelled</span>;
  return <span className="label label-default">{status}</span>;
}
