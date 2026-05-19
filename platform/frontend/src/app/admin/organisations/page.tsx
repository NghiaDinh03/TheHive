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

      <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex flex-wrap gap-4 justify-between items-center">
          <h3 className="text-blue-500 font-medium text-lg flex items-center gap-2">
            <Building2 size={16} /> List of organisations ({filtered.length} of {orgs.data?.total ?? 0})
          </h3>
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <button className="thehive-btn-primary flex items-center gap-2" onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus size={14} /> Add organisation
            </button>
            <button className={`thehive-btn-secondary flex items-center gap-2 ${showFilters ? 'bg-slate-700 text-slate-200 border-slate-600' : ''}`} onClick={() => setShowFilters((v) => !v)}>
              <Filter size={14} /> Filters
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-slate-900/50 p-6 border-b border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Search</span>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-500" />
                  <input
                    className="thehive-input pl-9 py-1.5"
                    placeholder="Name or description"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {orgs.isLoading && <div className="text-center py-10 text-slate-500">Loading organisations…</div>}
          {!orgs.isLoading && filtered.length === 0 && <div className="text-center py-10 text-slate-500">No organisations found.</div>}
          {filtered.length > 0 && (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-700 text-slate-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium w-[300px]">Created By</th>
                  <th className="px-4 py-3 font-medium w-[160px]">Dates C. / U.</th>
                  <th className="px-4 py-3 font-medium text-right w-[250px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((org) => (
                  <tr key={org.id ?? org.name} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 whitespace-normal">
                      <div className="font-semibold text-slate-200">{org.name}</div>
                      <div className="text-slate-500 text-xs mt-1">{org.description || 'No description'}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Linked:</span>
                        {(org.links ?? []).length > 0
                          ? (org.links ?? []).sort().map((link) => (
                              <span key={link} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{link}</span>
                            ))
                          : <span className="text-slate-500 text-xs italic">None</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{org.created_by ?? <em className="text-slate-500">unknown</em>}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 flex flex-col gap-0.5">
                      <div>C. {fmt(org.created_at)}</div>
                      <div>U. {fmt(org.updated_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="thehive-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                          onClick={() => { setEditing(org); setCreating(false); }}
                          title="Edit organisation"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          className="thehive-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                          onClick={() => setLinking(org)}
                          title="Link to another organisation"
                        >
                          <Link2 size={12} /> Link
                        </button>
                        <button
                          className="py-1 px-2.5 text-xs flex items-center gap-1 text-red-400 bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500/50 rounded transition-colors"
                          onClick={() => { if (confirm(`Delete organisation "${org.name}"?`)) remove.mutate(org.name); }}
                          title="Delete organisation"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-blue-500 font-medium text-lg">{org ? 'Edit organisation' : 'Create organisation'}</h3>
          <button className="text-slate-400 hover:text-slate-200 transition-colors" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name</label>
              <input name="name" className="thehive-input" defaultValue={org?.name ?? ''} required placeholder="Organisation name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
              <textarea name="description" className="thehive-input" defaultValue={org?.description ?? ''} rows={3} placeholder="Description (optional)" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-2">
            <button type="button" className="thehive-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="thehive-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-blue-500 font-medium text-lg flex items-center gap-2"><Link2 size={16} /> Link organisation: {org.name}</h3>
          <button className="text-slate-400 hover:text-slate-200 transition-colors" onClick={onClose}>×</button>
        </div>
        <div className="p-6">
          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target organisation</label>
          <select className="thehive-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Select organisation…</option>
            {options.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
          </select>
        </div>
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-2">
          <button className="thehive-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="thehive-btn-primary" disabled={saving || !target} onClick={() => onSave(target)}>{saving ? 'Saving…' : 'Link'}</button>
        </div>
      </div>
    </div>
  );
}
