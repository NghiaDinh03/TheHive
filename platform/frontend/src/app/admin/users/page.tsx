'use client';

/**
 * Admin → Users.
 * Mirrors legacy `frontend/app/views/partials/admin/organisation/user.modal.html`
 * and the user list within the admin panel.
 * Added: Online/offline monitoring based on last_login_at.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Filter, Plus, Search, Trash2, Users, Wifi, WifiOff, Clock } from '@/components/FaIcon';
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
  locked?: boolean;
  must_change_password?: boolean;
  permissions?: string[];
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function fmt(v?: string | null) { if (!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d); }
function fmtDateTime(v?: string | null) { if (!v) return 'Never'; const d = new Date(v); return Number.isNaN(d.getTime()) ? 'Never' : dateTimeFormatter.format(d); }

/** Determine online status based on last_login_at — mirrors TheHive 4 user panel */
function getOnlineStatus(lastLoginAt?: string | null): { label: string; color: string; icon: 'online' | 'recent' | 'offline' } {
  if (!lastLoginAt) return { label: 'Never logged in', color: '#999', icon: 'offline' };
  const lastLogin = new Date(lastLoginAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastLogin) / 60000;
  if (diffMinutes < 15) return { label: 'Online', color: '#3c763d', icon: 'online' };
  if (diffMinutes < 60) return { label: `Active ${Math.round(diffMinutes)}m ago`, color: '#8a6d3b', icon: 'recent' };
  if (diffMinutes < 1440) return { label: `Last seen ${Math.round(diffMinutes / 60)}h ago`, color: '#999', icon: 'offline' };
  return { label: `Last seen ${Math.round(diffMinutes / 1440)}d ago`, color: '#999', icon: 'offline' };
}

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
    refetchInterval: 30000, // Refresh every 30s for online status
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

  // Online stats
  const onlineCount = useMemo(() => (users.data ?? []).filter(u => getOnlineStatus(u.last_login_at).icon === 'online').length, [users.data]);
  const recentCount = useMemo(() => (users.data ?? []).filter(u => getOnlineStatus(u.last_login_at).icon === 'recent').length, [users.data]);

  return (
    <AdminShell title="Users" small="user management">
      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      {/* Online status summary — mirrors TheHive 4 user panel */}
      <div className="row mb-s">
        <div className="col-md-4">
          <div className="info-box bg-green">
            <span className="info-box-icon"><Wifi size={24} /></span>
            <div className="info-box-content">
              <span className="info-box-text">Online Now</span>
              <span className="info-box-number">{onlineCount}</span>
              <div className="progress"><div className="progress-bar" style={{ width: `${users.data?.length ? (onlineCount / users.data.length * 100) : 0}%` }} /></div>
              <span className="progress-description">{onlineCount} of {users.data?.length ?? 0} users active</span>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="info-box bg-yellow">
            <span className="info-box-icon"><Clock size={24} /></span>
            <div className="info-box-content">
              <span className="info-box-text">Recently Active</span>
              <span className="info-box-number">{recentCount}</span>
              <div className="progress"><div className="progress-bar" style={{ width: `${users.data?.length ? (recentCount / users.data.length * 100) : 0}%` }} /></div>
              <span className="progress-description">Active within last hour</span>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="info-box bg-gray">
            <span className="info-box-icon"><WifiOff size={24} /></span>
            <div className="info-box-content">
              <span className="info-box-text">Offline</span>
              <span className="info-box-number">{(users.data?.length ?? 0) - onlineCount - recentCount}</span>
              <div className="progress"><div className="progress-bar" style={{ width: `${users.data?.length ? (((users.data.length - onlineCount - recentCount) / users.data.length) * 100) : 0}%` }} /></div>
              <span className="progress-description">Not recently active</span>
            </div>
          </div>
        </div>
      </div>

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
                  <th style={{ width: 30 }}></th>
                  <th>Login</th>
                  <th>Name</th>
                  <th style={{ width: 200 }}>Organisation</th>
                  <th style={{ width: 150 }}>Profile</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 160 }}>Last Login</th>
                  <th style={{ width: 160 }}>Dates C. / U.</th>
                  <th style={{ width: 200 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const onlineStatus = getOnlineStatus(user.last_login_at);
                  return (
                    <tr key={user.id ?? user.login}>
                      <td>
                        <span
                          title={onlineStatus.label}
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: onlineStatus.color,
                            boxShadow: onlineStatus.icon === 'online' ? `0 0 6px ${onlineStatus.color}` : 'none',
                          }}
                        />
                      </td>
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
                        <span className={user.status === 'Locked' || user.locked ? 'label label-danger' : 'label label-success'}>
                          {user.locked ? 'Locked' : (user.status ?? 'Ok')}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: onlineStatus.color, fontSize: '0.85rem' }}>
                          {onlineStatus.icon === 'online' && <Wifi size={11} style={{ marginRight: 4 }} />}
                          {onlineStatus.icon === 'offline' && <WifiOff size={11} style={{ marginRight: 4 }} />}
                          {onlineStatus.icon === 'recent' && <Clock size={11} style={{ marginRight: 4 }} />}
                          {fmtDateTime(user.last_login_at)}
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
                          onClick={() => lock.mutate({ login: user.login, locked: !(user.locked || user.status === 'Locked') })}
                          title={user.locked || user.status === 'Locked' ? 'Unlock user' : 'Lock user'}
                        >
                          {user.locked || user.status === 'Locked' ? 'Unlock' : 'Lock'}
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
                  );
                })}
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
