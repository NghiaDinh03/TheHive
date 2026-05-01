'use client';

/**
 * Personal Settings page.
 * Mirrors legacy frontend/app/views/partials/personal-settings.html
 * Sections: basic info (username, name), profile/permissions display, password change, API key.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, Save, User, UserCircle2 } from '@/components/FaIcon';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { apiFetch, ApiError } from '@/lib/api';
import { LEGACY_PERMISSIONS } from '@/lib/permissions';

type UserProfile = {
  login: string;
  name: string;
  organisation: string;
  profile: string;
  permissions: string[];
  must_change_password?: boolean;
};

type ApiKeyResponse = { api_key?: string; expires_at?: string };

export default function PersonalSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authedLogin, setAuthedLogin] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Basic info form
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);

  // Password form
  const [changePass, setChangePass] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // API key
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const login = sessionStorage.getItem('thehive.login');
    if (!login) router.replace('/login');
    else setAuthedLogin(login);
  }, [router]);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserProfile>('/api/v1/auth/me'),
    enabled: !!authedLogin,
  });

  useEffect(() => {
    if (me.data && !nameEdited) setName(me.data.name);
  }, [me.data, nameEdited]);

  function report(msg: string) { setError(null); setMessage(msg); }
  function reportErr(e: unknown) { setMessage(null); setError(e instanceof ApiError ? (e.problem.detail || e.problem.title) : String(e)); }

  const updateName = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/me', { method: 'PATCH', json: { name: name.trim() } }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['me'] }); report('Name updated successfully.'); setNameEdited(false); },
    onError: reportErr,
  });

  const updatePassword = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/change-password', { method: 'POST', json: { current_password: currentPassword, new_password: newPassword } }),
    onSuccess: () => { report('Password changed successfully.'); setChangePass(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); },
    onError: reportErr,
  });

  const generateApiKey = useMutation({
    mutationFn: () => apiFetch<ApiKeyResponse>('/api/v1/auth/api-key', { method: 'POST' }),
    onSuccess: (data) => { setApiKey(data.api_key ?? null); report('API key generated. Copy it now — it will not be shown again.'); },
    onError: reportErr,
  });

  function submitName(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) updateName.mutate();
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { reportErr('New passwords do not match.'); return; }
    if (newPassword.length < 8) { reportErr('New password must be at least 8 characters.'); return; }
    updatePassword.mutate();
  }

  if (!authedLogin) return null;

  const user = me.data;
  const userPermissions = user?.permissions ?? [];

  return (
    <div className="flex min-h-screen thehive-app-shell">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user ? { login: user.login, name: user.name } : { login: authedLogin }} />
        <main className="content-wrapper flex-1">
          <section className="content-header">
            <h1>Personal Settings <small>account &amp; security</small></h1>
            <ol className="breadcrumb">
              <li>Home</li>
              <li className="active">Personal Settings</li>
            </ol>
          </section>
          <section className="content">
            <div className="row">
              <div className="col-md-10 col-md-offset-1">

                {message && <div className="alert alert-success alert-dismissible"><button type="button" className="close" onClick={() => setMessage(null)}>×</button>{message}</div>}
                {error && <div className="alert alert-danger alert-dismissible"><button type="button" className="close" onClick={() => setError(null)}>×</button>{error}</div>}

                {/* Basic Info */}
                <form className="form-horizontal" onSubmit={submitName}>
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title"><UserCircle2 size={16} className="mr-1" /> Update basic information</h3>
                    </div>
                    <div className="box-body">
                      <div className="form-group">
                        <label className="col-md-3 control-label">Username</label>
                        <div className="col-md-9">
                          <input type="text" className="form-control input-sm" value={user?.login ?? ''} readOnly />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="col-md-3 control-label">Full name <i className="fa fa-asterisk text-danger" style={{ fontSize: '0.6rem' }} /></label>
                        <div className="col-md-9">
                          <input
                            type="text"
                            className="form-control input-sm"
                            placeholder="Full name"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setNameEdited(true); }}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="col-md-3 control-label">Organisation</label>
                        <div className="col-md-9">
                          <p className="form-control-static">{user?.organisation ?? '-'}</p>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="col-md-3 control-label">Profile</label>
                        <div className="col-md-9">
                          <p className="form-control-static">{user?.profile ?? '-'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="box-footer">
                      <button type="submit" className="btn btn-primary pull-right" disabled={updateName.isPending}>
                        <Save size={14} className="mr-1" />
                        {updateName.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <span className="text-muted text-sm"><i className="fa fa-asterisk text-danger" style={{ fontSize: '0.6rem' }} /> Required field</span>
                    </div>
                  </div>
                </form>

                {/* Permissions */}
                <div className="box">
                  <div className="box-header with-border">
                    <h3 className="box-title"><User size={16} className="mr-1" /> Permissions</h3>
                  </div>
                  <div className="box-body">
                    {userPermissions.length === 0 ? (
                      <p className="text-muted">No permissions assigned.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {userPermissions.map((perm) => (
                          <span key={perm} className="label label-default" style={{ fontSize: '0.78rem', padding: '3px 7px' }}>{perm}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-muted mt-2" style={{ fontSize: '0.82rem' }}>
                      Permissions are assigned by your administrator via your profile. Contact your admin to change them.
                    </p>
                  </div>
                </div>

                {/* Change Password */}
                <form className="form-horizontal" onSubmit={submitPassword}>
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title">
                        <input
                          type="checkbox"
                          checked={changePass}
                          onChange={(e) => setChangePass(e.target.checked)}
                          className="mr-2"
                        />
                        <Lock size={16} className="mr-1" /> Update password
                      </h3>
                    </div>
                    {changePass && (
                      <>
                        <div className="box-body">
                          <div className="form-group">
                            <label className="col-md-3 control-label">Old password <i className="fa fa-asterisk text-danger" style={{ fontSize: '0.6rem' }} /></label>
                            <div className="col-md-9">
                              <input
                                type="password"
                                className="form-control input-sm"
                                placeholder="Current password"
                                autoComplete="current-password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="col-md-3 control-label">New password <i className="fa fa-asterisk text-danger" style={{ fontSize: '0.6rem' }} /></label>
                            <div className="col-md-9">
                              <input
                                type="password"
                                className="form-control input-sm"
                                placeholder="New password (min 8 chars)"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="col-md-3 control-label">Confirm password <i className="fa fa-asterisk text-danger" style={{ fontSize: '0.6rem' }} /></label>
                            <div className="col-md-9">
                              <input
                                type="password"
                                className="form-control input-sm"
                                placeholder="Confirm new password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </div>
                        <div className="box-footer">
                          <button type="submit" className="btn btn-warning pull-right" disabled={updatePassword.isPending}>
                            {updatePassword.isPending ? 'Changing…' : 'Change Password'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </form>

                {/* API Key */}
                <div className="box">
                  <div className="box-header with-border">
                    <h3 className="box-title"><KeyRound size={16} className="mr-1" /> API Key</h3>
                  </div>
                  <div className="box-body">
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Generate a personal API key for programmatic access. The key is only shown once after generation.
                    </p>
                    {apiKey && (
                      <div className="alert alert-warning">
                        <strong>Your API key (copy now):</strong>
                        <code className="block mt-1 break-all select-all" style={{ fontSize: '0.8rem' }}>{apiKey}</code>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn btn-default"
                      onClick={() => generateApiKey.mutate()}
                      disabled={generateApiKey.isPending}
                    >
                      <KeyRound size={14} className="mr-1" />
                      {generateApiKey.isPending ? 'Generating…' : 'Generate new API key'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
