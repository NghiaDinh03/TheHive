'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Lock, Mail, Shield, Unlock, UserCheck, UserPlus, Users } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';
import { LEGACY_PERMISSIONS } from '@/lib/permissions';

type User = { login: string; name: string; organisation: string; profile: string; permissions?: string[] };
type Collection<T> = { values: T[]; total: number };
type AdminUser = { login: string; name: string; organisation: string; profile: string; status: string; locked: boolean; must_change_password: boolean; last_login_at?: string; created_at: string; updated_at: string };
type Organisation = { id: string; name: string; description: string; created_at: string; updated_at: string };
type Profile = { id: string; name: string; permissions: string[]; created_at: string; updated_at: string };
type TokenResponse = { token?: string; invite_token?: string; delivery?: string; invite_delivery?: string; expires_at?: string; invite_expires_at?: string };
type AuditEvent = { id: string; actor_id: string; action: string; entity_type: string; entity_id: string; request_id?: string; created_at: string };
type Tab = 'users' | 'organisations' | 'profiles' | 'audit';

const defaultPermissions = [...LEGACY_PERMISSIONS];

export default function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
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
    reportSuccess(token ? `${prefix}. Delivery: ${delivery}. Token: ${token}. Expires: ${formatDate(expires)}` : `${prefix}. Delivery: ${delivery}.`);
  }

  const lockMutation = useMutation({ mutationFn: ({ login, locked }: { login: string; locked: boolean }) => apiFetch(`/api/v1/admin/users/${encodeURIComponent(login)}/${locked ? 'lock' : 'unlock'}`, { method: 'POST' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportSuccess('User lock state updated.'); }, onError: reportError });
  const resetMutation = useMutation({ mutationFn: ({ login, password }: { login: string; password: string }) => apiFetch(`/api/v1/admin/users/${encodeURIComponent(login)}/reset-password`, { method: 'POST', json: { password, must_change_password: true } }), onSuccess: () => reportSuccess('Password reset; user must change password on next login.'), onError: reportError });
  const resetTokenMutation = useMutation({ mutationFn: (login: string) => apiFetch<TokenResponse>(`/api/v1/admin/users/${encodeURIComponent(login)}/reset-token`, { method: 'POST', json: {} }), onSuccess: (data) => reportToken('Reset token generated', data), onError: reportError });
  const approveMutation = useMutation({ mutationFn: ({ login, organisation, profile }: { login: string; organisation: string; profile: string }) => apiFetch<TokenResponse>(`/api/v1/admin/users/${encodeURIComponent(login)}/approve`, { method: 'POST', json: { organisation, profile, send_invite: true } }), onSuccess: async (data) => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportToken('User approved and invite generated', data); }, onError: reportError });
  const createUserMutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiFetch<TokenResponse>('/api/v1/admin/users', { method: 'POST', json: payload }), onSuccess: async (data) => { await queryClient.invalidateQueries({ queryKey: ['admin-users'] }); reportToken('User created', data); }, onError: reportError });
  const upsertOrgMutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiFetch('/api/v1/admin/organisations', { method: 'POST', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-organisations'] }); reportSuccess('Organisation saved.'); }, onError: reportError });
  const upsertProfileMutation = useMutation({ mutationFn: (payload: Record<string, unknown>) => apiFetch('/api/v1/admin/profiles', { method: 'POST', json: payload }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] }); reportSuccess('Profile saved.'); }, onError: reportError });

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
                </div>
              </div>
              <div className="box-body p-0">
                {activeTab === 'users' && <UsersAdmin values={users.data?.values ?? []} profiles={profiles.data?.values ?? []} organisations={organisations.data?.values ?? []} canManage={canManageUsers} loading={users.isLoading} onCreate={(payload) => createUserMutation.mutate(payload)} onToggleLock={(login, locked) => lockMutation.mutate({ login, locked })} onResetPassword={(login, password) => resetMutation.mutate({ login, password })} onResetToken={(login) => resetTokenMutation.mutate(login)} onApprove={(login, organisation, profile) => approveMutation.mutate({ login, organisation, profile })} />}
                {activeTab === 'organisations' && <OrganisationAdmin values={organisations.data?.values ?? []} canManage={canManageOrgs} loading={organisations.isLoading} onSave={(payload) => upsertOrgMutation.mutate(payload)} />}
                {activeTab === 'profiles' && <ProfileAdmin values={profiles.data?.values ?? []} canManage={canManageProfiles} loading={profiles.isLoading} onSave={(payload) => upsertProfileMutation.mutate(payload)} />}
                {activeTab === 'audit' && <AuditAdmin values={audit.data?.values ?? []} loading={audit.isLoading} />}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function UsersAdmin({ values, profiles, organisations, canManage, loading, onCreate, onToggleLock, onResetPassword, onResetToken, onApprove }: { values: AdminUser[]; profiles: Profile[]; organisations: Organisation[]; canManage: boolean; loading: boolean; onCreate: (payload: Record<string, unknown>) => void; onToggleLock: (login: string, locked: boolean) => void; onResetPassword: (login: string, password: string) => void; onResetToken: (login: string) => void; onApprove: (login: string, organisation: string, profile: string) => void }) {
  const [selected, setSelected] = useState<AdminUser | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onCreate({ login: form.get('login'), name: form.get('name'), organisation: form.get('organisation'), profile: form.get('profile'), password: form.get('password'), must_change_password: true, send_invite: form.get('send_invite') === 'on' });
    event.currentTarget.reset();
  }
  const defaultOrg = selected?.organisation || organisations[0]?.name || 'admin';
  const defaultProfile = selected?.profile || profiles[0]?.name || 'admin';
  return (
    <div className="admin-split">
      <div className="admin-table-pane">
        <div className="admin-toolbar"><strong>{values.length} users</strong><span>Pending users require admin approval + invite token before password setup</span></div>
        {loading ? <div className="thehive-empty m-4">Loading users...</div> : <table className="thehive-table legacy-case-list"><thead><tr><th>Login</th><th>Name</th><th>Organisation</th><th>Profile</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{values.map((user) => <tr key={user.login} className={selected?.login === user.login ? 'admin-selected-row' : ''} onClick={() => setSelected(user)}><td><strong>{user.login}</strong>{user.must_change_password && <div><span className="label label-warning">must change password</span></div>}</td><td>{user.name}</td><td>{user.organisation}</td><td><span className="label label-default">{user.profile}</span></td><td><span className={user.locked ? 'label label-danger' : user.status === 'Pending' ? 'label label-warning' : 'label label-success'}>{user.locked ? 'Locked' : user.status}</span></td><td className="date-stack"><span>{formatDate(user.last_login_at)}</span></td><td><button disabled={!canManage} className="admin-mini-btn" onClick={(event) => { event.stopPropagation(); onToggleLock(user.login, !user.locked); }}>{user.locked ? <Unlock size={12} /> : <Lock size={12} />}{user.locked ? 'Unlock' : 'Lock'}</button><button disabled={!canManage} className="admin-mini-btn" onClick={(event) => { event.stopPropagation(); onResetToken(user.login); }}><Mail size={12} />Token</button><button disabled={!canManage || user.status !== 'Pending'} className="admin-mini-btn" onClick={(event) => { event.stopPropagation(); onApprove(user.login, defaultOrg, defaultProfile); }}><UserCheck size={12} />Approve</button><button disabled={!canManage} className="admin-mini-btn" onClick={(event) => { event.stopPropagation(); const password = window.prompt('New temporary password (policy enforced by backend)', 'ChangeMe12345@'); if (password) onResetPassword(user.login, password); }}><KeyRound size={12} />Reset</button></td></tr>)}</tbody></table>}
      </div>
      <form className="admin-form-pane" onSubmit={submit}>
        <h3><UserPlus size={15} /> Create / invite user</h3>
        <input className="thehive-input" name="login" placeholder="login@example.com" required />
        <input className="thehive-input" name="name" placeholder="Full name" required />
        <select className="thehive-input" name="organisation" required>{organisations.map((org) => <option key={org.id} value={org.name}>{org.name}</option>)}</select>
        <select className="thehive-input" name="profile" required>{profiles.map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}</select>
        <input className="thehive-input" name="password" placeholder="Optional temp password; leave blank for invite" type="password" />
        <label className="admin-check"><input type="checkbox" name="send_invite" defaultChecked /> Send invite token / email</label>
        <button className="thehive-btn-primary" disabled={!canManage}>Create user</button>
      </form>
    </div>
  );
}

