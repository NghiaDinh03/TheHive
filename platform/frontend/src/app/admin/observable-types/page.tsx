'use client';

/**
 * Admin → Observable types.
 * Mirrors legacy `frontend/app/views/partials/admin/observables.html`.
 */

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Trash2 } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type ObservableType = { name: string; is_attachment?: boolean };

const BUILTIN_TYPES = [
  'autonomous-system', 'domain', 'file', 'filename', 'fqdn', 'hash',
  'hostname', 'ip', 'mail', 'mail-subject', 'other', 'regexp',
  'registry', 'uri_path', 'url', 'user-agent',
];

export default function ObservableTypesPage() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState('');
  const [isAttachment, setIsAttachment] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const types = useQuery({
    queryKey: ['admin-observable-types'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/admin/observable-types');
        return normalizeList<ObservableType>(data as never);
      } catch {
        return [] as ObservableType[];
      }
    },
  });

  const add = useMutation({
    mutationFn: (payload: { name: string; is_attachment: boolean }) =>
      apiFetch('/api/v1/admin/observable-types', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-observable-types'] });
      setPending('');
      setIsAttachment(false);
      setMessage('Observable type added.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Add failed'),
  });

  const remove = useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/api/v1/admin/observable-types/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-observable-types'] });
      setMessage('Observable type removed.');
      setError(null);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Remove failed'),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = pending.trim();
    if (!value) return;
    add.mutate({ name: value, is_attachment: isAttachment });
  }

  const items = types.data ?? [];
  const builtinItems = items.filter((t) => BUILTIN_TYPES.includes(t.name));
  const customItems = items.filter((t) => !BUILTIN_TYPES.includes(t.name));

  return (
    <AdminShell title="Observable types" small="data type registry">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="row">
        <div className="col-md-8">
          <div className="box box-primary">
            <div className="box-header with-border">
              <h3 className="box-title"><Database size={14} /> Observable types ({items.length})</h3>
            </div>
            <div className="box-body no-padding">
              {types.isLoading && <div className="empty-message">Loading observable types…</div>}
              {!types.isLoading && items.length === 0 && (
                <div className="empty-message">No observable types defined.</div>
              )}
              {items.length > 0 && (
                <table className="table table-striped case-list">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th style={{ width: 120, textAlign: 'center' }}>Is attachment</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Built-in types first */}
                    {builtinItems.map((t) => (
                      <tr key={t.name}>
                        <td>
                          <span className="label label-default mr-xs">built-in</span>
                          <strong>{t.name}</strong>
                        </td>
                        <td className="text-center">
                          {t.is_attachment
                            ? <span className="label label-info">Yes</span>
                            : <span className="text-muted">No</span>
                          }
                        </td>
                        <td></td>
                      </tr>
                    ))}
                    {/* Custom types */}
                    {customItems.map((t) => (
                      <tr key={t.name}>
                        <td>
                          <span className="label label-primary mr-xs">custom</span>
                          <strong>{t.name}</strong>
                        </td>
                        <td className="text-center">
                          {t.is_attachment
                            ? <span className="label label-info">Yes</span>
                            : <span className="text-muted">No</span>
                          }
                        </td>
                        <td className="text-right">
                          <button
                            className="btn btn-xs btn-danger"
                            onClick={() => { if (confirm(`Delete observable type "${t.name}"?`)) remove.mutate(t.name); }}
                            title="Delete observable type"
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
        </div>

        <div className="col-md-4">
          <div className="box box-primary">
            <div className="box-header with-border">
              <h3 className="box-title"><Plus size={14} /> Add observable type</h3>
            </div>
            <div className="box-body">
              <form onSubmit={submit}>
                <div className="form-group">
                  <label className="control-label">Type name</label>
                  <input
                    className="form-control"
                    placeholder="e.g. bitcoin-address"
                    value={pending}
                    onChange={(e) => setPending(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={isAttachment}
                      onChange={(e) => setIsAttachment(e.target.checked)}
                    />
                    {' '}Is attachment (file type)
                  </label>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!pending.trim() || add.isPending}
                >
                  <Plus size={13} /> {add.isPending ? 'Adding…' : 'Add type'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
