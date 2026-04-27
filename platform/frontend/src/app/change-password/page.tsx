'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { KeyRound, Lock, LogOut } from 'lucide-react';
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
    <main className="thehive-login-shell">
      <div className="thehive-login-card change-password-card">
        <div className="thehive-login-header">
          <div className="flex items-center justify-center mb-3">
            <Image src="/logo-white.svg" alt="TheHive" width={140} height={48} priority />
          </div>
          <p className="text-white/85 text-sm">First login password change</p>
          <p className="text-white/60 text-xs mt-1">Required before entering the TheHive workspace</p>
        </div>
        <div className="thehive-login-body">
          <div className="first-login-banner">
            <KeyRound size={18} />
            <div>
              <strong>Change password required</strong>
              <p>Your account is marked with must_change_password. Choose a production-strength password to continue.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="current_password">Current password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-thehive-muted" size={16} />
                <input id="current_password" type="password" autoComplete="current-password" disabled={submitting} className="thehive-input pl-9" {...register('current_password')} />
              </div>
              {errors.current_password && <p className="text-red-600 text-xs mt-1.5">{errors.current_password.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="new_password">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-thehive-muted" size={16} />
                <input id="new_password" type="password" autoComplete="new-password" disabled={submitting} className="thehive-input pl-9" {...register('new_password')} />
              </div>
              {errors.new_password && <p className="text-red-600 text-xs mt-1.5">{errors.new_password.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="confirm_password">Confirm new password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-thehive-muted" size={16} />
                <input id="confirm_password" type="password" autoComplete="new-password" disabled={submitting} className="thehive-input pl-9" {...register('confirm_password')} />
              </div>
              {errors.confirm_password && <p className="text-red-600 text-xs mt-1.5">{errors.confirm_password.message}</p>}
            </div>
            {serverError && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">{serverError}</div>}
            <button type="submit" disabled={submitting} className="thehive-btn-primary w-full flex items-center justify-center gap-2">
              <KeyRound size={16} /> {submitting ? 'Changing password…' : 'Change password'}
            </button>
            <button type="button" disabled={submitting} className="thehive-btn-secondary w-full flex items-center justify-center gap-2" onClick={logout}>
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