function OrganisationAdmin({ values, canManage, loading, onSave }: { values: Organisation[]; canManage: boolean; loading: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ name: form.get('name'), description: form.get('description') }); event.currentTarget.reset(); }
  return <div className="admin-split"><div className="admin-table-pane">{loading ? <div className="thehive-empty m-4">Loading organisations...</div> : <table className="thehive-table legacy-case-list"><thead><tr><th>Name</th><th>Description</th><th>Created</th><th>Updated</th></tr></thead><tbody>{values.map((org) => <tr key={org.id}><td><strong>{org.name}</strong></td><td>{org.description || 'None'}</td><td>{formatDate(org.created_at)}</td><td>{formatDate(org.updated_at)}</td></tr>)}</tbody></table>}</div><form className="admin-form-pane" onSubmit={submit}><h3><Building2 size={15} /> Save organisation</h3><input className="thehive-input" name="name" placeholder="Organisation name" required /><textarea className="thehive-input" name="description" placeholder="Description" /><button className="thehive-btn-primary" disabled={!canManage}>Save organisation</button></form></div>;
}

function ProfileAdmin({ values, canManage, loading, onSave }: { values: Profile[]; canManage: boolean; loading: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const allPermissions = useMemo(() => Array.from(new Set([...defaultPermissions, ...values.flatMap((profile) => profile.permissions)])).sort(), [values]);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ name: form.get('name'), permissions: form.getAll('permissions') }); }
  return <div className="admin-split"><div className="admin-table-pane">{loading ? <div className="thehive-empty m-4">Loading profiles...</div> : <table className="thehive-table legacy-case-list"><thead><tr><th>Name</th><th>Permissions</th><th>Updated</th></tr></thead><tbody>{values.map((profile) => <tr key={profile.id}><td><strong>{profile.name}</strong></td><td><TagList tags={profile.permissions} /></td><td>{formatDate(profile.updated_at)}</td></tr>)}</tbody></table>}</div><form className="admin-form-pane profile-editor" onSubmit={submit}><h3><Shield size={15} /> Permission editor</h3><input className="thehive-input" name="name" placeholder="Profile name" required /><div className="permission-grid">{allPermissions.map((permission) => <label key={permission} className="admin-check"><input type="checkbox" name="permissions" value={permission} /> {permission}</label>)}</div><button className="thehive-btn-primary" disabled={!canManage}>Save profile</button></form></div>;
}

