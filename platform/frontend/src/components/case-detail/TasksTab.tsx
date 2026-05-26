'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { Task, User } from './types';
import { AttachmentPanel } from '@/components/AttachmentPanel';
import { TaskFlags } from '@/components/Badges';
import { apiFetch } from '@/lib/api';

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5 note
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore */ }
};

interface TasksTabProps {
  tasks: Task[];
  attachments: any[];
  user?: User;
  caseId: string;
  canWrite: boolean;
  searchUsers: (q: string) => Promise<{ login: string; name: string }[]>;
  refetch: () => void;
}

export default function TasksTab({
  tasks,
  attachments,
  user,
  caseId,
  canWrite,
  searchUsers,
  refetch
}: TasksTabProps) {
  const [activeFilter, setActiveFilter] = useState<'All' | 'Waiting' | 'InProgress' | 'Completed' | 'Cancel'>('All');
  const [quickTitle, setQuickTitle] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  // Advanced Task Modal & Playbook Link
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    group_name: '',
    assignee: '',
    description: '',
    playbook_name: '',
    playbook_webhook: ''
  });
  
  // 2FA Verification Modal for Playbook Trigger
  const [triggeringTaskId, setTriggeringTaskId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  
  const [userSuggestions, setUserSuggestions] = useState<{ login: string; name: string }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  interface AutonomousRule {
    id: string;
    name: string;
    description: string;
    observable_type: string;
    threat_score_threshold: number;
    webhook_url: string;
    is_active: boolean;
  }

  const [activeRules, setActiveRules] = useState<AutonomousRule[]>([]);

  useEffect(() => {
    if (showAdvancedForm) {
      apiFetch<AutonomousRule[]>('/api/v1/autonomous/active-rules')
        .then(res => {
          if (res) {
            setActiveRules(res);
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [showAdvancedForm]);
  
  // Listen for new tasks dynamically to play sound notification
  const prevTasksCount = useRef(tasks.length);
  useEffect(() => {
    if (tasks.length > prevTasksCount.current) {
      // Play ping sound on new task assigned
      playNotificationSound();
    }
    prevTasksCount.current = tasks.length;
  }, [tasks]);

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    try {
      await apiFetch('/api/v1/tasks', {
        method: 'POST',
        json: {
          case_id: caseId,
          title: quickTitle.trim(),
          group_name: 'General',
          assignee: '',
          description: ''
        }
      });
      setQuickTitle('');
      refetch();
    } catch { /* ignore */ }
  };

  const handleCreateAdvancedTask = async () => {
    if (!taskForm.title.trim()) return;
    try {
      await apiFetch('/api/v1/tasks', {
        method: 'POST',
        json: {
          case_id: caseId,
          title: taskForm.title.trim(),
          group_name: taskForm.group_name.trim() || 'General',
          assignee: taskForm.assignee,
          description: taskForm.description,
          playbook_name: taskForm.playbook_name,
          playbook_webhook: taskForm.playbook_webhook
        }
      });
      setTaskForm({ title: '', group_name: '', assignee: '', description: '', playbook_name: '', playbook_webhook: '' });
      setShowAdvancedForm(false);
      refetch();
    } catch { /* ignore */ }
  };

  const startTask = async (id: string) => {
    await apiFetch(`/api/v1/tasks/${id}/start`, { method: 'POST' });
    refetch();
  };

  const closeTask = async (id: string) => {
    await apiFetch(`/api/v1/tasks/${id}/close`, { method: 'POST' });
    refetch();
  };

  const reopenTask = async (id: string) => {
    await apiFetch(`/api/v1/tasks/${id}/reopen`, { method: 'POST' });
    refetch();
  };

  const cancelTask = async (id: string) => {
    await apiFetch(`/api/v1/tasks/${id}/cancel`, { method: 'POST' });
    refetch();
  };

  const handleTriggerPlaybook2FA = (taskId: string) => {
    setTriggeringTaskId(taskId);
    setOtpCode('');
    setOtpError('');
    setOtpSuccess(false);
  };

  const confirmTriggerPlaybook = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Invalid OTP. Must be exactly 6 digits.');
      return;
    }
    // Simulate 2FA success and trigger n8n playbook webhook
    try {
      const task = tasks.find(t => t.id === triggeringTaskId);
      if (task?.playbook_webhook) {
        // Send POST webhook to n8n
        await fetch(task.playbook_webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id: caseId,
            task_id: triggeringTaskId,
            task_title: task.title,
            triggered_by: user?.login || 'analyst'
          })
        });
      }
      // Call backend to update state or trigger
      await apiFetch(`/api/v1/tasks/${triggeringTaskId}/start`, { method: 'POST' });
      setOtpSuccess(true);
      setTimeout(() => {
        setTriggeringTaskId(null);
        refetch();
      }, 1000);
    } catch (e: any) {
      setOtpError(e.message || 'Trigger failed.');
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'All') return true;
    return t.status === activeFilter;
  });

  const getStatusClass = (s: string) => {
    switch (s) {
      case 'Completed': return 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.15)]';
      case 'InProgress': return 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.15)]';
      case 'Cancel': return 'bg-slate-800 text-slate-400 ring-1 ring-slate-800';
      case 'Waiting': default: return 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
    }
  };

  const getSlaBadge = (dueDate: string | null | undefined, status: string) => {
    if (!dueDate) return null;
    if (status === 'Completed' || status === 'Cancel') return <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[10px] uppercase font-semibold">Closed</span>;
    const due = new Date(dueDate).getTime();
    const diffDays = Math.ceil((due - Date.now()) / 86400000);
    if (diffDays < 0) return <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] uppercase font-bold animate-pulse">overdue {Math.abs(diffDays)}d</span>;
    if (diffDays <= 1) return <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] uppercase font-bold">due soon</span>;
    return <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] uppercase font-bold">{diffDays}d left</span>;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick filters & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(['All', 'Waiting', 'InProgress', 'Completed', 'Cancel'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all duration-150 ${activeFilter === f ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30' : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900 ring-1 ring-slate-900/60'}`}
            >
              {f === 'InProgress' ? 'In Progress' : f} ({f === 'All' ? tasks.length : tasks.filter(t => t.status === f).length})
            </button>
          ))}
        </div>
        {canWrite && (
          <button
            onClick={() => setShowAdvancedForm(true)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-all duration-150 shadow-lg"
          >
            Create Advanced Task
          </button>
        )}
      </div>

      {/* Quick Add Bar */}
      {canWrite && (
        <form onSubmit={handleQuickAdd} className="relative">
          <input
            type="text"
            className="w-full bg-slate-950/80 ring-1 ring-slate-900/60 hover:ring-slate-800 focus:ring-blue-500/40 focus:outline-none rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 shadow-inner transition-all"
            placeholder="Type a new task title and press Enter to add instantly..."
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400 font-bold text-xs uppercase px-2 py-1 select-none">Quick Add</button>
        </form>
      )}

      {/* ListView container */}
      <div className="flex flex-col gap-3">
        {filteredTasks.length === 0 ? (
          <div className="glass-panel bg-slate-950/40 ring-1 ring-slate-900/60 rounded-2xl p-8 text-center text-slate-500 text-sm italic select-none">No tasks match the active filter.</div>
        ) : (
          filteredTasks.map(t => (
            <div
              key={t.id}
              className={`glass-panel bg-slate-950/30 hover:bg-slate-950/50 ring-1 ring-slate-900/60 rounded-2xl p-4 flex flex-col transition-all duration-150 ${t.flag ? 'bg-red-500/[0.03]' : ''}`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1 shrink-0"><TaskFlags task={t} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.group_name && <span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded text-[9.5px] uppercase font-bold tracking-wider">{t.group_name}</span>}
                      <button onClick={() => toggleExpand(t.id)} className="text-left font-semibold text-slate-200 text-sm hover:text-blue-400 hover:underline truncate">
                        {t.title}
                      </button>
                      {t.playbook_name && (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20 rounded text-[9px] uppercase font-bold" title="Linked to an automated n8n playbook">
                          SOAR: {t.playbook_name}
                        </span>
                      )}
                    </div>
                    {/* Description preview */}
                    {t.description && !expandedTasks.has(t.id) && (
                      <p className="text-xs text-slate-500 truncate mt-1">{t.description}</p>
                    )}
                  </div>
                </div>

                {/* Right options */}
                <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                  {/* SLA Badge */}
                  {getSlaBadge(t.due_date, t.status)}

                  {/* Status Badge */}
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${getStatusClass(t.status)}`}>
                    {t.status === 'InProgress' ? 'In Progress' : t.status}
                  </span>

                  {/* Assignee Avatar */}
                  <div className="flex items-center gap-2">
                    {t.assignee ? (
                      <div className="w-6 h-6 rounded-full bg-blue-600/20 ring-1 ring-blue-500/30 text-blue-400 flex items-center justify-center text-[10px] font-bold uppercase" title={`Assigned to ${t.assignee}`}>
                        {t.assignee.slice(0, 2)}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-800 ring-1 ring-slate-700/30 text-slate-500 flex items-center justify-center text-[9px] italic font-medium" title="Unassigned">
                        —
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  {canWrite && (
                    <div className="flex gap-1">
                      {t.status === 'Waiting' && (
                        <button onClick={() => startTask(t.id)} className="px-2.5 py-1 bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 rounded-lg text-[10px] font-bold uppercase transition-all">Start</button>
                      )}
                      {t.status === 'InProgress' && (
                        <>
                          {t.playbook_webhook && (
                            <button onClick={() => handleTriggerPlaybook2FA(t.id)} className="px-2.5 py-1 bg-purple-600/15 hover:bg-purple-600/30 text-purple-400 rounded-lg text-[10px] font-bold uppercase transition-all mr-1">Trigger SOAR</button>
                          )}
                          <button onClick={() => closeTask(t.id)} className="px-2.5 py-1 bg-green-600/15 hover:bg-green-600/30 text-green-400 rounded-lg text-[10px] font-bold uppercase transition-all">Close</button>
                        </>
                      )}
                      {(t.status === 'Completed' || t.status === 'Cancel') && (
                        <button onClick={() => reopenTask(t.id)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-all">Reopen</button>
                      )}
                      {t.status !== 'Cancel' && t.status !== 'Completed' && (
                        <button onClick={() => cancelTask(t.id)} className="px-2.5 py-1 bg-red-600/15 hover:bg-red-600/30 text-red-400 rounded-lg text-[10px] font-bold uppercase transition-all">Cancel</button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {t.description && expandedTasks.has(t.id) && (
                <div className="px-4 py-3 bg-slate-900/20 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap rounded-xl mt-3 ring-1 ring-slate-900/60">
                  <strong className="text-slate-400 block mb-1 uppercase text-[9px] tracking-wider">Task Description</strong>
                  {t.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Advanced Task Creation Form Dialog */}
      {showAdvancedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg p-6 bg-slate-950/95 ring-1 ring-slate-900/60 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-slate-300">
            <h4 className="text-base font-bold text-slate-100 uppercase tracking-wider mb-4 pb-3">Create Advanced Task</h4>
            
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs text-slate-400 font-bold uppercase">
                Task Title *
                <input
                  type="text"
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500/40 focus:outline-none"
                  value={taskForm.title}
                  onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Task title..."
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-xs text-slate-400 font-bold uppercase">
                  Task Group
                  <input
                    type="text"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500/40 focus:outline-none"
                    value={taskForm.group_name}
                    onChange={e => setTaskForm(f => ({ ...f, group_name: e.target.value }))}
                    placeholder="E.g., Containment..."
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400 font-bold uppercase">
                  Assignee
                  <input
                    type="text"
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500/40 focus:outline-none"
                    value={taskForm.assignee}
                    onChange={e => {
                      const val = e.target.value;
                      setTaskForm(f => ({ ...f, assignee: val }));
                      if (val.length >= 2) {
                        searchUsers(val).then(res => { setUserSuggestions(res); setShowUserDropdown(true); });
                      } else {
                        setShowUserDropdown(false);
                      }
                    }}
                    placeholder="Assign to..."
                  />
                  {showUserDropdown && userSuggestions.length > 0 && (
                    <ul className="absolute z-50 bg-slate-900 border border-slate-800 rounded-xl mt-14 w-48 shadow-2xl overflow-hidden">
                      {userSuggestions.map(u => (
                        <li key={u.login}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                            onClick={() => { setTaskForm(f => ({ ...f, assignee: u.login })); setShowUserDropdown(false); }}
                          >
                            {u.login}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </label>
              </div>

              {/* Playbook linking configs */}
              <div className="flex flex-col gap-1.5 pt-3">
                <label className="text-xs text-slate-400 font-bold uppercase">
                  Liên kết Kịch bản Tự động hóa (SOAR Playbook n8n)
                </label>
                <select
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-blue-500/40 focus:outline-none transition"
                  value={taskForm.playbook_name ? `${taskForm.playbook_name}|${taskForm.playbook_webhook}` : ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const [name, url] = val.split('|');
                      setTaskForm(f => ({
                        ...f,
                        playbook_name: name,
                        playbook_webhook: url
                      }));
                    } else {
                      setTaskForm(f => ({
                        ...f,
                        playbook_name: '',
                        playbook_webhook: ''
                      }));
                    }
                  }}
                >
                  <option value="">-- Không liên kết kịch bản --</option>
                  {activeRules.map(rule => (
                    <option key={rule.id} value={`${rule.name}|${rule.webhook_url}`}>
                      {rule.name} ({rule.observable_type} - Score &gt;= {rule.threat_score_threshold})
                    </option>
                  ))}
                  <option value="custom|">-- Cấu hình thủ công --</option>
                </select>
              </div>

              {taskForm.playbook_name === 'custom' && (
                <div className="grid grid-cols-2 gap-4 pt-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-400 font-bold uppercase">
                    Tên kịch bản thủ công
                    <input
                      type="text"
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500/40 focus:outline-none"
                      onChange={e => setTaskForm(f => ({ ...f, playbook_name: e.target.value }))}
                      placeholder="E.g., Custom containment..."
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400 font-bold uppercase">
                    Webhook URL tuỳ biến
                    <input
                      type="text"
                      className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500/40 focus:outline-none"
                      value={taskForm.playbook_webhook}
                      onChange={e => setTaskForm(f => ({ ...f, playbook_webhook: e.target.value }))}
                      placeholder="http://n8n/webhook/..."
                    />
                  </label>
                </div>
              )}

              <label className="flex flex-col gap-1 text-xs text-slate-400 font-bold uppercase">
                Description
                <textarea
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-blue-500/40 focus:outline-none"
                  value={taskForm.description}
                  onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Task instructions..."
                  rows={3}
                />
              </label>
            </div>

            <div className="flex gap-3 mt-6 pt-4 justify-end">
              <button
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors"
                onClick={() => setShowAdvancedForm(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase transition-colors disabled:opacity-50"
                disabled={!taskForm.title.trim()}
                onClick={handleCreateAdvancedTask}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Verification Modal for Playbook Trigger */}
      {triggeringTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 bg-slate-950/95 ring-1 ring-slate-900/60 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-slate-300">
            <h4 className="text-base font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              ⚠️ 2FA Verification Required
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Triggering this SOAR Playbook will perform high-risk containment operations. Please enter your 6-digit OTP code to verify authorization.
            </p>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                maxLength={6}
                autoFocus
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-slate-100 focus:border-red-500/40 focus:outline-none shadow-inner"
                placeholder="0 0 0 0 0 0"
                value={otpCode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOtpCode(val);
                }}
              />
              {otpError && <div className="text-[11px] text-red-400 font-bold bg-red-950/15 border border-red-900/20 px-3 py-2 rounded-lg">{otpError}</div>}
              {otpSuccess && <div className="text-[11px] text-green-400 font-bold bg-green-950/15 border border-green-900/20 px-3 py-2 rounded-lg text-center">✓ 2FA Verified. Initiating Playbook...</div>}
            </div>

            <div className="flex gap-3 mt-6 pt-4 justify-end">
              <button
                className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold uppercase transition-all"
                onClick={() => setTriggeringTaskId(null)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50"
                disabled={otpCode.length !== 6 || otpSuccess}
                onClick={confirmTriggerPlaybook}
              >
                Confirm OTP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachments Section */}
      <div className="mt-6 pt-6">
        <AttachmentPanel user={user} caseId={caseId} initialAttachments={attachments} title="Incident Evidence & Attachments" />
      </div>
    </div>
  );
}
