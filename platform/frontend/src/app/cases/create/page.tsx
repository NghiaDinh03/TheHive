'use client';

/**
 * Create new case page.
 * Mirrors legacy TheHive 4 case creation form.
 * Fields: title, description, severity, TLP, PAP, tags, assignee, case template, start date.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, Save } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';

type UserInfo = { login: string; name: string; permissions?: string[] };
type CaseTemplate = { id: string; name: string; description?: string };
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
  const templates = useQuery({
    queryKey: ['case-templates'],
    queryFn: () => apiFetch<Collection<CaseTemplate>>('/api/v1/case-templates?range=0:100'),
    enabled: !!authedLogin,
  });

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
                            onChange={(e) => setForm((f) => ({ ...f, case_template: e.target.value }))}
                          >
                            <option value="">— No template —</option>
                            {(templates.data?.values ?? []).map((t) => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          <p className="help-block">Optionally apply a case template to pre-fill tasks and custom fields.</p>
                        </div>
                      </div>

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
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="form-group">
                        <label className="col-md-3 control-label">Tags</label>
                        <div className="col-md-9">
                          <input
                            type="text"
                            className="form-control input-sm"
                            placeholder="Comma-separated tags, e.g. phishing, malware"
                            value={form.tags}
                            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                          />
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
