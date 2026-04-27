'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { KeyRound, Lock, Mail } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

const requestSchema = z.object({ login: z.string().email('A valid email login is required') });
const confirmSchema = z.object({
  token: z.string().min(20, 'Reset token is required'),
  new_password: z.string().min(12, 'Password must be at least 12 characters').regex(/[a-z]/, 'Password must include lowercase').regex(/[A-Z]/, 'Password must include uppercase').regex(/[0-9]/, 'Password must include a digit').regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
  confirm_password: z.string().min(1, 'Confirm password is required'),
}).refine((values: { new_password: string; confirm_password: string }) => values.new_password === values.confirm_password, {
  path: ['confirm_password'],
  message: 'Passwords do not match',
});

type ResetForm = z.infer<typeof requestSchema> & Partial<z.infer<typeof confirmSchema>>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({
    defaultValues: { login: '', token: '', new_password: '', confirm_password: '' },
  });

  const onSubmit = async (values: ResetForm) => {
    setSubmitting(true);
    setServerError(null);
    setServerInfo(null);
    try {
      if (step === 'request') {
        const parsed = requestSchema.parse(values);
        await apiFetch('/api/v1/auth/password-reset/request', { method: 'POST', json: parsed });
        setServerInfo('If the account exists, a password reset email will be sent. Use an admin-generated token while email adapter is still a placeholder.');
        setStep('confirm');
        return;
      }
      const parsed = confirmSchema.parse(values);
      await apiFetch('/api/v1/auth/password-reset/confirm', { method: 'POST', json: { token: parsed.token, new_password: parsed.new_password } });
      setServerInfo('Password reset complete. Sign in with your new password.');
      setTimeout(() => router.push('/login'), 600);
    } catch (e) {
      if (e instanceof ApiError) setServerError(e.problem.detail || e.problem.title);
      else setServerError('Password reset failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="thehive-login-shell">
      <div className="thehive-login-card change-password-card">
        <div className="thehive-login-header">
          <div className="flex items-center justify-center mb-3">
            <Image src="/logo-white.svg" alt="TheHive" width={140} height={48} priority />
          </div>
          <p className="text-white/85 text-sm">Password reset</p>
          <p className="text-white/60 text-xs mt-1">Self-service request + one-time token confirmation</p>
        </div>
        <div className="thehive-login-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="first-login-banner">
              {step === 'request' ? <Mail size={18} /> : <KeyRound size={18} />}
              <div>
                <strong>{step === 'request' ? 'Request reset token' : 'Confirm one-time token'}</strong>
                <p>{step === 'request' ? 'Email delivery is adapter-ready but currently placeholder-only.' : 'Tokens expire after 30 minutes and are consumed on first successful use.'}</p>
              </div>
            </div>
            {step === 'request' && (
              <div>
                <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="login">Login email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-thehive-muted" size={16} />
                  <input id="login" type="email" autoComplete="username" disabled={submitting} className="thehive-input pl-9" {...register('login')} />
                </div>
                {errors.login && <p className="text-red-600 text-xs mt-1.5">{errors.login.message}</p>}
              </div>
            )}
            {step === 'confirm' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="token">Reset token</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-thehive-muted" size={16} />
                    <input id="token" type="text" disabled={submitting} className="thehive-input pl-9" {...register('token')} />
                  </div>
                  {errors.token && <p className="text-red-600 text-xs mt-1.5">{errors.token.message}</p>}
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
                  <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="confirm_password">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-thehive-muted" size={16} />
                    <input id="confirm_password" type="password" autoComplete="new-password" disabled={submitting} className="thehive-input pl-9" {...register('confirm_password')} />
                  </div>
                  {errors.confirm_password && <p className="text-red-600 text-xs mt-1.5">{errors.confirm_password.message}</p>}
                </div>
              </>
            )}
            {serverInfo && <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-sm">{serverInfo}</div>}
            {serverError && <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">{serverError}</div>}
            <button type="submit" disabled={submitting} className="thehive-btn-primary w-full flex items-center justify-center gap-2">
              {step === 'request' ? <Mail size={16} /> : <KeyRound size={16} />}
              {submitting ? 'Submitting…' : (step === 'request' ? 'Request reset' : 'Reset password')}
            </button>
            <button type="button" disabled={submitting} className="thehive-btn-secondary w-full" onClick={() => router.push('/login')}>Back to login</button>
          </form>
        </div>
      </div>
    </main>
  );
}
