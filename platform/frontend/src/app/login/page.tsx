'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Building2, LogIn, Lock, User, UserPlus, Eye, EyeOff } from '@/components/FaIcon';
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
  const [hasInvite, setHasInvite] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { login: '', password: '', name: '', organisation: 'NCS', totpCode: '' },
    mode: 'onChange',
    resolver: (async (data: any) => {
      try {
        let values;
        if (mode === 'register') {
          values = registerSchema.parse(data);
        } else if (mode === 'totp') {
          values = totpSchema.parse(data);
        } else {
          values = loginSchema.parse(data);
        }
        return { values, errors: {} };
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          const fieldErrors: Record<string, any> = {};
          err.issues.forEach((issue) => {
            const path = issue.path[0];
            if (!fieldErrors[path]) {
              fieldErrors[path] = { type: 'validation', message: issue.message };
            }
          });
          return { values: {}, errors: fieldErrors };
        }
        return { values: {}, errors: {} };
      }
    }) as any
  });

  useEffect(() => {
    // Secure session clearance on page load
    sessionStorage.removeItem('thehive.token');
    sessionStorage.removeItem('thehive.login');
    localStorage.removeItem('thehive.token');
    localStorage.removeItem('thehive.login');
    // Clear HttpOnly cookies on load
    fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('invite')) {
        setHasInvite(true);
        setMode('register');
        if (params.has('email')) setValue('login', params.get('email') || '');
        if (params.has('name')) setValue('name', params.get('name') || '');
        if (params.has('org')) setValue('organisation', params.get('org') || '');
      }
    }
  }, [setValue]);

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
        localStorage.setItem('thehive.token', res.token);
        localStorage.setItem('thehive.login', res.login);
        router.push(res.must_change_password ? '/change-password' : '/dashboard');
        return;
      }

      const parsed = loginSchema.parse(values);
      const res = await apiFetch<LoginResponse>('/api/v1/auth/login', { method: 'POST', json: parsed });
      sessionStorage.setItem('thehive.token', res.token);
      sessionStorage.setItem('thehive.login', res.login);
      localStorage.setItem('thehive.token', res.token);
      localStorage.setItem('thehive.login', res.login);
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
            <Image src="/logo.png" alt="NCS" width={150} height={45} priority className="ncs-login-logo-img" style={{ objectFit: 'contain' }} />
          </div>
          <h1 className="ncs-login-title">NCS Fusion Center</h1>
          <p className="ncs-login-subtitle">Security Incident Response Platform</p>
        </div>

        <div className="ncs-login-body">
          {hasInvite && (
            <div className="ncs-auth-tabs">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setServerError(null); setServerInfo(null); reset({ login: '', password: '', name: '', organisation: 'NCS', totpCode: '' }); }} type="button">
                <LogIn size={14} /> Sign in
              </button>
              <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setServerError(null); setServerInfo(null); reset({ login: '', password: '', name: '', organisation: 'NCS', totpCode: '' }); }} type="button">
                <UserPlus size={14} /> Register
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="ncs-login-form">

            {mode === 'register' && (
              <div className="ncs-form-group">
                <label htmlFor="name">Name</label>
                <div className="ncs-input-wrap">
                  <User className="ncs-input-icon" size={16} aria-hidden="true" />
                  <input id="name" type="text" autoComplete="name" disabled={submitting || hasInvite} placeholder="NCS User" {...register('name')} />
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
                    <input id="login" type="text" autoComplete="username" disabled={submitting || (mode === 'register' && hasInvite)} placeholder="username@ncsgroup.vn" {...register('login')} />
                  </div>
                  {errors.login && <p className="ncs-field-error">{errors.login.message}</p>}
                </div>

                {mode === 'register' && (
                  <div className="ncs-form-group">
                    <label htmlFor="organisation">Organisation</label>
                    <div className="ncs-input-wrap">
                      <Building2 className="ncs-input-icon" size={16} aria-hidden="true" />
                      <input id="organisation" type="text" disabled={submitting || hasInvite} placeholder="NCS" {...register('organisation')} />
                    </div>
                    {errors.organisation && <p className="ncs-field-error">{errors.organisation.message}</p>}
                  </div>
                )}

                <div className="ncs-form-group">
                  <label htmlFor="password">Password</label>
                  <div className="ncs-input-wrap relative flex items-center">
                    <Lock className="ncs-input-icon" size={16} aria-hidden="true" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      disabled={submitting}
                      placeholder="••••••••"
                      className="pr-10 w-full"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={submitting}
                      className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none flex items-center justify-center"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
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

            <button type="submit" disabled={submitting} className="ncs-btn-primary ncs-btn-block flex items-center justify-center gap-2">
              {submitting ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />
              )}
              <span>{submitting ? 'Processing…' : (mode === 'register' ? 'Register' : mode === 'totp' ? 'Verify Code' : 'Sign in')}</span>
            </button>
          </form>
        </div>
      </div>

      <p className="ncs-login-footer">© 2026 NCS Group · Fusion Center</p>
    </main>
  );
}
