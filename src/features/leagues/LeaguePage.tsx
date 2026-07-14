import { useEffect, useMemo, useState } from 'react';
import { Copy, Plus, ShieldCheck, Trophy, UserPlus, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { formatMoney, formatPoints } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { DemoClub } from '../../types';
import { PageHeader, StatusBadge } from '../../components/ui';

type InviteResponse = { code: string };
type LeagueClub = DemoClub & { squadValueMinor: number };
type ServerClub = {
  id: string;
  name: string;
  abbreviation: string;
  manager_display_name: string;
  stadium_name: string;
  motto: string | null;
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  badge_config: unknown;
  available_balance_minor: number;
  squad_book_value_minor: number;
};

function badgeFromConfig(value: unknown): Pick<DemoClub, 'badgeShape' | 'badgePattern' | 'badgeSymbol'> {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    badgeShape: config.shape === 'round' || config.shape === 'pennant' ? config.shape : 'shield',
    badgePattern: config.pattern === 'stripes' || config.pattern === 'split' ? config.pattern : 'sash',
    badgeSymbol: config.symbol === 'ball' || config.symbol === 'crown' ? config.symbol : 'star'
  };
}

export default function LeaguePage() {
  const { state, currentClub } = useDemo();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [leagueClubs, setLeagueClubs] = useState<LeagueClub[] | null>(null);
  const fallbackClubs = useMemo<LeagueClub[]>(
    () => state.clubs.map((club) => ({
      ...club,
      squadValueMinor: state.players
        .filter((player) => player.ownershipClubId === club.id)
        .reduce((sum, player) => sum + player.valueMinor, 0)
    })),
    [state.clubs, state.players]
  );
  const sorted = [...(leagueClubs ?? fallbackClubs)].sort(
    (a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name)
  );
  const scoringStarted = sorted.some((club) => club.totalPoints > 0);
  const canCreateInvite = Boolean(supabase && state.selectedLeagueId !== 'league-pending');

  useEffect(() => {
    if (!supabase || state.selectedLeagueId === 'league-pending') {
      setLeagueClubs(null);
      return;
    }
    void supabase
      .from('fantasy_clubs')
      .select('id,name,abbreviation,manager_display_name,stadium_name,motto,primary_colour,secondary_colour,accent_colour,badge_config,available_balance_minor,squad_book_value_minor')
      .eq('league_id', state.selectedLeagueId)
      .then(({ data, error }) => {
        const clubs = data as unknown as ServerClub[] | null;
        if (error || !clubs) return;
        setLeagueClubs(clubs.map((club) => ({
          id: String(club.id),
          name: String(club.name),
          abbreviation: String(club.abbreviation),
          manager: String(club.manager_display_name),
          stadium: String(club.stadium_name),
          motto: club.motto ?? '',
          primary: String(club.primary_colour),
          secondary: String(club.secondary_colour),
          accent: String(club.accent_colour),
          ...badgeFromConfig(club.badge_config),
          budgetMinor: Number(club.available_balance_minor),
          squadValueMinor: Number(club.squad_book_value_minor),
          totalPoints: 0,
          latestRoundPoints: 0,
          competitionWins: 0,
          highestRoundScore: 0,
          rank: 0,
          form: []
        })));
      });
  }, [state.selectedLeagueId]);

  async function createInvite() {
    if (!supabase || !canCreateInvite) {
      setInviteStatus('Connect Supabase and create or join a league before inviting a manager.');
      return;
    }
    setCreatingInvite(true);
    setInviteStatus(null);
    try {
      const response = (await supabase.rpc('create_league_invitation', {
        p_league_id: state.selectedLeagueId,
        p_role: 'manager',
        p_expires_in: '90 days',
        p_max_uses: 20
      })) as unknown as { data: InviteResponse | null; error: Error | null };
      if (response.error) throw response.error;
      if (!response.data?.code) throw new Error('The invitation code could not be created.');
      setInviteCode(response.data.code);
      setInviteStatus('Invite code ready. It can be used by up to 20 managers for 90 days.');
    } catch (cause) {
      setInviteStatus(
        cause instanceof Error
          ? cause.message
          : 'The invitation code could not be created. Only league admins can create invites.'
      );
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyInvite() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteStatus('Invite code copied. Send it to your friend, then they can join from account setup.');
    } catch {
      setInviteStatus('Copy is unavailable here. Select the code above and send it to your friend.');
    }
  }

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Private league"
        title={state.leagueName}
        description={`${sorted.length} manager${sorted.length === 1 ? '' : 's'} · New season · Europe/London`}
        action={
          <Link to="/onboarding" className="button-primary">
            <Plus size={16} /> Create or join
          </Link>
        }
      />

      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
            <UsersRound size={29} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-3xl font-bold">League table</h2>
            <p className="mt-1 text-xs text-muted">
              {scoringStarted
                ? 'Ranked by points earned in this private league.'
                : 'The table will begin once real scores are recorded.'}
            </p>
          </div>
          <StatusBadge kind="success">Active</StatusBadge>
        </div>
        <div className="hidden grid-cols-[3rem_minmax(13rem,1fr)_7rem_7rem_7rem] border-b border-white/[0.07] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted md:grid">
          <span>#</span>
          <span>Club</span>
          <span>Balance</span>
          <span>Squad value</span>
          <span className="text-right">Points</span>
        </div>
        {sorted.map((club, index) => {
          return (
            <article
              key={club.id}
              className={`grid min-h-20 grid-cols-[2.5rem_minmax(0,1fr)_5rem] items-center gap-2 border-b border-white/[0.07] px-3 py-3 last:border-0 md:grid-cols-[3rem_minmax(13rem,1fr)_7rem_7rem_7rem] md:px-4 ${club.id === currentClub.id ? 'bg-gold/[0.06]' : ''}`}
            >
              <span className="font-display text-2xl font-bold text-gold">
                {scoringStarted ? index + 1 : '—'}
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <ClubBadge {...club} className="h-12 w-12 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{club.name}</p>
                  <p className="truncate text-[0.65rem] text-muted">
                    {club.manager}
                    {club.id === currentClub.id ? ' · You' : ''}
                  </p>
                </div>
              </div>
              <span className="hidden text-xs md:block">{formatMoney(club.budgetMinor)}</span>
              <span className="hidden text-xs md:block">{formatMoney(club.squadValueMinor)}</span>
              <span className="text-right font-display text-xl font-bold">
                {formatPoints(club.totalPoints)}
              </span>
            </article>
          );
        })}
      </section>

      <div className="mt-7 grid gap-7 lg:grid-cols-2">
        <section className="glass-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
              <UserPlus size={21} />
            </span>
            <div>
              <p className="eyebrow">Grow the league</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Invite your friends</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Create a private code, then send it to your friend. They sign in, choose{' '}
                <strong className="font-semibold text-ivory">Join a league</strong>, enter the code,
                and create their club.
              </p>
            </div>
          </div>

          {inviteCode ? (
            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.07] p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
                Share this code
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xl font-bold tracking-[0.2em] text-gold">
                  {inviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => void copyInvite()}
                  className="button-secondary min-h-11 px-3"
                  aria-label="Copy invitation code"
                >
                  <Copy size={16} /> Copy
                </button>
              </div>
            </div>
          ) : null}

          {inviteStatus ? (
            <p className="mt-4 text-xs leading-5 text-muted" role="status">
              {inviteStatus}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void createInvite()}
              disabled={creatingInvite}
              className="button-primary"
            >
              <UserPlus size={16} /> {creatingInvite ? 'Creating code…' : 'Create invite code'}
            </button>
            <Link to="/onboarding" className="button-secondary">
              <Plus size={16} /> Start or join another league
            </Link>
          </div>
          {!canCreateInvite ? (
            <p className="mt-3 text-xs leading-5 text-muted">
              League invites become available after Supabase is connected and you have created or
              joined a league.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-emerald/25 bg-emerald/[0.07] p-6">
          <ShieldCheck className="text-emerald" />
          <h2 className="mt-3 font-display text-2xl font-bold">Clean starting state</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            No placeholder clubs, scores, or fixture results are included in this league. Each
            invited manager creates their own distinct club before the real season begins.
          </p>
        </section>

        <section className="glass-card p-6 text-center lg:col-span-2">
          <Trophy className="mx-auto text-gold" size={28} />
          <h2 className="mt-3 font-display text-2xl font-bold">No league activity yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Transfers, fixture results, and scoring updates will appear here when they genuinely
            happen.
          </p>
        </section>
      </div>
    </div>
  );
}
