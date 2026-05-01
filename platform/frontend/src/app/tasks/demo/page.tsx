'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Clock3, MessageSquare, Plus } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch } from '@/lib/api';

type User = { login: string; name: string; permissions?: string[] };

type TimelineItem = { id: string; title: string; status: string; assignee: string; group: string; updated: string; logs: string[] };

const demoTasks: TimelineItem[] = [
  { id: 'task-intake', title: 'Initial triage and alert validation', status: 'Waiting', assignee: 'nghia.dinh@ncsgroup.vn', group: 'default', updated: 'Today 09:15', logs: ['Alert imported', 'Source and reference checked'] },
  { id: 'task-scope', title: 'Scope affected users and observables', status: 'InProgress', assignee: 'soc-l2', group: 'investigation', updated: 'Today 10:05', logs: ['Domain and IP observables reviewed', 'IOC status confirmed'] },
  { id: 'task-contain', title: 'Containment and evidence preservation', status: 'Waiting', assignee: 'incident-lead', group: 'response', updated: 'Today 10:42', logs: ['Awaiting attachment storage Phase 5'] },
];

export default function TasksWorkspacePage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const canWrite = !!me.data?.permissions?.some((permission) => ['manageTask', 'managePlatform'].includes(permission));

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="flex-1 p-4 md:p-6">
          <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-light text-thehive-text">Tasks</h1>
              <p className="text-sm text-thehive-muted mt-1">TheHive 4 task/log timeline parity workspace.</p>
            </div>
            <div className="flex gap-2"><span className="thehive-pill">Admin write enabled</span><span className="thehive-pill warn">UI parity foundation</span></div>
          </div>

          <div className="case-detail-layout">
            <section className="thehive-card">
              <div className="thehive-card-header case-detail-header">
                <div>
                  <h1>Case task workbench</h1>
                  <p>Grouped task lifecycle, append-only log timeline, and assignment UX.</p>
                </div>
                <button className="thehive-btn-primary flex items-center gap-2" disabled={!canWrite}><Plus size={15} /> New task</button>
              </div>
              <div className="thehive-card-body">
                <table className="thehive-table legacy-case-list">
                  <thead><tr><th>Status</th><th>Task</th><th>Assignee</th><th>Group</th><th>Updated</th><th>Actions</th></tr></thead>
                  <tbody>{demoTasks.map((task) => <tr key={task.id}><td><span className={task.status === 'InProgress' ? 'label label-warning' : 'label label-default'}>{task.status}</span></td><td><a className="case-title" href={`/tasks/${task.id}`}>{task.title}</a></td><td>{task.assignee}</td><td>{task.group}</td><td>{task.updated}</td><td><button className="admin-mini-btn" disabled={!canWrite}>Assign</button><button className="admin-mini-btn" disabled={!canWrite}>Close</button></td></tr>)}</tbody>
                </table>
                <h3 className="detail-section-title">Timeline</h3>
                <div className="timeline">
                  {demoTasks.flatMap((task) => task.logs.map((log) => ({ task, log }))).map(({ task, log }, index) => (
                    <div className="timeline-item" key={`${task.id}-${log}`}>
                      <span className="timeline-dot" />
                      <strong><MessageSquare size={14} className="inline mr-1" />{task.title}</strong>
                      <p className="text-sm text-thehive-muted mt-1">{log}</p>
                      <small className="text-thehive-muted"><Clock3 size={12} className="inline mr-1" />#{index + 1} · append-only log preview</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <aside className="thehive-card">
              <div className="thehive-card-header flex items-center gap-2"><CheckSquare size={15} /> Task parity checklist</div>
              <div className="thehive-card-body detail-tabs">
                <button>Lifecycle: create/update/assign/close</button>
                <button>Grouped task order</button>
                <button>Append-only logs</button>
                <button>Attachment hooks Phase 5</button>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
