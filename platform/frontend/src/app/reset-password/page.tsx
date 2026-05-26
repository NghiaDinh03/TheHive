'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { KeyRound, Lock, Mail } from '@/components/FaIcon';
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
    <main className="ncs-login-shell">
      <div className="ncs-login-card">
        <div className="ncs-login-header">
          <div className="ncs-login-logo">
            <Image src="/logo_ncs_nentrang.jpg" alt="NCS Fusion Center" width={160} height={48} priority className="ncs-login-logo-img" />
          </div>
          <h1 className="ncs-login-title">Password reset</h1>
          <p className="ncs-login-subtitle">Self-service request + one-time token confirmation</p>
        </div>
        <div className="ncs-login-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="ncs-alert ncs-alert-danger" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ marginTop: '2px' }}>
                {step === 'request' ? <Mail size={16} /> : <KeyRound size={16} />}
              </div>
              <div style={{ fontSize: '0.82rem' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>{step === 'request' ? 'Request reset token' : 'Confirm one-time token'}</strong>
                <p style={{ margin: 0 }}>{step === 'request' ? 'A password reset link will be sent to this email if it exists in our system.' : 'Tokens expire after 30 minutes and are consumed on first successful use.'}</p>
              </div>
            </div>
            {step === 'request' && (
              <div className="ncs-form-group">
                <label htmlFor="login">Login email</label>
                <div className="ncs-input-wrap">
                  <Mail className="ncs-input-icon" size={16} />
                  <input id="login" type="email" autoComplete="username" disabled={submitting} placeholder="nghia.dinh@ncsgroup.vn" {...register('login')} />
                </div>
                {errors.login && <p className="ncs-field-error">{errors.login.message}</p>}
              </div>
            )}
            {step === 'confirm' && (
              <>
                <div className="ncs-form-group">
                  <label htmlFor="token">Reset token</label>
                  <div className="ncs-input-wrap">
                    <KeyRound className="ncs-input-icon" size={16} />
                    <input id="token" type="text" disabled={submitting} placeholder="Paste token here" {...register('token')} />
                  </div>
                  {errors.token && <p className="ncs-field-error">{errors.token.message}</p>}
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
                  <label htmlFor="confirm_password">Confirm password</label>
                  <div className="ncs-input-wrap">
                    <Lock className="ncs-input-icon" size={16} />
                    <input id="confirm_password" type="password" autoComplete="new-password" disabled={submitting} placeholder="••••••••" {...register('confirm_password')} />
                  </div>
                  {errors.confirm_password && <p className="ncs-field-error">{errors.confirm_password.message}</p>}
                </div>
              </>
            )}
            {serverInfo && <div className="ncs-alert ncs-alert-success">{serverInfo}</div>}
            {serverError && <div className="ncs-alert ncs-alert-danger">{serverError}</div>}
            <button type="submit" disabled={submitting} className="ncs-btn-primary ncs-btn-block">
              {step === 'request' ? <Mail size={16} /> : <KeyRound size={16} />}
              {submitting ? 'Submitting…' : (step === 'request' ? 'Request reset' : 'Reset password')}
            </button>
            <div className="ncs-forgot-row" style={{ justifyContent: 'center' }}>
              <button type="button" disabled={submitting} onClick={() => router.push('/login')}>Back to login</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
