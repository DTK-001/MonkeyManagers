import { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Crown,
  GitBranch,
  Info,
  Trophy
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useDemo } from '../../app/demo-store';
import { demoTeams } from '../../data/demo';
import { formatPoints } from '../../lib/format';
import { PageHeader, StatusBadge } from '../../components/ui';

type Tab = 'table' | 'fixtures' | 'bracket';

export default function CompetitionPage() {
  const { competitionId } = useParams();
  const { state, currentClub } = useDemo();
  const [tab, setTab] = useState<Tab>('table');
  const competition = state.competitions.find((item) => item.id === competitionId);
  if (!competition) return <div className="page-wrap">Competition not found.</div>;
  const fixtures = state.fixtures.filter((fixture) => fixture.competitionId === competition.id);
  const sorted = [...state.clubs].sort(
    (a, b) =>
      b.totalPoints * (competition.id === 'premier' ? 0.64 : competition.id === 'cup' ? 0.3 : 0.2) -
      a.totalPoints * (competition.id === 'premier' ? 0.64 : competition.id === 'cup' ? 0.3 : 0.2)
  );
  const ratio = competition.id === 'premier' ? 0.64 : competition.id === 'cup' ? 0.3 : 0.2;
  return (
    <div className="page-wrap">
      <Link
        to="/app/competitions"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ivory"
      >
        <ArrowLeft size={17} /> Competitions
      </Link>
      <PageHeader
        eyebrow={`${competition.format} · ${competition.currentRound}`}
        title={competition.name}
        description={`${competition.completeness}% source completeness · all points isolated to ${competition.shortName}.`}
        action={
          <StatusBadge kind={competition.completeness === 100 ? 'success' : 'warning'}>
            {competition.status}
          </StatusBadge>
        }
      />
      <section className="glass-card overflow-hidden">
        <div className="flex overflow-x-auto border-b border-white/[0.07] p-1.5" role="tablist">
          {(
            [
              { id: 'table', label: 'Leaderboard', icon: Trophy },
              { id: 'fixtures', label: 'Fixtures & rounds', icon: CalendarDays },
              { id: 'bracket', label: 'Private cup', icon: GitBranch }
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${tab === id ? 'bg-white/[0.08] text-gold' : 'text-muted'}`}
            >
              <Icon size={16} /> {label}
              {id === 'bracket' ? (
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[0.55rem]">BETA</span>
              ) : null}
            </button>
          ))}
        </div>
        {tab === 'table' ? (
          <div>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem] border-b border-white/[0.07] px-4 py-2 text-[0.62rem] font-bold uppercase tracking-wider text-muted sm:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_7rem]">
              <span>#</span>
              <span>Fantasy club</span>
              <span className="hidden sm:block">Rounds</span>
              <span>Latest</span>
              <span className="text-right">Points</span>
            </div>
            {sorted.map((club, index) => (
              <div
                key={club.id}
                className={`grid min-h-[4.5rem] grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem] items-center border-b border-white/[0.07] px-4 py-2 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_7rem] ${club.id === currentClub.id ? 'bg-gold/[0.06]' : ''}`}
              >
                <span className="font-display text-2xl font-bold text-gold">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{club.name}</p>
                  <p className="truncate text-[0.62rem] text-muted">
                    {club.id === currentClub.id ? 'Your club' : club.manager}
                  </p>
                </div>
                <span className="hidden text-sm sm:block">8</span>
                <span className="text-sm">{formatPoints(club.latestRoundPoints * ratio)}</span>
                <span className="text-right font-display text-xl font-bold">
                  {formatPoints(club.totalPoints * ratio)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {tab === 'fixtures' ? (
          <div>
            {fixtures.length ? (
              fixtures.map((fixture) => {
                const home = demoTeams.find((team) => team.id === fixture.homeTeamId);
                const away = demoTeams.find((team) => team.id === fixture.awayTeamId);
                return (
                  <article
                    key={fixture.id}
                    className="grid min-h-24 items-center gap-3 border-b border-white/[0.07] px-4 py-4 last:border-0 sm:grid-cols-[8rem_1fr_8rem]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gold">{fixture.round}</p>
                      <p className="mt-1 text-[0.63rem] text-muted">
                        {new Intl.DateTimeFormat('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(fixture.kickoff))}
                      </p>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                      <span className="text-right font-semibold">{home?.name}</span>
                      <span className="font-display text-2xl font-bold">
                        {fixture.status === 'completed'
                          ? `${fixture.homeScore} – ${fixture.awayScore}`
                          : 'vs'}
                      </span>
                      <span className="font-semibold">{away?.name}</span>
                    </div>
                    <div className="text-right">
                      <StatusBadge kind={fixture.status === 'completed' ? 'success' : 'muted'}>
                        {fixture.status}
                      </StatusBadge>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="p-12 text-center text-muted">
                No seeded fixtures in this competition.
              </div>
            )}
          </div>
        ) : null}
        {tab === 'bracket' ? (
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-gold/20 bg-gold/[0.06] p-3">
              <Info size={17} className="mt-0.5 shrink-0 text-gold" />
              <p className="text-xs leading-5 text-muted">
                Private ties use fantasy points from the matching real round. Ties resolve by
                captain points, then selected-lineup shots on target.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_3rem_1fr]">
              <div className="space-y-4">
                <p className="eyebrow">Semi-finals</p>
                {[
                  [state.clubs[0], state.clubs[3]],
                  [state.clubs[1], state.clubs[2]]
                ].map((pair, index) => (
                  <div key={index} className="subtle-card divide-y divide-white/[0.07]">
                    {pair.map((club, clubIndex) =>
                      club ? (
                        <div key={club.id} className="flex items-center justify-between p-3">
                          <span className="text-sm font-semibold">{club.name}</span>
                          <span
                            className={`font-display text-xl font-bold ${clubIndex === 0 ? 'text-gold' : ''}`}
                          >
                            {formatPoints(club.latestRoundPoints * ratio)}
                          </span>
                        </div>
                      ) : null
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden items-center justify-center lg:flex">
                <ChevronRight className="text-gold" />
              </div>
              <div>
                <p className="eyebrow">Final</p>
                <div className="subtle-card mt-4 divide-y divide-white/[0.07]">
                  <div className="flex items-center justify-between p-3">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 size={15} className="text-emerald" /> Holloway Ravens
                    </span>
                    <Crown size={18} className="text-gold" />
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-sm font-semibold text-muted">Orbital Athletic</span>
                    <span className="text-xs text-muted">TBD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
