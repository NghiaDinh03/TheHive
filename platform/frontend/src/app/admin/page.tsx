'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Lock, Mail, Shield, Unlock, UserCheck, UserPlus, Users, Trash2, Edit2, Info, Activity, User, Search } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError, type RequestOptions } from '@/lib/api';
import { LEGACY_PERMISSIONS, PERMISSION_METADATA, type Permission } from '@/lib/permissions';

type User = { login: string; name: string; organisation: string; profile: string; permissions?: string[] };
type Collection<T> = { values: T[]; total: number };
type AdminUser = { login: string; name: string; organisation: string; profile: string; status: string; locked: boolean; must_change_password: boolean; force_2fa: boolean; last_login_at?: string; created_at: string; updated_at: string };
type Organisation = { id: string; name: string; description: string; created_at: string; updated_at: string };
type Profile = { id: string; name: string; permissions: string[]; created_at: string; updated_at: string };
type TokenResponse = { token?: string; invite_token?: string; delivery?: string; invite_delivery?: string; expires_at?: string; invite_expires_at?: string };
type AuditEvent = { id: string; actor_id: string; action: string; entity_type: string; entity_id: string; request_id?: string; created_at: string };
type Tab = 'users' | 'organisations' | 'profiles' | 'audit' | 'regex';

