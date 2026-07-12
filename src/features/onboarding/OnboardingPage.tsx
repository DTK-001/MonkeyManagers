import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Shield, Sparkles, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ClubBadge } from '../../components/ClubBadge';
import { useDemo } from '../../app/demo-store';
import { requireSupabase } from '../../lib/supabase';
import type { DemoClub } from '../../types';

const steps = ['League', 'Club', 'Identity', 'Review'];
type LeagueMode = 'create' | 'join';
type BadgeShape = 'shield' | 'round' | 'pennant';
type BadgePattern = 'sash' | 'stripes' | 'split';
type BadgeSymbol = 'star' | 'ball' | 'crown';

type ClubDraft = Omit<DemoClub, 'id' | 'budgetMinor' | 'totalPoints' | 'latestRoundPoints' | 'competitionWins' | 'highestRoundScore' | 'rank' | 'form'> & {
  badgeShape: BadgeShape;
  badgePattern: BadgePattern;
  badgeSymbol: BadgeSymbol;
};

const initialClub: ClubDraft = {
  name: 'Your Club',
  abbreviation: 'YFC',
  manager: 'Manager',
  stadium: 'Home Ground',
  motto: '',
  primary: '#14364e',
  secondary: '#e2b85f',
  accent: '#f4efe3',
  badgeShape: 'shield',
  badgePattern: 'sash',
  badgeSymbol: 'star'
};

function budgetToMinor(value: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000) return null;
  return Math.round(amount * 100_000_000);
}

function createSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'league'}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { hydrateClub } = useDemo();
  const [step, setStep] = useState(0);
  const [leagueMode, setLeagueMode] = useState<LeagueMode>('create');
  const [leagueName, setLeagueName] = useState('Friday Night Football');
  const [inviteCode, setInviteCode] = useState('');
  const [startingBudget, setStartingBudget] = useState('100');
  const [resolvedLeague, setResolvedLeague] = useState<{ id: string; name: string; budgetMinor: number; inviteCode?: string } | null>(null);
  const [club, setClub] = useState<ClubDraft>(initialClub);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canContinue = useMemo(
    () => club.name.trim().length >= 3 && /^[A-Z]{3}$/.test(club.abbreviation),
    [club]
  );

  async function resolveLeague() {
    setError(null);
    const supabase = requireSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate('/auth/sign-in');
      return;
    }
    setSubmitting(true);
    try {
      if (leagueMode === 'create') {
        const budgetMinor = budgetToMinor(startingBudget);
        if (!leagueName.trim() || !budgetMinor) {
          throw new Error('Enter a league name and a starting purse between £1m and £1,000m.');
        }
        const createResponse = (await supabase.rpc('create_private_league', {
          p_name: leagueName.trim(),
          p_slug: createSlug(leagueName),
          p_starting_budget_minor: budgetMinor
        })) as unknown as { data: { leagueId: string } | null; error: Error | null };
        const { data, error: createError } = createResponse;
        if (createError) throw createError;
        if (!data) throw new Error('The league could not be created.');
        const created = data;
        const invitationResponse = (await supabase.rpc('create_league_invitation', {
          p_league_id: created.leagueId,
          p_max_uses: 20,
          p_expires_in: '90 days'
        })) as unknown as { data: { code: string } | null; error: Error | null };
        const { data: invitation, error: invitationError } = invitationResponse;
        if (invitationError) throw invitationError;
        if (!invitation) throw new Error('The invitation code could not be created.');
        setResolvedLeague({
          id: created.leagueId,
          name: leagueName.trim(),
          budgetMinor,
          inviteCode: invitation.code
        });
      } else {
        if (!inviteCode.trim()) throw new Error('Enter the invitation code from your league admin.');
        const joinResponse = (await supabase.rpc('join_private_league', {
          p_invite_code: inviteCode.trim()
        })) as unknown as { data: { leagueId: string } | null; error: Error | null };
        const { data, error: joinError } = joinResponse;
        if (joinError) throw joinError;
        if (!data) throw new Error('The invitation could not be accepted.');
        const joined = data;
        const leagueResponse = (await supabase.from('game_leagues').select('name').eq('id', joined.leagueId).single()) as unknown as { data: { name: string } | null };
        const seasonResponse = (await supabase.from('seasons').select('starting_budget_minor').eq('league_id', joined.leagueId).eq('status', 'active').single()) as unknown as { data: { starting_budget_minor: number } | null };
        const league = leagueResponse.data;
        const season = seasonResponse.data;
        if (!league || !season) throw new Error('This league has no active season.');
        setResolvedLeague({ id: joined.leagueId, name: league.name, budgetMinor: Number(season.starting_budget_minor) });
      }
      const displayName = (userData.user.user_metadata.display_name as string | undefined)?.trim();
      if (displayName) setClub((draft) => ({ ...draft, manager: displayName }));
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The league could not be set up.');
    } finally {
      setSubmitting(false);
    }
  }

  async function finish() {
    if (!resolvedLeague) return;
    setError(null);
    setSubmitting(true);
    try {
      const supabase = requireSupabase();
      const clubResponse = (await supabase.rpc('create_fantasy_club', {
        p_league_id: resolvedLeague.id,
        p_name: club.name.trim(),
        p_abbreviation: club.abbreviation,
        p_manager_display_name: club.manager.trim() || 'Manager',
        p_stadium_name: club.stadium.trim() || 'Home Ground',
        p_primary_colour: club.primary,
        p_secondary_colour: club.secondary,
        p_accent_colour: club.accent,
        p_badge_config: {
          shape: club.badgeShape,
          pattern: club.badgePattern,
          symbol: club.badgeSymbol
        },
        p_motto: club.motto.trim() || null
      })) as unknown as { data: { clubId: string; balanceMinor: number } | null; error: Error | null };
      const { data, error: createError } = clubResponse;
      if (createError) throw createError;
      if (!data) throw new Error('Your club could not be created.');
      const created = data;
      hydrateClub(
        {
          id: created.clubId,
          name: club.name.trim(),
          abbreviation: club.abbreviation,
          manager: club.manager.trim() || 'Manager',
          stadium: club.stadium.trim() || 'Home Ground',
          motto: club.motto.trim(),
          primary: club.primary,
          secondary: club.secondary,
          accent: club.accent,
          badgeShape: club.badgeShape,
          badgePattern: club.badgePattern,
          badgeSymbol: club.badgeSymbol,
          budgetMinor: Number(created.balanceMinor),
          totalPoints: 0,
          latestRoundPoints: 0,
          competitionWins: 0,
          highestRoundScore: 0,
          rank: 0,
          form: []
        },
        resolvedLeague.id,
        resolvedLeague.name
      );
      navigate('/app/market');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your club could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1rem+var(--safe-top))] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between py-2">
          <button type="button" onClick={() => (step === 0 ? navigate('/auth/sign-in') : setStep((value) => value - 1))} className="button-secondary px-3">
            <ArrowLeft size={17} /> Back
          </button>
          <div className="flex items-center gap-2 font-display text-xl font-bold"><Shield size={21} className="text-gold" /> Monkey Managers</div>
          <span className="hidden text-xs text-muted sm:block">Club setup</span>
        </header>
        <ol className="my-8 grid grid-cols-4 gap-2" aria-label="Onboarding progress">
          {steps.map((label, index) => <li key={label} className="min-w-0"><div className={`h-1 rounded-full ${index <= step ? 'bg-gold' : 'bg-white/10'}`} /><span className={`mt-2 block truncate text-[0.62rem] font-bold uppercase tracking-wider ${index === step ? 'text-ivory' : 'text-muted'}`}>{label}</span></li>)}
        </ol>
        <section className="glass-card overflow-hidden">
          {step === 0 ? <div className="p-5 sm:p-8">
            <p className="eyebrow">Step one</p><h1 className="mt-2 font-display text-4xl font-bold">Find your league</h1>
            <p className="mt-2 text-sm leading-6 text-muted">Create a private league for your group or use an invitation code to join one.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {([{ id: 'create', icon: Sparkles, title: 'Create a league', body: 'Set the shared starting purse and invite your friends.' }, { id: 'join', icon: UsersRound, title: 'Join a league', body: 'Use a private code from your league admin.' }] as const).map(({ id, icon: Icon, title, body }) => <button key={id} onClick={() => setLeagueMode(id)} type="button" className={`min-h-32 rounded-2xl border p-4 text-left transition ${leagueMode === id ? 'border-gold/50 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}><Icon size={22} className="text-gold" /><span className="mt-3 block font-display text-xl font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted">{body}</span></button>)}
            </div>
            {leagueMode === 'create' ? <><label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold">League name</span><input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} className="field" maxLength={80} /></label><label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Starting purse for every manager</span><div className="relative max-w-xs"><span className="pointer-events-none absolute left-3 top-3 text-sm text-muted">£</span><input value={startingBudget} onChange={(event) => setStartingBudget(event.target.value.replace(/[^0-9.]/g, ''))} className="field pl-7 pr-12" inputMode="decimal" /><span className="pointer-events-none absolute right-3 top-3 text-sm text-muted">million</span></div><span className="mt-2 block text-xs text-muted">Everyone begins with exactly this amount. It is locked once the league is created.</span></label></> : <label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold">Invite code</span><div className="relative"><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} className="field pr-12" maxLength={12} /><Copy className="pointer-events-none absolute right-3 top-3.5 text-muted" size={16} /></div></label>}
          </div> : null}
          {step === 1 ? <div className="grid md:grid-cols-[1fr_18rem]"><div className="p-5 sm:p-8"><p className="eyebrow">Step two</p><h1 className="mt-2 font-display text-4xl font-bold">Name your club</h1><div className="mt-6 grid gap-4 sm:grid-cols-[1fr_8rem]"><label><span className="mb-1.5 block text-xs font-semibold">Club name</span><input className="field" value={club.name} onChange={(event) => setClub({ ...club, name: event.target.value })} /></label><label><span className="mb-1.5 block text-xs font-semibold">Abbreviation</span><input className="field uppercase" maxLength={3} value={club.abbreviation} onChange={(event) => setClub({ ...club, abbreviation: event.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} /></label></div><label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Stadium name</span><input className="field" value={club.stadium} onChange={(event) => setClub({ ...club, stadium: event.target.value })} /></label><label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold">Club motto <span className="font-normal text-muted">(optional)</span></span><input className="field" value={club.motto} onChange={(event) => setClub({ ...club, motto: event.target.value })} /></label></div><Preview club={club} /></div> : null}
          {step === 2 ? <div className="grid md:grid-cols-[1fr_18rem]"><div className="p-5 sm:p-8"><p className="eyebrow">Step three</p><h1 className="mt-2 font-display text-4xl font-bold">Make it yours</h1><p className="mt-2 text-sm text-muted">Choose colours and an original badge design for your club.</p><div className="mt-6 grid gap-4 sm:grid-cols-3">{([['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent']] as const).map(([key, label]) => <label key={key} className="subtle-card flex items-center gap-3 p-3"><input type="color" className="h-11 w-11 cursor-pointer rounded-lg border-0 bg-transparent" value={club[key]} onChange={(event) => setClub({ ...club, [key]: event.target.value })} /><span className="text-xs font-semibold">{label}<span className="mt-1 block font-mono text-[0.62rem] uppercase text-muted">{club[key]}</span></span></label>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-3">{([['badgeShape', 'Shape', ['shield', 'round', 'pennant']], ['badgePattern', 'Pattern', ['sash', 'stripes', 'split']], ['badgeSymbol', 'Mark', ['star', 'ball', 'crown']]] as const).map(([key, label, options]) => <label key={key}><span className="mb-1.5 block text-xs font-semibold">{label}</span><select className="field" value={club[key]} onChange={(event) => setClub({ ...club, [key]: event.target.value as ClubDraft[typeof key] })}>{options.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}</select></label>)}</div></div><Preview club={club} /></div> : null}
          {step === 3 ? <div className="p-5 sm:p-8"><div className="flex flex-col items-center text-center"><ClubBadge {...club} className="h-32 w-32" /><p className="eyebrow mt-5">Ready for the market</p><h1 className="mt-2 font-display text-5xl font-bold">{club.name}</h1><p className="mt-2 text-sm text-muted">{club.manager} · {club.stadium}</p>{club.motto ? <p className="mt-4 font-display text-xl italic text-gold">“{club.motto}”</p> : null}</div><div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-3">{[['League', resolvedLeague?.name ?? ''], ['Budget', resolvedLeague ? `£${(resolvedLeague.budgetMinor / 100_000_000).toFixed(1)}m` : ''], ['Market', 'Open']].map(([label, value]) => <div key={label} className="subtle-card p-3 text-center"><p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>{resolvedLeague?.inviteCode ? <div className="mx-auto mt-5 max-w-xl rounded-xl border border-gold/20 bg-gold/[0.07] p-3 text-center"><p className="text-xs text-muted">Share this invitation code with your friends</p><p className="mt-1 font-mono text-lg font-bold tracking-widest text-gold">{resolvedLeague.inviteCode}</p></div> : null}<label className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-white/10 p-3 text-left text-xs leading-5 text-muted"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-emerald bg-emerald text-white"><Check size={14} /></span>I understand that real players can have only one owner inside this private league, and lineups lock at the published deadline.</label></div> : null}
          {error ? <p className="mx-4 mb-4 rounded-xl border border-danger/30 bg-danger/[0.08] p-3 text-xs leading-5 text-[#ffc1c1]" role="alert">{error}</p> : null}
          <footer className="flex items-center justify-between border-t border-white/[0.07] bg-ink/30 p-4 sm:px-8"><span className="text-xs text-muted">{step + 1} of {steps.length}</span>{step === 0 ? <button type="button" disabled={submitting} onClick={() => void resolveLeague()} className="button-primary">{submitting ? 'Creating…' : 'Continue'} <ArrowRight size={17} /></button> : step < 3 ? <button type="button" disabled={!canContinue || submitting} onClick={() => setStep((value) => value + 1)} className="button-primary">Continue <ArrowRight size={17} /></button> : <button onClick={() => void finish()} disabled={submitting} type="button" className="button-primary">{submitting ? 'Creating…' : 'Enter the market'} <ArrowRight size={17} /></button>}</footer>
        </section>
      </div>
    </main>
  );
}

function Preview({ club }: { club: ClubDraft }) {
  return <aside className="grid min-h-72 place-items-center border-t border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:border-l md:border-t-0"><div className="text-center"><p className="eyebrow mb-4">Live preview</p><ClubBadge {...club} className="mx-auto h-32 w-32" /><p className="mt-3 font-display text-2xl font-bold">{club.name}</p><p className="mt-1 text-xs uppercase tracking-widest text-muted">{club.abbreviation}</p></div></aside>;
}
