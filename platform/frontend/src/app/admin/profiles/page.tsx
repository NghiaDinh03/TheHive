'use client';

/**
 * Admin → Profiles.
 * Mirrors legacy `frontend/app/views/partials/admin/profile/list.html`
 * and `profile.modal.html`.
 */

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Settings, Trash2 } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type Profile = {
  id?: string;
  name: string;
  permissions: string[];
  is_admin?: boolean;
};

const ALL_PERMISSIONS = [
  'manageCase', 'manageAlert', 'manageTask', 'manageObservable',
  'manageShare', 'manageAnalyse', 'manageAction', 'manageCaseTemplate',
  'manageCustomField', 'manageObservableTemplate', 'managePage',
  'manageProcedure', 'manageProfile', 'manageUser', 'manageOrganisation',
  'manageTaxonomy', 'managePattern', 'manageAnalyzerTemplate',
  'manageConfig', 'managePlatform',
];

export default function ProfilesAdminPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profiles = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/admin/profiles');
        return normalizeList<Profile>(data as never);
      } catch {
        return [] as Profile[];
      }
    },
  });

  const upsert = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      // Use PATCH when editing an existing profile (has id), POST to create new
      if (payload.id) {
        const { id, ...rest } = payload;
        return apiFetch(`/api/v1/admin/profiles/${encodeURIComponent(id as string)}`, { method: 'PATCH', json: rest });
      }
      return apiFetch('/api/v1/admin/profiles', { method: 'POST', json: payload });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      setMessage('Profile saved.');
      setError(null);
      setEditing(null);
      setCreating(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/api/v1/admin/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      setMessage('Profile deleted.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Delete failed'),
  });

  const canDelete = (profile: Profile) => !profile.is_admin;
  const sorted = [...(profiles.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminShell title="Profiles" small="permission profiles">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title"><Settings size={14} /> List of profiles</h3>
          <div className="box-tools pull-right">
            <button className="btn btn-sm btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus size={13} /> Add profile
            </button>
          </div>
        </div>
        <div className="box-body no-padding">
          {profiles.isLoading && <div className="empty-message">Loading profiles…</div>}
          {!profiles.isLoading && sorted.length === 0 && <div className="empty-message">No profiles found.</div>}
          {sorted.length > 0 && (
            <table className="table table-striped case-list">
              <thead>
                <tr>
                  <th style={{ width: 300 }}>Name</th>
                  <th>Permissions</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((profile) => (
                  <tr key={profile.id ?? profile.name}>
                    <td>
                      <div className="profile-name"><strong>{profile.name}</strong></div>
                      {profile.is_admin && <span className="label label-warning">admin</span>}
                    </td>
                    <td className="wrap">
                      {(profile.permissions ?? []).length === 0
                        ? <em className="text-warning">No permissions</em>
                        : [...(profile.permissions ?? [])].sort().map((perm) => (
                            <span key={perm} className="label label-default mr-xxs mb-xxs">{perm}</span>
                          ))
                      }
                    </td>
                    <td className="text-left nowrap">
                      {canDelete(profile) ? (
                        <>
                          <button
                            className="btn btn-xs btn-default mr-xs clickable"
                            onClick={() => { setEditing(profile); setCreating(false); }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            className="btn btn-xs btn-danger clickable"
                            onClick={() => { if (confirm(`Delete profile "${profile.name}"?`)) remove.mutate(profile.name); }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <ProfileModal
          profile={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => upsert.mutate(payload)}
          saving={upsert.isPending}
        />
      )}
    </AdminShell>
  );
}

function ProfileModal({ profile, onClose, onSave, saving }: {
  profile: Profile | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(profile?.permissions ?? []);

  function toggle(perm: string) {
    setSelected((current) =>
      current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm],
    );
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({ name: fd.get('name'), permissions: selected });
  }

  return (
    <div className="modal-backdrop-inline">
      <div className="modal-dialog-inline modal-lg">
        <div className="box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title">{profile ? `Edit profile: ${profile.name}` : 'Create profile'}</h3>
            <button className="close pull-right" onClick={onClose}>×</button>
          </div>
          <form onSubmit={submit}>
            <div className="box-body">
              <div className="form-group">
                <label>Name</label>
                <input name="name" className="form-control" defaultValue={profile?.name ?? ''} required placeholder="Profile name" />
              </div>
              <div className="form-group">
                <label>Permissions</label>
                <div className="permission-grid">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label key={perm} className="permission-item">
                      <input
                        type="checkbox"
                        checked={selected.includes(perm)}
                        onChange={() => toggle(perm)}
                      />
                      <span className="ml-xs">{perm}</span>
                    </label>
                  ))}
                </div>
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
