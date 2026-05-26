'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { KeyRound, Lock, LogOut } from '@/components/FaIcon';
import { apiFetch, ApiError } from '@/lib/api';

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(12, 'Password must be at least 12 characters').regex(/[a-z]/, 'Password must include lowercase').regex(/[A-Z]/, 'Password must include uppercase').regex(/[0-9]/, 'Password must include a digit').regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
  confirm_password: z.string().min(1, 'Confirm password is required'),
}).refine((values) => values.new_password === values.confirm_password, {
  path: ['confirm_password'],
  message: 'Passwords do not match',
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordForm>({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const onSubmit = async (values: PasswordForm) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const parsed = passwordSchema.parse(values);
      await apiFetch('/api/v1/auth/password', {
        method: 'POST',
        json: { current_password: parsed.current_password, new_password: parsed.new_password },
      });
      router.push('/dashboard');
    } catch (e) {
      if (e instanceof ApiError) setServerError(e.problem.detail || e.problem.title);
      else setServerError('Unable to change password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    try { await apiFetch('/api/v1/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    sessionStorage.removeItem('thehive.token');
    sessionStorage.removeItem('thehive.login');
    router.push('/login');
  };

  return (
    <main className="ncs-login-shell">
      <div className="ncs-login-card">
        <div className="ncs-login-header">
          <div className="ncs-login-logo">
            <Image src="/logo_ncs_nentrang.jpg" alt="NCS Fusion Center" width={160} height={48} priority className="ncs-login-logo-img" />
          </div>
          <h1 className="ncs-login-title">First login password change</h1>
          <p className="ncs-login-subtitle">Required before entering the Fusion Center workspace</p>
        </div>
        <div className="ncs-login-body">
          <div className="ncs-alert ncs-alert-danger" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ marginTop: '2px' }}>
              <KeyRound size={16} />
            </div>
            <div style={{ fontSize: '0.82rem' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Change password required</strong>
              <p style={{ margin: 0 }}>Your account is marked with must_change_password. Choose a production-strength password to continue.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="ncs-login-form">
            <div className="ncs-form-group">
              <label htmlFor="current_password">Current password</label>
              <div className="ncs-input-wrap">
                <Lock className="ncs-input-icon" size={16} />
                <input id="current_password" type="password" autoComplete="current-password" disabled={submitting} placeholder="••••••••" {...register('current_password')} />
              </div>
              {errors.current_password && <p className="ncs-field-error">{errors.current_password.message}</p>}
            </div>
            <div className="ncs-form-group">
              <label htmlFor="new_password">New password</label>
              <div className="ncs-input-wrap">
                <Lock className="ncs-input-icon" size={16} />
                <input id="new_password" type="password" autoComplete="new-password" disabled={submitting} placeholder="••••••••" {...register('new_password')} />
              </div>
              {errors.new_password && <p className="ncs-field-error">{errors.new_password.message}</p>}
            </div>
            <div className="ncs-form-group">
              <label htmlFor="confirm_password">Confirm new password</label>
              <div className="ncs-input-wrap">
                <Lock className="ncs-input-icon" size={16} />
                <input id="confirm_password" type="password" autoComplete="new-password" disabled={submitting} placeholder="••••••••" {...register('confirm_password')} />
              </div>
              {errors.confirm_password && <p className="ncs-field-error">{errors.confirm_password.message}</p>}
            </div>
            {serverError && <div className="ncs-alert ncs-alert-danger">{serverError}</div>}
            <button type="submit" disabled={submitting} className="ncs-btn-primary ncs-btn-block">
              <KeyRound size={16} /> {submitting ? 'Changing password…' : 'Change password'}
            </button>
            <div className="ncs-forgot-row" style={{ justifyContent: 'center' }}>
              <button type="button" disabled={submitting} onClick={logout}>
                Sign out
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
