'use client';

/**
 * Global tasks list page.
 * Mirrors legacy TheHive 4 tasks list view.
 * Shows all tasks across cases with filters: status, assignee, group, flag.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, CheckSquare, Clock, Flag, Play, RotateCcw, XCircle } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type UserInfo = { login: string; name: string; permissions?: string[] };
type Task = {
  id: string;
  case_id: string;
  case_number?: number;
  case_title?: string;
  title: string;
  description?: string;
  status: string;
  assignee: string;
  group_name: string;
  order_index: number;
  flag?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
};
type Collection<T> = { values: T[]; total: number };

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

const STATUS_OPTIONS = ['', 'Waiting', 'InProgress', 'Completed', 'Cancel'];

function statusIcon(status: string) {
  switch (status) {
    case 'Waiting': return <Clock size={13} className="text-muted" />;
    case 'InProgress': return <Play size={13} className="text-info" />;
    case 'Completed': return <CheckCircle size={13} className="text-success" />;
    case 'Cancel': return <XCircle size={13} className="text-danger" />;
    default: return <CheckSquare size={13} className="text-muted" />;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'Waiting': return 'label-default';
    case 'InProgress': return 'label-info';
    case 'Completed': return 'label-success';
    case 'Cancel': return 'label-danger';
    default: return 'label-default';
  }
}

export default function TasksListPage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [flagFilter, setFlagFilter] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<UserInfo>('/api/v1/auth/me'), enabled: !!authedLogin });

  const params = useMemo(() => {
    const parts: string[] = [`range=${page * pageSize}:${(page + 1) * pageSize}`, 'sort=updated_at:DESC'];
    if (statusFilter) parts.push(`status=${encodeURIComponent(statusFilter)}`);
    if (assigneeFilter.trim()) parts.push(`assignee=${encodeURIComponent(assigneeFilter.trim())}`);
    if (groupFilter.trim()) parts.push(`group_name=${encodeURIComponent(groupFilter.trim())}`);
    if (flagFilter) parts.push('flag=true');
    return parts.join('&');
  }, [page, statusFilter, assigneeFilter, groupFilter, flagFilter]);

  const tasks = useQuery({
    queryKey: ['tasks-list', params],
    queryFn: () => apiFetch<Collection<Task>>(`/api/v1/tasks?${params}`),
    enabled: !!authedLogin,
  });

  const items = tasks.data?.values ?? [];
  const total = tasks.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.case_title ?? '').toLowerCase().includes(q) ||
      (t.assignee ?? '').toLowerCase().includes(q) ||
      (t.group_name ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  function resetFilters() {
    setStatusFilter('');
    setAssigneeFilter('');
    setGroupFilter('');
    setFlagFilter(false);
    setQuery('');
    setPage(0);
  }

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Tasks <small>analyst workbench</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Tasks</li></ol>
          </section>
          <section className="content">
            {/* Filters */}
            <div className="box box-default">
              <div className="box-header with-border">
                <h3 className="box-title">Filters</h3>
                <div className="box-tools pull-right">
                  <button type="button" className="btn btn-default btn-xs" onClick={resetFilters}>
                    <RotateCcw size={12} className="mr-1" /> Reset
                  </button>
                </div>
              </div>
              <div className="box-body">
                <div className="row">
                  <div className="col-sm-3">
                    <div className="form-group">
                      <label className="control-label">Status</label>
                      <select className="form-control input-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                        <option value="">All statuses</option>
                        {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="form-group">
                      <label className="control-label">Assignee</label>
                      <input type="text" className="form-control input-sm" placeholder="Filter by assignee…" value={assigneeFilter} onChange={(e) => { setAssigneeFilter(e.target.value); setPage(0); }} />
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="form-group">
                      <label className="control-label">Group</label>
                      <input type="text" className="form-control input-sm" placeholder="Filter by group…" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(0); }} />
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="form-group">
                      <label className="control-label">Search</label>
                      <input type="text" className="form-control input-sm" placeholder="Search title, case, assignee…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-sm-12">
                    <div className="checkbox">
                      <label>
                        <input type="checkbox" checked={flagFilter} onChange={(e) => { setFlagFilter(e.target.checked); setPage(0); }} />
                        {' '}<Flag size={13} className="mr-1" /> Flagged tasks only
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Task list */}
            <div className="box">
              <div className="box-header with-border">
                <h3 className="box-title">
                  <CheckSquare size={14} className="mr-1" />
                  Tasks
                  {tasks.isFetching && <span className="ml-2 text-muted text-xs">loading…</span>}
                </h3>
                <div className="box-tools pull-right">
                  <span className="text-muted text-sm">{total} task(s) total</span>
                </div>
              </div>
              <div className="box-body p-0">
                {tasks.isLoading && <div className="thehive-empty">Loading tasks…</div>}
                {!tasks.isLoading && filtered.length === 0 && (
                  <div className="thehive-empty">No tasks found matching your filters.</div>
                )}
                {filtered.length > 0 && (
                  <table className="thehive-table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Title</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th style={{ width: 130 }}>Assignee</th>
                        <th style={{ width: 110 }}>Group</th>
                        <th style={{ width: 130 }}>Case</th>
                        <th style={{ width: 100 }}>Due</th>
                        <th style={{ width: 100 }}>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((task) => (
                        <tr
                          key={task.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => router.push(`/tasks/${task.id}`)}
                        >
                          <td className="text-center">
                            {task.flag && <Flag size={12} className="text-warning" />}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {statusIcon(task.status)}
                              <span className="font-medium text-sm">{task.title}</span>
                            </div>
                            {task.description && (
                              <div className="text-muted text-xs mt-0.5 truncate" style={{ maxWidth: 400 }}>{task.description}</div>
                            )}
                          </td>
                          <td>
                            <span className={`label ${statusClass(task.status)}`}>{task.status}</span>
                          </td>
                          <td className="text-sm">{task.assignee || <span className="text-muted">—</span>}</td>
                          <td className="text-sm text-muted">{task.group_name || '—'}</td>
                          <td>
                            {task.case_number ? (
                              <a
                                href={`/cases/${task.case_id}`}
                                className="text-sm"
                                onClick={(e) => { e.stopPropagation(); router.push(`/cases/${task.case_id}`); e.preventDefault(); }}
                              >
                                #{task.case_number}
                              </a>
                            ) : <span className="text-muted text-sm">—</span>}
                          </td>
                          <td className="text-xs text-muted">{fmt(task.due_date)}</td>
                          <td className="text-xs text-muted">{fmt(task.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {totalPages > 1 && (
                <div className="box-footer">
                  <div className="flex items-center gap-2 justify-center">
                    <button type="button" className="btn btn-default btn-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                    <span className="text-sm text-muted">Page {page + 1} of {totalPages}</span>
                    <button type="button" className="btn btn-default btn-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next ›</button>
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
