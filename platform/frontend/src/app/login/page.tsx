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
  login: z.string().email('A valid email login is required'),
  name: z.string().min(1, 'Name is required'),
  organisation: z.string().min(1, 'Organisation is required'),
  password: z.string().min(12, 'Password must be at least 12 characters').regex(/[a-z]/, 'Password must include lowercase').regex(/[A-Z]/, 'Password must include uppercase').regex(/[0-9]/, 'Password must include a digit').regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type FormValues = LoginForm & Partial<RegisterForm>;

interface LoginResponse {
  token: string;
  login: string;
  expires_at: string;
  must_change_password?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { login: '', password: '', name: '', organisation: 'admin' },
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

      const parsed = loginSchema.parse(values);
      const res = await apiFetch<LoginResponse>('/api/v1/auth/login', { method: 'POST', json: parsed });
      sessionStorage.setItem('thehive.token', res.token);
      sessionStorage.setItem('thehive.login', res.login);
      router.push(res.must_change_password ? '/change-password' : '/dashboard');
    } catch (e) {
      if (e instanceof ApiError) {
        setServerError(e.problem.detail || e.problem.title);
      } else {
        setServerError(mode === 'register' ? 'Unable to create account. Please try again.' : 'Unable to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="thehive-login-shell">
      <div className="thehive-login-card">
        <div className="thehive-login-header">
          <div className="flex items-center justify-center mb-3">
            <Image src="/logo-white.svg" alt="TheHive" width={140} height={48} priority />
          </div>
          <p className="text-white/85 text-sm">Security Incident Response Platform</p>
          <p className="text-white/60 text-xs mt-1">Production PostgreSQL auth · TheHive parity</p>
        </div>

        <div className="thehive-login-body">
          <div className="thehive-auth-tabs mb-5">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setServerError(null); }} type="button">
              <LogIn size={14} /> Sign in
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setServerError(null); }} type="button">
              <UserPlus size={14} /> Register
            </button>
          </div>

          <div className="thehive-reset-link-row">
            <button type="button" onClick={() => router.push('/reset-password')} disabled={submitting}>Forgot password?</button>
          </div>

          <h1 className="text-lg font-medium text-thehive-text mb-1">{mode === 'login' ? 'Sign in' : 'Register account'}</h1>
          <p className="text-xs text-thehive-muted mb-3">
            {mode === 'login'
              ? 'Use a PostgreSQL-backed TheHive account.'
              : 'Create a local PostgreSQL-backed TheHive account with organisation/profile mapping.'}
          </p>
          {mode === 'login' && (
            <div className="thehive-login-hint" aria-label="Default administrator credentials">
              <strong>Default admin:</strong> nghia.dinh@ncsgroup.vn / 12345@
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="name">Name</label>
                <div className="relative">
                  <User className="thehive-input-icon" size={16} aria-hidden="true" />
                  <input id="name" type="text" autoComplete="name" disabled={submitting} className="thehive-input thehive-input-with-icon" placeholder="SOC Analyst" {...register('name')} />
                </div>
                {errors.name && <p className="text-red-600 text-xs mt-1.5">{errors.name.message}</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="login">Login</label>
              <div className="relative">
                <User className="thehive-input-icon" size={16} aria-hidden="true" />
                <input id="login" type="text" autoComplete="username" disabled={submitting} className="thehive-input thehive-input-with-icon" placeholder="nghia.dinh@ncsgroup.vn" {...register('login')} />
              </div>
              {errors.login && <p className="text-red-600 text-xs mt-1.5">{errors.login.message}</p>}
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="organisation">Organisation</label>
                <div className="relative">
                  <Building2 className="thehive-input-icon" size={16} aria-hidden="true" />
                  <input id="organisation" type="text" disabled={submitting} className="thehive-input thehive-input-with-icon" placeholder="admin" {...register('organisation')} />
                </div>
                {errors.organisation && <p className="text-red-600 text-xs mt-1.5">{errors.organisation.message}</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-thehive-text uppercase tracking-wide mb-1.5" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="thehive-input-icon" size={16} aria-hidden="true" />
                <input id="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} disabled={submitting} className="thehive-input thehive-input-with-icon" placeholder="••••••••" {...register('password')} />
              </div>
              {errors.password && <p className="text-red-600 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            {serverInfo && <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-sm">{serverInfo}</div>}
            {serverError && (
              <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm flex items-start gap-2">
                <span className="font-medium">{mode === 'register' ? 'Registration failed:' : 'Login failed:'}</span>
                <span>{serverError}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="thehive-btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
              {submitting ? (mode === 'register' ? 'Creating account…' : 'Signing in…') : (mode === 'register' ? 'Register' : 'Sign in')}
            </button>
          </form>
        </div>
      </div>

      <p className="absolute bottom-4 text-xs text-thehive-muted">© TheHive Platform · PostgreSQL production auth</p>
    </main>
  );
}
