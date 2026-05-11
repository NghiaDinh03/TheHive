'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Building2, LogIn, Lock, User, UserPlus } from '@/components/FaIcon';
import { apiFetch, ApiError } from '@/lib/api';

const loginSchema = z.object({
  login: z.string().min(1, 'Login is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  login: z.string().email('A valid email is required'),
  name: z.string().min(1, 'Name is required'),
  organisation: z.string().min(1, 'Organisation is required'),
  password: z.string().min(12, 'Password must be at least 12 characters').regex(/[a-z]/, 'Must include lowercase').regex(/[A-Z]/, 'Must include uppercase').regex(/[0-9]/, 'Must include digit').regex(/[^A-Za-z0-9]/, 'Must include symbol'),
});

const totpSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^[0-9]+$/, 'Must be numbers only'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type TotpForm = z.infer<typeof totpSchema>;
type FormValues = LoginForm & Partial<RegisterForm> & Partial<TotpForm>;

interface LoginResponse {
  token: string;
  login: string;
  expires_at: string;
  must_change_password?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'totp'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { login: '', password: '', name: '', organisation: 'admin', totpCode: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setServerError(null);
    setServerInfo(null);
    try {
      if (mode === 'register') {
        const parsed = registerSchema.parse(values);
        await apiFetch('/api/v1/auth/register', { method: 'POST', json: parsed });
        setServerInfo('Account created. Sign in with the new credentials.');
        setMode('login');
        reset({ login: parsed.login, password: '', name: parsed.name, organisation: parsed.organisation });
        return;
      }

      if (mode === 'totp') {
        const parsed = loginSchema.parse(values);
        const parsedTotp = totpSchema.parse(values);
        const res = await apiFetch<LoginResponse>('/api/v1/auth/totp/login', { method: 'POST', json: { ...parsed, code: parsedTotp.totpCode } });
        sessionStorage.setItem('thehive.token', res.token);
        sessionStorage.setItem('thehive.login', res.login);
        router.push(res.must_change_password ? '/change-password' : '/dashboard');
        return;
      }

      const parsed = loginSchema.parse(values);
      const res = await apiFetch<LoginResponse>('/api/v1/auth/login', { method: 'POST', json: parsed });
      sessionStorage.setItem('thehive.token', res.token);
      sessionStorage.setItem('thehive.login', res.login);
      router.push(res.must_change_password ? '/change-password' : '/dashboard');
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.problem.detail === 'totp_required') {
          setMode('totp');
          setServerInfo('Two-factor authentication required. Please enter your 6-digit TOTP code.');
          return;
        }
        setServerError(e.problem.detail || e.problem.title);
      } else {
        setServerError(mode === 'register' ? 'Unable to create account.' : 'Login failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="ncs-login-shell">
      <div className="ncs-login-card">
        <div className="ncs-login-header">
          <div className="ncs-login-logo">
            <Image src="/logo-login.jpg" alt="NCS" width={100} height={100} priority className="ncs-login-logo-img" />
          </div>
          <h1 className="ncs-login-title">NCS Fusion Center</h1>
          <p className="ncs-login-subtitle">Security Incident Response Platform</p>
        </div>

        <div className="ncs-login-body">
          <div className="ncs-auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setServerError(null); }} type="button">
              <LogIn size={14} /> Sign in
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setServerError(null); }} type="button">
              <UserPlus size={14} /> Register
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="ncs-login-form">

            {mode === 'register' && (
              <div className="ncs-form-group">
                <label htmlFor="name">Name</label>
                <div className="ncs-input-wrap">
                  <User className="ncs-input-icon" size={16} aria-hidden="true" />
                  <input id="name" type="text" autoComplete="name" disabled={submitting} placeholder="SOC Analyst" {...register('name')} />
                </div>
                {errors.name && <p className="ncs-field-error">{errors.name.message}</p>}
              </div>
            )}

            {mode !== 'totp' && (
              <>
                <div className="ncs-form-group">
                  <label htmlFor="login">Login</label>
                  <div className="ncs-input-wrap">
                    <User className="ncs-input-icon" size={16} aria-hidden="true" />
                    <input id="login" type="text" autoComplete="username" disabled={submitting} placeholder="nghia.dinh@ncsgroup.vn" {...register('login')} />
                  </div>
                  {errors.login && <p className="ncs-field-error">{errors.login.message}</p>}
                </div>

                {mode === 'register' && (
                  <div className="ncs-form-group">
                    <label htmlFor="organisation">Organisation</label>
                    <div className="ncs-input-wrap">
                      <Building2 className="ncs-input-icon" size={16} aria-hidden="true" />
                      <input id="organisation" type="text" disabled={submitting} placeholder="admin" {...register('organisation')} />
                    </div>
                    {errors.organisation && <p className="ncs-field-error">{errors.organisation.message}</p>}
                  </div>
                )}

                <div className="ncs-form-group">
                  <label htmlFor="password">Password</label>
                  <div className="ncs-input-wrap">
                    <Lock className="ncs-input-icon" size={16} aria-hidden="true" />
                    <input id="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} disabled={submitting} placeholder="••••••••" {...register('password')} />
                  </div>
                  {errors.password && <p className="ncs-field-error">{errors.password.message}</p>}
                </div>
              </>
            )}

            {mode === 'totp' && (
              <div className="ncs-form-group">
                <label htmlFor="totpCode">TOTP Code</label>
                <div className="ncs-input-wrap">
                  <Lock className="ncs-input-icon" size={16} aria-hidden="true" />
                  <input id="totpCode" type="text" autoComplete="one-time-code" disabled={submitting} placeholder="123456" {...register('totpCode')} />
                </div>
                {errors.totpCode && <p className="ncs-field-error">{errors.totpCode.message}</p>}
              </div>
            )}

            {mode === 'login' && (
              <div className="ncs-forgot-row">
                <button type="button" onClick={() => router.push('/reset-password')} disabled={submitting}>Forgot password?</button>
              </div>
            )}

            {serverInfo && <div className="ncs-alert ncs-alert-success">{serverInfo}</div>}
            {serverError && <div className="ncs-alert ncs-alert-danger">{serverError}</div>}

            <button type="submit" disabled={submitting} className="ncs-btn-primary ncs-btn-block">
              {mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
              {submitting ? 'Processing…' : (mode === 'register' ? 'Register' : mode === 'totp' ? 'Verify Code' : 'Sign in')}
            </button>
          </form>
        </div>
      </div>

      <p className="ncs-login-footer">© 2026 NCS Group · Fusion Center</p>
    </main>
  );
}
