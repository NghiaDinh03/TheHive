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
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<{login: string; name: string}[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState('');
  const [selectedObservable, setSelectedObservable] = useState('');
  const [triggerStatus, setTriggerStatus] = useState<{ success: boolean; message: string } | null>(null);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const detail = useQuery({
    queryKey: ['task-detail', params.id],
    queryFn: () => apiFetch<TaskDetail>(`/api/v1/tasks/${params.id}`),
    enabled: !!authedLogin && !!params.id,
  });

  const activeRules = useQuery({
    queryKey: ['autonomous-active-rules'],
    queryFn: () => apiFetch<{ id: string; name: string; observable_type: string }[]>('/api/v1/autonomous/active-rules'),
    enabled: !!authedLogin,
  });

  const caseId = detail.data?.task.case_id;
  const observables = useQuery({
    queryKey: ['case-observables', caseId],
    queryFn: () => apiFetch<{ values: { id: string; data_type: string; data: string; malicious_score: number }[] }>(`/api/v1/cases/${caseId}/observables`),
    enabled: !!authedLogin && !!caseId,
  });

  const triggerManual = useMutation({
    mutationFn: () => apiFetch(`/api/v1/autonomous/trigger-manual`, {
      method: 'POST',
      json: {
        rule_id: selectedPlaybook,
        observable_id: selectedObservable,
        task_id: params.id,
      },
    }),
    onSuccess: () => {
      setTriggerStatus({ success: true, message: 'Kích hoạt SOAR Playbook thành công!' });
      setSelectedPlaybook('');
      setSelectedObservable('');
      setTimeout(() => setTriggerStatus(null), 5000);
    },
    onError: (err: any) => {
      setTriggerStatus({ success: false, message: `Kích hoạt thất bại: ${err.message}` });
    },
  });

  const currentPlaybook = activeRules.data?.find(r => r.id === selectedPlaybook);
  const filteredObservables = observables.data?.values.filter(o => 
    !currentPlaybook || o.data_type.toLowerCase() === currentPlaybook.observable_type.toLowerCase()
  ) ?? [];

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

  const searchUsers = async (q: string) => {
    const data = await apiFetch<{login: string; name: string}[]>(`/api/v1/users/search?query=${encodeURIComponent(q)}`);
    return data;
  };

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

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
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 mb-2">Task <span className="text-slate-400 font-normal text-lg">{current?.case_number ? `Case #${current.case_number}` : 'analyst workbench'}</span></h1>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Home</span>
                <span className="text-slate-600">/</span>
                <a href="/tasks" className="hover:text-blue-400 transition-colors">Tasks</a>
                <span className="text-slate-600">/</span>
                <span className="text-blue-400 truncate max-w-[200px]">{current?.title ?? params.id}</span>
              </div>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
              <TaskStatusBadge status={current?.status} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main panel */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col">
                <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                  <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    {current?.flag && <Flag size={14} className="text-red-500" />}
                    {current?.title ?? `Task ${params.id}`}
                  </h3>
                </div>
                <div className="p-6">
                  {error && <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg text-sm">{error}</div>}

                  {/* Tab strip */}
                  <div className="flex overflow-x-auto border-b border-slate-700 mb-6 custom-scrollbar">
                    {TABS.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                          activeTab === tab
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                        {tab === 'Logs' && <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]">{detail.data?.logs.length ?? 0}</span>}
                        {tab === 'Attachments' && <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]">{detail.data?.attachments.length ?? 0}</span>}
                        {tab === 'Audit' && <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px]">{detail.data?.history.length ?? 0}</span>}
                      </button>
                    ))}
                  </div>

                  {/* Timeline tab — combined logs + audit */}
                  {activeTab === 'Timeline' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h4 className="text-blue-500 font-medium text-lg mb-6">Basic Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Title</span>
                          <span className="text-slate-200">{current?.title ?? '…'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Case</span>
                          <span className="text-slate-200">
                            {current?.case_number
                              ? <a href={`/cases/${current.case_id}`} className="text-blue-400 hover:text-blue-300 hover:underline">#{String(current.case_number).padStart(7, '0')} {current.case_title}</a>
                              : current?.case_id ?? '—'
                            }
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Status</span>
                          <span><TaskStatusBadge status={current?.status} /></span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Assignee</span>
                          <span className="text-slate-200">{current?.assignee || <em className="text-slate-500 not-italic">Not assigned</em>}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Group</span>
                          <span className="text-slate-200">{current?.group_name || 'default'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Due date</span>
                          <span className="text-slate-200">{current?.due_date ? <span className="text-yellow-500 flex items-center gap-1.5"><Clock size={14} /> {fmt(current.due_date)}</span> : <em className="text-slate-500 not-italic">None</em>}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Start date</span>
                          <span className="text-slate-200">{fmt(current?.start_date)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">End date</span>
                          <span className="text-slate-200">{fmt(current?.end_date)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Created</span>
                          <span className="text-slate-200">{fmt(current?.created_at)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Updated</span>
                          <span className="text-slate-200">{fmt(current?.updated_at)}</span>
                        </div>
                      </div>

                      {/* Task progress bar */}
                      <div className="mt-10">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-400 text-sm">Progress</span>
                          <span className="text-slate-300 text-sm font-medium">{current?.status === 'Completed' ? '100%' : current?.status === 'InProgress' ? '50%' : '0%'}</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${current?.status === 'Completed' ? 'bg-green-500' : current?.status === 'InProgress' ? 'bg-blue-500' : current?.status === 'Cancel' ? 'bg-red-500' : 'bg-slate-700'}`}
                            style={{ width: current?.status === 'Completed' ? '100%' : current?.status === 'InProgress' ? '50%' : '0%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logs tab — append-only log entries */}
                  {activeTab === 'Logs' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Add log form */}
                      {canTask && (
                        <form className="mb-8 bg-slate-900/50 p-4 rounded-lg border border-slate-700" onSubmit={submitLog}>
                          <div className="flex flex-col md:flex-row gap-3">
                            <textarea
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                              rows={3}
                              placeholder="Add a log entry (markdown supported)…"
                              value={logMessage}
                              onChange={(e) => setLogMessage(e.target.value)}
                            />
                            <div className="flex md:flex-col justify-end">
                              <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-full md:w-16 md:h-auto"
                                disabled={!logMessage.trim() || addLog.isPending}
                                title="Add log"
                              >
                                <Send size={16} />
                                <span className="md:hidden">Send</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      )}

                      {/* Log entries */}
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                        {(detail.data?.logs ?? []).length === 0 && (
                          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-800/50 relative z-10 mx-8">No task logs yet.</div>
                        )}
                        {(detail.data?.logs ?? []).map((log, i) => (
                          <div className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active" key={log.id}>
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-blue-900/50 text-blue-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                              <i className="fa fa-comment"></i>
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-md">
                              <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-700/50">
                                <strong className="text-slate-200">{log.created_by || 'system'}</strong>
                                <span className="text-slate-500 text-xs">{fmt(log.created_at)}</span>
                              </div>
                              <div className="prose prose-invert max-w-none text-slate-300 text-sm whitespace-pre-wrap">
                                {log.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments tab */}
                  {activeTab === 'Attachments' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                        {(detail.data?.history ?? []).length === 0 && (
                          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-800/50 relative z-10 mx-8">No audit events yet.</div>
                        )}
                        {(detail.data?.history ?? []).map((h, i) => (
                          <div className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active" key={`${h.action}-${h.created_at}-${i}`}>
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-700 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                              <i className="fa fa-history"></i>
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-md">
                              <div className="flex justify-between items-start mb-1">
                                <strong className="text-slate-200">{h.action}</strong>
                                <span className="text-slate-500 text-xs">{fmt(h.created_at)}</span>
                              </div>
                              <div className="text-slate-400 text-sm">{h.actor_id || 'system'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl p-5 shadow-lg sticky top-6">
                <h3 className="text-slate-100 font-semibold mb-5 pb-2 border-b border-slate-700 flex items-center gap-2">
                  <i className="fa fa-bolt text-blue-500"></i> Task Actions
                </h3>
                
                <div className="flex flex-col gap-5">
                  {/* Lifecycle actions */}
                  <div className="flex flex-col gap-2">
                    {current?.status === 'Waiting' && (
                      <button className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full" disabled={!canTask || start.isPending} onClick={() => start.mutate()}>
                        <Play size={14} /> Start task
                      </button>
                    )}
                    {current?.status === 'InProgress' && (
                      <button className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full" disabled={!canTask || close.isPending} onClick={() => close.mutate()}>
                        <CheckCircle size={14} /> Close task
                      </button>
                    )}
                    {(current?.status === 'Completed' || current?.status === 'Cancel') && (
                      <button className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full" disabled={!canTask || reopen.isPending} onClick={() => reopen.mutate()}>
                        <RotateCcw size={14} /> Reopen task
                      </button>
                    )}
                    {current?.status !== 'Cancel' && current?.status !== 'Completed' && (
                      <button className="px-4 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-700/50 rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full mt-1" disabled={!canTask || cancel.isPending} onClick={() => cancel.mutate()}>
                        <XCircle size={14} /> Cancel task
                      </button>
                    )}
                  </div>

                  <div className="h-px bg-slate-700 w-full" />

                  {/* Update title */}
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-400 text-sm font-medium">Update Title</label>
                    <div className="flex gap-2">
                      <input
                        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full"
                        placeholder="New task title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <button
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        disabled={!canTask || patch.isPending || !title.trim()}
                        onClick={() => patch.mutate()}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Assign */}
                  <div className="flex flex-col gap-2 relative">
                    <label className="text-slate-400 text-sm font-medium">Reassign Task</label>
                    <div className="flex gap-2">
                      <input
                        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full"
                        placeholder="Search user login..."
                        value={assignee}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAssignee(val);
                          if (val.length >= 2) {
                            searchUsers(val).then(res => { setUserSuggestions(res); setShowUserDropdown(true); });
                          } else {
                            setShowUserDropdown(false);
                          }
                        }}
                        onFocus={() => { if (userSuggestions.length > 0) setShowUserDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                      />
                      <button
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        disabled={!canTask || assign.isPending || !assignee.trim()}
                        onClick={() => assign.mutate()}
                      >
                        Assign
                      </button>
                    </div>
                    {showUserDropdown && userSuggestions.length > 0 && (
                      <ul className="absolute top-[68px] left-0 mt-1 w-[calc(100%-80px)] bg-slate-800 border border-slate-700 rounded-md shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {userSuggestions.map(u => (
                          <li key={u.login}>
                            <button type="button" className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors flex flex-col" onClick={() => { setAssignee(u.login); setShowUserDropdown(false); }}>
                              <span className="font-medium text-slate-200">{u.login}</span>
                              {u.name && <span className="text-slate-500 text-[11px]">{u.name}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Kích hoạt SOAR Playbook thủ công */}
                  <div className="h-px bg-slate-700 w-full" />
                  <div className="flex flex-col gap-3">
                    <label className="text-slate-200 text-sm font-semibold flex items-center gap-2">
                      🛡️ Kích hoạt SOAR Playbook
                    </label>
                    
                    <div className="flex flex-col gap-1.5">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Chọn Playbook</span>
                      <select
                        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full cursor-pointer hover:border-slate-600 transition-all"
                        value={selectedPlaybook}
                        onChange={(e) => {
                          setSelectedPlaybook(e.target.value);
                          setSelectedObservable('');
                        }}
                      >
                        <option value="">-- Chọn Playbook --</option>
                        {(activeRules.data ?? []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.observable_type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Chọn Observable</span>
                      <select
                        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full cursor-pointer hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        value={selectedObservable}
                        onChange={(e) => setSelectedObservable(e.target.value)}
                        disabled={!selectedPlaybook}
                      >
                        <option value="">-- Chọn Observable --</option>
                        {filteredObservables.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.data} (Threat Score: {o.malicious_score || 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="px-4 py-2.5 bg-red-700 hover:bg-red-650 text-white rounded-md text-xs font-bold transition-all duration-150 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full mt-2"
                      disabled={!selectedPlaybook || !selectedObservable || triggerManual.isPending}
                      onClick={() => triggerManual.mutate()}
                    >
                      🚀 Kích hoạt SOAR
                    </button>

                    {triggerStatus && (
                      <div className={`text-[11px] p-3 rounded border mt-2 leading-relaxed ${triggerStatus.success ? 'bg-green-950/40 border-green-850/40 text-green-400' : 'bg-red-950/40 border-red-850/40 text-red-400'}`}>
                        {triggerStatus.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function TaskStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 uppercase tracking-wider border border-slate-600">Loading</span>;
  if (status === 'Waiting') return <span className="px-2 py-0.5 rounded text-[10px] bg-blue-900/50 text-blue-400 uppercase tracking-wider border border-blue-700/50 inline-flex items-center gap-1"><Clock size={11} /> Waiting</span>;
  if (status === 'InProgress') return <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-900/50 text-yellow-400 uppercase tracking-wider border border-yellow-700/50 inline-flex items-center gap-1"><Play size={11} /> In Progress</span>;
  if (status === 'Completed') return <span className="px-2 py-0.5 rounded text-[10px] bg-green-900/50 text-green-400 uppercase tracking-wider border border-green-700/50 inline-flex items-center gap-1"><CheckCircle size={11} /> Completed</span>;
  if (status === 'Cancel') return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 uppercase tracking-wider border border-slate-600 inline-flex items-center gap-1"><XCircle size={11} /> Cancelled</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 uppercase tracking-wider border border-slate-600">{status}</span>;
}
