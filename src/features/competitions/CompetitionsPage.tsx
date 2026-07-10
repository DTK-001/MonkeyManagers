import { ArrowRight, CheckCircle2, Crown, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { formatPoints, relativeTime } from '../../lib/format';
import { PageHeader, SectionTitle, StatusBadge } from '../../components/ui';

export default function CompetitionsPage() {
  const { state, currentClub } = useDemo();
  const sortedClubs = [...state.clubs].sort((a, b) => b.totalPoints - a.totalPoints);
  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Real matches · private glory"
        title="Competitions"
        description="Each point stays with the real competition where it was earned. Every enabled competition has its own private table."
        action={<StatusBadge kind="success">Updated {relativeTime(state.lastUpdated)}</StatusBadge>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {state.competitions.map((competition, index) => (
          <Link
            key={competition.id}
            to={`/app/competitions/${competition.id}`}
            className="glass-card group overflow-hidden transition hover:-translate-y-1 hover:border-gold/30"
          >
            <div className="h-1" style={{ backgroundColor: competition.colour }} />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl"
                  style={{ backgroundColor: `${competition.colour}1f`, color: competition.colour }}
                >
                  {index === 0 ? <Crown size={24} /> : <Trophy size={24} />}
                </span>
                <StatusBadge kind={competition.completeness === 100 ? 'success' : 'warning'}>
                  {competition.completeness}% data
                </StatusBadge>
              </div>
              <p className="eyebrow mt-5">{competition.format}</p>
              <h2 className="mt-1 font-display text-3xl font-bold transition group-hover:text-gold">
                {competition.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {competition.status} · {competition.currentRound}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="subtle-card p-3">
                  <p className="text-[0.62rem] uppercase tracking-wider text-muted">Your rank</p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {index === 0 ? '2nd' : index === 1 ? '1st' : '3rd'}
                  </p>
                </div>
                <div className="subtle-card p-3">
                  <p className="text-[0.62rem] uppercase tracking-wider text-muted">Points</p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    {formatPoints(currentClub.totalPoints * (0.64 - index * 0.17))}
                  </p>
                </div>
              </div>
              <span className="mt-5 flex min-h-11 items-center justify-between border-t border-white/[0.07] pt-4 text-sm font-semibold text-gold">
                Open competition <ArrowRight size={17} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <SectionTitle title="Overall season table" eyebrow="Across all competitions" />
          <div className="glass-card overflow-hidden">
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem] border-b border-white/[0.07] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted sm:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_7rem]">
              <span>#</span>
              <span>Club</span>
              <span className="hidden sm:block">Wins</span>
              <span>Last</span>
              <span className="text-right">Total</span>
            </div>
            {sortedClubs.map((club, index) => (
              <div
                key={club.id}
                className={`grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem] items-center border-b border-white/[0.07] px-4 py-2 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_7rem] ${club.id === currentClub.id ? 'bg-gold/[0.05]' : ''}`}
              >
                <span className="font-display text-xl font-bold text-gold">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{club.name}</p>
                  <p className="truncate text-[0.62rem] text-muted">{club.manager}</p>
                </div>
                <span className="hidden text-sm sm:block">{club.competitionWins}</span>
                <span className="text-sm">{formatPoints(club.latestRoundPoints)}</span>
                <span className="text-right font-display text-xl font-bold">
                  {formatPoints(club.totalPoints)}
                </span>
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-emerald/20 bg-emerald/[0.06] p-4">
            <ShieldCheck className="text-emerald" />
            <h2 className="mt-3 font-display text-2xl font-bold">Coverage looks strong</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Player statistics were observed in every enabled competition. Cup lineups are 94%
              complete.
            </p>
            <Link
              to="/app/admin"
              className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-emerald"
            >
              Open coverage report <ArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] p-4">
            <Sparkles className="text-gold" />
            <div className="mt-3 flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold">Private cup</h2>
              <span className="rounded-full bg-gold/15 px-2 py-1 text-[0.6rem] font-bold text-gold">
                BETA
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              The seeded bracket begins with the Heritage Challenge Cup round of 16.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-[#d5c29d]">
              <CheckCircle2 size={14} /> Byes and captain-points tiebreaks enabled
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
