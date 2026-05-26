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
import { Activity, Eye, Link, Share2, Star, StarOff, ToggleLeft, ToggleRight, Trash2, Unlink } from '@/components/FaIcon';
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
type SimilarObservable = {
  id: string; data_type: string; data: string; message: string;
  tlp: number; ioc: boolean; sighted: boolean; ignore_similarity?: boolean;
  tags: string[]; case_id: string; case_number: number; case_title: string;
  start_date?: string; created_at: string;
};
type ObservableDetail = { observable: ObservableItem };

const TABS = ['Summary', 'Sharing', 'Attachments'] as const;
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
  const [editTags, setEditTags] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editingMeta, setEditingMeta] = useState(false);
  const [syncingMISP, setSyncingMISP] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const triggerMISPSync = async () => {
    if (!obs?.case_id) return;
    setSyncingMISP(true);
    setSyncMessage(null);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/cases/${obs.case_id}/sync-misp`, { method: 'POST' });
      setSyncMessage(res.message || 'Successfully triggered IOC synchronization to MISP!');
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err: any) {
      setSyncMessage(err.message || 'Failed to trigger synchronization!');
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setSyncingMISP(false);
    }
  };

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
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

  // Similar observables — mirrors legacy observable detail "Links" panel
  const similar = useQuery({
    queryKey: ['similar-observables', params.id],
    queryFn: () => apiFetch<{ values: SimilarObservable[]; total: number }>(`/api/v1/observables/${params.id}/similar`),
    enabled: !!authedLogin && !!params.id && !(obs?.ignore_similarity),
  });
  const similarObs = similar.data?.values ?? [];

  useEffect(() => {
    if (obs) {
      setEditTags(obs.tags?.join(', ') ?? '');
      setEditMessage(obs.message ?? '');
    }
  }, [obs]);

  const refetch = () => void detail.refetch();

  const canEdit = canUse(me.data, 'observableUpdate');
  const canDelete = canUse(me.data, 'observableDelete');

  const patchObs = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch(`/api/v1/observables/${params.id}`, { method: 'PATCH', json: patch }),
    onSuccess: refetch,
  });

  const deleteObs = useMutation({
    mutationFn: () => apiFetch(`/api/v1/observables/${params.id}`, { method: 'DELETE' }),
    onSuccess: () => router.replace('/investigation?tab=observables'),
  });

  const actionError = [patchObs, deleteObs]
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
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 mb-2 flex items-center gap-2">
                {obs?.data_type && <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-700/50 rounded text-xs uppercase tracking-wider">{obs.data_type}</span>}
                <span className="truncate max-w-[400px]">{obs?.full_data || obs?.data || 'Observable'}</span>
                <span className="text-slate-400 font-normal text-lg">detail</span>
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Home</span>
                <span className="text-slate-600">/</span>
                <span>Investigation</span>
                <span className="text-slate-600">/</span>
                <span>Observables</span>
                <span className="text-slate-600">/</span>
                <span className="text-blue-400 truncate max-w-[200px]">{obs?.data || params.id}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            {actionError && <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg text-sm">{actionError}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main content */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                {/* Observable banner */}
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-tlp-${obs?.tlp ?? 2}`} />
                  <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 pl-8">
                    <h3 className="font-semibold text-slate-100 flex items-center gap-2 truncate max-w-[70%]">
                      <Eye size={16} className="text-blue-500" />
                      {obs?.data_type && <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded text-[10px] uppercase tracking-wider border border-blue-700/50">{obs.data_type}</span>}
                      <span className="truncate">{obs?.full_data || obs?.data || '…'}</span>
                    </h3>
                    <div className="flex items-center gap-3 shrink-0">
                      <ObservableFlags observable={{ ioc: obs?.ioc, sighted: obs?.sighted, ignore_similarity: obs?.ignore_similarity }} />
                      <Tlp value={obs?.tlp ?? 2} format="static" />
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 text-sm bg-slate-800 pl-8">
                    <div className="flex flex-col gap-1"><span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Type</span><span className="text-slate-200">{obs?.data_type || '—'}</span></div>
                    <div className="flex flex-col gap-1"><span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">TLP</span><span className={`text-tlp-${obs?.tlp ?? 2} font-medium`}>{tlpLabel(obs?.tlp ?? 2)}</span></div>
                    <div className="flex flex-col gap-1"><span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">IOC</span><span className={obs?.ioc ? 'text-red-400 font-medium' : 'text-slate-400'}>{obs?.ioc ? 'Yes' : 'No'}</span></div>
                    <div className="flex flex-col gap-1"><span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Sighted</span><span className={obs?.sighted ? 'text-blue-400 font-medium' : 'text-slate-400'}>{obs?.sighted ? 'Yes' : 'No'}</span></div>
                    <div className="flex flex-col gap-1"><span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Added</span><span className="text-slate-200">{obs ? new Date(obs.created_at).toLocaleString() : '—'}</span></div>
                    <div className="flex flex-col gap-1"><span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">By</span><span className="text-slate-200">{obs?.created_by || '—'}</span></div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                  <div className="flex overflow-x-auto border-b border-slate-700 bg-slate-900/30 custom-scrollbar">
                    {TABS.map(tab => (
                      <button
                        key={tab}
                        type="button"
                        className={`px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                          activeTab === tab
                            ? 'border-blue-500 text-blue-400 bg-slate-800'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800/50'
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {/* ── Summary tab ── */}
                    {activeTab === 'Summary' && (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-blue-500 font-medium text-lg">Basic Information</h4>
                          <div className="flex gap-2">
                            {canEdit && (
                              <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded-md text-sm transition-colors shadow-sm" onClick={() => setEditingMeta(v => !v)}>
                                {editingMeta ? 'Cancel' : 'Edit Meta'}
                              </button>
                            )}
                            {canDelete && (
                              <button className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-700/50 rounded-md text-sm transition-colors shadow-sm flex items-center gap-1.5" disabled={deleteObs.isPending} onClick={() => deleteObs.mutate()}>
                                <Trash2 size={14} /> Delete
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">TLP</span>
                            <div>
                              {canEdit ? (
                                <button className="hover:opacity-80 transition-opacity focus:outline-none" onClick={() => patchObs.mutate({ tlp: ((obs?.tlp ?? 2) + 1) % 4 })}>
                                  <Tlp value={obs?.tlp ?? 2} format="static" />
                                </button>
                              ) : (
                                <Tlp value={obs?.tlp ?? 2} format="static" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Data type</span>
                            <div><span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded text-[10px] uppercase tracking-wider border border-blue-700/50">{obs?.data_type || '—'}</span></div>
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Data</span>
                            <div className="font-mono text-slate-200 break-all bg-slate-900/50 p-3 rounded border border-slate-700/50">{obs?.data || '—'}</div>
                          </div>

                          {obs?.full_data && (
                            <div className="flex flex-col gap-1 md:col-span-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Full data</span>
                              <div className="font-mono text-slate-400 break-all bg-slate-900/50 p-3 rounded border border-slate-700/50">{obs.full_data}</div>
                            </div>
                          )}

                          {obs?.data_hash && (
                            <div className="flex flex-col gap-1 md:col-span-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Hash</span>
                              <div className="font-mono text-slate-300">{obs.data_hash}</div>
                            </div>
                          )}

                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Date added</span>
                            <span className="text-slate-200">{obs ? new Date(obs.created_at).toLocaleString() : '—'}</span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Is IOC</span>
                            <div>
                              {canEdit ? (
                                <button className="hover:opacity-80 focus:outline-none flex items-center gap-2" title="Toggle IOC" onClick={() => toggleField('ioc')}>
                                  {obs?.ioc ? <Star size={18} className="text-red-500" /> : <StarOff size={18} className="text-slate-500" />}
                                  <span className={obs?.ioc ? 'text-red-400' : 'text-slate-400'}>{obs?.ioc ? 'Yes' : 'No'}</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {obs?.ioc ? <Star size={18} className="text-red-500" /> : <StarOff size={18} className="text-slate-500" />}
                                  <span className={obs?.ioc ? 'text-red-400' : 'text-slate-400'}>{obs?.ioc ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Has been sighted</span>
                            <div>
                              {canEdit ? (
                                <button className="hover:opacity-80 focus:outline-none flex items-center gap-2" title="Toggle sighted" onClick={() => toggleField('sighted')}>
                                  {obs?.sighted ? <ToggleRight size={22} className="text-blue-500" /> : <ToggleLeft size={22} className="text-slate-500" />}
                                  <span className={obs?.sighted ? 'text-blue-400' : 'text-slate-400'}>{obs?.sighted ? 'Yes' : 'No'}</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {obs?.sighted ? <ToggleRight size={22} className="text-blue-500" /> : <ToggleLeft size={22} className="text-slate-500" />}
                                  <span className={obs?.sighted ? 'text-blue-400' : 'text-slate-400'}>{obs?.sighted ? 'Yes' : 'No'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Ignored for similarity</span>
                            <div>
                              {canEdit ? (
                                <button className="hover:opacity-80 focus:outline-none flex items-center gap-2" title="Toggle ignore similarity" onClick={() => toggleField('ignore_similarity')}>
                                  {obs?.ignore_similarity ? <Unlink size={16} className="text-yellow-500" /> : <Link size={16} className="text-slate-500" />}
                                  <span className={obs?.ignore_similarity ? 'text-yellow-400' : 'text-slate-400'}>{obs?.ignore_similarity ? 'Ignored' : 'Not ignored'}</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {obs?.ignore_similarity ? <Unlink size={16} className="text-yellow-500" /> : <Link size={16} className="text-slate-500" />}
                                  <span className={obs?.ignore_similarity ? 'text-yellow-400' : 'text-slate-400'}>{obs?.ignore_similarity ? 'Ignored' : 'Not ignored'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Tags</span>
                            <div>
                              {editingMeta ? (
                                <input className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full md:w-1/2" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2" />
                              ) : (
                                <TagList data={obs?.tags ?? []} />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Message</span>
                            <div>
                              {editingMeta ? (
                                <textarea className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full" rows={3} value={editMessage} onChange={e => setEditMessage(e.target.value)} />
                              ) : (
                                <span className="text-slate-300 whitespace-pre-wrap">{obs?.message || <em className="text-slate-500 not-italic">No message</em>}</span>
                              )}
                            </div>
                          </div>

                          {editingMeta && (
                            <div className="flex gap-2 md:col-span-2">
                              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50" disabled={patchObs.isPending} onClick={saveMeta}>Save</button>
                              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors shadow-sm" onClick={() => setEditingMeta(false)}>Cancel</button>
                            </div>
                          )}

                          {obs?.attachment_id && (
                            <div className="flex flex-col gap-1 md:col-span-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Attachment ID</span>
                              <span className="font-mono text-slate-300">{obs.attachment_id}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}


                    {/* ── Sharing tab ── */}
                    {activeTab === 'Sharing' && (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
                            <Share2 size={16} className="text-blue-500" />
                            <h3 className="text-slate-200 font-medium">Observable sharing</h3>
                          </div>
                          <div className="p-5">
                            <p className="text-slate-400 text-sm mb-6 bg-slate-800/50 p-3 rounded border border-slate-700/50">
                              Observable sharing follows the parent case sharing rules.
                              {obs?.case_id && (
                                <> See <a href={`/cases/${obs.case_id}`} className="text-blue-400 hover:text-blue-300 hover:underline">case shares</a> to manage access.</>
                              )}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Case ID</span>
                                <span>{obs?.case_id ? <a href={`/cases/${obs.case_id}`} className="text-blue-400 hover:underline">{obs.case_id}</a> : <span className="text-slate-500">—</span>}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Alert ID</span>
                                <span>{obs?.alert_id ? <span className="text-slate-200">{obs.alert_id}</span> : <span className="text-slate-500">—</span>}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Attachments tab ── */}
                    {activeTab === 'Attachments' && (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <AttachmentPanel user={me.data} observableId={params.id} title="Observable attachments" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Side panel */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl p-5 shadow-lg sticky top-6">
                  <h3 className="text-slate-100 font-semibold mb-4 pb-2 border-b border-slate-700 flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" /> Flags &amp; tags
                  </h3>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${obs?.ioc ? 'bg-red-900/20 border-red-700/50 text-red-400 hover:bg-red-900/40' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                      disabled={!canEdit}
                      onClick={() => toggleField('ioc')}
                    >
                      <span className="flex items-center gap-2">{obs?.ioc ? <Star size={14} /> : <StarOff size={14} />} {obs?.ioc ? 'IOC' : 'Not IOC'}</span>
                      {obs?.ioc && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                    </button>
                    
                    <button
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${obs?.sighted ? 'bg-blue-900/20 border-blue-700/50 text-blue-400 hover:bg-blue-900/40' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                      disabled={!canEdit}
                      onClick={() => toggleField('sighted')}
                    >
                      <span className="flex items-center gap-2">{obs?.sighted ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} {obs?.sighted ? 'Sighted' : 'Not sighted'}</span>
                      {obs?.sighted && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                    </button>

                    <button
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${obs?.ignore_similarity ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/40' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                      disabled={!canEdit}
                      onClick={() => toggleField('ignore_similarity')}
                    >
                      <span className="flex items-center gap-2">{obs?.ignore_similarity ? <Unlink size={14} /> : <Link size={14} />} {obs?.ignore_similarity ? 'Ignore similarity' : 'Similarity on'}</span>
                    </button>

                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-blue-700/50 bg-blue-950/20 text-blue-400 hover:bg-blue-900/40 text-sm transition-colors mt-2"
                      disabled={syncingMISP || !obs?.case_id}
                      onClick={triggerMISPSync}
                    >
                      <span className="flex items-center gap-2">
                        <Activity size={14} className={syncingMISP ? 'animate-spin' : ''} /> 
                        {syncingMISP ? 'Syncing...' : 'MISP Sync'}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-blue-900/50 rounded border border-blue-700/30">Manual</span>
                    </button>
                    {syncMessage && (
                      <div className="text-[11px] p-2 bg-slate-900/85 rounded border border-blue-700/40 text-blue-300 animate-pulse mt-1">
                        {syncMessage}
                      </div>
                    )}

                    <div className="h-px bg-slate-700 my-2" />
                    
                    <div className="flex flex-col gap-2">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">TLP</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map(t => (
                          <button 
                            key={t}
                            onClick={() => canEdit && patchObs.mutate({ tlp: t })}
                            disabled={!canEdit}
                            className={`flex-1 h-2 rounded-full ${t === 0 ? 'bg-white' : t === 1 ? 'bg-green-500' : t === 2 ? 'bg-amber-500' : 'bg-red-500'} ${obs?.tlp === t ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-slate-400' : 'opacity-40 hover:opacity-80'} transition-all`}
                            title={`TLP: ${tlpLabel(t)}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-slate-700 my-1" />
                    
                    <div className="flex flex-col gap-2">
                      <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold flex justify-between items-center">
                        Tags 
                        {canEdit && <span className="text-[10px] text-blue-400 lowercase cursor-pointer" onClick={() => { setActiveTab('Summary'); setEditingMeta(true); }}>edit</span>}
                      </span>
                      <TagList data={obs?.tags ?? []} />
                    </div>
                  </div>
                </div>

                {/* Similar Observables Links */}
                {!obs?.ignore_similarity && (
                  <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                    <div className="px-5 py-3 border-b border-slate-700 bg-slate-900/50 flex items-center gap-2">
                      <Link size={14} className="text-blue-500" />
                      <h3 className="text-slate-200 font-medium text-sm">Similar Links</h3>
                    </div>
                    <div className="p-4">
                      {similar.isLoading && <div className="text-slate-500 text-sm flex items-center gap-2"><i className="fa fa-spinner fa-spin"></i> Loading…</div>}
                      {!similar.isLoading && similarObs.length === 0 && (
                        <div className="text-slate-500 text-sm text-center py-2 border border-dashed border-slate-700 rounded bg-slate-800/50">Unique observable</div>
                      )}
                      {similarObs.length > 0 && (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs text-slate-400">Seen in <strong className="text-slate-200">{similarObs.length}</strong> other case(s)</p>
                          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {similarObs.map(a => (
                              <div key={a.id} className="bg-slate-900/50 border border-slate-700 rounded p-2 text-xs hover:border-blue-500/50 hover:bg-slate-800 cursor-pointer transition-colors" onClick={() => router.push(`/observables/${a.id}`)}>
                                <div className="flex justify-between items-start mb-1">
                                  <a href={`/cases/${a.case_id}`} className="font-medium text-blue-400 hover:text-blue-300 truncate" onClick={e => e.stopPropagation()}>#{String(a.case_number).padStart(7, '0')}</a>
                                  <span className="text-slate-500 shrink-0 ml-2">{new Date(a.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="text-slate-300 truncate mb-1.5">{a.case_title}</div>
                                <div className="flex items-center gap-1.5">
                                  {a.ioc && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="IOC"></span>}
                                  {a.sighted && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Sighted"></span>}
                                  {a.ignore_similarity && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Ignored"></span>}
                                  {!a.ioc && !a.sighted && !a.ignore_similarity && <span className="text-slate-500 text-[10px]">No flags</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
