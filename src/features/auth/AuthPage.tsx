import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, LockKeyhole, Shield } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { PRODUCT } from '../../app/product';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const formSchema = z.object({
  displayName: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least eight characters.').optional()
});
type FormValues = z.infer<typeof formSchema>;

export default function AuthPage() {
  const { mode = 'sign-in' } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const isKnown = isRegister || isReset || mode === 'sign-in';
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: '', email: '', password: '' }
  });

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
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}${window.location.pathname}#/auth/sign-in`
        });
        if (error) throw error;
        setStatus('Check your inbox for a secure reset link.');
      } else if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password ?? '',
          options: { data: { display_name: values.displayName } }
        });
        if (error) throw error;
        navigate('/onboarding');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password ?? ''
        });
        if (error) throw error;
        navigate('/onboarding');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Authentication could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  const title = isReset ? 'Reset access' : isRegister ? 'Create your account' : 'Welcome back';
  const subtitle = isReset
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

          {!isSupabaseConfigured ? <div className="mt-5 rounded-xl border border-danger/20 bg-danger/[0.07] p-3 text-xs leading-5 text-[#f0c7c2]">Account access is temporarily unavailable.</div> : null}

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
            {!isReset ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#cad0ce]">Password</span>
                <input
                  className="field"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  {...register('password')}
                  placeholder="At least eight characters"
                  aria-invalid={Boolean(errors.password)}
                />
                {errors.password ? (
                  <span className="mt-1 block text-xs text-danger">{errors.password.message}</span>
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
            <button className="button-primary w-full" disabled={submitting} type="submit">
              {submitting
                ? 'Please wait…'
                : isReset
                  ? 'Send reset link'
                  : isRegister
                    ? 'Create account'
                    : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-muted">
            {isReset ? (
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
