'use client';

/**
 * Admin → Organisations.
 * Mirrors legacy `frontend/app/views/partials/admin/organisation/list.html`,
 * `list/toolbar.html`, `list/filters.html`, `list/create.modal.html`, `list/link.modal.html`.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Edit2, Filter, Link2, Plus, Search, Trash2 } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch } from '@/lib/api';

type Organisation = {
  id: string;
  name: string;
  description: string;
  links?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
};
type Collection<T> = { values: T[]; total: number };

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function fmt(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

export default function OrganisationsAdminPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Organisation | null>(null);
  const [linking, setLinking] = useState<Organisation | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orgs = useQuery({
    queryKey: ['admin-organisations'],
    queryFn: () => apiFetch<Collection<Organisation>>('/api/v1/admin/organisations'),
  });

  const upsert = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      // Use PATCH when editing an existing org (has id), POST to create new
      if (payload.id) {
        const { id, ...rest } = payload;
        return apiFetch(`/api/v1/admin/organisations/${encodeURIComponent(id as string)}`, { method: 'PATCH', json: rest });
      }
      return apiFetch('/api/v1/admin/organisations', { method: 'POST', json: payload });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] });
      setMessage('Organisation saved.');
      setError(null);
      setEditing(null);
      setCreating(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/api/v1/admin/organisations/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] });
      setMessage('Organisation deleted.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Delete failed'),
  });

  const linkMut = useMutation({
    mutationFn: ({ source, target }: { source: string; target: string }) =>
      apiFetch(`/api/v1/admin/organisations/${encodeURIComponent(source)}/links`, {
        method: 'POST',
        json: { target },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] });
      setLinking(null);
      setMessage('Organisation link saved.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Link failed'),
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (orgs.data?.values ?? []).filter(
      (o) => !q || o.name.toLowerCase().includes(q) || (o.description ?? '').toLowerCase().includes(q),
    );
  }, [orgs.data?.values, filter]);

  return (
    <AdminShell title="Organisations" small="multi-tenant administration">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title">
            <Building2 size={14} /> List of organisations ({filtered.length} of {orgs.data?.total ?? 0})
          </h3>
          {/* Toolbar — mirrors list/toolbar.html */}
          <div className="box-tools pull-right">
            <button className="btn btn-sm btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus size={13} /> Add organisation
            </button>
            <button className={`btn btn-sm btn-default ml-xs ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
              <Filter size={13} /> Filters
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="box-body filter-panel">
            <div className="filter-grid">
              <label className="filter-control">
                <span>Search</span>
                <div className="relative">
                  <Search size={13} className="thehive-input-icon" />
                  <input
                    className="thehive-input thehive-input-with-icon py-1.5"
                    placeholder="Name or description"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="box-body no-padding">
          {orgs.isLoading && <div className="empty-message">Loading organisations…</div>}
          {!orgs.isLoading && filtered.length === 0 && <div className="empty-message">No organisations found.</div>}
          {filtered.length > 0 && (
            <table className="table table-striped case-list">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 300 }}>Created By</th>
                  <th style={{ width: 160 }}>Dates C. / U.</th>
                  <th style={{ width: 250 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id ?? org.name}>
                    <td>
                      <div className="org-name"><strong>{org.name}</strong></div>
                      <div className="org-description text-muted">{org.description || 'No description'}</div>
                      <div className="mt-xs">
                        <span className="text-muted mr-xxs">Linked organisations:</span>
                        {(org.links ?? []).length > 0
                          ? (org.links ?? []).sort().map((link) => (
                              <span key={link} className="label label-default mr-xxs mb-xxs">{link}</span>
                            ))
                          : <span className="text-warning"><em>None</em></span>
                        }
                      </div>
                    </td>
                    <td>{org.created_by ?? <em className="text-muted">unknown</em>}</td>
                    <td className="date-stack">
                      <div>C. {fmt(org.created_at)}</div>
                      <div>U. {fmt(org.updated_at)}</div>
                    </td>
                    <td className="text-right nowrap">
                      <button
                        className="btn btn-xs btn-default mr-xs"
                        onClick={() => { setEditing(org); setCreating(false); }}
                        title="Edit organisation"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-xs btn-default mr-xs"
                        onClick={() => setLinking(org)}
                        title="Link to another organisation"
                      >
                        <Link2 size={12} /> Link
                      </button>
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={() => { if (confirm(`Delete organisation "${org.name}"?`)) remove.mutate(org.name); }}
                        title="Delete organisation"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {(creating || editing) && (
        <OrgModal
          org={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => upsert.mutate(payload)}
          saving={upsert.isPending}
        />
      )}

      {/* Link modal */}
      {linking && (
        <LinkModal
          org={linking}
          allOrgs={orgs.data?.values ?? []}
          onClose={() => setLinking(null)}
          onSave={(target) => linkMut.mutate({ source: linking.name, target })}
          saving={linkMut.isPending}
        />
      )}
    </AdminShell>
  );
}

function OrgModal({ org, onClose, onSave, saving }: {
  org: Organisation | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  saving: boolean;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({ name: fd.get('name'), description: fd.get('description') });
  }
  return (
    <div className="modal-backdrop-inline">
      <div className="modal-dialog-inline">
        <div className="box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title">{org ? 'Edit organisation' : 'Create organisation'}</h3>
            <button className="close pull-right" onClick={onClose}>×</button>
          </div>
          <form onSubmit={submit}>
            <div className="box-body">
              <div className="form-group">
                <label>Name</label>
                <input name="name" className="form-control" defaultValue={org?.name ?? ''} required placeholder="Organisation name" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" className="form-control" defaultValue={org?.description ?? ''} rows={3} placeholder="Description (optional)" />
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

function LinkModal({ org, allOrgs, onClose, onSave, saving }: {
  org: Organisation;
  allOrgs: Organisation[];
  onClose: () => void;
  onSave: (target: string) => void;
  saving: boolean;
}) {
  const [target, setTarget] = useState('');
  const options = allOrgs.filter((o) => o.name !== org.name && !(org.links ?? []).includes(o.name));
  return (
    <div className="modal-backdrop-inline">
      <div className="modal-dialog-inline">
        <div className="box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title"><Link2 size={14} /> Link organisation: {org.name}</h3>
            <button className="close pull-right" onClick={onClose}>×</button>
          </div>
          <div className="box-body">
            <div className="form-group">
              <label>Target organisation</label>
              <select className="form-control" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Select organisation…</option>
                {options.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div className="box-footer">
            <button className="btn btn-primary" disabled={saving || !target} onClick={() => onSave(target)}>{saving ? 'Saving…' : 'Link'}</button>
            <button className="btn btn-default ml-xs" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
