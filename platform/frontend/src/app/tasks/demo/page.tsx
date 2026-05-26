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
    <div className="flex min-h-screen thehive-app-shell bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1 overflow-y-auto p-6">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-light text-slate-100">Tasks</h1>
              <p className="text-sm text-slate-400 mt-1">NCS Fusion Center task/log timeline workspace.</p>
            </div>
            <div className="flex gap-2">
              <span className="glass-status-pill glass-pill-success">Admin write enabled</span>
              <span className="glass-status-pill glass-pill-warning">UI parity foundation</span>
            </div>
          </div>

          <div className="case-detail-layout items-start">
            <section className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 bg-slate-900/40 flex justify-between items-center border-b border-slate-900/50">
                <div>
                  <h2 className="text-sm text-slate-200 font-bold uppercase tracking-wider">Case task workbench</h2>
                  <p className="text-xs text-slate-500 mt-1">Grouped task lifecycle, append-only log timeline, and assignment UX.</p>
                </div>
                <button 
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-lg flex items-center gap-1.5" 
                  disabled={!canWrite}
                >
                  <Plus size={14} /> New task
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300 border-collapse">
                    <thead className="bg-slate-900/40 text-slate-400 font-semibold tracking-wider text-[11px] uppercase border-b border-slate-900/50">
                      <tr>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Task</th>
                        <th className="py-3 px-4">Assignee</th>
                        <th className="py-3 px-4">Group</th>
                        <th className="py-3 px-4">Updated</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoTasks.map((task) => (
                        <tr 
                          key={task.id} 
                          className="glass-row hover:bg-slate-900/30 transition-colors duration-150 border-b border-slate-900/20"
                        >
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${task.status === 'InProgress' ? 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20' : 'bg-slate-900 text-slate-400 ring-1 ring-slate-800'}`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <a className="font-semibold text-blue-400 hover:text-blue-300 hover:underline" href={`/tasks/${task.id}`}>
                              {task.title}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-slate-400">{task.assignee}</td>
                          <td className="py-3 px-4"><span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded text-[10px] uppercase font-bold">{task.group}</span></td>
                          <td className="py-3 px-4 text-slate-500 font-mono">{task.updated}</td>
                          <td className="py-3 px-4">
                            <button className="px-2.5 py-1 bg-slate-900/60 hover:bg-slate-900 ring-1 ring-slate-800 text-slate-400 hover:text-slate-200 rounded text-[10px] font-bold transition-all select-none mr-2" disabled={!canWrite}>Assign</button>
                            <button className="px-2.5 py-1 bg-red-600/10 hover:bg-red-600/20 ring-1 ring-red-900/20 text-red-400 rounded text-[10px] font-bold transition-all select-none" disabled={!canWrite}>Close</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="detail-section-title text-slate-200 font-bold text-sm uppercase tracking-wider mt-8 mb-4 border-b border-slate-900/50 pb-2">Timeline</h3>
                <div className="timeline pl-4 border-l-2 border-slate-900">
                  {demoTasks.flatMap((task) => task.logs.map((log) => ({ task, log }))).map(({ task, log }, index) => (
                    <div className="timeline-item relative pl-6 pb-6" key={`${task.id}-${log}`}>
                      <span className="absolute left-[-23px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-slate-950" />
                      <div className="bg-slate-900/20 ring-1 ring-slate-900/60 p-4 rounded-xl">
                        <strong className="text-slate-200 text-xs flex items-center gap-1.5">
                          <MessageSquare size={13} className="text-blue-400" />
                          {task.title}
                        </strong>
                        <p className="text-xs text-slate-300 mt-2 font-mono leading-relaxed">{log}</p>
                        <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock3 size={11} />
                          <span>#{index + 1} · append-only log preview</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col w-[280px] shrink-0">
              <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-900/50 flex items-center gap-2">
                <CheckSquare size={15} className="text-blue-400" /> 
                <h3 className="text-xs text-slate-200 font-bold uppercase tracking-wider">Task parity checklist</h3>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <span className="px-3 py-2 bg-slate-900/40 ring-1 ring-slate-900/60 text-slate-300 rounded-lg text-xs font-semibold select-none text-left">Lifecycle: create/update/assign/close</span>
                <span className="px-3 py-2 bg-slate-900/40 ring-1 ring-slate-900/60 text-slate-300 rounded-lg text-xs font-semibold select-none text-left">Grouped task order</span>
                <span className="px-3 py-2 bg-slate-900/40 ring-1 ring-slate-900/60 text-slate-300 rounded-lg text-xs font-semibold select-none text-left">Append-only logs</span>
                <span className="px-3 py-2 bg-slate-900/40 ring-1 ring-slate-900/60 text-slate-300 rounded-lg text-xs font-semibold select-none text-left">Attachment hooks Phase 5</span>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
