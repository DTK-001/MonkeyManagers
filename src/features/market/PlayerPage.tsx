import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  CircleAlert,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDemo } from '../../app/demo-store';
import { demoTeams } from '../../data/demo';
import { formatMoney, formatPoints, positionLabel } from '../../lib/format';
import { PositionPill, StatusBadge } from '../../components/ui';

export default function PlayerPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const marketReturnState: unknown = location.state as unknown;
  const { state, currentClub, buyPlayer, releasePlayer } = useDemo();
  const player = state.players.find((item) => item.id === playerId);
  if (!player)
    return (
      <div className="page-wrap">
        <p>Player not found.</p>
        <Link to="/app/market" state={marketReturnState} className="button-secondary mt-4">
          Return to market
        </Link>
      </div>
    );
  const selectedPlayer = player;
  const team = demoTeams.find((item) => item.id === player.teamId);
  const owner = state.clubs.find((club) => club.id === player.ownershipClubId);
  const mine = owner?.id === currentClub.id;
  const valueChange = (player.valueMinor / player.previousValueMinor - 1) * 100;
  const valueChangeMinor = player.valueMinor - player.previousValueMinor;
  const chartData = player.valueHistory.map((point) => ({
    ...point,
    value: point.valueMinor / 100_000_000
  }));
  const mostRecent = player.recentPoints.at(-1) ?? 0;

  function action() {
    if (mine) releasePlayer(selectedPlayer.id);
    else if (!owner) buyPlayer(selectedPlayer.id);
    navigate('/app/market', { state: marketReturnState });
  }

  return (
    <div className="page-wrap">
      <Link
        to="/app/market"
        state={marketReturnState}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ivory"
      >
        <ArrowLeft size={17} /> Player market
      </Link>
      <section className="glass-card overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div
            className="absolute inset-x-0 top-0 h-32 opacity-20"
            style={{
              background: `radial-gradient(circle at 72% 0%, ${team?.colour ?? '#c3a46d'}, transparent 55%)`
            }}
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-gold/40 bg-ink font-display text-4xl font-bold shadow-card">
              {player.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <PositionPill position={player.position} />
                {player.provisional ? (
                  <StatusBadge kind="warning">Provisional value</StatusBadge>
                ) : null}
                {player.availability !== 'available' ? (
                  <StatusBadge kind="danger">{player.availability}</StatusBadge>
                ) : (
                  <StatusBadge kind="success">Available</StatusBadge>
                )}
              </div>
              <h1 className="mt-2 font-display text-5xl font-bold sm:text-6xl">{player.name}</h1>
              <p className="mt-2 text-sm text-muted">
                {positionLabel[player.position]} · {team?.name} · {player.nationality}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="eyebrow">Book value</p>
              <p className="mt-1 font-display text-4xl font-bold">
                {formatMoney(player.valueMinor)}
              </p>
              <p
                className={`mt-1 flex items-center gap-1 text-xs font-bold sm:justify-end ${valueChange >= 0 ? 'text-emerald' : 'text-danger'}`}
              >
                {valueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {valueChange >= 0 ? '+' : ''}
                {valueChange.toFixed(1)}% today
              </p>
            </div>
          </div>
        </div>
        <div className="grid border-t border-white/[0.07] bg-white/[0.02] sm:grid-cols-4">
          {[
            ['Season points', formatPoints(player.seasonPoints)],
            ['Recent form', formatPoints(player.form)],
            ['Last match', formatPoints(mostRecent)],
            [
              mine ? 'Your club points' : 'Owner',
              mine ? formatPoints(player.ownedPoints) : (owner?.name ?? 'Free agent')
            ]
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-b border-white/[0.07] p-4 last:border-0 sm:border-b-0 sm:border-r"
            >
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">
                {label}
              </p>
              <p className="mt-1 truncate font-display text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
        <div className="space-y-6">
          <section className="glass-card p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="eyebrow">Dynamic valuation</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Price history</h2>
              </div>
              <BarChart3 className="text-gold" size={21} />
            </div>
            <div className="h-64 w-full" aria-label="Player value history chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9da9aa', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: string) => value.slice(5)}
                  />
                  <YAxis
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    tick={{ fill: '#9da9aa', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => `£${value.toFixed(1)}m`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#071520',
                      border: '1px solid rgba(255,255,255,.12)',
                      borderRadius: 12,
                      fontSize: 12
                    }}
                    formatter={(value: number) => [`£${value.toFixed(2)}m`, 'Value']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#c3a46d"
                    strokeWidth={2.5}
                    dot={{ r: 2, fill: '#c3a46d' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <p
                className={`flex items-start gap-2 rounded-xl p-3 text-xs leading-5 ${valueChangeMinor < 0 ? 'bg-danger/[0.07] text-[#efc5c5]' : 'bg-emerald/[0.07] text-[#a9cbb9]'}`}
              >
                {valueChangeMinor >= 0 ? (
                  <TrendingUp size={15} className="mt-0.5 shrink-0 text-emerald" />
                ) : (
                  <TrendingDown size={15} className="mt-0.5 shrink-0 text-danger" />
                )}
                {valueChangeMinor === 0
                  ? 'The current catalogue price is unchanged from its previous value.'
                  : `The current catalogue price is ${formatMoney(Math.abs(valueChangeMinor))} ${valueChangeMinor > 0 ? 'higher' : 'lower'} than its previous value.`}
              </p>
              <p className="flex items-start gap-2 rounded-xl bg-white/[0.035] p-3 text-xs leading-5 text-muted">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-gold" /> A structured
                valuation explanation is published only after source-backed scoring runs.
              </p>
            </div>
          </section>

          <section className="glass-card overflow-hidden">
            <div className="p-5">
              <p className="eyebrow">Season performance</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Player record</h2>
              <p className="mt-1 text-xs text-muted">
                Official Premier League catalogue data for this season.
              </p>
            </div>
            <PlayerMetricGrid
              metrics={[
                ['Minutes', player.seasonStats.minutes],
                ['Starts', player.seasonStats.starts],
                ['Goals', player.seasonStats.goals],
                ['Assists', player.seasonStats.assists],
                ['Clean sheets', player.seasonStats.cleanSheets],
                ['Goals conceded', player.seasonStats.goalsConceded],
                ['Saves', player.seasonStats.saves],
                ['Bonus', player.seasonStats.bonus],
                ['BPS', player.seasonStats.bps],
                ['Yellow cards', player.seasonStats.yellowCards],
                ['Red cards', player.seasonStats.redCards],
                ['Own goals', player.seasonStats.ownGoals],
                ['Penalties saved', player.seasonStats.penaltiesSaved],
                ['Penalties missed', player.seasonStats.penaltiesMissed]
              ]}
            />
          </section>

          <section className="glass-card overflow-hidden">
            <div className="p-5">
              <p className="eyebrow">Underlying numbers</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Expected & creative data</h2>
              <p className="mt-1 text-xs text-muted">
                These figures help compare players beyond their finished-point total.
              </p>
            </div>
            <PlayerMetricGrid
              decimal
              metrics={[
                ['Expected goals', player.seasonStats.expectedGoals],
                ['Expected assists', player.seasonStats.expectedAssists],
                ['Expected goal involvements', player.seasonStats.expectedGoalInvolvements],
                ['Expected goals conceded', player.seasonStats.expectedGoalsConceded],
                ['Influence', player.seasonStats.influence],
                ['Creativity', player.seasonStats.creativity],
                ['Threat', player.seasonStats.threat],
                ['ICT index', player.seasonStats.ictIndex]
              ]}
            />
          </section>

          <section className="glass-card overflow-hidden">
            <div className="p-5">
              <p className="eyebrow">Source-backed scoring</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Point explanation</h2>
              <p className="mt-1 text-xs text-muted">
                No completed fixture statistics have been imported for this player in this private
                league yet.
              </p>
            </div>
            <div className="border-t border-white/[0.07] p-5">
              <p className="flex items-start gap-2 text-sm leading-6 text-muted">
                <CircleAlert className="mt-0.5 shrink-0 text-gold" size={17} /> Match-level
                explanations appear only after a completed provider fixture has been normalised and
                scored. No goals, passes, tackles, or totals are inferred here.
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="glass-card p-5">
            <p className="eyebrow">Ownership</p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              {owner ? owner.name : 'Ready to sign'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {mine
                ? `This player is registered to your club. They start on ${formatPoints(player.ownedPoints)} points for your club; only future rounds where you select them can add to that total. A release returns 90% of current book value.`
                : owner
                  ? `Managed by ${owner.manager}. Make a transfer offer when the market permits.`
                  : `This player is unowned in ${state.leagueName}'s local market view. Their displayed season points are not included when you buy them: select them in a future round to earn points for your club. Live ownership and balance are checked together by the server before a real signing can complete.`}
            </p>
            {mine || !owner ? (
              <button
                onClick={action}
                disabled={!mine && player.valueMinor > currentClub.budgetMinor}
                type="button"
                className={`${mine ? 'button-danger' : 'button-primary'} mt-5 w-full`}
              >
                {mine ? (
                  'Release player'
                ) : (
                  <>
                    <ShoppingBag size={17} /> Buy for {formatMoney(player.valueMinor)}
                  </>
                )}
              </button>
            ) : (
              <button type="button" className="button-secondary mt-5 w-full">
                Make transfer offer <ChevronRight size={17} />
              </button>
            )}
            {!owner ? (
              <p className="mt-3 flex items-start gap-2 text-[0.65rem] leading-5 text-muted">
                <LockKeyhole className="mt-0.5 shrink-0" size={13} /> The production database
                enforces unique ownership. This local preview is not an authoritative signing.
              </p>
            ) : null}
          </section>
          <section className="glass-card overflow-hidden">
            <div className="p-5">
              <p className="eyebrow">Availability & demand</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Market context</h2>
            </div>
            <div className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
              <MarketFact
                label="Chance of playing"
                value={formatPlayingChance(player.availabilityDetail.chanceNextRound)}
                detail="Next round"
              />
              <MarketFact
                label="Selected by"
                value={`${player.marketInterest.selectedByPercent.toFixed(1)}%`}
                detail="Of Fantasy Premier League managers"
              />
              <MarketFact
                label="Transfers this round"
                value={`${formatNumber(player.marketInterest.transfersInEvent)} in · ${formatNumber(player.marketInterest.transfersOutEvent)} out`}
                detail="Current round activity"
              />
              <MarketFact
                label="Season transfers"
                value={`${formatNumber(player.marketInterest.transfersInSeason)} in · ${formatNumber(player.marketInterest.transfersOutSeason)} out`}
                detail="Season-long activity"
              />
              {player.availabilityDetail.news ? (
                <div className="p-4">
                  <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">Latest club news</p>
                  <p className="mt-1 text-sm leading-6 text-ivory">{player.availabilityDetail.news}</p>
                </div>
              ) : null}
            </div>
          </section>
          <section className="glass-card p-5">
            <p className="eyebrow">Points by competition</p>
            <p className="mt-3 text-xs leading-5 text-muted">
              Competition totals will appear when this league has imported and scored completed
              fixtures. Totals are never estimated by splitting a player's season score.
            </p>
          </section>
          <section className="rounded-2xl border border-gold/20 bg-gold/[0.06] p-4">
            <div className="flex items-center gap-2 text-gold">
              <CircleAlert size={17} />
              <h2 className="text-sm font-bold">Source transparency</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              No touches, possession-lost or turnover points were invented. Only observed provider
              fields are scored.
            </p>
            <Link
              to="/app/admin"
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-gold"
            >
              View coverage report <ChevronRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function PlayerMetricGrid({
  metrics,
  decimal = false
}: {
  metrics: Array<[string, number]>;
  decimal?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 border-t border-white/[0.07] sm:grid-cols-3 lg:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="border-b border-r border-white/[0.07] p-3 last:border-b-0">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-1 font-display text-xl font-bold text-ivory">
            {decimal ? value.toFixed(2) : formatNumber(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function MarketFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="p-4">
      <p className="text-[0.62rem] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ivory">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function formatPlayingChance(chance: number | null): string {
  return chance === null ? 'Not reported' : `${chance}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}
