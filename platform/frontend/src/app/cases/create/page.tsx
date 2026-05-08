'use client';

/**
 * Create new case page.
 * Mirrors legacy TheHive 4 case creation form.
 * Fields: title, description, severity, TLP, PAP, tags, assignee, case template, start date.
 * B-UI-6b: Auto-populates severity, TLP, PAP, tags from selected case template.
 * Shows preview of template tasks and custom fields that will be applied.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, ClipboardList, Save, Tag } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';

type UserInfo = { login: string; name: string; permissions?: string[] };
type TemplateTask = { title: string; group_name?: string; description?: string; order_index?: number };
type TemplateCustomField = { field_name: string; field_type?: string; default_value?: string; field_order?: number };
type CaseTemplate = {
  id: string;
  name: string;
  display_name?: string;
  title_prefix?: string;
  description?: string;
  severity?: number;
  tlp?: number;
  pap?: number;
  tags?: string[];
  tasks?: TemplateTask[];
  custom_fields?: TemplateCustomField[];
};
type Collection<T> = { values: T[]; total: number };
type CreatedCase = { id: string; number: number; title: string };

const SEVERITY_OPTIONS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
  { value: 4, label: 'Critical' },
];

const TLP_OPTIONS = [
  { value: 0, label: 'TLP:WHITE' },
  { value: 1, label: 'TLP:GREEN' },
  { value: 2, label: 'TLP:AMBER' },
  { value: 3, label: 'TLP:RED' },
];

const PAP_OPTIONS = [
  { value: 0, label: 'PAP:WHITE' },
  { value: 1, label: 'PAP:GREEN' },
  { value: 2, label: 'PAP:AMBER' },
  { value: 3, label: 'PAP:RED' },
];

export default function CaseCreatePage() {
  const router = useRouter();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CaseTemplate | null>(null);
  const [showTagLibrary, setShowTagLibrary] = useState(false);
  const [tagLibrarySearch, setTagLibrarySearch] = useState('');
  const [customTasks, setCustomTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 2,
    tlp: 2,
    pap: 2,
    tags: '',
    assignee: '',
    case_template: '',
    start_date: '',
    flag: false,
  });

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<UserInfo>('/api/v1/auth/me'), enabled: !!authedLogin });
  const tagLibrary = useQuery({
    queryKey: ['tag-library'],
    queryFn: () => apiFetch<{ values: { name: string }[] }>('/api/v1/tags?range=0:500'),
    enabled: !!authedLogin,
  });
  const templates = useQuery({
    queryKey: ['case-templates'],
    queryFn: () => apiFetch<Collection<CaseTemplate>>('/api/v1/case-templates?range=0:100'),
    enabled: !!authedLogin,
  });

  // Fetch template detail when a template is selected
  const templateDetail = useQuery({
    queryKey: ['case-template-detail', form.case_template],
    queryFn: () => apiFetch<CaseTemplate>(`/api/v1/case-templates/${encodeURIComponent(form.case_template)}`),
    enabled: !!authedLogin && !!form.case_template,
  });

  // Auto-populate form fields when template detail loads
  useEffect(() => {
    const tpl = templateDetail.data;
    if (!tpl) {
      setSelectedTemplate(null);
      return;
    }
    setSelectedTemplate(tpl);

    // Auto-populate severity, TLP, PAP from template
    const updates: Partial<typeof form> = {};
    if (tpl.severity !== undefined && tpl.severity !== null) {
      updates.severity = tpl.severity;
    }
    if (tpl.tlp !== undefined && tpl.tlp !== null) {
      updates.tlp = tpl.tlp;
    }
    if (tpl.pap !== undefined && tpl.pap !== null) {
      updates.pap = tpl.pap;
    }
    // Merge template tags with existing user-entered tags
    if (tpl.tags && tpl.tags.length > 0) {
      const existingTags = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const merged = Array.from(new Set([...existingTags, ...tpl.tags]));
      updates.tags = merged.join(', ');
    }
    // Prepend title prefix if template has one and title is empty
    if (tpl.title_prefix && !form.title) {
      updates.title = tpl.title_prefix;
    }

    if (Object.keys(updates).length > 0) {
      setForm((f) => ({ ...f, ...updates }));
    }
    // Only run when template detail data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateDetail.data]);

  // Clear template preview when template is deselected
  useEffect(() => {
    if (!form.case_template) {
      setSelectedTemplate(null);
    }
  }, [form.case_template]);

  const createCase = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        severity: form.severity,
        tlp: form.tlp,
        pap: form.pap,
        flag: form.flag,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        assignee: form.assignee.trim() || undefined,
        case_template: form.case_template || undefined,
        start_date: form.start_date || undefined,
        tasks: customTasks.length > 0 ? customTasks.map((title, i) => ({ title, order_index: i })) : undefined,
      };
      return apiFetch<CreatedCase>('/api/v1/cases', { method: 'POST', json: payload });
    },
    onSuccess: (data) => {
      router.push(`/cases/${data.id}`);
    },
    onError: (e) => {
      setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setError(null);
    createCase.mutate();
  }

  if (!authedLogin) return null;

  const templateTasks = selectedTemplate?.tasks ?? [];
  const templateCustomFields = selectedTemplate?.custom_fields ?? [];

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>New Case <small>create investigation case</small></h1>
            <ol className="breadcrumb">
              <li>Home</li>
              <li><a href="/investigation?tab=cases">Investigation</a></li>
              <li className="active">New Case</li>
            </ol>
          </section>
          <section className="content">
            <div className="row">
              <div className="col-md-10 col-md-offset-1">
                {error && (
                  <div className="alert alert-danger alert-dismissible">
                    <button type="button" className="close" onClick={() => setError(null)}>×</button>
                    {error}
                  </div>
                )}

                <form className="form-horizontal" onSubmit={handleSubmit}>
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title"><Briefcase size={15} className="mr-1" /> Case details</h3>
                    </div>
                    <div className="box-body">

                      {/* Case template */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Case template</label>
                        <div className="col-md-9">
                          <select
                            className="form-control input-sm"
                            value={form.case_template}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((f) => ({
                                ...f,
                                case_template: val,
                                // Reset to defaults when changing template
                                ...(val ? {} : { severity: 2, tlp: 2, pap: 2, tags: '' }),
                              }));
                            }}
                          >
                            <option value="">— No template —</option>
                            {(templates.data?.values ?? []).map((t) => (
                              <option key={t.id} value={t.name}>{t.display_name || t.name}</option>
                            ))}
                          </select>
                          <p className="help-block">Select a template to auto-fill severity, TLP, PAP, tags, and preview tasks/custom fields.</p>
                        </div>
                      </div>

                      {/* Template preview — tasks and custom fields from template */}
                      {selectedTemplate && (templateTasks.length > 0 || templateCustomFields.length > 0) && (
                        <div className="form-group">
                          <div className="col-md-offset-3 col-md-9">
                            <div className="box box-default collapsed-box" style={{ marginBottom: 0, boxShadow: 'none', border: '1px solid #d2d6de' }}>
                              <div className="box-header with-border" style={{ cursor: 'pointer', padding: '6px 12px' }}
                                onClick={(e) => {
                                  const box = (e.currentTarget as HTMLElement).closest('.box');
                                  box?.classList.toggle('collapsed-box');
                                  const body = box?.querySelector('.box-body');
                                  if (body) (body as HTMLElement).style.display = (body as HTMLElement).style.display === 'none' ? '' : 'none';
                                  const btn = box?.querySelector('.btn-box-tool i');
                                  if (btn) btn.className = btn.className.includes('plus') ? 'fa fa-minus' : 'fa fa-plus';
                                }}
                              >
                                <h3 className="box-title" style={{ fontSize: '0.88rem' }}>
                                  <ClipboardList size={13} className="mr-1" />
                                  Template preview: {selectedTemplate.display_name || selectedTemplate.name}
                                </h3>
                                <div className="box-tools pull-right">
                                  <button type="button" className="btn btn-box-tool"><i className="fa fa-plus" /></button>
                                </div>
                              </div>
                              <div className="box-body" style={{ display: 'none', padding: '8px 12px' }}>
                                {templateTasks.length > 0 && (
                                  <div className="mb-2">
                                    <strong className="text-sm">Tasks ({templateTasks.length}):</strong>
                                    <ul className="list-unstyled ml-2 mt-1">
                                      {templateTasks.map((t, i) => (
                                        <li key={i} className="text-sm">
                                          <span className="text-muted">{i + 1}.</span> {t.title}
                                          {t.group_name && <span className="label label-default ml-1" style={{ fontSize: '0.7rem' }}>{t.group_name}</span>}
                                          {t.description && <div className="text-muted text-xs ml-3">{t.description}</div>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {templateCustomFields.length > 0 && (
                                  <div>
                                    <strong className="text-sm">Custom fields ({templateCustomFields.length}):</strong>
                                    <ul className="list-unstyled ml-2 mt-1">
                                      {templateCustomFields.map((cf, i) => (
                                        <li key={i} className="text-sm">
                                          <Tag size={11} className="mr-1" />
                                          {cf.field_name}
                                          {cf.field_type && <span className="label label-info ml-1" style={{ fontSize: '0.65rem' }}>{cf.field_type}</span>}
                                          {cf.default_value && <span className="text-muted ml-1">= {cf.default_value}</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Title */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">
                          Title <span className="text-danger">*</span>
                        </label>
                        <div className="col-md-9">
                          <input
                            type="text"
                            className="form-control input-sm"
                            placeholder="Case title"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Description</label>
                        <div className="col-md-9">
                          <textarea
                            className="form-control"
                            rows={5}
                            placeholder="Case description (Markdown supported)"
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Severity */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Severity</label>
                        <div className="col-md-9">
                          <select
                            className="form-control input-sm"
                            value={form.severity}
                            onChange={(e) => setForm((f) => ({ ...f, severity: Number(e.target.value) }))}
                          >
                            {SEVERITY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {selectedTemplate?.severity !== undefined && (
                            <p className="help-block text-info" style={{ fontSize: '0.78rem' }}>
                              Auto-filled from template ({SEVERITY_OPTIONS.find((o) => o.value === selectedTemplate.severity)?.label})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* TLP */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">TLP</label>
                        <div className="col-md-9">
                          <select
                            className="form-control input-sm"
                            value={form.tlp}
                            onChange={(e) => setForm((f) => ({ ...f, tlp: Number(e.target.value) }))}
                          >
                            {TLP_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {selectedTemplate?.tlp !== undefined && (
                            <p className="help-block text-info" style={{ fontSize: '0.78rem' }}>
                              Auto-filled from template ({TLP_OPTIONS.find((o) => o.value === selectedTemplate.tlp)?.label})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* PAP */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">PAP</label>
                        <div className="col-md-9">
                          <select
                            className="form-control input-sm"
                            value={form.pap}
                            onChange={(e) => setForm((f) => ({ ...f, pap: Number(e.target.value) }))}
                          >
                            {PAP_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {selectedTemplate?.pap !== undefined && (
                            <p className="help-block text-info" style={{ fontSize: '0.78rem' }}>
                              Auto-filled from template ({PAP_OPTIONS.find((o) => o.value === selectedTemplate.pap)?.label})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Tags</label>
                        <div className="col-md-9">
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control input-sm"
                              placeholder="Comma-separated tags, e.g. phishing, malware"
                              value={form.tags}
                              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                            />
                            <span className="input-group-btn vtop">
                              <button type="button" className="btn btn-block btn-sm btn-primary" onClick={() => setShowTagLibrary(!showTagLibrary)} title="Add tag from library">
                                <span className="fa fa-plus" />
                              </button>
                            </span>
                          </div>
                          {selectedTemplate?.tags && selectedTemplate.tags.length > 0 && (
                            <p className="help-block text-info" style={{ fontSize: '0.78rem' }}>
                              Template tags merged: {selectedTemplate.tags.join(', ')}
                            </p>
                          )}
                          {showTagLibrary && (
                            <div className="tag-library-dropdown" style={{ position: 'absolute', zIndex: 100, background: '#fff', border: '1px solid #d2d6de', borderRadius: 4, maxHeight: 200, overflowY: 'auto', width: 'calc(100% - 30px)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', marginTop: 4 }}>
                              <div style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
                                <input type="text" className="form-control input-sm" placeholder="Search tags..." value={tagLibrarySearch} onChange={e => setTagLibrarySearch(e.target.value)} autoFocus />
                              </div>
                              {(tagLibrary.data?.values ?? [])
                                .filter(t => !tagLibrarySearch || t.name.toLowerCase().includes(tagLibrarySearch.toLowerCase()))
                                .filter(t => !(form.tags || '').split(',').map(s => s.trim()).includes(t.name))
                                .slice(0, 50)
                                .map(t => (
                                  <div key={t.name} style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem' }}
                                    onClick={() => {
                                      const existing = form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
                                      setForm(f => ({ ...f, tags: [...existing, t.name].join(', ') }));
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                                  >
                                    <Tag size={11} className="mr-1" />{t.name}
                                  </div>
                                ))
                              }
                              {(!tagLibrary.data?.values || tagLibrary.data.values.length === 0) && <div style={{ padding: '8px', color: '#999', fontSize: '0.85rem' }}>No tags available</div>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Assignee */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Assignee</label>
                        <div className="col-md-9">
                          <input
                            type="text"
                            className="form-control input-sm"
                            placeholder="Login of assignee (optional)"
                            value={form.assignee}
                            onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Start date */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Start date</label>
                        <div className="col-md-9">
                          <input
                            type="datetime-local"
                            className="form-control input-sm"
                            value={form.start_date}
                            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Flag */}
                      <div className="form-group">
                        <div className="col-md-offset-3 col-md-9">
                          <div className="checkbox">
                            <label>
                              <input
                                type="checkbox"
                                checked={form.flag}
                                onChange={(e) => setForm((f) => ({ ...f, flag: e.target.checked }))}
                              />
                              {' '}Flag this case (mark as important)
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Case tasks — mirrors legacy case.tasks in creation */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Case tasks</label>
                        <div className="col-md-9">
                          {selectedTemplate && templateTasks.length > 0 && (
                            <p className="help-block text-info" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
                              Template tasks will be created automatically. Add additional tasks below.
                            </p>
                          )}
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Task title"
                              value={newTaskInput}
                              onChange={e => setNewTaskInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && newTaskInput.trim()) {
                                  e.preventDefault();
                                  setCustomTasks(prev => [...prev, newTaskInput.trim()]);
                                  setNewTaskInput('');
                                }
                              }}
                            />
                            <span className="input-group-btn">
                              <button type="button" className="btn btn-primary" disabled={!newTaskInput.trim()}
                                onClick={() => { setCustomTasks(prev => [...prev, newTaskInput.trim()]); setNewTaskInput(''); }}>
                                Add task
                              </button>
                            </span>
                          </div>
                          {customTasks.length === 0 && !selectedTemplate && (
                            <div className="empty-message" style={{ marginTop: 8 }}>No tasks have been specified</div>
                          )}
                          {customTasks.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              {customTasks.map((task, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <a style={{ cursor: 'pointer' }} onClick={() => setCustomTasks(prev => prev.filter((_, idx) => idx !== i))}>
                                    <i className="fa fa-times text-danger" />
                                  </a>
                                  <span>{task}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                    <div className="box-footer">
                      <button
                        type="button"
                        className="btn btn-default"
                        onClick={() => router.back()}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary pull-right"
                        disabled={createCase.isPending}
                      >
                        <Save size={14} className="mr-1" />
                        {createCase.isPending ? 'Creating…' : 'Create case'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
