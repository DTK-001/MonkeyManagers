import {
  ArrowRight,
  CalendarClock,
  Coins,
  Crown,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { PageHeader, SectionTitle, StatCard, StatusBadge } from '../../components/ui';
import { demoTeams } from '../../data/demo';
import { formatMoney, formatPoints, relativeTime } from '../../lib/format';

export default function HomePage() {
  const { state, currentClub } = useDemo();
  const squad = state.players.filter((player) => player.ownershipClubId === currentClub.id);
  const squadValue = squad.reduce((total, player) => total + player.valueMinor, 0);
  const movers = [...state.players]
    .filter((player) => player.ownershipClubId === currentClub.id)
    .sort(
      (a, b) =>
        Math.abs(b.valueMinor - b.previousValueMinor) -
        Math.abs(a.valueMinor - a.previousValueMinor)
    )
    .slice(0, 3);
  const nextFixture = state.fixtures.find((fixture) => fixture.status === 'upcoming');

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Manager dashboard"
        title={`Good evening, ${currentClub.manager.split(' ')[0]}`}
        description="Your club is two places and 12.45 points from the summit."
        action={<StatusBadge kind="success">Market open</StatusBadge>}
      />

      <section className="glass-card stadium-glow overflow-hidden p-5 sm:p-6">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
          <ClubBadge {...currentClub} className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{currentClub.stadium}</p>
            <h2 className="mt-1 font-display text-4xl font-bold sm:text-5xl">{currentClub.name}</h2>
            <p className="mt-2 font-display text-lg italic text-gold">“{currentClub.motto}”</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-52">
            <div className="subtle-card p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
                League position
              </p>
              <p className="mt-1 font-display text-3xl font-bold">
                {currentClub.rank}
                <sup className="text-sm text-gold">nd</sup>
              </p>
            </div>
            <div className="subtle-card p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
                Overall form
              </p>
              <div className="mt-2 flex gap-1">
                {currentClub.form.map((result, index) => (
                  <span
                    key={`${result}-${index}`}
                    className={`grid h-6 w-6 place-items-center rounded-full text-[0.6rem] font-bold ${result === 'W' ? 'bg-emerald text-white' : result === 'L' ? 'bg-danger/80 text-white' : 'bg-white/10 text-muted'}`}
                  >
                    {result}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Available balance"
          value={formatMoney(currentClub.budgetMinor)}
          hint="Ready to invest"
          trend="neutral"
          icon={<Coins size={16} />}
        />
        <StatCard
          label="Squad value"
          value={formatMoney(squadValue)}
          hint="+£1.2m this week"
          trend="up"
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="Season points"
          value={formatPoints(currentClub.totalPoints)}
          hint="12.45 off first"
          trend="up"
          icon={<Trophy size={16} />}
        />
        <StatCard
          label="Latest round"
          value={formatPoints(currentClub.latestRoundPoints)}
          hint="3rd highest score"
          trend="neutral"
          icon={<Sparkles size={16} />}
        />
      </section>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
        <div className="space-y-7">
          <section>
            <SectionTitle
              title="Matchday briefing"
              eyebrow="Next deadline"
              action={
                <Link className="text-xs font-bold text-gold hover:underline" to="/app/squad">
                  Edit lineup
                </Link>
              }
            />
            <div className="glass-card overflow-hidden">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <CalendarClock size={23} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-2xl font-bold">Round 9 lineup</h3>
                    <StatusBadge kind="warning">Closes in 1d 16h</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Saturday, 12 July · 11:30 · Crown Premier Division
                  </p>
                </div>
                <Link to="/app/squad" className="button-primary">
                  Review XI <ArrowRight size={17} />
                </Link>
              </div>
              {nextFixture ? (
                <div className="border-t border-white/[0.07] bg-white/[0.025] px-5 py-3 text-xs text-muted">
                  First fixture:{' '}
                  {demoTeams.find((team) => team.id === nextFixture.homeTeamId)?.name} vs{' '}
                  {demoTeams.find((team) => team.id === nextFixture.awayTeamId)?.name}
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <SectionTitle
              title="Active competitions"
              action={
                <Link
                  className="text-xs font-bold text-gold hover:underline"
                  to="/app/competitions"
                >
                  View all
                </Link>
              }
            />
            <div className="grid gap-3 md:grid-cols-3">
              {state.competitions.map((competition, index) => (
                <Link
                  key={competition.id}
                  to={`/app/competitions/${competition.id}`}
                  className="subtle-card group p-4 transition hover:-translate-y-0.5 hover:border-gold/30"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="grid h-10 w-10 place-items-center rounded-xl"
                      style={{ background: `${competition.colour}22`, color: competition.colour }}
                    >
                      {index === 0 ? <Crown size={20} /> : <Trophy size={20} />}
                    </span>
                    <span className="text-xs font-bold text-gold">
                      {index === 0 ? '2nd' : index === 1 ? '1st' : '3rd'}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold group-hover:text-gold">
                    {competition.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {competition.currentRound} · {competition.completeness}% complete
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs">
                    <span className="text-muted">Your points</span>
                    <span className="font-bold">
                      {formatPoints(currentClub.totalPoints * (0.64 - index * 0.17))}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle
              title="Latest from the league"
              action={
                <Link className="text-xs font-bold text-gold hover:underline" to="/app/league">
                  Activity feed
                </Link>
              }
            />
            <div className="glass-card divide-y divide-white/[0.07]">
              {state.activity.slice(0, 4).map((item) => (
                <article key={item.id} className="flex gap-3 p-4">
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.type === 'transfer' ? 'bg-gold/10 text-gold' : item.type === 'sync' ? 'bg-emerald/10 text-emerald' : 'bg-white/[0.06] text-muted'}`}
                  >
                    {item.type === 'sync' ? (
                      <RefreshCw size={16} />
                    ) : item.type === 'score' ? (
                      <Trophy size={16} />
                    ) : item.type === 'value' ? (
                      <TrendingUp size={16} />
                    ) : (
                      <Coins size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <time className="shrink-0 text-[0.63rem] text-muted">
                        {relativeTime(item.timestamp)}
                      </time>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-7">
          <section>
            <SectionTitle title="Value watch" />
            <div className="glass-card divide-y divide-white/[0.07]">
              {movers.map((player) => {
                const up = player.valueMinor >= player.previousValueMinor;
                const change = ((player.valueMinor / player.previousValueMinor - 1) * 100).toFixed(
                  1
                );
                return (
                  <Link
                    to={`/app/market/${player.id}`}
                    key={player.id}
                    className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-white/[0.025]"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${up ? 'bg-emerald/10 text-emerald' : 'bg-danger/10 text-danger'}`}
                    >
                      {up ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{player.name}</p>
                      <p className="text-xs text-muted">{formatMoney(player.valueMinor)}</p>
                    </div>
                    <span className={`text-xs font-bold ${up ? 'text-emerald' : 'text-danger'}`}>
                      {up ? '+' : ''}
                      {change}%
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-emerald/20 bg-emerald/[0.07] p-4">
            <div className="flex items-center gap-2 text-emerald">
              <ShieldCheck size={19} />
              <h2 className="text-sm font-bold">Data confidence</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#aabdb7]">
              All 10 completed league fixtures have player statistics. One cup lineup remains
              partial.
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[98%] rounded-full bg-emerald" />
            </div>
            <p className="mt-2 text-[0.63rem] text-muted">
              Updated {relativeTime(state.lastUpdated)}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
