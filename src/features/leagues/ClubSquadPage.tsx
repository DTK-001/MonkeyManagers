import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Crown, Eye, Shield, Star, UsersRound } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { PositionPill, StatusBadge } from '../../components/ui';
import { demoTeams } from '../../data/demo';
import { formatMoney } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { DemoClub, DemoPlayer, Position } from '../../types';

type ClubRecord = {
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
};

type LineupMember = {
  real_player_id: string;
  is_starter: boolean;
  bench_order: number | null;
  is_captain: boolean;
  is_vice_captain: boolean;
};

type LineupRecord = {
  id: string;
  formation: string;
  submitted_at: string | null;
  locked_at: string | null;
  fantasy_lineup_players: LineupMember[] | null;
};

const formationOrder: Position[] = ['FWD', 'MID', 'DEF', 'GK'];

const compactLineGaps: Record<number, string> = {
  1: 'gap-0',
  2: 'gap-6 sm:gap-14',
  3: 'gap-4 sm:gap-10',
  4: 'gap-2 sm:gap-7',
  5: 'gap-0.5 sm:gap-4'
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

function clubFromRecord(club: ClubRecord): DemoClub {
  return {
    id: club.id,
    name: club.name,
    abbreviation: club.abbreviation,
    manager: club.manager_display_name,
    stadium: club.stadium_name,
    motto: club.motto ?? '',
    primary: club.primary_colour,
    secondary: club.secondary_colour,
    accent: club.accent_colour,
    ...badgeFromConfig(club.badge_config),
    budgetMinor: 0,
    totalPoints: 0,
    latestRoundPoints: 0,
    competitionWins: 0,
    highestRoundScore: 0,
    rank: 0,
    form: []
  };
}

export default function ClubSquadPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { state, currentClub } = useDemo();
  const [club, setClub] = useState<DemoClub | null>(null);
  const [lineup, setLineup] = useState<LineupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId || !supabase) {
      setLoading(false);
      setError('This squad is available after the league has connected to the live service.');
      return;
    }
    const client = supabase;
    let active = true;
    async function loadSquad() {
      setLoading(true);
      setError(null);
      const [clubResponse, lineupResponse] = await Promise.all([
        client
          .from('fantasy_clubs')
          .select('id,name,abbreviation,manager_display_name,stadium_name,motto,primary_colour,secondary_colour,accent_colour,badge_config')
          .eq('id', clubId)
          .maybeSingle(),
        client
          .from('fantasy_lineups')
          .select('id,formation,submitted_at,locked_at,fantasy_lineup_players(real_player_id,is_starter,bench_order,is_captain,is_vice_captain)')
          .eq('fantasy_club_id', clubId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);
      if (!active) return;
      if (clubResponse.error || !clubResponse.data) {
        setError('This club is not available in your league.');
        setLoading(false);
        return;
      }
      if (lineupResponse.error) {
        setError('This formation could not be loaded right now.');
        setLoading(false);
        return;
      }
      setClub(clubFromRecord(clubResponse.data as unknown as ClubRecord));
      setLineup((lineupResponse.data as unknown as LineupRecord | null) ?? null);
      setLoading(false);
    }
    void loadSquad();
    return () => { active = false; };
  }, [clubId]);

  const membersByPlayerId = useMemo(
    () => new Map((lineup?.fantasy_lineup_players ?? []).map((member) => [member.real_player_id, member])),
    [lineup]
  );
  const squadPlayers = useMemo(
    () => state.players.flatMap((player) => {
      const member = player.realPlayerId ? membersByPlayerId.get(player.realPlayerId) : undefined;
      return member ? [{ player, member }] : [];
    }),
    [membersByPlayerId, state.players]
  );
  const starters = squadPlayers.filter(({ member }) => member.is_starter).map(({ player }) => player);
  const bench = squadPlayers
    .filter(({ member }) => !member.is_starter)
    .sort((left, right) => (left.member.bench_order ?? 99) - (right.member.bench_order ?? 99));
  const resolvedCount = squadPlayers.length;
  const expectedCount = lineup?.fantasy_lineup_players?.length ?? 0;

  if (clubId === currentClub.id) {
    return <Navigate to="/app/squad" replace />;
  }

  return (
    <div className="page-wrap">
      <Link to="/app/league" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ivory">
        <ArrowLeft size={17} /> League table
      </Link>

      {loading ? (
        <section className="glass-card p-6 text-sm text-muted">Loading this squad…</section>
      ) : error ? (
        <section className="glass-card p-6">
          <p className="text-sm text-muted">{error}</p>
          <Link to="/app/league" className="button-secondary mt-5">Return to league</Link>
        </section>
      ) : club ? (
        <>
          <section className="glass-card overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
              <ClubBadge {...club} className="h-20 w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">League squad</p>
                <h1 className="mt-1 truncate font-display text-4xl font-bold sm:text-5xl">{club.name}</h1>
                <p className="mt-2 text-sm text-muted">{club.manager} · {club.stadium}</p>
              </div>
              <StatusBadge kind={lineup?.locked_at ? 'muted' : 'success'}>
                {lineup?.locked_at ? 'Team locked' : 'Read only'}
              </StatusBadge>
            </div>
            <div className="border-t border-white/[0.07] bg-white/[0.02] px-5 py-3 text-xs leading-5 text-muted sm:px-7">
              You can inspect this manager’s submitted team and player profiles. Only its owner can make changes.
            </div>
          </section>

          {!lineup ? (
            <section className="glass-card mt-6 p-6 text-center">
              <UsersRound className="mx-auto text-gold" size={26} />
              <h2 className="mt-3 font-display text-2xl font-bold">No team submitted yet</h2>
              <p className="mt-2 text-sm leading-6 text-muted">This manager has not published a formation for the current round.</p>
            </section>
          ) : (
            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
              <section className="glass-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-gold" />
                    <span className="text-sm font-semibold">Formation {lineup.formation}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted"><Eye size={15} /> View only</span>
                </div>
                <div className="pitch-lines relative grid min-h-[29rem] grid-rows-[auto_repeat(4,minmax(4.6rem,1fr))] overflow-hidden px-3 py-3 sm:min-h-[33rem] sm:grid-rows-[auto_repeat(4,minmax(5.5rem,1fr))] sm:px-8 sm:py-4">
                  <p className="pitch-note relative z-10 mx-auto self-center rounded-full bg-ink/80 px-3 py-1 text-[0.62rem] font-medium text-muted shadow-sm">Tap a player to view their profile</p>
                  {formationOrder.map((position) => {
                    const positionStarters = starters.filter((player) => player.position === position);
                    return (
                      <div key={position} className={clsx('relative z-10 flex items-center justify-center', compactLineGaps[positionStarters.length] ?? 'gap-1')}>
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-ink/50 px-1.5 py-0.5 text-[0.55rem] font-bold tracking-[0.14em] text-muted sm:left-1 sm:px-2">{position}</span>
                        {positionStarters.map((player) => (
                          <ReadOnlyPlayerToken
                            key={player.id}
                            player={player}
                            captain={membersByPlayerId.get(player.realPlayerId ?? '')?.is_captain ?? false}
                            vice={membersByPlayerId.get(player.realPlayerId ?? '')?.is_vice_captain ?? false}
                            onView={() => navigate(`/app/market/${player.id}`, { state: { returnTo: `/app/league/club/${club.id}`, returnLabel: `${club.name} squad` } })}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
                {resolvedCount !== expectedCount ? <p className="border-t border-white/[0.07] px-4 py-3 text-xs text-muted">Some player profiles are still syncing. Pull down to refresh this view shortly.</p> : null}
              </section>

              <aside className="space-y-5">
                <section className="glass-card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
                    <div><p className="eyebrow">Bench order</p><h2 className="mt-1 font-display text-2xl font-bold">Substitutes</h2></div>
                    <span className="text-xs text-muted">{bench.length}/7 shown</span>
                  </div>
                  <div className="divide-y divide-white/[0.07]">
                    {bench.map(({ player, member }) => (
                      <button key={player.id} type="button" onClick={() => navigate(`/app/market/${player.id}`, { state: { returnTo: `/app/league/club/${club.id}`, returnLabel: `${club.name} squad` } })} className="flex min-h-16 w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/[0.035]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-xs font-bold">{member.bench_order}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{player.name}</span><span className="mt-0.5 flex items-center gap-2"><PositionPill position={player.position} /><span className="text-[0.62rem] text-muted">{formatMoney(player.valueMinor)}</span></span></span>
                      </button>
                    ))}
                    {bench.length === 0 ? <p className="p-5 text-center text-xs text-muted">No substitutes shown.</p> : null}
                  </div>
                </section>
                <section className="glass-card p-4">
                  <p className="eyebrow">Leadership</p>
                  <h2 className="mt-1 font-display text-2xl font-bold">Captaincy</h2>
                  <LeadershipPlayer label="Captain" icon={<Crown size={16} />} player={squadPlayers.find(({ member }) => member.is_captain)?.player} />
                  <LeadershipPlayer label="Vice-captain" icon={<Star size={16} />} player={squadPlayers.find(({ member }) => member.is_vice_captain)?.player} />
                </section>
              </aside>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function ReadOnlyPlayerToken({ player, captain, vice, onView }: { player: DemoPlayer; captain: boolean; vice: boolean; onView: () => void }) {
  const team = demoTeams.find((item) => item.id === player.teamId);
  return <button type="button" onClick={onView} className="group flex w-11 min-w-0 flex-col items-center sm:w-20 lg:w-24" aria-label={`View ${player.name}'s profile`}>
    <span className="relative grid h-10 w-10 place-items-center rounded-full border-2 bg-ink text-xs font-bold shadow-lg transition group-hover:-translate-y-1 sm:h-14 sm:w-14 sm:text-sm" style={{ borderColor: team?.colour }}>
      {player.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
      {captain || vice ? <span className="absolute -right-1 -top-1 grid h-5 min-h-5 w-5 place-items-center rounded-full bg-gold text-[0.55rem] font-black text-ink">{captain ? 'C' : 'V'}</span> : null}
    </span>
    <span className="mt-1 max-w-full truncate rounded-md bg-ink/90 px-1 py-0.5 text-[0.53rem] font-semibold shadow sm:mt-1.5 sm:px-1.5 sm:py-1 sm:text-[0.57rem]">{player.name}</span>
  </button>;
}

function LeadershipPlayer({ label, icon, player }: { label: string; icon: ReactNode; player?: DemoPlayer }) {
  return <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
    <p className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted">{icon} {label}</p>
    <p className="mt-1 truncate text-sm font-semibold">{player?.name ?? 'Not assigned'}</p>
  </div>;
}