const defaultPermissions = [...LEGACY_PERMISSIONS];

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepUpPending, setStepUpPending] = useState<{ retry: (code: string) => void, cancel: () => void, actionDesc?: string } | null>(null);

  const stepUpFetch = async <T,>(path: string, opts: RequestOptions = {}, actionDesc?: string): Promise<T> => {
    try {
      return await apiFetch<T>(path, opts);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401 && e.problem.detail?.includes('missing X-TOTP-Code')) {
        return new Promise<T>((resolve, reject) => {
          setStepUpPending({
            actionDesc,
            retry: async (code: string) => {
              setStepUpPending(null);
              try {
                const headers = new Headers(opts.headers);
                headers.set('X-TOTP-Code', code);
                resolve(await apiFetch<T>(path, { ...opts, headers }));
              } catch (retryErr) {
                reject(retryErr);
              }
            },
            cancel: () => {
              setStepUpPending(null);
              reject(new Error('2FA verification cancelled'));
            }
          });
        });
      }
      throw e;
    }
  };

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login') || localStorage.getItem('thehive.login');
    if (!login) router.replace('/login'); else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<User>('/api/v1/auth/me'), enabled: !!authedLogin });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => apiFetch<Collection<AdminUser>>('/api/v1/admin/users'), enabled: !!authedLogin });
  const organisations = useQuery({ queryKey: ['admin-organisations'], queryFn: () => apiFetch<Collection<Organisation>>('/api/v1/admin/organisations'), enabled: !!authedLogin });
  const profiles = useQuery({ queryKey: ['admin-profiles'], queryFn: () => apiFetch<Collection<Profile>>('/api/v1/admin/profiles'), enabled: !!authedLogin });
  const audit = useQuery({ queryKey: ['admin-audit'], queryFn: () => apiFetch<Collection<AuditEvent>>('/api/v1/audit?limit=100'), enabled: !!authedLogin && activeTab === 'audit' });

  const canManageUsers = hasPermission(me.data, 'manageUser');
  const canManageOrgs = hasPermission(me.data, 'manageOrganisation');
  const canManageProfiles = hasPermission(me.data, 'manageProfile');

  function reportSuccess(text: string) { setError(null); setMessage(text); }
  function reportError(e: unknown) { setMessage(null); setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : 'Action failed'); }
  function reportToken(prefix: string, response: TokenResponse) {
    const token = response.token || response.invite_token;
    const delivery = response.delivery || response.invite_delivery || 'email-placeholder';
    const expires = response.expires_at || response.invite_expires_at;
    if (token) {
      const resetUrl = `${window.location.origin}/reset-password?token=${token}`;
      reportSuccess(`${prefix}. Reset link (Local): ${resetUrl} (Please copy this link and send to user). Expires at: ${formatDate(expires)}`);
    } else {
      reportSuccess(`${prefix}. Delivery method: ${delivery}.`);
    }
  }

  const lockMutation = useMutation({ mutationFn: ({ login, locked }: { login: string; locked: boolean }) => stepUpFetch(`/api/v1/admin/users/${encodeURIComponent(login)}/${locked ? 'lock' : 'unlock'}`, { method: 'POST' }, `${locked ? 'Lock' : 'Unlock'} User ${login}`), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportSuccess('User lock state updated.'); }, onError: reportError });
  const resetMutation = useMutation({ mutationFn: ({ login, password }: { login: string; password: string }) => stepUpFetch(`/api/v1/admin/users/${encodeURIComponent(login)}/reset-password`, { method: 'POST', json: { password, must_change_password: true } }), onSuccess: () => reportSuccess('Password reset; user must change password on next login.'), onError: reportError });
  const resetTokenMutation = useMutation({ mutationFn: (login: string) => stepUpFetch<TokenResponse>(`/api/v1/admin/users/${encodeURIComponent(login)}/reset-token`, { method: 'POST', json: {} }), onSuccess: (data) => reportToken('Reset token generated', data), onError: reportError });
  const approveMutation = useMutation({ mutationFn: ({ login, organisation, profile }: { login: string; organisation: string; profile: string }) => stepUpFetch<TokenResponse>(`/api/v1/admin/users/${encodeURIComponent(login)}/approve`, { method: 'POST', json: { organisation, profile, send_invite: true } }), onSuccess: async (data) => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportToken('User approved and invite generated', data); }, onError: reportError });
  const createUserMutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => stepUpFetch<TokenResponse>('/api/v1/admin/users', { method: 'POST', json: payload }), onSuccess: async (data) => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportToken('User created', data); }, onError: reportError });
  const updateUserMutation = useMutation({ mutationFn: ({ login, payload }: { login: string; payload: Record<string, unknown> }) => stepUpFetch(`/api/v1/admin/users/${encodeURIComponent(login)}`, { method: 'PATCH', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportSuccess('User updated successfully.'); }, onError: reportError });
  const upsertOrgMutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => stepUpFetch('/api/v1/admin/organisations', { method: 'POST', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] }); reportSuccess('Organisation created.'); }, onError: reportError });
  const updateOrgMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => stepUpFetch(`/api/v1/admin/organisations/${encodeURIComponent(id)}`, { method: 'PATCH', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] }); reportSuccess('Organisation updated.'); }, onError: reportError });
  const deleteOrgMutation = useMutation({ mutationFn: (id: string) => stepUpFetch(`/api/v1/admin/organisations/${encodeURIComponent(id)}`, { method: 'DELETE' }, `Delete Organisation ${id}`), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] }); reportSuccess('Organisation deleted.'); }, onError: reportError });
  const upsertProfileMutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => stepUpFetch('/api/v1/admin/profiles', { method: 'POST', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] }); reportSuccess('Profile created.'); }, onError: reportError });
  const updateProfileMutation = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => stepUpFetch(`/api/v1/admin/profiles/${encodeURIComponent(id)}`, { method: 'PATCH', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] }); reportSuccess('Profile updated.'); }, onError: reportError });
  const deleteProfileMutation = useMutation({ mutationFn: (id: string) => stepUpFetch(`/api/v1/admin/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }, `Delete Profile ${id}`), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] }); reportSuccess('Profile deleted.'); }, onError: reportError });
  const deleteUserMutation = useMutation({ mutationFn: (login: string) => stepUpFetch(`/api/v1/admin/users/${encodeURIComponent(login)}`, { method: 'DELETE' }, `Delete User ${login}`), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportSuccess('User deleted.'); }, onError: reportError });

  if (!authedLogin) return null;

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={me.data ? { login: me.data.login, name: me.data.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Administration <small>users, organisations, profiles &amp; audit</small></h1>
            <ol className="breadcrumb"><li>Home</li><li className="active">Admin</li></ol>
          </section>
          <section className="content">
            {message && <div className="alert alert-success alert-dismissible"><button type="button" className="close" onClick={() => setMessage(null)}>×</button>{message}</div>}
            {error && <div className="alert alert-danger alert-dismissible"><button type="button" className="close" onClick={() => setError(null)}>×</button>{error}</div>}
            <div className="row mb-4">
              <div className="col-md-4"><div className="box box-primary"><div className="box-body flex items-center gap-3"><Users size={24} className="text-primary" /><div><div className="text-2xl font-medium">{users.data?.total ?? 0}</div><div className="text-muted text-sm">Users</div></div></div></div></div>
              <div className="col-md-4"><div className="box box-primary"><div className="box-body flex items-center gap-3"><Building2 size={24} className="text-primary" /><div><div className="text-2xl font-medium">{organisations.data?.total ?? 0}</div><div className="text-muted text-sm">Organisations</div></div></div></div></div>
              <div className="col-md-4"><div className="box box-primary"><div className="box-body flex items-center gap-3"><Shield size={24} className="text-primary" /><div><div className="text-2xl font-medium">{profiles.data?.total ?? 0}</div><div className="text-muted text-sm">Profiles</div></div></div></div></div>
            </div>
            <div className="box">
              <div className="box-header with-border">
                <div className="thehive-tabs">
                  <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Users</button>
                  <button className={activeTab === 'organisations' ? 'active' : ''} onClick={() => setActiveTab('organisations')}>Organisations</button>
                  <button className={activeTab === 'profiles' ? 'active' : ''} onClick={() => setActiveTab('profiles')}>Profiles</button>
                  <button className={activeTab === 'audit' ? 'active' : ''} onClick={() => setActiveTab('audit')}>Audit</button>
                  <button className={activeTab === 'regex' ? 'active' : ''} onClick={() => setActiveTab('regex')}>Regex Log Parser</button>
                </div>
              </div>
              <div className="box-body p-0">
                {activeTab === 'users' && <UsersAdmin values={users.data?.values ?? []} profiles={profiles.data?.values ?? []} organisations={organisations.data?.values ?? []} canManage={canManageUsers} loading={users.isLoading} onCreate={(payload) => createUserMutation.mutate(payload)} onUpdate={(login, payload) => updateUserMutation.mutate({ login, payload })} onToggleLock={(login, locked) => lockMutation.mutate({ login, locked })} onResetPassword={(login, password) => resetMutation.mutate({ login, password })} onResetToken={(login) => resetTokenMutation.mutate(login)} onApprove={(login, organisation, profile) => approveMutation.mutate({ login, organisation, profile })} onDelete={(login) => deleteUserMutation.mutate(login)} />}
                {activeTab === 'organisations' && <OrganisationAdmin values={organisations.data?.values ?? []} canManage={canManageOrgs} loading={organisations.isLoading} onCreate={(payload) => upsertOrgMutation.mutate(payload)} onUpdate={(id, payload) => updateOrgMutation.mutate({ id, payload })} onDelete={(id) => { if(window.confirm('Delete organisation?')) deleteOrgMutation.mutate(id); }} />}
                {activeTab === 'profiles' && <ProfileAdmin values={profiles.data?.values ?? []} canManage={canManageProfiles} loading={profiles.isLoading} onCreate={(payload) => upsertProfileMutation.mutate(payload)} onUpdate={(id, payload) => updateProfileMutation.mutate({ id, payload })} onDelete={(id) => { if(window.confirm('Delete profile?')) deleteProfileMutation.mutate(id); }} />}
                {activeTab === 'audit' && <AuditAdmin values={audit.data?.values ?? []} loading={audit.isLoading} />}
                {activeTab === 'regex' && <RegexAdmin />}
              </div>
            </div>
          </section>
        </main>
      </div>

      {stepUpPending && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-[1100]">
          <div className="bg-gray-900 border border-red-500/50 rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden">
            <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
              <Shield size={20} className="text-white" />
              <h3 className="text-white font-medium text-lg m-0">Security Verification (Step-Up 2FA)</h3>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center mb-6">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium mb-4 w-full text-center">
                  This action requires administrative privileges
                </div>
                {stepUpPending.actionDesc && (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-full text-center shadow-inner">
                    <span className="text-gray-400 text-xs uppercase tracking-wider block mb-1">Action in progress</span>
                    <strong className="text-white text-base">{stepUpPending.actionDesc}</strong>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <p className="text-gray-400 text-sm mb-3">Please enter the 2FA code from your Authenticator app to confirm.</p>
                <input
                  type="text"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-center font-mono text-3xl tracking-[0.4em] text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-gray-600"
                  placeholder="------"
                  maxLength={6}
                  id="totp-step-up"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const code = (e.target as HTMLInputElement).value;
                      if (code.length === 6) stepUpPending.retry(code);
                    } else if (e.key === 'Escape') {
                      stepUpPending.cancel();
                    }
                  }}
                />
              </div>
            </div>
            <div className="bg-gray-800/80 px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors" onClick={stepUpPending.cancel}>Cancel</button>
              <button 
                className="px-5 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2" 
                onClick={() => {
                  const input = document.getElementById('totp-step-up') as HTMLInputElement;
                  if (input && input.value.length === 6) stepUpPending.retry(input.value);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function UsersAdmin({ values, profiles, organisations, canManage, loading, onCreate, onUpdate, onToggleLock, onResetPassword, onResetToken, onApprove, onDelete }: { values: AdminUser[]; profiles: Profile[]; organisations: Organisation[]; canManage: boolean; loading: boolean; onCreate: (payload: Record<string, unknown>) => void; onUpdate: (login: string, payload: Record<string, unknown>) => void; onToggleLock: (login: string, locked: boolean) => void; onResetPassword: (login: string, password: string) => void; onResetToken: (login: string) => void; onApprove: (login: string, organisation: string, profile: string) => void; onDelete: (login: string) => void }) {
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (editMode && selected) {
      onUpdate(selected.login, { name: form.get('name'), organisation: form.get('organisation'), profile: form.get('profile'), force_2fa: form.get('force_2fa') === 'on' });
      setEditMode(false);
      setSelected(null);
    } else {
      onCreate({ login: form.get('login'), name: form.get('name'), organisation: form.get('organisation'), profile: form.get('profile'), password: form.get('password'), must_change_password: true, send_invite: form.get('send_invite') === 'on' });
    }
    event.currentTarget.reset();
  }

  function startEdit(user: AdminUser) {
    setSelected(user);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSelected(null);
  }

  const defaultOrg = selected?.organisation || organisations[0]?.name || 'admin';
  const defaultProfile = selected?.profile || profiles[0]?.name || 'admin';
  
  const visibleUsers = values.filter(u => u.login !== 'admin@thehive.local' && u.login !== 'ncs.fushion_admin@ncsgroup.vn');
  const filteredUsers = visibleUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.login.toLowerCase().includes(searchTerm.toLowerCase()));
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="w-full flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium text-lg m-0">{filteredUsers.length} users</h3>
            <div className="relative group flex items-center justify-center cursor-help">
              <Info size={14} className="text-gray-400 hover:text-blue-400 transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl text-center">
                Pending users require admin approval + invite token before password setup
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="Filter users by name or login..." className="w-full bg-gray-900 border border-gray-800 text-sm text-white rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-500 shadow-inner" value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setPage(1);}} />
            </div>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow whitespace-nowrap" disabled={!canManage} onClick={() => { setSelected(null); setEditMode(true); }}>
              <UserPlus size={14} /> Create
            </button>
          </div>
        </div>
        
        {loading ? <div className="flex flex-col items-center justify-center py-16 px-4"><Activity className="text-gray-600 animate-pulse mb-3" size={32} /><p className="text-gray-400">Loading users...</p></div> : 
        <div className="overflow-x-auto bg-gray-900/30 rounded-xl border border-gray-800/50 flex-1">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-5 py-4 font-bold text-sm">User &amp; Session</th>
                <th className="px-5 py-4 font-bold text-sm">Full Name &amp; Org</th>
                <th className="px-5 py-4 font-bold text-sm">Profile / Role</th>
                <th className="px-5 py-4 font-bold text-sm">Status</th>
                <th className="px-5 py-4 font-bold text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {paginatedUsers.map((user) => (
                <tr key={user.login} className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${selected?.login === user.login && !editMode ? 'bg-gray-800/50' : ''}`} onClick={() => !editMode && setSelected(user)}>
                  <td className="px-5 py-4 font-medium whitespace-nowrap">
                    <div className="text-base font-semibold text-white">{user.login}</div>
                    <div className="text-xs text-slate-500 mt-1">Last login: {formatDate(user.last_login_at)}</div>
                    {user.must_change_password && <div className="mt-1.5"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">must change password</span></div>}
                    {user.force_2fa && <div className="mt-1.5"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">Force 2FA</span></div>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-base text-slate-200 font-medium">{user.name}</div>
                    <div className="text-xs text-slate-500 mt-1">Org: {user.organisation}</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">{user.profile}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${user.locked ? 'bg-red-500/20 text-red-400 border-red-500/30' : user.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'}`}>
                      {user.locked ? 'Locked' : user.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-3">
                      <button disabled={!canManage || user.status !== 'Pending'} className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); onApprove(user.login, defaultOrg, defaultProfile); }} title="Approve"><UserCheck size={14} /></button>
                      <button disabled={!canManage} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); startEdit(user); }} title="Edit"><Edit2 size={14} /></button>
                      <button disabled={!canManage} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); onToggleLock(user.login, !user.locked); }} title={user.locked ? 'Unlock' : 'Lock'}>{user.locked ? <Unlock size={14} /> : <Lock size={14} />}</button>
                      <button disabled={!canManage} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); onResetToken(user.login); }} title="Token"><Mail size={14} /></button>
                      <button disabled={!canManage} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); const password = window.prompt('New temporary password (policy enforced by backend)', 'ChangeMe12345@'); if (password) onResetPassword(user.login, password); }} title="Reset Password"><KeyRound size={14} /></button>
                      <button disabled={!canManage} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); onDelete(user.login); }} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800/30 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Show:</span>
              <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-blue-500" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Prev</button>
              <span className="text-xs text-gray-500 mx-2">Page {page} of {Math.ceil(filteredUsers.length / pageSize) || 1}</span>
              <button disabled={page >= Math.ceil(filteredUsers.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>}
      </div>
      
      {editMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[1050]" onClick={cancelEdit}>
          <form className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col" onSubmit={submit} key={selected ? selected.login : 'create'} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-2 text-white font-medium">
              {selected ? <><Shield size={16} /> Edit user</> : <><UserPlus size={16} /> Create / invite user</>}
            </div>
            <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Login</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="login" placeholder="login@example.com" required defaultValue={selected ? selected.login : ''} disabled={!!selected} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Full Name</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="name" placeholder="Full name" required defaultValue={selected ? selected.name : ''} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Organisation</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="organisation" required defaultValue={selected ? selected.organisation : ''}>
                  {organisations.map((org) => <option key={org.id} value={org.name}>{org.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Profile</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="profile" required defaultValue={selected ? selected.profile : ''}>
                  {profiles.map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
                </select>
              </div>
              
              {selected && (
                <label className="flex items-center gap-2 cursor-pointer p-3 border border-red-500/30 bg-red-500/10 rounded-md">
                  <input type="checkbox" name="force_2fa" defaultChecked={selected.force_2fa} className="accent-red-500 w-4 h-4" />
                  <span className="text-red-400 text-sm font-medium">Force 2FA (Security)</span>
                </label>
              )}
              
              {!selected && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Password (Optional)</label>
                    <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="password" placeholder="Leave blank to send invite" type="password" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-2 text-sm text-gray-300">
                    <input type="checkbox" name="send_invite" defaultChecked className="accent-blue-500 w-4 h-4" />
                    <span>Send invite token / email</span>
                  </label>
                </>
              )}
            </div>
            <div className="bg-gray-800/50 border-t border-gray-700 px-4 py-3 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors" onClick={cancelEdit}>Cancel</button>
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" disabled={!canManage}>{selected ? 'Update user' : 'Create user'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function OrganisationAdmin({ values, canManage, loading, onCreate, onUpdate, onDelete }: { values: Organisation[]; canManage: boolean; loading: boolean; onCreate: (payload: Record<string, unknown>) => void; onUpdate: (id: string, payload: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<Organisation | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function submit(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); 
    const form = new FormData(event.currentTarget); 
    const payload = { name: form.get('name'), description: form.get('description') };
    if (editMode && selected) {
      onUpdate(selected.id, payload);
      setEditMode(false);
      setSelected(null);
    } else {
      onCreate(payload);
    }
    event.currentTarget.reset(); 
  }

  function startEdit(org: Organisation) {
    setSelected(org);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSelected(null);
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="w-full flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium text-lg m-0">{values.length} Organisations</h3>
            <div className="relative group flex items-center justify-center cursor-help">
              <Info size={14} className="text-gray-400 hover:text-blue-400 transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl text-center">
                Manage tenants and isolated workspaces
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow whitespace-nowrap w-full sm:w-auto justify-center" disabled={!canManage} onClick={() => { setSelected(null); setEditMode(true); }}>
            <Building2 size={14} /> Create
          </button>
        </div>
        {loading ? <div className="flex flex-col items-center justify-center py-16 px-4"><Activity className="text-gray-600 animate-pulse mb-3" size={32} /><p className="text-gray-400">Loading organisations...</p></div> : 
        <div className="overflow-x-auto bg-gray-900/30 rounded-xl border border-gray-800/50 flex-1">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-5 py-4 font-medium">Name</th>
                <th className="px-5 py-4 font-medium">Description</th>
                <th className="px-5 py-4 font-medium">Created</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {values.slice((page - 1) * pageSize, page * pageSize).map((org) => 
                <tr key={org.id} className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${selected?.id === org.id && !editMode ? 'bg-gray-800/50' : ''}`} onClick={() => !editMode && setSelected(org)}>
                  <td className="px-5 py-3 font-medium text-white whitespace-nowrap" style={{ width: '20%' }}>{org.name}</td>
                  <td className="px-5 py-3 text-gray-400" style={{ width: '40%' }}>{org.description || 'None'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500" style={{ width: '25%' }}>{formatDate(org.created_at)}</td>
                  <td className="px-5 py-3" style={{ width: '15%' }}>
                    <div className="flex items-center justify-end gap-3">
                      <button disabled={!canManage} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); startEdit(org); }} title="Edit"><Edit2 size={14} /></button>
                      <button disabled={!canManage} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); onDelete(org.id); }} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800/30 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Show:</span>
              <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-blue-500" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Prev</button>
              <span className="text-xs text-gray-500 mx-2">Page {page} of {Math.ceil(values.length / pageSize) || 1}</span>
              <button disabled={page >= Math.ceil(values.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>}
      </div>
      
      {editMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[1050]" onClick={cancelEdit}>
          <form className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col" onSubmit={submit} key={selected ? selected.id : 'create'} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-2 text-white font-medium">
              {selected ? <><Building2 size={16} /> Edit organisation</> : <><Building2 size={16} /> Create organisation</>}
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Organisation Name</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="name" placeholder="Name" required defaultValue={selected ? selected.name : ''} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="description" placeholder="Description" rows={4} defaultValue={selected ? selected.description : ''} />
              </div>
            </div>
            <div className="bg-gray-800/50 border-t border-gray-700 px-4 py-3 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors" onClick={cancelEdit}>Cancel</button>
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" disabled={!canManage}>{selected ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ProfileAdmin({ values, canManage, loading, onCreate, onUpdate, onDelete }: { values: Profile[]; canManage: boolean; loading: boolean; onCreate: (payload: Record<string, unknown>) => void; onUpdate: (id: string, payload: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const allPermissions = useMemo(() => Array.from(new Set([...defaultPermissions, ...values.flatMap((profile) => profile.permissions)])).sort(), [values]);

  const groups = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const p of allPermissions) {
      const group = PERMISSION_METADATA[p as Permission]?.group || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(p);
    }
    return acc;
  }, [allPermissions]);

  function submit(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); 
    const form = new FormData(event.currentTarget); 
    const payload = { name: form.get('name'), permissions: form.getAll('permissions') };
    if (editMode && selected) {
      onUpdate(selected.id, payload);
      setEditMode(false);
      setSelected(null);
    } else {
      onCreate(payload);
    }
  }

  function startEdit(profile: Profile) {
    setSelected(profile);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSelected(null);
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="w-full flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium text-lg m-0">{values.length} Profiles</h3>
            <div className="relative group flex items-center justify-center cursor-help">
              <Info size={14} className="text-gray-400 hover:text-blue-400 transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl text-center">
                Manage roles and permissions (RBAC)
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow whitespace-nowrap w-full sm:w-auto justify-center" disabled={!canManage} onClick={() => { setSelected(null); setEditMode(true); }}>
            <Shield size={14} /> Create
          </button>
        </div>
        {loading ? <div className="flex flex-col items-center justify-center py-16 px-4"><Activity className="text-gray-600 animate-pulse mb-3" size={32} /><p className="text-gray-400">Loading profiles...</p></div> : 
        <div className="overflow-x-auto bg-gray-900/30 rounded-xl border border-gray-800/50 flex-1">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-5 py-4 font-medium">Name</th>
                <th className="px-5 py-4 font-medium">Permissions</th>
                <th className="px-5 py-4 font-medium">Updated</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {values.slice((page - 1) * pageSize, page * pageSize).map((profile) => 
                <tr key={profile.id} className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${selected?.id === profile.id && !editMode ? 'bg-gray-800/50' : ''}`} onClick={() => !editMode && setSelected(profile)}>
                  <td className="px-5 py-3 font-medium text-white whitespace-nowrap" style={{ width: '15%' }}>{profile.name}</td>
                  <td className="px-5 py-3" style={{ width: '60%' }}><TagList tags={profile.permissions} /></td>
                  <td className="px-5 py-3 text-xs text-gray-500" style={{ width: '15%' }}>{formatDate(profile.updated_at)}</td>
                  <td className="px-5 py-3" style={{ width: '10%', minWidth: '100px' }}>
                    <div className="flex items-center justify-end gap-3">
                      <button disabled={!canManage} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); startEdit(profile); }} title="Edit"><Edit2 size={14} /></button>
                      <button disabled={!canManage || profile.name === 'admin'} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50" onClick={(event) => { event.stopPropagation(); onDelete(profile.id); }} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800/30 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Show:</span>
              <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-blue-500" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Prev</button>
              <span className="text-xs text-gray-500 mx-2">Page {page} of {Math.ceil(values.length / pageSize) || 1}</span>
              <button disabled={page >= Math.ceil(values.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>}
      </div>

      {editMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[1050]" onClick={cancelEdit}>
          <form className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col" onSubmit={submit} key={selected ? selected.id : 'create'} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-2 text-white font-medium">
              {selected ? <><Shield size={16} /> Edit profile</> : <><Shield size={16} /> Create profile</>}
            </div>
            
            <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Profile Name</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" name="name" placeholder="Profile name" required defaultValue={selected ? selected.name : ''} disabled={selected?.name === 'admin'} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                {Object.entries(groups).map(([groupName, perms]) => (
                  <div key={groupName} className="border border-gray-700 rounded-lg bg-gray-800/50 p-4">
                    <h4 className="text-sm font-semibold mb-3 text-gray-400 uppercase tracking-wider">{groupName}</h4>
                    <div className="flex flex-col gap-2">
                      {perms.map((permission) => {
                        const meta = PERMISSION_METADATA[permission as Permission];
                        const isChecked = selected ? selected.permissions.includes(permission) : false;
                        return (
                          <label key={permission} className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" name="permissions" value={permission} defaultChecked={isChecked} disabled={selected?.name === 'admin'} className="accent-blue-500 w-4 h-4 rounded" /> 
                              <span className="font-medium text-sm text-gray-300 group-hover:text-white transition-colors">{meta?.label || permission}</span>
                            </div>
                            {meta?.description && (
                              <div title={meta.description}>
                                <Info size={14} className="text-gray-500 hover:text-blue-400 transition-colors" />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800/50 border-t border-gray-700 px-4 py-3 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors" onClick={cancelEdit}>Cancel</button>
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" disabled={!canManage}>{selected ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AuditAdmin({ values, loading }: { values: AuditEvent[]; loading: boolean }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="w-full flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium text-lg m-0">{values.length} Events</h3>
            <div className="relative group flex items-center justify-center cursor-help">
              <Info size={14} className="text-gray-400 hover:text-blue-400 transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl text-center">
                System audit log records all access
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Activity className="text-gray-600 animate-pulse mb-3" size={32} />
            <p className="text-gray-400">Loading audit stream...</p>
          </div>
        ) : values.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 m-4 border border-dashed border-gray-700 bg-gray-900/50 rounded-xl">
            <Activity className="text-gray-600 mb-3" size={32} />
            <h4 className="text-gray-300 font-medium mb-1">No Events Found</h4>
          </div>
        ) : (
          <div className="overflow-x-auto bg-gray-900/30 rounded-xl border border-gray-800/50 mt-4 flex-1">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-5 py-4 font-medium">Time</th>
                <th className="px-5 py-4 font-medium">Actor</th>
                <th className="px-5 py-4 font-medium">Action</th>
                <th className="px-5 py-4 font-medium">Entity</th>
                <th className="px-5 py-4 font-medium">Request</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {values.slice((page - 1) * pageSize, page * pageSize).map((event) => (
                <tr key={event.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-500">{formatDate(event.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1">
                      <User size={12} className="text-gray-500" />
                      <span className="text-sm font-medium text-white">{event.actor_id}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-700 text-gray-300 border border-gray-600">{event.action}</span></td>
                  <td className="px-4 py-3 text-sm"><span className="text-blue-400">{event.entity_type}:</span>{event.entity_id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 wrap">{event.request_id || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800/30 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Show:</span>
              <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-blue-500" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Prev</button>
              <span className="text-xs text-gray-500 mx-2">Page {page} of {Math.ceil(values.length / pageSize) || 1}</span>
              <button disabled={page >= Math.ceil(values.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function AdminStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="bg-gray-900 border border-gray-700 shadow-md rounded-lg p-4"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">{icon}</div><div><div className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-1">{label}</div><div className="text-2xl font-semibold text-white">{value}</div></div></div></div>; }
function TagList({ tags }: { tags: string[] }) { return <div className="flex flex-wrap gap-1 mt-1">{tags.length === 0 ? <strong className="text-gray-500 mr-1 text-xs">None</strong> : tags.map((tag) => <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-gray-800 border border-gray-700 text-gray-300">{tag}</span>)}</div>; }
function formatDate(value?: string) { if (!value) return 'Never'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'None'; return date.toLocaleString(); }
function hasPermission(user: User | undefined, permission: string) { return !!user?.permissions?.some((item) => item === permission || item === 'managePlatform'); }

type RegexRule = { id: string; name: string; regex_pattern: string; target_field: string; description: string; created_at: string };

function RegexAdmin() {
  const queryClient = useQueryClient();
  const [createMode, setCreateMode] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [targetField, setTargetField] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rules = useQuery({
    queryKey: ['regex-rules'],
    queryFn: () => apiFetch<RegexRule[]>('/api/v1/admin/custom-properties-regex'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiFetch<RegexRule>('/api/v1/admin/custom-properties-regex', { method: 'POST', json: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regex-rules'] });
      setCreateMode(false);
      setName('');
      setPattern('');
      setTargetField('');
      setDescription('');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err instanceof ApiError ? (err.problem.detail || err.problem.title) : 'Failed to create regex rule');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/admin/custom-properties-regex/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regex-rules'] });
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, regex_pattern: pattern, target_field: targetField, description });
  }

  const values = rules.data || [];
  const paginatedRules = values.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col w-full h-full p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium text-lg m-0">{values.length} Regex Rules</h3>
          <div className="relative group flex items-center justify-center cursor-help">
            <Info size={14} className="text-gray-400 hover:text-blue-400 transition-colors" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl text-center">
              Tự động phân tích và trích xuất các trường dữ liệu động từ log thô vào SIEM fields grid table.
            </div>
          </div>
        </div>
        <button 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow whitespace-nowrap justify-center"
          onClick={() => setCreateMode(true)}
        >
          <UserPlus size={14} /> Create Rule
        </button>
      </div>

      {rules.isLoading ? (
        <div className="flex flex-col items-center justify-center py-16"><Activity className="text-gray-600 animate-pulse mb-3" size={32} /><p className="text-gray-400">Loading regex rules...</p></div>
      ) : (
        <div className="overflow-x-auto bg-gray-900/30 rounded-xl border border-gray-800/50 flex-1">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase bg-gray-900/80 text-gray-400">
              <tr>
                <th className="px-5 py-4 font-medium">Name</th>
                <th className="px-5 py-4 font-medium">Regex Pattern</th>
                <th className="px-5 py-4 font-medium">Target Field</th>
                <th className="px-5 py-4 font-medium">Description</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {paginatedRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-800/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3 font-medium text-white whitespace-nowrap">{rule.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-yellow-400">{rule.regex_pattern}</td>
                  <td className="px-5 py-3 font-semibold text-blue-400"><span className="px-2 py-1 rounded text-xs bg-gray-700 border border-gray-600">{rule.target_field}</span></td>
                  <td className="px-5 py-3 text-gray-400">{rule.description || 'None'}</td>
                  <td className="px-5 py-3 text-right">
                    <button 
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                      onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this regex rule?')) deleteMutation.mutate(rule.id); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800/30 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Show:</span>
              <select className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-blue-500" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Prev</button>
              <span className="text-xs text-gray-500 mx-2">Page {page} of {Math.ceil(values.length / pageSize) || 1}</span>
              <button disabled={page >= Math.ceil(values.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-medium disabled:opacity-30 hover:bg-gray-700 hover:text-white transition-colors">Next</button>
            </div>
          </div>
        </div>
      )}

      {createMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[1050]" onClick={() => setCreateMode(false)}>
          <form className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 text-white font-medium flex items-center gap-2">
              <Shield size={16} /> Create Regex Property Parser Rule
            </div>
            {errorMsg && <div className="p-3 mx-4 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">{errorMsg}</div>}
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Rule Name</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Extract IPv4 Address" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Regex Pattern</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 font-mono text-white focus:border-blue-500 focus:outline-none" value={pattern} onChange={e => setPattern(e.target.value)} placeholder="e.g. \\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Target Custom Field Name</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" value={targetField} onChange={e => setTargetField(e.target.value)} placeholder="e.g. src_ip" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="Tóm tắt mục đích quy tắc..." rows={3} />
              </div>
            </div>
            <div className="bg-gray-800/50 border-t border-gray-700 px-4 py-3 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors" onClick={() => setCreateMode(false)}>Cancel</button>
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

