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
import { PermissionChecklist, PermissionMatrix } from '@/components/PermissionMatrix';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  const [showMatrix, setShowMatrix] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
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
            <button className="btn btn-sm btn-default mr-1" onClick={() => setShowMatrix(v => !v)}>
              {showMatrix ? 'Hide matrix' : 'Show matrix'}
            </button>
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
                            onClick={() => setDeleteTarget(profile)}
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

      {showMatrix && sorted.length > 0 && (
        <div className="box box-default">
          <div className="box-header with-border">
            <h3 className="box-title">Permission matrix</h3>
          </div>
          <div className="box-body no-padding">
            <PermissionMatrix
              profiles={sorted.map((p) => ({ profile: p.name, permissions: p.permissions ?? [] }))}
            />
          </div>
        </div>
      )}

      {(creating || editing) && (
        <ProfileModal
          profile={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => upsert.mutate(payload)}
          saving={upsert.isPending}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete profile"
        message={`Are you sure you want to delete profile "${deleteTarget?.name ?? ''}"? Users assigned to this profile will lose their permissions.`}
        variant="danger"
        confirmLabel="Delete profile"
        cancelLabel="Keep profile"
        pending={remove.isPending}
        onConfirm={() => { if (deleteTarget) remove.mutate(deleteTarget.name); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
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

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({ name: fd.get('name'), permissions: selected });
  }

  return (
    <div className="modal-backdrop-th4">
      <div className="th4-modal-dialog" style={{ maxWidth: 720 }}>
        <div className="th4-modal-content">
          <div className="modal-header bg-primary">
            <h3 className="modal-title">{profile ? `Edit profile: ${profile.name}` : 'Create profile'}</h3>
            <button className="close" onClick={onClose}>×</button>
          </div>
          <form onSubmit={submit}>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input name="name" className="form-control" defaultValue={profile?.name ?? ''} required placeholder="Profile name" />
              </div>
              <div className="form-group">
                <label>Permissions</label>
                <PermissionChecklist selected={selected} onChange={setSelected} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-default" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
