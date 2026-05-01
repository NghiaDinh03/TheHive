'use client';

/**
 * Admin → Users.
 * Mirrors legacy `frontend/app/views/partials/admin/organisation/user.modal.html`
 * and the user list within the admin panel.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Filter, Plus, Search, Trash2, Users } from '@/components/FaIcon';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiFetch, normalizeList } from '@/lib/api';

type User = {
  id?: string;
  login: string;
  name: string;
  email?: string;
  organisation?: string;
  profile?: string;
  status?: string;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
function fmt(v?: string) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }

export default function UsersAdminPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/api/v1/admin/users');
        return normalizeList<User>(data as never);
      } catch {
        return [] as User[];
      }
    },
  });

  const upsert = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch('/api/v1/admin/users', { method: 'POST', json: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User saved.');
      setError(null);
      setEditing(null);
      setCreating(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Save failed'),
  });

  const remove = useMutation({
    mutationFn: (login: string) =>
      apiFetch(`/api/v1/admin/users/${encodeURIComponent(login)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User deleted.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Delete failed'),
  });

  const lock = useMutation({
    mutationFn: ({ login, locked }: { login: string; locked: boolean }) =>
      apiFetch(`/api/v1/admin/users/${encodeURIComponent(login)}`, {
        method: 'PATCH',
        json: { status: locked ? 'Locked' : 'Ok' },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User status updated.');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.problem.detail || err.problem.title : 'Status update failed'),
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (users.data ?? []).filter(
      (u) => !q || u.login.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q),
    );
  }, [users.data, filter]);

  return (
    <AdminShell title="Users" small="user management">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      <div className="box box-primary">
        <div className="box-header with-border">
          <h3 className="box-title"><Users size={14} /> List of users ({filtered.length} of {users.data?.length ?? 0})</h3>
          <div className="box-tools pull-right">
            <button className="btn btn-sm btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus size={13} /> Add user
            </button>
            <button className={`btn btn-sm btn-default ml-xs ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
              <Filter size={13} /> Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="box-body filter-panel">
            <div className="filter-grid">
              <label className="filter-control">
                <span>Search</span>
                <div className="relative">
                  <Search size={13} className="thehive-input-icon" />
                  <input
                    className="thehive-input thehive-input-with-icon py-1.5"
                    placeholder="Login, name or email"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="box-body no-padding">
          {users.isLoading && <div className="empty-message">Loading users…</div>}
          {!users.isLoading && filtered.length === 0 && <div className="empty-message">No users found.</div>}
          {filtered.length > 0 && (
            <table className="table table-striped case-list">
              <thead>
                <tr>
                  <th>Login</th>
                  <th>Name</th>
                  <th style={{ width: 200 }}>Organisation</th>
                  <th style={{ width: 150 }}>Profile</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 160 }}>Dates C. / U.</th>
                  <th style={{ width: 200 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id ?? user.login}>
                    <td>
                      <strong>{user.login}</strong>
                      {user.email && <div className="text-muted">{user.email}</div>}
                    </td>
                    <td>{user.name}</td>
                    <td>{user.organisation ?? <em className="text-muted">None</em>}</td>
                    <td>
                      {user.profile
                        ? <span className="label label-default">{user.profile}</span>
                        : <em className="text-muted">None</em>
                      }
                    </td>
                    <td>
                      <span className={user.status === 'Locked' ? 'label label-danger' : 'label label-success'}>
                        {user.status ?? 'Ok'}
                      </span>
                    </td>
                    <td className="date-stack">
                      <div>C. {fmt(user.created_at)}</div>
                      <div>U. {fmt(user.updated_at)}</div>
                    </td>
                    <td className="text-right nowrap">
                      <button
                        className="btn btn-xs btn-default mr-xs"
                        onClick={() => { setEditing(user); setCreating(false); }}
                        title="Edit user"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-xs btn-default mr-xs"
                        onClick={() => lock.mutate({ login: user.login, locked: user.status !== 'Locked' })}
                        title={user.status === 'Locked' ? 'Unlock user' : 'Lock user'}
                      >
                        {user.status === 'Locked' ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={() => { if (confirm(`Delete user "${user.login}"?`)) remove.mutate(user.login); }}
                        title="Delete user"
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

      {(creating || editing) && (
        <UserModal
          user={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(payload) => upsert.mutate(payload)}
          saving={upsert.isPending}
        />
      )}
    </AdminShell>
  );
}

function UserModal({ user, onClose, onSave, saving }: {
  user: User | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  saving: boolean;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      login: fd.get('login'),
      name: fd.get('name'),
      email: fd.get('email') || undefined,
      organisation: fd.get('organisation') || undefined,
      profile: fd.get('profile') || undefined,
    };
    if (!user) {
      payload.password = fd.get('password');
    }
    onSave(payload);
  }

  return (
    <div className="modal-backdrop-inline">
      <div className="modal-dialog-inline">
        <div className="box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title">{user ? `Edit user: ${user.login}` : 'Create user'}</h3>
            <button className="close pull-right" onClick={onClose}>×</button>
          </div>
          <form onSubmit={submit}>
            <div className="box-body">
              <div className="form-group">
                <label>Login</label>
                <input name="login" className="form-control" defaultValue={user?.login ?? ''} required placeholder="user@example.com" readOnly={!!user} />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input name="name" className="form-control" defaultValue={user?.name ?? ''} required placeholder="Full name" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" className="form-control" defaultValue={user?.email ?? ''} placeholder="Email address" />
              </div>
              <div className="form-group">
                <label>Organisation</label>
                <input name="organisation" className="form-control" defaultValue={user?.organisation ?? ''} placeholder="Organisation name" />
              </div>
              <div className="form-group">
                <label>Profile</label>
                <input name="profile" className="form-control" defaultValue={user?.profile ?? ''} placeholder="Profile name" />
              </div>
              {!user && (
                <div className="form-group">
                  <label>Password</label>
                  <input name="password" type="password" className="form-control" required placeholder="Initial password" />
                </div>
              )}
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
