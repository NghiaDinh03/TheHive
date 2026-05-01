'use client';

/**
 * Admin → Custom fields.
 * Mirrors legacy `frontend/app/views/partials/admin/custom-fields.html` and `custom-field-dialog.html`.
 * Backend: GET/POST/DELETE /api/v1/admin/custom-fields (read-only fallback if endpoint absent).
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, ListChecks, Plus, Trash2 } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type CustomField = {
  id?: string;
  name: string;
  reference: string;
  description?: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'enumeration';
  mandatory?: boolean;
  options?: string[];
};

const TYPES: CustomField['type'][] = ['string', 'integer', 'float', 'boolean', 'date', 'enumeration'];

export default function CustomFieldsAdminPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [creating, setCreating] = useState(false);
  const [sortField, setSortField] = useState<keyof CustomField>('name');
  const [asc, setAsc] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fields = useQuery({
    queryKey: ['admin-custom-fields'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/admin/custom-fields');
        return normalizeList<CustomField>(data as never);
      } catch {
        return [] as CustomField[];
      }
    },
  });

  const upsert = useMutation({
    mutationFn: (payload: CustomField) =>
      apiFetch('/api/v1/admin/custom-fields', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-custom-fields'] });
      setMessage('Custom field saved.');
      setError(null);
      setEditing(null);
      setCreating(false);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: (reference: string) =>
      apiFetch(`/api/v1/admin/custom-fields/${encodeURIComponent(reference)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-custom-fields'] });
      setMessage('Custom field removed.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Delete failed'),
  });

  const sorted = useMemo(() => {
    const list = (fields.data ?? []).slice();
    list.sort((a, b) => {
      const av = String(a[sortField] ?? '').toLowerCase();
      const bv = String(b[sortField] ?? '').toLowerCase();
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [fields.data, sortField, asc]);

  function setSort(field: keyof CustomField) {
    if (field === sortField) setAsc((v) => !v);
    else {
      setSortField(field);
      setAsc(true);
    }
  }

  return (
    <AdminShell title="Custom fields" small="case/alert metadata schema">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">Case custom fields ({sorted.length})</h3>
          <div className="box-tools">
            <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
              <Plus size={13} /> Add custom field
            </button>
          </div>
        </div>
        <div className="box-body no-padding overflow-x-auto">
          {fields.isLoading ? (
            <div className="empty-message">Loading custom fields…</div>
          ) : sorted.length === 0 ? (
            <div className="empty-message">No custom fields defined yet.</div>
          ) : (
            <table className="table table-striped">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>
                    <a className="text-default" onClick={() => setSort('type')}>
                      Type
                    </a>
                  </th>
                  <th style={{ width: 240 }}>
                    <a className="text-default" onClick={() => setSort('name')}>
                      Name
                    </a>
                  </th>
                  <th style={{ width: 220 }}>
                    <a className="text-default" onClick={() => setSort('reference')}>
                      Reference
                    </a>
                  </th>
                  <th>Description</th>
                  <th className="text-center" style={{ width: 100 }}>
                    Mandatory
                  </th>
                  <th style={{ width: 200 }}>Options</th>
                  <th className="text-center" style={{ width: 160 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((field) => (
                  <tr key={field.reference}>
                    <td className="text-center">
                      <span className="label label-default">{field.type.toUpperCase()}</span>
                    </td>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); setEditing(field); }}>
                        {field.name}
                      </a>
                    </td>
                    <td className="mono">{field.reference}</td>
                    <td>{field.description || 'N/A'}</td>
                    <td className="text-center">{field.mandatory ? 'Yes' : 'No'}</td>
                    <td>
                      {(field.options ?? []).length === 0 ? (
                        <em>None</em>
                      ) : (
                        <ul className="list-unstyled">
                          {(field.options ?? []).map((opt) => (
                            <li key={opt}>{opt}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="text-center nowrap">
                      <button className="btn btn-xs btn-primary mr-xxs" onClick={() => setEditing(field)}>
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={() => {
                          if (window.confirm(`Delete custom field "${field.name}"?`)) remove.mutate(field.reference);
                        }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <FieldModal
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSubmit={(payload) => upsert.mutate(payload)}
          submitting={upsert.isPending}
        />
      )}
    </AdminShell>
  );
}

function FieldModal({
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  initial?: CustomField;
  onClose: () => void;
  onSubmit: (payload: CustomField) => void;
  submitting: boolean;
}) {
  const [type, setType] = useState<CustomField['type']>(initial?.type ?? 'string');
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join('\n'));
  const [mandatory, setMandatory] = useState(initial?.mandatory ?? false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reference = String(form.get('reference') || '').trim();
    if (!reference) return;
    onSubmit({
      name: String(form.get('name') || '').trim(),
      reference,
      description: String(form.get('description') || ''),
      type,
      mandatory,
      options:
        type === 'enumeration'
          ? optionsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
          : [],
    });
  }

  return (
    <div className="thehive-modal-backdrop" role="dialog">
      <div className="thehive-modal lg">
        <header className="thehive-modal-header">
          <h3>
            <ListChecks size={14} /> {initial ? 'Edit custom field' : 'New custom field'}
          </h3>
          <button className="thehive-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="thehive-modal-body">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label>Display name</label>
                <input className="form-control" name="name" defaultValue={initial?.name} required />
              </div>
              <div className="form-group">
                <label>Internal reference</label>
                <input
                  className="form-control"
                  name="reference"
                  defaultValue={initial?.reference}
                  disabled={!!initial}
                  required
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="form-control" value={type} onChange={(e) => setType(e.target.value as CustomField['type'])}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Mandatory</label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={mandatory}
                    onChange={(e) => setMandatory(e.target.checked)}
                  />{' '}
                  Field must be filled
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" name="description" defaultValue={initial?.description} rows={3} />
            </div>
            {type === 'enumeration' && (
              <div className="form-group">
                <label>Options (one per line)</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                />
              </div>
            )}
          </div>
          <footer className="thehive-modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
