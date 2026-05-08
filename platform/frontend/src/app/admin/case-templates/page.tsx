'use client';

/**
 * Admin -> Case templates.
 * Mirrors legacy `frontend/app/views/components/org/case-template/*` list and modal partials.
 * Wired: create, update, delete via backend API (B-UI-8).
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Edit2, Eye, Plus, Trash2, Upload } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { Pap, Severity, TagList, Tlp } from '@/components/Badges';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type SeverityValue = 1 | 2 | 3 | 4;
type TemplateTask = { title: string; group?: string; owner?: string; description?: string; order?: number };
type TemplateCustomField = { name: string; value?: string | number | boolean; type?: string; description?: string };
type CaseTemplate = {
  id?: string;
  name: string;
  display_name?: string;
  displayName?: string;
  title_prefix?: string;
  titlePrefix?: string;
  description?: string;
  severity?: SeverityValue;
  tlp?: number;
  pap?: number;
  tags?: string[];
  tasks?: TemplateTask[];
  custom_fields?: TemplateCustomField[];
  customFields?: TemplateCustomField[];
  task_count?: number;
  custom_field_count?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

type TemplateModalMode = 'view' | 'edit' | 'new';

export default function CaseTemplatesAdminPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState<{ mode: TemplateModalMode; template: CaseTemplate } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ['admin-case-templates'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/case-templates');
        return normalizeList<CaseTemplate>(data as never);
      } catch {
        return [] as CaseTemplate[];
      }
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/case-templates/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-case-templates'] });
      setMessage('Template deleted.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Delete failed'),
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (templates.data ?? []).filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        displayName(t).toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates.data, filter]);

  return (
    <AdminShell title="Case templates" small="organisation-scoped triage templates">
      {message && <div className="alert alert-success alert-dismissible"><button type="button" className="close" onClick={() => setMessage(null)}>×</button>{message}</div>}
      {error && <div className="alert alert-danger alert-dismissible"><button type="button" className="close" onClick={() => setError(null)}>×</button>{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">
            <ClipboardList size={14} /> Case templates ({filtered.length})
          </h3>
          <div className="box-tools">
            <input
              className="form-control input-sm"
              placeholder="Filter templates"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button className="btn btn-sm btn-primary" onClick={() => setModal({ mode: 'new', template: emptyTemplate() })}>
              <Plus size={13} /> New template
            </button>
            <button className="btn btn-sm btn-default" disabled title="Backend import endpoint pending">
              <Upload size={13} /> Import template
            </button>
          </div>
        </div>
        <div className="box-body no-padding overflow-x-auto">
          {templates.isLoading ? (
            <div className="empty-message">Loading case templates...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-message">No case templates found.</div>
          ) : (
            <table className="table table-striped case-template-table">
              <thead>
                <tr>
                  <th className="tlp-head" />
                  <th style={{ width: 260 }}>Template</th>
                  <th style={{ width: 90 }} className="text-center">Severity</th>
                  <th style={{ width: 90 }} className="text-center">Tasks</th>
                  <th style={{ width: 120 }} className="text-center">Custom fields</th>
                  <th style={{ width: 110 }}>Created by</th>
                  <th style={{ width: 160 }}>Dates</th>
                  <th style={{ width: 130 }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((template) => (
                  <tr key={template.id ?? template.name}>
                    <td className={`p-0 bg-tlp-${template.tlp ?? 2}`} />
                    <td>
                      <span>{displayName(template)}</span>
                      <div><TagList data={template.tags} /></div>
                      <div className="case-title wrap"><a>{template.name}</a></div>
                    </td>
                    <td className="text-center"><Severity value={template.severity ?? 2} /></td>
                    <td className="text-center">{templateTasks(template).length || template.task_count || 0}</td>
                    <td className="text-center">{templateCustomFields(template).length || template.custom_field_count || 0}</td>
                    <td className="nowrap">{template.created_by || '-'}</td>
                    <td>
                      <div>C. <a>{shortDate(template.created_at)}</a></div>
                      {template.updated_at && <div>U. <a>{shortDate(template.updated_at)}</a></div>}
                    </td>
                    <td className="text-center nowrap">
                      <button className="btn btn-icon btn-clear" onClick={() => setModal({ mode: 'view', template })} title="View template"><Eye size={14} className="text-info" /></button>
                      <button className="btn btn-icon btn-clear" onClick={() => setModal({ mode: 'edit', template })} title="Edit template"><Edit2 size={14} className="text-info" /></button>
                      <button
                        className="btn btn-icon btn-clear"
                        onClick={() => {
                          if (template.id && window.confirm(`Delete template "${displayName(template)}"?`)) {
                            deleteTemplate.mutate(template.id);
                          }
                        }}
                        title="Delete template"
                      >
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <CaseTemplateModal
          mode={modal.mode}
          template={modal.template}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ['admin-case-templates'] });
            setModal(null);
            setMessage(modal.mode === 'new' ? 'Template created.' : 'Template updated.');
            setError(null);
          }}
          onError={(msg) => { setError(msg); setMessage(null); }}
        />
      )}
    </AdminShell>
  );
}

function CaseTemplateModal({ mode, template, onClose, onSaved, onError }: {
  mode: TemplateModalMode;
  template: CaseTemplate;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<'details' | 'tasks' | 'customFields'>('details');
  const [draft, setDraft] = useState<CaseTemplate>(normalizeTemplate(template));
  const readonly = mode === 'view';
  const tasks = templateTasks(draft);
  const customFields = templateCustomFields(draft);

  const patch = (change: Partial<CaseTemplate>) => setDraft((current) => ({ ...current, ...change }));
  const addTask = () => patch({ tasks: [...tasks, { title: 'New task', group: 'default', description: '', order: tasks.length + 1 }] });
  const addCustomField = () => patch({ custom_fields: [...customFields, { name: 'customField', value: '', type: 'string', description: 'No description' }] });

  // Build payload matching backend API
  function buildPayload() {
    return {
      name: draft.name,
      display_name: draft.display_name || draft.displayName || '',
      title_prefix: draft.title_prefix || draft.titlePrefix || '',
      description: draft.description || '',
      severity: draft.severity ?? 2,
      tlp: draft.tlp ?? 2,
      pap: draft.pap ?? 2,
      tags: draft.tags ?? [],
      tasks: tasks.map((t, i) => ({
        title: t.title,
        description: t.description || '',
        group_name: t.group || 'default',
        order_index: t.order ?? i + 1,
      })),
      custom_fields: customFields.map((cf) => ({
        field_name: cf.name,
        field_type: cf.type || 'string',
        default_value: String(cf.value ?? ''),
        field_order: 0,
      })),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (mode === 'new') {
        return apiFetch('/api/v1/case-templates', { method: 'POST', json: payload });
      } else {
        return apiFetch(`/api/v1/case-templates/${template.id}`, { method: 'PATCH', json: payload });
      }
    },
    onSuccess: onSaved,
    onError: (err) => onError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed'),
  });

  function handleSave() {
    if (!draft.name.trim()) { onError('Template name is required.'); return; }
    saveMutation.mutate();
  }

  return (
    <div className="thehive-modal-backdrop" role="dialog">
      <div className="thehive-modal lg case-template-modal">
        <header className="thehive-modal-header">
          <h3>{mode === 'new' ? 'Add' : mode === 'edit' ? 'Update' : 'View'} case template</h3>
          <button className="thehive-modal-close" onClick={onClose}>x</button>
        </header>
        <div className="thehive-modal-body">
          <div className="nav-tabs-custom">
            <ul className="nav nav-tabs">
              <li className={tab === 'details' ? 'active' : ''}><button type="button" onClick={() => setTab('details')}><i className="glyphicon glyphicon-folder-open mr-xxs" /> Basic Information</button></li>
              <li className={tab === 'tasks' ? 'active' : ''}><button type="button" onClick={() => setTab('tasks')}><i className="glyphicon glyphicon-tasks mr-xxs" /> Tasks <span className="badge badge-default">{tasks.length}</span></button></li>
              <li className={tab === 'customFields' ? 'active' : ''}><button type="button" onClick={() => setTab('customFields')}><i className="fa fa-tags mr-xxs" /> Custom Fields <span className="badge badge-default">{customFields.length}</span></button></li>
            </ul>
            <div className="tab-content">
              {tab === 'details' && <TemplateDetails draft={draft} readonly={readonly} patch={patch} />}
              {tab === 'tasks' && <TemplateTasks tasks={tasks} readonly={readonly} addTask={addTask} patch={(next) => patch({ tasks: next })} />}
              {tab === 'customFields' && <TemplateCustomFields fields={customFields} readonly={readonly} addField={addCustomField} patch={(next) => patch({ custom_fields: next })} />}
            </div>
          </div>
        </div>
        <footer className="thehive-modal-footer text-left">
          <button className="btn btn-default" onClick={onClose}>Cancel</button>
          {!readonly && <span className="ml-xxs"><i className="fa fa-asterisk text-danger mr-xxxs" />Required field</span>}
          {!readonly && (
            <button className="btn btn-primary pull-right" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save template'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function TemplateDetails({ draft, readonly, patch }: { draft: CaseTemplate; readonly: boolean; patch: (change: Partial<CaseTemplate>) => void }) {
  return (
    <div className="case-template-details-tab mt-xs">
      <div className="row">
        <div className="col-sm-4"><Field label="Template name" required help="This name should be unique"><input disabled={readonly} className="form-control" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Template name" /></Field></div>
        <div className="col-sm-4"><Field label="Display name" help="This is a display name of the template"><input disabled={readonly} className="form-control" value={displayName(draft)} onChange={(e) => patch({ display_name: e.target.value, displayName: e.target.value })} placeholder="Display name" /></Field></div>
        <div className="col-sm-4"><Field label="Title prefix" help="This is used to prefix the case name"><input disabled={readonly} className="form-control" value={draft.title_prefix || draft.titlePrefix || ''} onChange={(e) => patch({ title_prefix: e.target.value, titlePrefix: e.target.value })} placeholder="Case title prefix" /></Field></div>
      </div>
      <div className="row">
        <div className="col-sm-4"><Field label="Severity" required help="This will be the default case severity"><Severity value={draft.severity ?? 2} active={!readonly} onUpdate={(value) => patch({ severity: value as SeverityValue })} /></Field></div>
        <div className="col-sm-4"><Field label="TLP" required help="This will be the default case TLP"><Tlp value={draft.tlp ?? 2} format={readonly ? 'static' : 'active'} onUpdate={(value) => patch({ tlp: value })} /></Field></div>
        <div className="col-sm-4"><Field label="PAP" required help="This will be the default case PAP"><Pap value={draft.pap ?? 2} format={readonly ? 'static' : 'active'} onUpdate={(value) => patch({ pap: value })} /></Field></div>
      </div>
      <Field label="Tags" help="These will be the default case tags">
        {readonly ? <TagList data={draft.tags} /> : <input className="form-control" value={(draft.tags ?? []).join(', ')} onChange={(e) => patch({ tags: splitTags(e.target.value) })} placeholder="Tags" />}
      </Field>
      <Field label="Description" required help="This will be the default case description">
        <textarea disabled={readonly} className="form-control" rows={3} value={draft.description || ''} onChange={(e) => patch({ description: e.target.value })} placeholder="Case description" />
      </Field>
    </div>
  );
}

function TemplateTasks({ tasks, readonly, addTask, patch }: { tasks: TemplateTask[]; readonly: boolean; addTask: () => void; patch: (tasks: TemplateTask[]) => void }) {
  return (
    <div className="case-template-section mt-xs">
      {!readonly && <div className="mb-xs"><button className="btn btn-sm btn-primary" type="button" onClick={addTask}><i className="mr-xxxs fa fa-plus" />Add task</button></div>}
      {tasks.length === 0 ? <div className="empty-message">No tasks have been specified. {!readonly && <a onClick={addTask}>Add a task</a>}</div> : tasks.map((task, index) => (
        <div className="task-item" key={`${task.title}-${index}`}>
          <div className="panel-heading">
            <span className="drag-handle text-primary clickable mr-xxs"><i className="fa fa-bars" /></span>
            <span className="hpad5">[{task.group || 'default'}] {task.title}</span>
            {task.owner && <span className="mr-xxs">(Assigned to <em>{task.owner}</em>)</span>}
            {!readonly && <span className="pull-right"><a className="text-danger" onClick={() => patch(tasks.filter((_, i) => i !== index))}><i className="fa fa-trash" /> Delete</a></span>}
          </div>
          <div className="panel-body">
            {!readonly ? (
              <div>
                <input className="form-control input-sm mb-1" value={task.title} onChange={(e) => patch(tasks.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder="Task title" />
                <input className="form-control input-sm mb-1" value={task.group || ''} onChange={(e) => patch(tasks.map((item, i) => i === index ? { ...item, group: e.target.value } : item))} placeholder="Group name" />
                <textarea className="form-control" value={task.description || ''} onChange={(e) => patch(tasks.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} placeholder="Task description" />
              </div>
            ) : task.description ? <p>{task.description}</p> : <p className="text-warning"><em>No description specified</em></p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateCustomFields({ fields, readonly, addField, patch }: { fields: TemplateCustomField[]; readonly: boolean; addField: () => void; patch: (fields: TemplateCustomField[]) => void }) {
  return (
    <div className="case-template-section mt-xs">
      {!readonly && <div className="mb-xs"><button className="btn btn-sm btn-primary" type="button" onClick={addField}><i className="mr-xxxs fa fa-plus" />Add custom field</button></div>}
      {fields.length === 0 ? <div className="empty-message">No custom fields have been added. {!readonly && <a onClick={addField}>Add a custom field</a>}</div> : fields.map((field, index) => (
        <div className="customfield-item" key={`${field.name}-${index}`}>
          <div className="row">
            <div className="col-sm-12"><span className="drag-handle text-primary clickable mr-xxs"><i className="fa fa-bars" /></span>{!readonly && <a onClick={() => patch(fields.filter((_, i) => i !== index))}><span className="pull-right text-danger"><i className="fa fa-trash" /> Delete</span></a>}</div>
            <div className="col-sm-4"><input disabled={readonly} className="form-control" value={field.name} onChange={(e) => patch(fields.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} placeholder="Field name" /></div>
            <div className="col-sm-3">
              <select disabled={readonly} className="form-control" value={field.type || 'string'} onChange={(e) => patch(fields.map((item, i) => i === index ? { ...item, type: e.target.value } : item))}>
                <option value="string">String</option>
                <option value="integer">Integer</option>
                <option value="float">Float</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
                <option value="enumeration">Enumeration</option>
              </select>
            </div>
            <div className="col-sm-5"><input disabled={readonly} className="form-control" value={String(field.value ?? '')} onChange={(e) => patch(fields.map((item, i) => i === index ? { ...item, value: e.target.value } : item))} placeholder="Default value" /></div>
            <div className="col-sm-12"><i className="pl-xxss fa fa-question-circle" /> <small>{field.description || 'No description'}</small></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="control-label">{label}{required && <i className="fa fa-asterisk text-danger" />}</label>{children}{help && <p className="help-block small">{help}</p>}</div>;
}

function normalizeTemplate(template: CaseTemplate): CaseTemplate {
  return { ...template, tasks: templateTasks(template), custom_fields: templateCustomFields(template), tags: template.tags ?? [] };
}

function emptyTemplate(): CaseTemplate {
  return { name: '', display_name: '', title_prefix: '', description: '', severity: 2, tlp: 2, pap: 2, tags: [], tasks: [], custom_fields: [] };
}

function displayName(template: CaseTemplate) { return template.display_name || template.displayName || template.name; }
function templateTasks(template: CaseTemplate) { return template.tasks ?? []; }
function templateCustomFields(template: CaseTemplate) { return template.custom_fields ?? template.customFields ?? []; }
function splitTags(value: string) { return value.split(',').map((tag) => tag.trim()).filter(Boolean); }
function shortDate(value?: string) { return value ? new Date(value).toLocaleDateString() : '-'; }
