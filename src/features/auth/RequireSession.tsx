import { useEffect, useState, type PropsWithChildren } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type SessionState = 'checking' | 'authenticated' | 'unauthenticated';

export function RequireSession({ children }: PropsWithChildren) {
  const location = useLocation();
  const [sessionState, setSessionState] = useState<SessionState>('checking');

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const updateSessionState = (hasSession: boolean) => {
      if (active) setSessionState(hasSession ? 'authenticated' : 'unauthenticated');
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      updateSessionState(!error && Boolean(data.session));
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => updateSessionState(Boolean(session)));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="stadium-glow grid min-h-screen place-items-center px-4 py-[calc(2rem+var(--safe-top))]">
        <section className="glass-card w-full max-w-md p-6 text-center">
          <p className="eyebrow">Account setup required</p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            Private league access is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            This deployment needs its public Supabase URL and anonymous key before managers can
            access a private league.
          </p>
          <Link to="/auth/sign-in" className="button-primary mt-6">
            Return to sign in
          </Link>
        </section>
      </main>
    );
  }

  if (sessionState === 'checking') {
    return (
      <main className="grid min-h-screen place-items-center bg-ink px-4" aria-busy="true">
        <p className="text-sm text-muted">Checking secure account access…</p>
      </main>
    );
  }

  if (sessionState === 'unauthenticated') {
    return (
      <Navigate
        replace
        to="/auth/sign-in"
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash
          }
        }}
      />
    );
  }

  return <>{children}</>;
}
