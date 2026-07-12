import { ArrowRight, CalendarClock, Coins, ShieldCheck, Sparkles, Trophy, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { ClubBadge } from '../../components/ClubBadge';
import { PageHeader, SectionTitle, StatCard, StatusBadge } from '../../components/ui';
import { formatMoney, formatPoints } from '../../lib/format';

export default function HomePage() {
  const { state, currentClub } = useDemo();
  const squad = state.players.filter((player) => player.ownershipClubId === currentClub.id);
  const squadValue = squad.reduce((total, player) => total + player.valueMinor, 0);
  const hasScoredRound = currentClub.totalPoints > 0 || currentClub.latestRoundPoints > 0;

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Manager dashboard"
        title={`Good evening, ${currentClub.manager.split(' ')[0]}`}
        description="Your private league is ready. Build your squad, invite your friends, then the real season can begin."
        action={<StatusBadge kind="success">Market open</StatusBadge>}
      />

      <section className="glass-card stadium-glow overflow-hidden p-5 sm:p-6">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
          <ClubBadge {...currentClub} className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{currentClub.stadium}</p>
            <h2 className="mt-1 font-display text-4xl font-bold sm:text-5xl">{currentClub.name}</h2>
            {currentClub.motto ? <p className="mt-2 font-display text-lg font-semibold text-gold">“{currentClub.motto}”</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-56">
            <div className="subtle-card p-3"><p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">League table</p><p className="mt-1 text-sm font-semibold">{hasScoredRound ? `#${currentClub.rank}` : 'Not started'}</p></div>
            <div className="subtle-card p-3"><p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Results</p><p className="mt-1 text-sm font-semibold">{hasScoredRound ? 'Recorded' : 'No results yet'}</p></div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Available balance" value={formatMoney(currentClub.budgetMinor)} hint="Ready to invest" trend="neutral" icon={<Coins size={16} />} />
        <StatCard label="Squad value" value={formatMoney(squadValue)} hint={`${squad.length} players signed`} trend="neutral" icon={<UsersRound size={16} />} />
        <StatCard label="Season points" value={formatPoints(currentClub.totalPoints)} hint={hasScoredRound ? 'Live league total' : 'Scoring has not begun'} trend="neutral" icon={<Trophy size={16} />} />
        <StatCard label="Latest round" value={formatPoints(currentClub.latestRoundPoints)} hint={hasScoredRound ? 'Most recent score' : 'No completed rounds'} trend="neutral" icon={<Sparkles size={16} />} />
      </section>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
        <div className="space-y-7">
          <section>
            <SectionTitle title="Get your club ready" eyebrow="First steps" />
            <div className="glass-card p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><CalendarClock size={23} /></span><div className="min-w-0 flex-1"><h3 className="font-display text-2xl font-bold">Build your first squad</h3><p className="mt-1 text-sm text-muted">No fixture schedule or scoring round is attached to this league yet. Start by choosing players from the market.</p></div><Link to="/app/market" className="button-primary">Browse players <ArrowRight size={17} /></Link></div>
            </div>
          </section>
          <section>
            <SectionTitle title="Competitions" />
            <div className="glass-card p-6 text-center"><Trophy className="mx-auto text-gold" size={28} /><h3 className="mt-3 font-display text-2xl font-bold">Nothing scored yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Competition tables and fixture progress will appear here only after the league’s real schedule and scoring rules are configured.</p></div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border border-emerald/25 bg-emerald/[0.07] p-5"><ShieldCheck className="text-emerald" /><h2 className="mt-3 font-display text-2xl font-bold">Clean league start</h2><p className="mt-2 text-xs leading-5 text-muted">There are no inherited rankings, fixtures, competition points, or other managers’ squads in this league.</p></section>
          <section className="glass-card p-5"><p className="eyebrow">Squad status</p><p className="mt-1 font-display text-3xl font-bold">{squad.length} players</p><p className="mt-2 text-sm text-muted">Your squad has no arbitrary size limit: every additional signing must simply fit within your available budget.</p><Link to="/app/market" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-gold">Open market <ArrowRight size={16} /></Link></section>
        </aside>
      </div>
    </div>
  );
}
