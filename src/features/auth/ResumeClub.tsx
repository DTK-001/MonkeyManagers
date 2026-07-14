import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { requireSupabase } from '../../lib/supabase';
import { loadServerMarket } from '../market/server-market';
import { loadSavedClub, rememberLastLeague } from './saved-club';

type ResumeState = 'loading' | 'ready' | 'error';

export function ResumeClub({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { state, hydrateClub, syncServerMarket } = useDemo();
  const [resumeState, setResumeState] = useState<ResumeState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const preferredLeagueId = useRef(state.selectedLeagueId);

  useEffect(() => {
    let active = true;
    async function resume() {
      try {
        const { data } = await requireSupabase().auth.getUser();
        if (!data.user) throw new Error('Your session is no longer valid.');
        const saved = await loadSavedClub(data.user.id, preferredLeagueId.current);
        if (!active) return;
        if (!saved) {
          navigate('/onboarding', { replace: true });
          return;
        }
        hydrateClub(saved.club, saved.leagueId, saved.leagueName, true);
        try {
          const market = await loadServerMarket(saved.leagueId, saved.club.id);
          syncServerMarket(market.players, market.balanceMinor);
        } catch {
          // A market outage must not prevent a manager from returning to their saved club.
          // MarketPage retries the load and surfaces the specific error alongside the controls.
        }
        rememberLastLeague(data.user.id, saved.leagueId);
        setResumeState('ready');
      } catch (cause) {
        if (!active) return;
        setErrorMessage(cause instanceof Error ? cause.message : 'Your saved club could not be loaded.');
        setResumeState('error');
      }
    }
    void resume();
    return () => {
      active = false;
    };
  }, [hydrateClub, navigate, syncServerMarket]);

  if (resumeState === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-ink px-4" aria-busy="true">
        <p className="text-sm text-muted">Loading your clubâ€¦</p>
      </main>
    );
  }

  if (resumeState === 'error') {
    return (
      <main className="stadium-glow grid min-h-screen place-items-center px-4">
        <section className="glass-card w-full max-w-md p-6 text-center">
          <p className="eyebrow">Club unavailable</p>
          <h1 className="mt-2 font-display text-3xl font-bold">We could not load your saved club</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{errorMessage}</p>
          <Link to="/auth/sign-in" className="button-primary mt-6">Return to sign in</Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
