'use client';

/**
 * Knowledge base pages list.
 * Mirrors legacy TheHive 4 pages/wiki feature.
 * Lists pages, allows create/edit/delete with markdown content.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, FileText, Plus, Save, Trash2 } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';
import { canUse } from '@/lib/permissions';

type UserInfo = { login: string; name: string; permissions?: string[] };
type Page = {
  id: string;
  title: string;
  content: string;
  category?: string;
  order?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
type Collection<T> = { values: T[]; total: number };

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

export default function PagesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [selected, setSelected] = useState<Page | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '', order: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<UserInfo>('/api/v1/auth/me'), enabled: !!authedLogin });
  const pages = useQuery({
    queryKey: ['pages'],
    queryFn: () => apiFetch<Collection<Page>>('/api/v1/pages?range=0:100&sort=order:ASC'),
    enabled: !!authedLogin,
  });

  const canManage = canUse(me.data, 'pageManage');

  function reportSuccess(msg: string) { setError(null); setMessage(msg); }
  function reportError(e: unknown) { setMessage(null); setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e)); }

  const createPage = useMutation({
    mutationFn: () => apiFetch<Page>('/api/v1/pages', { method: 'POST', json: { title: form.title.trim(), content: form.content, category: form.category.trim() || undefined, order: form.order } }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['pages'] });
      reportSuccess('Page created.');
      setCreating(false);
      setSelected(data);
      setForm({ title: '', content: '', category: '', order: 0 });
    },
    onError: reportError,
  });

  const updatePage = useMutation({
    mutationFn: () => apiFetch<Page>(`/api/v1/pages/${selected!.id}`, { method: 'PATCH', json: { title: form.title.trim(), content: form.content, category: form.category.trim() || undefined, order: form.order } }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['pages'] });
      reportSuccess('Page updated.');
      setEditing(false);
      setSelected(data);
    },
    onError: reportError,
  });

  const deletePage = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/pages/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages'] });
      reportSuccess('Page deleted.');
      setSelected(null);
    },
    onError: reportError,
  });

  function startCreate() {
    setCreating(true);
    setEditing(false);
    setSelected(null);
    setForm({ title: '', content: '', category: '', order: 0 });
  }

  function startEdit(page: Page) {
    setEditing(true);
    setCreating(false);
    setForm({ title: page.title, content: page.content, category: page.category ?? '', order: page.order ?? 0 });
  }

  function submitForm(e: FormEvent) {
    e.preventDefault();
    if (creating) createPage.mutate();
    else if (editing) updatePage.mutate();
  }

  if (!authedLogin) return null;

  const items = pages.data?.values ?? [];

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Knowledge Base <small>pages &amp; wiki</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Pages</li></ol>
          </section>
          <section className="content">
            {message && <div className="alert alert-success alert-dismissible"><button type="button" className="close" onClick={() => setMessage(null)}>×</button>{message}</div>}
            {error && <div className="alert alert-danger alert-dismissible"><button type="button" className="close" onClick={() => setError(null)}>×</button>{error}</div>}

            <div className="row">
              {/* Page list */}
              <div className="col-md-4">
                <div className="box">
                  <div className="box-header with-border">
                    <h3 className="box-title"><FileText size={14} className="mr-1" /> Pages</h3>
                    {canManage && (
                      <div className="box-tools pull-right">
                        <button type="button" className="btn btn-primary btn-xs" onClick={startCreate}>
                          <Plus size={12} className="mr-1" /> New page
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="box-body p-0">
                    {pages.isLoading && <div className="thehive-empty">Loading…</div>}
                    {!pages.isLoading && items.length === 0 && (
                      <div className="thehive-empty">No pages yet. {canManage && 'Create the first one.'}</div>
                    )}
                    {items.length > 0 && (
                      <ul className="nav nav-stacked">
                        {items.map((p) => (
                          <li key={p.id} className={selected?.id === p.id ? 'active' : ''}>
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); setSelected(p); setEditing(false); setCreating(false); }}
                              className="flex items-start gap-2"
                            >
                              <FileText size={13} className="mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{p.title}</div>
                                {p.category && <div className="text-xs text-muted">{p.category}</div>}
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Page detail / editor */}
              <div className="col-md-8">
                {(creating || editing) && (
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title">{creating ? 'New page' : `Edit: ${selected?.title}`}</h3>
                    </div>
                    <form onSubmit={submitForm}>
                      <div className="box-body">
                        <div className="form-group">
                          <label className="control-label">Title <span className="text-danger">*</span></label>
                          <input type="text" className="form-control input-sm" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                        </div>
                        <div className="form-group">
                          <label className="control-label">Category</label>
                          <input type="text" className="form-control input-sm" placeholder="e.g. Procedures, References…" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="control-label">Order</label>
                          <input type="number" className="form-control input-sm" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
                        </div>
                        <div className="form-group">
                          <label className="control-label">Content (Markdown)</label>
                          <textarea
                            className="form-control"
                            rows={16}
                            value={form.content}
                            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                            placeholder="Write page content in Markdown…"
                          />
                        </div>
                      </div>
                      <div className="box-footer">
                        <button type="button" className="btn btn-default" onClick={() => { setCreating(false); setEditing(false); }}>Cancel</button>
                        <button type="submit" className="btn btn-primary pull-right" disabled={createPage.isPending || updatePage.isPending}>
                          <Save size={13} className="mr-1" />
                          {createPage.isPending || updatePage.isPending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {selected && !editing && !creating && (
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title">{selected.title}</h3>
                      {canManage && (
                        <div className="box-tools pull-right flex gap-2">
                          <button type="button" className="btn btn-default btn-xs" onClick={() => startEdit(selected)}>
                            <Edit2 size={12} className="mr-1" /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => { if (window.confirm('Delete this page?')) deletePage.mutate(selected.id); }}
                          >
                            <Trash2 size={12} className="mr-1" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="box-body">
                      {selected.category && <p className="text-muted text-sm mb-2">Category: {selected.category}</p>}
                      <p className="text-muted text-xs mb-3">By {selected.created_by} · Created {fmt(selected.created_at)} · Updated {fmt(selected.updated_at)}</p>
                      <div className="page-content" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>
                        {selected.content || <span className="text-muted">No content.</span>}
                      </div>
                    </div>
                  </div>
                )}

                {!selected && !creating && (
                  <div className="box">
                    <div className="box-body">
                      <div className="thehive-empty">Select a page from the list to view it, or create a new one.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