function AuditAdmin({ values, loading }: { values: AuditEvent[]; loading: boolean }) {
  return <div className="admin-table-pane"><div className="admin-toolbar"><strong>{values.length} audit events</strong><span>Append-only audit stream · latest 100 events</span></div>{loading ? <div className="thehive-empty m-4">Loading audit stream...</div> : <table className="thehive-table legacy-case-list"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Request</th></tr></thead><tbody>{values.map((event) => <tr key={event.id}><td>{formatDate(event.created_at)}</td><td><strong>{event.actor_id}</strong></td><td><span className="label label-default">{event.action}</span></td><td>{event.entity_type}:{event.entity_id}</td><td className="wrap">{event.request_id || 'None'}</td></tr>)}</tbody></table>}</div>;
}

function AdminStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="thehive-card mini-stat mini-stat-blue"><div className="thehive-card-body flex items-center gap-3"><div className="mini-stat-icon">{icon}</div><div><div className="text-xs uppercase tracking-wide">{label}</div><div className="text-xl font-light">{value}</div></div></div></div>; }
function TagList({ tags }: { tags: string[] }) { return <div className="case-tags flexwrap mt-1">{tags.length === 0 ? <strong className="text-thehive-muted mr-1">None</strong> : tags.map((tag) => <span key={tag} className="tag-item">{tag}</span>)}</div>; }
function formatDate(value?: string) { if (!value) return 'Never'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'None'; return date.toLocaleString(); }
function hasPermission(user: User | undefined, permission: string) { return !!user?.permissions?.some((item) => item === permission || item === 'managePlatform'); }
