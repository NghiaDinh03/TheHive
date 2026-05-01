'use client';

/**
 * Admin → Analyzer report templates.
 * Mirrors legacy `frontend/app/views/partials/admin/analyzer-templates.html`,
 * `analyzer-template-dialog.html`, `analyzer-template-import.html`, `analyzer-template-delete.html`.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, FileCode2, Plus, Search, Trash2, Upload } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type Template = {
  id?: string;
  analyzer_id: string;
  report_type: 'short' | 'long';
  content: string;
  updated_at?: string;
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function fmt(v?: string) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

export default function AnalyzerTemplatesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ['admin-analyzer-templates'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/admin/analyzer-templates');
        return normalizeList<Template>(data as never);
      } catch {
        return [] as Template[];
      }
    },
  });

  const upsert = useMutation({
    mutationFn: (payload: Template) =>
      apiFetch('/api/v1/admin/analyzer-templates', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-analyzer-templates'] });
      setEditing(null);
      setCreating(false);
      setMessage('Template saved.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: ({ analyzer_id, report_type }: { analyzer_id: string; report_type: string }) =>
      apiFetch(
        `/api/v1/admin/analyzer-templates/${encodeURIComponent(analyzer_id)}/${encodeURIComponent(report_type)}`,
        { method: 'DELETE' },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-analyzer-templates'] });
      setMessage('Template removed.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Delete failed'),
  });

  const importMut = useMutation({
    mutationFn: (importedTemplates: Template[]) =>
      apiFetch('/api/v1/admin/analyzer-templates/import', { method: 'POST', json: { templates: importedTemplates } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-analyzer-templates'] });
      setImporting(false);
      setMessage('Templates imported.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Import failed'),
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (templates.data ?? []).filter(
      (t) => !q || t.analyzer_id.toLowerCase().includes(q) || t.report_type.toLowerCase().includes(q),
    );
  }, [templates.data, filter]);

  return (
    <AdminShell title="Analyzer templates" small="report template management">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">
            <FileCode2 size={14} /> List of analyzer templates ({filtered.length} of {templates.data?.length ?? 0})
          </h3>
          {/* Toolbar — mirrors analyzer-templates.html toolbar */}
          <div className="box-tools pull-right">
            <button className="btn btn-sm btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus size={13} /> Add template
            </button>
            <button className="btn btn-sm btn-default ml-xs" onClick={() => setImporting(true)}>
              <Upload size={13} /> Import
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="box-body filter-panel">
          <div className="filter-grid">
            <label className="filter-control">
              <span>Search</span>
              <div className="relative">
                <Search size={13} className="thehive-input-icon" />
                <input
                  className="thehive-input thehive-input-with-icon py-1.5"
                  placeholder="Analyzer ID or report type"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </label>
          </div>
        </div>

        <div className="box-body no-padding">
          {templates.isLoading && <div className="empty-message">Loading analyzer templates…</div>}
          {!templates.isLoading && filtered.length === 0 && (
            <div className="empty-message">
              {filter ? 'No templates match your search.' : 'No analyzer templates defined.'}
            </div>
          )}
          {filtered.length > 0 && (
            <table className="table table-striped case-list">
              <thead>
                <tr>
                  <th>Analyzer ID</th>
                  <th style={{ width: 100 }}>Report type</th>
                  <th style={{ width: 300 }}>Content preview</th>
                  <th style={{ width: 120 }}>Updated</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={`${t.analyzer_id}-${t.report_type}`}>
                    <td>
                      <strong>{t.analyzer_id}</strong>
                    </td>
                    <td>
                      <span className={`label ${t.report_type === 'short' ? 'label-info' : 'label-default'}`}>
                        {t.report_type}
                      </span>
                    </td>
                    <td>
                      <code className="text-muted" style={{ fontSize: '0.8em' }}>
                        {t.content ? t.content.slice(0, 120) + (t.content.length > 120 ? '…' : '') : <em>Empty</em>}
                      </code>
                    </td>
                    <td>{fmt(t.updated_at)}</td>
                    <td className="text-right nowrap">
                      <button
                        className="btn btn-xs btn-default mr-xs"
                        onClick={() => { setEditing(t); setCreating(false); }}
                        title="Edit template"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={() => {
                          if (confirm(`Delete template for "${t.analyzer_id}" (${t.report_type})?`))
                            remove.mutate({ analyzer_id: t.analyzer_id, report_type: t.report_type });
                        }}
                        title="Delete template"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit modal — mirrors analyzer-template-dialog.html */}
      {(creating || editing) && (
        <TemplateModal
          template={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => upsert.mutate(payload)}
          saving={upsert.isPending}
        />
      )}

      {/* Import modal — mirrors analyzer-template-import.html */}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImport={(importedTemplates) => importMut.mutate(importedTemplates)}
          importing={importMut.isPending}
        />
      )}
    </AdminShell>
  );
}

function TemplateModal({ template, onClose, onSave, saving }: {
  template: Template | null;
  onClose: () => void;
  onSave: (payload: Template) => void;
  saving: boolean;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({
      analyzer_id: fd.get('analyzer_id') as string,
      report_type: fd.get('report_type') as 'short' | 'long',
      content: fd.get('content') as string,
    });
  }

  return (
    <div className="modal-backdrop-inline">
      <div className="modal-dialog-inline modal-lg">
        <div className="box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title">
              <FileCode2 size={14} /> {template ? `Edit template: ${template.analyzer_id}` : 'Create analyzer template'}
            </h3>
            <button className="close pull-right" onClick={onClose}>×</button>
          </div>
          <form onSubmit={submit}>
            <div className="box-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Analyzer ID</label>
                    <input
                      name="analyzer_id"
                      className="form-control"
                      defaultValue={template?.analyzer_id ?? ''}
                      required
                      placeholder="e.g. Abuse_Finder_2_0"
                      readOnly={!!template}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Report type</label>
                    <select name="report_type" className="form-control" defaultValue={template?.report_type ?? 'short'}>
                      <option value="short">short</option>
                      <option value="long">long</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Template content (HTML/Handlebars)</label>
                <textarea
                  name="content"
                  className="form-control mono"
                  rows={12}
                  defaultValue={template?.content ?? ''}
                  placeholder="<div>{{artifact.data}}</div>"
                  required
                />
              </div>
            </div>
            <div className="box-footer">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn-default ml-xs" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImport, importing }: {
  onClose: () => void;
  onImport: (templates: Template[]) => void;
  importing: boolean;
}) {
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Template[] | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const arr = Array.isArray(json) ? json : [json];
        setParsed(arr as Template[]);
        setParseError(null);
      } catch {
        setParseError('Invalid JSON file.');
        setParsed(null);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="modal-backdrop-inline">
      <div className="modal-dialog-inline">
        <div className="box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title"><Upload size={14} /> Import analyzer templates</h3>
            <button className="close pull-right" onClick={onClose}>×</button>
          </div>
          <div className="box-body">
            <p className="text-muted">Select a JSON file containing an array of analyzer template objects.</p>
            <div className="form-group">
              <input type="file" accept=".json" onChange={handleFile} />
            </div>
            {parseError && <div className="admin-alert error">{parseError}</div>}
            {parsed && (
              <div className="admin-alert success">{parsed.length} template(s) ready to import.</div>
            )}
          </div>
          <div className="box-footer">
            <button
              className="btn btn-primary"
              disabled={!parsed || importing}
              onClick={() => parsed && onImport(parsed)}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <button className="btn btn-default ml-xs" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
