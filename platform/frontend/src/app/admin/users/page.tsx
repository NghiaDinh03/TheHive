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

      {/* Online status summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded bg-green-900/50 text-green-500 flex items-center justify-center shrink-0">
            <Wifi size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Online Now</div>
            <div className="text-2xl font-semibold text-slate-200 mb-2">{onlineCount}</div>
            <div className="w-full h-1.5 bg-slate-700 rounded overflow-hidden mb-1">
              <div className="h-full bg-green-500" style={{ width: `${users.data?.length ? (onlineCount / users.data.length * 100) : 0}%` }} />
            </div>
            <div className="text-xs text-slate-500 truncate">{onlineCount} of {users.data?.length ?? 0} users active</div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded bg-yellow-900/50 text-yellow-500 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Recently Active</div>
            <div className="text-2xl font-semibold text-slate-200 mb-2">{recentCount}</div>
            <div className="w-full h-1.5 bg-slate-700 rounded overflow-hidden mb-1">
              <div className="h-full bg-yellow-500" style={{ width: `${users.data?.length ? (recentCount / users.data.length * 100) : 0}%` }} />
            </div>
            <div className="text-xs text-slate-500 truncate">Active within last hour</div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded bg-slate-900 text-slate-500 flex items-center justify-center shrink-0">
            <WifiOff size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Offline</div>
            <div className="text-2xl font-semibold text-slate-200 mb-2">{(users.data?.length ?? 0) - onlineCount - recentCount}</div>
            <div className="w-full h-1.5 bg-slate-700 rounded overflow-hidden mb-1">
              <div className="h-full bg-slate-500" style={{ width: `${users.data?.length ? (((users.data.length - onlineCount - recentCount) / users.data.length) * 100) : 0}%` }} />
            </div>
            <div className="text-xs text-slate-500 truncate">Not recently active</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg shadow-md border border-slate-700 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/50 flex flex-wrap gap-4 justify-between items-center">
          <h3 className="text-blue-500 font-medium text-lg flex items-center gap-2">
            <Users size={16} /> List of users ({filtered.length} of {users.data?.length ?? 0})
          </h3>
          <div className="flex items-center gap-2">
            <button className="thehive-btn-primary flex items-center gap-2" onClick={() => { setCreating(true); setEditing(null); }}>
              <Plus size={14} /> Add user
            </button>
            <button className={`thehive-btn-secondary flex items-center gap-2 ${showFilters ? 'bg-slate-700 text-slate-200 border-slate-600' : ''}`} onClick={() => setShowFilters((v) => !v)}>
              <Filter size={14} /> Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-slate-900/50 p-6 border-b border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Search</span>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-500" />
                  <input
                    className="thehive-input pl-9 py-1.5"
                    placeholder="Login, name or email"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {users.isLoading && <div className="text-center py-10 text-slate-500">Loading users…</div>}
          {!users.isLoading && filtered.length === 0 && <div className="text-center py-10 text-slate-500">No users found.</div>}
          {filtered.length > 0 && (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-700 text-slate-400">
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 font-medium">Login</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Organisation</th>
                  <th className="px-4 py-3 font-medium">Profile</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Dates C. / U.</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((user) => {
                  const onlineStatus = getOnlineStatus(user.last_login_at);
                  return (
                    <tr key={user.id ?? user.login} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <span
                          title={onlineStatus.label}
                          className="inline-block w-2.5 h-2.5 rounded-full shadow-sm"
                          style={{
                            backgroundColor: onlineStatus.color,
                            boxShadow: onlineStatus.icon === 'online' ? `0 0 6px ${onlineStatus.color}` : 'none',
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <strong className="text-slate-200">{user.login}</strong>
                        {user.email && <div className="text-slate-500 text-xs mt-0.5">{user.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{user.name}</td>
                      <td className="px-4 py-3 text-slate-400">{user.organisation ?? <em className="text-slate-500">None</em>}</td>
                      <td className="px-4 py-3">
                        {user.profile
                          ? <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{user.profile}</span>
                          : <em className="text-slate-500">None</em>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${user.locked || user.status === 'Locked' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                          {user.locked ? 'Locked' : (user.status ?? 'Ok')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center text-xs" style={{ color: onlineStatus.color }}>
                          {onlineStatus.icon === 'online' && <Wifi size={12} className="mr-1.5" />}
                          {onlineStatus.icon === 'offline' && <WifiOff size={12} className="mr-1.5" />}
                          {onlineStatus.icon === 'recent' && <Clock size={12} className="mr-1.5" />}
                          {fmtDateTime(user.last_login_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 flex flex-col gap-0.5">
                        <div>C. {fmt(user.created_at)}</div>
                        <div>U. {fmt(user.updated_at)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="thehive-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                            onClick={() => { setEditing(user); setCreating(false); }}
                            title="Edit user"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            className="thehive-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                            onClick={() => lock.mutate({ login: user.login, locked: !(user.locked || user.status === 'Locked') })}
                            title={user.locked || user.status === 'Locked' ? 'Unlock user' : 'Lock user'}
                          >
                            {user.locked || user.status === 'Locked' ? 'Unlock' : 'Lock'}
                          </button>
                          <button
                            className="py-1 px-2.5 text-xs flex items-center gap-1 text-red-400 bg-red-900/10 hover:bg-red-900/30 border border-red-900/30 hover:border-red-500/50 rounded transition-colors"
                            onClick={() => { if (confirm(`Delete user "${user.login}"?`)) remove.mutate(user.login); }}
                            title="Delete user"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-blue-500 font-medium text-lg">{user ? `Edit user: ${user.login}` : 'Create user'}</h3>
          <button className="text-slate-400 hover:text-slate-200 transition-colors" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Login</label>
              <input name="login" className="thehive-input" defaultValue={user?.login ?? ''} required placeholder="user@example.com" readOnly={!!user} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Name</label>
              <input name="name" className="thehive-input" defaultValue={user?.name ?? ''} required placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email</label>
              <input name="email" type="email" className="thehive-input" defaultValue={user?.email ?? ''} placeholder="Email address" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Organisation</label>
              <input name="organisation" className="thehive-input" defaultValue={user?.organisation ?? ''} placeholder="Organisation name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Profile</label>
              <input name="profile" className="thehive-input" defaultValue={user?.profile ?? ''} placeholder="Profile name" />
            </div>
            {!user && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Password</label>
                <input name="password" type="password" className="thehive-input" required placeholder="Initial password" />
              </div>
            )}
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
