import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, LockKeyhole, Shield } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PRODUCT } from '../../app/product';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const accountFormSchema = z.object({
  displayName: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least eight characters.').optional()
});

const recoveryFormSchema = z
  .object({
    displayName: z.string().trim().max(40).optional(),
    email: z.string().optional(),
    password: z.string().min(8, 'Use at least eight characters.'),
    confirmPassword: z.string().min(8, 'Confirm your new password.')
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.'
  });

type FormValues = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

type RecoveryState = 'checking' | 'ready' | 'expired' | 'unavailable';
type RedirectState = { from?: { pathname?: string; search?: string; hash?: string } };

function authRedirectUrl(route: string): string {
  const url = new URL(window.location.pathname, window.location.origin);
  url.hash = route;
  return url.toString();
}

function requestedDestination(state: unknown): string {
  const from = (state as RedirectState | null)?.from;
  if (!from?.pathname) return '/app/home';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export default function AuthPage() {
  const { mode = 'sign-in' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const isRecovery = mode === 'update-password';
  const isKnown = isRegister || isReset || isRecovery || mode === 'sign-in';
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(isRecovery ? recoveryFormSchema : accountFormSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' }
  });

  useEffect(() => {
    if (!isRecovery) return;
    if (!supabase) {
      setRecoveryState('unavailable');
      return;
    }

    let active = true;
    setRecoveryState('checking');
    const updateState = (hasSession: boolean) => {
      if (active) setRecoveryState(hasSession ? 'ready' : 'expired');
    };

    void supabase.auth.getSession().then(({ data }) => updateState(Boolean(data.session)));
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => updateState(Boolean(session)));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isRecovery]);

  if (!isKnown) return <Navigate replace to="/auth/sign-in" />;

  async function onSubmit(values: FormValues) {
    setStatus(null);
    if (!isReset && !values.password) {
      setStatus('Enter your password.');
      return;
    }
    if (!supabase) {
      setStatus('Secure account access is not configured. Please try again shortly.');
      return;
    }
    setSubmitting(true);
    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email ?? '', {
          redirectTo: authRedirectUrl('/auth/update-password')
        });
        if (error) throw error;
        setStatus('Check your inbox for a secure reset link.');
      } else if (isRecovery) {
        if (recoveryState !== 'ready') {
          setStatus('This recovery link is no longer valid. Request a new one to continue.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: values.password ?? '' });
        if (error) throw error;
        setStatus('Your password has been updated. You can now return to sign in.');
      } else if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: values.email ?? '',
          password: values.password ?? '',
          options: {
            emailRedirectTo: authRedirectUrl('/auth/sign-in'),
            data: { display_name: values.displayName }
          }
        });
        if (error) throw error;
        if (!data.session) {
          setStatus('Check your inbox to confirm your account, then sign in to create your club.');
          return;
        }
        navigate(requestedDestination(location.state), { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email ?? '',
          password: values.password ?? ''
        });
        if (error) throw error;
        navigate(requestedDestination(location.state), { replace: true });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Authentication could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  const title = isRecovery
    ? 'Choose a new password'
    : isReset
      ? 'Reset access'
      : isRegister
        ? 'Create your account'
        : 'Welcome back';
  const subtitle = isRecovery
    ? 'Use the secure recovery link from your email to set a new password.'
    : isReset
      ? 'We will send a secure recovery link.'
      : isRegister
        ? 'Your private club awaits.'
        : 'Return to the touchline.';

  return (
    <main className="stadium-glow grid min-h-screen place-items-center px-4 py-[calc(2rem+var(--safe-top))]">
      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ivory"
        >
          <ArrowLeft size={17} /> Back
        </Link>
        <section className="glass-card p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
              <Shield size={23} />
            </span>
            <div>
              <p className="font-display text-xl font-bold">{PRODUCT.name}</p>
              <p className="text-xs text-muted">Private league access</p>
            </div>
          </div>
          <p className="eyebrow">Secure account</p>
          <h1 className="mt-2 font-display text-4xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>

          {!isSupabaseConfigured ? (
            <div className="mt-5 rounded-xl border border-danger/20 bg-danger/[0.07] p-3 text-xs leading-5 text-[#f0c7c2]">
              This deployment needs its public Supabase configuration before account access can be
              used.
            </div>
          ) : null}

          {isRecovery && recoveryState !== 'ready' ? (
            <div
              className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-muted"
              role="status"
            >
              {recoveryState === 'checking'
                ? 'Verifying your recovery link…'
                : recoveryState === 'unavailable'
                  ? 'Password recovery is unavailable until account services are configured.'
                  : 'This recovery link is invalid or has expired. Request a new one to continue.'}
            </div>
          ) : null}

          <form
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            className="mt-6 space-y-4"
            noValidate
          >
            {isRegister ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#cad0ce]">
                  Display name
                </span>
                <input
                  className="field"
                  autoComplete="name"
                  {...register('displayName')}
                  placeholder="Alex Morgan"
                />
              </label>
            ) : null}
            {!isRecovery ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#cad0ce]">
                  Email address
                </span>
                <input
                  className="field"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? (
                  <span className="mt-1 block text-xs text-danger">{errors.email.message}</span>
                ) : null}
              </label>
            ) : null}
            {!isReset ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#cad0ce]">Password</span>
                <input
                  className="field"
                  type="password"
                  autoComplete={isRegister || isRecovery ? 'new-password' : 'current-password'}
                  {...register('password')}
                  placeholder={
                    isRecovery
                      ? 'New password (at least eight characters)'
                      : 'At least eight characters'
                  }
                  aria-invalid={Boolean(errors.password)}
                />
                {errors.password ? (
                  <span className="mt-1 block text-xs text-danger">{errors.password.message}</span>
                ) : null}
              </label>
            ) : null}
            {isRecovery ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#cad0ce]">
                  Confirm new password
                </span>
                <input
                  className="field"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  placeholder="Repeat your new password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
                {errors.confirmPassword ? (
                  <span className="mt-1 block text-xs text-danger">
                    {errors.confirmPassword.message}
                  </span>
                ) : null}
              </label>
            ) : null}
            {status ? (
              <p
                className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-[#d7d9d2]"
                role="status"
              >
                {status}
              </p>
            ) : null}
            <button
              className="button-primary w-full"
              disabled={
                submitting || (isRecovery && recoveryState !== 'ready') || !isSupabaseConfigured
              }
              type="submit"
            >
              {submitting
                ? 'Please wait…'
                : isRecovery
                  ? 'Update password'
                  : isReset
                    ? 'Send reset link'
                    : isRegister
                      ? 'Create account'
                      : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-muted">
            {isReset || isRecovery ? (
              <Link className="text-gold hover:underline" to="/auth/sign-in">
                Return to sign in
              </Link>
            ) : isRegister ? (
              <>
                Already a manager?{' '}
                <Link className="text-gold hover:underline" to="/auth/sign-in">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                <Link className="text-gold hover:underline" to="/auth/reset">
                  Forgot password?
                </Link>
                <span className="mx-2">·</span>
                <Link className="text-gold hover:underline" to="/auth/register">
                  Create account
                </Link>
              </>
            )}
          </div>
        </section>
        <p className="mt-5 flex items-center justify-center gap-2 text-[0.67rem] text-muted">
          <LockKeyhole size={13} /> Protected by Supabase row-level security{' '}
          <CheckCircle2 size={13} className="text-emerald" />
        </p>
      </div>
    </main>
  );
}
